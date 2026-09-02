package services

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// SettingPlatformCutPercent is the app_settings key holding the platform's
// percentage cut of paid-league entry fees.
const SettingPlatformCutPercent = "fantasy_platform_cut_percent"

// defaultPlatformCutPercent applies when the setting is unset or unparseable.
const defaultPlatformCutPercent = 10.0

type IFantasyPayoutService interface {
	// User
	GetWallet(ctx context.Context, userID string) (*dto.WalletResponse, error)
	RequestPayout(ctx context.Context, userID string, req dto.CreatePayoutRequest) (*dto.PayoutRequestResponse, error)
	ListMyPayouts(ctx context.Context, userID string) ([]dto.PayoutRequestResponse, error)
	CancelPayout(ctx context.Context, userID, payoutID string) (*dto.PayoutRequestResponse, error)

	// Admin — payouts
	ListPayoutRequests(ctx context.Context, status string, page, limit int) ([]dto.PayoutRequestResponse, int, error)
	UpdatePayoutStatus(ctx context.Context, adminUserID, payoutID string, req dto.UpdatePayoutStatusRequest) (*dto.PayoutRequestResponse, error)

	// Admin — oversight
	GetOverview(ctx context.Context, seasonID string) (*dto.AdminFantasyOverview, error)
	ListManagers(ctx context.Context, seasonID, search string, page, limit int) ([]dto.AdminManagerRow, int, error)
	ListLeagueMembers(ctx context.Context, leagueID string) ([]dto.AdminLeagueMemberRow, error)
	ListAllLeagues(ctx context.Context, seasonID, search string, page, limit int) ([]dto.AdminLeagueRow, int, error)
	GetLeagueFinance(ctx context.Context, leagueID string) (*dto.LeagueFinanceResponse, error)

	// Admin — prizes & settlement
	SetPrizeStructure(ctx context.Context, leagueID string, req dto.SetPrizeStructureRequest) (*dto.LeagueFinanceResponse, error)
	SettleLeague(ctx context.Context, adminUserID, leagueID string) (*dto.SettlementResultResponse, error)
	SettleSeason(ctx context.Context, adminUserID, seasonID string) (*dto.SettlementResultResponse, error)
	CompleteSeason(ctx context.Context, adminUserID, seasonID string) (*dto.SettlementResultResponse, error)
	GetWalletForUser(ctx context.Context, userID string) (*dto.WalletResponse, error)
}

type FantasyPayoutService struct {
	repo        ports.IFantasyPayoutRepository
	leagueRepo  ports.IFantasyLeagueRepository
	fantasyRepo ports.IFantasyRepository
	settings    ports.IAppSettingRepository
}

func NewFantasyPayoutService(
	repo ports.IFantasyPayoutRepository,
	leagueRepo ports.IFantasyLeagueRepository,
	fantasyRepo ports.IFantasyRepository,
	settings ports.IAppSettingRepository,
) IFantasyPayoutService {
	return &FantasyPayoutService{
		repo:        repo,
		leagueRepo:  leagueRepo,
		fantasyRepo: fantasyRepo,
		settings:    settings,
	}
}

// platformCutPercent reads the configured cut, falling back to the default when
// unset. A malformed or out-of-range value falls back rather than failing, so a
// bad setting can never block a settlement.
func (s *FantasyPayoutService) platformCutPercent(ctx context.Context) float64 {
	raw, err := s.settings.Get(ctx, SettingPlatformCutPercent)
	if err != nil || strings.TrimSpace(raw) == "" {
		return defaultPlatformCutPercent
	}
	v, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil || v < 0 || v > 100 {
		return defaultPlatformCutPercent
	}
	return v
}

// ─── User wallet ──────────────────────────────────────────────────────────────

func (s *FantasyPayoutService) GetWallet(ctx context.Context, userID string) (*dto.WalletResponse, error) {
	return s.GetWalletForUser(ctx, userID)
}

