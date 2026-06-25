package diagram

import (
	"fmt"
	"time"

	"cartografo-backend/internal/platform/idgen"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Diagram is one synced document owned by a user. DocID is the client-generated
// id from the browser's local store (uid()); the server PK is a separate UUID
// so client ids never need to be globally unique. (UserID, DocID) is unique —
// one cloud row per local document per user.
//
// ClientUpdatedAt is the browser's wall clock (ms since epoch) at the moment of
// the edit. The client uses it for last-write-wins when merging cloud and local
// copies, so it is stored verbatim rather than derived from UpdatedAt.
type Diagram struct {
	ID        string    `gorm:"primaryKey;type:uuid" json:"-"`
	CreatedAt time.Time `json:"-"`
	UpdatedAt time.Time `json:"-"`

	UserID string `gorm:"type:uuid;not null;uniqueIndex:idx_user_doc" json:"-"`
	DocID  string `gorm:"size:64;not null;uniqueIndex:idx_user_doc" json:"id"`

	Name            string         `gorm:"size:255" json:"name"`
	Payload         datatypes.JSON `gorm:"type:jsonb" json:"payload"`
	ClientUpdatedAt int64          `gorm:"not null;default:0" json:"client_updated_at"`
}

func (d *Diagram) BeforeCreate(_ *gorm.DB) error {
	if d.ID == "" {
		id, err := idgen.New()
		if err != nil {
			return fmt.Errorf("generating diagram id: %w", err)
		}
		d.ID = id
	}
	return nil
}
