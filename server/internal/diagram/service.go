package diagram

import (
	"bytes"
	"encoding/json"
	"fmt"

	"gorm.io/datatypes"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// UpsertInput is the body of PUT /diagrams/{docID}.
type UpsertInput struct {
	Name            string          `json:"name"`
	Payload         json.RawMessage `json:"payload"`
	ClientUpdatedAt int64           `json:"client_updated_at"`
}

func (s *Service) List(userID string) ([]Diagram, error) {
	return s.repo.ListByUser(userID)
}

// Upsert creates or replaces the user's copy of docID. Last-write-wins: an
// incoming edit older than the stored one is ignored so a stale client cannot
// clobber a newer cloud version, and the current (newer) row is returned.
func (s *Service) Upsert(userID, docID string, in UpsertInput) (*Diagram, error) {
	if docID == "" {
		return nil, fmt.Errorf("doc id is required")
	}
	// The payload must be a JSON object (the document). Reject empty, null,
	// arrays and scalars — they are valid JSON but not a diagram.
	payload := bytes.TrimSpace(in.Payload)
	if len(payload) == 0 || payload[0] != '{' || !json.Valid(payload) {
		return nil, fmt.Errorf("payload must be a JSON object")
	}

	existing, err := s.repo.Find(userID, docID)
	if err != nil {
		return nil, err
	}
	if existing != nil && in.ClientUpdatedAt > 0 && in.ClientUpdatedAt < existing.ClientUpdatedAt {
		return existing, nil
	}

	d := &Diagram{}
	if existing != nil {
		d = existing
	}
	d.UserID = userID
	d.DocID = docID
	d.Name = in.Name
	d.Payload = datatypes.JSON(payload)
	d.ClientUpdatedAt = in.ClientUpdatedAt

	if err := s.repo.Save(d); err != nil {
		return nil, fmt.Errorf("saving diagram: %w", err)
	}
	return d, nil
}

func (s *Service) Delete(userID, docID string) error {
	return s.repo.Delete(userID, docID)
}
