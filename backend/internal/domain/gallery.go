package domain

import "time"

type Gallery struct {
	ID              string    `json:"id"`
	CompetitionID   *string   `json:"competition_id,omitempty"`
	GameWeek        string    `json:"game_week"`
	Date            string    `json:"date"`
	PlayersPhotoURL string    `json:"players_photo_url"`
	FansPhotoURL    string    `json:"fans_photo_url"`
	CreatedAt       time.Time `json:"created_at"`

	Competition *Competition `json:"competition,omitempty"`
}
