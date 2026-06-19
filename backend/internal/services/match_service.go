package services

import (
	"context"
	"fmt"
	"pkg-common/logger"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"time"
)

type IMatchService interface {
	GetCompetitions(ctx context.Context, page, limit int, search string, status string) (dto.PaginatedResult[dto.CompetitionResponse], error)
	CreateCompetition(ctx context.Context, comp *domain.Competition) error
	UpdateCompetition(ctx context.Context, comp *domain.Competition) error
	DeleteCompetition(ctx context.Context, id string) error
	GetTeams(ctx context.Context, page, limit int, search string) (dto.PaginatedResult[dto.TeamResponse], error)
	GetAllTeams(ctx context.Context) ([]dto.TeamResponse, error)
	GetTeamsByCompetition(ctx context.Context, competitionID string) ([]dto.TeamResponse, error)
	GetMatches(ctx context.Context, competitionID string, status string, page, limit int, search string) (dto.PaginatedResult[dto.MatchResponse], error)
	GetStandings(ctx context.Context, competitionID string) ([]dto.StandingResponse, error)
	CreateMatch(ctx context.Context, match *domain.Match) error
	UpdateMatch(ctx context.Context, match *domain.Match) error
	DeleteMatch(ctx context.Context, id string) error
	RecalculateStandings(ctx context.Context, competitionID string) error
	CreateStanding(ctx context.Context, standing *domain.Standing) error
	UpdateStanding(ctx context.Context, standing *domain.Standing) error
	DeleteStanding(ctx context.Context, id string) error
	CreateTeam(ctx context.Context, team *domain.Team) error
	UpdateTeam(ctx context.Context, team *domain.Team) error
	DeleteTeam(ctx context.Context, id string) error
	GenerateBracket(ctx context.Context, competitionID string, req dto.GenerateBracketRequest) error
	ResetBracket(ctx context.Context, competitionID string) error
	SaveTeamSheet(ctx context.Context, matchID, teamID string, playerIDs []string) error
	GetTeamSheet(ctx context.Context, matchID string) (*domain.MatchTeamSheet, error)
	GetMatchDetail(ctx context.Context, matchID string) (*domain.MatchDetail, error)
	GetMatchDaysByCompetition(ctx context.Context, competitionID string) ([]string, error)
	GetEligiblePlayersForMatchDay(ctx context.Context, competitionID string, date string) ([]domain.Player, error)
}

type MatchService struct {
	repo    ports.MatchRepository
	storage ports.StorageService
}

func NewMatchService(repo ports.MatchRepository, storage ports.StorageService) IMatchService {
	return &MatchService{repo: repo, storage: storage}
}


func (s *MatchService) isCompleted(ctx context.Context, competitionID string) (bool, error) {
	if competitionID == "" {
		return false, nil
	}
	comp, err := s.repo.GetCompetitionByID(ctx, competitionID)
	if err != nil {
		return false, err
	}
	return comp != nil && comp.Status == "completed", nil
}

// competitionState fetches a competition once and reports the two flags the
// match flows care about: locked-for-editing and knockout (bracket) format.
func (s *MatchService) competitionState(ctx context.Context, competitionID string) (completed bool, knockout bool, err error) {
	if competitionID == "" {
		return false, false, nil
	}
	comp, err := s.repo.GetCompetitionByID(ctx, competitionID)
	if err != nil {
		return false, false, err
	}
	if comp == nil {
		return false, false, nil
	}
	return comp.Status == "completed", comp.Format == string(domain.CompetitionFormatKnockout), nil
}

// validateBracketLink ensures a feeds_match pointer is sane: HOME/AWAY slot,
// not self-referencing, and the target lives in the same competition.
func (s *MatchService) validateBracketLink(ctx context.Context, match *domain.Match) error {
	if match.FeedsMatchID == nil || *match.FeedsMatchID == "" {
		match.FeedsMatchID = nil
		return nil
	}
	if match.FeedsSlot != "HOME" && match.FeedsSlot != "AWAY" {
		return fmt.Errorf("feeds_slot must be HOME or AWAY when feeds_match_id is set")
	}
	if match.ID != "" && *match.FeedsMatchID == match.ID {
		return fmt.Errorf("a match cannot feed itself")
	}
	target, err := s.repo.GetMatchByID(ctx, *match.FeedsMatchID)
	if err != nil {
		return fmt.Errorf("feeds_match_id does not reference an existing match")
	}
	if target.CompetitionID != match.CompetitionID {
		return fmt.Errorf("a match can only feed a match in the same competition")
	}
	return nil
}

