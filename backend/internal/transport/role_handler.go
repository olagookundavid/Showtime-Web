package transport

import (
	"errors"
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/middlewares"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IRoleHandler interface {
	ListRoles(c *gin.Context)
	ListFeatures(c *gin.Context)
	ListRoleOptions(c *gin.Context)
	CreateRole(c *gin.Context)
	UpdateRole(c *gin.Context)
	DeleteRole(c *gin.Context)
}

type RoleHandler struct {
	service services.IRoleService
}

func NewRoleHandler(service services.IRoleService) IRoleHandler {
	return &RoleHandler{service: service}
}

// ListRoles godoc
// @Summary      List roles with their permissions and user counts
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Router       /api/v1/admin/roles [get]
func (h *RoleHandler) ListRoles(c *gin.Context) {
	roles, err := h.service.ListRoles(c.Request.Context())
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Roles retrieved", roles)
}

// ListFeatures godoc
// @Summary      List the features a role can be given access to
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Router       /api/v1/admin/roles/features [get]
func (h *RoleHandler) ListFeatures(c *gin.Context) {
	helpers.SuccessOK(c, "Features retrieved", h.service.Features())
}

// ListRoleOptions godoc
// @Summary      List roles for a dropdown (key, name)
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Router       /api/v1/admin/users/roles [get]
func (h *RoleHandler) ListRoleOptions(c *gin.Context) {
	options, err := h.service.ListRoleOptions(c.Request.Context())
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Roles retrieved", options)
}

// CreateRole godoc
// @Summary      Create a role
// @Tags         admin
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        request body dto.SaveRoleRequest true "Role"
// @Router       /api/v1/admin/roles [post]
func (h *RoleHandler) CreateRole(c *gin.Context) {
	var req dto.SaveRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	role, err := h.service.CreateRole(c.Request.Context(), middlewares.AccessFrom(c), toRoleInput(req))
	if err != nil {
		respondRoleError(c, err)
		return
	}
	helpers.SuccessCreated(c, "Role created", role)
}

// UpdateRole godoc
// @Summary      Update a role's name, description and permissions
// @Tags         admin
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        key path string true "Role key"
// @Param        request body dto.SaveRoleRequest true "Role"
// @Router       /api/v1/admin/roles/{key} [put]
func (h *RoleHandler) UpdateRole(c *gin.Context) {
	var req dto.SaveRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	role, err := h.service.UpdateRole(c.Request.Context(), middlewares.AccessFrom(c), c.Param("key"), toRoleInput(req))
	if err != nil {
		respondRoleError(c, err)
		return
	}
	helpers.SuccessOK(c, "Role updated", role)
}

// DeleteRole godoc
// @Summary      Delete a role nobody holds
// @Tags         admin
// @Security     BearerAuth
// @Param        key path string true "Role key"
// @Router       /api/v1/admin/roles/{key} [delete]
func (h *RoleHandler) DeleteRole(c *gin.Context) {
	if err := h.service.DeleteRole(c.Request.Context(), middlewares.AccessFrom(c), c.Param("key")); err != nil {
		respondRoleError(c, err)
		return
	}
	helpers.SuccessOK(c, "Role deleted", nil)
}

func toRoleInput(req dto.SaveRoleRequest) services.RoleInput {
	perms := make(map[string]domain.AccessLevel, len(req.Permissions))
	for feature, level := range req.Permissions {
		perms[feature] = domain.AccessLevel(level)
	}
	return services.RoleInput{Name: req.Name, Description: req.Description, Permissions: perms}
}

func respondRoleError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, appErrors.ErrRoleNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, appErrors.ErrRoleEscalation):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, appErrors.ErrSystemRole),
		errors.Is(err, appErrors.ErrRoleInUse),
		errors.Is(err, appErrors.ErrDuplicateRole):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, appErrors.ErrInvalidFeature),
		errors.Is(err, appErrors.ErrInvalidRoleName):
		helpers.BadResponse(c, err.Error())
	default:
		helpers.ServerErrorResponse(c, err)
	}
}
