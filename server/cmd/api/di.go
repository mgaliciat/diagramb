package main

import (
	"net/http"

	"cartografo-backend/internal/auth"
	"cartografo-backend/internal/config"
	"cartografo-backend/internal/diagram"
	"cartografo-backend/internal/platform/postgres"
	"cartografo-backend/internal/server"
	"cartografo-backend/internal/user"

	"gorm.io/gorm"
)

// Container holds the wired application dependencies.
type Container struct {
	Config config.Config
	Router http.Handler
}

func BuildContainer() (*Container, error) {
	cfg := config.Load()

	db, err := postgres.Connect(cfg.Database)
	if err != nil {
		return nil, err
	}

	if err := runMigrations(db); err != nil {
		return nil, err
	}

	// Repositories
	userRepo := user.NewRepository(db)
	diagramRepo := diagram.NewRepository(db)

	// Services
	authSvc := auth.NewService(userRepo, cfg.JWT)
	diagramSvc := diagram.NewService(diagramRepo)

	router := server.NewRouter(server.Handlers{
		Auth:      auth.NewHandler(authSvc, cfg.DisableRegistration),
		Diagram:   diagram.NewHandler(diagramSvc),
		JWTSecret: cfg.JWT.Secret,
	})

	return &Container{Config: cfg, Router: router}, nil
}

// runMigrations creates/updates the schema. Diagramb uses GORM AutoMigrate —
// the same approach as the console backend — so the schema is declared by the
// model structs and reconciled on every boot.
func runMigrations(db *gorm.DB) error {
	return db.AutoMigrate(
		&user.User{},
		&diagram.Diagram{},
	)
}
