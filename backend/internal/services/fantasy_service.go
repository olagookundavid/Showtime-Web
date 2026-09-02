package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type IFantasyService interface {
	// Admin
	CreateSeason(ctx context.Context, req dto.CreateFantasySeasonRequest) (*dto.FantasySeasonResponse, error)
	ActivateSeason(ctx context.Context, seasonID string) error
	DeleteSeason(ctx context.Context, seasonID string) error
	CreateGameweek(ctx context.Context, seasonID string, req dto.CreateGameweekRequest) (*dto.GameweekResponse, error)
	UpdateGameweekDeadline(ctx context.Context, gameweekID string, req dto.UpdateGameweekDeadlineRequest) (*dto.GameweekResponse, error)
	InitializePlayerPrices(ctx context.Context, seasonID string) error
	FinalizeGameweek(ctx context.Context, gameweekID string) error
	AutoLockGameweeks(ctx context.Context) error

	// User Operations
	GetActiveSeason(ctx context.Context) (*dto.FantasySeasonResponse, error)
	ListSeasons(ctx context.Context) ([]dto.FantasySeasonResponse, error)
	GetGameweeks(ctx context.Context, seasonID string) ([]dto.GameweekResponse, error)
	ListPlayerMarket(ctx context.Context, seasonID string, positions []string, gender, teamID, search, sortBy string, page, limit int) ([]dto.FantasyPlayerListItem, int, error)
	EnterSeason(ctx context.Context, userID, seasonID string, req dto.EnterSeasonRequest) (*dto.DashboardTeam, error)
	GetDashboard(ctx context.Context, userID, seasonID string) (*dto.FantasyDashboardResponse, error)
	SaveLineup(ctx context.Context, userID string, req dto.SaveLineupRequest) (*dto.FantasyLineupResponse, error)
	GetMyLineup(ctx context.Context, userID, seasonID, gameweekID string) (*dto.FantasyLineupResponse, error)
	GetPlayerBreakdown(ctx context.Context, playerID, gameweekID string) (*dto.PlayerGWBreakdownResponse, error)

	// Core Engine
	ComputeGameweekScores(ctx context.Context, gameweekID string) error
}

// Season defaults, applied when the admin omits a field on creation.
const (
	defaultSquadSize        = 14
	defaultBudget           = 230.00
	defaultMinFemaleOffense = 3
	defaultMinFemaleDefense = 3
	defaultMaxPerClub       = 4
	defaultLockMinsBefore   = 15
	defaultBasePrice        = 10.00
)

type FantasyService struct {
	repo       ports.IFantasyRepository
	leagueRepo ports.IFantasyLeagueRepository
	playerRepo ports.PlayerRepository
	matchRepo  ports.MatchRepository
}

func NewFantasyService(
	repo ports.IFantasyRepository,
	leagueRepo ports.IFantasyLeagueRepository,
	playerRepo ports.PlayerRepository,
	matchRepo ports.MatchRepository,
) IFantasyService {
	return &FantasyService{
		repo:       repo,
		leagueRepo: leagueRepo,
		playerRepo: playerRepo,
		matchRepo:  matchRepo,
	}
}

// ─── Admin Methods ────────────────────────────────────────────────────────────

func (s *FantasyService) CreateSeason(ctx context.Context, req dto.CreateFantasySeasonRequest) (*dto.FantasySeasonResponse, error) {
	season := &domain.FantasySeason{
		CompetitionID:    req.CompetitionID,
		Name:             req.Name,
		SquadSize:        defaultSquadSize,
		Budget:           floatOr(req.Budget, defaultBudget),
		MinFemaleOffense: intOr(req.MinFemaleOffense, defaultMinFemaleOffense),
		MinFemaleDefense: intOr(req.MinFemaleDefense, defaultMinFemaleDefense),
		MaxPerClub:       intOr(req.MaxPerClub, defaultMaxPerClub),
		LockMinsBefore:   intOr(req.LockMinsBefore, defaultLockMinsBefore),
		Status:           domain.FantasySeasonDraft,
	}

	if err := s.repo.CreateSeason(ctx, season); err != nil {
		return nil, err
	}

	// The season's OVERALL league is system-owned: it has no human creator, and
	// every manager belongs to it implicitly. Failing to create it is a real
	// error, not something to swallow — the mini-league UI depends on it.
	overall := &domain.FantasyLeague{
		SeasonID:        season.ID,
		Name:            season.Name + " — Official League",
		Type:            domain.LeagueTypeOverall,
		CreatedByUserID: nil,
		EntryFee:        0,
		MaxMembers:      0,
	}
	if err := s.leagueRepo.CreateLeague(ctx, overall); err != nil {
		return nil, fmt.Errorf("season created but its official league could not be set up: %w", err)
	}

	return seasonResponse(season), nil
}

