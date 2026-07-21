package services

import (
	"context"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
)

// ── Step 3: rules config + scoring engine ─────────────────────────────────────

func (s *PlayService) GetRules(ctx context.Context, competitionID string) (domain.GameRules, error) {
	return s.repo.GetRules(ctx, competitionID)
}

func (s *PlayService) GetRulesForMatch(ctx context.Context, matchID string) (domain.GameRules, error) {
	match, err := s.matchRepo.GetMatchByID(ctx, matchID)
	if err != nil {
		return domain.GameRules{}, err
	}
	return s.repo.GetRules(ctx, match.CompetitionID)
}

func (s *PlayService) UpsertRules(ctx context.Context, competitionID string, req dto.GameRulesRequest) (domain.GameRules, error) {
	model := req.FirstDownModel
	if model != "yardage" && model != "zone" {
		model = "yardage"
	}
	rules := &domain.GameRules{
		CompetitionID:    competitionID,
		TDPoints:         req.TDPoints,
		XPRunPoints:      req.XPRunPoints,
		XPPassPoints:     req.XPPassPoints,
		SafetyPoints:     req.SafetyPoints,
		DefReturnPoints:  req.DefReturnPoints,
		DownsPerSeries:   req.DownsPerSeries,
		YardsToFirstDown: req.YardsToFirstDown,
		FirstDownModel:   model,
	}
	if err := s.repo.UpsertRules(ctx, rules); err != nil {
		return domain.GameRules{}, err
	}
	return *rules, nil
}

// RecomputeScore walks the play log applying the competition's point values,
// writes the running-score snapshot onto every play, updates the match's final
// score, and recalculates standings. Returns the final home/away score.
func (s *PlayService) RecomputeScore(ctx context.Context, matchID string) (int, int, error) {
	match, err := s.matchRepo.GetMatchByID(ctx, matchID)
	if err != nil {
		return 0, 0, err
	}
	rules, err := s.repo.GetRules(ctx, match.CompetitionID)
	if err != nil {
		return 0, 0, err
	}
	plays, err := s.repo.ListByMatch(ctx, matchID)
	if err != nil {
		return 0, 0, err
	}

	home, away := 0, 0
	for _, p := range plays {
		off := ""
		if p.OffenseTeamID != nil {
			off = *p.OffenseTeamID
		}
		isHomeOff := off == match.HomeTeamID
		isAwayOff := off == match.AwayTeamID

		addOff := func(pts int) {
			if isHomeOff {
				home += pts
			} else if isAwayOff {
				away += pts
			}
		}
		addDef := func(pts int) {
			if isHomeOff {
				away += pts
			} else if isAwayOff {
				home += pts
			}
		}

		res := strDerefTrim(p.Result)
		pt := strDerefTrim(p.PlayType)
		switch res {
		case "TD":
			if p.ReturnedForTD {
				addDef(rules.DefReturnPoints)
			} else {
				addOff(rules.TDPoints)
			}
		case "XP":
			switch pt {
			case "XP-P":
				addOff(rules.XPPassPoints)
			case "PAT-R":
				addOff(rules.XPRunPoints)
			default:
				addOff(rules.XPRunPoints)
			}
		case "SAF":
			addDef(rules.SafetyPoints)
		case "INT":
			if p.ReturnedForTD {
				addDef(rules.DefReturnPoints)
			}
		}

		if err := s.repo.UpdateScore(ctx, p.ID, home, away); err != nil {
			return 0, 0, err
		}
	}

	// Persist the final score on the match and refresh standings.
	match.HomeScore = &home
	match.AwayScore = &away
	if err := s.matchRepo.UpdateMatch(ctx, match); err != nil {
		return 0, 0, err
	}
	if err := s.matchRepo.RecalculateStandings(ctx, match.CompetitionID); err != nil {
		return 0, 0, err
	}

	GlobalSSEBroker.Broadcast(matchID, "score_updated", map[string]int{"home_score": home, "away_score": away})

	return home, away, nil
}
