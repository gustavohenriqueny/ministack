package ecr

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/ministack/backend/internal/ecs"
)

type ECRRepository struct {
	RepositoryArn      string    `json:"repositoryArn"`
	RepositoryName     string    `json:"repositoryName"`
	RepositoryUri      string    `json:"repositoryUri"`
	CreatedAt          time.Time `json:"createdAt"`
	ImageTagMutability string    `json:"imageTagMutability"`
	ImageCount         int       `json:"imageCount"`
}

type ECRImage struct {
	ImageDigest      string    `json:"imageDigest"`
	ImageTags        []string  `json:"imageTags"`
	ImagePushedAt    time.Time `json:"imagePushedAt"`
	ImageSizeInBytes int64     `json:"imageSizeInBytes"`
}

type PullImageRequest struct {
	SourceImage      string `json:"sourceImage"`
	Tag              string `json:"tag,omitempty"`
	TargetRepository string `json:"targetRepository,omitempty"`
}

type ManagementHandler struct {
	storage *Storage
	Port    string
	docker  ecs.DockerRunner
}

func NewManagementHandler(storage *Storage, port string, docker ...ecs.DockerRunner) *ManagementHandler {
	var dr ecs.DockerRunner
	if len(docker) > 0 {
		dr = docker[0]
	}
	return &ManagementHandler{
		storage: storage,
		Port:    port,
		docker:  dr,
	}
}

var nameRegex = regexp.MustCompile(`^[a-z0-9._/-]+$`)

