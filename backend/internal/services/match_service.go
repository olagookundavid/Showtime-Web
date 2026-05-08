package services

import (
	"context"
	"fmt"
	"pkg-common/logger"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
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
				ID:   m.Competition.ID,
				Name: m.Competition.Name,
				Logo: m.Competition.Logo,
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

func (s *MatchService) CreateMatch(ctx context.Context, match *domain.Match) error {
	completed, err := s.isCompleted(ctx, match.CompetitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
	}

	if match.Status == domain.MatchStatusFinished && (match.HomeScore == nil || match.AwayScore == nil) {
		return fmt.Errorf("home and away scores are required for finished matches")
	}

	if err := s.repo.CreateMatch(ctx, match); err != nil {
		return err
	}
	if match.Status == domain.MatchStatusFinished {
		return s.repo.RecalculateStandings(ctx, match.CompetitionID)
	}
	return nil
}

func (s *MatchService) UpdateMatch(ctx context.Context, match *domain.Match) error {
	completed, err := s.isCompleted(ctx, match.CompetitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
	}

	if match.Status == domain.MatchStatusFinished && (match.HomeScore == nil || match.AwayScore == nil) {
		return fmt.Errorf("home and away scores are required for finished matches")
	}

	if err := s.repo.UpdateMatch(ctx, match); err != nil {
		return err
	}
	return s.repo.RecalculateStandings(ctx, match.CompetitionID)
}

func (s *MatchService) DeleteMatch(ctx context.Context, id string) error {
	existing, err := s.repo.GetMatchByID(ctx, id)
	if err != nil || existing == nil {
		return s.repo.DeleteMatch(ctx, id)
	}
	competitionID := existing.CompetitionID

	completed, err := s.isCompleted(ctx, competitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
	}

	if err := s.repo.DeleteMatch(ctx, id); err != nil {
		return err
	}
	return s.repo.RecalculateStandings(ctx, competitionID)
}

func (s *MatchService) RecalculateStandings(ctx context.Context, competitionID string) error {
	completed, err := s.isCompleted(ctx, competitionID)
	if err != nil {
		return err
	}
	if completed {
		return fmt.Errorf("competition is completed and cannot be modified")
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

