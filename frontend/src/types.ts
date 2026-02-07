export interface Match {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore?: number;
    awayScore?: number;
    date: string; // ISO string
    status: 'scheduled' | 'live' | 'completed';
    venue: string;
}

export interface Team {
    id: string;
    name: string;
    logoUrl?: string;
    wins: number;
    losses: number;
    draws: number;
    points: number;
}

export interface Player {
    id: string;
    name: string;
    teamId: string;
    number: number;
    position: string;
    stats: {
        touchdowns: number;
        interceptions: number;
        mvps: number;
    };
}
