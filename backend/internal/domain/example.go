package domain

import "time"

type ExampleStatus string

const (
	ExampleValid   ExampleStatus = "valid"
	ExampleUsed    ExampleStatus = "used"
	ExampleRevoked ExampleStatus = "revoked"
	ExampleExpired ExampleStatus = "expired"
)

type Example struct {
	ID        string        `json:"id"`
	Email     string        `json:"email"`
	Token     string        `json:"token"`
	InviterID string        `json:"inviter_id"`
	Roles     []string      `json:"roles"`
	ExpiresAt time.Time     `json:"expires_at"`
	CreatedAt time.Time     `json:"created_at"`
	UsedAt    *time.Time    `json:"used_at,omitempty"`
	Status    ExampleStatus `json:"status"`
}