// ActivateSeason publishes a season to players. Only one season may be live at
// a time: players are served "the active season", so a second one would leave
// the game silently showing whichever sorted first, with no indication that
// another existed.
func (s *FantasyService) ActivateSeason(ctx context.Context, seasonID string) error {
	season, err := s.repo.GetSeasonByID(ctx, seasonID)
	if err != nil {
		return err
	}
	if season == nil {
		return errors.New("season not found")
	}
	if season.Status == domain.FantasySeasonActive {
		return errors.New("this season is already live")
	}
	if season.Status == domain.FantasySeasonCompleted {
		return errors.New("this season has been completed and cannot be reopened")
	}

	live, err := s.repo.GetActiveSeason(ctx)
	if err != nil {
		return err
	}
	if live != nil && live.ID != seasonID {
		return fmt.Errorf("%q is already live — complete it before releasing another season", live.Name)
	}

	return s.repo.UpdateSeasonStatus(ctx, seasonID, domain.FantasySeasonActive)
}

// DeleteSeason discards a draft season, for clearing up ones created by
// mistake. The repository refuses anything already launched or entered.
func (s *FantasyService) DeleteSeason(ctx context.Context, seasonID string) error {
	return s.repo.DeleteSeason(ctx, seasonID)
}

// CreateGameweek registers a match day. The submission deadline is the event
// day's first kickoff minus the season's lock_mins_before, unless the admin
// supplies an explicit override.
func (s *FantasyService) CreateGameweek(ctx context.Context, seasonID string, req dto.CreateGameweekRequest) (*dto.GameweekResponse, error) {
	season, err := s.repo.GetSeasonByID(ctx, seasonID)
	if err != nil {
		return nil, err
	}
	if season == nil {
		return nil, errors.New("season not found")
	}

	kickoff, err := s.repo.GetEventDayFirstKickoff(ctx, req.EventDayID)
	if err != nil {
		return nil, err
	}

	deadline, err := resolveDeadline(req.Deadline, kickoff, season.LockMinsBefore)
	if err != nil {
		return nil, err
	}

	gw := &domain.FantasyGameweek{
		SeasonID:   seasonID,
		Number:     req.Number,
		EventDayID: req.EventDayID,
		Deadline:   deadline,
		Status:     domain.GameweekScheduled,
	}
	if err := s.repo.CreateGameweek(ctx, gw); err != nil {
		return nil, err
	}

	return gameweekResponse(gw, kickoff), nil
}

func (s *FantasyService) UpdateGameweekDeadline(ctx context.Context, gameweekID string, req dto.UpdateGameweekDeadlineRequest) (*dto.GameweekResponse, error) {
	deadline, err := time.Parse(time.RFC3339, req.Deadline)
	if err != nil {
		return nil, fmt.Errorf("deadline must be an RFC3339 timestamp: %w", err)
	}

	if err := s.repo.UpdateGameweekDeadline(ctx, gameweekID, deadline); err != nil {
		return nil, err
	}

	gw, err := s.repo.GetGameweekByID(ctx, gameweekID)
	if err != nil {
		return nil, err
	}
	if gw == nil {
		return nil, errors.New("gameweek not found")
	}
	kickoff, _ := s.repo.GetEventDayFirstKickoff(ctx, gw.EventDayID)
	return gameweekResponse(gw, kickoff), nil
}

