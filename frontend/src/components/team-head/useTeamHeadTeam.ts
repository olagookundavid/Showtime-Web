import { useOutletContext } from "react-router-dom";

/** The team the signed-in manager runs, loaded once by TeamHeadLayout. */
export interface TeamHeadTeam {
  id: string;
  name: string;
  short_name: string;
  logo: string;
}

export type TeamHeadOutletContext = { team: TeamHeadTeam | null };

/** The manager's team, or null when none is assigned (or it is still loading). */
export const useTeamHeadTeam = () =>
  useOutletContext<TeamHeadOutletContext>().team;
