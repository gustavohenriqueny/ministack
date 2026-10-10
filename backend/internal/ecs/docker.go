package ecs

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// DockerRunner defines the interface for interacting with Docker (or fallback simulation).
type DockerRunner interface {
	Ping(ctx context.Context) error
	CreateContainer(ctx context.Context, name string, config ContainerCreateConfig) (string, error)
	StartContainer(ctx context.Context, containerID string) error
	StopContainer(ctx context.Context, containerID string, timeoutSec int) error
	RemoveContainer(ctx context.Context, containerID string, force bool) error
	GetContainerLogs(ctx context.Context, containerID string, tail string) (string, error)
	InspectContainer(ctx context.Context, containerID string) (*DockerContainerInspect, error)
	PullImage(ctx context.Context, image string) error
	TagImage(ctx context.Context, sourceImage, targetRepo, targetTag string) error
	InspectImage(ctx context.Context, image string) (*DockerImageInspect, error)
	ListImages(ctx context.Context) ([]DockerImageSummary, error)
	IsSimulated() bool
}

// DockerImageSummary represents an image summary listed from Docker Engine.
type DockerImageSummary struct {
	ID       string   `json:"id"`
	RepoTags []string `json:"repoTags"`
	Size     int64    `json:"size"`
	Created  int64    `json:"created"`
}

// DockerImageInspect represents image inspection details from Docker API.
type DockerImageInspect struct {
	ID          string   `json:"Id"`
	RepoTags    []string `json:"RepoTags"`
	Size        int64    `json:"Size"`
	VirtualSize int64    `json:"VirtualSize"`
}

// ContainerCreateConfig contains parameters for creating a container.
type ContainerCreateConfig struct {
	Image        string
	Env          []string
	Labels       map[string]string
	CPU          int64 // CPU units (e.g. 256)
	Memory       int64 // Memory in MB (e.g. 512)
	PortMappings []PortMapping
}

// DockerPortBinding represents a port binding for Docker Engine API.
type DockerPortBinding struct {
	HostIP   string `json:"HostIp"`
	HostPort string `json:"HostPort"`
}

// DockerHostConfig represents HostConfig in Docker Engine API.
type DockerHostConfig struct {
	PortBindings map[string][]DockerPortBinding `json:"PortBindings,omitempty"`
	NanoCPUs     int64                          `json:"NanoCpus,omitempty"`
	Memory       int64                          `json:"Memory,omitempty"`
	AutoRemove   bool                           `json:"AutoRemove,omitempty"`
}

// DockerCreateContainerRequest represents Docker API POST /containers/create body.
type DockerCreateContainerRequest struct {
	Image        string                         `json:"Image"`
	Env          []string                       `json:"Env,omitempty"`
	Labels       map[string]string              `json:"Labels,omitempty"`
	ExposedPorts map[string]struct{}            `json:"ExposedPorts,omitempty"`
	HostConfig   DockerHostConfig               `json:"HostConfig,omitempty"`
}

// DockerCreateContainerResponse represents Docker API POST /containers/create response.
type DockerCreateContainerResponse struct {
	ID       string   `json:"Id"`
	Warnings []string `json:"Warnings"`
	Message  string   `json:"message,omitempty"`
}

// DockerContainerState represents container state from Docker API inspect.
type DockerContainerState struct {
	Status     string `json:"Status"` // "created", "running", "paused", "restarting", "removing", "exited", "dead"
	Running    bool   `json:"Running"`
	Paused     bool   `json:"Paused"`
	Restarting bool   `json:"Restarting"`
	OOMKilled  bool   `json:"OOMKilled"`
	Dead       bool   `json:"Dead"`
	Pid        int    `json:"Pid"`
	ExitCode   int    `json:"ExitCode"`
	Error      string `json:"Error"`
	StartedAt  string `json:"StartedAt"`
	FinishedAt string `json:"FinishedAt"`
}

// DockerNetworkSettings represents container network settings from Docker API inspect.
type DockerNetworkSettings struct {
	IPAddress string                         `json:"IPAddress"`
	Ports     map[string][]DockerPortBinding `json:"Ports"`
}

