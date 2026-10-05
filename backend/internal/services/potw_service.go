package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"strings"
	"time"
)

var (
	ErrPOTWPollNotFound = errors.New("no Player of the Week vote found")
	ErrPOTWVotingClosed = errors.New("voting is not open for this Player of the Week")
	ErrPOTWNotNominee   = ports.ErrPOTWNotNominee
	// ErrPOTWEmailNotVerified: only accounts with a verified email can vote, so
	// throwaway sign-ups can't stuff the ballot.
	ErrPOTWEmailNotVerified = errors.New("verify your email address to vote")
)

// emailVerifier reports whether an account has confirmed its email.
type emailVerifier interface {
	IsEmailVerified(ctx context.Context, userID string) (bool, error)
}

// fanNotifier sends one notification to every account.
type fanNotifier interface {
	CreateForAllUsers(ctx context.Context, nType, title, message, refType string, refID *string) (int64, error)
}

type IPOTWService interface {
	GetCurrentPublicPoll(ctx context.Context, userID string) (*dto.POTWPollResponse, error)
	GetPublicPoll(ctx context.Context, pollID, userID string) (*dto.POTWPollResponse, error)
	ListPublicPolls(ctx context.Context) ([]dto.POTWPollSummary, error)
	Vote(ctx context.Context, pollID, userID, playerID string) (*dto.POTWPollResponse, error)

	GetAdminPoll(ctx context.Context, totwID string) (*dto.POTWPollResponse, error)
	SavePoll(ctx context.Context, totwID string, req dto.SavePOTWPollRequest, adminID string) (*dto.POTWPollResponse, error)
	DeletePoll(ctx context.Context, totwID string) error
	OverrideWinner(ctx context.Context, totwID, playerID string) (*dto.POTWPollResponse, error)
	ClearOverride(ctx context.Context, totwID string) (*dto.POTWPollResponse, error)

	FinalizeDuePolls(ctx context.Context) (int, error)
	AnnouncePolls(ctx context.Context) (int, error)
}

type POTWService struct {
	repo         ports.POTWRepository
	totwRepo     ports.TOTWRepository
	badgeService IBadgeService
	verifier     emailVerifier
	notifier     fanNotifier
	now          func() time.Time
}

func NewPOTWService(repo ports.POTWRepository, totwRepo ports.TOTWRepository, badgeService IBadgeService, verifier emailVerifier, notifier fanNotifier) *POTWService {
	return &POTWService{repo: repo, totwRepo: totwRepo, badgeService: badgeService, verifier: verifier, notifier: notifier, now: time.Now}
}

// ── Public ──────────────────────────────────────────────────────────────────

func (s *POTWService) GetCurrentPublicPoll(ctx context.Context, userID string) (*dto.POTWPollResponse, error) {
	poll, err := s.repo.GetLatestPublicPoll(ctx)
	if err != nil {
		return nil, err
	}
	if poll == nil {
		return nil, ErrPOTWPollNotFound
	}
	return s.publicResponse(ctx, poll, userID)
}

func (s *POTWService) GetPublicPoll(ctx context.Context, pollID, userID string) (*dto.POTWPollResponse, error) {
	poll, err := s.repo.GetPollByID(ctx, pollID)
	if err != nil {
		return nil, err
	}
	// Drafts and not-yet-open polls are invisible to the public.
	if poll == nil || !poll.TOTWPublished || poll.Status(s.now()) == domain.POTWPollScheduled {
		return nil, ErrPOTWPollNotFound
	}
	return s.publicResponse(ctx, poll, userID)
}

func (s *POTWService) ListPublicPolls(ctx context.Context) ([]dto.POTWPollSummary, error) {
	// Tally anything past its deadline first, so the archive never shows a closed
	// poll without its winner.
	if _, err := s.FinalizeDuePolls(ctx); err != nil {
		log.Printf("[ERROR] potw: finalize before listing: %v", err)
	}
	polls, err := s.repo.ListPublicPolls(ctx)
	if err != nil {
		return nil, err
	}
	now := s.now()
	out := make([]dto.POTWPollSummary, len(polls))
	for i, p := range polls {
		out[i] = dto.POTWPollSummary{
			ID:              p.ID,
			TOTWID:          p.TOTWID,
			WeekTitle:       p.WeekTitle,
			CompetitionName: p.CompetitionName,
			Status:          p.Status(now),
			OpensAt:         p.OpensAt,
			ClosesAt:        p.ClosesAt,
			TotalVotes:      p.TotalVotes,
			WinnerPlayerID:  p.WinnerPlayerID,
			WinnerSource:    p.WinnerSource,
		}
		if len(p.Nominees) > 0 {
			out[i].WinnerName = p.Nominees[0].Name
		}
	}
	return out, nil
}