// advanceWinner propagates a knockout result down the bracket: the winner of
// the given match is written into the home/away slot it feeds. If the match
// has no decided winner (not finished, or the result was edited away), the
// slot is cleared back to TBD. Score edits that flip the winner simply
// overwrite the slot.
func (s *MatchService) advanceWinner(ctx context.Context, matchID string) error {
	return s.advanceWinnerDepth(ctx, matchID, 0)
}

func (s *MatchService) advanceWinnerDepth(ctx context.Context, matchID string, depth int) error {
	// Depth guard: a real bracket is at most a handful of rounds deep; this
	// only trips if feeds pointers were misconfigured into a cycle.
	if depth > 16 {
		return fmt.Errorf("bracket advance aborted: feeds_match chain too deep (cycle?)")
	}
	m, err := s.repo.GetMatchByID(ctx, matchID)
	if err != nil || m == nil {
		return err
	}
	if m.FeedsMatchID == nil || (m.FeedsSlot != "HOME" && m.FeedsSlot != "AWAY") {
		return nil
	}

	var winner *string
	if m.Status == domain.MatchStatusFinished && m.HomeScore != nil && m.AwayScore != nil {
		switch {
		case *m.HomeScore > *m.AwayScore && m.HomeTeamID != "":
			winner = &m.HomeTeamID
		case *m.AwayScore > *m.HomeScore && m.AwayTeamID != "":
			winner = &m.AwayTeamID
		}
	}
	if err := s.repo.SetMatchSlot(ctx, *m.FeedsMatchID, m.FeedsSlot, winner); err != nil {
		return err
	}
	// Re-propagate in case the next match was already finished and its winner
	// just changed (e.g. an admin corrected an earlier score). The chain stops
	// at the first match without a decided result.
	return s.advanceWinnerDepth(ctx, *m.FeedsMatchID, depth+1)
}

func (s *MatchService) GetCompetitions(ctx context.Context, page, limit int, search string, status string) (dto.PaginatedResult[dto.CompetitionResponse], error) {
	competitions, total, err := s.repo.GetCompetitions(ctx, page, limit, search, status)
	if err != nil {
		return dto.PaginatedResult[dto.CompetitionResponse]{}, err
	}

	var res []dto.CompetitionResponse
	for _, c := range competitions {
		res = append(res, dto.CompetitionResponse{
			ID:     c.ID,
			Name:   c.Name,
			Logo:   c.Logo,
			Status: c.Status,
			Format: c.Format,
		})
	}

	totalPages := 0
	if limit > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}

	return dto.PaginatedResult[dto.CompetitionResponse]{
		Data:       res,
		Total:      int(total),
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *MatchService) GetTeams(ctx context.Context, page, limit int, search string) (dto.PaginatedResult[dto.TeamResponse], error) {
	teams, total, err := s.repo.GetTeams(ctx, page, limit, search)
	if err != nil {
		return dto.PaginatedResult[dto.TeamResponse]{}, err
	}

	var res []dto.TeamResponse
	for _, t := range teams {
		res = append(res, dto.TeamResponse{
			ID:        t.ID,
			Name:      t.Name,
			ShortName: t.ShortName,
			Logo:      t.Logo,
		})
	}

	totalPages := 0
	if limit > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}

	return dto.PaginatedResult[dto.TeamResponse]{
		Data:       res,
		Total:      int(total),
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *MatchService) GetAllTeams(ctx context.Context) ([]dto.TeamResponse, error) {
	teams, err := s.repo.GetAllTeams(ctx)
	if err != nil {
		return nil, err
	}

	var res []dto.TeamResponse
	for _, t := range teams {
		res = append(res, dto.TeamResponse{
			ID:        t.ID,
			Name:      t.Name,
			ShortName: t.ShortName,
			Logo:      t.Logo,
		})
	}
	return res, nil
}