// DockerContainerInspect represents the full container inspect response.
type DockerContainerInspect struct {
	ID              string                 `json:"Id"`
	Created         string                 `json:"Created"`
	Path            string                 `json:"Path"`
	Args            []string               `json:"Args"`
	State           DockerContainerState   `json:"State"`
	Image           string                 `json:"Image"`
	Name            string                 `json:"Name"`
	HostConfig      DockerHostConfig       `json:"HostConfig"`
	NetworkSettings DockerNetworkSettings  `json:"NetworkSettings"`
	Config          struct {
		Image  string            `json:"Image"`
		Env    []string          `json:"Env"`
		Labels map[string]string `json:"Labels"`
	} `json:"Config"`
}

// SimulatedContainer represents in-memory state when Docker socket is unavailable.
type SimulatedContainer struct {
	ID           string
	Name         string
	Image        string
	Env          []string
	Labels       map[string]string
	PortMappings []HostPortMapping
	State        DockerContainerState
	CreatedAt    time.Time
	StartedAt    time.Time
	StoppedAt    *time.Time
	Logs         []string
}

// DockerClient implements DockerRunner with unix socket HTTP client and fallback simulation.
type DockerClient struct {
	socketPath string
	httpClient *http.Client
	simulated  bool
	mu         sync.RWMutex
	simStore   map[string]*SimulatedContainer
}

// NewDockerClient creates a new DockerRunner client.
func NewDockerClient(socketPath string) *DockerClient {
	if socketPath == "" {
		if envSocket := os.Getenv("DOCKER_SOCKET"); envSocket != "" {
			socketPath = envSocket
		} else if envHost := os.Getenv("DOCKER_HOST"); envHost != "" && strings.HasPrefix(envHost, "unix://") {
			socketPath = strings.TrimPrefix(envHost, "unix://")
		} else {
			socketPath = "/var/run/docker.sock"
		}
	}

	dc := &DockerClient{
		socketPath: socketPath,
		simStore:   make(map[string]*SimulatedContainer),
	}

	dc.httpClient = &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, proto, addr string) (net.Conn, error) {
				return net.DialTimeout("unix", dc.socketPath, 2*time.Second)
			},
			DisableKeepAlives: false,
		},
	}

	// Test if Docker socket is available
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := dc.Ping(ctx); err != nil {
		dc.simulated = true
	}

	return dc
}

func (dc *DockerClient) IsSimulated() bool {
	dc.mu.RLock()
	defer dc.mu.RUnlock()
	return dc.simulated
}

// Ping checks if Docker daemon is responsive.
func (dc *DockerClient) Ping(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://localhost/_ping", nil)
	if err != nil {
		return err
	}

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ping returned status %d", resp.StatusCode)
	}
	return nil
}

// PullImage pulls an image from Docker registry.
func (dc *DockerClient) PullImage(ctx context.Context, image string) error {
	if dc.IsSimulated() {
		return nil
	}
	return dc.pullImage(ctx, image)
}

// pullImage pulls an image from Docker registry if missing.
func (dc *DockerClient) pullImage(ctx context.Context, image string) error {
	fromImage := image
	tag := ""
	if idx := strings.LastIndex(image, ":"); idx != -1 && !strings.Contains(image[idx:], "/") {
		fromImage = image[:idx]
		tag = image[idx+1:]
	}

	var pullURL string
	if tag != "" {
		pullURL = fmt.Sprintf("http://localhost/images/create?fromImage=%s&tag=%s", url.QueryEscape(fromImage), url.QueryEscape(tag))
	} else {
		pullURL = fmt.Sprintf("http://localhost/images/create?fromImage=%s", url.QueryEscape(fromImage))
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, pullURL, nil)
	if err != nil {
		return err
	}

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("pull failed with status %d: %s", resp.StatusCode, string(body))
	}
	// Consume body
	_, _ = io.Copy(io.Discard, resp.Body)
	return nil
}

