package dto

// PlayerTicketHolderResponse is who a player ticket admits, as the gate shows it.
type PlayerTicketHolderResponse struct {
	// Role is PLAYER (on the team sheet), MANAGER, or EXTRA (given a ticket by the
	// team manager). For the last two, Name is who the ticket was made out to.
	Role         string `json:"role"`
	PlayerID     string `json:"player_id"`
	Name         string `json:"name"`
	JerseyNumber int    `json:"jersey_number"`
	Position     string `json:"position"`
	Image        string `json:"image"`
	TeamID       string `json:"team_id"`
	TeamName     string `json:"team_name"`
	MatchID      string `json:"match_id"`
	HomeTeam     string `json:"home_team"`
	AwayTeam     string `json:"away_team"`
	Competition  string `json:"competition"`
	MatchDate    string `json:"match_date,omitempty"` // YYYY-MM-DD
	Kickoff      string `json:"kickoff,omitempty"`    // HH:MM
}

// PlayerTicketMatchResponse is the match a team sheet is for.
type PlayerTicketMatchResponse struct {
	ID          string `json:"id"`
	Date        string `json:"date"`              // YYYY-MM-DD
	Kickoff     string `json:"kickoff,omitempty"` // HH:MM
	Status      string `json:"status"`
	Venue       string `json:"venue"`
	Competition string `json:"competition"`
	HomeTeam    string `json:"home_team"`
	AwayTeam    string `json:"away_team"`
}

// PlayerTicketRow is one player on a team sheet and their ticket.
type PlayerTicketRow struct {
	// Role is whose slot this is: PLAYER (on the sheet), MANAGER, or EXTRA.
	Role string `json:"role"`
	// PlayerID is empty for a manager or an extra who is not on the team's roster.
	PlayerID string `json:"player_id,omitempty"`
	// UserID is set for a manager.
	UserID       string `json:"user_id,omitempty"`
	Name         string `json:"name"`
	JerseyNumber int    `json:"jersey_number"`
	Position     string `json:"position"`
	IsStarter    bool   `json:"is_starter"`
	// HasEmail says whether the ticket could be emailed to them. The address itself
	// is not sent: the sheet is printed and handed round.
	HasEmail bool `json:"has_email"`
	// Revoked is true when the ticket was taken back on purpose: the person has no
	// ticket, and saving the sheet again does not give them one.
	Revoked bool `json:"revoked,omitempty"`
	// The ticket, once issued. Empty when the sheet has not been turned into tickets
	// yet (a match already played, or an issue that failed).
	TicketID    string  `json:"ticket_id,omitempty"`
	TicketCode  string  `json:"ticket_code,omitempty"`
	Status      string  `json:"status,omitempty"`
	CheckedInAt *string `json:"checked_in_at,omitempty"`
}

// PlayerTicketSheetResponse is one team's sheet for one match, with every
// player's ticket code: what a team manager prints and hands to the gate.
type PlayerTicketSheetResponse struct {
	Match    PlayerTicketMatchResponse `json:"match"`
	TeamID   string                    `json:"team_id"`
	TeamName string                    `json:"team_name"`
	Opponent string                    `json:"opponent"`
	// Players are those on the sheet; Others are the team's managers and any extras
	// the manager gave a ticket. Both are left out of list views.
	Players []PlayerTicketRow `json:"players,omitempty"`
	Others  []PlayerTicketRow `json:"others,omitempty"`
	Named   int               `json:"named"`  // players on the sheet
	Issued  int               `json:"issued"` // of them, with a live ticket
	// Missing is everyone owed a ticket (players on the sheet and managers) who has
	// none and was not revoked on purpose.
	Missing   int `json:"missing"`
	CheckedIn int `json:"checked_in"` // everyone with a slot, through the gate
	// A team has SlotsTotal tickets for the match; SlotsUsed are live, SlotsLeft can
	// still be given to extras.
	SlotsTotal int `json:"slots_total"`
	SlotsUsed  int `json:"slots_used"`
	SlotsLeft  int `json:"slots_left"`
	// CanIssue is false once the match day has passed: no new tickets are made
	// for a match already played.
	CanIssue bool `json:"can_issue"`
}

// PlayerTicketDayResponse is a match day that has team sheets.
type PlayerTicketDayResponse struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Date  string `json:"date"`
	Venue string `json:"venue"`
}

// PlayerTicketDaySheetsResponse is every team sheet on one match day.
type PlayerTicketDaySheetsResponse struct {
	Day    PlayerTicketDayResponse     `json:"day"`
	Sheets []PlayerTicketSheetResponse `json:"sheets"`
}

// PlayerTicketSyncResponse is what issuing a sheet's tickets did.
type PlayerTicketSyncResponse struct {
	Issued    int `json:"issued"`
	Emailed   int `json:"emailed"`
	Cancelled int `json:"cancelled"`
}

// MyPlayerTicket is one of the signed-in player's own tickets: the code to show at
// the gate for a match they are named for.
type MyPlayerTicket struct {
	TicketID    string                    `json:"ticket_id"`
	TicketCode  string                    `json:"ticket_code"`
	Status      string                    `json:"status"`
	CheckedInAt *string                   `json:"checked_in_at,omitempty"`
	TeamName    string                    `json:"team_name"`
	Opponent    string                    `json:"opponent"`
	Match       PlayerTicketMatchResponse `json:"match"`
}

// AddExtraTicketRequest gives one of the team's slots to someone not on the sheet:
// a reserve from the roster (PlayerID), or anyone else by name.
type AddExtraTicketRequest struct {
	PlayerID string `json:"player_id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
}

// RestoreTicketRequest gives a revoked ticket back to a player on the sheet
// (PlayerID) or to a manager (UserID).
type RestoreTicketRequest struct {
	PlayerID string `json:"player_id"`
	UserID   string `json:"user_id"`
}