func getString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (s *MatchService) GetMatches(ctx context.Context, competitionID string, status string, page, limit int, search string) (dto.PaginatedResult[dto.MatchResponse], error) {
	matches, total, err := s.repo.GetMatches(ctx, competitionID, status, page, limit, search)
	if err != nil {
		return dto.PaginatedResult[dto.MatchResponse]{}, err
	}

	var res []dto.MatchResponse
	for _, m := range matches {
		res = append(res, dto.MatchResponse{
			ID: m.ID,
			Competition: &dto.CompetitionResponse{
				ID:     m.Competition.ID,
				Name:   m.Competition.Name,
				Logo:   m.Competition.Logo,
				Format: m.Competition.Format,
			},
			HomeTeam: &dto.TeamResponse{
				ID:        m.HomeTeam.ID,
				Name:      m.HomeTeam.Name,
				ShortName: m.HomeTeam.ShortName,
				Logo:      m.HomeTeam.Logo,
			},
			AwayTeam: &dto.TeamResponse{
				ID:        m.AwayTeam.ID,
				Name:      m.AwayTeam.Name,
				ShortName: m.AwayTeam.ShortName,
				Logo:      m.AwayTeam.Logo,
			},
			Date:          m.Date.Format("2006-01-02"),
			StartTime:     m.StartTime.Format("15:04"),
			Venue:         m.Venue,
			Status:        string(m.Status),
			HomeScore:     m.HomeScore,
			AwayScore:     m.AwayScore,
			HighlightsURL: getString(m.HighlightsURL),
			TicketURL:     getString(m.TicketURL),
			Round:         m.Round,
			BracketPos:    m.BracketPos,
			FeedsMatchID:  m.FeedsMatchID,
			FeedsSlot:     m.FeedsSlot,
		})
	}

	totalPages := 0
	if limit > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}

	return dto.PaginatedResult[dto.MatchResponse]{
		Data:       res,
		Total:      int(total),
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

// bracketRoundLabels names the rounds of a generated bracket using the
// league's convention: Wildcard first, then Playoff 1..N, Bowl last.
func bracketRoundLabels(rounds int) []string {
	labels := make([]string, rounds)
	labels[rounds-1] = "Bowl"
	if rounds >= 2 {
		labels[0] = "Wildcard"
	}
	for i := 1; i < rounds-1; i++ {
		labels[i] = fmt.Sprintf("Playoff %d", i)
	}
	return labels
}

// GenerateBracket creates the full knockout skeleton for a competition in one
// shot: first-round matchups from the chosen teams, TBD matches for every
// later round down to the Bowl, and the feeds pointers that drive
// auto-advance. Byes place their team directly into the next round. Adjacent
// entries pair up (slots 1&2 meet next round, 3&4 meet, ...), which is what
// keeps the bracket ordered.
func (s *MatchService) GenerateBracket(ctx context.Context, competitionID string, req dto.GenerateBracketRequest) error {
	completed, knockout, err := s.competitionState(ctx, competitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
	}
	if !knockout {
		return fmt.Errorf("brackets can only be generated for knockout competitions")
	}

	existing, err := s.repo.CountMatchesByCompetition(ctx, competitionID)
	if err != nil {
		return err
	}
	if existing > 0 {
		return fmt.Errorf("this competition already has matches — reset the bracket first")
	}

	e := len(req.Entries)
	if e < 2 || e&(e-1) != 0 {
		return fmt.Errorf("the bracket needs 2, 4, 8 or 16 first-round slots (got %d)", e)
	}
	seen := map[string]bool{}
	claim := func(teamID, where string) error {
		if teamID == "" {
			return fmt.Errorf("%s is missing a team", where)
		}
		if seen[teamID] {
			return fmt.Errorf("a team appears more than once in the bracket")
		}
		seen[teamID] = true
		return nil
	}
	for i, en := range req.Entries {
		where := fmt.Sprintf("slot %d", i+1)
		if en.Bye {
			if err := claim(en.TeamID, where); err != nil {
				return err
			}
		} else {
			if err := claim(en.HomeTeamID, where); err != nil {
				return err
			}
			if err := claim(en.AwayTeamID, where); err != nil {
				return err
			}
		}
	}

	baseDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return fmt.Errorf("invalid date format, use YYYY-MM-DD")
	}
	startTime, _ := time.Parse("15:04", "00:00")
	if req.Time != "" {
		if startTime, err = time.Parse("15:04", req.Time); err != nil {
			return fmt.Errorf("invalid time format, use HH:MM")
		}
	}

	rounds := 1
	for n := e; n > 1; n /= 2 {
		rounds++
	}
	labels := bracketRoundLabels(rounds)
	posCounter := make([]int, rounds)

	mkMatch := func(level int, home, away string, parentID *string, slot string) (string, error) {
		posCounter[level]++
		pos := posCounter[level]
		m := &domain.Match{
			CompetitionID: competitionID,
			HomeTeamID:    home,
			AwayTeamID:    away,
			Date:          baseDate.AddDate(0, 0, 7*level), // one week per round; admin adjusts later
			StartTime:     startTime,
			Venue:         req.Venue,
			Status:        domain.MatchStatusScheduled,
			Round:         labels[level],
			BracketPos:    &pos,
			FeedsMatchID:  parentID,
			FeedsSlot:     slot,
		}
		if err := s.repo.CreateMatch(ctx, m); err != nil {
			return "", err
		}
		return m.ID, nil
	}

	// Recursive top-down build over entry index ranges: a span of size s sits
	// at round log2(s); the root (full span) is the Bowl. Parents are created
	// before children so feeds_match_id always has a target.
	var create func(lo, hi int, parentID *string, slot string) error
	create = func(lo, hi int, parentID *string, slot string) error {
		span := hi - lo
		if span == 1 {
			en := req.Entries[lo]
			if en.Bye {
				// No first-round game: the team goes straight into its
				// next-round slot.
				teamID := en.TeamID
				return s.repo.SetMatchSlot(ctx, *parentID, slot, &teamID)
			}
			_, err := mkMatch(0, en.HomeTeamID, en.AwayTeamID, parentID, slot)
			return err
		}
		level := 0
		for sp := span; sp > 1; sp /= 2 {
			level++
		}
		id, err := mkMatch(level, "", "", parentID, slot)
		if err != nil {
			return err
		}
		if err := create(lo, lo+span/2, &id, "HOME"); err != nil {
			return err
		}
		return create(lo+span/2, hi, &id, "AWAY")
	}
	return create(0, e, nil, "")
}

