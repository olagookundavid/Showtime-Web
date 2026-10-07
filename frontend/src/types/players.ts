import type { Team } from './matches';
import type { PlayerBadge } from './badges';

export interface Player {
    id: string;
    name: string;
    jersey_number: number;
    position: string;
    secondary_position?: string;
    gender?: string;
    team: Team;
    bio: string;
    image: string;
    email?: string;
    // 'active' | 'inactive'. Deleting a player only deactivates them, so their
    // stats and history survive; anything listing them renders an inactive
    // player greyed out rather than hiding them. Absent on older responses,
    // which are treated as active.
    status?: string;
    is_reserve?: boolean;
    mvp_count?: number;
    tier?: 'Superstar' | 'Star' | 'Starter' | 'Prospect' | string;
    badges?: PlayerBadge[];
}

export interface RosterSummary {
    main_count: number;
    reserve_count: number;
    max_main_limit: number;
    can_add_or_promote: boolean;
    allrounder_count: number;
    max_allrounder_limit: number;
}

// Leaner, unhydrated player row returned by the team-head roster endpoint
// (/team-head/players) — team_id instead of a nested team object, and no
// mvp_count/tier/badges.
export interface TeamHeadPlayer {
    id: string;
    name: string;
    position: string;
    secondary_position?: string;
    gender?: string;
    jersey_number: number;
    email?: string;
    image: string;
    team_id: string;
    bio: string;
    is_reserve?: boolean;
    /** 'active' | 'inactive'. Deleting only deactivates (migration 088). */
    status?: string;
}

export interface CreatePlayerPayload {
    name: string;
    jersey_number?: number;
    position?: string;
    secondary_position?: string;
    gender?: string;
    team_id: string;
    bio?: string;
    image?: string;
    email: string;
}
