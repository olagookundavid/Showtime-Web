import type { QueryClient } from '@tanstack/react-query';
import type { ArenaDivision, ArenaMatch, ArenaSeason, ArenaSeasonStatus } from '../../../types';
import type { StatusTone } from '../../components';
import { WEEKDAYS, formatDateOnly } from '../../utils';

/** Shared bits of the organiser's Seasons screens. */

export const SEASON_STATUS: Record<ArenaSeasonStatus, { label: string; tone: StatusTone; blurb: string }> = {
  setup: { label: 'Setting up', tone: 'pending', blurb: 'Divisions, clubs and fixtures are being prepared. No results can be entered yet.' },
  active: { label: 'Live', tone: 'success', blurb: 'The league is being played. Results can be entered.' },
  playoffs: { label: 'Playoffs', tone: 'info', blurb: 'The league is over and the knock-out rounds are being played.' },
  completed: { label: 'Completed', tone: 'neutral', blurb: 'This season is finished and can no longer be changed.' },
};

/** The ids every Seasons query uses, so lists and details refresh together. */
export const seasonKeys = {
  all: ['arena', 'admin', 'seasons'] as const,
  one: (id: string) => ['arena', 'admin', 'seasons', id] as const,
  clubs: ['arena', 'admin', 'season-clubs'] as const,
  divisionMatches: (divisionId: string) => ['arena', 'admin', 'division-matches', divisionId] as const,
};

/**
 * Seasons, divisions, clubs and fixtures all feed the public pages, the
 * dashboard and the scope picker, so after any write everything under
 * ['arena'] is refreshed (only what's on screen is actually refetched).
 */
export const invalidateArena = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ['arena'] });

/** True when a match has a result (including a forfeit). */
export const isPlayed = (m: Pick<ArenaMatch, 'status'>): boolean => m.status === 'completed' || m.status === 'forfeit';

/** "Season 3" style fallback when only the number is known. */
export const seasonTitle = (s: Pick<ArenaSeason, 'name' | 'number'>): string => s.name || `Season ${s.number}`;

/** A date-only value as the first 10 characters (yyyy-mm-dd), whatever shape the server sent. */
export const dateValue = (v: string | null | undefined): string => (v ? v.slice(0, 10) : '');

/** "12 Oct 2026 to 25 Apr 2027", or what is missing. */
export const seasonDates = (s: Pick<ArenaSeason, 'starts_on' | 'ends_on'>): string => {
  const a = formatDateOnly(dateValue(s.starts_on));
  const b = formatDateOnly(dateValue(s.ends_on));
  if (a && b) return `${a} to ${b}`;
  if (a) return `From ${a}`;
  if (b) return `Until ${b}`;
  return 'Dates not set';
};

/** "20:00", "20:00 and 20:30", "20:00, 20:30 and 21:00". */
export const joinTimes = (times: string[]): string =>
  times.length <= 1 ? (times[0] ?? '') : `${times.slice(0, -1).join(', ')} and ${times[times.length - 1]}`;

/** "Sundays at 20:00 and 20:30 WAT". */
export const describeSchedule = (d: Pick<ArenaDivision, 'kickoff_day' | 'kickoff_slots'>): string =>
  `${WEEKDAYS[d.kickoff_day] ?? 'Sunday'}s at ${joinTimes(d.kickoff_slots)} WAT`;

/** One plain sentence on what a division's playoff places mean. */
export const playoffSummary = (spots: number): string => {
  if (spots === 4) return 'Top 4 go to the playoffs';
  if (spots === 2) return 'Top 2 play a final';
  return 'No playoffs';
};

/** The playoff rule in words, shown next to the Make playoffs button. */
export const playoffRule = (spots: number): string =>
  spots === 4
    ? 'The top 4 clubs play semi-finals (1st v 4th and 2nd v 3rd) and the winners meet in the final.'
    : 'The top 2 clubs play each other in a straight final.';

/** Today in Lagos as yyyy-mm-dd, for date inputs. */
export const todayInLagos = (): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const NO_MATCHES: ArenaMatch[] = [];
