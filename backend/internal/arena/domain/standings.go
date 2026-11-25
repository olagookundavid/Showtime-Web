package domain

import (
	"sort"
	"strings"
)

// StandingRow is one club's line in a division table.
type StandingRow struct {
	Rank   int     `json:"rank"`
	Club   ClubRef `json:"club"`
	Played int     `json:"played"`
	Won    int     `json:"won"`
	Drawn  int     `json:"drawn"`
	Lost   int     `json:"lost"`
	GF     int     `json:"gf"`
	GA     int     `json:"ga"`
	GD     int     `json:"gd"`
	Points int     `json:"points"`
	// Form is the last five results, oldest first, e.g. "WWDLW".
	Form string `json:"form"`
}

// Points awarded for a result.
const (
	PointsWin  = 3
	PointsDraw = 1
)

// ComputeStandings builds a division's table from its matches. Only league
// matches with a result count, and every club in clubs appears even before it
// has played. Order: points, goal difference, goals scored, then name, so the
// table is stable. Matches should be passed in kick-off order so Form reads
// oldest to newest.
func ComputeStandings(clubs []ClubRef, matches []Match) []StandingRow {
	rows := make(map[string]*StandingRow, len(clubs))
	forms := make(map[string][]byte, len(clubs))
	for _, c := range clubs {
		rows[c.ID] = &StandingRow{Club: c}
	}

	for i := range matches {
		m := &matches[i]
		if m.Stage != StageLeague || !m.Played() || m.HomeClubID == nil || m.AwayClubID == nil {
			continue
		}
		h, okH := rows[*m.HomeClubID]
		a, okA := rows[*m.AwayClubID]
		if !okH || !okA {
			continue
		}
		hs, as := *m.HomeScore, *m.AwayScore
		h.Played++
		a.Played++
		h.GF += hs
		h.GA += as
		a.GF += as
		a.GA += hs
		switch {
		case hs > as:
			h.Won++
			a.Lost++
			forms[h.Club.ID] = append(forms[h.Club.ID], 'W')
			forms[a.Club.ID] = append(forms[a.Club.ID], 'L')
		case hs < as:
			a.Won++
			h.Lost++
			forms[a.Club.ID] = append(forms[a.Club.ID], 'W')
			forms[h.Club.ID] = append(forms[h.Club.ID], 'L')
		default:
			h.Drawn++
			a.Drawn++
			forms[h.Club.ID] = append(forms[h.Club.ID], 'D')
			forms[a.Club.ID] = append(forms[a.Club.ID], 'D')
		}
	}

	out := make([]StandingRow, 0, len(rows))
	for _, c := range clubs {
		r := rows[c.ID]
		r.GD = r.GF - r.GA
		r.Points = r.Won*PointsWin + r.Drawn*PointsDraw
		f := forms[c.ID]
		if len(f) > 5 {
			f = f[len(f)-5:]
		}
		r.Form = string(f)
		out = append(out, *r)
	}

	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if a.Points != b.Points {
			return a.Points > b.Points
		}
		if a.GD != b.GD {
			return a.GD > b.GD
		}
		if a.GF != b.GF {
			return a.GF > b.GF
		}
		return strings.ToLower(a.Club.Name) < strings.ToLower(b.Club.Name)
	})
	for i := range out {
		out[i].Rank = i + 1
	}
	return out
}
