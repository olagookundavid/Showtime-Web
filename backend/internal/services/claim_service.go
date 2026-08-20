package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"pkg-common/token"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// ErrInvalidClaimCode is the single response for every way a code can fail to redeem —
// unknown, expired, revoked or exhausted. Distinguishing them would let anyone probe
// which team codes exist.
var ErrInvalidClaimCode = errors.New("that code is not valid. Please check with your team manager")

const (
	claimCodeLength      = 8
	claimCodeDefaultDays = 30
	claimCodeDefaultUses = 100
	verifyTokenTTL       = 7 * 24 * time.Hour
)

type IClaimService interface {
	// Code management
	GenerateCode(ctx context.Context, teamID, createdByUserID string, expiresInDays, maxUses *int) (*dto.ClaimCodeResponse, error)
	GetLiveCode(ctx context.Context, teamID string) (*dto.ClaimCodeResponse, error)
	ListCodes(ctx context.Context) ([]dto.ClaimCodeResponse, error)
	RevokeCode(ctx context.Context, id, scopedTeamID string) error

	// Public flow
	VerifyCode(ctx context.Context, code string) (*dto.VerifyClaimCodeResponse, error)
	SubmitClaim(ctx context.Context, req dto.SubmitClaimRequest) (*dto.SubmitClaimResponse, error)
	VerifyClaimEmail(ctx context.Context, rawToken string) error

	// Claimant
	GetMyClaim(ctx context.Context, userID string) (*dto.MyClaimStatusResponse, error)
	UpdateMyClaimPhoto(ctx context.Context, userID, photo string) error
	ResendVerification(ctx context.Context, userID string) error

	// Review
	ListClaims(ctx context.Context, teamID, status, search string, page, limit int) (dto.PaginatedResult[dto.PlayerClaimResponse], error)
	ApproveClaim(ctx context.Context, claimID, reviewerUserID, scopedTeamID string, req dto.ApproveClaimRequest) error
	RejectClaim(ctx context.Context, claimID, reviewerUserID, scopedTeamID, reason string) error
	RevokeClaim(ctx context.Context, claimID string) error
}

type ClaimService struct {
	repo            ports.IClaimRepository
	tmRepo          ports.ITeamManagerRepository
	contractService IContractService
	notifService    INotificationService
	emailService    ports.EmailService
	tokenMaker      token.Maker
}

func NewClaimService(
	repo ports.IClaimRepository,
	tmRepo ports.ITeamManagerRepository,
	contractService IContractService,
	notifService INotificationService,
	emailService ports.EmailService,
	tokenMaker token.Maker,
) IClaimService {
	return &ClaimService{
		repo:            repo,
		tmRepo:          tmRepo,
		contractService: contractService,
		notifService:    notifService,
		emailService:    emailService,
		tokenMaker:      tokenMaker,
	}
}

// --- Code management ---

// newClaimCode produces a short, human-transcribable code. Base32 without padding
// avoids the 0/O and 1/I confusions of base64 when a manager reads a code aloud or
// types it into a WhatsApp message.
func newClaimCode() (string, error) {
	buf := make([]byte, 10)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	enc := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(buf)
	return strings.ToUpper(enc[:claimCodeLength]), nil
}

