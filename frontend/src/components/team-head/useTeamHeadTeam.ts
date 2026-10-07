import { useOutletContext } from "react-router-dom";
import type { TeamHeadOutletContext } from "../../types/teamHead";

/** The manager's team, or null when none is assigned (or it is still loading). */
export const useTeamHeadTeam = () =>
  useOutletContext<TeamHeadOutletContext>().team;
