export interface SquadPlayer {
    id: string;
    player_id: string;
    name: string;
    image?: string;
    position: string;
    gender: string;
    club_id: string;
    club_name?: string;
    club_short_name?: string;
    club_logo?: string;
    purchase_price: number;
    current_price: number;
    /** In this gameweek's starting fourteen. Subs score nothing until brought in. */
    starting: boolean;
    /** False if the player's club has been deactivated or is not participating. */
    team_active?: boolean;
    /**
     * 'active' | 'inactive'. A squad can hold someone deleted after they were
     * signed: the row survives (migration 088), so the manager still sees what
     * they paid for, greyed out, instead of finding a gap in their squad. Like
     * an inactive club, they cannot be fielded.
     */
    player_status?: string;
    /** On their club's reserve list: can sit on the bench, cannot start. */
    is_reserve?: boolean;
    sell_price: number;
    /** Always true — the squad carries no restrictions. */
    can_sell: boolean;
    /** Selling them would leave a squad that cannot field a legal fourteen. The
     *  sale still goes through; this is what the confirmation warns about. */
    breaks_lineup: boolean;
    /** A woman whose sale leaves her unit with no margin on the female minimum. */
    quota_critical: boolean;
}

export interface SquadRules {
    budget: number;
    min_female_offense: number;
    min_female_defense: number;
    max_per_club: number;
}

export interface Squad {
    players: SquadPlayer[];
    bank: number;
    squad_value: number;
    female_offense: number;
    female_defense: number;
    squad_size: number;
    squad_min: number;
    squad_max: number;
    starting_xi: number;
    starters: number;
    subs: number;
    rules: SquadRules;
    readiness: SquadReadiness;
    /** The market shuts while a gameweek is being played and reopens once its
     *  scores are final. When false, `market_closed_reason` says why. */
    market_open: boolean;
    market_closed_reason?: string;
}

/** One line of the squad checklist. Guidance for the squad screen — the lineup
 *  selector is what actually enforces these. */
export interface SquadRequirement {
    key: string;
    label: string;
    have: number;
    need: number;
    met: boolean;
    hint?: string;
}

export interface SquadReadiness {
    requirements: SquadRequirement[];
    /** A legal starting fourteen can be drawn from the squad. */
    ready: boolean;
    /** Squad is under fourteen, so the match day would be forfeited. */
    forfeits: boolean;
    blocker?: string;
}
