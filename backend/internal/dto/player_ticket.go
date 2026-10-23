package dto

// PlayerTicketHolderResponse is who a player ticket admits, as the gate shows it.
type PlayerTicketHolderResponse struct {
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
	PlayerID     string `json:"player_id"`
	Name         string `json:"name"`
	JerseyNumber int    `json:"jersey_number"`
	Position     string `json:"position"`
	IsStarter    bool   `json:"is_starter"`
	// HasEmail says whether the ticket could be emailed to them. The address itself
	// is not sent: the sheet is printed and handed round.
	HasEmail bool `json:"has_email"`
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
	// Players is left out of list views.
	Players   []PlayerTicketRow `json:"players,omitempty"`
	Named     int               `json:"named"`      // players on the sheet
	Issued    int               `json:"issued"`     // of them, with a live ticket
	CheckedIn int               `json:"checked_in"` // of them, through the gate
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
