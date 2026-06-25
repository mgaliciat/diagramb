package auth

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	httputil "cartografo-backend/internal/http"

	"golang.org/x/time/rate"
)

type contextKey string

const claimsKey contextKey = "claims"

// JWTMiddleware validates the Bearer token and injects Claims into the context.
// Diagramb is served same-origin behind nginx, so the token travels in the
// Authorization header — there is no separate gateway to trust.
func JWTMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				httputil.JSONError(w, "missing or invalid authorization header", http.StatusUnauthorized)
				return
			}
			token := strings.TrimPrefix(header, "Bearer ")
			claims, err := ParseToken(token, secret)
			if err != nil {
				httputil.JSONError(w, "invalid or expired token", http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ClaimsFromContext retrieves JWT claims from the request context.
func ClaimsFromContext(ctx context.Context) (*Claims, bool) {
	c, ok := ctx.Value(claimsKey).(*Claims)
	return c, ok
}

// ── Per-IP rate limiting for the auth endpoints ──────────────────────────────
// Allows 5 requests/minute with a burst of 5, mirroring the console backend.

var ipLimiter = &struct {
	mu      sync.Mutex
	clients map[string]*rateLimiterEntry
}{
	clients: make(map[string]*rateLimiterEntry),
}

type rateLimiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func getLimiter(ip string) *rate.Limiter {
	ipLimiter.mu.Lock()
	defer ipLimiter.mu.Unlock()

	entry, exists := ipLimiter.clients[ip]
	if !exists {
		limiter := rate.NewLimiter(rate.Every(time.Minute/5), 5)
		ipLimiter.clients[ip] = &rateLimiterEntry{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}
	entry.lastSeen = time.Now()
	return entry.limiter
}

// RateLimitMiddleware limits requests to 5 per minute per IP.
func RateLimitMiddleware(next http.Handler) http.Handler {
	go func() {
		for range time.Tick(5 * time.Minute) {
			ipLimiter.mu.Lock()
			for ip, entry := range ipLimiter.clients {
				if time.Since(entry.lastSeen) > 10*time.Minute {
					delete(ipLimiter.clients, ip)
				}
			}
			ipLimiter.mu.Unlock()
		}
	}()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			ip = strings.Split(xff, ",")[0]
		}
		if !getLimiter(strings.TrimSpace(ip)).Allow() {
			httputil.JSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}
