package server

import (
	"net/http"
	"os"
	"strings"

	"cartografo-backend/internal/auth"
	"cartografo-backend/internal/diagram"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Handlers struct {
	Auth      *auth.Handler
	Diagram   *diagram.Handler
	JWTSecret string
}

// allowedOrigins returns the CORS origin list from ALLOWED_ORIGINS. Diagramb is
// normally served same-origin behind nginx (so CORS is irrelevant), but the
// list keeps direct dev access from a separate static server working.
func allowedOrigins() []string {
	if v := os.Getenv("ALLOWED_ORIGINS"); v != "" {
		origins := strings.Split(v, ",")
		for i, o := range origins {
			origins[i] = strings.TrimSpace(o)
		}
		return origins
	}
	return []string{"http://localhost", "http://localhost:8080", "http://localhost:5500"}
}

func NewRouter(h Handlers) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins(),
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	jwtMW := auth.JWTMiddleware(h.JWTSecret)

	r.Route("/api/v1", func(api chi.Router) {
		api.Route("/auth", func(a chi.Router) {
			// register/login are unauthenticated and rate-limited per IP to
			// blunt brute-force and signup abuse.
			a.Group(func(p chi.Router) {
				p.Use(auth.RateLimitMiddleware)
				h.Auth.PublicRoutes(p)
			})
			// /me only needs a valid token (it runs on every page load, so it
			// must not share the login rate limiter).
			a.Group(func(p chi.Router) {
				p.Use(jwtMW)
				p.Get("/me", h.Auth.Me)
			})
		})

		// Cloud-synced diagrams — every route requires a valid token.
		api.Route("/diagrams", func(d chi.Router) {
			d.Use(jwtMW)
			h.Diagram.Routes(d)
		})
	})

	return r
}