// resolveDeadline turns an optional RFC3339 override plus the day's first
// kickoff into a concrete lock time.
func resolveDeadline(override string, kickoff *time.Time, lockMinsBefore int) (time.Time, error) {
	if override != "" {
		d, err := time.Parse(time.RFC3339, override)
		if err != nil {
			return time.Time{}, fmt.Errorf("deadline must be an RFC3339 timestamp: %w", err)
		}
		return d, nil
	}
	if kickoff == nil {
		return time.Time{}, errors.New("this event day has no fixtures yet, so a lock deadline cannot be derived — schedule its matches first, or supply an explicit deadline")
	}
	return kickoff.Add(-time.Duration(lockMinsBefore) * time.Minute), nil
}

// InitializePlayerPrices sets each player's opening price for the season from
// their current rating.
func (s *FantasyService) InitializePlayerPrices(ctx context.Context, seasonID string) error {
	return s.repriceSeason(ctx, seasonID, nil)
}

// repriceSeason recomputes every player's price from their season-to-date
// rating and stores it against gameweekID (nil writes the season's opening
// price). Price scales linearly with rating around the 5.0 baseline, so a
// 10.0-rated player costs double a 5.0-rated one. Players with no rateable
// activity hold the baseline rather than collapsing to zero.
func (s *FantasyService) repriceSeason(ctx context.Context, seasonID string, gameweekID *string) error {
	season, err := s.repo.GetSeasonByID(ctx, seasonID)
	if err != nil {
		return err
	}
	if season == nil {
		return errors.New("season not found")
	}

	lines, err := s.repo.GetSeasonRatingLines(ctx, season.CompetitionID)
	if err != nil {
		return fmt.Errorf("failed to load player ratings: %w", err)
	}

	prices := make([]domain.FantasyPlayerPrice, 0, len(lines))
	for _, l := range lines {
		rating := 5.0
		// RateByPosition returns nil for positions with no formula ("-"), and an
		// UNRATED result for a player with no qualifying activity. Both hold the
		// neutral baseline price.
		if res := domain.RateByPosition(l.Position, l.Line); res != nil && res.Status != domain.RatingStatusUnrated {
			rating = res.FinalRating
		}
		prices = append(prices, domain.FantasyPlayerPrice{
			SeasonID:   seasonID,
			PlayerID:   l.PlayerID,
			GameweekID: gameweekID,
			BasePrice:  defaultBasePrice,
			Rating:     rating,
			Price:      domain.CalculatePlayerPrice(defaultBasePrice, rating),
		})
	}

	return s.repo.BulkUpsertPlayerPrices(ctx, prices)
}

// FinalizeGameweek scores a match day and settles the standings. It is safe to
// re-run: scores are recomputed and team totals rebuilt from scratch, so a
// corrected stat can be applied by simply finalising again.
func (s *FantasyService) FinalizeGameweek(ctx context.Context, gameweekID string) error {
	gw, err := s.repo.GetGameweekByID(ctx, gameweekID)
	if err != nil {
		return err
	}
	if gw == nil {
		return errors.New("gameweek not found")
	}

	// A gameweek can reach finalisation without the lock cron having run (a
	// restart across the deadline, say). Lock any stragglers first, otherwise
	// their lineups are still DRAFT and would silently score nothing.
	if err := s.lockAndRollOver(ctx, *gw); err != nil {
		return fmt.Errorf("failed to lock lineups before scoring: %w", err)
	}

	if err := s.ComputeGameweekScores(ctx, gameweekID); err != nil {
		return fmt.Errorf("failed to compute gameweek scores: %w", err)
	}

	// Reprice from post-gameweek ratings so the next match day's market
	// reflects form. A pricing failure must not undo a successful scoring run.
	if err := s.repriceSeason(ctx, gw.SeasonID, nil); err != nil {
		return fmt.Errorf("scores were finalised, but repricing the player market failed: %w", err)
	}

	return s.repo.UpdateGameweekStatus(ctx, gameweekID, domain.GameweekFinalized)
}

