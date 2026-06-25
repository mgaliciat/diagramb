package auth

import "github.com/golang-jwt/jwt/v5"

// Claims is the JWT body. Diagramb has no organizations or roles — a logged-in
// subject is identified solely by UserID, which scopes every diagram they own.
type Claims struct {
	jwt.RegisteredClaims
	UserID string `json:"user_id"`
}
