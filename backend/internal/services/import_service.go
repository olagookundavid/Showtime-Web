package services

import (
	"context"
	"fmt"
	"strings"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type IImportService interface {
	ImportMatchData(ctx context.Context, matchID string, req dto.ImportMatchRequest) (ports.ImportMatchResult, error)
}

type ImportService struct {
	importRepo ports.ImportRepository
	matchRepo  ports.MatchRepository
}

func NewImportService(importRepo ports.ImportRepository, matchRepo ports.MatchRepository) IImportService {
	return &ImportService{importRepo: importRepo, matchRepo: matchRepo}
}

func (s *ImportService) ImportMatchData(ctx context.Context, matchID string, req dto.ImportMatchRequest) (ports.ImportMatchResult, error) {
	if len(req.Rows) == 0 {
		return ports.ImportMatchResult{}, fmt.Errorf("no rows to import")
	}

	detail, err := s.matchRepo.GetMatchDetail(ctx, matchID)
	if err != nil {
		return ports.ImportMatchResult{}, fmt.Errorf("match not found: %w", err)
	}
	homeTeamID := detail.Match.HomeTeamID
	awayTeamID := detail.Match.AwayTeamID
	if homeTeamID == "" || awayTeamID == "" {
		return ports.ImportMatchResult{}, fmt.Errorf("match is missing home or away team")
	}

	rows := make([]ports.ImportMatchRow, 0, len(req.Rows))
	for i, r := range req.Rows {
		side := strings.ToLower(strings.TrimSpace(r.Side))
		var teamID string
		switch side {
		case "home":
			teamID = homeTeamID
		case "away":
			teamID = awayTeamID
		default:
			return ports.ImportMatchResult{}, fmt.Errorf("row %d: side must be 'home' or 'away' (got %q)", i+1, r.Side)
		}
		if strings.TrimSpace(r.PlayerName) == "" {
			return ports.ImportMatchResult{}, fmt.Errorf("row %d: player_name is required", i+1)
		}
		rows = append(rows, ports.ImportMatchRow{
			TeamID:              teamID,
			PlayerName:          r.PlayerName,
			JerseyNumber:        r.JerseyNumber,
			Position:            r.Position,
			PassingAttempts:     r.PassingAttempts,
			RushingAttempts:     r.RushingAttempts,
			CompletedPasses:     r.CompletedPasses,
			PassingTDs:          r.PassingTDs,
			RushingTDs:          r.RushingTDs,
			InterceptionsThrown: r.InterceptionsThrown,
			Receptions:          r.Receptions,
			ReceivingTDs:        r.ReceivingTDs,
			ExtraPointsTDs:      r.ExtraPointsTDs,
			Drops:               r.Drops,
			FlagPulls:           r.FlagPulls,
			PassDeflections:     r.PassDeflections,
			Interceptions:       r.Interceptions,
			DefensiveTDs:        r.DefensiveTDs,
			Safety:              r.Safety,
			QBSacks:             r.QBSacks,
			DefSacks:            r.DefSacks,
		})
	}

	return s.importRepo.ImportMatchData(ctx, ports.ImportMatchParams{
		MatchID:       matchID,
		HomeTeamID:    homeTeamID,
		AwayTeamID:    awayTeamID,
		CompetitionID: detail.Match.CompetitionID,
		MatchDate:     detail.Match.Date,
		Rows:          rows,
	})
}
