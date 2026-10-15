package broadcast

import (
	"context"
	"log"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
)

// Data for the full-screen scenes (opening matchup, standings and starting
// lineup), assembled from the match, its team sheets and the live standings.
// The attack and defence stat scenes read the public match stats and play log
// directly, through the same calculation as the match page. The overlay fetches it while a scene is up,
// so it is built on demand rather than kept in the hub.

type SceneData struct {
	Match     SceneMatch      `json:"match"`
	Home      SceneTeam       `json:"home"`
	Away      SceneTeam       `json:"away"`
	Standings []SceneStanding `json:"standings"`
}

type SceneMatch struct {
	ID                string `json:"id"`
	Competition       string `json:"competition"`
	CompetitionFormat string `json:"competition_format"` // PRESEASON | SEASON | PLAYOFFS | CUP
	Stage             string `json:"stage"`              // "Regular Season", or the knockout round
	EventTitle        string `json:"event_title,omitempty"`
	MatchNumber       int    `json:"match_number,omitempty"` // order on its match day, from 1
	Date              string `json:"date"`
	Kickoff           string `json:"kickoff,omitempty"` // HH:MM
	Venue             string `json:"venue"`
	Status            string `json:"status"`
}

type SceneTeam struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Short string `json:"short"`
	Logo  string `json:"logo"`
	Won   int    `json:"won"`
	Drawn int    `json:"drawn"`
	Lost  int    `json:"lost"`
	// Position in the competition table; 0 when it has none.
	Position int `json:"position,omitempty"`
	// Coverage is the team sheet's defensive scheme (Cover N); 0 = not set.
	Coverage int `json:"coverage,omitempty"`
	// Players is the submitted team sheet; empty when there is none yet.
	Players []ScenePlayer `json:"players"`
}

type ScenePlayer struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Number    int               `json:"number"`
	Position  string            `json:"position"`
	Gender    string            `json:"gender,omitempty"`
	Image     string            `json:"image,omitempty"`
	IsStarter bool              `json:"is_starter"`
	Unit      string            `json:"unit,omitempty"` // OFFENSE | DEFENSE
	Slot      string            `json:"slot,omitempty"` // the team sheet's position_slot
	Season    *SceneSeasonStats `json:"season,omitempty"`
}

// SceneSeasonStats are a player's totals in this competition, for the lineup's
// "now introducing" card; the overlay picks the three that suit the role.
type SceneSeasonStats struct {
	Apps            int `json:"apps"`
	Receptions      int `json:"receptions"`
	ReceivingTDs    int `json:"receiving_tds"`
	RushingTDs      int `json:"rushing_tds"`
	PassingTDs      int `json:"passing_tds"`
	PassingAttempts int `json:"passing_attempts"`
	CompletedPasses int `json:"completed_passes"`
	FlagPulls       int `json:"flag_pulls"`
	Interceptions   int `json:"interceptions"`
	Sacks           int `json:"sacks"`
	BatDowns        int `json:"bat_downs"`
	DefensiveTDs    int `json:"defensive_tds"`
}

type SceneStanding struct {
	Position int     `json:"position"`
	TeamID   string  `json:"team_id"`
	Name     string  `json:"name"`
	Short    string  `json:"short"`
	Logo     string  `json:"logo"`
	Played   int     `json:"played"`
	Won      int     `json:"won"`
	Drawn    int     `json:"drawn"`
	Lost     int     `json:"lost"`
	PF       int     `json:"pf"`
	PA       int     `json:"pa"`
	PD       int     `json:"pd"`
	PCT      float64 `json:"pct"`
	Form     string  `json:"form"` // last five results, oldest first, e.g. "WWLWL"
}

func stageLabel(format, round string) string {
	if round != "" {
		return round
	}
	switch strings.ToUpper(format) {
	case "PRESEASON":
		return "Preseason"
	case "PLAYOFFS":
		return "Playoffs"
	case "CUP":
		return "Cup"
	default:
		return "Regular Season"
	}
}

func sceneTeam(t *domain.Team, sheet []domain.TeamSheetPlayer, coverage int) SceneTeam {
	team := SceneTeam{Coverage: coverage, Players: make([]ScenePlayer, 0, len(sheet))}
	if t != nil {
		team.ID, team.Name, team.Short, team.Logo = t.ID, t.Name, t.ShortName, t.Logo
	}
	for _, p := range sheet {
		team.Players = append(team.Players, ScenePlayer{
			ID:        p.PlayerID,
			Name:      p.Name,
			Number:    p.JerseyNumber,
			Position:  p.Position,
			Gender:    p.Gender,
			Image:     p.Image,
			IsStarter: p.IsStarter,
			Unit:      p.StarterUnit,
			Slot:      p.PositionSlot,
		})
	}
	return team
}