// ResetBracket wipes all matches of a knockout competition so the bracket can
// be set up again. Destructive: any recorded stats for those matches go too.
func (s *MatchService) ResetBracket(ctx context.Context, competitionID string) error {
	completed, knockout, err := s.competitionState(ctx, competitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
	}
	if !knockout {
		return fmt.Errorf("only knockout competitions have a bracket to reset")
	}
	return s.repo.DeleteMatchesByCompetition(ctx, competitionID)
}

// validateKnockoutMatch applies the rules specific to bracket matches, while
// league matches keep their original requirements.
func (s *MatchService) validateKnockoutMatch(ctx context.Context, match *domain.Match, knockout bool) error {
	if !knockout {
		if match.HomeTeamID == "" || match.AwayTeamID == "" {
			return fmt.Errorf("home and away teams are required for league matches")
		}
		// League matches don't carry bracket linkage.
		match.FeedsMatchID = nil
		match.FeedsSlot = ""
		match.Round = ""
		match.BracketPos = nil
		return nil
	}
	return s.validateBracketLink(ctx, match)
}

func (s *MatchService) CreateMatch(ctx context.Context, match *domain.Match) error {
	completed, knockout, err := s.competitionState(ctx, match.CompetitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
	}

	if match.Status == domain.MatchStatusFinished && (match.HomeScore == nil || match.AwayScore == nil) {
		return fmt.Errorf("home and away scores are required for finished matches")
	}
	if err := s.validateKnockoutMatch(ctx, match, knockout); err != nil {
		return err
	}

	if err := s.repo.CreateMatch(ctx, match); err != nil {
		return err
	}
	if knockout {
		// Knockout competitions never touch standings; winners flow down the
		// bracket instead (relevant when importing already-finished matches).
		return s.advanceWinner(ctx, match.ID)
	}
	if match.Status == domain.MatchStatusFinished {
		return s.repo.RecalculateStandings(ctx, match.CompetitionID)
	}
	return nil
}

func (s *MatchService) UpdateMatch(ctx context.Context, match *domain.Match) error {
	completed, knockout, err := s.competitionState(ctx, match.CompetitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
	}

	if match.Status == domain.MatchStatusFinished && (match.HomeScore == nil || match.AwayScore == nil) {
		return fmt.Errorf("home and away scores are required for finished matches")
	}
	if err := s.validateKnockoutMatch(ctx, match, knockout); err != nil {
		return err
	}

	if err := s.repo.UpdateMatch(ctx, match); err != nil {
		return err
	}
	if knockout {
		return s.advanceWinner(ctx, match.ID)
	}
	return s.repo.RecalculateStandings(ctx, match.CompetitionID)
}

