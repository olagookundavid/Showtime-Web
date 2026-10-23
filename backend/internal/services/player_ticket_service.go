package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
	"showtime-backend/pkg/email"
)

// Player tickets: every player named on a team sheet gets a free ticket for that
// match's game day, with its own code. The tickets are ordinary rows in the ticket
// table, so the gate looks them up and checks them in like any other; the team
// manager and the admins print the sheet with every code on it.

var (
	ErrPlayerTicketMatchNotFound = errors.New("match not found")
	ErrTeamNotInMatch            = errors.New("that team is not playing in this match")
	ErrPlayerTicketDayNotFound   = errors.New("match day not found")
)

// playerTicketCodeAttempts is how many fresh codes are tried when one is taken.
const playerTicketCodeAttempts = 5

// teamSheetListLimit caps how many past sheets a team manager's list goes back.
const teamSheetListLimit = 40

type IPlayerTicketService interface {
	// SyncSheet brings a team sheet's tickets in line with the sheet: a ticket for
	// every player named who has none (emailed to those with an address), and the
	// ticket cancelled for anyone taken off. Codes already issued never change.
	SyncSheet(ctx context.Context, matchID, teamID string) (*dto.PlayerTicketSyncResponse, error)
	Sheet(ctx context.Context, matchID, teamID string) (*dto.PlayerTicketSheetResponse, error)
	// TeamSheets is every match a team has named a sheet for, newest first, without
	// the player rows.
	TeamSheets(ctx context.Context, teamID string) ([]dto.PlayerTicketSheetResponse, error)
	SheetDays(ctx context.Context) ([]dto.PlayerTicketDayResponse, error)
	// MyTickets is the signed-in player's own tickets. It returns
	// appErrors.ErrPlayerNotLinked when the account has no player behind it.
	MyTickets(ctx context.Context, userID string) ([]dto.MyPlayerTicket, error)
	DaySheets(ctx context.Context, eventDayID string) (*dto.PlayerTicketDaySheetsResponse, error)
}

// playerTicketNotifier sends a newly issued player ticket to the player and queues
// its match-day reminder. The ticket service does this, as it does for every ticket.
type playerTicketNotifier interface {
	SendPlayerTicket(ctx context.Context, ticket *domain.Ticket, match *ports.PlayerTicketMatch, teamName string)
}

type PlayerTicketService struct {
	repo     ports.PlayerTicketRepository
	tickets  ports.TicketRepository
	notifier playerTicketNotifier
	now      func() time.Time
}

func NewPlayerTicketService(repo ports.PlayerTicketRepository, tickets ports.TicketRepository, notifier playerTicketNotifier) *PlayerTicketService {
	return &PlayerTicketService{repo: repo, tickets: tickets, notifier: notifier, now: time.Now}
}

// teamSide is the name of the given team and of its opponent in a match. ok is
// false when the team is not playing in it.
func teamSide(m *ports.PlayerTicketMatch, teamID string) (team, opponent string, ok bool) {
	switch teamID {
	case "":
		return "", "", false
	case m.HomeTeamID:
		return m.HomeTeam, m.AwayTeam, true
	case m.AwayTeamID:
		return m.AwayTeam, m.HomeTeam, true
	}
	return "", "", false
}

// canIssuePlayerTickets says whether a match still takes new player tickets: not
// once it is finished or called off, nor once its day has passed in Lagos.
func canIssuePlayerTickets(m *ports.PlayerTicketMatch, now time.Time) bool {
	if m.Status == "FINISHED" || m.Status == "CANCELLED" {
		return false
	}
	return !dateOnly(m.Date).Before(todayLagos(now))
}

func (s *PlayerTicketService) loadMatch(ctx context.Context, matchID, teamID string) (*ports.PlayerTicketMatch, string, string, error) {
	m, err := s.repo.GetMatch(ctx, matchID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", "", ErrPlayerTicketMatchNotFound
		}
		return nil, "", "", err
	}
	team, opponent, ok := teamSide(m, teamID)
	if !ok {
		return nil, "", "", ErrTeamNotInMatch
	}
	return m, team, opponent, nil
}

// uniqueViolation says which unique constraint an insert broke, or "" if none did.
func uniqueViolation(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return pgErr.ConstraintName
	}
	return ""
}