func (s *FantasyService) AutoLockGameweeks(ctx context.Context) error {
	dueGWs, err := s.repo.GetGameweeksDueForLock(ctx)
	if err != nil {
		return err
	}

	var failures []error
	for _, gw := range dueGWs {
		if err := s.lockAndRollOver(ctx, gw); err != nil {
			failures = append(failures, fmt.Errorf("gameweek %d: %w", gw.Number, err))
			continue
		}
		if err := s.repo.UpdateGameweekStatus(ctx, gw.ID, domain.GameweekLocked); err != nil {
			failures = append(failures, fmt.Errorf("gameweek %d status: %w", gw.Number, err))
		}
	}
	return errors.Join(failures...)
}

// lockAndRollOver locks every draft lineup for a gameweek, then carries forward
// the most recent locked lineup for any team that didn't submit one — the
// "set and forget" manager keeps scoring without touching their squad.
func (s *FantasyService) lockAndRollOver(ctx context.Context, gw domain.FantasyGameweek) error {
	if err := s.repo.LockLineupsForGameweek(ctx, gw.ID); err != nil {
		return fmt.Errorf("failed to lock draft lineups: %w", err)
	}

	teams, err := s.repo.ListAllActiveTeamsInSeason(ctx, gw.SeasonID)
	if err != nil {
		return fmt.Errorf("failed to list teams for rollover: %w", err)
	}

	var failures []error
	for _, tm := range teams {
		existing, err := s.repo.GetLineup(ctx, tm.ID, gw.ID)
		if err != nil {
			failures = append(failures, fmt.Errorf("team %s: %w", tm.ID, err))
			continue
		}
		if existing != nil {
			continue
		}

		prior, err := s.repo.GetLatestPriorLockedLineup(ctx, tm.ID, gw.Number)
		if err != nil {
			failures = append(failures, fmt.Errorf("team %s: %w", tm.ID, err))
			continue
		}
		// A brand-new team with no prior submission simply sits this one out.
		if prior == nil || len(prior.Picks) != len(domain.AllValidSlots) {
			continue
		}
		if err := s.repo.CloneLineupToGameweek(ctx, prior, gw.ID); err != nil {
			failures = append(failures, fmt.Errorf("team %s rollover: %w", tm.ID, err))
		}
	}
	return errors.Join(failures...)
}

// ─── User Operations ──────────────────────────────────────────────────────────

func (s *FantasyService) GetActiveSeason(ctx context.Context) (*dto.FantasySeasonResponse, error) {
	season, err := s.repo.GetActiveSeason(ctx)
	if err != nil {
		return nil, err
	}
	if season == nil {
		return nil, nil
	}
	return seasonResponse(season), nil
}

// ListSeasons powers the admin season picker. It returns drafts too, which is
// the only way an admin can reach a newly created season to activate it.
func (s *FantasyService) ListSeasons(ctx context.Context) ([]dto.FantasySeasonResponse, error) {
	list, err := s.repo.ListSeasons(ctx)
	if err != nil {
		return nil, err
	}
	res := make([]dto.FantasySeasonResponse, 0, len(list))
	for i := range list {
		res = append(res, *seasonResponse(&list[i]))
	}
	return res, nil
}

func (s *FantasyService) GetGameweeks(ctx context.Context, seasonID string) ([]dto.GameweekResponse, error) {
	list, err := s.repo.ListGameweeks(ctx, seasonID)
	if err != nil {
		return nil, err
	}

	res := make([]dto.GameweekResponse, 0, len(list))
	for i := range list {
		res = append(res, *gameweekResponse(&list[i], nil))
	}
	return res, nil
}

func (s *FantasyService) ListPlayerMarket(ctx context.Context, seasonID string, positions []string, gender, teamID, search, sortBy string, page, limit int) ([]dto.FantasyPlayerListItem, int, error) {
	return s.repo.ListPlayerMarket(ctx, seasonID, positions, gender, teamID, search, sortBy, page, limit)
}

