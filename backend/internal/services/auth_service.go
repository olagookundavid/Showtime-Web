package services

import (
	"context"
	"errors"
	"fmt"
	"os"
	"pkg-common/token"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
	"strings"

	"showtime-backend/internal/domain"
	"time"
)

type IAuthService interface {
	Register(ctx context.Context, req dto.RegisterRequest) error
	Login(ctx context.Context, req dto.LoginRequest) (*dto.LoginResponse, error)
	ResetPassword(ctx context.Context, req dto.ResetPasswordRequest) error
	ReturnUserProfile(ctx context.Context, id string) (*dto.LoginResponse, error)
	ListUsers(ctx context.Context, page, limit int, searchFilter string) ([]dto.UserResponse, int, error)
	UpdateUserRole(ctx context.Context, userID, newRole string) error
	UpdateUserInfo(ctx context.Context, userID, fullName, phone string) error
}

type AuthService struct {
	AuthRepository ports.IAuthRepository
	TokenMaker     token.Maker
}

func NewAuthService(repo ports.IAuthRepository, tokenMaker token.Maker) *AuthService {
	return &AuthService{
		AuthRepository: repo,
		TokenMaker:     tokenMaker,
	}
}

func (s *AuthService) Register(ctx context.Context, req dto.RegisterRequest) error {

	email := strings.ToLower(strings.TrimSpace(req.Email))

	if req.FullName == "" {
		return errors.New("full Name must be filled")
	}

	err := domain.IsValidEmail(&req.Email)
	if err != nil {
		return err
	}
	if req.Password != nil {
		if !domain.IsValidPassword(req.Password) {
			return errors.New("password must be at least 8 characters, 1 number, and 1 symbol")
		}
	}

	existing, _ := s.AuthRepository.GetUserByEmail(ctx, email)
	if existing != nil {
		return fmt.Errorf("email already in use")

	}

	user := domain.User{
		FullName: req.FullName,
		Email:    email,
		Role:     "user", // Default role
		Phone:    req.Phone,
	}

	err = user.Password.Set(req.Password)
	if err != nil {
		return errors.New("invalid password")
	}

	_, err = s.AuthRepository.Register(ctx, user)
	if err != nil {
		return err
	}

	return nil
}

func (s *AuthService) ResetPassword(ctx context.Context, req dto.ResetPasswordRequest) error {

	if !domain.IsValidPassword(&req.NewPassword) {
		return errors.New("password must be at least 8 characters, 1 number, and 1 symbol")
	}
	user := domain.User{
		Email: req.Email,
	}

	err := user.Password.Set(&req.NewPassword)
	if err != nil {
		return errors.New("invalid password")
	}

	return s.AuthRepository.ResetPassword(ctx, user)
}

func (s *AuthService) Login(ctx context.Context, req dto.LoginRequest) (*dto.LoginResponse, error) {

	user, err := s.AuthRepository.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, err
	}

	if user.Password.Hash == nil {
		return nil, errors.New("kindly login with your social account")
	}

	match, err := user.Password.Matches(req.Password)
	if err != nil {
		return nil, err
	}
	if !match {
		return nil, appErrors.ErrNoUserRecordExist
	}

	return loginUserWithTokens(s, user)
}

func (s *AuthService) ReturnUserProfile(ctx context.Context, id string) (*dto.LoginResponse, error) {

	user, err := s.AuthRepository.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}

	return &dto.LoginResponse{
		ID:        user.ID,
		FullName:  user.FullName,
		Email:     user.Email,
		Phone:     user.Phone,
		UserType:  user.Role,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}, nil
}

func loginUserWithTokens(s *AuthService, user *domain.User) (*dto.LoginResponse, error) {

	accessToken, err := s.getTokenPair(user.ID)
	if err != nil {
		return nil, err
	}

	return &dto.LoginResponse{
		ID:          user.ID,
		FullName:    user.FullName,
		Email:       user.Email,
		Phone:       user.Phone,
		CreatedAt:   user.CreatedAt,
		UpdatedAt:   user.UpdatedAt,
		AccessToken: accessToken,
		UserType:    user.Role,
	}, nil
}

func (s *AuthService) getAccessToken(userId string) (string, error) {

	accessDuration, err := time.ParseDuration(os.Getenv("ACCESS_TOKEN_DURATION"))
	if err != nil {
		accessDuration = time.Hour * 24
	}

	accessToken, _, err := s.TokenMaker.CreateToken(userId, accessDuration)
	if err != nil {
		return "", err
	}

	return accessToken, nil
}

func (s *AuthService) getTokenPair(userId string) (string, error) {

	accessDuration, err := time.ParseDuration(os.Getenv("ACCESS_TOKEN_DURATION"))
	if err != nil {
		accessDuration = time.Hour * 24
	}

	accessToken, _, err := s.TokenMaker.CreateToken(userId, accessDuration)
	if err != nil {
		return "", err
	}

	return accessToken, nil
}

func (s *AuthService) ListUsers(ctx context.Context, page, limit int, searchFilter string) ([]dto.UserResponse, int, error) {
	users, total, err := s.AuthRepository.ListUsers(ctx, page, limit, searchFilter)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]dto.UserResponse, len(users))
	for i, u := range users {
		responses[i] = dto.UserResponse{
			ID:        u.ID,
			FullName:  u.FullName,
			Email:     u.Email,
			Phone:     u.Phone,
			Role:      u.Role,
			CreatedAt: u.CreatedAt,
			UpdatedAt: u.UpdatedAt,
		}
	}

	return responses, total, nil
}

func (s *AuthService) UpdateUserRole(ctx context.Context, userID, newRole string) error {
	// Validate role
	validRoles := map[string]bool{"admin": true, "user": true, "team_head": true}
	if !validRoles[newRole] {
		return fmt.Errorf("invalid role: %s. Allowed roles are admin, user, team_head", newRole)
	}

	return s.AuthRepository.UpdateUserRole(ctx, userID, newRole)
}

func (s *AuthService) UpdateUserInfo(ctx context.Context, userID, fullName, phone string) error {
	if fullName == "" {
		return fmt.Errorf("full name must not be empty")
	}
	return s.AuthRepository.UpdateUserInfo(ctx, userID, fullName, phone)
}