func (s *FantasyPayoutService) GetWalletForUser(ctx context.Context, userID string) (*dto.WalletResponse, error) {
	wallet, err := s.repo.GetWallet(ctx, userID)
	if err != nil {
		return nil, err
	}
	txs, err := s.repo.ListWalletTransactions(ctx, userID, 50)
	if err != nil {
		return nil, err
	}
	pending, err := s.repo.SumPendingPayouts(ctx, userID)
	if err != nil {
		return nil, err
	}
	won, paid, err := s.repo.SumUserLifetime(ctx, userID)
	if err != nil {
		return nil, err
	}
	bank, err := s.repo.GetLastBankDetails(ctx, userID)
	if err != nil {
		return nil, err
	}

	items := make([]dto.WalletTransactionResponse, 0, len(txs))
	for _, t := range txs {
		item := dto.WalletTransactionResponse{
			ID:          t.ID,
			AmountKobo:  t.AmountKobo,
			Type:        string(t.Type),
			LeagueName:  t.LeagueName,
			Description: t.Description,
			CreatedAt:   t.CreatedAt.Format(time.RFC3339),
		}
		if t.LeagueID != nil {
			item.LeagueID = *t.LeagueID
		}
		items = append(items, item)
	}

	return &dto.WalletResponse{
		BalanceKobo:       wallet.BalanceKobo,
		PendingPayoutKobo: pending,
		LifetimeWonKobo:   won,
		LifetimePaidKobo:  paid,
		MinPayoutKobo:     domain.MinPayoutKobo,
		CanRequestPayout:  wallet.BalanceKobo >= domain.MinPayoutKobo,
		LastBankDetails:   bank,
		Transactions:      items,
	}, nil
}

func (s *FantasyPayoutService) RequestPayout(ctx context.Context, userID string, req dto.CreatePayoutRequest) (*dto.PayoutRequestResponse, error) {
	if req.AmountKobo < domain.MinPayoutKobo {
		return nil, fmt.Errorf("the minimum payout is %s", formatNaira(domain.MinPayoutKobo))
	}

	accountNumber := strings.TrimSpace(req.AccountNumber)
	// Nigerian NUBAN account numbers are 10 digits; reject obvious typos here
	// rather than discovering them at transfer time.
	if !isAllDigits(accountNumber) {
		return nil, errors.New("account number must contain digits only")
	}

	payout := &domain.PayoutRequest{
		UserID:        userID,
		AmountKobo:    req.AmountKobo,
		BankName:      strings.TrimSpace(req.BankName),
		AccountNumber: accountNumber,
		AccountName:   strings.TrimSpace(req.AccountName),
		UserNotes:     strings.TrimSpace(req.UserNotes),
	}

	if err := s.repo.CreatePayoutRequest(ctx, payout); err != nil {
		return nil, err
	}
	return payoutResponse(payout), nil
}

func (s *FantasyPayoutService) ListMyPayouts(ctx context.Context, userID string) ([]dto.PayoutRequestResponse, error) {
	list, err := s.repo.ListPayoutRequestsByUser(ctx, userID, 50)
	if err != nil {
		return nil, err
	}
	out := make([]dto.PayoutRequestResponse, 0, len(list))
	for i := range list {
		r := payoutResponse(&list[i])
		// A user shouldn't see internal operator notes on their own request.
		r.AdminNotes = ""
		out = append(out, *r)
	}
	return out, nil
}

// CancelPayout lets a user withdraw a request that hasn't been actioned yet,
// returning the held funds to their wallet.
func (s *FantasyPayoutService) CancelPayout(ctx context.Context, userID, payoutID string) (*dto.PayoutRequestResponse, error) {
	existing, err := s.repo.GetPayoutRequestByID(ctx, payoutID)
	if err != nil {
		return nil, err
	}
	if existing == nil || existing.UserID != userID {
		return nil, errors.New("payout request not found")
	}
	if existing.Status != domain.PayoutPending {
		return nil, errors.New("this payout is already being processed and can no longer be cancelled")
	}

	updated, err := s.repo.UpdatePayoutStatus(ctx, payoutID, domain.PayoutCancelled, "Cancelled by the user", "", userID)
	if err != nil {
		return nil, err
	}
	res := payoutResponse(updated)
	res.AdminNotes = ""
	return res, nil
}