func (s *PlayerTicketService) SyncSheet(ctx context.Context, matchID, teamID string) (*dto.PlayerTicketSyncResponse, error) {
	m, teamName, _, err := s.loadMatch(ctx, matchID, teamID)
	if err != nil {
		return nil, err
	}
	res := &dto.PlayerTicketSyncResponse{}
	// A sheet edited after the match (stats, corrections) is not a reason to hand
	// out tickets, nor to cancel the ones that were used.
	if !canIssuePlayerTickets(m, s.now()) {
		return res, nil
	}

	players, err := s.repo.SheetPlayers(ctx, matchID, teamID)
	if err != nil {
		return nil, err
	}
	live, err := s.repo.LiveTickets(ctx, matchID, teamID)
	if err != nil {
		return nil, err
	}

	onSheet := make(map[string]bool, len(players))
	for _, p := range players {
		onSheet[p.PlayerID] = true
	}
	hasTicket := make(map[string]bool, len(live))
	var dropped []string
	for _, t := range live {
		if t.PlayerID == nil || !onSheet[*t.PlayerID] {
			dropped = append(dropped, t.ID)
			continue
		}
		hasTicket[*t.PlayerID] = true
	}
	cancelled, err := s.repo.CancelUnused(ctx, dropped)
	if err != nil {
		return nil, err
	}
	res.Cancelled = int(cancelled)

	var missing []ports.SheetPlayer
	for _, p := range players {
		if !hasTicket[p.PlayerID] {
			missing = append(missing, p)
		}
	}
	if len(missing) == 0 {
		return res, nil
	}

	dayID, err := s.repo.EnsureGameDay(ctx, matchID)
	if err != nil {
		return nil, fmt.Errorf("failed to find the match day: %w", err)
	}

	// One player failing does not stop the rest: the sheet shows who is still
	// without a code, and issuing again fills the gaps.
	var firstErr error
	for _, p := range missing {
		ticket, err := s.issue(ctx, m, teamID, dayID, p)
		if err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("failed to issue a ticket for %s: %w", p.Name, err)
			}
			continue
		}
		if ticket == nil {
			continue // issued meanwhile by a save running at the same time
		}
		res.Issued++
		if ticket.Email != "" && s.notifier != nil {
			s.notifier.SendPlayerTicket(ctx, ticket, m, teamName)
			res.Emailed++
		}
	}
	if firstErr != nil {
		return res, firstErr
	}
	return res, nil
}

// issue creates one player's ticket. It returns nil, nil when the player already
// has a live ticket for the match, which only happens when two saves race.
func (s *PlayerTicketService) issue(ctx context.Context, m *ports.PlayerTicketMatch, teamID, dayID string, p ports.SheetPlayer) (*domain.Ticket, error) {
	matchID, playerID, team := m.ID, p.PlayerID, teamID
	var lastErr error
	for i := 0; i < playerTicketCodeAttempts; i++ {
		ticket := &domain.Ticket{
			ProductName:  "Player Ticket",
			PurchaseType: domain.PurchaseTypePlayer,
			Email:        p.Email,
			Name:         p.Name,
			Quantity:     1,
			Status:       domain.TicketStatusPaid,
			TicketCode:   GenerateTicketCode(),
			TeamID:       &team,
			PlayerID:     &playerID,
			MatchID:      &matchID,
			Days:         []domain.TicketDay{{EventDayID: dayID}},
		}
		err := s.tickets.Create(ctx, ticket)
		switch uniqueViolation(err) {
		case "":
			if err != nil {
				return nil, err
			}
			return ticket, nil
		case "tickets_ticket_code_key":
			lastErr = err
			continue // that code is taken; draw another
		case "idx_tickets_player_match_live":
			return nil, nil
		default:
			return nil, err
		}
	}
	return nil, fmt.Errorf("no free ticket code after %d attempts: %w", playerTicketCodeAttempts, lastErr)
}

func matchResponse(m *ports.PlayerTicketMatch) dto.PlayerTicketMatchResponse {
	return dto.PlayerTicketMatchResponse{
		ID:          m.ID,
		Date:        m.Date.Format("2006-01-02"),
		Kickoff:     m.Kickoff,
		Status:      m.Status,
		Venue:       m.Venue,
		Competition: m.Competition,
		HomeTeam:    m.HomeTeam,
		AwayTeam:    m.AwayTeam,
	}
}

