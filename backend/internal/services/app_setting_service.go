package services

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

const (
	// SettingKeyAppFont is the site-wide font every client reads on boot.
	SettingKeyAppFont = "app_font_id"
	// DefaultAppFontID must stay in step with the default entry in the
	// frontend font catalogue (frontend/src/contexts/FontContext.tsx).
	DefaultAppFontID = "georgia"

	SettingContractDefaultLength    = "contract_default_length"
	SettingContractOnboardingLength = "contract_onboarding_length"
	SettingContractWarningMatches   = "contract_warning_matches"
	SettingTeamSummariesEnabled     = "contract_team_summaries_enabled"
	SettingLeagueDigestEnabled      = "contract_league_digest_enabled"
	SettingLeagueDigestRecipients   = "contract_digest_recipients"

	maxDigestRecipients = 20
	// maxPlatformCutPercent keeps a typo (25 for 2.5) from taking a large share of
	// every paid league. The service itself would accept up to 100.
	maxPlatformCutPercent = 50
)

// Font ids are catalogue lookup keys, never CSS. Constraining them to a slug
// keeps junk out of the table without duplicating the font list back here — an
// id the frontend doesn't recognise simply falls back to the default there.
var fontIDPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// NotificationSettings are the switches and recipients behind the contract emails.
type NotificationSettings struct {
	TeamSummariesEnabled bool
	LeagueDigestEnabled  bool
	// LeagueDigestRecipientIDs are user ids; they are resolved to people at send time.
	LeagueDigestRecipientIDs []string
}

type IAppSettingService interface {
	GetSettings(ctx context.Context) (*dto.AppSettingsResponse, error)
	UpdateAppFont(ctx context.Context, fontID string) (*dto.AppSettingsResponse, error)

	// ContractSettings and NotificationSettings never fail: a setting that is unset,
	// malformed or unreadable falls back to its default, so a bad value can't stop a
	// contract being issued or an expiry being processed.
	ContractSettings(ctx context.Context) domain.ContractSettings
	NotificationSettings(ctx context.Context) NotificationSettings

	GetAdminSettings(ctx context.Context) (*dto.AdminSettingsResponse, error)
	UpdateContractSettings(ctx context.Context, in dto.ContractSettingsDTO) error
	UpdateNotificationSettings(ctx context.Context, in dto.UpdateNotificationSettingsRequest) error
	UpdateFantasySettings(ctx context.Context, in dto.FantasySettingsDTO) error
	SearchStaff(ctx context.Context, search string) ([]dto.SettingsUser, error)
}

type AppSettingService struct {
	repo  ports.IAppSettingRepository
	users ports.IContractDigestRepository
}

func NewAppSettingService(repo ports.IAppSettingRepository, users ports.IContractDigestRepository) IAppSettingService {
	return &AppSettingService{repo: repo, users: users}
}

func (s *AppSettingService) GetSettings(ctx context.Context) (*dto.AppSettingsResponse, error) {
	fontID, err := s.repo.Get(ctx, SettingKeyAppFont)
	if err != nil {
		return nil, err
	}
	if fontID == "" {
		fontID = DefaultAppFontID
	}
	return &dto.AppSettingsResponse{
		AppFontID:             fontID,
		DefaultContractLength: s.ContractSettings(ctx).DefaultLength,
	}, nil
}

func (s *AppSettingService) UpdateAppFont(ctx context.Context, fontID string) (*dto.AppSettingsResponse, error) {
	if len(fontID) > 40 || !fontIDPattern.MatchString(fontID) {
		return nil, fmt.Errorf("invalid font id")
	}

	if err := s.repo.Set(ctx, SettingKeyAppFont, fontID); err != nil {
		return nil, err
	}
	return s.GetSettings(ctx)
}

// intSetting reads an integer in [min, max], or fallback when unset, malformed or out of range.
func (s *AppSettingService) intSetting(ctx context.Context, key string, fallback, min, max int) int {
	raw, err := s.repo.Get(ctx, key)
	if err != nil {
		return fallback
	}
	v, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || v < min || v > max {
		return fallback
	}
	return v
}

func (s *AppSettingService) boolSetting(ctx context.Context, key string, fallback bool) bool {
	raw, err := s.repo.Get(ctx, key)
	if err != nil {
		return fallback
	}
	switch strings.TrimSpace(raw) {
	case "true":
		return true
	case "false":
		return false
	}
	return fallback
}

func (s *AppSettingService) ContractSettings(ctx context.Context) domain.ContractSettings {
	d := domain.DefaultContractSettings()
	return domain.ContractSettings{
		DefaultLength:    s.intSetting(ctx, SettingContractDefaultLength, d.DefaultLength, 1, 50),
		OnboardingLength: s.intSetting(ctx, SettingContractOnboardingLength, d.OnboardingLength, 1, 50),
		WarningMatches:   s.intSetting(ctx, SettingContractWarningMatches, d.WarningMatches, 1, 10),
	}
}

func (s *AppSettingService) NotificationSettings(ctx context.Context) NotificationSettings {
	ns := NotificationSettings{
		TeamSummariesEnabled: s.boolSetting(ctx, SettingTeamSummariesEnabled, true),
		LeagueDigestEnabled:  s.boolSetting(ctx, SettingLeagueDigestEnabled, true),
	}
	if raw, err := s.repo.Get(ctx, SettingLeagueDigestRecipients); err == nil && strings.TrimSpace(raw) != "" {
		var ids []string
		if json.Unmarshal([]byte(raw), &ids) == nil {
			ns.LeagueDigestRecipientIDs = ids
		}
	}
	return ns
}

