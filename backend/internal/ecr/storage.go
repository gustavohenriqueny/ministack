package ecr

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Repository struct {
	Name               string    `json:"name"`
	ImageTagMutability string    `json:"imageTagMutability"`
	CreatedAt          time.Time `json:"createdAt"`
}

type UploadSession struct {
	UUID      string
	RepoName  string
	TempPath  string
	BytesRecv int64
}

type ImageInfo struct {
	ImageDigest      string    `json:"imageDigest"`
	ImageTags        []string  `json:"imageTags"`
	ImagePushedAt    time.Time `json:"imagePushedAt"`
	ImageSizeInBytes int64     `json:"imageSizeInBytes"`
}

type Storage struct {
	baseDir string
	mu      sync.RWMutex
}

type manifestJSON struct {
	Config struct {
		Size int64 `json:"size"`
	} `json:"config"`
	Layers []struct {
		Size int64 `json:"size"`
	} `json:"layers"`
}

func NewStorage(baseDir string) *Storage {
	return &Storage{
		baseDir: baseDir,
	}
}

func expandHome(path string) (string, error) {
	if strings.HasPrefix(path, "~") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, path[1:]), nil
	}
	return path, nil
}

func generateUUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// Fallback if crypto/rand fails
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

func cleanDigest(digest string) string {
	return strings.TrimPrefix(digest, "sha256:")
}

func (s *Storage) InitStorage() error {
	base, err := expandHome(s.baseDir)
	if err != nil {
		return err
	}
	s.baseDir = base

	// Create blobs dir
	blobsDir := filepath.Join(s.baseDir, "blobs", "sha256")
	if err := os.MkdirAll(blobsDir, 0755); err != nil {
		return fmt.Errorf("failed to create blobs dir: %w", err)
	}

	reposFile := filepath.Join(s.baseDir, "repositories.json")
	if _, err := os.Stat(reposFile); os.IsNotExist(err) {
		if err := s.SaveRepositories([]Repository{}); err != nil {
			return fmt.Errorf("failed to initialize repositories.json: %w", err)
		}
	}
	return nil
}

func (s *Storage) LoadRepositories() ([]Repository, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	reposFile := filepath.Join(s.baseDir, "repositories.json")
	data, err := os.ReadFile(reposFile)
	if err != nil {
		return nil, err
	}

	var repos []Repository
	if err := json.Unmarshal(data, &repos); err != nil {
		return nil, err
	}
	return repos, nil
}

func (s *Storage) SaveRepositories(repos []Repository) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(repos, "", "  ")
	if err != nil {
		return err
	}

	reposFile := filepath.Join(s.baseDir, "repositories.json")
	tmpFile := reposFile + ".tmp"

	// Ensure baseDir directory exists
	if err := os.MkdirAll(s.baseDir, 0755); err != nil {
		return err
	}

	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		return err
	}

	if err := os.Rename(tmpFile, reposFile); err != nil {
		os.Remove(tmpFile)
		return err
	}

	return nil
}

func (s *Storage) CreateRepositoryDir(name string) error {
	manifestsDir := filepath.Join(s.baseDir, "repositories", name, "manifests")
	uploadsDir := filepath.Join(s.baseDir, "repositories", name, "uploads")

	if err := os.MkdirAll(manifestsDir, 0755); err != nil {
		return err
	}
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		return err
	}
	return nil
}

func (s *Storage) DeleteRepositoryDir(name string) error {
	repoDir := filepath.Join(s.baseDir, "repositories", name)
	return os.RemoveAll(repoDir)
}

func (s *Storage) BlobPath(digest string) string {
	hash := cleanDigest(digest)
	return filepath.Join(s.baseDir, "blobs", "sha256", hash)
}

func (s *Storage) BlobExists(digest string) (bool, int64, error) {
	path := s.BlobPath(digest)
	fi, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, 0, nil
		}
		return false, 0, err
	}
	return true, fi.Size(), nil
}

func (s *Storage) CreateUploadSession(repoName string) (string, string, error) {
	uuid := generateUUID()
	tempPath := filepath.Join(s.baseDir, "repositories", repoName, "uploads", uuid)

	if err := os.MkdirAll(filepath.Dir(tempPath), 0755); err != nil {
		return "", "", err
	}

	f, err := os.OpenFile(tempPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
	if err != nil {
		return "", "", err
	}
	f.Close()

	return uuid, tempPath, nil
}

func (s *Storage) GetUploadPath(repoName, uuid string) string {
	return filepath.Join(s.baseDir, "repositories", repoName, "uploads", uuid)
}

func (s *Storage) AppendToUpload(tempPath string, data io.Reader) (int64, error) {
	f, err := os.OpenFile(tempPath, os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	if _, err := io.Copy(f, data); err != nil {
		return 0, err
	}

	fi, err := os.Stat(tempPath)
	if err != nil {
		return 0, err
	}

	return fi.Size(), nil
}

func (s *Storage) FinalizeUpload(tempPath, digest string) error {
	f, err := os.Open(tempPath)
	if err != nil {
		return err
	}

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		f.Close()
		return err
	}
	f.Close()

	calculatedHash := hex.EncodeToString(h.Sum(nil))
	expectedHash := cleanDigest(digest)

	if calculatedHash != expectedHash {
		return fmt.Errorf("digest mismatch: expected %s, got %s", expectedHash, calculatedHash)
	}

	destPath := filepath.Join(s.baseDir, "blobs", "sha256", expectedHash)
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return err
	}

	if err := os.Rename(tempPath, destPath); err != nil {
		return err
	}

	return nil
}

