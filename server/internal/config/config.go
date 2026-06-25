package config

import (
	"log/slog"
	"os"
	"time"
)

type Config struct {
	Port     string
	Database DatabaseConfig
	JWT      JWTConfig
	// DisableRegistration, when true (env DISABLE_REGISTRATION=true), closes
	// self-service signup: POST /auth/register returns 403. Login is unaffected.
	DisableRegistration bool
}

type JWTConfig struct {
	Secret string
	TTL    time.Duration
}

type DatabaseConfig struct {
	URL string
}

func Load() Config {
	isProd := os.Getenv("APP_ENV") == "production"

	if os.Getenv("JWT_SECRET") == "" {
		if isProd {
			slog.Error("JWT_SECRET must be set in production", "hint", "openssl rand -hex 32")
			os.Exit(1)
		}
		slog.Warn("JWT_SECRET not set — using insecure development default")
	}
	if os.Getenv("DATABASE_URL") == "" && isProd {
		slog.Error("DATABASE_URL must be set in production")
		os.Exit(1)
	}

	return Config{
		Port: envOrDefault("PORT", "8080"),
		Database: DatabaseConfig{
			URL: envOrDefault("DATABASE_URL", "host=localhost user=root password=rootpassword dbname=cartografo_db port=5432 sslmode=disable TimeZone=America/Mexico_City"),
		},
		JWT: JWTConfig{
			Secret: envOrDefault("JWT_SECRET", "dev-secret-change-me-in-production"),
			TTL:    parseDuration(envOrDefault("JWT_TTL", "720h")),
		},
		DisableRegistration: os.Getenv("DISABLE_REGISTRATION") == "true",
	}
}

func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return 720 * time.Hour
	}
	return d
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