func (s *AppSettingService) platformCutPercent(ctx context.Context) float64 {
	raw, err := s.repo.Get(ctx, SettingPlatformCutPercent)
	if err != nil || strings.TrimSpace(raw) == "" {
		return defaultPlatformCutPercent
	}
	v, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil || v < 0 || v > 100 {
		return defaultPlatformCutPercent
	}
	return v
}

func toSettingsUser(d ports.DigestRecipient) dto.SettingsUser {
	return dto.SettingsUser{UserID: d.UserID, Name: d.Name, Email: d.Email, Role: d.Role}
}

func (s *AppSettingService) GetAdminSettings(ctx context.Context) (*dto.AdminSettingsResponse, error) {
	cs := s.ContractSettings(ctx)
	ns := s.NotificationSettings(ctx)

	recipients := []dto.SettingsUser{}
	if len(ns.LeagueDigestRecipientIDs) > 0 {
		people, err := s.users.UsersByIDs(ctx, ns.LeagueDigestRecipientIDs)
		if err != nil {
			return nil, err
		}
		for _, p := range people {
			recipients = append(recipients, toSettingsUser(p))
		}
	}

	return &dto.AdminSettingsResponse{
		Contracts: dto.ContractSettingsDTO{
			DefaultLength:    cs.DefaultLength,
			OnboardingLength: cs.OnboardingLength,
			WarningMatches:   cs.WarningMatches,
		},
		Notifications: dto.NotificationSettingsDTO{
			TeamSummariesEnabled:   ns.TeamSummariesEnabled,
			LeagueDigestEnabled:    ns.LeagueDigestEnabled,
			LeagueDigestRecipients: recipients,
		},
		Fantasy: dto.FantasySettingsDTO{PlatformCutPercent: s.platformCutPercent(ctx)},
	}, nil
}

func (s *AppSettingService) UpdateContractSettings(ctx context.Context, in dto.ContractSettingsDTO) error {
	if in.DefaultLength < 1 || in.DefaultLength > 50 {
		return fmt.Errorf("the default contract length must be between 1 and 50 matches")
	}
	if in.OnboardingLength < 1 || in.OnboardingLength > 50 {
		return fmt.Errorf("the first-contract length must be between 1 and 50 matches")
	}
	if in.WarningMatches < 1 || in.WarningMatches > 10 {
		return fmt.Errorf("the warning period must be between 1 and 10 matches")
	}
	for key, v := range map[string]int{
		SettingContractDefaultLength:    in.DefaultLength,
		SettingContractOnboardingLength: in.OnboardingLength,
		SettingContractWarningMatches:   in.WarningMatches,
	} {
		if err := s.repo.Set(ctx, key, strconv.Itoa(v)); err != nil {
			return err
		}
	}
	return nil
}

func (s *AppSettingService) UpdateNotificationSettings(ctx context.Context, in dto.UpdateNotificationSettingsRequest) error {
	seen := map[string]bool{}
	ids := make([]string, 0, len(in.LeagueDigestRecipients))
	for _, id := range in.LeagueDigestRecipients {
		id = strings.TrimSpace(id)
		if id != "" && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	if len(ids) > maxDigestRecipients {
		return fmt.Errorf("choose at most %d recipients", maxDigestRecipients)
	}

	// Only real staff accounts can be chosen: the page lists nobody else, so this
	// refuses a hand-made request rather than a mistake in the UI.
	if len(ids) > 0 {
		people, err := s.users.UsersByIDs(ctx, ids)
		if err != nil {
			return err
		}
		if len(people) != len(ids) {
			return fmt.Errorf("one of the chosen people no longer exists")
		}
		for _, p := range people {
			switch p.Role {
			case "user", "player", "player_pending":
				return fmt.Errorf("%s isn't a staff member, so they can't receive the league summary", p.Name)
			}
		}
	}

	encoded, err := json.Marshal(ids)
	if err != nil {
		return err
	}
	for key, val := range map[string]string{
		SettingTeamSummariesEnabled:   strconv.FormatBool(in.TeamSummariesEnabled),
		SettingLeagueDigestEnabled:    strconv.FormatBool(in.LeagueDigestEnabled),
		SettingLeagueDigestRecipients: string(encoded),
	} {
		if err := s.repo.Set(ctx, key, val); err != nil {
			return err
		}
	}
	return nil
}

func (s *AppSettingService) UpdateFantasySettings(ctx context.Context, in dto.FantasySettingsDTO) error {
	v := in.PlatformCutPercent
	if math.IsNaN(v) || v < 0 || v > maxPlatformCutPercent {
		return fmt.Errorf("the platform cut must be between 0 and %d percent", maxPlatformCutPercent)
	}
	v = math.Round(v*100) / 100
	return s.repo.Set(ctx, SettingPlatformCutPercent, strconv.FormatFloat(v, 'f', -1, 64))
}

func (s *AppSettingService) SearchStaff(ctx context.Context, search string) ([]dto.SettingsUser, error) {
	people, err := s.users.SearchStaffUsers(ctx, strings.TrimSpace(search), 20)
	if err != nil {
		return nil, err
	}
	out := make([]dto.SettingsUser, 0, len(people))
	for _, p := range people {
		out = append(out, toSettingsUser(p))
	}
	return out, nil
}
