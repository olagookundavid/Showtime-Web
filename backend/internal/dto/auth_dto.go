package dto

import "time"

type RegisterRequest struct {
	Email    string  `json:"email"`
	Password *string `json:"password"`
	FullName string  `json:"fullname"`
	Phone    string  `json:"phone,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetPasswordRequest struct {
	Email       string `json:"email"`
	Otp         string `json:"otp"`
	NewPassword string `json:"new_password"`
}

type LoginResponse struct {
	ID       string `json:"id"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Phone    string `json:"phone,omitempty"`
	UserType string `json:"user_type"`
	// RoleName is the role's display name; UserType is its permanent key.
	RoleName string `json:"role_name"`
	// Permissions is feature -> "view" | "full". A missing feature means no access.
	Permissions map[string]string `json:"permissions"`
	// IsStaff is true when the role can open the admin panel at all.
	IsStaff bool `json:"is_staff"`
	// EmailVerified is required to vote in fan polls (Player of the Week).
	EmailVerified bool      `json:"email_verified"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	AccessToken   string    `json:"access_token,omitempty"`
}

type UpdateUserRoleRequest struct {
	Role string `json:"role" binding:"required"`
}

type UpdateUserInfoRequest struct {
	FullName string `json:"fullname" binding:"required"`
	Phone    string `json:"phone"`
}

type UserResponse struct {
	ID        string    `json:"id"`
	FullName  string    `json:"fullname"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone,omitempty"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
