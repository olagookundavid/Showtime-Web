package services

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"

	"github.com/jackc/pgx/v5/pgconn"
)

type IFantasyLeagueService interface {
	CreateLeague(ctx context.Context, userID string, req dto.CreateLeagueRequest) (*dto.LeagueResponse, error)
	JoinLeague(ctx context.Context, userID, seasonID string, req dto.JoinLeagueRequest) (*dto.JoinLeagueResponse, error)
	LeagueWebhook(ctx context.Context, payload []byte, signature string) error
	VerifyLeaguePayment(ctx context.Context, userID, reference string) error
	ListMyLeagues(ctx context.Context, userID, seasonID string) ([]dto.LeagueResponse, error)
	ListPublicLeagues(ctx context.Context, seasonID string) ([]dto.LeagueResponse, error)
	GetLeaderboard(ctx context.Context, leagueID string, gameweekID *string, page, limit int) ([]dto.LeaderboardEntry, int, error)
	GetOverallLeaderboard(ctx context.Context, seasonID string, gameweekID *string, page, limit int) ([]dto.LeaderboardEntry, int, error)
}

type FantasyLeagueService struct {
	repo           ports.IFantasyLeagueRepository
	fantasyRepo    ports.IFantasyRepository
	authRepo       ports.IAuthRepository
	paystackClient *PaystackClient
}

func NewFantasyLeagueService(
	repo ports.IFantasyLeagueRepository,
	fantasyRepo ports.IFantasyRepository,
	authRepo ports.IAuthRepository,
	paystackClient *PaystackClient,
) IFantasyLeagueService {
	return &FantasyLeagueService{
		repo:           repo,
		fantasyRepo:    fantasyRepo,
		authRepo:       authRepo,
		paystackClient: paystackClient,
	}
}

// inviteCodeAttempts bounds how many fresh codes we try before giving up when
// the generated code collides with an existing one.
const inviteCodeAttempts = 5

func generateInviteCode() (string, error) {
	// 32 characters divides 256 evenly, so the modulo below is bias-free.
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate invite code: %w", err)
	}
	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b), nil
}

func isInviteCodeCollision(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && strings.Contains(pgErr.ConstraintName, "invite_code")
}

// ownerID renders a nullable creator (nil on the system-owned OVERALL league)
// as the plain string the API contract exposes.
func ownerID(id *string) string {
	if id == nil {
		return ""
	}
	return *id
}

func (s *FantasyLeagueService) CreateLeague(ctx context.Context, userID string, req dto.CreateLeagueRequest) (*dto.LeagueResponse, error) {
	var league *domain.FantasyLeague
	var inviteCode string

	for attempt := 0; attempt < inviteCodeAttempts; attempt++ {
		code, err := generateInviteCode()
		if err != nil {
			return nil, err
		}

		candidate := &domain.FantasyLeague{
			SeasonID:        req.SeasonID,
			Name:            req.Name,
			Type:            domain.FantasyLeagueType(req.Type),
			InviteCode:      &code,
			CreatedByUserID: &userID,
			EntryFee:        req.EntryFee,
			MaxMembers:      req.MaxMembers,
		}

		err = s.repo.CreateLeague(ctx, candidate)
		if err == nil {
			league, inviteCode = candidate, code
			break
		}
		// A colliding invite code just needs a fresh one; anything else is fatal.
		if !isInviteCodeCollision(err) {
			return nil, fmt.Errorf("failed to create league: %w", err)
		}
	}

	if league == nil {
		return nil, errors.New("failed to create league: could not generate a unique invite code")
	}

	// Creator auto-joins their own league if they have an existing fantasy team
	team, _ := s.fantasyRepo.GetTeamByUserAndSeason(ctx, userID, req.SeasonID)
	if team != nil {
		_ = s.repo.AddMember(ctx, &domain.FantasyLeagueMember{
			LeagueID:      league.ID,
			UserID:        userID,
			TeamID:        team.ID,
			PaymentStatus: domain.LeaguePaymentFree, // Creator joins free
		})
	}

	memberCount, _ := s.repo.CountActiveMembers(ctx, league.ID)

	return &dto.LeagueResponse{
		ID:              league.ID,
		SeasonID:        league.SeasonID,
		Name:            league.Name,
		Type:            string(league.Type),
		InviteCode:      inviteCode,
		CreatedByUserID: ownerID(league.CreatedByUserID),
		EntryFee:        league.EntryFee,
		MaxMembers:      league.MaxMembers,
		MemberCount:     memberCount,
		CreatedAt:       league.CreatedAt.Format(time.RFC3339),
	}, nil
}

