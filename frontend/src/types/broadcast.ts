export interface GraphicEvent {
  type: string;
  number?: string;
  player?: string;
  team?: string;
  stat?: string;
  photo?: string;
  compact?: boolean;
  large?: boolean;
  duration?: number;
}

export interface BroadcastState {
  match_id: string;
  home: string;
  away: string;
  home_short?: string;
  away_short?: string;
  home_logo?: string;
  away_logo?: string;
  manual_home: number;
  manual_away: number;
  pbp_home: number;
  pbp_away: number;
  period: string; // H1, HALF, H2, OT, FINAL
  clock_seconds: number;
  clock_running: boolean;
  clock_stamp: number; // Unix ms
  down: string; // 1, 2, 3, 4, 1G, 2G, 3G, 4G
  possession: string;
  timeouts_home: number;
  timeouts_away: number;
  scorebug: boolean;
  graphic?: GraphicEvent | null;
  graphic_id: number;
  updated_at: number;
  /** Full-screen scene on air; empty or absent = none. */
  scene?: BroadcastScene | '';
  /** Side shown attacking on the lineup scene. */
  lineup_attack?: 'home' | 'away';
  /** Starting-lineup introductions; null when not running. */
  lineup_intro?: LineupIntro | null;
}

/** Full-screen scenes on the scenes layer. */
export type BroadcastScene = 'opening' | 'attack' | 'defence' | 'standings' | 'h2h' | 'lineup' | 'facts';
// 'facts' is the single stats scene from before attack and defence were split;
// a state still holding it shows the attack scene.

/**
 * Starters are introduced one at a time in a fixed order. `cursor` starters are
 * already placed; the one at `cursor` is being introduced. Every overlay draws
 * the same picture from it, so separate vMix inputs stay in step.
 */
export interface LineupIntro {
  cursor: number;
}

export interface BroadcastPlayer {
  player_id: string;
  name: string;
  jersey_number: number;
  position: string;
  team_id: string;
  team_name: string;
  image?: string;
}

export function calculateClockNow(state: BroadcastState, now: number = Date.now()): number {
  if (!state.clock_running) {
    return Math.max(0, state.clock_seconds);
  }
  // A render-time `now` can trail a freshly stamped clock by one tick; never count up.
  const elapsed = Math.max(0, Math.floor((now - state.clock_stamp) / 1000));
  return Math.max(0, state.clock_seconds - elapsed);
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Which part of the overlay a vMix input shows. Separate scorebug and
 * lower-third inputs let the crew put them on different overlay channels and
 * take one off air (e.g. the scorebug during replays) without the other.
 */
export type OverlayLayer = 'all' | 'scorebug' | 'graphics' | 'scenes';

export const OVERLAY_LAYERS: { value: OverlayLayer; label: string; hint: string }[] = [
  { value: 'scorebug', label: 'Scorebug only', hint: 'Score, clock, down and possession' },
  { value: 'graphics', label: 'Lower-thirds only', hint: 'Touchdowns, penalties and other callouts' },
  {
    value: 'scenes',
    label: 'Full-screen scenes only',
    hint: 'Opening matchup, attack and defence stats, standings, head to head and starting lineup',
  },
  { value: 'all', label: 'Everything', hint: 'Scorebug, lower-thirds and scenes in one input' },
];

export function parseOverlayLayer(value: string | null): OverlayLayer {
  return value === 'scorebug' || value === 'graphics' || value === 'scenes' ? value : 'all';
}

export function overlayUrl(matchId: string, layer: OverlayLayer = 'all'): string {
  return overlayTargetUrl({ kind: 'match', matchId }, layer);
}

/**
 * What an overlay link follows: one match, or an event day, which shows
 * whichever of that day's matches the producer has put on air. A live stream
 * covers a whole match day, so vMix normally loads the day link once.
 */
export type OverlayTarget = { kind: 'match'; matchId: string } | { kind: 'day'; date: string };

export function overlayPath(target: OverlayTarget): string {
  return target.kind === 'day' ? `/broadcast/day/${target.date}/overlay` : `/broadcast/${target.matchId}/overlay`;
}

export function overlayTargetUrl(target: OverlayTarget, layer: OverlayLayer = 'all'): string {
  const base = `${window.location.origin}${overlayPath(target)}`;
  return layer === 'all' ? base : `${base}?layer=${layer}`;
}

/** A date with matches, titled by its event day when one exists. */
export interface BroadcastMatchDay {
  date: string; // YYYY-MM-DD
  match_count: number;
  live_match_count: number;
  event_title?: string;
  event_venue?: string;
  on_air_match_id?: string;
}

export interface BroadcastDayMatch {
  id: string;
  competition_name: string;
  time: string; // HH:MM
  venue: string;
  status: string;
  home_team: { name: string; logo: string };
  away_team: { name: string; logo: string };
  home_score: number | null;
  away_score: number | null;
}

// ── Full-screen scene data (GET /broadcast/:matchId/overlay/scenes) ──

export interface SceneMatch {
  id: string;
  competition: string;
  competition_format: string; // PRESEASON | SEASON | PLAYOFFS | CUP
  stage: string;
  event_title?: string;
  /** Order on its match day, from 1. */
  match_number?: number;
  date: string; // YYYY-MM-DD
  kickoff?: string; // HH:MM
  venue: string;
  status: string;
}

/** A player's totals in this competition, for the lineup introductions. */
export interface SceneSeasonStats {
  apps: number;
  receptions: number;
  receiving_tds: number;
  rushing_tds: number;
  passing_tds: number;
  passing_attempts: number;
  completed_passes: number;
  flag_pulls: number;
  interceptions: number;
  sacks: number;
  bat_downs: number;
  defensive_tds: number;
}

export interface ScenePlayer {
  id: string;
  name: string;
  number: number;
  position: string;
  gender?: string;
  image?: string;
  is_starter: boolean;
  unit?: 'OFFENSE' | 'DEFENSE';
  slot?: string;
  season?: SceneSeasonStats;
}

export interface SceneTeam {
  id: string;
  name: string;
  short: string;
  logo: string;
  won: number;
  drawn: number;
  lost: number;
  /** Table position; absent when the competition has no table. */
  position?: number;
  coverage?: number;
  /** The submitted team sheet; empty when there isn't one yet. */
  players: ScenePlayer[];
}

export interface SceneStanding {
  position: number;
  team_id: string;
  name: string;
  short: string;
  logo: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pf: number;
  pa: number;
  pd: number;
  pct: number;
  /** Last five results, oldest first, e.g. "WWLWL". */
  form: string;
}

/** A past meeting of the two teams, scored from this match's home and away sides. */
export interface SceneMeeting {
  date: string; // YYYY-MM-DD
  competition: string;
  home_score: number;
  away_score: number;
  /** Whether this match's home side was at home that day. */
  hosted_by_home: boolean;
}

export interface SceneData {
  match: SceneMatch;
  home: SceneTeam;
  away: SceneTeam;
  standings: SceneStanding[];
  /** Every earlier meeting, newest first; empty for a first meeting. */
  head_to_head: SceneMeeting[];
}
