package ecr

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
)

type RegistryHandler struct {
	storage *Storage
}

func NewRegistryHandler(storage *Storage) *RegistryHandler {
	return &RegistryHandler{
		storage: storage,
	}
}

type RegistryError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

type RegistryErrors struct {
	Errors []RegistryError `json:"errors"`
}

func writeRegistryError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(RegistryErrors{
		Errors: []RegistryError{
			{
				Code:    code,
				Message: message,
			},
		},
	})
}

func extractRepoName(path, suffix string) string {
	p := strings.TrimPrefix(path, "/v2/")
	p = strings.TrimSuffix(p, suffix)
	return strings.Trim(p, "/")
}

func parseRegistryPath(path string) (repoName string, resourceType string, resourceValue string) {
	p := strings.Trim(path, "/")
	if p == "v2" {
		return "", "handshake", ""
	}

	if !strings.HasPrefix(p, "v2/") {
		return "", "", ""
	}
	p = p[3:] // Strip "v2/"

	if idx := strings.Index(p, "/blobs/uploads"); idx != -1 {
		repoName = p[:idx]
		uuid := strings.TrimPrefix(p[idx:], "/blobs/uploads")
		uuid = strings.Trim(uuid, "/")
		if uuid == "" {
			return repoName, "uploads_init", ""
		}
		return repoName, "upload_session", uuid
	}

	if idx := strings.Index(p, "/blobs/"); idx != -1 {
		repoName = p[:idx]
		digest := p[idx+7:]
		return repoName, "blob", digest
	}

	if idx := strings.Index(p, "/manifests/"); idx != -1 {
		repoName = p[:idx]
		ref := p[idx+11:]
		return repoName, "manifest", ref
	}

	if strings.HasSuffix(p, "/tags/list") {
		repoName = strings.TrimSuffix(p, "/tags/list")
		return repoName, "tags_list", ""
	}

	return "", "", ""
}

func (h *RegistryHandler) Handshake(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Docker-Distribution-Api-Version", "registry/2.0")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("{}"))
}

func (h *RegistryHandler) HandleRegistry(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Docker-Distribution-Api-Version", "registry/2.0")

	path := r.URL.Path
	repoName, resourceType, val := parseRegistryPath(path)
	if resourceType == "" {
		writeRegistryError(w, http.StatusNotFound, "UNSUPPORTED", "Unsupported route or method")
		return
	}

	// Verify if the repository is registered
	if resourceType != "handshake" && resourceType != "uploads_init" {
		repos, err := h.storage.LoadRepositories()
		if err != nil {
			writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", "Failed to load repositories")
			return
		}
		found := false
		for _, repo := range repos {
			if repo.Name == repoName {
				found = true
				break
			}
		}
		if !found {
			writeRegistryError(w, http.StatusNotFound, "NAME_UNKNOWN", "Repository not found")
			return
		}
	}

	switch resourceType {
	case "uploads_init":
		if r.Method == http.MethodPost {
			h.initUpload(w, r, repoName)
		} else {
			writeRegistryError(w, http.StatusMethodNotAllowed, "UNSUPPORTED", "Method not allowed")
		}
	case "upload_session":
		uuid := val
		if r.Method == http.MethodPatch {
			h.patchUpload(w, r, repoName, uuid)
		} else if r.Method == http.MethodPut {
			h.putUpload(w, r, repoName, uuid)
		} else {
			writeRegistryError(w, http.StatusMethodNotAllowed, "UNSUPPORTED", "Method not allowed")
		}
	case "blob":
		digest := val
		if r.Method == http.MethodHead {
			h.headBlob(w, r, repoName, digest)
		} else if r.Method == http.MethodGet {
			h.getBlob(w, r, repoName, digest)
		} else {
			writeRegistryError(w, http.StatusMethodNotAllowed, "UNSUPPORTED", "Method not allowed")
		}
	case "manifest":
		ref := val
		if r.Method == http.MethodHead {
			h.headManifest(w, r, repoName, ref)
		} else if r.Method == http.MethodGet {
			h.getManifest(w, r, repoName, ref)
		} else if r.Method == http.MethodPut {
			h.putManifest(w, r, repoName, ref)
		} else if r.Method == http.MethodDelete {
			h.deleteManifest(w, r, repoName, ref)
		} else {
			writeRegistryError(w, http.StatusMethodNotAllowed, "UNSUPPORTED", "Method not allowed")
		}
	case "tags_list":
		if r.Method == http.MethodGet {
			h.listTags(w, r, repoName)
		} else {
			writeRegistryError(w, http.StatusMethodNotAllowed, "UNSUPPORTED", "Method not allowed")
		}
	default:
		writeRegistryError(w, http.StatusNotFound, "UNSUPPORTED", "Unsupported resource type")
	}
}

