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
	ListUsers(ctx context.Context, page, limit int, searchFilter string, roleFilter string) ([]dto.UserResponse, int, error)
	UpdateUserRole(ctx context.Context, actorID, userID, newRole string) error
	UpdateUserInfo(ctx context.Context, userID, firstName, lastName, phone string) error
	SendPasswordResetOTP(ctx context.Context, email string) error
	CleanupExpiredOTPs(ctx context.Context) error
	SendEmailVerificationCode(ctx context.Context, userID string) error
	VerifyEmail(ctx context.Context, userID, code string) error
}

type AuthService struct {
	AuthRepository ports.IAuthRepository
	PlayerRepo     ports.PlayerRepository
	TokenMaker     token.Maker
	EmailService   ports.EmailService
	RoleService    IRoleService
}

func NewAuthService(repo ports.IAuthRepository, playerRepo ports.PlayerRepository, tokenMaker token.Maker, emailService ports.EmailService, roleService IRoleService) *AuthService {
	return &AuthService{
		AuthRepository: repo,
		PlayerRepo:     playerRepo,
		TokenMaker:     tokenMaker,
		EmailService:   emailService,
		RoleService:    roleService,
	}
}

func (s *AuthService) Register(ctx context.Context, req dto.RegisterRequest) error {

	emailAddr := strings.ToLower(strings.TrimSpace(req.Email))

	if strings.TrimSpace(req.FirstName) == "" || strings.TrimSpace(req.LastName) == "" {
		return errors.New("first and last name must be filled")
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

	// Self-registration always yields the default role, never 'player'.
	//
	// This used to grant role = 'player' when the registrant's email matched a row in
	// players, which let anyone who knew (or controlled) an email a manager had typed
	// into the roster register themselves straight into a player account, bypassing the
	// team manager's approval. Player accounts are minted only by an approved claim —
	// see ClaimService.ApproveClaim.
	fullName := strings.TrimSpace(req.FirstName + " " + req.LastName)
	user := domain.User{
		FullName:  fullName,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     emailAddr,
		Role:      "user",
		Phone:     req.Phone,
	}

	err = user.Password.Set(req.Password)
	if err != nil {
		return errors.New("invalid password")
	}

	if _, err := s.AuthRepository.Register(ctx, user); err != nil {
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
		// Burn any active reset OTPs on a wrong guess so a 6-digit code can't be
		// brute-forced — the attacker must request a fresh OTP each time (which
		// is rate-limited and notifies the real owner).
		_ = s.AuthRepository.InvalidateActiveOTPs(ctx, req.Email, "password_reset")
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

	// Send Email asynchronously via worker pool for instant feedback
	if s.EmailService != nil {
		body := email.OTPEmailHTML(otp) // Use email package prefix
		subject := "SFFL Password Reset Code"
		_ = SubmitJob(func() {
			if err := s.EmailService.SendEmail(emailAddr, subject, body); err != nil {
				fmt.Printf("⚠️ WARNING: Failed to send OTP email to %s: %v\n", emailAddr, err)
			}
		})
	}

	return nil
}

func (s *AuthService) CleanupExpiredOTPs(ctx context.Context) error {
	return s.AuthRepository.DeleteExpiredOTPs(ctx)
}

const emailVerifyPurpose = "email_verify"

// SendEmailVerificationCode emails the logged-in user a 6-digit code that proves
// they own their address. Verified accounts are needed to vote in fan polls, so
// one person can't vote many times through throwaway sign-ups. Requesting a new
// code cancels any earlier one.
func (s *AuthService) SendEmailVerificationCode(ctx context.Context, userID string) error {
	user, err := s.AuthRepository.GetUserByID(ctx, userID)
	if err != nil || user == nil {
		return errors.New("account not found")
	}
	verified, err := s.AuthRepository.IsEmailVerified(ctx, userID)
	if err != nil {
		return err
	}
	if verified {
		return nil
	}

	emailAddr := strings.ToLower(strings.TrimSpace(user.Email))
	_ = s.AuthRepository.InvalidateActiveOTPs(ctx, emailAddr, emailVerifyPurpose)
	code, err := generateOTP(6)
	if err != nil {
		return err
	}
	if err := s.AuthRepository.SaveOTP(ctx, emailAddr, code, emailVerifyPurpose, 15*time.Minute); err != nil {
		return err
	}

	if s.EmailService != nil {
		body := email.VerifyEmailHTML(code)
		_ = SubmitJob(func() {
			if err := s.EmailService.SendEmail(emailAddr, "Your Showtime verification code", body); err != nil {
				fmt.Printf("WARNING: failed to send verification email to %s: %v\n", emailAddr, err)
			}
		})
	}
	return nil
}

// VerifyEmail checks the code and marks the account verified. A wrong code burns
// the active one, so the 6 digits can't be brute-forced; the user asks for a new code.
func (s *AuthService) VerifyEmail(ctx context.Context, userID, code string) error {
	user, err := s.AuthRepository.GetUserByID(ctx, userID)
	if err != nil || user == nil {
		return errors.New("account not found")
	}
	emailAddr := strings.ToLower(strings.TrimSpace(user.Email))
	code = strings.TrimSpace(code)

	valid, err := s.AuthRepository.VerifyOTP(ctx, emailAddr, code, emailVerifyPurpose)
	if err != nil {
		return err
	}
	if !valid {
		_ = s.AuthRepository.InvalidateActiveOTPs(ctx, emailAddr, emailVerifyPurpose)
		return errors.New("that code is wrong or has expired — request a new one")
	}
	if err := s.AuthRepository.MarkEmailVerified(ctx, userID); err != nil {
		return err
	}
	_ = s.AuthRepository.MarkOTPUsed(ctx, emailAddr, code, emailVerifyPurpose)
	return nil
}

func (s *AuthService) Login(ctx context.Context, req dto.LoginRequest) (*dto.LoginResponse, error) {

	// Return one generic error for both "no such account" and "wrong password"
	// so the login endpoint can't be used to enumerate which emails are
	// registered. ErrNoUserRecordExist == "incorrect email or password".
	user, err := s.AuthRepository.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, appErrors.ErrNoUserRecordExist
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

	// Check if user is using default temporary password "NoPassword@123"
	if isDefault, _ := user.Password.Matches("NoPassword@123"); isDefault {
		return nil, appErrors.ErrMustResetPassword
	}

	resp, err := loginUserWithTokens(s, user)
	if err != nil {
		return nil, err
	}
	resp.EmailVerified, _ = s.AuthRepository.IsEmailVerified(ctx, user.ID)
	s.attachAccess(ctx, resp)
	return resp, nil
}

func (s *AuthService) ReturnUserProfile(ctx context.Context, id string) (*dto.LoginResponse, error) {

	user, err := s.AuthRepository.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}

	verified, err := s.AuthRepository.IsEmailVerified(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	resp := &dto.LoginResponse{
		ID:            user.ID,
		FullName:      user.FullName,
		FirstName:     user.FirstName,
		LastName:      user.LastName,
		Email:         user.Email,
		Phone:         user.Phone,
		UserType:      user.Role,
		EmailVerified: verified,
		CreatedAt:     user.CreatedAt,
		UpdatedAt:     user.UpdatedAt,
	}
	s.attachAccess(ctx, resp)
	return resp, nil
}

// attachAccess adds the role's display name and what it may do, so the frontend
// can show and hide admin screens from the same data the backend enforces with.
// A failure leaves the fields empty (no access shown) rather than failing a
// login: the backend still checks every request itself.
func (s *AuthService) attachAccess(ctx context.Context, resp *dto.LoginResponse) {
	resp.RoleName = resp.UserType
	resp.Permissions = map[string]string{}

	access, err := s.RoleService.ResolveUser(ctx, resp.ID)
	if err != nil {
		return
	}
	for feature, level := range access.Permissions() {
		resp.Permissions[feature] = string(level)
	}
	resp.IsStaff = access.IsStaff()
	resp.RoleName = access.RoleName
}

func loginUserWithTokens(s *AuthService, user *domain.User) (*dto.LoginResponse, error) {

	accessToken, err := s.getTokenPair(user.ID)
	if err != nil {
		return nil, err
	}

	return &dto.LoginResponse{
		ID:          user.ID,
		FullName:    user.FullName,
		FirstName:   user.FirstName,
		LastName:    user.LastName,
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
		accessDuration = time.Hour * 24 * 30
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
		accessDuration = time.Hour * 24 * 30
	}

	accessToken, _, err := s.TokenMaker.CreateToken(userId, accessDuration)
	if err != nil {
		return "", err
	}

	return accessToken, nil
}

func (s *AuthService) ListUsers(ctx context.Context, page, limit int, searchFilter string, roleFilter string) ([]dto.UserResponse, int, error) {
	users, total, err := s.AuthRepository.ListUsers(ctx, page, limit, searchFilter, roleFilter)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]dto.UserResponse, len(users))
	for i, u := range users {
		responses[i] = dto.UserResponse{
			ID:        u.ID,
			FullName:  u.FullName,
			FirstName: u.FirstName,
			LastName:  u.LastName,
			Email:     u.Email,
			Phone:     u.Phone,
			Role:      u.Role,
			CreatedAt: u.CreatedAt,
			UpdatedAt: u.UpdatedAt,
		}
	}

	return responses, total, nil
}