// TagImage tags a local image into a target repository and tag.
func (dc *DockerClient) TagImage(ctx context.Context, sourceImage, targetRepo, targetTag string) error {
	if dc.IsSimulated() {
		return nil
	}
	if targetTag == "" {
		if idx := strings.LastIndex(targetRepo, ":"); idx != -1 && !strings.Contains(targetRepo[idx:], "/") {
			targetTag = targetRepo[idx+1:]
			targetRepo = targetRepo[:idx]
		} else {
			targetTag = "latest"
		}
	}
	tagURL := fmt.Sprintf("http://localhost/images/%s/tag?repo=%s&tag=%s",
		url.PathEscape(sourceImage),
		url.QueryEscape(targetRepo),
		url.QueryEscape(targetTag),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tagURL, nil)
	if err != nil {
		return err
	}
	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("tag failed (%d): %s", resp.StatusCode, string(body))
	}
	return nil
}

// InspectImage inspects a Docker image.
func (dc *DockerClient) InspectImage(ctx context.Context, image string) (*DockerImageInspect, error) {
	if dc.IsSimulated() {
		return &DockerImageInspect{
			ID:          "sha256:" + generateSimulatedID() + generateSimulatedID(),
			RepoTags:    []string{image},
			Size:        25 * 1024 * 1024,
			VirtualSize: 25 * 1024 * 1024,
		}, nil
	}

	inspectURL := fmt.Sprintf("http://localhost/images/%s/json", url.PathEscape(image))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, inspectURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("inspect image failed (%d): %s", resp.StatusCode, string(body))
	}

	var inspect DockerImageInspect
	if err := json.NewDecoder(resp.Body).Decode(&inspect); err != nil {
		return nil, err
	}
	return &inspect, nil
}

