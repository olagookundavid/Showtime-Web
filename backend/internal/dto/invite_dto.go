package dto

import "time"

type InviteRequest struct {
	Email     string   `json:"email"`
	Roles     []string `json:"roles"`
	InviterId string
}

type EmailRequest struct {
	Email string `json:"email"`
}

type InvitationResponse struct {
	Email     string    `json:"email"`
	ExpiresAt time.Time `json:"expires_at"`
	Status    string    `json:"status"` // "sent", "accepted", "expired"
}