func (s *MatchService) DeleteMatch(ctx context.Context, id string) error {
	existing, err := s.repo.GetMatchByID(ctx, id)
	if err != nil || existing == nil {
		return s.repo.DeleteMatch(ctx, id)
	}
	competitionID := existing.CompetitionID

	completed, knockout, err := s.competitionState(ctx, competitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
	}

	if err := s.repo.DeleteMatch(ctx, id); err != nil {
		return err
	}
	if knockout {
		return nil
	}
	return s.repo.RecalculateStandings(ctx, competitionID)
}

func (s *MatchService) RecalculateStandings(ctx context.Context, competitionID string) error {
	completed, knockout, err := s.competitionState(ctx, competitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
	}
	if knockout {
		return fmt.Errorf("knockout competitions do not have standings")
	}
	return s.repo.RecalculateStandings(ctx, competitionID)
}

func (s *MatchService) GetStandings(ctx context.Context, competitionID string) ([]dto.StandingResponse, error) {
	standings, err := s.repo.GetStandings(ctx, competitionID)
	if err != nil {
		return nil, err
	}

	var res []dto.StandingResponse
	for _, st := range standings {
		res = append(res, dto.StandingResponse{
			ID: st.ID,
			Team: &dto.TeamResponse{
				ID:        st.Team.ID,
				Name:      st.Team.Name,
				ShortName: st.Team.ShortName,
				Logo:      st.Team.Logo,
			},
			Position:     st.Position,
			Played:       st.Played,
			Won:          st.Won,
			Drawn:        st.Drawn,
			Lost:         st.Lost,
			GoalsFor:     st.GoalsFor,
			GoalsAgainst: st.GoalsAgainst,
			GoalDiff:     st.GoalDiff,
			PCT:          st.PCT,
			L5:           st.L5,
		})
	}
	return res, nil
}

func (s *MatchService) CreateStanding(ctx context.Context, standing *domain.Standing) error {
	completed, err := s.isCompleted(ctx, standing.CompetitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
	}
	return s.repo.CreateStanding(ctx, standing)
}

func (s *MatchService) UpdateStanding(ctx context.Context, standing *domain.Standing) error {
	completed, err := s.isCompleted(ctx, standing.CompetitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
	}
	return s.repo.UpdateStanding(ctx, standing)
}

func (s *MatchService) DeleteStanding(ctx context.Context, id string) error {
	existing, err := s.repo.GetStandingByID(ctx, id)
	if err != nil || existing == nil {
		return s.repo.DeleteStanding(ctx, id)
	}
	competitionID := existing.CompetitionID

	completed, err := s.isCompleted(ctx, competitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
	}
	return s.repo.DeleteStanding(ctx, id)
}

func (s *MatchService) GetTeamsByCompetition(ctx context.Context, competitionID string) ([]dto.TeamResponse, error) {
	teams, err := s.repo.GetTeamsByCompetition(ctx, competitionID)
	if err != nil {
		return nil, err
	}

	var res []dto.TeamResponse
	for _, t := range teams {
		res = append(res, dto.TeamResponse{
			ID:        t.ID,
			Name:      t.Name,
			ShortName: t.ShortName,
			Logo:      t.Logo,
		})
	}
	return res, nil
}

func (s *MatchService) CreateTeam(ctx context.Context, team *domain.Team) error {
	return s.repo.CreateTeam(ctx, team)
}

func (s *MatchService) UpdateTeam(ctx context.Context, team *domain.Team) error {
	if s.storage != nil {
		existing, err := s.repo.GetTeamByID(ctx, team.ID)
		if err == nil && existing != nil && existing.Logo != "" && existing.Logo != team.Logo {
			oldImage := existing.Logo
			log := logger.GetSingletonLogger()
			log.Info("Scheduling background delete of old team logo", map[string]any{"old_url": oldImage})
			if jobErr := SubmitJob(func() {
				if delErr := s.storage.DeleteObject(context.Background(), oldImage); delErr != nil {
					logger.GetSingletonLogger().Error("Failed to delete old team logo", map[string]any{"url": oldImage, "error": delErr.Error()})
				} else {
					logger.GetSingletonLogger().Info("Deleted old team logo from R2", map[string]any{"url": oldImage})
				}
			}); jobErr != nil {
				log.Error(fmt.Sprintf("Failed to submit delete job for team logo: %v", jobErr), nil)
			}
		}
	}
	return s.repo.UpdateTeam(ctx, team)
}

