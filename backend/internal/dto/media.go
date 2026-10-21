package dto

// PresignMediaRequest asks for somewhere to upload a file. FileID is set when
// replacing an existing file; Slug only matters for a new one.
type PresignMediaRequest struct {
	FileID      string `json:"file_id"`
	Slug        string `json:"slug"`
	Filename    string `json:"filename" binding:"required"`
	ContentType string `json:"content_type" binding:"required"`
	Size        int64  `json:"size" binding:"required"`
}

// PresignMediaResponse is a temporary upload slot. The browser PUTs the file to
// UploadURL, then sends UploadKey to create or replace.
type PresignMediaResponse struct {
	UploadURL string `json:"upload_url"`
	UploadKey string `json:"upload_key"`
}

type CreateMediaRequest struct {
	Slug      string `json:"slug" binding:"required"`
	Title     string `json:"title" binding:"required"`
	Filename  string `json:"filename"`
	UploadKey string `json:"upload_key" binding:"required"`
}

type ReplaceMediaFileRequest struct {
	Filename  string `json:"filename"`
	UploadKey string `json:"upload_key" binding:"required"`
}

type UpdateMediaRequest struct {
	Title string `json:"title" binding:"required"`
}
