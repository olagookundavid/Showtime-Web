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
	ErrNoSlotsLeft               = errors.New("this team has no tickets left for the match: revoke one first")
	ErrTicketNotFound            = errors.New("ticket not found for this team and match")
	ErrTicketUsed                = errors.New("that ticket has already been used at the gate, so it cannot be revoked")
	ErrNotOnTeam                 = errors.New("that player is not on this team")
	ErrAlreadyHasTicket          = errors.New("they already have a ticket for this match")
	ErrTicketsClosed             = errors.New("this match day has passed, so no more tickets can be issued for it")
	ErrNeedAName                 = errors.New("a name is needed so the gate knows who the ticket is for")
	ErrBadEmail                  = errors.New("that email address does not look right")
	ErrNotOnSheetOrTeam          = errors.New("that person is not on this team's sheet or a manager of the team")
)

// TeamTicketSlots is how many tickets a team has for one match: its players on the
// sheet, its managers, and anyone else the manager gives one to. A team need not
// use them all. Players on the sheet and managers always get theirs, so a big
// sheet plus many managers can take the whole 30 and leave nothing to give out.
const TeamTicketSlots = 30

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

	// A team manager spends the team's other slots: extras for reserves or anyone
	// else, and taking a ticket back to free its slot.
	AddExtra(ctx context.Context, matchID, teamID string, req dto.AddExtraTicketRequest) (*dto.PlayerTicketSheetResponse, error)
	Revoke(ctx context.Context, matchID, teamID, ticketID string) (*dto.PlayerTicketSheetResponse, error)
	Restore(ctx context.Context, matchID, teamID string, req dto.RestoreTicketRequest) (*dto.PlayerTicketSheetResponse, error)
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
	managers, err := s.repo.Managers(ctx, teamID)
	if err != nil {
		return nil, err
	}
	live, err := s.repo.LiveTickets(ctx, matchID, teamID)
	if err != nil {
		return nil, err
	}
	revokedPlayers, revokedUsers, err := s.repo.RevokedHolders(ctx, matchID, teamID)
	if err != nil {
		return nil, err
	}

	onSheet := make(map[string]bool, len(players))
	for _, p := range players {
		onSheet[p.PlayerID] = true
	}
	hasPlayer := make(map[string]bool, len(live))
	hasManager := make(map[string]bool)
	var dropped []string
	for _, t := range live {
		if t.PlayerID != nil {
			hasPlayer[*t.PlayerID] = true
		}
		if t.UserID != nil && t.TeamRole == domain.TeamRoleManager {
			hasManager[*t.UserID] = true
		}
		// Only a sheet player's own ticket goes when they come off the sheet. A
		// manager's, and an extra the manager chose to give, stay.
		if t.TeamRole == domain.TeamRolePlayer && (t.PlayerID == nil || !onSheet[*t.PlayerID]) {
			dropped = append(dropped, t.ID)
			delete(hasPlayer, derefString(t.PlayerID))
		}
	}
	cancelled, err := s.repo.CancelUnused(ctx, dropped)
	if err != nil {
		return nil, err
	}
	res.Cancelled = int(cancelled)

	var missing []ticketHolder
	for _, p := range players {
		if !hasPlayer[p.PlayerID] && !revokedPlayers[p.PlayerID] {
			missing = append(missing, playerHolder(p, domain.TeamRolePlayer))
		}
	}
	for _, mg := range managers {
		if !hasManager[mg.UserID] && !revokedUsers[mg.UserID] {
			missing = append(missing, managerHolder(mg))
		}
	}
	if len(missing) == 0 {
		return res, nil
	}

	dayID, err := s.repo.EnsureGameDay(ctx, matchID)
	if err != nil {
		return nil, fmt.Errorf("failed to find the match day: %w", err)
	}

	// One person failing does not stop the rest: the sheet shows who is still
	// without a code, and issuing again fills the gaps.
	var firstErr error
	for _, h := range missing {
		ticket, err := s.issue(ctx, m, teamID, dayID, h)
		if err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("failed to issue a ticket for %s: %w", h.Name, err)
			}
			continue
		}
		if ticket == nil {
			continue // issued meanwhile by a save running at the same time
		}
		res.Issued++
		if s.send(ctx, ticket, m, teamName) {
			res.Emailed++
		}
	}
	if firstErr != nil {
		return res, firstErr
	}
	return res, nil
}

