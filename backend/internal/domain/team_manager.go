package domain

import "time"

type TeamManager struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	TeamID    string    `json:"team_id"`
	CreatedAt time.Time `json:"created_at"`
	// Hydrated via a join with users — populated by GetManagersByTeamID so the
	// admin UI can show a name instead of a raw user ID.
	UserFullName string `json:"user_full_name,omitempty"`
	UserEmail    string `json:"user_email,omitempty"`
}

// TeamHeadCandidate is a team_head-role user considered for the "Assign Team
// Head" dropdown, together with whichever team they currently manage (if
// any) — a team_head can only manage one team (DB UNIQUE(user_id)), so the
// admin UI needs this to explain why a name is greyed out instead of just
// hiding it, which would look like a bug to a non-technical user.
type TeamHeadCandidate struct {
	UserID           string  `json:"user_id"`
	FullName         string  `json:"full_name"`
	Email            string  `json:"email"`
	AssignedTeamID   *string `json:"assigned_team_id,omitempty"`
	AssignedTeamName *string `json:"assigned_team_name,omitempty"`
}