// UpdateUserRole moves a user into a role. Which roles exist is whatever is in
// the roles table, and the actor may only hand out access they hold themselves,
// so a plain admin can't promote anyone (themselves included) past their own
// level. Changing an app_admin's role takes an app_admin.
func (s *AuthService) UpdateUserRole(ctx context.Context, actorID, userID, newRole string) error {
	exists, err := s.RoleService.RoleExists(ctx, newRole)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("invalid role: %s", newRole)
	}

	actor, err := s.RoleService.ResolveUser(ctx, actorID)
	if err != nil {
		return err
	}
	if err := s.RoleService.CheckCanAssign(ctx, actor, newRole); err != nil {
		return err
	}

	// Demoting or reassigning an app_admin is as sensitive as creating one.
	current, err := s.AuthRepository.GetUserRole(ctx, userID)
	if err != nil {
		return err
	}
	if current == domain.RoleAppAdmin && actor.Role != domain.RoleAppAdmin {
		return appErrors.ErrRoleEscalation
	}

	return s.AuthRepository.UpdateUserRole(ctx, userID, newRole)
}

func (s *AuthService) UpdateUserInfo(ctx context.Context, userID, firstName, lastName, phone string) error {
	firstName = strings.TrimSpace(firstName)
	lastName = strings.TrimSpace(lastName)
	if firstName == "" || lastName == "" {
		return fmt.Errorf("first and last name must not be empty")
	}
	fullName := strings.TrimSpace(firstName + " " + lastName)
	return s.AuthRepository.UpdateUserInfo(ctx, userID, firstName, lastName, fullName, phone)
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