// Vote records or changes the user's vote. Only logged-in users reach this (the
// route requires a token), and only while the poll is open on a published edition.
func (s *POTWService) Vote(ctx context.Context, pollID, userID, playerID string) (*dto.POTWPollResponse, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("you need to be logged in to vote")
	}
	if s.verifier != nil {
		verified, err := s.verifier.IsEmailVerified(ctx, userID)
		if err != nil {
			return nil, err
		}
		if !verified {
			return nil, ErrPOTWEmailNotVerified
		}
	}
	poll, err := s.repo.GetPollByID(ctx, pollID)
	if err != nil {
		return nil, err
	}
	if poll == nil || !poll.TOTWPublished {
		return nil, ErrPOTWPollNotFound
	}
	if poll.Status(s.now()) != domain.POTWPollOpen {
		return nil, ErrPOTWVotingClosed
	}
	if err := s.repo.CastVote(ctx, pollID, userID, strings.TrimSpace(playerID)); err != nil {
		return nil, err
	}
	return s.GetPublicPoll(ctx, pollID, userID)
}

// publicResponse finalizes a poll whose deadline has just passed (so the first
// visitor after it closes sees the result straight away) and maps it for the
// public, hiding the per-player counts while voting is still running.
func (s *POTWService) publicResponse(ctx context.Context, poll *domain.POTWPoll, userID string) (*dto.POTWPollResponse, error) {
	poll, err := s.finalizeIfDue(ctx, poll)
	if err != nil {
		return nil, err
	}
	resp := s.mapPoll(poll, poll.Status(s.now()) == domain.POTWPollClosed)
	if userID != "" {
		if vote, err := s.repo.GetUserVote(ctx, poll.ID, userID); err == nil {
			resp.MyVote = vote
		}
	}
	return resp, nil
}

// ── Admin ───────────────────────────────────────────────────────────────────

// GetAdminPoll returns the edition's poll with live counts, or ErrPOTWPollNotFound.
func (s *POTWService) GetAdminPoll(ctx context.Context, totwID string) (*dto.POTWPollResponse, error) {
	poll, err := s.repo.GetPollByTOTWID(ctx, totwID)
	if err != nil {
		return nil, err
	}
	if poll == nil {
		return nil, ErrPOTWPollNotFound
	}
	if poll, err = s.finalizeIfDue(ctx, poll); err != nil {
		return nil, err
	}
	return s.mapPoll(poll, true), nil
}

