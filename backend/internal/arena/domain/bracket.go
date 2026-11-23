package domain

import (
	"errors"
	"fmt"
)

// BracketMatch is one match in a planned playoff. Key names it inside the plan so
// a later match can say which earlier one feeds it.
type BracketMatch struct {
	Key        string
	Stage      string
	HomeClubID string // empty until a feeder match is decided
	AwayClubID string
	FeedsKey   string // the match the winner moves into ("" for the final)
	FeedsSlot  string // "home" or "away"
}

// PlanBracket pairs the top of a division for the playoffs. ranked is the league
// table's club ids, best first. spots is the division's playoff_spots:
//
//	4: semi-finals 1st v 4th and 2nd v 3rd, winners meet in the final
//	2: a straight final, 1st v 2nd
func PlanBracket(spots int, ranked []string) ([]BracketMatch, error) {
	switch spots {
	case 0:
		return nil, errors.New("this division has no playoffs")
	case 2:
		if len(ranked) < 2 {
			return nil, errors.New("at least 2 clubs are needed for a final")
		}
		return []BracketMatch{{Key: "final", Stage: StageFinal, HomeClubID: ranked[0], AwayClubID: ranked[1]}}, nil
	case 4:
		if len(ranked) < 4 {
			return nil, fmt.Errorf("at least 4 clubs are needed for the semi-finals, this division has %d", len(ranked))
		}
		return []BracketMatch{
			{Key: "semi1", Stage: StageSemi, HomeClubID: ranked[0], AwayClubID: ranked[3], FeedsKey: "final", FeedsSlot: "home"},
			{Key: "semi2", Stage: StageSemi, HomeClubID: ranked[1], AwayClubID: ranked[2], FeedsKey: "final", FeedsSlot: "away"},
			{Key: "final", Stage: StageFinal},
		}, nil
	default:
		return nil, fmt.Errorf("unsupported number of playoff places: %d", spots)
	}
}

// ErrNoWinner means a knockout match has no decisive result yet.
var ErrNoWinner = errors.New("a knockout match needs a winner: if the score is level, say who won on penalties")

// KnockoutWinner returns the club that goes through. A level score needs a
// penalty winner.
func KnockoutWinner(m Match) (string, error) {
	if !m.Played() || m.HomeClubID == nil || m.AwayClubID == nil {
		return "", ErrNoWinner
	}
	switch {
	case *m.HomeScore > *m.AwayScore:
		return *m.HomeClubID, nil
	case *m.AwayScore > *m.HomeScore:
		return *m.AwayClubID, nil
	}
	if m.PenaltyWinner != nil {
		switch *m.PenaltyWinner {
		case "home":
			return *m.HomeClubID, nil
		case "away":
			return *m.AwayClubID, nil
		}
	}
	return "", ErrNoWinner
}
