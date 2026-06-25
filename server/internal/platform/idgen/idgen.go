package idgen

import "github.com/google/uuid"

// New returns a canonical UUIDv7 string — time-ordered so primary keys sort by
// creation order (same generator the console backend uses).
func New() (string, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	return id.String(), nil
}