// SavePoll creates the edition's poll or changes it. Nominees must come from the
// edition's lineup and cannot change once anyone has voted (that would void votes).
// Moving the deadline into the future on a poll the fans already decided reopens it.
func (s *POTWService) SavePoll(ctx context.Context, totwID string, req dto.SavePOTWPollRequest, adminID string) (*dto.POTWPollResponse, error) {
	totw, err := s.totwRepo.GetTOTWByID(ctx, totwID)
	if err != nil {
		return nil, err
	}

	nominees, err := cleanNominees(req.NomineeIDs, totw)
	if err != nil {
		return nil, err
	}

	existing, err := s.repo.GetPollByTOTWID(ctx, totwID)
	if err != nil {
		return nil, err
	}

	// Without an explicit opening time a new vote opens now and an existing one
	// keeps its own, so "end voting now" (deadline = now) works on a running vote.
	now := s.now()
	opensAt := now
	if existing != nil {
		opensAt = existing.OpensAt
	}
	if req.OpensAt != nil && !req.OpensAt.IsZero() {
		opensAt = *req.OpensAt
	}

	// On an existing vote, a deadline that isn't in the future means "close it
	// now", measured on the server's clock — an admin's clock running a little
	// behind (or a time rounded to the second) must not make that fail.
	closesAt := req.ClosesAt
	if existing != nil && !closesAt.After(now) {
		if opensAt.After(now) {
			return nil, errors.New("voting hasn't opened yet — delete the vote instead of closing it")
		}
		closesAt = now
	}
	if !closesAt.After(opensAt) {
		return nil, errors.New("the voting deadline must be after voting opens")
	}

	if existing == nil {
		if !closesAt.After(now) {
			return nil, errors.New("the voting deadline must be in the future")
		}
		poll := &domain.POTWPoll{TOTWID: totwID, OpensAt: opensAt, ClosesAt: closesAt}
		if adminID != "" {
			poll.CreatedBy = &adminID
		}
		if err := s.repo.CreatePoll(ctx, poll, nominees); err != nil {
			return nil, err
		}
		// The fans decide from here: clear a Player of the Week picked by hand
		// before the vote, so the edition doesn't show one while voting runs.
		if totw.PlayerOfTheWeekID != nil && *totw.PlayerOfTheWeekID != "" {
			if _, err := s.repo.SetWinner(ctx, poll.ID, nil, nil, false); err != nil {
				return nil, err
			}
			s.syncBadges(ctx, totwID)
		}
		return s.GetAdminPoll(ctx, totwID)
	}

	// Nominees are locked once voting has started; re-inserting them would cascade
	// away every vote.
	var replace []string
	if !sameNominees(existing.Nominees, nominees) {
		if existing.TotalVotes > 0 {
			return nil, errors.New("nominees can't be changed after fans have started voting — you can still change the deadline or override the winner")
		}
		replace = nominees
	}

	// Reopen a poll the fans already decided when the deadline moves into the
	// future: the old result no longer stands.
	reopen := existing.FinalizedAt != nil && closesAt.After(now) &&
		(existing.WinnerSource == nil || *existing.WinnerSource == domain.POTWWinnerByVote)
	if reopen {
		if _, err := s.repo.SetWinner(ctx, existing.ID, nil, nil, false); err != nil {
			return nil, err
		}
		// The new result gets its own announcement when voting closes again.
		if err := s.repo.ResetResultNotification(ctx, existing.ID); err != nil {
			return nil, err
		}
		s.syncBadges(ctx, totwID)
	}

	existing.OpensAt = opensAt
	existing.ClosesAt = closesAt
	if err := s.repo.UpdatePoll(ctx, existing, replace); err != nil {
		return nil, err
	}
	return s.GetAdminPoll(ctx, totwID) // finalizes straight away if the new deadline has passed
}

// DeletePoll removes the vote and its ballots. The edition keeps whatever Player
// of the Week it has.
func (s *POTWService) DeletePoll(ctx context.Context, totwID string) error {
	return s.repo.DeletePoll(ctx, totwID)
}

// OverrideWinner sets the Player of the Week by hand. The override stands even
// when the vote closes with a different leader. Any player in the edition's
// lineup can be chosen, not only nominees.
func (s *POTWService) OverrideWinner(ctx context.Context, totwID, playerID string) (*dto.POTWPollResponse, error) {
	poll, err := s.repo.GetPollByTOTWID(ctx, totwID)
	if err != nil {
		return nil, err
	}
	if poll == nil {
		return nil, ErrPOTWPollNotFound
	}
	totw, err := s.totwRepo.GetTOTWByID(ctx, totwID)
	if err != nil {
		return nil, err
	}
	playerID = strings.TrimSpace(playerID)
	if !inLineup(totw, playerID) {
		return nil, errors.New("the Player of the Week must be in this Team of the Week")
	}
	source := domain.POTWWinnerByAdmin
	if _, err := s.repo.SetWinner(ctx, poll.ID, &playerID, &source, true); err != nil {
		return nil, err
	}
	s.syncBadges(ctx, totwID)
	return s.GetAdminPoll(ctx, totwID)
}

// ClearOverride hands the decision back to the fans: the vote result applies if
// voting has closed, otherwise the winner is decided when it does.
func (s *POTWService) ClearOverride(ctx context.Context, totwID string) (*dto.POTWPollResponse, error) {
	poll, err := s.repo.GetPollByTOTWID(ctx, totwID)
	if err != nil {
		return nil, err
	}
	if poll == nil {
		return nil, ErrPOTWPollNotFound
	}
	if poll.WinnerSource == nil || *poll.WinnerSource != domain.POTWWinnerByAdmin {
		return nil, errors.New("this vote has no admin override to clear")
	}
	if _, err := s.repo.SetWinner(ctx, poll.ID, nil, nil, false); err != nil {
		return nil, err
	}
	s.syncBadges(ctx, totwID)
	return s.GetAdminPoll(ctx, totwID) // re-tallies now if voting already closed
}

