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

export function calculateClockNow(state: BroadcastState): number {
  if (!state.clock_running) {
    return Math.max(0, state.clock_seconds);
  }
  const elapsed = Math.floor((Date.now() - state.clock_stamp) / 1000);
  return Math.max(0, state.clock_seconds - elapsed);
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
