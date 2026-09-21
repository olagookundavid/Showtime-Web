package domain

import (
	"strings"
	"time"
)

// Gender-based scoring tables — the league's real scoring, from Scoring_Details.docx
// (confirmed with the commissioner, 2026-07). The score of a touchdown / extra
// point depends on the genders of the two players involved (a co-ed league that
// rewards involving female players).
//
// Effective 2026-09-20 (yesterday), the league revised female 3rd-down touchdowns from
// 7 points down to 6 points going forward. Historical matches before this date retain
// their 7-point score.

func normGender(g string) string {
	if strings.EqualFold(strings.TrimSpace(g), "F") {
		return "F"
	}
	return "M"
}

// TouchdownPoints returns the points for a touchdown.
//
//	passerG / receiverG — genders of the two players:
//	  · Offensive pass TD: passer = the QB, receiver = the target.
//	  · Defensive TD (pick-six): passer = the QB who threw it, receiver = the interceptor.
//	  · Run TD: pass the runner's gender as BOTH arguments and set isRun = true.
//	thirdDown — the play was on 3rd down (a female-only down).
//	defensive — the defending team scored (use the Defensive table).
//	isRun     — a rushing touchdown (scored by the runner's gender alone: M=6, F=7).
//	matchDate — optional match date to apply historical rule versioning (>= Sept 20, 2026 uses 6 pts for 3rd down female TD).
func TouchdownPoints(passerG, receiverG string, thirdDown, defensive, isRun bool, matchDate ...time.Time) int {
	p, r := normGender(passerG), normGender(receiverG)

	isNewRule := false
	if len(matchDate) > 0 && !matchDate[0].IsZero() {
		// Compare YYYY-MM-DD date string to prevent UTC timezone boundary shifts
		dateStr := matchDate[0].Format("2006-01-02")
		if dateStr >= "2026-09-20" {
			isNewRule = true
		}
	}

	if isRun {
		// Scored by the runner's gender only. 3rd down is female-only.
		if p == "F" || r == "F" {
			if thirdDown && isNewRule {
				return 6
			}
			return 7
		}
		return 6
	}

	// 3rd down is a female-only down: the only possible combination is F→F,
	// which scores lower than a regular F→F. Applies to both tables.
	if thirdDown && p == "F" && r == "F" {
		if isNewRule {
			return 6
		}
		return 7
	}

	if defensive {
		switch {
		case p == "M" && r == "M":
			return 6
		case p == "M" && r == "F":
			return 7
		case p == "F" && r == "M":
			return 7
		default: // F → F
			return 8
		}
	}

	// Offensive
	switch {
	case p == "M" && r == "M":
		return 6
	case p == "M" && r == "F":
		return 7
	case p == "F" && r == "M":
		return 8
	default: // F → F
		return 9
	}
}

// ExtraPointPoints returns the points for a successful extra point (from the 10).
// Same player mapping as TouchdownPoints. Run XP values (M=1, F=2) are a sensible
// default pending final confirmation — see the docs.
func ExtraPointPoints(passerG, receiverG string, defensive, isRun bool) int {
	p, r := normGender(passerG), normGender(receiverG)

	if isRun {
		if p == "F" || r == "F" {
			return 2
		}
		return 1
	}

	if defensive {
		switch {
		case p == "M" && r == "M":
			return 1
		case p == "M" && r == "F":
			return 2
		case p == "F" && r == "M":
			return 1
		default: // F → F
			return 2
		}
	}

	// Offensive
	switch {
	case p == "M" && r == "M":
		return 1
	case p == "M" && r == "F":
		return 2
	case p == "F" && r == "M":
		return 2
	default: // F → F
		return 3
	}
}
