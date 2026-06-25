package diagram

import (
	"errors"

	"gorm.io/gorm"
)

type Repository interface {
	ListByUser(userID string) ([]Diagram, error)
	Find(userID, docID string) (*Diagram, error)
	Save(d *Diagram) error
	Delete(userID, docID string) error
}

type gormRepository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &gormRepository{db: db}
}

func (r *gormRepository) ListByUser(userID string) ([]Diagram, error) {
	var rows []Diagram
	err := r.db.Where("user_id = ?", userID).
		Order("client_updated_at desc").
		Find(&rows).Error
	return rows, err
}

func (r *gormRepository) Find(userID, docID string) (*Diagram, error) {
	var d Diagram
	err := r.db.Where("user_id = ? AND doc_id = ?", userID, docID).First(&d).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *gormRepository) Save(d *Diagram) error {
	return r.db.Save(d).Error
}

// Delete removes the row outright (hard delete): the client is the source of
// truth for its documents, and a soft-deleted row would collide with the
// (user_id, doc_id) unique index if the same document is recreated.
func (r *gormRepository) Delete(userID, docID string) error {
	return r.db.Where("user_id = ? AND doc_id = ?", userID, docID).
		Delete(&Diagram{}).Error
}