func (h *ManagementHandler) ListRepositories(w http.ResponseWriter, r *http.Request) {
	repos, err := h.storage.LoadRepositories()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to load repositories"})
		return
	}

	response := make([]ECRRepository, 0, len(repos))
	for _, repo := range repos {
		images, err := h.storage.ListImages(repo.Name)
		imageCount := 0
		if err == nil {
			imageCount = len(images)
		}

		response = append(response, ECRRepository{
			RepositoryArn:      "arn:aws:ecr:us-east-1:000000000000:repository/" + repo.Name,
			RepositoryName:     repo.Name,
			RepositoryUri:      fmt.Sprintf("localhost:%s/%s", h.Port, repo.Name),
			CreatedAt:          repo.CreatedAt,
			ImageTagMutability: repo.ImageTagMutability,
			ImageCount:         imageCount,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func (h *ManagementHandler) CreateRepository(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name               string `json:"name"`
		ImageTagMutability string `json:"imageTagMutability"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request body"})
		return
	}

	if req.Name == "" || !nameRegex.MatchString(req.Name) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid repository name"})
		return
	}

	mutability := req.ImageTagMutability
	if mutability == "" {
		mutability = "MUTABLE"
	}
	if mutability != "MUTABLE" && mutability != "IMMUTABLE" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid mutability setting"})
		return
	}

	repos, err := h.storage.LoadRepositories()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to load repositories"})
		return
	}

	for _, repo := range repos {
		if repo.Name == req.Name {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]string{"error": "repository already exists"})
			return
		}
	}

	newRepo := Repository{
		Name:               req.Name,
		ImageTagMutability: mutability,
		CreatedAt:          time.Now(),
	}

	repos = append(repos, newRepo)
	if err := h.storage.SaveRepositories(repos); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to save repositories"})
		return
	}

	if err := h.storage.CreateRepositoryDir(req.Name); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to create directory structure"})
		return
	}

	resp := ECRRepository{
		RepositoryArn:      "arn:aws:ecr:us-east-1:000000000000:repository/" + newRepo.Name,
		RepositoryName:     newRepo.Name,
		RepositoryUri:      fmt.Sprintf("localhost:%s/%s", h.Port, newRepo.Name),
		CreatedAt:          newRepo.CreatedAt,
		ImageTagMutability: newRepo.ImageTagMutability,
		ImageCount:         0,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func (h *ManagementHandler) DeleteRepository(w http.ResponseWriter, r *http.Request) {
	nameRaw := chi.URLParam(r, "name")
	name, err := url.PathUnescape(nameRaw)
	if err != nil {
		name = nameRaw
	}

	repos, err := h.storage.LoadRepositories()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to load repositories"})
		return
	}

	idx := -1
	for i, repo := range repos {
		if repo.Name == name {
			idx = i
			break
		}
	}

	if idx == -1 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "repository not found"})
		return
	}

	repos = append(repos[:idx], repos[idx+1:]...)
	if err := h.storage.SaveRepositories(repos); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to save repositories"})
		return
	}

	if err := h.storage.DeleteRepositoryDir(name); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to delete directory"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ManagementHandler) ListImages(w http.ResponseWriter, r *http.Request) {
	nameRaw := chi.URLParam(r, "name")
	name, err := url.PathUnescape(nameRaw)
	if err != nil {
		name = nameRaw
	}

	repos, err := h.storage.LoadRepositories()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to load repositories"})
		return
	}

	found := false
	for _, repo := range repos {
		if repo.Name == name {
			found = true
			break
		}
	}

	if !found {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "repository not found"})
		return
	}

	images, err := h.storage.ListImages(name)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to list images"})
		return
	}

	resp := make([]ECRImage, 0, len(images))
	for _, img := range images {
		resp = append(resp, ECRImage{
			ImageDigest:      img.ImageDigest,
			ImageTags:        img.ImageTags,
			ImagePushedAt:    img.ImagePushedAt,
			ImageSizeInBytes: img.ImageSizeInBytes,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

func (h *ManagementHandler) DeleteImage(w http.ResponseWriter, r *http.Request) {
	nameRaw := chi.URLParam(r, "name")
	name, err := url.PathUnescape(nameRaw)
	if err != nil {
		name = nameRaw
	}

	digestRaw := chi.URLParam(r, "digest")
	digest, err := url.PathUnescape(digestRaw)
	if err != nil {
		digest = digestRaw
	}

	repos, err := h.storage.LoadRepositories()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to load repositories"})
		return
	}

	found := false
	for _, repo := range repos {
		if repo.Name == name {
			found = true
			break
		}
	}

	if !found {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "repository not found"})
		return
	}

	if err := h.storage.DeleteManifest(name, digest); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "image manifest not found"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ManagementHandler) PullImage(w http.ResponseWriter, r *http.Request) {
	nameRaw := chi.URLParam(r, "name")
	name, err := url.PathUnescape(nameRaw)
	if err != nil {
		name = nameRaw
	}

	var req PullImageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request body"})
		return
	}

	req.SourceImage = strings.TrimSpace(req.SourceImage)
	if req.SourceImage == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "sourceImage is required"})
		return
	}

	// Determine repository name
	repoName := strings.TrimSpace(name)
	if repoName == "" {
		repoName = strings.TrimSpace(req.TargetRepository)
	}
	if repoName == "" {
		clean := req.SourceImage
		if idx := strings.LastIndex(clean, ":"); idx != -1 && !strings.Contains(clean[idx:], "/") {
			clean = clean[:idx]
		}
		if idx := strings.LastIndex(clean, "/"); idx != -1 {
			clean = clean[idx+1:]
		}
		repoName = clean
	}

	// Determine tag
	tag := strings.TrimSpace(req.Tag)
	if tag == "" {
		if idx := strings.LastIndex(req.SourceImage, ":"); idx != -1 && !strings.Contains(req.SourceImage[idx:], "/") {
			tag = req.SourceImage[idx+1:]
		} else {
			tag = "latest"
		}
	}

	// Ensure repository exists, if not create it
	repos, err := h.storage.LoadRepositories()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to load repositories"})
		return
	}

	repoExists := false
	for _, repo := range repos {
		if repo.Name == repoName {
			repoExists = true
			break
		}
	}

	if !repoExists {
		newRepo := Repository{
			Name:               repoName,
			ImageTagMutability: "MUTABLE",
			CreatedAt:          time.Now(),
		}
		repos = append(repos, newRepo)
		if err := h.storage.SaveRepositories(repos); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "failed to save repository"})
			return
		}
		if err := h.storage.CreateRepositoryDir(repoName); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "failed to create repository directory"})
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	var imageSize int64 = 15 * 1024 * 1024
	var configDigest string

	if h.docker != nil {
		if err := h.docker.PullImage(ctx, req.SourceImage); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("failed to pull image from Docker: %s", err.Error())})
			return
		}

		inspect, err := h.docker.InspectImage(ctx, req.SourceImage)
		if err == nil && inspect != nil {
			if inspect.Size > 0 {
				imageSize = inspect.Size
			} else if inspect.VirtualSize > 0 {
				imageSize = inspect.VirtualSize
			}
			if inspect.ID != "" {
				configDigest = inspect.ID
			}
		}

		localTarget := fmt.Sprintf("localhost:%s/%s", h.Port, repoName)
		_ = h.docker.TagImage(ctx, req.SourceImage, localTarget, tag)
		_ = h.docker.TagImage(ctx, req.SourceImage, repoName, tag)
		if tag != "latest" {
			_ = h.docker.TagImage(ctx, req.SourceImage, localTarget, "latest")
			_ = h.docker.TagImage(ctx, req.SourceImage, repoName, "latest")
		}
	}

	if configDigest == "" {
		hConfig := sha256.New()
		hConfig.Write([]byte(fmt.Sprintf("%s-%s-%d", repoName, tag, time.Now().UnixNano())))
		configDigest = "sha256:" + hex.EncodeToString(hConfig.Sum(nil))
	}

	hLayer := sha256.New()
	hLayer.Write([]byte(fmt.Sprintf("%s-%s-layer-%d", req.SourceImage, tag, time.Now().UnixNano())))
	layerDigest := "sha256:" + hex.EncodeToString(hLayer.Sum(nil))

	configSize := int64(1024)
	layerSize := imageSize - configSize
	if layerSize <= 0 {
		layerSize = imageSize
	}

	manifestObj := map[string]interface{}{
		"schemaVersion": 2,
		"mediaType":     "application/vnd.docker.distribution.manifest.v2+json",
		"config": map[string]interface{}{
			"mediaType": "application/vnd.docker.container.image.v1+json",
			"size":      configSize,
			"digest":    configDigest,
		},
		"layers": []map[string]interface{}{
			{
				"mediaType": "application/vnd.docker.image.rootfs.diff.tar.gzip",
				"size":      layerSize,
				"digest":    layerDigest,
			},
		},
	}

	manifestBytes, err := json.Marshal(manifestObj)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to build manifest"})
		return
	}

	digest, err := h.storage.SaveManifest(repoName, tag, manifestBytes)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to save manifest to ECR storage"})
		return
	}

	if tag != "latest" {
		_, _ = h.storage.SaveManifest(repoName, "latest", manifestBytes)
	}

	resp := ECRImage{
		ImageDigest:      digest,
		ImageTags:        []string{tag},
		ImagePushedAt:    time.Now(),
		ImageSizeInBytes: imageSize,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}