func (s *FantasyLeagueService) JoinLeague(ctx context.Context, userID, seasonID string, req dto.JoinLeagueRequest) (*dto.JoinLeagueResponse, error) {
	code := strings.TrimSpace(req.InviteCode)
	league, err := s.repo.GetLeagueByInviteCode(ctx, code)
	if err != nil || league == nil {
		return nil, errors.New("invalid or expired league invite code")
	}

	if league.SeasonID != seasonID {
		return nil, errors.New("league is not for the current season")
	}

	// 1. Ensure user has a fantasy team
	team, err := s.fantasyRepo.GetTeamByUserAndSeason(ctx, userID, seasonID)
	if err != nil || team == nil {
		return nil, errors.New("please create your fantasy lineup before joining a league")
	}

	// 2. Check if already a member
	existing, _ := s.repo.GetMember(ctx, league.ID, userID)
	if existing != nil && (existing.PaymentStatus == domain.LeaguePaymentFree || existing.PaymentStatus == domain.LeaguePaymentPaid) {
		return &dto.JoinLeagueResponse{
			LeagueID:   league.ID,
			LeagueName: league.Name,
		}, nil
	}

	// 3. Reject a full league before spending a Paystack transaction on it. The
	// authoritative, race-free check still happens inside AddMember.
	if league.MaxMembers > 0 && existing == nil {
		active, err := s.repo.CountActiveMembers(ctx, league.ID)
		if err == nil && active >= league.MaxMembers {
			return nil, ports.ErrLeagueFull
		}
	}

	// 4. Paid league checkout flow (Paystack)
	if league.EntryFee > 0 {
		user, err := s.authRepo.GetUserByID(ctx, userID)
		if err != nil || user == nil {
			return nil, errors.New("user profile not found")
		}

		suffix, err := generateInviteCode()
		if err != nil {
			return nil, err
		}
		ref := fmt.Sprintf("FNT-%d-%s", time.Now().Unix(), suffix)

		paystackReq := PaystackInitRequest{
			Email:     user.Email,
			Amount:    league.EntryFee, // in kobo
			Reference: ref,
		}
		paystackResp, err := s.paystackClient.InitializeTransaction(paystackReq)
		if err != nil {
			return nil, fmt.Errorf("paystack initialization failed: %w", err)
		}

		member := &domain.FantasyLeagueMember{
			LeagueID:           league.ID,
			UserID:             userID,
			TeamID:             team.ID,
			PaymentStatus:      domain.LeaguePaymentPending,
			PaystackReference:  &ref,
			PaystackAccessCode: &paystackResp.Data.AccessCode,
		}
		if err := s.repo.AddMember(ctx, member); err != nil {
			if errors.Is(err, ports.ErrLeagueFull) {
				return nil, err
			}
			return nil, fmt.Errorf("failed to register league membership: %w", err)
		}

		return &dto.JoinLeagueResponse{
			LeagueID:           league.ID,
			LeagueName:         league.Name,
			PaystackURL:        paystackResp.Data.AuthorizationURL,
			PaystackRef:        ref,
			PaystackAccessCode: paystackResp.Data.AccessCode,
		}, nil
	}

	// 5. Free league flow
	member := &domain.FantasyLeagueMember{
		LeagueID:      league.ID,
		UserID:        userID,
		TeamID:        team.ID,
		PaymentStatus: domain.LeaguePaymentFree,
	}
	if err := s.repo.AddMember(ctx, member); err != nil {
		if errors.Is(err, ports.ErrLeagueFull) {
			return nil, err
		}
		return nil, fmt.Errorf("failed to join league: %w", err)
	}

	return &dto.JoinLeagueResponse{
		LeagueID:   league.ID,
		LeagueName: league.Name,
	}, nil
}

