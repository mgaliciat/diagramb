package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	if os.Getenv("APP_ENV") == "production" {
		slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	} else {
		slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))
	}

	c, err := BuildContainer()
	if err != nil {
		slog.Error("failed to initialize application", "err", err)
		os.Exit(1)
	}

	srv := &http.Server{
		Addr:              ":" + c.Config.Port,
		Handler:           c.Router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("cartografo backend starting", "port", c.Config.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server stopped", "err", err)
			os.Exit(1)
		}
	}()

	// Drain in-flight requests on SIGINT/SIGTERM so deploys don't cut connections.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	slog.Info("shutdown signal received, draining connections")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "err", err)
	}
	slog.Info("server stopped cleanly")
}
