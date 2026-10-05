package dto

import "time"

// SavePOTWPollRequest creates or updates the Player of the Week vote for an edition.
type SavePOTWPollRequest struct {
	NomineeIDs []string   `json:"nominee_ids" binding:"required"`
	OpensAt    *time.Time `json:"opens_at"` // omitted: voting opens now
	ClosesAt   time.Time  `json:"closes_at" binding:"required"`
}

type CastPOTWVoteRequest struct {
	PlayerID string `json:"player_id" binding:"required"`
}

type OverridePOTWRequest struct {
	PlayerID string `json:"player_id" binding:"required"`
}

type POTWNomineeResponse struct {
	PlayerID     string `json:"player_id"`
	Name         string `json:"name"`
	Image        string `json:"image,omitempty"`
	JerseyNumber int    `json:"jersey_number"`
	Position     string `json:"position"`
	TeamName     string `json:"team_name,omitempty"`
	TeamLogo     string `json:"team_logo,omitempty"`
	DisplayOrder int    `json:"display_order"`

	TOTWPosition string  `json:"totw_position,omitempty"`
	Rating       float64 `json:"rating"`
	Stat1Value   string  `json:"stat1_value,omitempty"`
	Stat1Label   string  `json:"stat1_label,omitempty"`
	Stat2Value   string  `json:"stat2_value,omitempty"`
	Stat2Label   string  `json:"stat2_label,omitempty"`
	Stat3Value   string  `json:"stat3_value,omitempty"`
	Stat3Label   string  `json:"stat3_label,omitempty"`

	// Only present when results are visible (after the deadline, or to admins).
	Votes    *int     `json:"votes,omitempty"`
	Percent  *float64 `json:"percent,omitempty"`
	IsWinner bool     `json:"is_winner"`
}

type POTWDayCountResponse struct {
	Day   time.Time `json:"day"`
	Votes int       `json:"votes"`
}

type POTWPollResponse struct {
	ID              string     `json:"id"`
	TOTWID          string     `json:"totw_id"`
	WeekTitle       string     `json:"week_title"`
	Headline        string     `json:"headline"`
	CompetitionID   string     `json:"competition_id"`
	CompetitionName string     `json:"competition_name,omitempty"`
	TOTWPublished   bool       `json:"totw_published"`
	Status          string     `json:"status"` // scheduled | open | closed
	OpensAt         time.Time  `json:"opens_at"`
	ClosesAt        time.Time  `json:"closes_at"`
	ServerTime      time.Time  `json:"server_time"` // lets the countdown ignore a wrong device clock
	FinalizedAt     *time.Time `json:"finalized_at,omitempty"`
	WinnerPlayerID  *string    `json:"winner_player_id,omitempty"`
	WinnerSource    *string    `json:"winner_source,omitempty"` // VOTE | ADMIN
	TotalVotes      int        `json:"total_votes"`
	ResultsVisible  bool       `json:"results_visible"`
	MyVote          *string    `json:"my_vote,omitempty"`

	Nominees   []POTWNomineeResponse  `json:"nominees"`
	VotesByDay []POTWDayCountResponse `json:"votes_by_day,omitempty"`
}

// POTWPollSummary is one row of the public archive.
type POTWPollSummary struct {
	ID              string    `json:"id"`
	TOTWID          string    `json:"totw_id"`
	WeekTitle       string    `json:"week_title"`
	CompetitionName string    `json:"competition_name,omitempty"`
	Status          string    `json:"status"`
	OpensAt         time.Time `json:"opens_at"`
	ClosesAt        time.Time `json:"closes_at"`
	TotalVotes      int       `json:"total_votes"`
	WinnerPlayerID  *string   `json:"winner_player_id,omitempty"`
	WinnerName      string    `json:"winner_name,omitempty"`
	WinnerSource    *string   `json:"winner_source,omitempty"`
}