func (s *Storage) DeleteUpload(tempPath string) {
	os.Remove(tempPath)
}

func (s *Storage) SaveManifest(repoName string, reference string, content []byte) (string, error) {
	h := sha256.New()
	h.Write(content)
	digest := "sha256:" + hex.EncodeToString(h.Sum(nil))

	manifestsDir := filepath.Join(s.baseDir, "repositories", repoName, "manifests")
	if err := os.MkdirAll(manifestsDir, 0755); err != nil {
		return "", err
	}

	manifestPath := filepath.Join(manifestsDir, digest)
	if err := os.WriteFile(manifestPath, content, 0644); err != nil {
		return "", err
	}

	if !strings.HasPrefix(reference, "sha256:") {
		tagPath := filepath.Join(manifestsDir, reference)
		if err := os.WriteFile(tagPath, []byte(digest), 0644); err != nil {
			return "", err
		}
	}

	return digest, nil
}

func (s *Storage) GetManifest(repoName string, reference string) ([]byte, string, error) {
	manifestsDir := filepath.Join(s.baseDir, "repositories", repoName, "manifests")

	digest := reference
	if !strings.HasPrefix(reference, "sha256:") {
		tagPath := filepath.Join(manifestsDir, reference)
		data, err := os.ReadFile(tagPath)
		if err != nil {
			if os.IsNotExist(err) {
				// Fallback: If requested tag is "latest" or not found, try other existing tags
				tags, tagErr := s.ListTags(repoName)
				if tagErr == nil && len(tags) > 0 {
					for _, t := range tags {
						if t != reference {
							if c, d, e := s.GetManifest(repoName, t); e == nil {
								return c, d, nil
							}
						}
					}
				}
				// Fallback: Try any sha256 manifest in repository
				files, readErr := os.ReadDir(manifestsDir)
				if readErr == nil {
					for _, f := range files {
						if strings.HasPrefix(f.Name(), "sha256:") {
							if c, d, e := s.GetManifest(repoName, f.Name()); e == nil {
								return c, d, nil
							}
						}
					}
				}
				return nil, "", fmt.Errorf("tag %s not found: %w", reference, os.ErrNotExist)
			}
			return nil, "", err
		}
		digest = strings.TrimSpace(string(data))
	}

	manifestPath := filepath.Join(manifestsDir, digest)
	content, err := os.ReadFile(manifestPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, "", fmt.Errorf("manifest %s not found: %w", digest, os.ErrNotExist)
		}
		return nil, "", err
	}

	return content, digest, nil
}

func (s *Storage) DeleteManifest(repoName string, digest string) error {
	manifestsDir := filepath.Join(s.baseDir, "repositories", repoName, "manifests")
	manifestPath := filepath.Join(manifestsDir, digest)

	if _, err := os.Stat(manifestPath); os.IsNotExist(err) {
		return os.ErrNotExist
	}

	if err := os.Remove(manifestPath); err != nil {
		return err
	}

	files, err := os.ReadDir(manifestsDir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if file.IsDir() || strings.HasPrefix(file.Name(), "sha256:") {
			continue
		}

		tagPath := filepath.Join(manifestsDir, file.Name())
		data, err := os.ReadFile(tagPath)
		if err != nil {
			continue
		}

		if strings.TrimSpace(string(data)) == digest {
			os.Remove(tagPath)
		}
	}

	return nil
}

func (s *Storage) ListTags(repoName string) ([]string, error) {
	manifestsDir := filepath.Join(s.baseDir, "repositories", repoName, "manifests")
	files, err := os.ReadDir(manifestsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}

	var tags []string
	for _, file := range files {
		if file.IsDir() {
			continue
		}
		name := file.Name()
		if !strings.HasPrefix(name, "sha256:") {
			tags = append(tags, name)
		}
	}
	return tags, nil
}

func (s *Storage) ListImages(repoName string) ([]ImageInfo, error) {
	manifestsDir := filepath.Join(s.baseDir, "repositories", repoName, "manifests")
	files, err := os.ReadDir(manifestsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []ImageInfo{}, nil
		}
		return nil, err
	}

	tagMap := make(map[string][]string)
	for _, file := range files {
		if file.IsDir() || strings.HasPrefix(file.Name(), "sha256:") {
			continue
		}
		tagPath := filepath.Join(manifestsDir, file.Name())
		data, err := os.ReadFile(tagPath)
		if err != nil {
			continue
		}
		digest := strings.TrimSpace(string(data))
		tagMap[digest] = append(tagMap[digest], file.Name())
	}

	var images []ImageInfo
	for _, file := range files {
		if file.IsDir() || !strings.HasPrefix(file.Name(), "sha256:") {
			continue
		}

		digest := file.Name()
		manifestPath := filepath.Join(manifestsDir, digest)

		info, err := file.Info()
		if err != nil {
			continue
		}

		content, err := os.ReadFile(manifestPath)
		if err != nil {
			continue
		}

		var m manifestJSON
		var size int64
		if err := json.Unmarshal(content, &m); err == nil {
			size = m.Config.Size
			for _, layer := range m.Layers {
				size += layer.Size
			}
		} else {
			size = info.Size()
		}

		tags := tagMap[digest]
		if tags == nil {
			tags = []string{}
		}

		images = append(images, ImageInfo{
			ImageDigest:      digest,
			ImageTags:        tags,
			ImagePushedAt:    info.ModTime(),
			ImageSizeInBytes: size,
		})
	}

	return images, nil
}
