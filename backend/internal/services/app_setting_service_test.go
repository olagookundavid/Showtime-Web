package services

import (
	"context"
	"strings"
	"testing"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type memSettings struct{ m map[string]string }

func (r *memSettings) Get(_ context.Context, k string) (string, error) { return r.m[k], nil }
func (r *memSettings) Set(_ context.Context, k, v string) error {
	r.m[k] = v
	return nil
}

type fakeUsers struct {
	ports.IContractDigestRepository
	byID map[string]ports.DigestRecipient
}

func (f *fakeUsers) UsersByIDs(_ context.Context, ids []string) ([]ports.DigestRecipient, error) {
	var out []ports.DigestRecipient
	for _, id := range ids {
		if u, ok := f.byID[id]; ok {
			out = append(out, u)
		}
	}
	return out, nil
}

func newSettingsSvc(initial map[string]string) (IAppSettingService, *memSettings) {
	repo := &memSettings{m: map[string]string{}}
	for k, v := range initial {
		repo.m[k] = v
	}
	users := &fakeUsers{byID: map[string]ports.DigestRecipient{
		"staff":  {UserID: "staff", Name: "Ade", Email: "ade@x.com", Role: "commissioner"},
		"player": {UserID: "player", Name: "Pat", Email: "pat@x.com", Role: "player"},
	}}
	return NewAppSettingService(repo, users), repo
}

func TestContractSettingsFallBackToDefaults(t *testing.T) {
	// unset, malformed and out-of-range values must never reach a contract
	svc, _ := newSettingsSvc(map[string]string{
		SettingContractDefaultLength:    "abc",
		SettingContractOnboardingLength: "0",
		SettingContractWarningMatches:   "99",
	})
	got := svc.ContractSettings(context.Background())
	if got.DefaultLength != 13 || got.OnboardingLength != 10 || got.WarningMatches != 3 {
		t.Fatalf("expected defaults 13/10/3, got %+v", got)
	}
}

func TestContractSettingsUseStoredValues(t *testing.T) {
	svc, _ := newSettingsSvc(map[string]string{
		SettingContractDefaultLength:  "20",
		SettingContractWarningMatches: "4",
	})
	got := svc.ContractSettings(context.Background())
	if got.DefaultLength != 20 || got.WarningMatches != 4 || got.OnboardingLength != 10 {
		t.Fatalf("got %+v", got)
	}
}

func TestUpdateContractSettingsRejectsOutOfRange(t *testing.T) {
	svc, repo := newSettingsSvc(nil)
	for _, in := range []dto.ContractSettingsDTO{
		{DefaultLength: 0, OnboardingLength: 10, WarningMatches: 3},
		{DefaultLength: 13, OnboardingLength: 51, WarningMatches: 3},
		{DefaultLength: 13, OnboardingLength: 10, WarningMatches: 11},
	} {
		if err := svc.UpdateContractSettings(context.Background(), in); err == nil {
			t.Fatalf("expected %+v to be rejected", in)
		}
	}
	if len(repo.m) != 0 {
		t.Fatalf("a rejected update must write nothing, wrote %v", repo.m)
	}
}

func TestNotificationDefaultsAreOnWithNoRecipients(t *testing.T) {
	svc, _ := newSettingsSvc(nil)
	ns := svc.NotificationSettings(context.Background())
	if !ns.TeamSummariesEnabled || !ns.LeagueDigestEnabled || len(ns.LeagueDigestRecipientIDs) != 0 {
		t.Fatalf("got %+v", ns)
	}
}

func TestUpdateNotificationSettingsRecipients(t *testing.T) {
	ctx := context.Background()
	svc, _ := newSettingsSvc(nil)

	if err := svc.UpdateNotificationSettings(ctx, dto.UpdateNotificationSettingsRequest{LeagueDigestRecipients: []string{"player"}}); err == nil {
		t.Fatal("a plain player must not be accepted as a recipient")
	}
	if err := svc.UpdateNotificationSettings(ctx, dto.UpdateNotificationSettingsRequest{LeagueDigestRecipients: []string{"ghost"}}); err == nil {
		t.Fatal("an unknown user must not be accepted")
	}

	err := svc.UpdateNotificationSettings(ctx, dto.UpdateNotificationSettingsRequest{
		TeamSummariesEnabled:   true,
		LeagueDigestEnabled:    false,
		LeagueDigestRecipients: []string{"staff", "staff", " "},
	})
	if err != nil {
		t.Fatal(err)
	}
	ns := svc.NotificationSettings(ctx)
	if ns.LeagueDigestEnabled || !ns.TeamSummariesEnabled {
		t.Fatalf("switches not stored: %+v", ns)
	}
	if len(ns.LeagueDigestRecipientIDs) != 1 || ns.LeagueDigestRecipientIDs[0] != "staff" {
		t.Fatalf("recipients should be de-duplicated, got %v", ns.LeagueDigestRecipientIDs)
	}
}

func TestUpdateFantasyCutBounds(t *testing.T) {
	ctx := context.Background()
	svc, repo := newSettingsSvc(nil)
	for _, bad := range []float64{-1, 50.01, 250} {
		if err := svc.UpdateFantasySettings(ctx, dto.FantasySettingsDTO{PlatformCutPercent: bad}); err == nil {
			t.Fatalf("cut %v should be rejected", bad)
		}
	}
	if err := svc.UpdateFantasySettings(ctx, dto.FantasySettingsDTO{PlatformCutPercent: 2.555}); err != nil {
		t.Fatal(err)
	}
	if got := repo.m[SettingPlatformCutPercent]; !strings.HasPrefix(got, "2.5") || len(got) > 4 {
		t.Fatalf("cut should be stored rounded to 2 decimals, got %q", got)
	}
}
