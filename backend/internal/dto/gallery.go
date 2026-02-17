package dto

import "time"

type CreateGalleryRequest struct {
	GameWeek        string `json:"game_week" binding:"required"`
	Date            string `json:"date" binding:"required"`
	PlayersPhotoURL string `json:"players_photo_url" binding:"required"`
	FansPhotoURL    string `json:"fans_photo_url" binding:"required"`
}

type GalleryResponse struct {
	ID              string    `json:"id"`
	GameWeek        string    `json:"game_week"`
	Date            string    `json:"date"`
	PlayersPhotoURL string    `json:"players_photo_url"`
	FansPhotoURL    string    `json:"fans_photo_url"`
	CreatedAt       time.Time `json:"created_at"`
}
