package user

import (
	"fmt"
	"time"

	"cartografo-backend/internal/platform/idgen"

	"gorm.io/gorm"
)

// User is the single identity record. Email is the login identifier and is
// globally unique (stored lowercased by the auth service).
type User struct {
	ID        string         `gorm:"primaryKey;type:uuid" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Name         string `gorm:"size:255" json:"name"`
	Email        string `gorm:"size:255;uniqueIndex;not null" json:"email"`
	PasswordHash string `gorm:"size:255;not null" json:"-"`
}

func (u *User) BeforeCreate(_ *gorm.DB) error {
	if u.ID == "" {
		id, err := idgen.New()
		if err != nil {
			return fmt.Errorf("generating user id: %w", err)
		}
		u.ID = id
	}
	return nil
}
