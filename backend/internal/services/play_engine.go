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

		// Gender-based scoring (Scoring_Details.docx). The value of a TD/XP
		// depends on the genders of the two players involved. A nil player →
		// empty gender → treated as Male inside the domain helpers.
		gq := genderOf(p.OffQB) // passer, or the runner/carrier on a run
		gt := genderOf(p.Target)
		gd := genderOf(p.Defender) // the interceptor on a pick-six
		thirdDown := p.Down != nil && *p.Down == 3
		isRun := pt == "RUN" || pt == "QBR"

		switch res {
		case "TD":
			if p.ReturnedForTD {
				// Defensive TD (pick-six recorded as a TD): passer = QB who
				// threw it, receiver = the interceptor.
				addDef(domain.TouchdownPoints(gq, gd, thirdDown, true, false))
			} else if isRun {
				// Run TD — scored by the runner's own gender.
				addOff(domain.TouchdownPoints(gq, gq, thirdDown, false, true))
			} else {
				// Offensive pass TD: passer = QB, receiver = target.
				addOff(domain.TouchdownPoints(gq, gt, thirdDown, false, false))
			}
		case "XP":
			if p.ReturnedForTD {
				// Returned extra point → the defence scores it.
				addDef(domain.ExtraPointPoints(gq, gd, true, false))
			} else if pt == "PAT-R" {
				addOff(domain.ExtraPointPoints(gq, gq, false, true))
			} else { // XP-P (thrown extra point)
				addOff(domain.ExtraPointPoints(gq, gt, false, false))
			}
		case "SAF":
			// Safety stays a flat value (not gender-based).
			addDef(rules.SafetyPoints)
		case "INT":
			if p.ReturnedForTD {
				// Pick-six recorded on an interception play.
				addDef(domain.TouchdownPoints(gq, gd, thirdDown, true, false))
			}
		}

		if err := s.repo.UpdateScore(ctx, p.ID, home, away); err != nil {
			return 0, 0, err
		}
	}

	GlobalSSEBroker.Broadcast(matchID, "score_updated", map[string]int{"home_score": home, "away_score": away})

	return home, away, nil
}

// genderOf returns a player's gender, or "" (treated as Male by the scoring
// helpers) when the player is absent.
func genderOf(p *domain.Player) string {
	if p == nil {
		return ""
	}
	return p.Gender
}

// CommitScore takes the derived play-by-play score, persists it to the official match
// record on matches table, and recalculates standings. Only called when admin commits.
func (s *PlayService) CommitScore(ctx context.Context, matchID string) (int, int, error) {
	home, away, err := s.RecomputeScore(ctx, matchID)
	if err != nil {
		return 0, 0, err
	}
	match, err := s.matchRepo.GetMatchByID(ctx, matchID)
	if err != nil {
		return 0, 0, err
	}
	match.HomeScore = &home
	match.AwayScore = &away
	if err := s.matchRepo.UpdateMatch(ctx, match); err != nil {
		return 0, 0, err
	}
	if err := s.matchRepo.RecalculateStandings(ctx, match.CompetitionID); err != nil {
		return 0, 0, err
	}
	return home, away, nil
}
