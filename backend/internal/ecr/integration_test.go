package ecr

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestECRIntegration(t *testing.T) {
	// 1. Setup temporary directory for ECR storage
	tmpDir, err := os.MkdirTemp("", "ministack-ecr-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// 2. Initialize Module
	m, err := NewModule(tmpDir, "9091")
	if err != nil {
		t.Fatalf("failed to initialize ECR module: %v", err)
	}

	// 3. Set up chi router
	r := chi.NewRouter()
	m.RegisterRegistryRoutes(r)
	m.RegisterManagementRoutes(r)

	ts := httptest.NewServer(r)
	defer ts.Close()

	// 4. Test Version Handshake /v2/
	resp, err := http.Get(ts.URL + "/v2/")
	if err != nil {
		t.Fatalf("failed V2 handshake request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("handshake status got %v, expected 200", resp.StatusCode)
	}
	if v := resp.Header.Get("Docker-Distribution-Api-Version"); v != "registry/2.0" {
		t.Errorf("handshake version header got %q, expected registry/2.0", v)
	}

	// 5. Test List Repositories (should be empty initially)
	resp, err = http.Get(ts.URL + "/ecr/repositories")
	if err != nil {
		t.Fatalf("failed list repositories request: %v", err)
	}
	var repos []ECRRepository
	if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
		t.Fatalf("failed to decode list repositories: %v", err)
	}
	if len(repos) != 0 {
		t.Errorf("expected 0 repositories, got %d", len(repos))
	}

	// 6. Test Create Repository (with slash)
	createPayload := []byte(`{"name": "test/app", "imageTagMutability": "MUTABLE"}`)
	resp, err = http.Post(ts.URL+"/ecr/repositories", "application/json", bytes.NewReader(createPayload))
	if err != nil {
		t.Fatalf("failed to create repository request: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("create repository status got %v, expected 201", resp.StatusCode)
	}
	var created ECRRepository
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode created repository: %v", err)
	}
	if created.RepositoryName != "test/app" {
		t.Errorf("created repository name got %q, expected test/app", created.RepositoryName)
	}

	// 7. List Repositories again (should have 1)
	resp, err = http.Get(ts.URL + "/ecr/repositories")
	if err != nil {
		t.Fatalf("failed list repositories request: %v", err)
	}
	if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
		t.Fatalf("failed to decode list repositories: %v", err)
	}
	if len(repos) != 1 {
		t.Errorf("expected 1 repository, got %d", len(repos))
	}

	// 8. Test Registry Blobs Upload Session Init
	resp, err = http.Post(ts.URL+"/v2/test/app/blobs/uploads/", "", nil)
	if err != nil {
		t.Fatalf("failed blob upload init: %v", err)
	}
	if resp.StatusCode != http.StatusAccepted {
		t.Errorf("blob upload init status got %v, expected 202", resp.StatusCode)
	}
	uuid := resp.Header.Get("Docker-Upload-UUID")
	location := resp.Header.Get("Location")
	if uuid == "" || location == "" {
		t.Errorf("expected upload headers: uuid=%q location=%q", uuid, location)
	}

	// 9. Patch upload chunk (append raw data)
	blobContent := []byte("fake-layer-data-12345")
	client := &http.Client{}
	req, err := http.NewRequest(http.MethodPatch, ts.URL+location, bytes.NewReader(blobContent))
	if err != nil {
		t.Fatalf("failed patch request creation: %v", err)
	}
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed patch request: %v", err)
	}
	if resp.StatusCode != http.StatusAccepted {
		t.Errorf("patch upload status got %v, expected 202", resp.StatusCode)
	}

	// 10. Finalize upload using PUT
	expectedDigest := "sha256:e80e5aa281d985147728063f695d63955b7c3dfcb2245274f2da934a925e7ba8"
	putURL := ts.URL + location + "?digest=" + expectedDigest
	req, err = http.NewRequest(http.MethodPut, putURL, nil)
	if err != nil {
		t.Fatalf("failed put request creation: %v", err)
	}
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed put request: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("put upload status got %v, expected 201", resp.StatusCode)
	}

	// 11. Head Blob (verify it exists)
	req, err = http.NewRequest(http.MethodHead, ts.URL+"/v2/test/app/blobs/"+expectedDigest, nil)
	if err != nil {
		t.Fatalf("failed head blob creation: %v", err)
	}
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed head blob request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("head blob status got %v, expected 200", resp.StatusCode)
	}

	// 12. Save Manifest
	manifestJSON := []byte(`{
		"schemaVersion": 2,
		"mediaType": "application/vnd.docker.distribution.manifest.v2+json",
		"config": {
			"mediaType": "application/vnd.docker.container.image.v1+json",
			"size": 2,
			"digest": "sha256:e80e5aa281d985147728063f695d63955b7c3dfcb2245274f2da934a925e7ba8"
		},
		"layers": [
			{
				"mediaType": "application/vnd.docker.image.rootfs.diff.tar.gzip",
				"size": 21,
				"digest": "sha256:e80e5aa281d985147728063f695d63955b7c3dfcb2245274f2da934a925e7ba8"
			}
		]
	}`)
	req, err = http.NewRequest(http.MethodPut, ts.URL+"/v2/test/app/manifests/latest", bytes.NewReader(manifestJSON))
	if err != nil {
		t.Fatalf("failed put manifest creation: %v", err)
	}
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed put manifest request: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("put manifest status got %v, expected 201", resp.StatusCode)
	}
	savedDigest := resp.Header.Get("Docker-Content-Digest")

	// 13. List Images (using encoded URL parameter "test%2Fapp")
	resp, err = http.Get(ts.URL + "/ecr/repositories/test%2Fapp/images")
	if err != nil {
		t.Fatalf("failed list images request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("list images status got %v, expected 200", resp.StatusCode)
	}
	var images []ECRImage
	if err := json.NewDecoder(resp.Body).Decode(&images); err != nil {
		t.Fatalf("failed to decode list images: %v", err)
	}
	if len(images) != 1 {
		t.Errorf("expected 1 image, got %d", len(images))
	}
	if images[0].ImageDigest != savedDigest {
		t.Errorf("expected image digest %q, got %q", savedDigest, images[0].ImageDigest)
	}

	// 14. Delete Image
	req, err = http.NewRequest(http.MethodDelete, ts.URL+"/ecr/repositories/test%2Fapp/images/"+url.QueryEscape(savedDigest), nil)
	if err != nil {
		t.Fatalf("failed delete image creation: %v", err)
	}
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed delete image request: %v", err)
	}
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("delete image status got %v, expected 204", resp.StatusCode)
	}

	// 15. Test Pull Image via /ecr/repositories/{name}/pull
	pullPayload := []byte(`{"sourceImage": "paulbouwer/hello-kubernetes:1.10", "tag": "latest"}`)
	resp, err = http.Post(ts.URL+"/ecr/repositories/hello-k8s/pull", "application/json", bytes.NewReader(pullPayload))
	if err != nil {
		t.Fatalf("failed pull image request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("pull image status got %v, expected 200", resp.StatusCode)
	}
	var pulledImg ECRImage
	if err := json.NewDecoder(resp.Body).Decode(&pulledImg); err != nil {
		t.Fatalf("failed to decode pulled image: %v", err)
	}
	if len(pulledImg.ImageTags) == 0 || pulledImg.ImageTags[0] != "latest" {
		t.Errorf("expected tag 'latest', got %v", pulledImg.ImageTags)
	}

	// 16. Verify repository and image created by pull
	resp, err = http.Get(ts.URL + "/ecr/repositories/hello-k8s/images")
	if err != nil {
		t.Fatalf("failed list images after pull: %v", err)
	}
	var k8sImages []ECRImage
	if err := json.NewDecoder(resp.Body).Decode(&k8sImages); err != nil {
		t.Fatalf("failed to decode k8s images: %v", err)
	}
	if len(k8sImages) != 1 {
		t.Errorf("expected 1 image in hello-k8s, got %d", len(k8sImages))
	}

	// 17. Test Pull Image via /docker/pull endpoint
	dockerPullPayload := []byte(`{"sourceImage": "redis:alpine", "targetRepository": "my-redis", "tag": "alpine"}`)
	resp, err = http.Post(ts.URL+"/docker/pull", "application/json", bytes.NewReader(dockerPullPayload))
	if err != nil {
		t.Fatalf("failed docker pull request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("docker pull status got %v, expected 200", resp.StatusCode)
	}

	// 18. Delete Repository
	req, err = http.NewRequest(http.MethodDelete, ts.URL+"/ecr/repositories/test%2Fapp", nil)
	if err != nil {
		t.Fatalf("failed delete repo creation: %v", err)
	}
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("failed delete repo request: %v", err)
	}
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("delete repo status got %v, expected 204", resp.StatusCode)
	}
}
