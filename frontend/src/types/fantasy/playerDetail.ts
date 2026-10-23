// The fantasy player page: one player's season in fantasy terms. The headline
// figures are the same ones the player leaderboard shows, ranked the same way.
import type { PlayerLeaderboardGameweek, PlayerLeaderboardItem } from './playerLeaderboard';

export interface FantasyDetailClub {
    id: string;
    name: string;
    short_name: string;
    logo: string;
}

export interface FantasyDetailPlayer {
    id: string;
    name: string;
    image: string;
    position: string;
    gender: string;
    club: FantasyDetailClub;
    /** False for a club reserve, an inactive club or a deactivated player. */
    available: boolean;
    unavailable_reason?: string;
}

/** One played gameweek. Every one is listed, with 0 games where the player missed it. */
export interface FantasyDetailGameweek {
    id: string;
    number: number;
    points: number;
    games: number;
    started_by: number;
    started_by_pct: number;
    /** What the player cost after this gameweek was scored; 0 when none was recorded. */
    price: number;
    price_change: number;
}

/** One thing that earned (or cost) points in a game. */
export interface FantasyScoreLine {
    label: string;
    points: number;
}

export interface FantasyDetailMatch {
    match_id: string;
    /** 1 for the player's first game of the season, whatever gameweek is shown. */
    game_number: number;
    gameweek_id: string;
    gameweek_number: number;
    date: string;
    opponent: FantasyDetailClub;
    home: boolean;
    /** "W 24-18", "L 12-30" or "D 6-6"; empty until the match has finished. */
    result: string;
    points: number;
    scoring: FantasyScoreLine[];
}

export interface FantasyDetailFact {
    key: string;
    label: string;
    value: string;
    detail?: string;
}

export interface FantasyPlayerPriceHistoryItem {
    gameweek_id?: string;
    gameweek_number: number;
    gameweek_label: string;
    price: number;
    calculated_price: number;
    change: number;
    percentage_change: number;
    rating: number;
    is_overridden: boolean;
    created_at: string;
}

export interface FantasyPlayerDetail {
    player: FantasyDetailPlayer;
    /** The gameweek asked for; null is the whole season. */
    gameweek: PlayerLeaderboardGameweek | null;
    summary: PlayerLeaderboardItem;
    pool_size: number;
    position_rank: number;
    position_size: number;
    squad_count: number;
    gameweeks: FantasyDetailGameweek[];
    /** Games in the chosen view, oldest first. */
    matches: FantasyDetailMatch[];
    /** Newest first, opening price last. */
    price_history: FantasyPlayerPriceHistoryItem[];
    facts: FantasyDetailFact[];
}