// ─── Admin payouts ────────────────────────────────────────────────────────────

func (s *FantasyPayoutService) ListPayoutRequests(ctx context.Context, status string, page, limit int) ([]dto.PayoutRequestResponse, int, error) {
	list, total, err := s.repo.ListPayoutRequests(ctx, status, page, limit)
	if err != nil {
		return nil, 0, err
	}
	out := make([]dto.PayoutRequestResponse, 0, len(list))
	for i := range list {
		out = append(out, *payoutResponse(&list[i]))
	}
	return out, total, nil
}

func (s *FantasyPayoutService) UpdatePayoutStatus(ctx context.Context, adminUserID, payoutID string, req dto.UpdatePayoutStatusRequest) (*dto.PayoutRequestResponse, error) {
	to := domain.PayoutStatus(req.Status)

	// A completed transfer without its bank reference is untraceable later.
	if to == domain.PayoutPaid && strings.TrimSpace(req.PaymentReference) == "" {
		return nil, errors.New("record the bank transfer reference when marking a payout as paid")
	}

	updated, err := s.repo.UpdatePayoutStatus(ctx, payoutID, to,
		strings.TrimSpace(req.AdminNotes), strings.TrimSpace(req.PaymentReference), adminUserID)
	if err != nil {
		return nil, err
	}
	return payoutResponse(updated), nil
}

// ─── Admin oversight ──────────────────────────────────────────────────────────

func (s *FantasyPayoutService) GetOverview(ctx context.Context, seasonID string) (*dto.AdminFantasyOverview, error) {
	overview, err := s.repo.GetSeasonFinance(ctx, seasonID)
	if err != nil {
		return nil, err
	}

	cut := s.platformCutPercent(ctx)
	overview.CutPercent = cut
	// Gross is booked money; the split is what it would break down to.
	overview.PlatformCutKobo, overview.PrizePoolKobo = domain.SplitPool(overview.GrossEntryKobo, cut)
	return overview, nil
}

func (s *FantasyPayoutService) ListManagers(ctx context.Context, seasonID, search string, page, limit int) ([]dto.AdminManagerRow, int, error) {
	return s.repo.ListManagers(ctx, seasonID, search, page, limit)
}

func (s *FantasyPayoutService) ListLeagueMembers(ctx context.Context, leagueID string) ([]dto.AdminLeagueMemberRow, error) {
	return s.repo.ListLeagueMembers(ctx, leagueID)
}

func (s *FantasyPayoutService) ListAllLeagues(ctx context.Context, seasonID, search string, page, limit int) ([]dto.AdminLeagueRow, int, error) {
	return s.repo.ListAllLeagues(ctx, seasonID, search, page, limit)
}

