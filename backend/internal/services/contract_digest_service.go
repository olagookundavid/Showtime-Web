package services

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"showtime-backend/internal/ports"
	"showtime-backend/pkg/email"
)

// IContractDigestService tells people which contracts are about to run out.
//
// Team managers hear about their own squad as soon as something changes (a player
// enters the last three matches, or a contract expires). Commissioners get one
// league-wide summary a week.
type IContractDigestService interface {
	NotifyTeams(ctx context.Context, teamIDs []string) error
	SendLeagueDigest(ctx context.Context) error
}

const (
	// teamExpiredLookback keeps a just-expired player in the team summary for two
	// weeks, long enough to re-sign them, without listing last season's leavers.
	teamExpiredLookback = 14 * 24 * time.Hour
	// leagueExpiredLookback matches the weekly cadence of the commissioners' digest.
	leagueExpiredLookback = 7 * 24 * time.Hour
)

type ContractDigestService struct {
	repo     ports.IContractDigestRepository
	email    ports.EmailService
	notifs   INotificationService
	settings IAppSettingService
	now      func() time.Time
}

func NewContractDigestService(repo ports.IContractDigestRepository, emailSvc ports.EmailService, notifs INotificationService, settings IAppSettingService) IContractDigestService {
	return &ContractDigestService{repo: repo, email: emailSvc, notifs: notifs, settings: settings, now: time.Now}
}

func frontendURL(path string) string {
	base := os.Getenv("FRONTEND_URL")
	if base == "" {
		base = "http://localhost:5173"
	}
	return strings.TrimRight(base, "/") + path
}

func toEmailRows(rows []ports.ExpiringContract) []email.ExpiringPlayer {
	out := make([]email.ExpiringPlayer, 0, len(rows))
	for _, r := range rows {
		p := email.ExpiringPlayer{
			Name:         r.PlayerName,
			Position:     r.Position,
			Remaining:    r.Remaining,
			Expired:      r.ExpiredAt != nil,
			HasAccount:   r.HasAccount,
			OfferPending: r.OfferPending,
		}
		if r.ExpiredAt != nil {
			p.ExpiredOn = r.ExpiredAt.In(lagos()).Format("Mon 2 Jan")
		}
		out = append(out, p)
	}
	return out
}

// NotifyTeams sends each team's managers a summary of their at-risk and recently
// expired players, by email and in-app notification. Teams with nothing to report
// are skipped.
func (s *ContractDigestService) NotifyTeams(ctx context.Context, teamIDs []string) error {
	var firstErr error
	for _, teamID := range teamIDs {
		if err := s.notifyTeam(ctx, teamID); err != nil {
			log.Printf("[contract digest] team %s: %v", teamID, err)
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	return firstErr
}

func (s *ContractDigestService) notifyTeam(ctx context.Context, teamID string) error {
	if !s.settings.NotificationSettings(ctx).TeamSummariesEnabled {
		return nil
	}
	warn := s.settings.ContractSettings(ctx).WarningMatches
	rows, err := s.repo.ListExpiring(ctx, []string{teamID}, warn, s.now().Add(-teamExpiredLookback))
	if err != nil {
		return fmt.Errorf("list expiring contracts: %w", err)
	}
	if len(rows) == 0 {
		return nil
	}
	managers, err := s.repo.TeamManagers(ctx, teamID)
	if err != nil {
		return fmt.Errorf("list team managers: %w", err)
	}

	teamName := rows[0].TeamName
	players := toEmailRows(rows)
	expired, expiring := email.CountExpiring(players)
	line := email.ExpirySummaryLine(expired, expiring)
	subject := fmt.Sprintf("%s: contracts running out (%s)", teamName, line)
	link := frontendURL("/team-head/contracts")

	for _, m := range managers {
		if s.notifs != nil {
			_ = s.notifs.Send(ctx, m.UserID, "CONTRACT_EXPIRY_SUMMARY", "Contracts running out",
				fmt.Sprintf("%s: %s. Open Contracts to extend or re-sign them.", teamName, line), "contract", nil)
		}
		if s.email != nil && m.Email != "" {
			html := email.TeamContractExpiryEmailHTML(email.TeamExpiryEmailData{
				ManagerName: m.Name, TeamName: teamName, Players: players, ContractsURL: link,
			})
			if err := s.email.SendEmail(m.Email, subject, html); err != nil {
				log.Printf("[contract digest] email to team %s manager %s failed: %v", teamName, m.UserID, err)
			}
		}
	}
	return nil
}

// SendLeagueDigest sends every commissioner the league-wide summary. Nothing is
// sent in a week with nothing to report.
func (s *ContractDigestService) SendLeagueDigest(ctx context.Context) error {
	ns := s.settings.NotificationSettings(ctx)
	if !ns.LeagueDigestEnabled || len(ns.LeagueDigestRecipientIDs) == 0 {
		return nil
	}
	warn := s.settings.ContractSettings(ctx).WarningMatches
	rows, err := s.repo.ListExpiring(ctx, nil, warn, s.now().Add(-leagueExpiredLookback))
	if err != nil {
		return fmt.Errorf("list expiring contracts: %w", err)
	}
	if len(rows) == 0 {
		return nil
	}
	recipients, err := s.repo.UsersByIDs(ctx, ns.LeagueDigestRecipientIDs)
	if err != nil {
		return fmt.Errorf("list digest recipients: %w", err)
	}

	// Rows arrive ordered by team, so consecutive rows share a block.
	var teams []email.LeagueExpiryTeam
	for _, r := range rows {
		if len(teams) == 0 || teams[len(teams)-1].TeamName != r.TeamName {
			teams = append(teams, email.LeagueExpiryTeam{TeamName: r.TeamName})
		}
		t := &teams[len(teams)-1]
		t.Players = append(t.Players, toEmailRows([]ports.ExpiringContract{r})...)
	}
	expired, expiring := email.CountExpiring(toEmailRows(rows))
	line := email.ExpirySummaryLine(expired, expiring)
	subject := fmt.Sprintf("Weekly contract summary: %s across %d team%s", line, len(teams), map[bool]string{true: "", false: "s"}[len(teams) == 1])
	link := frontendURL("/admin/contracts")

	for _, r := range recipients {
		if s.notifs != nil {
			_ = s.notifs.Send(ctx, r.UserID, "CONTRACT_EXPIRY_SUMMARY", "Weekly contract summary",
				fmt.Sprintf("%s across %d team(s). Check your email for the full list.", line, len(teams)), "contract", nil)
		}
		if s.email != nil && r.Email != "" {
			html := email.LeagueContractExpiryEmailHTML(email.LeagueExpiryEmailData{
				RecipientName: r.Name, Teams: teams, ContractsURL: link,
			})
			if err := s.email.SendEmail(r.Email, subject, html); err != nil {
				log.Printf("[contract digest] league digest to %s failed: %v", r.UserID, err)
			}
		}
	}
	return nil
}
