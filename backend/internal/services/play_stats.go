package services

import (
	"context"
	"fmt"
	"strconv"

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

	// ── Per-QB rating inputs (internal — not box-score columns) ──
	// The QB rating normalizes several components per drive, so drives, turnovers
	// and punts have to be attributed to the QB who actually led them. Crediting
	// every QB with the team's whole-match totals skews both lines the moment a
	// team plays two QBs. A punt is a special-teams play carrying no off_qb_id of
	// its own, so it's charged to whoever led that drive — resolved by this
	// pre-pass, which also makes the attribution independent of play order.
	driveKey := func(teamID string, driveNo int) string { return teamID + "|" + strconv.Itoa(driveNo) }
	driveQB := map[string]string{}
	for _, p := range plays {
		if p.OffQBID == nil || *p.OffQBID == "" || p.OffenseTeamID == nil || p.DriveNo <= 0 {
			continue
		}
		if k := driveKey(*p.OffenseTeamID, p.DriveNo); driveQB[k] == "" {
			driveQB[k] = *p.OffQBID
		}
	}

	seenQBDrives := map[string]map[int]bool{}

	for _, p := range plays {
		pt := strDerefTrim(p.PlayType)
		res := strDerefTrim(p.Result)
		yards := 0
		if p.Yards != nil {
			yards = *p.Yards
		}
		off := ""
		if p.OffenseTeamID != nil {
			off = *p.OffenseTeamID
		}

		// Distinct drives this player led.
		if p.OffQBID != nil && *p.OffQBID != "" && p.DriveNo > 0 {
			if seenQBDrives[*p.OffQBID] == nil {
				seenQBDrives[*p.OffQBID] = map[int]bool{}
			}
			if !seenQBDrives[*p.OffQBID][p.DriveNo] {
				seenQBDrives[*p.OffQBID][p.DriveNo] = true
				if qb := get(p.OffQBID); qb != nil {
					qb.QBDrives++
				}
			}
		}
		// Turnovers (interception thrown / turnover on downs) — the play itself
		// names the QB, so charge him directly.
		if res == "INT" || res == "TO" {
			if qb := get(p.OffQBID); qb != nil {
				qb.QBTurnovers++
			}
		}
		// Punts — charged to the QB whose drive ended in the punt.
		if pt == "PUNT" && off != "" && p.DriveNo > 0 {
			if id := driveQB[driveKey(off, p.DriveNo)]; id != "" {
				if qb := get(&id); qb != nil {
					qb.QBPunts++
				}
			}
		}

		// ── Central defensive credits (any play type) ──
		// Flag pull (tackle) — credited on any play where the carrier was
		// stopped (i.e. not a sack / TD / turnover / incompletion / safety).
		// Incompletions (INC) and throw-aways (TA) never involve a tackle even
		// when they end a series on downs (res == "TO"), so exclude them here.
		if pt != "SACK" && pt != "INC" && pt != "TA" && (res == "FG" || (res != "TD" && res != "INT" && res != "INC" && res != "SAF" && (p.DefenderID != nil || p.RusherID != nil))) {
			if d := get(p.DefenderID); d != nil {
				d.FlagPulls++
			} else if r := get(p.RusherID); r != nil {
				r.FlagPulls++
			}
		}
		// Safety: the defender/blitzer gets the Safety; the offensive player
		// tackled in the end zone is charged with a Safety Conceded.
		if res == "SAF" {
			if r := get(p.RusherID); r != nil {
				r.Safety++
			} else if d := get(p.DefenderID); d != nil {
				d.Safety++
			}
			if qb := get(p.OffQBID); qb != nil {
				qb.SafetyConceded++
			}
		}

		// ── Center: snap / bad snap (any pass-flow play) ──
		// A snap happens before every pass-flow play. BADSNAP is a dedicated
		// play_type (the play never reaches a rush/pass outcome), checked
		// separately here rather than inside the passingPlayTypes switch below —
		// it's deliberately not a member of that map. Internal tracking only.
		if p.CenterID != nil && *p.CenterID != "" {
			if pt == "BADSNAP" {
				if c := get(p.CenterID); c != nil {
					c.BadSnaps++
				}
			} else if passingPlayTypes[pt] {
				if c := get(p.CenterID); c != nil {
					c.Snaps++
				}
			}
		}

		switch {
		case passingPlayTypes[pt]:
			qb := get(p.OffQBID)
			target := get(p.TargetID)
			def := get(p.DefenderID)
			rush := get(p.RusherID)

			// A receiver logged on an intended pass earns a Target (unless thrown away or uncatchable).
			if target != nil && !p.Uncatchable && pt != "TA" {
				target.Targets++
			}

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
				// The interceptor may be recorded as the coverage defender
				// (downfield pick) or the rusher (picked at the line).
				interceptor := def
				if interceptor == nil {
					interceptor = rush
				}
				if interceptor != nil {
					interceptor.Interceptions++
					if p.ReturnedForTD {
						interceptor.DefensiveTDs++
					}
				}
			case "TDP":
				// A touchdown pass is a completed pass AND a touchdown — book both.
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
				// Thrown away is an incompletion, charged to the QB.
				if qb != nil {
					qb.PassingAttempts++
					qb.IncompletePasses++
					qb.ThrownAwayPasses++
				}
			default: // CP, SCR, HM, INC
				if qb != nil {
					qb.PassingAttempts++
				}
				if res == "INC" || pt == "INC" {
					// Every incompletion counts toward Incomplete Passes; the
					// sub-type (drop / uncatchable / batted) adds detail on top.
					if qb != nil {
						qb.IncompletePasses++
					}
					if p.Dropped && target != nil {
						target.Drops++
					}
					if p.Uncatchable && qb != nil {
						qb.UncatchablePasses++
					}
					if p.BattedDown {
						if qb != nil {
							qb.BattedDownPasses++
						}
						if rush != nil {
							rush.PassDeflections++
						} else if def != nil {
							def.PassDeflections++
						}
					}
				} else {
					// Completed pass.
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
			// Extra point by pass: QB attempts; on success the receiver scores.
			if qb := get(p.OffQBID); qb != nil {
				qb.XPAttempts++
				if res == "XP" {
					qb.XPGood++
				} else if res == "XPF" {
					qb.XPFail++
				}
			}
			if t := get(p.TargetID); t != nil {
				t.Targets++
				if res == "XP" {
					t.ExtraPointsTDs++
				}
			}
			if p.ReturnedForTD {
				if d := get(p.DefenderID); d != nil {
					d.DefensiveXPTDs++
				}
			}

		case pt == "PAT-R":
			// Extra point by run: the carrier attempts and, on success, scores.
			if c := get(p.OffQBID); c != nil {
				c.XPAttempts++
				if res == "XP" {
					c.XPGood++
					c.ExtraPointsTDs++
				} else if res == "XPF" {
					c.XPFail++
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

	// The play log is the sole source of truth for this match's stats from the
	// moment it has any plays — not an overlay on top of whatever was there
	// before (hand-entered numbers, an Excel import, an older/thinner log). A
	// player who isn't named in any current play must not keep showing a stale
	// line, so anyone not in this derivation gets deleted, not just anyone in it
	// upserted. Collected before the upsert loop so a mid-commit failure can't
	// delete stats for a player that then never gets rewritten.
	keepPlayerIDs := make([]string, 0, len(derived))
	for _, d := range derived {
		keepPlayerIDs = append(keepPlayerIDs, d.PlayerID)
	}
	if err := s.statsRepo.DeleteOrphanedPlayerStats(ctx, matchID, keepPlayerIDs); err != nil {
		return 0, fmt.Errorf("failed to clear stale player stats: %w", err)
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
			IncompletePasses:    d.IncompletePasses,
			UncatchablePasses:   d.UncatchablePasses,
			ThrownAwayPasses:    d.ThrownAwayPasses,
			BattedDownPasses:    d.BattedDownPasses,
			Targets:             d.Targets,
			XPAttempts:          d.XPAttempts,
			XPGood:              d.XPGood,
			XPFail:              d.XPFail,
			SafetyConceded:      d.SafetyConceded,
			QBDrives:            d.QBDrives,
			QBTurnovers:         d.QBTurnovers,
			QBPunts:             d.QBPunts,
			Snaps:               d.Snaps,
			BadSnaps:            d.BadSnaps,
		}
		if err := s.statsRepo.UpsertPlayerStat(ctx, stat); err != nil {
			return 0, fmt.Errorf("failed to write stats for %s: %w", d.PlayerName, err)
		}
	}

	// Also write the team-only stats (punts / first downs / turnovers / etc.),
	// same "sole source of truth" treatment: a team not appearing in this
	// derivation (e.g. a bye leg, or the log only covers one side so far)
	// shouldn't keep a stale team-stat row either.
	teamStats, err := s.DeriveTeamMatchStats(ctx, matchID)
	if err != nil {
		return len(derived), err
	}
	keepTeamIDs := make([]string, 0, len(teamStats))
	for _, t := range teamStats {
		keepTeamIDs = append(keepTeamIDs, t.TeamID)
	}
	if err := s.statsRepo.DeleteOrphanedTeamMatchStats(ctx, matchID, keepTeamIDs); err != nil {
		return len(derived), fmt.Errorf("failed to clear stale team stats: %w", err)
	}
	for i := range teamStats {
		if err := s.statsRepo.UpsertTeamMatchStat(ctx, &teamStats[i]); err != nil {
			return len(derived), fmt.Errorf("failed to write team stats: %w", err)
		}
	}

	return len(derived), nil
}

// DeriveTeamMatchStats computes the team-only stats (punts / first downs /
// turnovers / penalties / total plays) for a match from the play log.
func (s *PlayService) DeriveTeamMatchStats(ctx context.Context, matchID string) ([]domain.TeamMatchStat, error) {
	detail, err := s.matchRepo.GetMatchDetail(ctx, matchID)
	if err != nil {
		return nil, err
	}
	plays, err := s.repo.ListByMatch(ctx, matchID)
	if err != nil {
		return nil, err
	}

	acc := map[string]*domain.TeamMatchStat{}
	get := func(teamID string) *domain.TeamMatchStat {
		if teamID == "" {
			return nil
		}
		if t, ok := acc[teamID]; ok {
			return t
		}
		t := &domain.TeamMatchStat{
			TeamID: teamID, MatchID: matchID,
			CompetitionID: detail.Match.CompetitionID, MatchDate: detail.Match.Date,
		}
		acc[teamID] = t
		return t
	}

	seenDrives := map[string]map[int]bool{}

	for _, p := range plays {
		pt := strDerefTrim(p.PlayType)
		res := strDerefTrim(p.Result)
		off := ""
		if p.OffenseTeamID != nil {
			off = *p.OffenseTeamID
		}

		if off != "" && p.DriveNo > 0 {
			if seenDrives[off] == nil {
				seenDrives[off] = map[int]bool{}
			}
			if !seenDrives[off][p.DriveNo] {
				seenDrives[off][p.DriveNo] = true
				if t := get(off); t != nil {
					t.Drives++
				}
			}
		}

		if passingPlayTypes[pt] || rushingPlayTypes[pt] {
			if t := get(off); t != nil {
				t.TotalPlays++
			}
		}
		isFirstDown := res == "1D" || res == "1DG" || (p.ToGo != nil && p.Yards != nil && *p.ToGo > 0 && *p.Yards >= *p.ToGo && res != "XP" && res != "XPF")
		if isFirstDown {
			if t := get(off); t != nil {
				t.FirstDowns++
			}
		}
		if res == "INT" || res == "TO" {
			if t := get(off); t != nil {
				t.Turnovers++
			}
		}
		if pt == "PUNT" {
			if t := get(off); t != nil {
				t.Punts++
			}
		}
		if pen := strDerefTrim(p.Penalty); pen != "" {
			penTeam := ""
			if p.PenaltyTeamID != nil {
				penTeam = *p.PenaltyTeamID
			}
			if t := get(penTeam); t != nil {
				t.Penalties++
				if p.PenaltyYards != nil {
					t.PenaltyYards += *p.PenaltyYards
				}
			}
		}
	}

	// Ensure both teams get a row (zeroed) so committing overwrites stale values.
	get(detail.Match.HomeTeamID)
	get(detail.Match.AwayTeamID)

	out := make([]domain.TeamMatchStat, 0, len(acc))
	for _, t := range acc {
		out = append(out, *t)
	}
	return out, nil
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