func sceneStandings(rows []dto.StandingResponse) []SceneStanding {
	out := make([]SceneStanding, 0, len(rows))
	for _, r := range rows {
		s := SceneStanding{
			Position: r.Position, Played: r.Played, Won: r.Won, Drawn: r.Drawn, Lost: r.Lost,
			PF: r.GoalsFor, PA: r.GoalsAgainst, PD: r.GoalDiff, PCT: r.PCT, Form: r.L5,
		}
		if r.Team != nil {
			s.TeamID, s.Name, s.Short, s.Logo = r.Team.ID, r.Team.Name, r.Team.ShortName, r.Team.Logo
		}
		out = append(out, s)
	}
	return out
}

func seasonStats(p domain.AggregatedPlayerStat) *SceneSeasonStats {
	return &SceneSeasonStats{
		Apps:            p.Apps,
		Receptions:      p.Receptions,
		ReceivingTDs:    p.ReceivingTDs,
		RushingTDs:      p.RushingTDs,
		PassingTDs:      p.PassingTDs,
		PassingAttempts: p.PassingAttempts,
		CompletedPasses: p.CompletedPasses,
		FlagPulls:       p.FlagPulls,
		Interceptions:   p.Interceptions,
		Sacks:           p.DefSacks,
		BatDowns:        p.PassDeflections,
		DefensiveTDs:    p.DefensiveTDs,
	}
}

// buildSceneData assembles the scenes for a match. Only the match itself is
// required; a missing table or stat line leaves its part empty so the other
// scenes still show.
func (h *BroadcastHandler) buildSceneData(ctx context.Context, matchID string) (*SceneData, error) {
	detail, err := h.matchService.GetMatchDetail(ctx, matchID)
	if err != nil {
		return nil, err
	}
	m := detail.Match
	date := m.Date.Format("2006-01-02")

	data := &SceneData{
		Match: SceneMatch{
			ID:     matchID,
			Date:   date,
			Venue:  m.Venue,
			Status: string(m.Status),
			Stage:  stageLabel("", m.Round),
		},
		Home:      sceneTeam(m.HomeTeam, detail.TeamSheet.HomeTeam, detail.TeamSheet.HomeCoverage),
		Away:      sceneTeam(m.AwayTeam, detail.TeamSheet.AwayTeam, detail.TeamSheet.AwayCoverage),
		Standings: []SceneStanding{},
	}
	if m.Competition != nil {
		data.Match.Competition = m.Competition.Name
		data.Match.CompetitionFormat = m.Competition.Format
		data.Match.Stage = stageLabel(m.Competition.Format, m.Round)
	}

	// The match day: its event title, and this match's kick-off and order on it.
	if h.days != nil {
		if day, err := h.days.GetMatchDay(ctx, date); err == nil {
			data.Match.EventTitle = day.EventTitle
		}
		if dayMatches, err := h.days.ListDayMatches(ctx, date); err == nil {
			for i, dm := range dayMatches {
				if dm.ID == matchID {
					data.Match.MatchNumber = i + 1
					data.Match.Kickoff = dm.Time
					break
				}
			}
		}
	}

	// The live table (it counts in-progress matches at their current score),
	// plus each side's record and position from it.
	if m.CompetitionID != "" {
		rows, _, err := h.matchService.GetStandings(ctx, m.CompetitionID, 1, 100)
		if err != nil {
			log.Printf("[BroadcastScenes] standings for match %s: %v", matchID, err)
		} else {
			data.Standings = sceneStandings(rows)
			for _, s := range data.Standings {
				for _, team := range []*SceneTeam{&data.Home, &data.Away} {
					if team.ID != "" && s.TeamID == team.ID {
						team.Won, team.Drawn, team.Lost, team.Position = s.Won, s.Drawn, s.Lost, s.Position
					}
				}
			}
		}
	}

	// Each player's season so far in this competition, for the lineup intros.
	if h.statsService != nil && m.CompetitionID != "" {
		for _, team := range []*SceneTeam{&data.Home, &data.Away} {
			if team.ID == "" || len(team.Players) == 0 {
				continue
			}
			season, _, err := h.statsService.GetPlayerStats(ctx, domain.StatsFilter{
				CompetitionID: m.CompetitionID, TeamID: team.ID, Page: 1, Limit: 100,
			})
			if err != nil {
				log.Printf("[BroadcastScenes] season stats for team %s: %v", team.ID, err)
				continue
			}
			byPlayer := make(map[string]domain.AggregatedPlayerStat, len(season))
			for _, s := range season {
				byPlayer[s.PlayerID] = s
			}
			for i := range team.Players {
				if s, ok := byPlayer[team.Players[i].ID]; ok {
					team.Players[i].Season = seasonStats(s)
				}
			}
		}
	}

	return data, nil
}
