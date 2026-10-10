package api

import (
	"encoding/json"
	"net/http"

	"github.com/ministack/backend/internal/client"
	"github.com/ministack/backend/internal/ecs"
	"github.com/ministack/backend/internal/messaging"
)

type Handler struct {
	client    client.MinistackClient
	messaging *messaging.Service
	ecs       *ecs.Store
}

func NewHandler(c client.MinistackClient, m *messaging.Service, e *ecs.Store) *Handler {
	return &Handler{
		client:    c,
		messaging: m,
		ecs:       e,
	}
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
