package transport

import (
	"errors"
	"net/http"
	"pkg-common/helpers"

	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IMediaHandler interface {
	List(c *gin.Context)
	Presign(c *gin.Context)
	Create(c *gin.Context)
	UpdateTitle(c *gin.Context)
	Replace(c *gin.Context)
	Delete(c *gin.Context)
}

type MediaHandler struct {
	service services.IMediaService
}

func NewMediaHandler(service services.IMediaService) IMediaHandler {
	return &MediaHandler{service: service}
}

// fail maps a service error onto the right status: an unknown file is 404, a
// problem with the file or what the admin typed is 400, anything else is a real failure.
func (h *MediaHandler) fail(c *gin.Context, err error) {
	var invalid appErrors.MediaValidationError
	switch {
	case errors.Is(err, appErrors.ErrMediaFileNotFound):
		helpers.NotFoundResponseWithMsg(c, err.Error())
	case errors.Is(err, appErrors.ErrMediaSlugTaken),
		errors.Is(err, appErrors.ErrMediaUploadMissing),
		errors.As(err, &invalid):
		helpers.BadResponse(c, err.Error())
	default:
		helpers.ServerErrorResponse(c, err)
	}
}

// @Summary List media library files (admin)
// @Tags media
// @Produce json
// @Success 200 {object} map[string][]domain.MediaFile
// @Router /api/v1/admin/media [get]
func (h *MediaHandler) List(c *gin.Context) {
	files, err := h.service.List(c.Request.Context())
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": files})
}

// @Summary Get a temporary upload URL for a media library file (admin)
// @Tags media
// @Accept json
// @Produce json
// @Param request body dto.PresignMediaRequest true "File to upload"
// @Success 200 {object} map[string]dto.PresignMediaResponse
// @Router /api/v1/admin/media/presign [post]
func (h *MediaHandler) Presign(c *gin.Context) {
	var req dto.PresignMediaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	resp, err := h.service.Presign(c.Request.Context(), req)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

// @Summary Add an uploaded file to the media library (admin)
// @Tags media
// @Accept json
// @Produce json
// @Param request body dto.CreateMediaRequest true "File"
// @Success 201 {object} map[string]domain.MediaFile
// @Router /api/v1/admin/media [post]
func (h *MediaHandler) Create(c *gin.Context) {
	var req dto.CreateMediaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	var userID string
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil {
		userID = payload.UserId
	}
	file, err := h.service.Create(c.Request.Context(), userID, req)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": file})
}

// @Summary Rename a media library file (admin)
// @Tags media
// @Accept json
// @Produce json
// @Param id path string true "File ID"
// @Param request body dto.UpdateMediaRequest true "Title"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/media/{id} [put]
func (h *MediaHandler) UpdateTitle(c *gin.Context) {
	var req dto.UpdateMediaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	if err := h.service.UpdateTitle(c.Request.Context(), c.Param("id"), req); err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "File updated"})
}

// @Summary Replace a media library file, keeping its URL (admin)
// @Tags media
// @Accept json
// @Produce json
// @Param id path string true "File ID"
// @Param request body dto.ReplaceMediaFileRequest true "Upload"
// @Success 200 {object} map[string]domain.MediaFile
// @Router /api/v1/admin/media/{id}/file [put]
func (h *MediaHandler) Replace(c *gin.Context) {
	var req dto.ReplaceMediaFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	file, err := h.service.Replace(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": file})
}

// @Summary Delete a media library file (admin)
// @Tags media
// @Produce json
// @Param id path string true "File ID"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/media/{id} [delete]
func (h *MediaHandler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Request.Context(), c.Param("id")); err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "File deleted"})
}
