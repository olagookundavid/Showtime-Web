package domain

import "time"

// MediaFile is a file in the media library. It is served from a fixed key,
// files/<slug>.<ext>, so URL stays the same when the file is replaced.
type MediaFile struct {
	ID               string    `json:"id"`
	Slug             string    `json:"slug"`
	ObjectKey        string    `json:"object_key"`
	URL              string    `json:"url"`
	Title            string    `json:"title"`
	OriginalFilename string    `json:"original_filename"`
	ContentType      string    `json:"content_type"`
	SizeBytes        int64     `json:"size_bytes"`
	UploadedBy       *string   `json:"uploaded_by"`
	UploadedByName   string    `json:"uploaded_by_name"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
