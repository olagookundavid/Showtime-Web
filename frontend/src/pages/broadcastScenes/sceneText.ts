import type { SceneMatch, SceneTeam } from '../../types';

const STATUS_TAG: Record<string, string> = {
  SCHEDULED: 'COMING UP',
  LIVE: 'LIVE NOW',
  FINISHED: 'FULL TIME',
  POSTPONED: 'POSTPONED',
};

export const statusTag = (status: string) => STATUS_TAG[status] ?? 'COMING UP';

const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

/** "2–1 · 3rd place", "2–1–1" with draws, or "Season debut" before a first game. */
export function recordText(team: SceneTeam) {
  if (team.won + team.lost + team.drawn === 0) return 'Season debut';
  const record = team.drawn ? `${team.won}–${team.lost}–${team.drawn}` : `${team.won}–${team.lost}`;
  return team.position ? `${record} · ${ordinal(team.position)} place` : record;
}

/** "SHOWTIME BOWL XV · MATCH DAY 2 · MATCH 3", leaving out what isn't known. */
export function matchLine(match: SceneMatch) {
  return [match.competition, match.event_title, match.match_number ? `Match ${match.match_number}` : '']
    .filter(Boolean)
    .join(' · ')
    .toUpperCase();
}