func (s *FantasyLeagueService) LeagueWebhook(ctx context.Context, payload []byte, signature string) error {
	// Verify Paystack HMAC-SHA512 signature
	secret := s.paystackClient.GetSecretKey()
	h := hmac.New(sha512.New, []byte(secret))
	h.Write(payload)
	expected := hex.EncodeToString(h.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return errors.New("invalid paystack webhook signature")
	}

	var event struct {
		Event string `json:"event"`
		Data  struct {
			Reference string `json:"reference"`
			Status    string `json:"status"`
		} `json:"data"`
	}
	if err := json.Unmarshal(payload, &event); err != nil {
		return err
	}

	if event.Event == "charge.success" && event.Data.Status == "success" {
		member, err := s.repo.GetMemberByPaystackRef(ctx, event.Data.Reference)
		if err != nil || member == nil {
			return errors.New("league membership reference not found")
		}
		// The webhook is HMAC-authenticated and carries no user context, so it
		// goes straight to the unchecked variant.
		return s.verifyPayment(ctx, member, event.Data.Reference)
	}
	return nil
}

func (s *FantasyLeagueService) VerifyLeaguePayment(ctx context.Context, userID, reference string) error {
	member, err := s.repo.GetMemberByPaystackRef(ctx, reference)
	if err != nil || member == nil {
		return errors.New("league membership reference not found")
	}

	if member.UserID != userID {
		return errors.New("league membership reference not found")
	}

	return s.verifyPayment(ctx, member, reference)
}

func (s *FantasyLeagueService) verifyPayment(ctx context.Context, member *domain.FantasyLeagueMember, reference string) error {
	if member.PaymentStatus == domain.LeaguePaymentPaid {
		return nil // already verified (idempotent)
	}

	// Verify with Paystack API
	verifyResp, err := s.paystackClient.VerifyTransaction(reference)
	if err != nil {
		return fmt.Errorf("paystack verification call failed: %w", err)
	}

	if verifyResp.Data.Status == "success" {
		return s.repo.UpdateMemberPaymentStatus(ctx, member.ID, domain.LeaguePaymentPaid)
	}

	_ = s.repo.UpdateMemberPaymentStatus(ctx, member.ID, domain.LeaguePaymentFailed)
	return fmt.Errorf("payment not successful: status %s", verifyResp.Data.Status)
}

func (s *FantasyLeagueService) ListMyLeagues(ctx context.Context, userID, seasonID string) ([]dto.LeagueResponse, error) {
	leagues, err := s.repo.ListLeaguesByUser(ctx, userID, seasonID)
	if err != nil {
		return nil, err
	}

	var res []dto.LeagueResponse
	for _, l := range leagues {
		code := ""
		if l.InviteCode != nil {
			code = *l.InviteCode
		}
		res = append(res, dto.LeagueResponse{
			ID:              l.ID,
			SeasonID:        l.SeasonID,
			Name:            l.Name,
			Type:            string(l.Type),
			InviteCode:      code,
			CreatedByUserID: ownerID(l.CreatedByUserID),
			EntryFee:        l.EntryFee,
			MaxMembers:      l.MaxMembers,
			MemberCount:     l.MemberCount,
			CreatedAt:       l.CreatedAt.Format(time.RFC3339),
		})
	}
	return res, nil
}

func (s *FantasyLeagueService) ListPublicLeagues(ctx context.Context, seasonID string) ([]dto.LeagueResponse, error) {
	leagues, err := s.repo.ListPublicLeagues(ctx, seasonID)
	if err != nil {
		return nil, err
	}

	var res []dto.LeagueResponse
	for _, l := range leagues {
		code := ""
		if l.InviteCode != nil {
			code = *l.InviteCode
		}
		res = append(res, dto.LeagueResponse{
			ID:              l.ID,
			SeasonID:        l.SeasonID,
			Name:            l.Name,
			Type:            string(l.Type),
			InviteCode:      code,
			CreatedByUserID: ownerID(l.CreatedByUserID),
			EntryFee:        l.EntryFee,
			MaxMembers:      l.MaxMembers,
			MemberCount:     l.MemberCount,
			CreatedAt:       l.CreatedAt.Format(time.RFC3339),
		})
	}
	return res, nil
}

func (s *FantasyLeagueService) GetLeaderboard(ctx context.Context, leagueID string, gameweekID *string, page, limit int) ([]dto.LeaderboardEntry, int, error) {
	return s.repo.GetLeaderboard(ctx, leagueID, gameweekID, page, limit)
}

func (s *FantasyLeagueService) GetOverallLeaderboard(ctx context.Context, seasonID string, gameweekID *string, page, limit int) ([]dto.LeaderboardEntry, int, error) {
	return s.repo.GetOverallLeaderboard(ctx, seasonID, gameweekID, page, limit)
}