func (h *RegistryHandler) headBlob(w http.ResponseWriter, r *http.Request, repoName, digest string) {
	exists, size, err := h.storage.BlobExists(digest)
	if err != nil {
		writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", err.Error())
		return
	}
	if !exists {
		writeRegistryError(w, http.StatusNotFound, "BLOB_UNKNOWN", "blob unknown to registry")
		return
	}

	w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	w.Header().Set("Docker-Content-Digest", digest)
	w.Header().Set("Content-Type", "application/octet-stream")
	w.WriteHeader(http.StatusOK)
}

func (h *RegistryHandler) getBlob(w http.ResponseWriter, r *http.Request, repoName, digest string) {
	exists, size, err := h.storage.BlobExists(digest)
	if err != nil {
		writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", err.Error())
		return
	}
	if !exists {
		writeRegistryError(w, http.StatusNotFound, "BLOB_UNKNOWN", "blob unknown to registry")
		return
	}

	path := h.storage.BlobPath(digest)
	f, err := os.Open(path)
	if err != nil {
		writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", err.Error())
		return
	}
	defer f.Close()

	w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	w.Header().Set("Docker-Content-Digest", digest)
	w.Header().Set("Content-Type", "application/octet-stream")
	w.WriteHeader(http.StatusOK)
	io.Copy(w, f)
}

func (h *RegistryHandler) initUpload(w http.ResponseWriter, r *http.Request, repoName string) {
	// First ensure repository actually exists in config
	repos, err := h.storage.LoadRepositories()
	if err != nil {
		writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", "Failed to load repositories")
		return
	}
	found := false
	for _, r := range repos {
		if r.Name == repoName {
			found = true
			break
		}
	}
	if !found {
		writeRegistryError(w, http.StatusNotFound, "NAME_UNKNOWN", "Repository not found")
		return
	}

	uuid, _, err := h.storage.CreateUploadSession(repoName)
	if err != nil {
		writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", err.Error())
		return
	}

	w.Header().Set("Location", "/v2/"+repoName+"/blobs/uploads/"+uuid)
	w.Header().Set("Range", "0-0")
	w.Header().Set("Docker-Upload-UUID", uuid)
	w.WriteHeader(http.StatusAccepted)
}

func (h *RegistryHandler) patchUpload(w http.ResponseWriter, r *http.Request, repoName, uuid string) {
	tempPath := h.storage.GetUploadPath(repoName, uuid)
	if _, err := os.Stat(tempPath); os.IsNotExist(err) {
		writeRegistryError(w, http.StatusNotFound, "BLOB_UPLOAD_UNKNOWN", "blob upload unknown")
		return
	}

	size, err := h.storage.AppendToUpload(tempPath, r.Body)
	if err != nil {
		writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", err.Error())
		return
	}

	w.Header().Set("Location", "/v2/"+repoName+"/blobs/uploads/"+uuid)
	w.Header().Set("Range", "0-"+strconv.FormatInt(size-1, 10))
	w.Header().Set("Docker-Upload-UUID", uuid)
	w.WriteHeader(http.StatusAccepted)
}

