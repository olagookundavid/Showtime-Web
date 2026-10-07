export interface GraphicEvent {
  type: string;
  number?: string;
  player?: string;
  team?: string;
  stat?: string;
  photo?: string;
  compact?: boolean;
  duration?: number;
}

export interface BroadcastState {
  match_id: string;
  home: string;
  away: string;
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
export type OverlayLayer = 'all' | 'scorebug' | 'graphics';

export const OVERLAY_LAYERS: { value: OverlayLayer; label: string; hint: string }[] = [
  { value: 'scorebug', label: 'Scorebug only', hint: 'Score, clock, down and possession' },
  { value: 'graphics', label: 'Lower-thirds only', hint: 'Touchdowns, penalties and other callouts' },
  { value: 'all', label: 'Everything', hint: 'Scorebug and lower-thirds in one input' },
];

export function parseOverlayLayer(value: string | null): OverlayLayer {
  return value === 'scorebug' || value === 'graphics' ? value : 'all';
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
