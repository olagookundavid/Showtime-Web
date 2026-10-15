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

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 wins · 1 loss · 3rd place" (draws only when there are any), or "Season debut" before a first game. */
export function recordText(team: SceneTeam) {
  if (team.won + team.lost + team.drawn === 0) return 'Season debut';
  const parts = [count(team.won, 'win', 'wins'), count(team.lost, 'loss', 'losses')];
  if (team.drawn) parts.push(count(team.drawn, 'draw', 'draws'));
  if (team.position) parts.push(`${ordinal(team.position)} place`);
  return parts.join(' · ');
}

/** "SHOWTIME BOWL XV · MATCH DAY 2 · MATCH 3", leaving out what isn't known. */
export function matchLine(match: SceneMatch) {
  return [match.competition, match.event_title, match.match_number ? `Match ${match.match_number}` : '']
    .filter(Boolean)
    .join(' · ')
    .toUpperCase();
}
