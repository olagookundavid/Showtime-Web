package services

import (
	"context"
	"fmt"

	"showtime-backend/internal/domain"
)

// ── Step 2: derive per-player box-score stats from the play-by-play log ────────
//
// PlayerStat tracks counts only (no yardage columns), so derivation is a set of
// counters keyed off the play type + result codes. This is the mapping table
// from the design doc, expressed in code. Yardage on a play is ignored here.

var passingPlayTypes = map[string]bool{"CP": true, "SCR": true, "HM": true, "INC": true, "TA": true, "TDP": true, "INT": true, "SACK": true}
var rushingPlayTypes = map[string]bool{"RUN": true, "QBR": true, "SWP": true, "REV": true}

type statLookup struct {
	// playerID -> display + team
	player map[string]domain.TeamSheetPlayer
	team   map[string]string // playerID -> teamID
	teams  map[string]domain.Team
}

// DeriveMatchStats walks the play log and returns computed per-player stats.
func (s *PlayService) DeriveMatchStats(ctx context.Context, matchID string) ([]domain.AggregatedPlayerStat, error) {
	detail, err := s.matchRepo.GetMatchDetail(ctx, matchID)
	if err != nil {
		return nil, err
	}
	plays, err := s.repo.ListByMatch(ctx, matchID)
	if err != nil {
		return nil, err
	}

	lk := buildStatLookup(detail)
	acc := map[string]*domain.AggregatedPlayerStat{}

	get := func(id *string) *domain.AggregatedPlayerStat {
		if id == nil || *id == "" {
			return nil
		}
		if st, ok := acc[*id]; ok {
			return st
		}
		st := &domain.AggregatedPlayerStat{PlayerID: *id, Apps: 1}
		if p, ok := lk.player[*id]; ok {
			st.PlayerName = p.Name
			st.PlayerJerseyNumber = p.JerseyNumber
			st.PlayerPosition = p.Position
			st.PlayerImage = p.Image
		}
		if tid, ok := lk.team[*id]; ok {
			st.TeamID = tid
			if t, ok := lk.teams[tid]; ok {
				st.TeamName = t.Name
				st.TeamShortName = t.ShortName
				st.TeamLogo = t.Logo
			}
		}
		acc[*id] = st
		return st
	}

	for _, p := range plays {
		pt := strDerefTrim(p.PlayType)
		res := strDerefTrim(p.Result)
		yards := 0
		if p.Yards != nil {
			yards = *p.Yards
		}

		// Central: a flag pull credits the defender (or rusher) on non-sack, non-TD, non-turnover tackles.
		// DefenderID is prioritized over RusherID for downfield tackles on completions/runs.
		if pt != "SACK" && (res == "FG" || (res != "TD" && res != "INT" && res != "INC" && res != "SAF" && (p.DefenderID != nil || p.RusherID != nil))) {
			if d := get(p.DefenderID); d != nil {
				d.FlagPulls++
			} else if r := get(p.RusherID); r != nil {
				r.FlagPulls++
			}
		}
		if res == "SAF" {
			if r := get(p.RusherID); r != nil {
				r.Safety++
			} else if d := get(p.DefenderID); d != nil {
				d.Safety++
			}
		}

		switch {
		case passingPlayTypes[pt]:
			qb := get(p.OffQBID)
			target := get(p.TargetID)
			def := get(p.DefenderID)
			rush := get(p.RusherID)
			switch pt {
			case "SACK":
				// Sack yardage is conventionally excluded from passing yards
				// (it's a loss charged to the play, not a completed throw).
				if qb != nil {
					qb.QBSacks++
				}
				if rush != nil {
					rush.DefSacks++
				} else if def != nil {
					def.DefSacks++
				}
			case "INT":
				if qb != nil {
					qb.PassingAttempts++
					qb.InterceptionsThrown++
				}
				if def != nil {
					def.Interceptions++
					if p.ReturnedForTD {
						def.DefensiveTDs++
					}
				}
			case "TDP":
				if qb != nil {
					qb.PassingAttempts++
					qb.CompletedPasses++
					qb.PassingTDs++
					qb.PassingYards += yards
				}
				if target != nil {
					target.Receptions++
					target.ReceivingTDs++
					target.ReceivingYards += yards
				}
			case "TA":
				if qb != nil {
					qb.PassingAttempts++
				}
			default: // CP, SCR, HM, INC
				if qb != nil {
					qb.PassingAttempts++
				}
				if res == "INC" || pt == "INC" {
					if p.Dropped && target != nil {
						target.Drops++
					}
					// Only credit a Pass Deflection when the admin explicitly
					// marked the pass as batted down — naming a defender alone
					// no longer implies it (they may have just been in coverage).
					if p.BattedDown {
						if rush != nil {
							rush.PassDeflections++
						} else if def != nil {
							def.PassDeflections++
						}
					}
				} else {
					if qb != nil {
						qb.CompletedPasses++
						qb.PassingYards += yards
					}
					if target != nil {
						target.Receptions++
						target.ReceivingYards += yards
					}
				}
			}

		case rushingPlayTypes[pt]:
			carrier := get(p.OffQBID)
			if carrier != nil {
				carrier.RushingAttempts++
				carrier.RushingYards += yards
				if res == "TD" {
					carrier.RushingTDs++
				}
			}

		case pt == "XP-P":
			if res == "XP" {
				if t := get(p.TargetID); t != nil {
					t.ExtraPointsTDs++
				}
				if p.ReturnedForTD {
					if d := get(p.DefenderID); d != nil {
						d.DefensiveXPTDs++
					}
				}
			}

		case pt == "PAT-R":
			if res == "XP" {
				if c := get(p.OffQBID); c != nil {
					c.ExtraPointsTDs++
				}
			}
		}
	}

	out := make([]domain.AggregatedPlayerStat, 0, len(acc))
	for _, st := range acc {
		out = append(out, *st)
	}
	return out, nil
}

