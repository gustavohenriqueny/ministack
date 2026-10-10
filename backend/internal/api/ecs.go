package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"
	"github.com/ministack/backend/internal/ecs"
)

func (h *Handler) ListClusters(w http.ResponseWriter, r *http.Request) {
	jsonResponse(w, h.ecs.ListClusters())
}

func (h *Handler) CreateCluster(w http.ResponseWriter, r *http.Request) {
	var req ecs.CreateClusterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	cluster, err := h.ecs.CreateCluster(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusConflict) // 409 Conflict for duplicate
		return
	}

	w.WriteHeader(http.StatusCreated)
	jsonResponse(w, cluster)
}

func (h *Handler) DeleteCluster(w http.ResponseWriter, r *http.Request) {
	nameRaw := chi.URLParam(r, "name")
	name, err := url.PathUnescape(nameRaw)
	if err != nil {
		name = nameRaw
	}

	if err := h.ecs.DeleteCluster(name); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListServices(w http.ResponseWriter, r *http.Request) {
	clusterRaw := chi.URLParam(r, "cluster")
	cluster, err := url.PathUnescape(clusterRaw)
	if err != nil {
		cluster = clusterRaw
	}

	services, err := h.ecs.ListServices(cluster)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	jsonResponse(w, services)
}

func (h *Handler) CreateService(w http.ResponseWriter, r *http.Request) {
	clusterRaw := chi.URLParam(r, "cluster")
	cluster, err := url.PathUnescape(clusterRaw)
	if err != nil {
		cluster = clusterRaw
	}

	var req ecs.CreateServiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	service, err := h.ecs.CreateService(cluster, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	jsonResponse(w, service)
}

func (h *Handler) UpdateService(w http.ResponseWriter, r *http.Request) {
	clusterRaw := chi.URLParam(r, "cluster")
	cluster, err := url.PathUnescape(clusterRaw)
	if err != nil {
		cluster = clusterRaw
	}

	serviceRaw := chi.URLParam(r, "service")
	serviceName, err := url.PathUnescape(serviceRaw)
	if err != nil {
		serviceName = serviceRaw
	}

	var req ecs.UpdateServiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	updated, err := h.ecs.UpdateService(cluster, serviceName, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, updated)
}

func (h *Handler) DeleteService(w http.ResponseWriter, r *http.Request) {
	clusterRaw := chi.URLParam(r, "cluster")
	cluster, err := url.PathUnescape(clusterRaw)
	if err != nil {
		cluster = clusterRaw
	}

	serviceRaw := chi.URLParam(r, "service")
	serviceName, err := url.PathUnescape(serviceRaw)
	if err != nil {
		serviceName = serviceRaw
	}

	if err := h.ecs.DeleteService(cluster, serviceName); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ForceNewDeployment(w http.ResponseWriter, r *http.Request) {
	clusterRaw := chi.URLParam(r, "cluster")
	cluster, err := url.PathUnescape(clusterRaw)
	if err != nil {
		cluster = clusterRaw
	}

	serviceRaw := chi.URLParam(r, "service")
	serviceName, err := url.PathUnescape(serviceRaw)
	if err != nil {
		serviceName = serviceRaw
	}

	if err := h.ecs.ForceNewDeployment(cluster, serviceName); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]string{"status": "success"})
}

func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	clusterRaw := chi.URLParam(r, "cluster")
	cluster, err := url.PathUnescape(clusterRaw)
	if err != nil {
		cluster = clusterRaw
	}

	tasks, err := h.ecs.ListTasks(cluster)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	jsonResponse(w, tasks)
}

func (h *Handler) RunTask(w http.ResponseWriter, r *http.Request) {
	clusterRaw := chi.URLParam(r, "cluster")
	cluster, err := url.PathUnescape(clusterRaw)
	if err != nil {
		cluster = clusterRaw
	}

	var req ecs.RunTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	tasks, err := h.ecs.RunTask(cluster, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	jsonResponse(w, tasks)
}

func (h *Handler) StopTask(w http.ResponseWriter, r *http.Request) {
	taskArnRaw := chi.URLParam(r, "taskArn")
	taskArn, err := url.PathUnescape(taskArnRaw)
	if err != nil {
		taskArn = taskArnRaw
	}

	if err := h.ecs.StopTask(taskArn); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]string{"status": "stopped"})
}

func (h *Handler) GetTaskLogs(w http.ResponseWriter, r *http.Request) {
	taskArnRaw := chi.URLParam(r, "taskArn")
	taskArn, err := url.PathUnescape(taskArnRaw)
	if err != nil {
		taskArn = taskArnRaw
	}

	tail := r.URL.Query().Get("tail")
	if tail == "" {
		tail = "100"
	}

	logsResp, err := h.ecs.GetTaskLogs(taskArn, tail)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	jsonResponse(w, logsResp)
}

func (h *Handler) InspectTask(w http.ResponseWriter, r *http.Request) {
	taskArnRaw := chi.URLParam(r, "taskArn")
	taskArn, err := url.PathUnescape(taskArnRaw)
	if err != nil {
		taskArn = taskArnRaw
	}

	inspectResp, err := h.ecs.InspectTask(taskArn)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	jsonResponse(w, inspectResp)
}

func (h *Handler) ListTaskDefinitions(w http.ResponseWriter, r *http.Request) {
	jsonResponse(w, h.ecs.ListTaskDefinitions())
}

func (h *Handler) RegisterTaskDefinition(w http.ResponseWriter, r *http.Request) {
	var req ecs.RegisterTaskDefinitionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	td, err := h.ecs.RegisterTaskDefinition(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	jsonResponse(w, td)
}

func (h *Handler) DeregisterTaskDefinition(w http.ResponseWriter, r *http.Request) {
	familyRaw := chi.URLParam(r, "family")
	family, err := url.PathUnescape(familyRaw)
	if err != nil {
		family = familyRaw
	}

	revisionStr := chi.URLParam(r, "revision")
	var revision int
	if _, err := fmt.Sscanf(revisionStr, "%d", &revision); err != nil {
		http.Error(w, "invalid revision number", http.StatusBadRequest)
		return
	}

	if err := h.ecs.DeregisterTaskDefinition(family, revision); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListDockerImages(w http.ResponseWriter, r *http.Request) {
	images, err := h.ecs.ListDockerImages(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, images)
}