// ── Finalizing ──────────────────────────────────────────────────────────────

// FinalizeDuePolls tallies every poll whose deadline has passed. The scheduled job
// calls it; page loads also finalize the poll they show, so a result never waits
// for the next tick.
func (s *POTWService) FinalizeDuePolls(ctx context.Context) (int, error) {
	ids, err := s.repo.ListDuePollIDs(ctx)
	if err != nil {
		return 0, err
	}
	done := 0
	for _, id := range ids {
		if err := s.finalize(ctx, id); err != nil {
			return done, fmt.Errorf("finalize poll %s: %w", id, err)
		}
		done++
	}
	return done, nil
}

// AnnouncePolls tells every fan when a vote opens and when its winner is
// decided. Each poll is claimed before sending, so it goes out once even if two
// runs overlap. Returns how many announcements were made.
func (s *POTWService) AnnouncePolls(ctx context.Context) (int, error) {
	if s.notifier == nil {
		return 0, nil
	}
	sent := 0

	opened, err := s.repo.ClaimOpenAnnouncements(ctx)
	if err != nil {
		return sent, err
	}
	for _, a := range opened {
		id := a.PollID
		msg := fmt.Sprintf("%s: %d nominees from the Team of the Week. Voting closes %s.", a.WeekTitle, a.Nominees, formatLagos(a.ClosesAt))
		if _, err := s.notifier.CreateForAllUsers(ctx, "POTW_VOTE_OPEN", "Vote for Player of the Week", msg, "potw_poll", &id); err != nil {
			log.Printf("[ERROR] potw: announce vote open for poll %s: %v", a.PollID, err)
			continue
		}
		sent++
	}

	results, err := s.repo.ClaimResultAnnouncements(ctx)
	if err != nil {
		return sent, err
	}
	for _, a := range results {
		id := a.PollID
		how := "Chosen by the fans"
		if a.WinnerSource == domain.POTWWinnerByAdmin {
			how = "Named by the league office"
		}
		msg := fmt.Sprintf("%s. See the full results of the %s vote.", how, a.WeekTitle)
		title := fmt.Sprintf("%s is Player of the Week", a.WinnerName)
		if _, err := s.notifier.CreateForAllUsers(ctx, "POTW_WINNER", title, msg, "potw_poll", &id); err != nil {
			log.Printf("[ERROR] potw: announce winner for poll %s: %v", a.PollID, err)
			continue
		}
		sent++
	}
	return sent, nil
}

// formatLagos renders a time the way fans read it, e.g. "Wed 8 Oct, 18:00 WAT".
func formatLagos(t time.Time) string {
	if loc, err := time.LoadLocation("Africa/Lagos"); err == nil {
		t = t.In(loc)
	}
	return t.Format("Mon 2 Jan, 15:04 MST")
}

func (s *POTWService) finalize(ctx context.Context, pollID string) error {
	totwID, applied, err := s.repo.FinalizePoll(ctx, pollID, s.now())
	if err != nil {
		return err
	}
	if applied {
		s.syncBadges(ctx, totwID)
	}
	return nil
}

func (s *POTWService) finalizeIfDue(ctx context.Context, poll *domain.POTWPoll) (*domain.POTWPoll, error) {
	if poll.FinalizedAt != nil || poll.Status(s.now()) != domain.POTWPollClosed {
		return poll, nil
	}
	if err := s.finalize(ctx, poll.ID); err != nil {
		return nil, err
	}
	reloaded, err := s.repo.GetPollByID(ctx, poll.ID)
	if err != nil {
		return nil, err
	}
	if reloaded == nil {
		return nil, ErrPOTWPollNotFound
	}
	return reloaded, nil
}

// syncBadges re-awards the POTW badge from the edition's current Player of the
// Week. The badge only exists for published editions; SyncTOTWBadges handles that.
func (s *POTWService) syncBadges(ctx context.Context, totwID string) {
	if s.badgeService == nil {
		return
	}
	totw, err := s.totwRepo.GetTOTWByID(ctx, totwID)
	if err != nil {
		log.Printf("[ERROR] potw: reload totw %s for badge sync: %v", totwID, err)
		return
	}
	if err := s.badgeService.SyncTOTWBadges(ctx, totw); err != nil {
		log.Printf("[ERROR] potw: sync badges for totw %s: %v", totwID, err)
	}
}