func (s *MatchService) DeleteTeam(ctx context.Context, id string) error {
	if s.storage != nil {
		existing, err := s.repo.GetTeamByID(ctx, id)
		if err == nil && existing != nil && existing.Logo != "" {
			oldImage := existing.Logo
			log := logger.GetSingletonLogger()
			log.Info("Scheduling background delete of team logo on record delete", map[string]any{"url": oldImage})
			if jobErr := SubmitJob(func() {
				if delErr := s.storage.DeleteObject(context.Background(), oldImage); delErr != nil {
					logger.GetSingletonLogger().Error("Failed to delete team logo on delete", map[string]any{"url": oldImage, "error": delErr.Error()})
				} else {
					logger.GetSingletonLogger().Info("Deleted team logo from R2", map[string]any{"url": oldImage})
				}
			}); jobErr != nil {
				log.Error(fmt.Sprintf("Failed to submit delete job for team logo: %v", jobErr), nil)
			}
		}
	}
	return s.repo.DeleteTeam(ctx, id)
}

func (s *MatchService) CreateCompetition(ctx context.Context, comp *domain.Competition) error {
	return s.repo.CreateCompetition(ctx, comp)
}

func (s *MatchService) UpdateCompetition(ctx context.Context, comp *domain.Competition) error {
	if s.storage != nil {
		existing, err := s.repo.GetCompetitionByID(ctx, comp.ID)
		if err == nil && existing != nil && existing.Logo != "" && existing.Logo != comp.Logo {
			oldImage := existing.Logo
			log := logger.GetSingletonLogger()
			log.Info("Scheduling background delete of old competition logo", map[string]any{"old_url": oldImage})
			if jobErr := SubmitJob(func() {
				if delErr := s.storage.DeleteObject(context.Background(), oldImage); delErr != nil {
					logger.GetSingletonLogger().Error("Failed to delete old competition logo", map[string]any{"url": oldImage, "error": delErr.Error()})
				} else {
					logger.GetSingletonLogger().Info("Deleted old competition logo from R2", map[string]any{"url": oldImage})
				}
			}); jobErr != nil {
				log.Error(fmt.Sprintf("Failed to submit delete job for competition logo: %v", jobErr), nil)
			}
		}
	}
	return s.repo.UpdateCompetition(ctx, comp)
}

func (s *MatchService) DeleteCompetition(ctx context.Context, id string) error {
	if s.storage != nil {
		existing, err := s.repo.GetCompetitionByID(ctx, id)
		if err == nil && existing != nil && existing.Logo != "" {
			oldImage := existing.Logo
			log := logger.GetSingletonLogger()
			log.Info("Scheduling background delete of competition logo on record delete", map[string]any{"url": oldImage})
			if jobErr := SubmitJob(func() {
				if delErr := s.storage.DeleteObject(context.Background(), oldImage); delErr != nil {
					logger.GetSingletonLogger().Error("Failed to delete competition logo on delete", map[string]any{"url": oldImage, "error": delErr.Error()})
				} else {
					logger.GetSingletonLogger().Info("Deleted competition logo from R2", map[string]any{"url": oldImage})
				}
			}); jobErr != nil {
				log.Error(fmt.Sprintf("Failed to submit delete job for competition logo: %v", jobErr), nil)
			}
		}
	}
	return s.repo.DeleteCompetition(ctx, id)
}

func (s *MatchService) SaveTeamSheet(ctx context.Context, matchID, teamID string, playerIDs []string) error {
	return s.repo.SaveTeamSheet(ctx, matchID, teamID, playerIDs)
}

func (s *MatchService) GetTeamSheet(ctx context.Context, matchID string) (*domain.MatchTeamSheet, error) {
	return s.repo.GetTeamSheet(ctx, matchID)
}

func (s *MatchService) GetMatchDetail(ctx context.Context, matchID string) (*domain.MatchDetail, error) {
	return s.repo.GetMatchDetail(ctx, matchID)
}

func (s *MatchService) GetMatchDaysByCompetition(ctx context.Context, competitionID string) ([]string, error) {
	return s.repo.GetMatchDaysByCompetition(ctx, competitionID)
}

func (s *MatchService) GetEligiblePlayersForMatchDay(ctx context.Context, competitionID string, date string) ([]domain.Player, error) {
	return s.repo.GetEligiblePlayersForMatchDay(ctx, competitionID, date)
}

