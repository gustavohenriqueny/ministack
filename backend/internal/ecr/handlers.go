package ecr

import (
	"github.com/go-chi/chi/v5"
	"github.com/ministack/backend/internal/ecs"
)

type Module struct {
	Storage           *Storage
	RegistryHandler   *RegistryHandler
	ManagementHandler *ManagementHandler
}

func NewModule(baseDir string, port string, docker ...ecs.DockerRunner) (*Module, error) {
	storage := NewStorage(baseDir)
	if err := storage.InitStorage(); err != nil {
		return nil, err
	}

	var dr ecs.DockerRunner
	if len(docker) > 0 {
		dr = docker[0]
	}

	return &Module{
		Storage:           storage,
		RegistryHandler:   NewRegistryHandler(storage),
		ManagementHandler: NewManagementHandler(storage, port, dr),
	}, nil
}

func (m *Module) RegisterManagementRoutes(r chi.Router) {
	// ECR Console Management REST routes
	r.Get("/ecr/repositories", m.ManagementHandler.ListRepositories)
	r.Post("/ecr/repositories", m.ManagementHandler.CreateRepository)
	r.Delete("/ecr/repositories/{name}", m.ManagementHandler.DeleteRepository)
	r.Get("/ecr/repositories/{name}/images", m.ManagementHandler.ListImages)
	r.Delete("/ecr/repositories/{name}/images/{digest}", m.ManagementHandler.DeleteImage)
	r.Post("/ecr/repositories/{name}/pull", m.ManagementHandler.PullImage)
	r.Post("/docker/pull", m.ManagementHandler.PullImage)
}

func (m *Module) RegisterRegistryRoutes(r chi.Router) {
	// Docker Registry V2 handshakes and requests
	r.Get("/v2/", m.RegistryHandler.Handshake)
	r.HandleFunc("/v2/*", m.RegistryHandler.HandleRegistry)
}
