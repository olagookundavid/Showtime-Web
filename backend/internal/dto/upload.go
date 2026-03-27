package dto

type PresignUploadRequest struct {
	Folder      string `json:"folder" binding:"required"`
	ContentType string `json:"content_type" binding:"required"`
}

type PresignUploadResponse struct {
	UploadURL string `json:"upload_url"`
	ObjectKey string `json:"object_key"`
	PublicURL string `json:"public_url"`
}