// CompareMatchStats returns the derived stats alongside the currently-stored
// (manually-entered) stats for the same match, so the admin can eyeball them.
func (s *PlayService) CompareMatchStats(ctx context.Context, matchID string) ([]domain.AggregatedPlayerStat, []domain.AggregatedPlayerStat, error) {
	derived, err := s.DeriveMatchStats(ctx, matchID)
	if err != nil {
		return nil, nil, err
	}
	current, _, err := s.statsRepo.GetPlayerStats(ctx, domain.StatsFilter{MatchID: matchID, Page: 1, Limit: 500})
	if err != nil {
		return nil, nil, err
	}
	return derived, current, nil
}

// CommitDerivedStats writes the derived stats into player_stats (overwriting the
// per-match row for each player). Returns the number of players written.
func (s *PlayService) CommitDerivedStats(ctx context.Context, matchID string) (int, error) {
	detail, err := s.matchRepo.GetMatchDetail(ctx, matchID)
	if err != nil {
		return 0, err
	}
	derived, err := s.DeriveMatchStats(ctx, matchID)
	if err != nil {
		return 0, err
	}
	for _, d := range derived {
		if d.TeamID == "" {
			return 0, fmt.Errorf("player %s has no team on the match sheet — fix the team sheet before committing", d.PlayerName)
		}
		stat := &domain.PlayerStat{
			PlayerID:            d.PlayerID,
			TeamID:              d.TeamID,
			MatchID:             matchID,
			CompetitionID:       detail.Match.CompetitionID,
			MatchDate:           detail.Match.Date,
			PassingAttempts:     d.PassingAttempts,
			RushingAttempts:     d.RushingAttempts,
			CompletedPasses:     d.CompletedPasses,
			PassingYards:        d.PassingYards,
			RushingYards:        d.RushingYards,
			ReceivingYards:      d.ReceivingYards,
			PassingTDs:          d.PassingTDs,
			RushingTDs:          d.RushingTDs,
			InterceptionsThrown: d.InterceptionsThrown,
			Receptions:          d.Receptions,
			ReceivingTDs:        d.ReceivingTDs,
			ExtraPointsTDs:      d.ExtraPointsTDs,
			Drops:               d.Drops,
			FlagPulls:           d.FlagPulls,
			PassDeflections:     d.PassDeflections,
			Interceptions:       d.Interceptions,
			DefensiveTDs:        d.DefensiveTDs,
			Safety:              d.Safety,
			QBSacks:             d.QBSacks,
			DefSacks:            d.DefSacks,
			DefensiveXPTDs:      d.DefensiveXPTDs,
		}
		if err := s.statsRepo.UpsertPlayerStat(ctx, stat); err != nil {
			return 0, fmt.Errorf("failed to write stats for %s: %w", d.PlayerName, err)
		}
	}
	return len(derived), nil
}

func buildStatLookup(detail *domain.MatchDetail) statLookup {
	lk := statLookup{
		player: map[string]domain.TeamSheetPlayer{},
		team:   map[string]string{},
		teams:  map[string]domain.Team{},
	}
	if detail.Match.HomeTeam != nil {
		lk.teams[detail.Match.HomeTeamID] = *detail.Match.HomeTeam
	}
	if detail.Match.AwayTeam != nil {
		lk.teams[detail.Match.AwayTeamID] = *detail.Match.AwayTeam
	}
	for _, p := range detail.TeamSheet.HomeTeam {
		lk.player[p.PlayerID] = p
		lk.team[p.PlayerID] = detail.Match.HomeTeamID
	}
	for _, p := range detail.TeamSheet.AwayTeam {
		lk.player[p.PlayerID] = p
		lk.team[p.PlayerID] = detail.Match.AwayTeamID
	}
	return lk
}

func strDerefTrim(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