// EnterSeason signs a manager up, creating their team. This is the only place a
// team is created: joining is always something the manager chose to do, never a
// side effect of another action. Re-entering just renames an existing team, so
// a double submit is harmless.
func (s *FantasyService) EnterSeason(ctx context.Context, userID, seasonID string, req dto.EnterSeasonRequest) (*dto.DashboardTeam, error) {
	season, err := s.repo.GetSeasonByID(ctx, seasonID)
	if err != nil {
		return nil, err
	}
	if season == nil {
		return nil, errors.New("season not found")
	}
	if season.Status != domain.FantasySeasonActive {
		return nil, errors.New("this season is not open for entry")
	}

	team, err := s.repo.GetOrCreateTeam(ctx, userID, seasonID, strings.TrimSpace(req.TeamName))
	if err != nil {
		return nil, fmt.Errorf("failed to enter the season: %w", err)
	}

	rank, total, err := s.repo.GetTeamOverallRank(ctx, seasonID, team.ID)
	if err != nil {
		return nil, err
	}

	return &dto.DashboardTeam{
		ID: team.ID, Name: team.Name, TotalPoints: team.TotalPoints,
		OverallRank: rank, TotalManagers: total,
	}, nil
}

// GetDashboard assembles the manager's weekly landing view. It works before
// entry too — an un-entered visitor gets the season and the standings, which is
// what the "join this season" screen shows.
func (s *FantasyService) GetDashboard(ctx context.Context, userID, seasonID string) (*dto.FantasyDashboardResponse, error) {
	var season *domain.FantasySeason
	var err error
	if seasonID == "" {
		season, err = s.repo.GetActiveSeason(ctx)
	} else {
		season, err = s.repo.GetSeasonByID(ctx, seasonID)
	}
	if err != nil {
		return nil, err
	}
	if season == nil {
		return nil, nil
	}

	res := &dto.FantasyDashboardResponse{
		Season:      *seasonResponse(season),
		Leagues:     make([]dto.DashboardLeagueRow, 0),
		TopManagers: make([]dto.LeaderboardEntry, 0),
	}

	// The gameweek the manager cares about: the one still open, else the latest.
	gw, err := s.repo.GetCurrentGameweek(ctx, season.ID)
	if err != nil {
		return nil, err
	}
	if gw != nil {
		res.CurrentGameweek = gameweekResponse(gw, nil)
		res.DeadlinePassed = time.Now().After(gw.Deadline)
	}

	if top, _, err := s.leagueRepo.GetOverallLeaderboard(ctx, season.ID, nil, 1, 5); err == nil {
		res.TopManagers = top
	}

	team, err := s.repo.GetTeamByUserAndSeason(ctx, userID, season.ID)
	if err != nil {
		return nil, err
	}
	if team == nil {
		return res, nil // not entered yet
	}
	res.Entered = true

	rank, total, err := s.repo.GetTeamOverallRank(ctx, season.ID, team.ID)
	if err != nil {
		return nil, err
	}
	res.Team = &dto.DashboardTeam{
		ID: team.ID, Name: team.Name, TotalPoints: team.TotalPoints,
		OverallRank: rank, TotalManagers: total,
	}

	if leagues, err := s.leagueRepo.ListMyLeaguesWithRank(ctx, userID, season.ID); err == nil {
		res.Leagues = leagues
	}

	if gw != nil {
		lineup, err := s.GetMyLineup(ctx, userID, season.ID, gw.ID)
		if err != nil {
			return nil, err
		}
		res.Lineup = lineup
		if lineup != nil {
			res.Team.GameweekPoints = lineup.Points
		}
	}

	return res, nil
}

