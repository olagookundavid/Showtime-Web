package transport

import (
	"fmt"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/middlewares"

	"showtime-backend/internal/ports"

	"pkg-common/helpers"
	"pkg-common/logger"

	"github.com/gin-gonic/gin"
)

type IUploadHandler interface {
	PresignUpload(c *gin.Context)
	DeleteUpload(c *gin.Context)
}

type UploadHandler struct {
	storage ports.StorageService
	log     *logger.Logger
}

func NewUploadHandler(storage ports.StorageService, log *logger.Logger) IUploadHandler {
	return &UploadHandler{storage: storage, log: log}
}

// PresignUpload godoc
// @Summary      Generate a presigned upload URL
// @Tags         upload
// @Accept       json
// @Produce      json
// @Param        request body dto.PresignUploadRequest true "Presign upload request"
// @Success      200 {object} dto.PresignUploadResponse
// @Router       /api/v1/upload/presign [post]
func (h *UploadHandler) PresignUpload(c *gin.Context) {
	if h.storage == nil {
		h.log.Error("Upload attempted but storage service is not initialized", nil)
		helpers.ServerErrorResponse(c, fmt.Errorf("image storage service is not available, please contact an administrator"))
		return
	}

	var req dto.PresignUploadRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.Error("Failed to bind presign upload request", map[string]any{"error": err.Error()})
		helpers.BadResponse(c, "Invalid request payload")
		return
	}

	// Basic validation of content type
	allowed := map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/webp": true,
	}
	if !allowed[req.ContentType] {
		h.log.Warn("Invalid content type for upload", map[string]any{"content_type": req.ContentType})
		helpers.BadResponse(c, "Invalid file type. Only JPEG, PNG, and WebP are allowed.")
		return
	}

	// A player_pending user is an unapproved account claimant. They are allowed to
	// upload exactly one thing — the photo their team manager reviews them by — so the
	// folder they ask for is ignored and pinned to claim-photos. Without this, granting
	// them presign access would open the whole bucket namespace to anyone who submits a
	// claim.
	if role, ok := c.Get(middlewares.UserRoleContextKey); ok {
		if roleStr, _ := role.(string); roleStr == domain.RolePlayerPending {
			req.Folder = "claim-photos"
		}
	}

	h.log.Info("Generating presigned upload URL", map[string]any{
		"folder":       req.Folder,
		"content_type": req.ContentType,
	})

	uploadURL, objectKey, publicURL, err := h.storage.GeneratePresignedPutURL(c.Request.Context(), req.Folder, req.ContentType)
	if err != nil {
		h.log.Error("Failed to generate presigned URL", map[string]any{
			"error":        err.Error(),
			"folder":       req.Folder,
			"content_type": req.ContentType,
		})
		helpers.ServerErrorResponse(c, err)
		return
	}

	h.log.Info("Presigned upload URL generated successfully", map[string]any{
		"object_key": objectKey,
	})

	helpers.SuccessOK(c, "Presigned URL generated successfully", dto.PresignUploadResponse{
		UploadURL: uploadURL,
		ObjectKey: objectKey,
		PublicURL: publicURL,
	})
}

// DeleteUpload godoc
// @Summary      Delete an uploaded image
// @Tags         upload
// @Accept       json
// @Produce      json
// @Param        request body dto.DeleteUploadRequest true "Delete upload request"
// @Success      204 "No Content"
// @Router       /api/v1/upload [delete]
func (h *UploadHandler) DeleteUpload(c *gin.Context) {
	if h.storage == nil {
		h.log.Error("Delete attempted but storage service is not initialized", nil)
		helpers.ServerErrorResponse(c, fmt.Errorf("image storage service is not available"))
		return
	}

	var req dto.DeleteUploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.Error("Failed to bind delete upload request", map[string]any{"error": err.Error()})
		helpers.BadResponse(c, "Invalid request payload")
		return
	}

	if req.URL == "" {
		helpers.BadResponse(c, "Image URL is required")
		return
	}

	h.log.Info("Deleting image from storage", map[string]any{"url": req.URL})

	if err := h.storage.DeleteObject(c.Request.Context(), req.URL); err != nil {
		h.log.Error("Failed to delete image from storage", map[string]any{
			"url":   req.URL,
			"error": err.Error(),
		})
		helpers.ServerErrorResponse(c, err)
		return
	}

	helpers.SuccessOK(c, "Image deleted successfully", nil)
}
