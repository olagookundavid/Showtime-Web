// Player leaderboard: every player in the season ranked by fantasy points,
// scored from their own match stats whether or not anyone picked them.

export type PlayerLeaderboardSort =
    | 'points'
    | 'gameweek_points'
    | 'form'
    | 'ppg'
    | 'value'
    | 'selected'
    | 'started'
    | 'transfers_in'
    | 'transfers_out'
    | 'price'
    | 'price_change'
    | 'appearances'
    | 'name';

export interface PlayerLeaderboardItem {
    /** By points over the whole pool; ties share a rank, and a search does not renumber anyone. */
    rank: number;
    player_id: string;
    player_name: string;
    player_image: string;
    position: string;
    gender: string;
    team_id: string;
    team_name: string;
    team_short_name: string;
    team_logo: string;
    /** False for a club reserve, an inactive club or a deactivated player: they rank, but cannot start. */
    available: boolean;
    unavailable_reason?: string;
    /** Season points, or the selected gameweek's. */
    points: number;
    season_points: number;
    gameweek_points: number;
    form: number;
    points_per_game: number;
    appearances: number;
    best_gameweek_points: number;
    /** Season points per ₦1m of current price. */
    value: number;
    price: number;
    price_change: number;
    owned_by: number;
    selected_by_pct: number;
    started_by: number;
    started_by_pct: number;
    season_starts: number;
    transfers_in: number;
    transfers_out: number;
}

export interface PlayerLeaderboardGameweek {
    id: string;
    number: number;
}

export interface PlayerLeaderboardHighlight {
    key: string;
    label: string;
    value: number;
    player: PlayerLeaderboardItem | null;
}

export interface PlayerLeaderboardResponse {
    data: PlayerLeaderboardItem[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    /** The gameweek the per-gameweek columns describe. */
    gameweek: PlayerLeaderboardGameweek | null;
    played_gameweeks: PlayerLeaderboardGameweek[];
    squad_count: number;
    highlights: PlayerLeaderboardHighlight[];
    teams: { id: string; name: string; short_name: string; logo: string }[];
    positions: string[];
}
