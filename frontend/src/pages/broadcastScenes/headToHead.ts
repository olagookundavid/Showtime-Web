import type { SceneMeeting } from '../../types';

export interface Biggest {
  margin: number;
  meeting: SceneMeeting;
}

export interface HeadToHeadSummary {
  meetings: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  homePoints: number;
  awayPoints: number;
  /** Each side's widest winning margin; undefined when it has never won. */
  homeBiggest?: Biggest;
  awayBiggest?: Biggest;
  /** The year of the first recorded meeting. */
  since?: string;
  recent: SceneMeeting[];
}

/** Totals across every meeting (scores already read home–away for this match). */
export function summariseHeadToHead(meetings: SceneMeeting[], recentCount = 5): HeadToHeadSummary {
  const s: HeadToHeadSummary = {
    meetings: meetings.length,
    homeWins: 0,
    awayWins: 0,
    draws: 0,
    homePoints: 0,
    awayPoints: 0,
    since: meetings.at(-1)?.date.slice(0, 4),
    recent: meetings.slice(0, recentCount),
  };
  for (const m of meetings) {
    s.homePoints += m.home_score;
    s.awayPoints += m.away_score;
    const margin = m.home_score - m.away_score;
    if (margin > 0) {
      s.homeWins += 1;
      if (!s.homeBiggest || margin > s.homeBiggest.margin) s.homeBiggest = { margin, meeting: m };
    } else if (margin < 0) {
      s.awayWins += 1;
      if (!s.awayBiggest || -margin > s.awayBiggest.margin) s.awayBiggest = { margin: -margin, meeting: m };
    } else {
      s.draws += 1;
    }
  }
  return s;
}
