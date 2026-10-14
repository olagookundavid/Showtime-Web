import type { Player } from './players';
import type { Competition } from './matches';

export interface Badge {
    id: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    color_scheme: string;
    is_system: boolean;
    created_at: string;
    updated_at: string;
}

export interface PlayerBadgeAward {
    id: string;
    player_id: string;
    badge_id: string;
    competition_id?: string;
    competition_name?: string;
    season_id?: string;
    season?: string;
    match_id?: string;
    totw_id?: string;
    reason: string;
    awarded_by?: string;
    created_at: string;
    badge?: Badge;
    player?: Player;
    competition?: Competition;
}

export interface PlayerBadge {
    id: string;
    player_id: string;
    badge_id: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    color_scheme: string;
    count: number;
    last_awarded_at: string;
    awards?: PlayerBadgeAward[];
}

/** One piece of artwork in the badge library. Badges pick their image from here. */
export interface BadgeIcon {
    id: string;
    name: string;
    image_url: string;
    /** Names of the badges currently showing this artwork. */
    used_by: string[];
    created_at: string;
    updated_at: string;
}

export interface SaveBadgeIconPayload {
    name: string;
    image_url: string;
}

/** Saving artwork; a replaced image also moves the badges that used the old one. */
export interface UpdateBadgeIconResult {
    icon: BadgeIcon;
    badges_updated: number;
}

export interface CreateBadgePayload {
    code: string;
    name: string;
    description?: string;
    icon?: string;
    category?: string;
    color_scheme?: string;
}

export interface UpdateBadgePayload {
    name: string;
    description?: string;
    icon?: string;
    category?: string;
    color_scheme?: string;
}

export interface AwardBadgePayload {
    player_id: string;
    badge_id: string;
    competition_id?: string;
    season_id?: string;
    season?: string;
    event_day_id?: string;
    match_id?: string;
    reason?: string;
    increment?: number;
    count?: number;
}
