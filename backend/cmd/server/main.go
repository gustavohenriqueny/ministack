package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ministack/backend/internal/api"
	"github.com/ministack/backend/internal/client"
	"github.com/ministack/backend/internal/config"
	"github.com/ministack/backend/internal/ecr"
	"github.com/ministack/backend/internal/ecs"
	"github.com/ministack/backend/internal/messaging"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	msClient := client.New(cfg.MinistackURL)

	awsClient, err := client.NewAWSClient(context.Background(), cfg.MinistackURL)
	if err != nil {
		logger.Error("failed to initialize AWS client", "error", err)
		os.Exit(1)
	}

	dockerRunner := ecs.NewDockerClient("")

	ecrModule, err := ecr.NewModule("~/.ministack/ecr", cfg.Port, dockerRunner)
	if err != nil {
		logger.Error("failed to initialize ECR module", "error", err)
		os.Exit(1)
	}

	ecsStore := ecs.NewStore(dockerRunner)
	msgService := messaging.NewService(awsClient)
	handler := api.NewHandler(msClient, msgService, ecsStore)
	router := api.NewRouter(handler, ecrModule)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		logger.Info("starting server", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("listen failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("forced shutdown", "error", err)
	}

	logger.Info("server stopped")
}
