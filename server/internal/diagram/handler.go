package diagram

import (
	"encoding/json"
	"net/http"

	"cartografo-backend/internal/auth"
	httputil "cartografo-backend/internal/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) userID(w http.ResponseWriter, r *http.Request) (string, bool) {
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok || claims.UserID == "" {
		httputil.JSONError(w, "unauthorized", http.StatusUnauthorized)
		return "", false
	}
	return claims.UserID, true
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.userID(w, r)
	if !ok {
		return
	}
	rows, err := h.service.List(uid)
	if err != nil {
		httputil.JSONError(w, "no se pudieron leer los diagramas", http.StatusInternalServerError)
		return
	}
	if rows == nil {
		rows = []Diagram{}
	}
	httputil.JSONResponse(w, rows, http.StatusOK)
}

func (h *Handler) Upsert(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.userID(w, r)
	if !ok {
		return
	}
	docID := chi.URLParam(r, "docID")
	var in UpsertInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.JSONError(w, "request inválido", http.StatusBadRequest)
		return
	}
	d, err := h.service.Upsert(uid, docID, in)
	if err != nil {
		httputil.JSONError(w, "no se pudo guardar: "+err.Error(), http.StatusBadRequest)
		return
	}
	httputil.JSONResponse(w, d, http.StatusOK)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.userID(w, r)
	if !ok {
		return
	}
	docID := chi.URLParam(r, "docID")
	if err := h.service.Delete(uid, docID); err != nil {
		httputil.JSONError(w, "no se pudo eliminar", http.StatusInternalServerError)
		return
	}
	httputil.JSONResponse(w, map[string]string{"message": "diagrama eliminado"}, http.StatusOK)
}

// Routes mounts the diagram endpoints; the caller wraps them with JWTMiddleware.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/", h.List)
	r.Put("/{docID}", h.Upsert)
	r.Delete("/{docID}", h.Delete)
}