func (s *ClaimService) GenerateCode(ctx context.Context, teamID, createdByUserID string, expiresInDays, maxUses *int) (*dto.ClaimCodeResponse, error) {
	if teamID == "" {
		return nil, errors.New("a team is required")
	}

	team, err := s.repo.GetTeamByID(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if team == nil {
		return nil, errors.New("team not found")
	}

	// Rotating replaces rather than adds: the unique index allows only one live code per
	// team, so "the team's code" is never ambiguous.
	if err := s.repo.RevokeLiveClaimCodesForTeam(ctx, teamID); err != nil {
		return nil, err
	}

	days := claimCodeDefaultDays
	if expiresInDays != nil && *expiresInDays > 0 {
		days = *expiresInDays
	}
	uses := claimCodeDefaultUses
	if maxUses != nil && *maxUses > 0 {
		uses = *maxUses
	}

	code, err := newClaimCode()
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(time.Duration(days) * 24 * time.Hour)

	entity := &domain.TeamClaimCode{
		TeamID:    teamID,
		Code:      code,
		ExpiresAt: &expiresAt,
		MaxUses:   uses,
	}
	if createdByUserID != "" {
		entity.CreatedBy = &createdByUserID
	}

	if err := s.repo.CreateClaimCode(ctx, entity); err != nil {
		return nil, err
	}

	res := mapClaimCodeToResponse(entity)
	res.TeamName = team.Name
	return &res, nil
}

func (s *ClaimService) GetLiveCode(ctx context.Context, teamID string) (*dto.ClaimCodeResponse, error) {
	c, err := s.repo.GetLiveClaimCodeByTeam(ctx, teamID)
	if err != nil || c == nil {
		return nil, err
	}
	res := mapClaimCodeToResponse(c)
	if team, _ := s.repo.GetTeamByID(ctx, teamID); team != nil {
		res.TeamName = team.Name
	}
	return &res, nil
}

func (s *ClaimService) ListCodes(ctx context.Context) ([]dto.ClaimCodeResponse, error) {
	codes, err := s.repo.ListClaimCodes(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]dto.ClaimCodeResponse, 0, len(codes))
	for i := range codes {
		res := mapClaimCodeToResponse(&codes[i])
		if codes[i].Team != nil {
			res.TeamName = codes[i].Team.Name
		}
		out = append(out, res)
	}
	return out, nil
}

func (s *ClaimService) RevokeCode(ctx context.Context, id, scopedTeamID string) error {
	return s.repo.RevokeClaimCodeByID(ctx, id, scopedTeamID)
}

// --- Public flow ---

// VerifyCode exchanges a code for the team's unclaimed roster. Every failure path
// returns ErrInvalidClaimCode so the endpoint cannot be used to enumerate codes.
func (s *ClaimService) VerifyCode(ctx context.Context, code string) (*dto.VerifyClaimCodeResponse, error) {
	entity, err := s.resolveCode(ctx, code)
	if err != nil {
		return nil, err
	}

	team, err := s.repo.GetTeamByID(ctx, entity.TeamID)
	if err != nil {
		return nil, err
	}
	if team == nil {
		return nil, ErrInvalidClaimCode
	}

	players, err := s.repo.GetClaimablePlayersByTeam(ctx, entity.TeamID)
	if err != nil {
		return nil, err
	}

	claimable := make([]dto.ClaimablePlayer, 0, len(players))
	for _, p := range players {
		claimable = append(claimable, dto.ClaimablePlayer{
			ID:           p.ID,
			Name:         p.Name,
			JerseyNumber: p.JerseyNumber,
			Position:     p.Position,
		})
	}

	// Only counted once the code has actually produced a roster, so a typo doesn't
	// consume one of the team's allotted uses.
	_ = s.repo.IncrementClaimCodeUses(ctx, entity.ID)

	return &dto.VerifyClaimCodeResponse{
		TeamID:   team.ID,
		TeamName: team.Name,
		TeamLogo: team.Logo,
		Players:  claimable,
	}, nil
}

func (s *ClaimService) resolveCode(ctx context.Context, code string) (*domain.TeamClaimCode, error) {
	trimmed := strings.TrimSpace(code)
	if trimmed == "" {
		return nil, ErrInvalidClaimCode
	}

	entity, err := s.repo.GetClaimCodeByCode(ctx, trimmed)
	if err != nil {
		return nil, err
	}
	if entity == nil || !entity.Live(time.Now()) {
		return nil, ErrInvalidClaimCode
	}
	return entity, nil
}

