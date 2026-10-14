package ports

import (
	"context"
	"showtime-backend/internal/domain"
	"time"
)

// totwStatsDay is where an edition's stats come from: its event day or, for an
// edition with none, the last finished match date of its competition on or before
// it was published. Both empty means there is nothing to read stats from.
func totwStatsDay(ctx context.Context, q potwQuerier, totwID string) (string, *time.Time, error) {
	var eventDayID *string
	var day *time.Time
	err := q.QueryRow(ctx, `
		SELECT tw.event_day_id::text,
		       (SELECT MAX(m.date) FROM matches m
		        WHERE m.competition_id = tw.competition_id AND m.status = 'FINISHED'
		          AND m.date <= COALESCE(tw.published_at, tw.created_at)::date)
		FROM team_of_the_week tw
		WHERE tw.id = $1
	`, totwID).Scan(&eventDayID, &day)
	if err != nil {
		return "", nil, err
	}
	if eventDayID != nil {
		return *eventDayID, nil, nil
	}
	return "", day, nil
}

// applyWeekStats replaces the stat lines typed on each player's Team of the Week
// card with what the match stats recorded for that week (domain.LiveStatLines),
// so a card shows real numbers even when nobody filled them in.
func applyWeekStats(ctx context.Context, q potwQuerier, totwID string, players []domain.POTWNominee) error {
	if len(players) == 0 {
		return nil
	}
	eventDayID, day, err := totwStatsDay(ctx, q, totwID)
	if err != nil {
		return err
	}
	if eventDayID == "" && day == nil {
		return nil
	}
	for i := range players {
		n := &players[i]
		stats, err := playerDayStats(ctx, q, n.PlayerID, eventDayID, day)
		if err != nil {
			return err
		}
		lines := domain.LiveStatLines([3]domain.StatLine{
			{Label: n.Stat1Label, Value: n.Stat1Value},
			{Label: n.Stat2Label, Value: n.Stat2Value},
			{Label: n.Stat3Label, Value: n.Stat3Value},
		}, stats)
		n.Stat1Label, n.Stat1Value = lines[0].Label, lines[0].Value
		n.Stat2Label, n.Stat2Value = lines[1].Label, lines[1].Value
		n.Stat3Label, n.Stat3Value = lines[2].Label, lines[2].Value
	}
	return nil
}

// ListWinners returns every Player of the Week on a published edition, newest
// first: those chosen by a fan vote and those named by the league office,
// including editions from before fan voting existed. A winner whose vote is still
// open stays hidden until it closes.
func (r *PostgresPOTWRepository) ListWinners(ctx context.Context) ([]domain.POTWWinner, error) {
	rows, err := r.db.Query(ctx, `
		SELECT tw.id, tw.week_title, COALESCE(c.name, ''), COALESCE(c.format, ''),
		       pp.id::text,
		       (pp.winner_source = 'VOTE' AND pp.winner_player_id = tw.player_of_the_week_id),
		       COALESCE(pp.closes_at, tw.published_at, tw.created_at),
		       (SELECT COUNT(*) FROM potw_votes v WHERE v.poll_id = pp.id),
		       (SELECT COUNT(*) FROM potw_votes v WHERE v.poll_id = pp.id AND v.player_id = tw.player_of_the_week_id),
		       p.id::text, p.name, COALESCE(p.image, ''), COALESCE(p.jersey_number, 0), COALESCE(p.position, ''),
		       COALESCE(t.id::text, ''), COALESCE(t.name, ''), COALESCE(t.logo, ''),
		       COALESCE(tp.position, ''), COALESCE(tp.rating, 0)::float8,
		       COALESCE(tp.stat1_value, ''), COALESCE(tp.stat1_label, ''),
		       COALESCE(tp.stat2_value, ''), COALESCE(tp.stat2_label, ''),
		       COALESCE(tp.stat3_value, ''), COALESCE(tp.stat3_label, '')
		FROM team_of_the_week tw
		JOIN players p ON p.id = tw.player_of_the_week_id
		LEFT JOIN competitions c ON c.id = tw.competition_id
		LEFT JOIN teams t ON t.id = p.team_id
		LEFT JOIN potw_polls pp ON pp.totw_id = tw.id
		LEFT JOIN LATERAL (
			SELECT position, rating, stat1_value, stat1_label, stat2_value, stat2_label, stat3_value, stat3_label
			FROM team_of_the_week_players
			WHERE totw_id = tw.id AND player_id = tw.player_of_the_week_id
			ORDER BY display_order
			LIMIT 1
		) tp ON true
		WHERE tw.is_published = true
		  AND (pp.id IS NULL OR pp.closes_at <= NOW())
		ORDER BY COALESCE(pp.closes_at, tw.published_at, tw.created_at) DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.POTWWinner
	for rows.Next() {
		var w domain.POTWWinner
		var byVote *bool
		n := &w.Player
		if err := rows.Scan(
			&w.TOTWID, &w.WeekTitle, &w.CompetitionName, &w.CompetitionFormat,
			&w.PollID, &byVote, &w.AwardedAt, &w.TotalVotes, &w.WinnerVotes,
			&n.PlayerID, &n.Name, &n.Image, &n.JerseyNumber, &n.Position,
			&n.TeamID, &n.TeamName, &n.TeamLogo,
			&n.TOTWPosition, &n.Rating,
			&n.Stat1Value, &n.Stat1Label, &n.Stat2Value, &n.Stat2Label, &n.Stat3Value, &n.Stat3Label,
		); err != nil {
			return nil, err
		}
		w.ByFanVote = byVote != nil && *byVote
		out = append(out, w)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	for i := range out {
		players := []domain.POTWNominee{out[i].Player}
		if err := applyWeekStats(ctx, r.db, out[i].TOTWID, players); err != nil {
			return nil, err
		}
		out[i].Player = players[0]
	}
	return out, nil
}