// SaveLineup validates and persists a manager's squad for a gameweek. Every
// squad rule is enforced here — the client mirrors these checks for feedback,
// but this is the authority.
func (s *FantasyService) SaveLineup(ctx context.Context, userID string, req dto.SaveLineupRequest) (*dto.FantasyLineupResponse, error) {
	season, err := s.repo.GetSeasonByID(ctx, req.SeasonID)
	if err != nil {
		return nil, err
	}
	if season == nil {
		return nil, errors.New("season not found")
	}
	if season.Status != domain.FantasySeasonActive {
		return nil, errors.New("season is not currently active")
	}

	gw, err := s.repo.GetGameweekByID(ctx, req.GameweekID)
	if err != nil {
		return nil, err
	}
	if gw == nil {
		return nil, errors.New("gameweek not found")
	}
	if gw.SeasonID != season.ID {
		return nil, errors.New("gameweek does not belong to this season")
	}
	if gw.Status != domain.GameweekScheduled {
		return nil, errors.New("gameweek is locked or finalized; modifications not permitted")
	}
	if time.Now().After(gw.Deadline) {
		return nil, errors.New("the deadline for this match day has passed")
	}

	// Resolve every player's position, gender, club and price in one query.
	playerIDs := make([]string, 0, len(req.Picks))
	for _, p := range req.Picks {
		playerIDs = append(playerIDs, p.PlayerID)
	}
	candidates, err := s.repo.GetLineupCandidates(ctx, season.ID, gw.ID, playerIDs)
	if err != nil {
		return nil, err
	}

	picks := make([]domain.LineupCandidate, 0, len(req.Picks))
	for _, p := range req.Picks {
		c, ok := candidates[p.PlayerID]
		if !ok {
			return nil, fmt.Errorf("player %s not found", p.PlayerID)
		}
		c.Slot = p.Slot
		picks = append(picks, c)
	}

	totals, err := domain.ValidateLineup(picks, domain.LineupRules{
		Budget:           season.Budget,
		MinFemaleOffense: season.MinFemaleOffense,
		MinFemaleDefense: season.MinFemaleDefense,
		MaxPerClub:       season.MaxPerClub,
	})
	if err != nil {
		return nil, err
	}

	// Entering a season is a deliberate act (EnterSeason), never a side effect
	// of saving a squad — a manager should never find themselves signed up to
	// something they did not choose. Saving a lineup renames their existing
	// entry at most.
	team, err := s.repo.GetTeamByUserAndSeason(ctx, userID, season.ID)
	if err != nil {
		return nil, err
	}
	if team == nil {
		return nil, errors.New("join this season before picking a squad")
	}
	if req.TeamName != "" && req.TeamName != team.Name {
		if team, err = s.repo.GetOrCreateTeam(ctx, userID, season.ID, req.TeamName); err != nil {
			return nil, fmt.Errorf("failed to rename your team: %w", err)
		}
	}

	lineupPicks := make([]domain.FantasyLineupPick, 0, len(picks))
	responsePicks := make([]dto.FantasyLineupPickResponse, 0, len(picks))
	for _, p := range picks {
		lineupPicks = append(lineupPicks, domain.FantasyLineupPick{
			PlayerID:      p.PlayerID,
			Slot:          p.Slot,
			PurchasePrice: p.Price,
		})
		responsePicks = append(responsePicks, dto.FantasyLineupPickResponse{
			Slot:          string(p.Slot),
			PlayerID:      p.PlayerID,
			PlayerName:    p.Name,
			Position:      p.Position,
			Gender:        domain.NormalizeGender(p.Gender),
			TeamID:        p.TeamID,
			PurchasePrice: p.Price,
			CurrentPrice:  p.Price,
		})
	}

	lineup := &domain.FantasyLineup{
		TeamID:     team.ID,
		GameweekID: gw.ID,
		TotalSpent: totals.TotalSpent,
		Status:     domain.LineupDraft,
	}
	if err := s.repo.SaveLineupDraft(ctx, lineup, lineupPicks); err != nil {
		return nil, fmt.Errorf("failed to save lineup: %w", err)
	}

	return &dto.FantasyLineupResponse{
		ID:         lineup.ID,
		TeamID:     team.ID,
		TeamName:   team.Name,
		GameweekID: gw.ID,
		TotalSpent: totals.TotalSpent,
		Remaining:  season.Budget - totals.TotalSpent,
		Status:     string(lineup.Status),
		Picks:      responsePicks,
	}, nil
}