// SubmitClaim creates the pending account and the claim together. The account is
// created now rather than at approval for three reasons: the users.email uniqueness
// conflict surfaces at the form instead of in front of a reviewing manager; the claimant
// can log in and see that their claim is pending; and being authenticated is what lets
// them upload their own photo, which is exactly what the manager needs in order to
// judge the claim.
func (s *ClaimService) SubmitClaim(ctx context.Context, req dto.SubmitClaimRequest) (*dto.SubmitClaimResponse, error) {
	entity, err := s.resolveCode(ctx, req.Code)
	if err != nil {
		return nil, err
	}

	emailAddr := strings.ToLower(strings.TrimSpace(req.Email))
	if err := domain.IsValidEmail(&emailAddr); err != nil {
		return nil, errors.New("please enter a valid email address")
	}
	if !domain.IsValidPassword(&req.Password) {
		return nil, errors.New("password must be at least 8 characters and include a number and a symbol")
	}

	isNewPlayerRequest := strings.TrimSpace(req.PlayerID) == ""
	fullName := strings.TrimSpace(req.FullName)
	if isNewPlayerRequest && fullName == "" {
		return nil, errors.New("please enter your full name so your manager can identify you")
	}

	claim := &domain.PlayerClaim{
		TeamID:       entity.TeamID,
		CodeID:       &entity.ID,
		ClaimedEmail: emailAddr,
		ClaimedPhone: strings.TrimSpace(req.Phone),
		// The name the claimant gave is recorded either way, not just for new-player
		// requests: it is what the manager's notification and the claimant's own status
		// screen say instead of falling back to a bare email address. For an existing
		// player it is never written back to the roster — ApproveClaim only ever takes
		// roster fields from the manager's own override.
		ProposedName:         fullName,
		ProposedJerseyNumber: req.ProposedJerseyNumber,
		ProposedPosition:     strings.TrimSpace(req.ProposedPosition),
	}
	if !isNewPlayerRequest {
		pid := strings.TrimSpace(req.PlayerID)
		claim.PlayerID = &pid
	}

	// player_pending grants nothing but the status screen and a photo upload. Only
	// ApproveClaim promotes it to "player".
	user := domain.User{
		FullName: firstNonEmptyString(fullName, emailAddr),
		Email:    emailAddr,
		Role:     domain.RolePlayerPending,
		Phone:    claim.ClaimedPhone,
	}
	if err := user.Password.Set(&req.Password); err != nil {
		return nil, errors.New("invalid password")
	}

	userID, err := s.repo.CreateClaimWithAccount(ctx, claim, user)
	if err != nil {
		return nil, err
	}

	s.issueVerificationEmail(ctx, claim.ID, emailAddr)
	s.notifyManagersOfNewClaim(ctx, claim)

	accessToken, err := s.accessTokenFor(userID)
	if err != nil {
		// The claim itself succeeded; only auto-login failed. Say so rather than
		// implying the submission was lost.
		return &dto.SubmitClaimResponse{
			ClaimID:  claim.ID,
			Status:   domain.ClaimStatusPending,
			UserID:   userID,
			UserType: domain.RolePlayerPending,
			Message:  "Your claim was submitted. Please log in to track its status.",
		}, nil
	}

	return &dto.SubmitClaimResponse{
		ClaimID:     claim.ID,
		Status:      domain.ClaimStatusPending,
		AccessToken: accessToken,
		UserID:      userID,
		UserType:    domain.RolePlayerPending,
		Message:     "Your claim was submitted and is awaiting your team manager's approval.",
	}, nil
}

func (s *ClaimService) accessTokenFor(userID string) (string, error) {
	accessDuration, err := time.ParseDuration(os.Getenv("ACCESS_TOKEN_DURATION"))
	if err != nil {
		accessDuration = time.Hour * 24 * 30
	}
	accessToken, _, err := s.tokenMaker.CreateToken(userID, accessDuration)
	return accessToken, err
}