// buildSheet puts a sheet's players and their tickets side by side.
func buildSheet(m *ports.PlayerTicketMatch, teamID, teamName, opponent string, players []ports.SheetPlayer, live []domain.Ticket, now time.Time) *dto.PlayerTicketSheetResponse {
	byPlayer := make(map[string]*domain.Ticket, len(live))
	for i := range live {
		if live[i].PlayerID != nil {
			byPlayer[*live[i].PlayerID] = &live[i]
		}
	}

	sheet := &dto.PlayerTicketSheetResponse{
		Match:    matchResponse(m),
		TeamID:   teamID,
		TeamName: teamName,
		Opponent: opponent,
		Players:  make([]dto.PlayerTicketRow, 0, len(players)),
		Named:    len(players),
		CanIssue: canIssuePlayerTickets(m, now),
	}
	for _, p := range players {
		row := dto.PlayerTicketRow{
			PlayerID:     p.PlayerID,
			Name:         p.Name,
			JerseyNumber: p.JerseyNumber,
			Position:     p.Position,
			IsStarter:    p.IsStarter,
			HasEmail:     p.Email != "",
		}
		if t := byPlayer[p.PlayerID]; t != nil {
			row.TicketID = t.ID
			row.TicketCode = t.TicketCode
			row.Status = string(t.Status)
			sheet.Issued++
			for _, d := range t.Days {
				if d.CheckedInAt != nil {
					at := d.CheckedInAt.Format(time.RFC3339)
					row.CheckedInAt = &at
					sheet.CheckedIn++
					break
				}
			}
		}
		sheet.Players = append(sheet.Players, row)
	}
	return sheet
}

func (s *PlayerTicketService) Sheet(ctx context.Context, matchID, teamID string) (*dto.PlayerTicketSheetResponse, error) {
	m, team, opponent, err := s.loadMatch(ctx, matchID, teamID)
	if err != nil {
		return nil, err
	}
	players, err := s.repo.SheetPlayers(ctx, matchID, teamID)
	if err != nil {
		return nil, err
	}
	live, err := s.repo.LiveTickets(ctx, matchID, teamID)
	if err != nil {
		return nil, err
	}
	return buildSheet(m, teamID, team, opponent, players, live, s.now()), nil
}

func (s *PlayerTicketService) sheets(ctx context.Context, refs []ports.SheetRef, withPlayers bool) ([]dto.PlayerTicketSheetResponse, error) {
	out := make([]dto.PlayerTicketSheetResponse, 0, len(refs))
	for _, ref := range refs {
		sheet, err := s.Sheet(ctx, ref.MatchID, ref.TeamID)
		if err != nil {
			if errors.Is(err, ErrTeamNotInMatch) {
				continue // a sheet left behind by a team since moved out of the fixture
			}
			return nil, err
		}
		if !withPlayers {
			sheet.Players = nil
		}
		out = append(out, *sheet)
	}
	return out, nil
}

func (s *PlayerTicketService) TeamSheets(ctx context.Context, teamID string) ([]dto.PlayerTicketSheetResponse, error) {
	refs, err := s.repo.TeamSheets(ctx, teamID, teamSheetListLimit)
	if err != nil {
		return nil, err
	}
	return s.sheets(ctx, refs, false)
}

func dayResponse(ed *domain.EventDay) dto.PlayerTicketDayResponse {
	return dto.PlayerTicketDayResponse{
		ID:    ed.ID,
		Title: ed.Title,
		Date:  ed.Date.Format("2006-01-02"),
		Venue: ed.Venue,
	}
}

func (s *PlayerTicketService) SheetDays(ctx context.Context) ([]dto.PlayerTicketDayResponse, error) {
	days, err := s.repo.SheetDays(ctx, 120)
	if err != nil {
		return nil, err
	}
	out := make([]dto.PlayerTicketDayResponse, len(days))
	for i := range days {
		out[i] = dayResponse(&days[i])
	}
	return out, nil
}

func (s *PlayerTicketService) DaySheets(ctx context.Context, eventDayID string) (*dto.PlayerTicketDaySheetsResponse, error) {
	day, err := s.repo.GetDay(ctx, eventDayID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPlayerTicketDayNotFound
		}
		return nil, err
	}
	refs, err := s.repo.SheetsOnDay(ctx, eventDayID)
	if err != nil {
		return nil, err
	}
	sheets, err := s.sheets(ctx, refs, true)
	if err != nil {
		return nil, err
	}
	return &dto.PlayerTicketDaySheetsResponse{Day: dayResponse(day), Sheets: sheets}, nil
}

