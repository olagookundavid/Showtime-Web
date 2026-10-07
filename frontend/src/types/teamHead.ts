/** The team the signed-in manager runs, loaded once by TeamHeadLayout. */
export interface TeamHeadTeam {
    id: string;
    name: string;
    short_name: string;
    logo: string;
}

export type TeamHeadOutletContext = { team: TeamHeadTeam | null };
