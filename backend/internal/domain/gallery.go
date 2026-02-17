package domain

import "time"

type Gallery struct {
	ID              string    `json:"id"`
	GameWeek        string    `json:"game_week"`
	Date            string    `json:"date"`
	PlayersPhotoURL string    `json:"players_photo_url"`
	FansPhotoURL    string    `json:"fans_photo_url"`
	CreatedAt       time.Time `json:"created_at"`
}