// ─── On the ticket service: what a player ticket needs from it ────────────────

// playerHolderSource says who a player ticket admits.
type playerHolderSource interface {
	Holder(ctx context.Context, ticketID string) (*domain.PlayerTicketHolder, error)
}

// WithPlayerHolders lets a player ticket looked up at the gate show the player.
func (s *TicketService) WithPlayerHolders(src playerHolderSource) *TicketService {
	s.playerHolders = src
	return s
}

// attachPlayer adds who a player ticket admits to its response. Best effort: the
// ticket still checks in without it.
func (s *TicketService) attachPlayer(ctx context.Context, ticket *domain.Ticket, res *dto.TicketResponse) {
	if ticket.PurchaseType != domain.PurchaseTypePlayer || s.playerHolders == nil {
		return
	}
	h, err := s.playerHolders.Holder(ctx, ticket.ID)
	if err != nil {
		fmt.Printf("⚠️ WARNING: failed to load the player for ticket %s: %s\n", ticket.ID, err.Error())
		return
	}
	res.Player = &dto.PlayerTicketHolderResponse{
		PlayerID:     h.PlayerID,
		Name:         h.Name,
		JerseyNumber: h.JerseyNumber,
		Position:     h.Position,
		Image:        h.Image,
		TeamID:       h.TeamID,
		TeamName:     h.TeamName,
		MatchID:      h.MatchID,
		HomeTeam:     h.HomeTeam,
		AwayTeam:     h.AwayTeam,
		Competition:  h.Competition,
		Kickoff:      h.Kickoff,
	}
	if !h.MatchDate.IsZero() {
		res.Player.MatchDate = h.MatchDate.Format("2006-01-02")
	}
}

// SendPlayerTicket emails a player their ticket and queues the reminder for the
// day before, as every other ticket gets.
func (s *TicketService) SendPlayerTicket(ctx context.Context, ticket *domain.Ticket, m *ports.PlayerTicketMatch, teamName string) {
	if ticket.Email == "" {
		return
	}
	if s.email != nil {
		fixture := m.HomeTeam + " vs " + m.AwayTeam
		body := email.PlayerTicketEmailHTML(email.PlayerTicketEmailData{
			PlayerName:  ticket.Name,
			TeamName:    teamName,
			Fixture:     fixture,
			Competition: m.Competition,
			Date:        m.Date.Format("Mon, Jan 02 2006"),
			Kickoff:     m.Kickoff,
			Venue:       m.Venue,
			TicketCode:  ticket.TicketCode,
		})
		subject := fmt.Sprintf("IT'S SHOWTIME 🏈, Your player ticket for %s", fixture)
		to := ticket.Email
		_ = SubmitJob(func() {
			if err := s.email.SendEmail(to, subject, body); err != nil {
				fmt.Printf("Failed to send player ticket email to %s: %v\n", to, err)
			}
		})
	}
	s.scheduleReminders(ctx, ticket)
}

// myTicketsLimit caps how far back a player's ticket list goes.
const myTicketsLimit = 30

func (s *PlayerTicketService) MyTickets(ctx context.Context, userID string) ([]dto.MyPlayerTicket, error) {
	rows, linked, err := s.repo.MyTickets(ctx, userID, myTicketsLimit)
	if err != nil {
		return nil, err
	}
	if !linked {
		return nil, appErrors.ErrPlayerNotLinked
	}
	out := make([]dto.MyPlayerTicket, 0, len(rows))
	for i := range rows {
		r := &rows[i]
		_, opponent, _ := teamSide(&r.Match, r.TeamID)
		t := dto.MyPlayerTicket{
			TicketID:   r.TicketID,
			TicketCode: r.TicketCode,
			Status:     r.Status,
			TeamName:   r.TeamName,
			Opponent:   opponent,
			Match:      matchResponse(&r.Match),
		}
		if r.CheckedInAt != nil {
			at := r.CheckedInAt.Format(time.RFC3339)
			t.CheckedInAt = &at
		}
		out = append(out, t)
	}
	return out, nil
}