// issueVerificationEmail is best-effort. Verification is informational — it proves the
// account is recoverable, not that the claimant is who they say — so a mail failure must
// never block a claim from reaching the manager who can actually vouch for the person.
func (s *ClaimService) issueVerificationEmail(ctx context.Context, claimID, emailAddr string) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return
	}
	rawToken := hex.EncodeToString(raw)
	sum := sha256.Sum256([]byte(rawToken))

	if err := s.repo.SetClaimVerifyToken(ctx, claimID, sum[:], time.Now().Add(verifyTokenTTL)); err != nil {
		return
	}

	if s.emailService == nil {
		return
	}

	// Falls back to localhost to match ticket_service and store_service. A fallback
	// pointing at a real-looking domain would send verification links somewhere wrong
	// and silently, whereas a localhost link is obviously broken and gets reported.
	base := os.Getenv("FRONTEND_URL")
	if base == "" {
		base = "http://localhost:5173"
	}
	link := fmt.Sprintf("%s/claim/verify?token=%s", strings.TrimRight(base, "/"), rawToken)

	body := fmt.Sprintf(`
		<p>Hello,</p>
		<p>You started claiming your Showtime player account. Confirm this email address so you
		can reset your password later if you ever need to:</p>
		<p><a href="%s">Confirm my email address</a></p>
		<p>Your team manager still needs to approve your claim before you can sign in fully.
		You will be notified once they do.</p>
		<p>If you did not request this, you can ignore this email.</p>
	`, link)

	_ = s.emailService.SendEmail(emailAddr, "Confirm your email — Showtime player account", body)
}

func (s *ClaimService) notifyManagersOfNewClaim(ctx context.Context, claim *domain.PlayerClaim) {
	if s.tmRepo == nil || s.notifService == nil {
		return
	}
	managers, err := s.tmRepo.GetManagersByTeamID(ctx, claim.TeamID)
	if err != nil {
		return
	}

	who := claim.ProposedName
	if who == "" {
		who = claim.ClaimedEmail
	}
	title := "New player account claim"
	msg := fmt.Sprintf("%s submitted a claim for a player account. Review it to approve or reject.", who)
	refID := claim.ID

	for _, m := range managers {
		_ = s.notifService.Send(ctx, m.UserID, "PLAYER_CLAIM", title, msg, "player_claim", &refID)
	}
}

func (s *ClaimService) VerifyClaimEmail(ctx context.Context, rawToken string) error {
	trimmed := strings.TrimSpace(rawToken)
	if trimmed == "" {
		return errors.New("verification link is invalid or has expired")
	}
	sum := sha256.Sum256([]byte(trimmed))

	claim, err := s.repo.GetClaimByVerifyTokenHash(ctx, sum[:])
	if err != nil {
		return err
	}
	if claim == nil {
		return errors.New("verification link is invalid or has expired")
	}
	return s.repo.MarkClaimEmailVerified(ctx, claim.ID)
}

// --- Claimant ---

func (s *ClaimService) GetMyClaim(ctx context.Context, userID string) (*dto.MyClaimStatusResponse, error) {
	claim, err := s.repo.GetClaimByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if claim == nil {
		return &dto.MyClaimStatusResponse{HasClaim: false}, nil
	}

	res := &dto.MyClaimStatusResponse{
		HasClaim:      true,
		ClaimID:       claim.ID,
		Status:        claim.Status,
		ClaimedEmail:  claim.ClaimedEmail,
		ClaimedPhone:  claim.ClaimedPhone,
		ClaimedPhoto:  claim.ClaimedPhoto,
		EmailVerified: claim.EmailVerifiedAt != nil,
		RejectReason:  claim.RejectReason,
		PlayerName:    claim.ProposedName,
		CreatedAt:     claim.CreatedAt.Format(time.RFC3339),
	}
	if team, _ := s.repo.GetTeamByID(ctx, claim.TeamID); team != nil {
		res.TeamName = team.Name
	}
	return res, nil
}