func (s *FantasyService) GetMyLineup(ctx context.Context, userID, seasonID, gameweekID string) (*dto.FantasyLineupResponse, error) {
	team, err := s.repo.GetTeamByUserAndSeason(ctx, userID, seasonID)
	if err != nil {
		return nil, err
	}
	if team == nil {
		return nil, nil
	}

	lineup, err := s.repo.GetLineup(ctx, team.ID, gameweekID)
	if err != nil {
		return nil, err
	}

	season, err := s.repo.GetSeasonByID(ctx, seasonID)
	if err != nil {
		return nil, err
	}
	budget := defaultBudget
	if season != nil {
		budget = season.Budget
	}

	// With no lineup of its own for this gameweek, the team's previous locked
	// squad is what will actually roll over and score — so show that, flagged.
	isRollover := false
	if lineup == nil {
		gw, err := s.repo.GetGameweekByID(ctx, gameweekID)
		if err != nil {
			return nil, err
		}
		if gw != nil {
			prior, err := s.repo.GetLatestPriorLockedLineup(ctx, team.ID, gw.Number)
			if err != nil {
				return nil, err
			}
			if prior != nil {
				lineup = prior
				isRollover = true
			}
		}
	}
	if lineup == nil {
		return nil, nil
	}

	picks := make([]dto.FantasyLineupPickResponse, 0, len(lineup.Picks))
	for _, p := range lineup.Picks {
		item := dto.FantasyLineupPickResponse{
			Slot:          string(p.Slot),
			PlayerID:      p.PlayerID,
			PurchasePrice: p.PurchasePrice,
			CurrentPrice:  p.PurchasePrice,
			Points:        p.Points,
		}
		if p.Player != nil {
			item.PlayerName = p.Player.Name
			item.PlayerImage = p.Player.Image
			item.Position = p.Player.Position
			item.Gender = domain.NormalizeGender(p.Player.Gender)
			item.TeamID = p.Player.TeamID
			if p.Player.Team != nil {
				item.TeamName = p.Player.Team.Name
				item.TeamShortName = p.Player.Team.ShortName
				item.TeamLogo = p.Player.Team.Logo
			}
		}
		picks = append(picks, item)
	}

	return &dto.FantasyLineupResponse{
		ID:         lineup.ID,
		TeamID:     team.ID,
		TeamName:   team.Name,
		GameweekID: gameweekID,
		TotalSpent: lineup.TotalSpent,
		Remaining:  budget - lineup.TotalSpent,
		Points:     lineup.Points,
		Status:     string(lineup.Status),
		IsRollover: isRollover,
		Picks:      picks,
	}, nil
}

// GetPlayerBreakdown scores a player's gameweek directly from the official
// stat lines rather than from the points log, so it reflects live stat entry
// before the gameweek has been finalised.
func (s *FantasyService) GetPlayerBreakdown(ctx context.Context, playerID, gameweekID string) (*dto.PlayerGWBreakdownResponse, error) {
	gw, err := s.repo.GetGameweekByID(ctx, gameweekID)
	if err != nil {
		return nil, err
	}
	if gw == nil {
		return nil, nil
	}

	stats, err := s.repo.GetPlayerStatsByEventDay(ctx, gw.EventDayID)
	if err != nil {
		return nil, err
	}

	calc := domain.FantasyWeights{}
	var parts []domain.FantasyPointsBreakdown
	matchID := ""
	for _, st := range stats {
		if st.PlayerID != playerID {
			continue
		}
		if matchID == "" {
			matchID = st.MatchID
		}
		parts = append(parts, calc.Calculate(st))
	}
	if len(parts) == 0 {
		return nil, nil
	}

	total := domain.SumBreakdowns(parts)

	name := playerID
	if player, err := s.playerRepo.GetPlayerByID(ctx, playerID); err == nil && player != nil {
		name = player.Name
	}

	return &dto.PlayerGWBreakdownResponse{
		PlayerID:   playerID,
		PlayerName: name,
		MatchID:    matchID,
		MatchLabel: fmt.Sprintf("Match Day %d", gw.Number),
		Points:     total.NetTotal,
		Breakdown:  total,
	}, nil
}

// ─── Scoring Engine ───────────────────────────────────────────────────────────

