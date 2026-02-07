package dto

type RegisterRequest struct {
	Email      string   `json:"email"`
	Password   *string  `json:"password"`
	InviteCode string   `json:"invite_code"`
	Roles      []string `json:"roles"`
	Token      string
}

type RegisterResponse struct {
	Message string       `json:"message"`
	User    UserResponse `json:"user"` // Same as LoginResponse
}