func (s *ClaimService) UpdateMyClaimPhoto(ctx context.Context, userID, photo string) error {
	claim, err := s.repo.GetClaimByUserID(ctx, userID)
	if err != nil {
		return err
	}
	if claim == nil {
		return errors.New("you do not have a claim to update")
	}
	return s.repo.UpdateClaimPhoto(ctx, claim.ID, strings.TrimSpace(photo))
}

func (s *ClaimService) ResendVerification(ctx context.Context, userID string) error {
	claim, err := s.repo.GetClaimByUserID(ctx, userID)
	if err != nil {
		return err
	}
	if claim == nil {
		return errors.New("you do not have a claim")
	}
	if claim.EmailVerifiedAt != nil {
		return errors.New("your email address is already confirmed")
	}
	s.issueVerificationEmail(ctx, claim.ID, claim.ClaimedEmail)
	return nil
}

// --- Review ---

func (s *ClaimService) ListClaims(ctx context.Context, teamID, status, search string, page, limit int) (dto.PaginatedResult[dto.PlayerClaimResponse], error) {
	claims, total, err := s.repo.ListClaims(ctx, teamID, status, search, page, limit)
	if err != nil {
		return dto.PaginatedResult[dto.PlayerClaimResponse]{}, err
	}

	out := make([]dto.PlayerClaimResponse, 0, len(claims))
	for i := range claims {
		c := &claims[i]
		res := dto.PlayerClaimResponse{
			ID:                   c.ID,
			PlayerID:             c.PlayerID,
			TeamID:               c.TeamID,
			Status:               c.Status,
			ClaimedEmail:         c.ClaimedEmail,
			ClaimedPhone:         c.ClaimedPhone,
			ClaimedPhoto:         c.ClaimedPhoto,
			EmailVerified:        c.EmailVerifiedAt != nil,
			IsNewPlayerRequest:   c.IsNewPlayerRequest(),
			ProposedName:         c.ProposedName,
			ProposedJerseyNumber: c.ProposedJerseyNumber,
			ProposedPosition:     c.ProposedPosition,
			RejectReason:         c.RejectReason,
			ReviewedBy:           c.ReviewedBy,
			CreatedAt:            c.CreatedAt.Format(time.RFC3339),
		}
		if c.Team != nil {
			res.TeamName = c.Team.Name
		}
		if c.Player != nil {
			res.PlayerName = c.Player.Name
			res.PlayerJerseyNumber = c.Player.JerseyNumber
			res.PlayerPosition = c.Player.Position
			res.PlayerImage = c.Player.Image
		}
		if c.ReviewedAt != nil {
			t := c.ReviewedAt.Format(time.RFC3339)
			res.ReviewedAt = &t
		}
		// The historical record is what makes review possible: a claimant can invent an
		// email, but not a season of appearances.
		if c.PlayerID != nil {
			if pastTeams, matches, err := s.repo.GetClaimReviewContext(ctx, *c.PlayerID); err == nil {
				res.PastTeams = pastTeams
				res.MatchesPlayed = matches
			}
		}
		out = append(out, res)
	}

	totalPages := 0
	if limit > 0 {
		totalPages = (int(total) + limit - 1) / limit
	}

	return dto.PaginatedResult[dto.PlayerClaimResponse]{
		Data:       out,
		Total:      int(total),
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

// assertReviewable rejects an attempt by one team's manager to act on another team's
// claim. scopedTeamID is empty for admins, who may review anything.
func (s *ClaimService) assertReviewable(ctx context.Context, claimID, scopedTeamID string) (*domain.PlayerClaim, error) {
	claim, err := s.repo.GetClaimByID(ctx, claimID)
	if err != nil {
		return nil, err
	}
	if claim == nil {
		return nil, errors.New("claim not found")
	}
	if scopedTeamID != "" && claim.TeamID != scopedTeamID {
		return nil, errors.New("forbidden: this claim does not belong to your team")
	}
	return claim, nil
}

func (s *ClaimService) ApproveClaim(ctx context.Context, claimID, reviewerUserID, scopedTeamID string, req dto.ApproveClaimRequest) error {
	claim, err := s.assertReviewable(ctx, claimID, scopedTeamID)
	if err != nil {
		return err
	}

	override := domain.Player{
		Name:     strings.TrimSpace(req.Name),
		Position: strings.TrimSpace(req.Position),
	}
	if req.JerseyNumber != nil {
		override.JerseyNumber = *req.JerseyNumber
	}

	playerID, createdNew, err := s.repo.ApproveClaim(ctx, claimID, reviewerUserID, override)
	if err != nil {
		return err
	}

	// A newly created player needs their first contract, or they are rostered but
	// invisible to the team-sheet dropdowns, which key off an active contract. Existing
	// players already hold one from the historical import.
	if createdNew && s.contractService != nil {
		if err := s.contractService.ProvisionInitialContract(ctx, playerID, claim.TeamID, reviewerUserID, nil); err != nil {
			fmt.Printf("claim %s: player %s approved but initial contract could not be issued: %v\n", claimID, playerID, err)
		}
	}

	if claim.UserID != nil && s.notifService != nil {
		refID := claimID
		_ = s.notifService.Send(ctx, *claim.UserID, "PLAYER_CLAIM_APPROVED", "Your account is approved",
			"Your team manager approved your claim. You now have full access to your player portal.",
			"player_claim", &refID)
	}
	if s.emailService != nil {
		_ = s.emailService.SendEmail(claim.ClaimedEmail, "Your Showtime player account is approved",
			`<p>Good news — your team manager approved your claim.</p>
			 <p>You can now sign in and access your player portal.</p>`)
	}

	return nil
}

func (s *ClaimService) RejectClaim(ctx context.Context, claimID, reviewerUserID, scopedTeamID, reason string) error {
	claim, err := s.assertReviewable(ctx, claimID, scopedTeamID)
	if err != nil {
		return err
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return errors.New("a reason is required so the claimant knows what to correct")
	}

	if err := s.repo.RejectClaim(ctx, claimID, reviewerUserID, reason); err != nil {
		return err
	}

	if claim.UserID != nil && s.notifService != nil {
		refID := claimID
		_ = s.notifService.Send(ctx, *claim.UserID, "PLAYER_CLAIM_REJECTED", "Your claim was not approved",
			fmt.Sprintf("Your team manager did not approve your claim. Reason: %s", reason),
			"player_claim", &refID)
	}
	if s.emailService != nil {
		_ = s.emailService.SendEmail(claim.ClaimedEmail, "About your Showtime account claim",
			fmt.Sprintf(`<p>Your team manager was unable to approve your claim.</p>
			 <p><strong>Reason:</strong> %s</p>
			 <p>Please speak with your team manager if you believe this was a mistake.</p>`, reason))
	}

	return nil
}

func (s *ClaimService) RevokeClaim(ctx context.Context, claimID string) error {
	return s.repo.RevokeApprovedClaim(ctx, claimID)
}

// --- helpers ---

func mapClaimCodeToResponse(c *domain.TeamClaimCode) dto.ClaimCodeResponse {
	res := dto.ClaimCodeResponse{
		ID:        c.ID,
		TeamID:    c.TeamID,
		Code:      c.Code,
		MaxUses:   c.MaxUses,
		Uses:      c.Uses,
		Revoked:   c.RevokedAt != nil,
		CreatedAt: c.CreatedAt.Format(time.RFC3339),
	}
	if c.ExpiresAt != nil {
		t := c.ExpiresAt.Format(time.RFC3339)
		res.ExpiresAt = &t
	}
	return res
}

func firstNonEmptyString(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
