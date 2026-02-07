package dto

type TokenRequest struct {
	Token string `json:"refresh_token"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type UserRoleRequest struct {
	KcId  string   `json:"kc_id"`
	Roles []string `json:"roles"`
}

type KCUserRequest struct {
	KcId string `json:"kc_id"`
}

type DelRoleRequest struct {
	Roles []string `json:"roles"`
}

type RoleRequest struct {
	Roles []DtoRole `json:"roles"`
}

type ListRoleResponse struct {
	Roles []DtoRoleRes `json:"roles"`
}

type DtoRole struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type DtoRoleRes struct {
	Id          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}
