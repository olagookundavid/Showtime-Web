package dto

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	User         UserResponse `json:"user"`
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
}
type UserResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	// KeycloakUserID string           `json:"keycloak_user_id,omitempty"`
	// IsActive       bool             `json:"is_active"`
	// IsSuperAdmin   bool             `json:"is_super_admin"`
	Roles ListRoleResponse `json:"roles"`
}