// ── Mapping & helpers ───────────────────────────────────────────────────────

func (s *POTWService) mapPoll(p *domain.POTWPoll, showResults bool) *dto.POTWPollResponse {
	resp := &dto.POTWPollResponse{
		ID:              p.ID,
		TOTWID:          p.TOTWID,
		WeekTitle:       p.WeekTitle,
		Headline:        p.Headline,
		CompetitionID:   p.CompetitionID,
		CompetitionName: p.CompetitionName,
		TOTWPublished:   p.TOTWPublished,
		Status:          p.Status(s.now()),
		OpensAt:         p.OpensAt,
		ClosesAt:        p.ClosesAt,
		ServerTime:      s.now(),
		FinalizedAt:     p.FinalizedAt,
		TotalVotes:      p.TotalVotes,
		ResultsVisible:  showResults,
		Nominees:        make([]dto.POTWNomineeResponse, len(p.Nominees)),
	}
	// An admin override is applied to the edition at once (the Team of the Week
	// page shows it), so it is shown here too. Vote counts stay hidden until the
	// deadline either way.
	adminPick := p.WinnerSource != nil && *p.WinnerSource == domain.POTWWinnerByAdmin
	if showResults || adminPick {
		resp.WinnerPlayerID = p.WinnerPlayerID
		resp.WinnerSource = p.WinnerSource
	}
	if showResults {
		for _, d := range p.VotesByDay {
			resp.VotesByDay = append(resp.VotesByDay, dto.POTWDayCountResponse{Day: d.Day, Votes: d.Votes})
		}
	}

	for i, n := range p.Nominees {
		nr := dto.POTWNomineeResponse{
			PlayerID:     n.PlayerID,
			Name:         n.Name,
			Image:        n.Image,
			JerseyNumber: n.JerseyNumber,
			Position:     n.Position,
			TeamName:     n.TeamName,
			TeamLogo:     n.TeamLogo,
			DisplayOrder: n.DisplayOrder,
			TOTWPosition: n.TOTWPosition,
			Rating:       n.Rating,
			Stat1Value:   n.Stat1Value,
			Stat1Label:   n.Stat1Label,
			Stat2Value:   n.Stat2Value,
			Stat2Label:   n.Stat2Label,
			Stat3Value:   n.Stat3Value,
			Stat3Label:   n.Stat3Label,
		}
		if showResults {
			votes := n.Votes
			pct := 0.0
			if p.TotalVotes > 0 {
				pct = math.Round(float64(n.Votes)*1000/float64(p.TotalVotes)) / 10
			}
			nr.Votes = &votes
			nr.Percent = &pct
		}
		nr.IsWinner = resp.WinnerPlayerID != nil && *resp.WinnerPlayerID == n.PlayerID
		resp.Nominees[i] = nr
	}
	return resp
}

// cleanNominees trims, de-duplicates and checks the ballot: 2 to 5 players, all
// from the edition's lineup.
func cleanNominees(ids []string, totw *domain.TeamOfTheWeek) ([]string, error) {
	seen := make(map[string]bool)
	var out []string
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		if !inLineup(totw, id) {
			return nil, errors.New("every nominee must be in this Team of the Week")
		}
		seen[id] = true
		out = append(out, id)
	}
	if len(out) < domain.POTWMinNominees || len(out) > domain.POTWMaxNominees {
		return nil, fmt.Errorf("choose between %d and %d nominees", domain.POTWMinNominees, domain.POTWMaxNominees)
	}
	return out, nil
}

func inLineup(totw *domain.TeamOfTheWeek, playerID string) bool {
	for _, p := range totw.Players {
		if p.PlayerID == playerID {
			return true
		}
	}
	return false
}

// sameNominees reports whether the ballot holds the same players, ignoring order.
func sameNominees(current []domain.POTWNominee, ids []string) bool {
	if len(current) != len(ids) {
		return false
	}
	set := make(map[string]bool, len(current))
	for _, n := range current {
		set[n.PlayerID] = true
	}
	for _, id := range ids {
		if !set[id] {
			return false
		}
	}
	return true
}
