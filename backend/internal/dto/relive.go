package dto

import "time"

// AdminReliveStatusResponse is the Relive playlist the homepage shows and how
// fetching it from YouTube is going.
type AdminReliveStatusResponse struct {
	PlaylistID  string `json:"playlist_id"`
	PlaylistURL string `json:"playlist_url"`
	// IsDefault is true until an admin chooses a playlist.
	IsDefault bool `json:"is_default"`
	// Title, VideoCount and FetchedAt describe the last successful fetch.
	Title      string     `json:"title,omitempty"`
	VideoCount int        `json:"video_count"`
	FetchedAt  *time.Time `json:"fetched_at,omitempty"`
	// LastError and FailedAt are set while the latest fetch has failed.
	LastError string     `json:"last_error,omitempty"`
	FailedAt  *time.Time `json:"failed_at,omitempty"`
}

// UpdateRelivePlaylistRequest sets the Relive playlist. PlaylistID accepts a
// YouTube playlist link or a bare id.
type UpdateRelivePlaylistRequest struct {
	PlaylistID string `json:"playlist_id" binding:"required"`
}