func (h *RegistryHandler) putUpload(w http.ResponseWriter, r *http.Request, repoName, uuid string) {
	digest := r.URL.Query().Get("digest")
	if digest == "" {
		writeRegistryError(w, http.StatusBadRequest, "DIGEST_INVALID", "provided digest did not match uploaded content")
		return
	}

	tempPath := h.storage.GetUploadPath(repoName, uuid)
	if _, err := os.Stat(tempPath); os.IsNotExist(err) {
		writeRegistryError(w, http.StatusNotFound, "BLOB_UPLOAD_UNKNOWN", "blob upload unknown")
		return
	}

	// If there's body content in the PUT request, append it first (some clients do this)
	if r.ContentLength > 0 {
		_, err := h.storage.AppendToUpload(tempPath, r.Body)
		if err != nil {
			writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", err.Error())
			return
		}
	}

	err := h.storage.FinalizeUpload(tempPath, digest)
	if err != nil {
		h.storage.DeleteUpload(tempPath)
		writeRegistryError(w, http.StatusBadRequest, "DIGEST_INVALID", "provided digest did not match uploaded content")
		return
	}

	w.Header().Set("Location", "/v2/"+repoName+"/blobs/"+digest)
	w.Header().Set("Docker-Content-Digest", digest)
	w.WriteHeader(http.StatusCreated)
}

func (h *RegistryHandler) headManifest(w http.ResponseWriter, r *http.Request, repoName, ref string) {
	content, digest, err := h.storage.GetManifest(repoName, ref)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			writeRegistryError(w, http.StatusNotFound, "MANIFEST_UNKNOWN", "manifest unknown")
			return
		}
		writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", err.Error())
		return
	}

	contentType := "application/vnd.docker.distribution.manifest.v2+json"
	var m struct {
		MediaType string `json:"mediaType"`
	}
	if err := json.Unmarshal(content, &m); err == nil && m.MediaType != "" {
		contentType = m.MediaType
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Docker-Content-Digest", digest)
	w.Header().Set("Content-Length", strconv.Itoa(len(content)))
	w.WriteHeader(http.StatusOK)
}

func (h *RegistryHandler) getManifest(w http.ResponseWriter, r *http.Request, repoName, ref string) {
	content, digest, err := h.storage.GetManifest(repoName, ref)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			writeRegistryError(w, http.StatusNotFound, "MANIFEST_UNKNOWN", "manifest unknown")
			return
		}
		writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", err.Error())
		return
	}

	// Try to extract content-type from manifest
	contentType := "application/vnd.docker.distribution.manifest.v2+json" // default
	var m struct {
		MediaType string `json:"mediaType"`
	}
	if err := json.Unmarshal(content, &m); err == nil && m.MediaType != "" {
		contentType = m.MediaType
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Docker-Content-Digest", digest)
	w.Header().Set("Content-Length", strconv.Itoa(len(content)))
	w.WriteHeader(http.StatusOK)
	w.Write(content)
}

func (h *RegistryHandler) putManifest(w http.ResponseWriter, r *http.Request, repoName, ref string) {
	content, err := io.ReadAll(r.Body)
	if err != nil {
		writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", err.Error())
		return
	}

	digest, err := h.storage.SaveManifest(repoName, ref, content)
	if err != nil {
		writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", err.Error())
		return
	}

	w.Header().Set("Location", "/v2/"+repoName+"/manifests/"+digest)
	w.Header().Set("Docker-Content-Digest", digest)
	w.WriteHeader(http.StatusCreated)
}

func (h *RegistryHandler) deleteManifest(w http.ResponseWriter, r *http.Request, repoName, digest string) {
	err := h.storage.DeleteManifest(repoName, digest)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", err.Error())
		return
	}

	w.WriteHeader(http.StatusAccepted)
}

func (h *RegistryHandler) listTags(w http.ResponseWriter, r *http.Request, repoName string) {
	tags, err := h.storage.ListTags(repoName)
	if err != nil {
		writeRegistryError(w, http.StatusInternalServerError, "UNSUPPORTED", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"name": repoName,
		"tags": tags,
	})
}