// GetLeagueFinance shows a league's money position: what was collected, the
// split, and how the pool would be distributed on current standings.
func (s *FantasyPayoutService) GetLeagueFinance(ctx context.Context, leagueID string) (*dto.LeagueFinanceResponse, error) {
	league, err := s.leagueRepo.GetLeagueByID(ctx, leagueID)
	if err != nil {
		return nil, err
	}
	if league == nil {
		return nil, errors.New("league not found")
	}

	paid, pending, err := s.repo.CountPaidMembers(ctx, leagueID)
	if err != nil {
		return nil, err
	}

	cut := s.platformCutPercent(ctx)
	gross := int64(league.EntryFee) * int64(paid)
	cutKobo, poolKobo := domain.SplitPool(gross, cut)

	// Once settled, report what actually happened rather than a fresh estimate.
	if league.SettledAt != nil {
		gross, cutKobo, poolKobo = league.GrossEntryKobo, league.PlatformCutKobo, league.PrizePoolKobo
	}

	tiers, err := s.repo.GetPrizeStructure(ctx, leagueID)
	if err != nil {
		return nil, err
	}
	if len(tiers) == 0 {
		tiers = domain.DefaultPrizeStructure
	}

	standings, err := s.repo.GetLeagueStandings(ctx, leagueID)
	if err != nil {
		return nil, err
	}

	structure := make([]dto.PrizeTierResponse, 0, len(tiers))
	for _, t := range tiers {
		structure = append(structure, dto.PrizeTierResponse{
			Rank:       t.Rank,
			Percent:    t.Percent,
			AmountKobo: poolKobo * int64(t.Percent*1000) / 100000,
		})
	}

	res := &dto.LeagueFinanceResponse{
		LeagueID:        league.ID,
		LeagueName:      league.Name,
		Type:            string(league.Type),
		EntryFeeKobo:    int64(league.EntryFee),
		PaidMembers:     paid,
		PendingMembers:  pending,
		GrossEntryKobo:  gross,
		PlatformCutKobo: cutKobo,
		PrizePoolKobo:   poolKobo,
		CutPercent:      cut,
		Settled:         league.SettledAt != nil,
		PrizeStructure:  structure,
		Awards:          domain.DistributePrizes(standings, poolKobo, tiers),
	}
	if league.SettledAt != nil {
		res.SettledAt = league.SettledAt.Format(time.RFC3339)
	}
	return res, nil
}

// ─── Prizes & settlement ──────────────────────────────────────────────────────

func (s *FantasyPayoutService) SetPrizeStructure(ctx context.Context, leagueID string, req dto.SetPrizeStructureRequest) (*dto.LeagueFinanceResponse, error) {
	tiers := make([]domain.PrizeTier, 0, len(req.Tiers))
	for _, t := range req.Tiers {
		tiers = append(tiers, domain.PrizeTier{Rank: t.Rank, Percent: t.Percent})
	}
	if err := domain.ValidatePrizeStructure(tiers); err != nil {
		return nil, err
	}
	if err := s.repo.SetPrizeStructure(ctx, leagueID, tiers); err != nil {
		return nil, err
	}
	return s.GetLeagueFinance(ctx, leagueID)
}

// SettleLeague distributes a paid league's prize pool into winners' wallets.
// It runs exactly once per league — the repository refuses a second attempt.
func (s *FantasyPayoutService) SettleLeague(ctx context.Context, adminUserID, leagueID string) (*dto.SettlementResultResponse, error) {
	league, err := s.leagueRepo.GetLeagueByID(ctx, leagueID)
	if err != nil {
		return nil, err
	}
	if league == nil {
		return nil, errors.New("league not found")
	}
	if league.EntryFee <= 0 {
		return nil, errors.New("this is a free league, so there is no prize money to settle")
	}
	if league.SettledAt != nil {
		return nil, ports.ErrAlreadySettled
	}

	result, err := s.settleOne(ctx, adminUserID, *league)
	if err != nil {
		return nil, err
	}
	return result, nil
}

// SettleSeason settles every unsettled paid league in a season. This is what
// runs when a season is completed, so prize money lands automatically.
func (s *FantasyPayoutService) SettleSeason(ctx context.Context, adminUserID, seasonID string) (*dto.SettlementResultResponse, error) {
	leagues, err := s.repo.ListUnsettledPaidLeagues(ctx, seasonID)
	if err != nil {
		return nil, err
	}

	combined := &dto.SettlementResultResponse{}
	var failures []error
	for _, l := range leagues {
		one, err := s.settleOne(ctx, adminUserID, l)
		if err != nil {
			// One league failing must not abandon the rest; each settles in its
			// own transaction.
			if errors.Is(err, ports.ErrAlreadySettled) {
				combined.LeaguesSkipped++
				continue
			}
			failures = append(failures, fmt.Errorf("%s: %w", l.Name, err))
			continue
		}
		combined.LeaguesSettled += one.LeaguesSettled
		combined.LeaguesSkipped += one.LeaguesSkipped
		combined.TotalAwardedKobo += one.TotalAwardedKobo
		combined.PlatformCutKobo += one.PlatformCutKobo
		combined.Awards = append(combined.Awards, one.Awards...)
	}

	if len(failures) > 0 {
		return combined, fmt.Errorf("some leagues could not be settled: %w", errors.Join(failures...))
	}
	return combined, nil
}

