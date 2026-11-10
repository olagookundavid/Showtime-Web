package services

import (
	"context"
	"errors"
	"sort"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// playerFormRecentGames is how many of a player's latest played gameweeks the
// detail panel's form strip shows.
const playerFormRecentGames = 5

// GetPlayerForm is the player leaderboard's rolling stats (form, points per
// game, ownership) for one player, plus the recent matches "Form" averages,
// each with the opponent faced — for the player detail panel opened from a
// pitch avatar, where a whole-pool leaderboard fetch would be wasteful.
func (s *FantasyService) GetPlayerForm(ctx context.Context, seasonID, playerID string) (*dto.PlayerFormResponse, error) {
	if seasonID == "" {
		activeSeason, err := s.repo.GetActiveSeason(ctx)
		if err != nil {
			return nil, err
		}
		if activeSeason == nil {
			return nil, errors.New("no active fantasy season found")
		}
		seasonID = activeSeason.ID
	}

	gameweeks, err := s.repo.ListGameweeks(ctx, seasonID)
	if err != nil {
		return nil, err
	}
	stats, err := s.repo.GetSeasonGameweekStats(ctx, seasonID)
	if err != nil {
		return nil, err
	}

	built := buildPlayerForm(playerFormInput{gameweeks: gameweeks, stats: stats}, playerID)
	resp := &dto.PlayerFormResponse{
		PlayerID:      playerID,
		Form:          built.form,
		PointsPerGame: built.pointsPerGame,
	}
	if _, selectedByPct, err := s.repo.GetPlayerFantasySummary(ctx, seasonID, playerID); err == nil {
		resp.SelectedByPct = selectedByPct
	}

	// Teams repeat across a player's recent games, so a request-scoped cache
	// keeps a popular opponent from being looked up more than once.
	teamCache := map[string]*domain.Team{}
	for _, g := range built.recentGames {
		game := g.PlayerFormGame
		if g.matchID != "" && s.matchRepo != nil {
			if match, err := s.matchRepo.GetMatchByID(ctx, g.matchID); err == nil && match != nil {
				opponentID := match.HomeTeamID
				if g.teamID == match.HomeTeamID {
					opponentID = match.AwayTeamID
				}
				team, ok := teamCache[opponentID]
				if !ok {
					team, _ = s.matchRepo.GetTeamByID(ctx, opponentID)
					teamCache[opponentID] = team
				}
				if team != nil {
					game.OpponentName = team.Name
					game.OpponentShortName = team.ShortName
					game.OpponentLogo = team.Logo
				}
			}
		}
		resp.RecentGames = append(resp.RecentGames, game)
	}

	return resp, nil
}

type playerFormInput struct {
	gameweeks []domain.FantasyGameweek
	stats     []ports.GameweekPlayerStat
}

// playerFormRecentGame is one recently played gameweek, kept with the match
// and the player's own team through the pure computation below so the
// opponent can be resolved afterwards without a database in scope.
type playerFormRecentGame struct {
	dto.PlayerFormGame
	matchID string
	teamID  string
}

type playerFormResult struct {
	form          float64
	pointsPerGame float64
	// recentGames is the last up to playerFormRecentGames played gameweeks,
	// oldest first.
	recentGames []playerFormRecentGame
}

// buildPlayerForm is a single player's season form as a pure function of the
// season's gameweeks and stat lines, so the arithmetic is testable without a
// database — the same shape as buildPlayerLeaderboard, just scoped to one
// player instead of the whole pool.
func buildPlayerForm(in playerFormInput, playerID string) playerFormResult {
	gwNumber := make(map[string]int, len(in.gameweeks))
	for _, gw := range in.gameweeks {
		gwNumber[gw.ID] = gw.Number
	}

	type gwLine struct {
		points  float64
		matchID string
		teamID  string
	}
	calc := domain.FantasyWeights{}
	playerGW := map[string]*gwLine{} // this player's points, by gameweek
	matches := map[string]bool{}     // this player's distinct matches, for points-per-match
	leagueGW := map[string]bool{}    // every gameweek with any stats — anyone's — for the form window
	for _, st := range in.stats {
		if _, ok := gwNumber[st.GameweekID]; !ok {
			continue
		}
		leagueGW[st.GameweekID] = true
		if st.Stat.PlayerID != playerID {
			continue
		}
		line := playerGW[st.GameweekID]
		if line == nil {
			line = &gwLine{matchID: st.Stat.MatchID, teamID: st.Stat.TeamID}
			playerGW[st.GameweekID] = line
		}
		line.points += calc.Calculate(st.Stat).NetTotal
		matches[st.Stat.MatchID] = true
	}

	var result playerFormResult

	var season float64
	for _, line := range playerGW {
		season += line.points
	}
	if len(matches) > 0 {
		result.pointsPerGame = round2(season / float64(len(matches)))
	}

	// Form averages the last 3 gameweeks the league played at all, a
	// gameweek this player didn't feature in counting as zero — same
	// definition the player leaderboard uses, so the two never disagree.
	leaguePlayed := make([]dto.PlayerLeaderboardGameweek, 0, len(leagueGW))
	for id := range leagueGW {
		leaguePlayed = append(leaguePlayed, dto.PlayerLeaderboardGameweek{ID: id, Number: gwNumber[id]})
	}
	sort.Slice(leaguePlayed, func(i, j int) bool { return leaguePlayed[i].Number < leaguePlayed[j].Number })
	formGWs := leaguePlayed
	if len(formGWs) > formWindow {
		formGWs = formGWs[len(formGWs)-formWindow:]
	}
	if len(formGWs) > 0 {
		var sum float64
		for _, gw := range formGWs {
			if line, ok := playerGW[gw.ID]; ok {
				sum += line.points
			}
		}
		result.form = round2(sum / float64(len(formGWs)))
	}

	// The recent-games strip only shows gameweeks this player actually
	// played, unlike the form window above.
	playerPlayed := make([]dto.PlayerLeaderboardGameweek, 0, len(playerGW))
	for id := range playerGW {
		playerPlayed = append(playerPlayed, dto.PlayerLeaderboardGameweek{ID: id, Number: gwNumber[id]})
	}
	sort.Slice(playerPlayed, func(i, j int) bool { return playerPlayed[i].Number < playerPlayed[j].Number })
	recent := playerPlayed
	if len(recent) > playerFormRecentGames {
		recent = recent[len(recent)-playerFormRecentGames:]
	}
	for _, gw := range recent {
		line := playerGW[gw.ID]
		result.recentGames = append(result.recentGames, playerFormRecentGame{
			PlayerFormGame: dto.PlayerFormGame{
				GameweekID:     gw.ID,
				GameweekNumber: gw.Number,
				Points:         round2(line.points),
			},
			matchID: line.matchID,
			teamID:  line.teamID,
		})
	}

	return result
}