func derefString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// send emails a new ticket if its holder has an address. It says whether it did.
func (s *PlayerTicketService) send(ctx context.Context, t *domain.Ticket, m *ports.PlayerTicketMatch, teamName string) bool {
	if t.Email == "" || s.notifier == nil {
		return false
	}
	s.notifier.SendPlayerTicket(ctx, t, m, teamName)
	return true
}

// ticketHolder is who a team ticket is being made for.
type ticketHolder struct {
	Role     domain.TeamTicketRole
	PlayerID string
	UserID   string
	Name     string
	Email    string
}

func playerHolder(p ports.SheetPlayer, role domain.TeamTicketRole) ticketHolder {
	return ticketHolder{Role: role, PlayerID: p.PlayerID, Name: p.Name, Email: p.Email}
}

func managerHolder(m ports.TeamManager) ticketHolder {
	return ticketHolder{Role: domain.TeamRoleManager, UserID: m.UserID, Name: m.Name, Email: m.Email}
}

// issue creates one team ticket. It returns nil, nil when the holder already has a
// live ticket for the match, which only happens when two requests race.
func (s *PlayerTicketService) issue(ctx context.Context, m *ports.PlayerTicketMatch, teamID, dayID string, h ticketHolder) (*domain.Ticket, error) {
	matchID, team := m.ID, teamID
	var lastErr error
	for i := 0; i < playerTicketCodeAttempts; i++ {
		ticket := &domain.Ticket{
			ProductName:  "Player Ticket",
			PurchaseType: domain.PurchaseTypePlayer,
			TeamRole:     h.Role,
			Email:        h.Email,
			Name:         h.Name,
			Quantity:     1,
			Status:       domain.TicketStatusPaid,
			TicketCode:   GenerateTicketCode(),
			TeamID:       &team,
			MatchID:      &matchID,
			Days:         []domain.TicketDay{{EventDayID: dayID}},
		}
		if h.PlayerID != "" {
			id := h.PlayerID
			ticket.PlayerID = &id
		}
		if h.UserID != "" {
			id := h.UserID
			ticket.UserID = &id
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
		case "idx_tickets_player_match_live", "idx_tickets_manager_match_live":
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

// ticketRow fills a row's ticket details from a live ticket.
func ticketRow(row *dto.PlayerTicketRow, t *domain.Ticket) {
	row.TicketID = t.ID
	row.TicketCode = t.TicketCode
	row.Status = string(t.Status)
	for _, d := range t.Days {
		if d.CheckedInAt != nil {
			at := d.CheckedInAt.Format(time.RFC3339)
			row.CheckedInAt = &at
			break
		}
	}
}

// buildSheet puts everyone with a slot for the match side by side with their
// ticket: the players on the sheet, the team's managers, and the extras.
func buildSheet(m *ports.PlayerTicketMatch, teamID, teamName, opponent string, players []ports.SheetPlayer, managers []ports.TeamManager,
	live []domain.Ticket, revokedPlayers, revokedUsers map[string]bool, now time.Time) *dto.PlayerTicketSheetResponse {

	byPlayer := make(map[string]*domain.Ticket, len(live))
	byManager := make(map[string]*domain.Ticket)
	for i := range live {
		if live[i].PlayerID != nil {
			byPlayer[*live[i].PlayerID] = &live[i]
		}
		if live[i].UserID != nil && live[i].TeamRole == domain.TeamRoleManager {
			byManager[*live[i].UserID] = &live[i]
		}
	}

	sheet := &dto.PlayerTicketSheetResponse{
		Match:      matchResponse(m),
		TeamID:     teamID,
		TeamName:   teamName,
		Opponent:   opponent,
		Players:    make([]dto.PlayerTicketRow, 0, len(players)),
		Others:     []dto.PlayerTicketRow{},
		Named:      len(players),
		SlotsTotal: TeamTicketSlots,
		SlotsUsed:  len(live),
		CanIssue:   canIssuePlayerTickets(m, now),
	}
	if left := TeamTicketSlots - len(live); left > 0 {
		sheet.SlotsLeft = left
	}
	checkedIn := func(r *dto.PlayerTicketRow) {
		if r.CheckedInAt != nil {
			sheet.CheckedIn++
		}
	}

	onSheet := make(map[string]bool, len(players))
	for _, p := range players {
		onSheet[p.PlayerID] = true
		row := dto.PlayerTicketRow{
			Role:         string(domain.TeamRolePlayer),
			PlayerID:     p.PlayerID,
			Name:         p.Name,
			JerseyNumber: p.JerseyNumber,
			Position:     p.Position,
			IsStarter:    p.IsStarter,
			HasEmail:     p.Email != "",
		}
		if t := byPlayer[p.PlayerID]; t != nil {
			ticketRow(&row, t)
			sheet.Issued++
		} else if revokedPlayers[p.PlayerID] {
			row.Revoked = true
		} else {
			sheet.Missing++
		}
		checkedIn(&row)
		sheet.Players = append(sheet.Players, row)
	}

	seenManager := make(map[string]bool, len(managers))
	for _, mg := range managers {
		seenManager[mg.UserID] = true
		row := dto.PlayerTicketRow{
			Role:     string(domain.TeamRoleManager),
			UserID:   mg.UserID,
			Name:     mg.Name,
			Position: "Team manager",
			HasEmail: mg.Email != "",
		}
		if t := byManager[mg.UserID]; t != nil {
			ticketRow(&row, t)
		} else if revokedUsers[mg.UserID] {
			row.Revoked = true
		} else {
			sheet.Missing++
		}
		checkedIn(&row)
		sheet.Others = append(sheet.Others, row)
	}

	// Anyone else holding a live ticket: extras the manager gave, and a manager who
	// has since left the team but whose ticket stands.
	for i := range live {
		t := &live[i]
		switch {
		case t.TeamRole == domain.TeamRoleManager && t.UserID != nil && seenManager[*t.UserID]:
			continue
		case t.TeamRole == domain.TeamRolePlayer && t.PlayerID != nil && onSheet[*t.PlayerID]:
			continue
		case t.TeamRole == domain.TeamRoleExtra && t.PlayerID != nil && onSheet[*t.PlayerID]:
			continue // a reserve later named on the sheet shows once, as a sheet player
		}
		row := dto.PlayerTicketRow{
			Role:     string(t.TeamRole),
			Name:     t.Name,
			HasEmail: t.Email != "",
		}
		if t.TeamRole == domain.TeamRoleManager {
			row.Position = "Team manager"
		} else {
			row.Position = "Extra ticket"
		}
		if t.PlayerID != nil {
			row.PlayerID = *t.PlayerID
		}
		ticketRow(&row, t)
		checkedIn(&row)
		sheet.Others = append(sheet.Others, row)
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
	managers, err := s.repo.Managers(ctx, teamID)
	if err != nil {
		return nil, err
	}
	live, err := s.repo.LiveTickets(ctx, matchID, teamID)
	if err != nil {
		return nil, err
	}
	revokedPlayers, revokedUsers, err := s.repo.RevokedHolders(ctx, matchID, teamID)
	if err != nil {
		return nil, err
	}
	return buildSheet(m, teamID, team, opponent, players, managers, live, revokedPlayers, revokedUsers, s.now()), nil
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
			sheet.Others = nil
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
		Role:         string(h.Role),
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
			Role:        string(ticket.TeamRole),
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
