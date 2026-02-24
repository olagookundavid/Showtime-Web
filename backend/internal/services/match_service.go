package services

import (
	"context"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type IMatchService interface {
	GetCompetitions(ctx context.Context) ([]dto.CompetitionResponse, error)
	GetTeams(ctx context.Context) ([]dto.TeamResponse, error)
	GetMatches(ctx context.Context, competitionID string, status string, page, limit int) (dto.PaginatedResult[dto.MatchResponse], error)
	GetStandings(ctx context.Context, competitionID string) ([]dto.StandingResponse, error)
	CreateMatch(ctx context.Context, match *domain.Match) error
	UpdateMatch(ctx context.Context, match *domain.Match) error
	DeleteMatch(ctx context.Context, id string) error
	CreateStanding(ctx context.Context, standing *domain.Standing) error
	UpdateStanding(ctx context.Context, standing *domain.Standing) error
	DeleteStanding(ctx context.Context, id string) error
}

type MatchService struct {
	repo ports.MatchRepository
}

func NewMatchService(repo ports.MatchRepository) IMatchService {
	return &MatchService{repo: repo}
}

func (s *MatchService) GetCompetitions(ctx context.Context) ([]dto.CompetitionResponse, error) {
	competitions, err := s.repo.GetCompetitions(ctx)
	if err != nil {
		return nil, err
	}

	var res []dto.CompetitionResponse
	for _, c := range competitions {
		res = append(res, dto.CompetitionResponse{
			ID:   c.ID,
			Name: c.Name,
			Logo: c.Logo,
		})
	}
	return res, nil
}

func (s *MatchService) GetTeams(ctx context.Context) ([]dto.TeamResponse, error) {
	teams, err := s.repo.GetTeams(ctx)
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

func (s *MatchService) GetMatches(ctx context.Context, competitionID string, status string, page, limit int) (dto.PaginatedResult[dto.MatchResponse], error) {
	matches, total, err := s.repo.GetMatches(ctx, competitionID, status, page, limit)
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
			StartTime:     m.StartTime,
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
	return s.repo.CreateMatch(ctx, match)
}

func (s *MatchService) UpdateMatch(ctx context.Context, match *domain.Match) error {
	return s.repo.UpdateMatch(ctx, match)
}

func (s *MatchService) DeleteMatch(ctx context.Context, id string) error {
	return s.repo.DeleteMatch(ctx, id)
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
			Points:       st.Points,
		})
	}
	return res, nil
}

func (s *MatchService) CreateStanding(ctx context.Context, standing *domain.Standing) error {
	return s.repo.CreateStanding(ctx, standing)
}

func (s *MatchService) UpdateStanding(ctx context.Context, standing *domain.Standing) error {
	return s.repo.UpdateStanding(ctx, standing)
}

func (s *MatchService) DeleteStanding(ctx context.Context, id string) error {
	return s.repo.DeleteStanding(ctx, id)
}
