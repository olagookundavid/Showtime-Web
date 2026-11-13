package dto

import (
	"encoding/json"
	"time"
)

// AuditLogResponse is one row of the audit trail. UserID is nil for events the platform
// raised itself (contract expiry...), and for anonymous requests.
type AuditLogResponse struct {
	ID         string          `json:"id"`
	UserID     *string         `json:"user_id"`
	UserName   *string         `json:"user_name"`
	UserEmail  *string         `json:"user_email"`
	UserRole   *string         `json:"user_role"`
	Action     string          `json:"action"`
	EntityType string          `json:"entity_type"`
	EntityID   *string         `json:"entity_id"`
	Details    json.RawMessage `json:"details,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}
