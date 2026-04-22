package services

import (
	"context"
	cryptoRand "crypto/rand"
	"errors"
	"fmt"
	"os"
	"pkg-common/token"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
	"showtime-backend/pkg/email"
	"strings"
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
	SendPasswordResetOTP(ctx context.Context, email string) error
	CleanupExpiredOTPs(ctx context.Context) error
}

type AuthService struct {
	AuthRepository ports.IAuthRepository
	TokenMaker     token.Maker
	EmailService   ports.EmailService
}

func NewAuthService(repo ports.IAuthRepository, tokenMaker token.Maker, emailService ports.EmailService) *AuthService {
	return &AuthService{
		AuthRepository: repo,
		TokenMaker:     tokenMaker,
		EmailService:   emailService,
	}
}

func (s *AuthService) Register(ctx context.Context, req dto.RegisterRequest) error {

	emailAddr := strings.ToLower(strings.TrimSpace(req.Email))

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

	existing, _ := s.AuthRepository.GetUserByEmail(ctx, emailAddr)
	if existing != nil {
		return fmt.Errorf("email already in use")

	}

	user := domain.User{
		FullName: req.FullName,
		Email:    emailAddr,
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
	// 1. Verify OTP
	valid, err := s.AuthRepository.VerifyOTP(ctx, req.Email, req.Otp, "password_reset")
	if err != nil {
		return err
	}
	if !valid {
		return errors.New("invalid or expired OTP")
	}

	// 2. Validate Password
	if !domain.IsValidPassword(&req.NewPassword) {
		return errors.New("password must be at least 8 characters, 1 number, and 1 symbol")
	}

	// 3. Set New Password
	user := domain.User{
		Email: req.Email,
	}

	err = user.Password.Set(&req.NewPassword)
	if err != nil {
		return errors.New("invalid password")
	}

	err = s.AuthRepository.ResetPassword(ctx, user)
	if err != nil {
		return err
	}

	// 4. Mark OTP as used
	_ = s.AuthRepository.MarkOTPUsed(ctx, req.Email, req.Otp, "password_reset")

	return nil
}

func (s *AuthService) SendPasswordResetOTP(ctx context.Context, emailAddr string) error {
	emailAddr = strings.ToLower(strings.TrimSpace(emailAddr))

	// Check if user exists
	user, _ := s.AuthRepository.GetUserByEmail(ctx, emailAddr)
	if user == nil {
		// Return nil to avoid email enumeration
		return nil
	}

	// Generate 6-digit OTP
	otp, err := generateOTP(6)
	if err != nil {
		return err
	}

	// Save to DB (expires in 10 minutes)
	err = s.AuthRepository.SaveOTP(ctx, emailAddr, otp, "password_reset", 10*time.Minute)
	if err != nil {
		return err
	}

	// Send Email
	if s.EmailService != nil {
		body := email.OTPEmailHTML(otp) // Use email package prefix
		subject := "SFFL Password Reset Code"
		err = s.EmailService.SendEmail(emailAddr, subject, body)
		if err != nil {
			fmt.Printf("Failed to send OTP email to %s: %v\n", emailAddr, err)
		}
	}

	return nil
}

func (s *AuthService) CleanupExpiredOTPs(ctx context.Context) error {
	return s.AuthRepository.DeleteExpiredOTPs(ctx)
}

func (s *AuthService) Login(ctx context.Context, req dto.LoginRequest) (*dto.LoginResponse, error) {

	user, err := s.AuthRepository.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, appErrors.ErrAccountNotFound
	}

	if user.Password.Hash == nil {
		return nil, errors.New("kindly login with your social account")
	}

	match, err := user.Password.Matches(req.Password)
	if err != nil {
		return nil, err
	}
	if !match {
		return nil, appErrors.ErrIncorrectPassword
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
	allowedRoles := []string{"admin", "user", "team_head", "ticketer", "referee", "stats", "seller"}
	isValid := false
	for _, role := range allowedRoles {
		if newRole == role {
			isValid = true
			break
		}
	}

	if !isValid {
		return fmt.Errorf("invalid role: %s. Allowed roles are admin, user, team_head, ticketer, referee, stats, seller", newRole)
	}

	return s.AuthRepository.UpdateUserRole(ctx, userID, newRole)
}

func (s *AuthService) UpdateUserInfo(ctx context.Context, userID, fullName, phone string) error {
	if fullName == "" {
		return fmt.Errorf("full name must not be empty")
	}
	return s.AuthRepository.UpdateUserInfo(ctx, userID, fullName, phone)
}

func generateOTP(length int) (string, error) {
	const digits = "0123456789"
	otp := make([]byte, length)
	for i := range otp {
		num, err := randInt(len(digits))
		if err != nil {
			return "", err
		}
		otp[i] = digits[num]
	}
	return string(otp), nil
}

func randInt(max int) (int, error) {
	var b [1]byte
	if _, err := cryptoRand.Read(b[:]); err != nil {
		return 0, err
	}
	return int(b[0]) % max, nil
}
