package domain

import "strings"

// Gender-based scoring tables — the league's real scoring, from Scoring_Details.docx
// (confirmed with the commissioner, 2026-07). The score of a touchdown / extra
// point depends on the genders of the two players involved (a co-ed league that
// rewards involving female players).
//
// A missing / unknown gender is treated as Male — the lowest-scoring combination —
// per league instruction, so scoring is never blocked on missing data.
//
// These values live in code (not the editable game_rules config) because they are
// fixed league rules, not a per-competition knob. The full model is documented in
// docs/play-by-play-scoring-and-stats-rules.md.

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
func TouchdownPoints(passerG, receiverG string, thirdDown, defensive, isRun bool) int {
	p, r := normGender(passerG), normGender(receiverG)

	if isRun {
		// Scored by the runner's gender only. 3rd down is female-only, so a
		// 3rd-down run is a female run — still 7.
		if p == "F" || r == "F" {
			return 7
		}
		return 6
	}

	// 3rd down is a female-only down: the only possible combination is F→F,
	// which scores lower than a regular F→F. Applies to both tables.
	if thirdDown && p == "F" && r == "F" {
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
