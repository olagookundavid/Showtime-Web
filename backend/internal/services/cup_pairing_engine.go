package services

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"showtime-backend/internal/domain"
)

// MatchupPair represents two teams paired for a fixture.
type MatchupPair struct {
	HomeTeamID string
	AwayTeamID string
}

// GenerateRound1Pairings randomly pairs 10 teams into 5 fixtures.
func GenerateRound1Pairings(teamIDs []string) ([]MatchupPair, error) {
	if len(teamIDs) != 10 {
		return nil, fmt.Errorf("cup requires exactly 10 teams, got %d", len(teamIDs))
	}

	// Make a copy of team IDs
	shuffled := make([]string, len(teamIDs))
	copy(shuffled, teamIDs)

	// Fisher-Yates cryptographically secure shuffle
	for i := len(shuffled) - 1; i > 0; i-- {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return nil, fmt.Errorf("crypto rand failed: %w", err)
		}
		j := int(n.Int64())
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	}

	pairings := make([]MatchupPair, 5)
	for i := 0; i < 5; i++ {
		pairings[i] = MatchupPair{
			HomeTeamID: shuffled[i*2],
			AwayTeamID: shuffled[i*2+1],
		}
	}

	return pairings, nil
}

// GenerateSwissRoundPairings pairs teams 1–10 by adjacent rank with rematch avoidance.
// standings must be sorted 1st to 10th.
// pastMatchups is a bidirectional lookup: pastMatchups[t1][t2] == true if already played.
func GenerateSwissRoundPairings(standings []domain.Standing, pastMatchups map[string]map[string]bool) ([]MatchupPair, error) {
	if len(standings) < 10 {
		return nil, fmt.Errorf("cup swiss round requires at least 10 teams in standings, got %d", len(standings))
	}

	teams := make([]string, 10)
	for i := 0; i < 10; i++ {
		teams[i] = standings[i].TeamID
	}

	// Cost function between rank i and rank j:
	// Squared rank distance + heavy penalty if they already played.
	calcCost := func(i, j int) int {
		dist := i - j
		if dist < 0 {
			dist = -dist
		}
		cost := dist * dist
		t1, t2 := teams[i], teams[j]
		if pastMatchups != nil && ((pastMatchups[t1] != nil && pastMatchups[t1][t2]) || (pastMatchups[t2] != nil && pastMatchups[t2][t1])) {
			cost += 100000 // Heavy rematch penalty
		}
		return cost
	}

	// Backtracking solver to find minimum-cost perfect matching on 10 vertices
	type pairIdx struct {
		i, j int
	}

	var bestPairs []pairIdx
	bestCost := 1<<30 - 1

	var search func(used int, currentPairs []pairIdx, currentCost int)
	search = func(used int, currentPairs []pairIdx, currentCost int) {
		if currentCost >= bestCost {
			return
		}
		if used == (1<<10)-1 {
			bestCost = currentCost
			bestPairs = make([]pairIdx, len(currentPairs))
			copy(bestPairs, currentPairs)
			return
		}

		// Find lowest index team not yet paired
		first := -1
		for i := 0; i < 10; i++ {
			if (used & (1 << i)) == 0 {
				first = i
				break
			}
		}
		if first == -1 {
			return
		}

		// Try pairing first with each other unused team
		for j := first + 1; j < 10; j++ {
			if (used & (1 << j)) == 0 {
				cost := calcCost(first, j)
				search(
					used|(1<<first)|(1<<j),
					append(currentPairs, pairIdx{first, j}),
					currentCost+cost,
				)
			}
		}
	}

	search(0, nil, 0)

	if len(bestPairs) != 5 {
		return nil, fmt.Errorf("failed to generate valid 5 pairings for swiss round")
	}

	result := make([]MatchupPair, 5)
	for idx, p := range bestPairs {
		// Higher seed is home team
		result[idx] = MatchupPair{
			HomeTeamID: teams[p.i],
			AwayTeamID: teams[p.j],
		}
	}

	return result, nil
}

// GenerateQuarterfinalPairings produces the 4 Quarterfinal matchups from the top 8 teams:
// QF1: 1 vs 5
// QF2: 2 vs 6
// QF3: 3 vs 7
// QF4: 4 vs 8
// Teams ranked 9 and 10 are eliminated.
func GenerateQuarterfinalPairings(finalStandings []domain.Standing) ([]MatchupPair, error) {
	if len(finalStandings) < 8 {
		return nil, fmt.Errorf("quarterfinals require at least 8 teams, got %d", len(finalStandings))
	}

	// Seeds 1–4 are home, Seeds 5–8 are away
	return []MatchupPair{
		{HomeTeamID: finalStandings[0].TeamID, AwayTeamID: finalStandings[4].TeamID}, // QF1: 1 vs 5
		{HomeTeamID: finalStandings[1].TeamID, AwayTeamID: finalStandings[5].TeamID}, // QF2: 2 vs 6
		{HomeTeamID: finalStandings[2].TeamID, AwayTeamID: finalStandings[6].TeamID}, // QF3: 3 vs 7
		{HomeTeamID: finalStandings[3].TeamID, AwayTeamID: finalStandings[7].TeamID}, // QF4: 4 vs 8
	}, nil
}