// ComputeGameweekScores scores every locked lineup for a gameweek from the
// official player_stats for that match day. It is idempotent: the points log is
// upserted, lineup and pick scores are overwritten, and season totals are
// rebuilt as a sum rather than incremented — so re-running after a stat
// correction produces the right standings instead of double-counting.
func (s *FantasyService) ComputeGameweekScores(ctx context.Context, gameweekID string) error {
	gw, err := s.repo.GetGameweekByID(ctx, gameweekID)
	if err != nil {
		return err
	}
	if gw == nil {
		return errors.New("gameweek not found")
	}

	stats, err := s.repo.GetPlayerStatsByEventDay(ctx, gw.EventDayID)
	if err != nil {
		return fmt.Errorf("failed to get player stats for gameweek: %w", err)
	}

	// Score each player's match once, then fan the result out to the squads
	// that own them — the arithmetic doesn't depend on who picked whom.
	calc := domain.FantasyWeights{}
	type matchScore struct {
		matchID   string
		points    float64
		breakdown domain.FantasyPointsBreakdown
	}
	scoresByPlayer := make(map[string][]matchScore, len(stats))
	for _, st := range stats {
		b := calc.Calculate(st)
		scoresByPlayer[st.PlayerID] = append(scoresByPlayer[st.PlayerID], matchScore{
			matchID:   st.MatchID,
			points:    b.NetTotal,
			breakdown: b,
		})
	}

	lineups, err := s.repo.GetLockedLineupsForGameweek(ctx, gameweekID)
	if err != nil {
		return fmt.Errorf("failed to load locked lineups: %w", err)
	}

	var pointsLog []domain.FantasyGWPoints
	for _, lineup := range lineups {
		var lineupTotal float64
		pickPoints := make(map[string]float64, len(lineup.Picks))

		for _, pick := range lineup.Picks {
			var playerTotal float64
			for _, ms := range scoresByPlayer[pick.PlayerID] {
				playerTotal += ms.points
				pointsLog = append(pointsLog, domain.FantasyGWPoints{
					TeamID:     lineup.TeamID,
					GameweekID: gw.ID,
					PlayerID:   pick.PlayerID,
					MatchID:    ms.matchID,
					Points:     ms.points,
					Breakdown:  ms.breakdown,
				})
			}
			pickPoints[pick.PlayerID] = playerTotal
			lineupTotal += playerTotal
		}

		if err := s.repo.UpdateLineupPickPoints(ctx, lineup.ID, pickPoints); err != nil {
			return err
		}
		if err := s.repo.UpdateLineupPoints(ctx, lineup.ID, lineupTotal); err != nil {
			return err
		}
	}

	if err := s.repo.BulkUpsertGWPoints(ctx, pointsLog); err != nil {
		return err
	}

	return s.repo.RecalculateAllTeamTotalsInSeason(ctx, gw.SeasonID)
}

// ─── Response helpers ─────────────────────────────────────────────────────────

func seasonResponse(s *domain.FantasySeason) *dto.FantasySeasonResponse {
	return &dto.FantasySeasonResponse{
		ID:               s.ID,
		CompetitionID:    s.CompetitionID,
		Name:             s.Name,
		SquadSize:        s.SquadSize,
		Budget:           s.Budget,
		MinFemaleOffense: s.MinFemaleOffense,
		MinFemaleDefense: s.MinFemaleDefense,
		MaxPerClub:       s.MaxPerClub,
		LockMinsBefore:   s.LockMinsBefore,
		Status:           string(s.Status),
		CreatedAt:        s.CreatedAt.Format(time.RFC3339),
	}
}

func gameweekResponse(gw *domain.FantasyGameweek, kickoff *time.Time) *dto.GameweekResponse {
	res := &dto.GameweekResponse{
		ID:         gw.ID,
		SeasonID:   gw.SeasonID,
		Number:     gw.Number,
		EventDayID: gw.EventDayID,
		Deadline:   gw.Deadline.Format(time.RFC3339),
		Status:     string(gw.Status),
	}
	if kickoff != nil {
		res.FirstKickoff = kickoff.Format(time.RFC3339)
	}
	return res
}

func intOr(v *int, fallback int) int {
	if v == nil {
		return fallback
	}
	return *v
}

func floatOr(v *float64, fallback float64) float64 {
	if v == nil || *v <= 0 {
		return fallback
	}
	return *v
}