// CompleteSeason closes a season: every unsettled paid league pays out, then
// the season is marked COMPLETED. Settlement runs first deliberately — if any
// league fails to settle, the season stays open so the problem is visible and
// fixable rather than being sealed behind a COMPLETED status.
func (s *FantasyPayoutService) CompleteSeason(ctx context.Context, adminUserID, seasonID string) (*dto.SettlementResultResponse, error) {
	season, err := s.fantasyRepo.GetSeasonByID(ctx, seasonID)
	if err != nil {
		return nil, err
	}
	if season == nil {
		return nil, errors.New("season not found")
	}
	if season.Status == domain.FantasySeasonCompleted {
		return nil, errors.New("this season is already completed")
	}

	result, err := s.SettleSeason(ctx, adminUserID, seasonID)
	if err != nil {
		return result, err
	}

	if err := s.fantasyRepo.UpdateSeasonStatus(ctx, seasonID, domain.FantasySeasonCompleted); err != nil {
		return result, fmt.Errorf("prizes were settled, but the season could not be marked completed: %w", err)
	}
	return result, nil
}

func (s *FantasyPayoutService) settleOne(ctx context.Context, adminUserID string, league domain.FantasyLeague) (*dto.SettlementResultResponse, error) {
	paid, _, err := s.repo.CountPaidMembers(ctx, league.ID)
	if err != nil {
		return nil, err
	}

	gross := int64(league.EntryFee) * int64(paid)
	cutKobo, poolKobo := domain.SplitPool(gross, s.platformCutPercent(ctx))

	// A league nobody paid into still gets stamped settled, so it stops
	// appearing in the outstanding queue.
	if poolKobo <= 0 {
		if err := s.repo.SettleLeague(ctx, league.ID, gross, cutKobo, poolKobo, nil, adminUserID); err != nil {
			return nil, err
		}
		return &dto.SettlementResultResponse{LeaguesSettled: 1}, nil
	}

	tiers, err := s.repo.GetPrizeStructure(ctx, league.ID)
	if err != nil {
		return nil, err
	}
	if len(tiers) == 0 {
		tiers = domain.DefaultPrizeStructure
	}

	standings, err := s.repo.GetLeagueStandings(ctx, league.ID)
	if err != nil {
		return nil, err
	}

	awards := domain.DistributePrizes(standings, poolKobo, tiers)
	if err := s.repo.SettleLeague(ctx, league.ID, gross, cutKobo, poolKobo, awards, adminUserID); err != nil {
		return nil, err
	}

	var awarded int64
	for _, a := range awards {
		awarded += a.AmountKobo
	}
	return &dto.SettlementResultResponse{
		LeaguesSettled:   1,
		TotalAwardedKobo: awarded,
		PlatformCutKobo:  cutKobo,
		Awards:           awards,
	}, nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func payoutResponse(p *domain.PayoutRequest) *dto.PayoutRequestResponse {
	res := &dto.PayoutRequestResponse{
		ID:               p.ID,
		UserID:           p.UserID,
		UserName:         p.UserName,
		UserEmail:        p.UserEmail,
		AmountKobo:       p.AmountKobo,
		Status:           string(p.Status),
		BankName:         p.BankName,
		AccountNumber:    p.AccountNumber,
		AccountName:      p.AccountName,
		UserNotes:        p.UserNotes,
		AdminNotes:       p.AdminNotes,
		PaymentReference: p.PaymentReference,
		CreatedAt:        p.CreatedAt.Format(time.RFC3339),
	}
	if p.ProcessedAt != nil {
		res.ProcessedAt = p.ProcessedAt.Format(time.RFC3339)
	}
	return res
}

func formatNaira(kobo int64) string {
	return fmt.Sprintf("₦%.2f", float64(kobo)/100)
}

func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
