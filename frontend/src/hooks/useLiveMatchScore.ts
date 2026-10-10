import { useEffect, useState } from 'react';
import { API_URL } from '../constants';

interface LiveScore {
    home?: number;
    away?: number;
}

/** Live-updating score for one match, backed by the same SSE stream
 *  (`/matches/:id/plays/stream`, `score_updated` event) PlayByPlayTimeline
 *  already subscribes to. Falls back to the given initial score and only
 *  opens a connection while `enabled` (pass `match.status === 'LIVE'`). */
export const useLiveMatchScore = (
    matchId: string | undefined,
    initialHome: number | undefined,
    initialAway: number | undefined,
    enabled: boolean,
) => {
    const [score, setScore] = useState<LiveScore>({ home: initialHome, away: initialAway });

    useEffect(() => {
        setScore({ home: initialHome, away: initialAway });
    }, [initialHome, initialAway]);

    useEffect(() => {
        if (!enabled || !matchId) return;

        const es = new EventSource(`${API_URL}/matches/${matchId}/plays/stream`);
        const handleScore = (e: MessageEvent) => {
            const data = JSON.parse(e.data);
            setScore({ home: data.home_score, away: data.away_score });
        };
        es.addEventListener('score_updated', handleScore);

        return () => {
            es.close();
        };
    }, [matchId, enabled]);

    return { homeScore: score.home, awayScore: score.away };
};