// ListImages lists images from local Docker daemon or simulated store.
func (dc *DockerClient) ListImages(ctx context.Context) ([]DockerImageSummary, error) {
	if dc.IsSimulated() {
		return []DockerImageSummary{
			{
				ID:       "sha256:simulated1",
				RepoTags: []string{"nginx:alpine"},
				Size:     23 * 1024 * 1024,
				Created:  time.Now().Unix(),
			},
			{
				ID:       "sha256:simulated2",
				RepoTags: []string{"paulbouwer/hello-kubernetes:1.10"},
				Size:     45 * 1024 * 1024,
				Created:  time.Now().Unix(),
			},
		}, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://localhost/images/json", nil)
	if err != nil {
		return nil, err
	}
	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("list images failed (%d): %s", resp.StatusCode, string(body))
	}

	var rawImages []struct {
		ID       string   `json:"Id"`
		RepoTags []string `json:"RepoTags"`
		Size     int64    `json:"Size"`
		Created  int64    `json:"Created"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&rawImages); err != nil {
		return nil, err
	}

	var result []DockerImageSummary
	for _, raw := range rawImages {
		var validTags []string
		for _, tag := range raw.RepoTags {
			if tag != "<none>:<none>" && tag != "" {
				validTags = append(validTags, tag)
			}
		}
		if len(validTags) > 0 {
			result = append(result, DockerImageSummary{
				ID:       raw.ID,
				RepoTags: validTags,
				Size:     raw.Size,
				Created:  raw.Created,
			})
		}
	}

	if result == nil {
		result = []DockerImageSummary{}
	}

	return result, nil
}

// CreateContainer creates a container in Docker or simulated store.
func (dc *DockerClient) CreateContainer(ctx context.Context, name string, config ContainerCreateConfig) (string, error) {
	if dc.IsSimulated() {
		return dc.createSimulatedContainer(name, config)
	}

	// Prepare Docker request payload
	exposedPorts := make(map[string]struct{})
	portBindings := make(map[string][]DockerPortBinding)

	for _, pm := range config.PortMappings {
		protocol := pm.Protocol
		if protocol == "" {
			protocol = "tcp"
		}
		portKey := fmt.Sprintf("%d/%s", pm.ContainerPort, protocol)
		exposedPorts[portKey] = struct{}{}
		portBindings[portKey] = []DockerPortBinding{
			{
				HostIP:   "0.0.0.0",
				HostPort: "", // Let Docker assign an ephemeral host port
			},
		}
	}

	var nanoCPUs int64
	if config.CPU > 0 {
		nanoCPUs = config.CPU * 1000000 // 256 CPU units -> 256000000 NanoCPUs (0.256 vCPU)
	}

	var memoryBytes int64
	if config.Memory > 0 {
		memoryBytes = config.Memory * 1024 * 1024 // MB to bytes
	}

	createReq := DockerCreateContainerRequest{
		Image:        config.Image,
		Env:          config.Env,
		Labels:       config.Labels,
		ExposedPorts: exposedPorts,
		HostConfig: DockerHostConfig{
			PortBindings: portBindings,
			NanoCPUs:     nanoCPUs,
			Memory:       memoryBytes,
		},
	}

	bodyBytes, err := json.Marshal(createReq)
	if err != nil {
		return "", fmt.Errorf("failed to marshal create container request: %w", err)
	}

	reqURL := "http://localhost/containers/create"
	if name != "" {
		reqURL += "?name=" + url.QueryEscape(name)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		// Fallback to simulated if docker fails during request
		dc.mu.Lock()
		dc.simulated = true
		dc.mu.Unlock()
		return dc.createSimulatedContainer(name, config)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	// If image not found (404), attempt to pull image and retry create
	if resp.StatusCode == http.StatusNotFound && strings.Contains(string(respBody), "No such image") {
		candidates := []string{config.Image}
		if idx := strings.Index(config.Image, "/"); idx != -1 && strings.Contains(config.Image[:idx], "localhost") {
			candidates = append(candidates, config.Image[idx+1:])
		}

		for _, candidate := range candidates {
			_ = dc.pullImage(ctx, candidate)
			if candidate != config.Image {
				_ = dc.TagImage(ctx, candidate, config.Image, "")
			}
			reqRetry, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
			if err == nil {
				reqRetry.Header.Set("Content-Type", "application/json")
				respRetry, err := dc.httpClient.Do(reqRetry)
				if err == nil {
					defer respRetry.Body.Close()
					respBody, _ = io.ReadAll(respRetry.Body)
					resp = respRetry
					if resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusOK {
						break
					}
				}
			}
		}
	}

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("create container failed (%d): %s", resp.StatusCode, string(respBody))
	}

	var createResp DockerCreateContainerResponse
	if err := json.Unmarshal(respBody, &createResp); err != nil {
		return "", fmt.Errorf("failed to decode create container response: %w", err)
	}

	return createResp.ID, nil
}

// StartContainer starts a container by ID.
func (dc *DockerClient) StartContainer(ctx context.Context, containerID string) error {
	if dc.IsSimulated() {
		return dc.startSimulatedContainer(containerID)
	}

	startURL := fmt.Sprintf("http://localhost/containers/%s/start", url.PathEscape(containerID))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, startURL, nil)
	if err != nil {
		return err
	}

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return dc.startSimulatedContainer(containerID)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotModified {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("start container failed (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// StopContainer stops a container by ID with a timeout.
func (dc *DockerClient) StopContainer(ctx context.Context, containerID string, timeoutSec int) error {
	if dc.IsSimulated() {
		return dc.stopSimulatedContainer(containerID)
	}

	if timeoutSec <= 0 {
		timeoutSec = 5
	}
	stopURL := fmt.Sprintf("http://localhost/containers/%s/stop?t=%d", url.PathEscape(containerID), timeoutSec)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, stopURL, nil)
	if err != nil {
		return err
	}

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return dc.stopSimulatedContainer(containerID)
	}
	defer resp.Body.Close()

	// 204 No Content or 304 Not Modified or 404 (already stopped/gone) are considered success
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotModified && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("stop container failed (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// RemoveContainer removes a container by ID.
func (dc *DockerClient) RemoveContainer(ctx context.Context, containerID string, force bool) error {
	if dc.IsSimulated() {
		return dc.removeSimulatedContainer(containerID)
	}

	removeURL := fmt.Sprintf("http://localhost/containers/%s?force=%t&v=true", url.PathEscape(containerID), force)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, removeURL, nil)
	if err != nil {
		return err
	}

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return dc.removeSimulatedContainer(containerID)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("remove container failed (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetContainerLogs returns logs for a container with optional tail.
func (dc *DockerClient) GetContainerLogs(ctx context.Context, containerID string, tail string) (string, error) {
	if dc.IsSimulated() {
		return dc.getSimulatedContainerLogs(containerID, tail)
	}

	if tail == "" {
		tail = "100"
	}
	logsURL := fmt.Sprintf("http://localhost/containers/%s/logs?stdout=true&stderr=true&tail=%s&timestamps=true", url.PathEscape(containerID), url.QueryEscape(tail))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, logsURL, nil)
	if err != nil {
		return "", err
	}

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return dc.getSimulatedContainerLogs(containerID, tail)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusNotFound {
			return dc.getSimulatedContainerLogs(containerID, tail)
		}
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("get logs failed (%d): %s", resp.StatusCode, string(body))
	}

	rawLogs, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return demuxDockerLogs(rawLogs), nil
}

// InspectContainer returns detailed container inspection.
func (dc *DockerClient) InspectContainer(ctx context.Context, containerID string) (*DockerContainerInspect, error) {
	if dc.IsSimulated() {
		return dc.inspectSimulatedContainer(containerID)
	}

	inspectURL := fmt.Sprintf("http://localhost/containers/%s/json", url.PathEscape(containerID))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, inspectURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return dc.inspectSimulatedContainer(containerID)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusNotFound {
			return dc.inspectSimulatedContainer(containerID)
		}
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("inspect container failed (%d): %s", resp.StatusCode, string(body))
	}

	var inspect DockerContainerInspect
	if err := json.NewDecoder(resp.Body).Decode(&inspect); err != nil {
		return nil, fmt.Errorf("failed to decode inspect response: %w", err)
	}

	return &inspect, nil
}

// demuxDockerLogs decodes Docker's multiplexed stream headers (8-byte prefix per frame).
func demuxDockerLogs(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}

	var out strings.Builder
	buf := raw

	for len(buf) >= 8 {
		streamType := buf[0]
		// Stream type: 1 = stdout, 2 = stderr, 0 = stdin.
		// Bytes 1-3 must be 0 for standard docker demux header.
		if streamType > 2 || buf[1] != 0 || buf[2] != 0 || buf[3] != 0 {
			// Plain text or unmultiplexed output (e.g. TTY=true)
			return string(raw)
		}

		length := binary.BigEndian.Uint32(buf[4:8])
		buf = buf[8:]
		if int(length) > len(buf) {
			out.Write(buf)
			break
		}
		out.Write(buf[:length])
		buf = buf[length:]
	}

	if out.Len() == 0 && len(raw) > 0 {
		return string(raw)
	}
	return out.String()
}

// -------------------------------------------------------------------------
// Simulated Runner Implementation
// -------------------------------------------------------------------------

func generateSimulatedID() string {
	bytes := make([]byte, 6)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("sim-%d", time.Now().UnixNano()%1000000)
	}
	return "sim-" + hex.EncodeToString(bytes)
}

func (dc *DockerClient) createSimulatedContainer(name string, config ContainerCreateConfig) (string, error) {
	dc.mu.Lock()
	defer dc.mu.Unlock()

	id := generateSimulatedID()
	now := time.Now()

	// Assign simulated host ports
	hostPortMappings := make([]HostPortMapping, 0, len(config.PortMappings))
	basePort := 8080 + (len(dc.simStore) * 10)
	for i, pm := range config.PortMappings {
		protocol := pm.Protocol
		if protocol == "" {
			protocol = "tcp"
		}
		hostPort := basePort + i
		hostPortMappings = append(hostPortMappings, HostPortMapping{
			ContainerPort: pm.ContainerPort,
			HostPort:      hostPort,
			Protocol:      protocol,
			HostIP:        "0.0.0.0",
		})
	}

	timestamp := now.UTC().Format(time.RFC3339Nano)
	initialLogs := []string{
		fmt.Sprintf("%s [ministack-ecs] Container %s created (image: %s)", timestamp, id, config.Image),
		fmt.Sprintf("%s [ministack-ecs] Environment variables initialized (%d vars)", timestamp, len(config.Env)),
	}

	container := &SimulatedContainer{
		ID:           id,
		Name:         name,
		Image:        config.Image,
		Env:          config.Env,
		Labels:       config.Labels,
		PortMappings: hostPortMappings,
		CreatedAt:    now,
		State: DockerContainerState{
			Status:    "created",
			Running:   false,
			StartedAt: "",
		},
		Logs: initialLogs,
	}

	dc.simStore[id] = container
	return id, nil
}

func (dc *DockerClient) startSimulatedContainer(containerID string) error {
	dc.mu.Lock()
	defer dc.mu.Unlock()

	c, exists := dc.simStore[containerID]
	if !exists {
		return errors.New("simulated container not found")
	}

	now := time.Now()
	nowFormatted := now.UTC().Format(time.RFC3339Nano)

	c.StartedAt = now
	c.State.Status = "running"
	c.State.Running = true
	c.State.StartedAt = nowFormatted

	c.Logs = append(c.Logs,
		fmt.Sprintf("%s [ministack-ecs] Container started successfully", nowFormatted),
		fmt.Sprintf("%s [app] Server initialized, ready for connections", nowFormatted),
	)

	for _, pm := range c.PortMappings {
		c.Logs = append(c.Logs,
			fmt.Sprintf("%s [app] Listening on %s:%d -> container port %d", nowFormatted, pm.HostIP, pm.HostPort, pm.ContainerPort),
		)
	}

	return nil
}

func (dc *DockerClient) stopSimulatedContainer(containerID string) error {
	dc.mu.Lock()
	defer dc.mu.Unlock()

	c, exists := dc.simStore[containerID]
	if !exists {
		return nil
	}

	now := time.Now()
	nowFormatted := now.UTC().Format(time.RFC3339Nano)

	c.StoppedAt = &now
	c.State.Status = "exited"
	c.State.Running = false
	c.State.ExitCode = 0
	c.State.FinishedAt = nowFormatted

	c.Logs = append(c.Logs,
		fmt.Sprintf("%s [ministack-ecs] Received SIGTERM signal, shutting down...", nowFormatted),
		fmt.Sprintf("%s [ministack-ecs] Container stopped cleanly (exit code 0)", nowFormatted),
	)

	return nil
}

func (dc *DockerClient) removeSimulatedContainer(containerID string) error {
	dc.mu.Lock()
	defer dc.mu.Unlock()

	delete(dc.simStore, containerID)
	return nil
}

func (dc *DockerClient) getSimulatedContainerLogs(containerID string, tail string) (string, error) {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	c, exists := dc.simStore[containerID]
	if !exists {
		return fmt.Sprintf("%s [ministack-ecs] Container %s: Task finished or simulated logs unavailable\n", time.Now().UTC().Format(time.RFC3339), containerID), nil
	}

	return strings.Join(c.Logs, "\n") + "\n", nil
}

func (dc *DockerClient) inspectSimulatedContainer(containerID string) (*DockerContainerInspect, error) {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	c, exists := dc.simStore[containerID]
	if !exists {
		return nil, fmt.Errorf("container %s not found", containerID)
	}

	ports := make(map[string][]DockerPortBinding)
	for _, pm := range c.PortMappings {
		portKey := fmt.Sprintf("%d/%s", pm.ContainerPort, pm.Protocol)
		ports[portKey] = []DockerPortBinding{
			{
				HostIP:   pm.HostIP,
				HostPort: fmt.Sprintf("%d", pm.HostPort),
			},
		}
	}

	inspect := &DockerContainerInspect{
		ID:      c.ID,
		Created: c.CreatedAt.UTC().Format(time.RFC3339Nano),
		Name:    "/" + c.Name,
		Image:   c.Image,
		State:   c.State,
		NetworkSettings: DockerNetworkSettings{
			IPAddress: "127.0.0.1",
			Ports:     ports,
		},
	}
	inspect.Config.Image = c.Image
	inspect.Config.Env = c.Env
	inspect.Config.Labels = c.Labels

	return inspect, nil
}
