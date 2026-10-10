package api

import (
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/ministack/backend/internal/ecr"
	"net/http"
	"os"
	"path/filepath"
)

func NewRouter(h *Handler, ecrModule *ecr.Module) *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(CorsMiddleware)

	// Health check at root
	r.Get("/healthz", h.Health)

	// Route /v2/ at the root level to support direct docker push/pull
	if ecrModule != nil {
		ecrModule.RegisterRegistryRoutes(r)
	}

	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/healthz", h.Health)

		// ECR Module Routes (Docker Registry V2 + ECR REST API)
		if ecrModule != nil {
			// Mount Docker Registry routes on a subpath to avoid conflicts
			r.Route("/ecr-registry", func(r chi.Router) {
				ecrModule.RegisterRegistryRoutes(r)
			})
			ecrModule.RegisterManagementRoutes(r)
		}

		// Messaging - SQS
		r.Get("/queues", h.ListQueues)
		r.Post("/queues", h.CreateQueue)
		r.Delete("/queues/{queueUrl}", h.DeleteQueue)
		r.Post("/queues/{queueUrl}/purge", h.PurgeQueue)
		r.Post("/queues/messages", h.SendMessage)
		r.Post("/queues/redrive", h.Redrive)

		// Messaging - SNS
		r.Get("/topics", h.ListTopics)
		r.Post("/topics", h.CreateTopic)
		r.Delete("/topics/{topicArn}", h.DeleteTopic)
		r.Post("/topics/{topicArn}/subscriptions", h.Subscribe)
		r.Post("/topics/{topicArn}/publish", h.Publish)

		// ECS Clusters
		r.Get("/ecs/clusters", h.ListClusters)
		r.Post("/ecs/clusters", h.CreateCluster)
		r.Delete("/ecs/clusters/{name}", h.DeleteCluster)

		// ECS Services
		r.Get("/ecs/clusters/{cluster}/services", h.ListServices)
		r.Post("/ecs/clusters/{cluster}/services", h.CreateService)
		r.Put("/ecs/clusters/{cluster}/services/{service}", h.UpdateService)
		r.Delete("/ecs/clusters/{cluster}/services/{service}", h.DeleteService)
		r.Post("/ecs/clusters/{cluster}/services/{service}/deployments", h.ForceNewDeployment)

		// ECS Tasks
		r.Get("/ecs/clusters/{cluster}/tasks", h.ListTasks)
		r.Post("/ecs/clusters/{cluster}/tasks/run", h.RunTask)
		r.Post("/ecs/tasks/{taskArn}/stop", h.StopTask)
		r.Get("/ecs/tasks/{taskArn}/logs", h.GetTaskLogs)
		r.Get("/ecs/tasks/{taskArn}/inspect", h.InspectTask)

		// ECS Task Definitions
		r.Get("/ecs/task-definitions", h.ListTaskDefinitions)
		r.Post("/ecs/task-definitions", h.RegisterTaskDefinition)
		r.Delete("/ecs/task-definitions/{family}/{revision}", h.DeregisterTaskDefinition)

		// Docker Daemon Host Images
		r.Get("/docker/images", h.ListDockerImages)
	})

	// Serve the frontend application
	staticDir := "public"
	absStaticDir, err := filepath.Abs(staticDir)
	if err != nil {
		panic(err)
	}

	fs := http.FileServer(http.Dir(absStaticDir))

	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		// If the file doesn't exist, serve index.html for SPA routing
		if _, err := os.Stat(filepath.Join(absStaticDir, r.URL.Path)); os.IsNotExist(err) {
			http.ServeFile(w, r, filepath.Join(absStaticDir, "index.html"))
			return
		}
		fs.ServeHTTP(w, r)
	})

	return r
}
