package api

import (
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"
	"github.com/ministack/backend/internal/messaging"
)

func (h *Handler) ListQueues(w http.ResponseWriter, r *http.Request) {
	queues, err := h.messaging.ListQueues(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, queues)
}

func (h *Handler) CreateQueue(w http.ResponseWriter, r *http.Request) {
	var req messaging.CreateQueueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	queue, err := h.messaging.CreateQueue(r.Context(), req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, queue)
}

func (h *Handler) DeleteQueue(w http.ResponseWriter, r *http.Request) {
	queueUrlRaw := chi.URLParam(r, "queueUrl")
	queueUrl, err := url.PathUnescape(queueUrlRaw)
	if err != nil {
		queueUrl = queueUrlRaw
	}

	if err := h.messaging.DeleteQueue(r.Context(), queueUrl); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"status": "deleted"})
}

func (h *Handler) PurgeQueue(w http.ResponseWriter, r *http.Request) {
	queueUrlRaw := chi.URLParam(r, "queueUrl")
	queueUrl, err := url.PathUnescape(queueUrlRaw)
	if err != nil {
		queueUrl = queueUrlRaw
	}

	if err := h.messaging.PurgeQueue(r.Context(), queueUrl); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"status": "purged"})
}

func (h *Handler) ListTopics(w http.ResponseWriter, r *http.Request) {
	topics, err := h.messaging.ListTopics(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, topics)
}

func (h *Handler) CreateTopic(w http.ResponseWriter, r *http.Request) {
	var req messaging.CreateTopicRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	topic, err := h.messaging.CreateTopic(r.Context(), req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, topic)
}

func (h *Handler) DeleteTopic(w http.ResponseWriter, r *http.Request) {
	topicArnRaw := chi.URLParam(r, "topicArn")
	topicArn, err := url.PathUnescape(topicArnRaw)
	if err != nil {
		topicArn = topicArnRaw
	}

	if err := h.messaging.DeleteTopic(r.Context(), topicArn); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"status": "deleted"})
}

func (h *Handler) Subscribe(w http.ResponseWriter, r *http.Request) {
	topicArnRaw := chi.URLParam(r, "topicArn")
	topicArn, err := url.PathUnescape(topicArnRaw)
	if err != nil {
		topicArn = topicArnRaw
	}
	var req struct {
		QueueArn string `json:"queueArn"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sub, err := h.messaging.Subscribe(r.Context(), topicArn, req.QueueArn)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, sub)
}

func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	var req struct {
		QueueUrl string `json:"queueUrl"`
		Body     string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.messaging.SendMessage(r.Context(), req.QueueUrl, req.Body); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"status": "sent"})
}

func (h *Handler) Publish(w http.ResponseWriter, r *http.Request) {
	topicArnRaw := chi.URLParam(r, "topicArn")
	topicArn, err := url.PathUnescape(topicArnRaw)
	if err != nil {
		topicArn = topicArnRaw
	}

	var req struct {
		Body string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.messaging.Publish(r.Context(), topicArn, req.Body); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"status": "published"})
}

func (h *Handler) Redrive(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DLQUrl         string `json:"dlqUrl"`
		SourceQueueUrl string `json:"sourceQueueUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.messaging.RedriveMessages(r.Context(), req.DLQUrl, req.SourceQueueUrl); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"status": "redriven"})
}

func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
