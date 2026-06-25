package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	httputil "cartografo-backend/internal/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service             *Service
	disableRegistration bool
}

func NewHandler(service *Service, disableRegistration bool) *Handler {
	return &Handler{service: service, disableRegistration: disableRegistration}
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	if h.disableRegistration {
		httputil.JSONError(w, "registration is disabled", http.StatusForbidden)
		return
	}
	var in RegisterInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.JSONError(w, "request inválido", http.StatusBadRequest)
		return
	}
	res, err := h.service.Register(in)
	if err != nil {
		switch {
		case errors.Is(err, ErrEmailTaken):
			httputil.JSONError(w, "el correo ya está registrado", http.StatusConflict)
		case errors.Is(err, ErrInvalidInput):
			httputil.JSONError(w, "correo inválido o contraseña menor a 8 caracteres", http.StatusBadRequest)
		default:
			httputil.JSONError(w, "no se pudo crear la cuenta", http.StatusInternalServerError)
		}
		return
	}
	httputil.JSONResponse(w, res, http.StatusCreated)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var in LoginInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.JSONError(w, "request inválido", http.StatusBadRequest)
		return
	}
	res, err := h.service.Login(in)
	if err != nil {
		if errors.Is(err, ErrInvalidCreds) {
			httputil.JSONError(w, "correo o contraseña incorrectos", http.StatusUnauthorized)
			return
		}
		httputil.JSONError(w, "no se pudo iniciar sesión", http.StatusInternalServerError)
		return
	}
	httputil.JSONResponse(w, res, http.StatusOK)
}

// Me requires JWTMiddleware upstream.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		httputil.JSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	u, err := h.service.Me(claims.UserID)
	if err != nil {
		httputil.JSONError(w, "usuario no encontrado", http.StatusNotFound)
		return
	}
	httputil.JSONResponse(w, u, http.StatusOK)
}

// PublicRoutes are unauthenticated (register/login), rate-limited by the caller.
func (h *Handler) PublicRoutes(r chi.Router) {
	r.Post("/register", h.Register)
	r.Post("/login", h.Login)
}
