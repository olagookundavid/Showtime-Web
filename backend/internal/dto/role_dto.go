package dto

// SaveRoleRequest creates or replaces a role. Permissions maps a feature key to
// "view" or "full"; a feature left out (or set to "none") means no access.
type SaveRoleRequest struct {
	Name        string            `json:"name" binding:"required"`
	Description string            `json:"description"`
	Permissions map[string]string `json:"permissions"`
}
