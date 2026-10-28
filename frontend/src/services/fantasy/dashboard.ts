import api from "../client";
import type { DashboardTeam, FantasyDashboard } from "../../types";

export const fantasySeasonApi = {
  // Works before entry too: an un-entered visitor gets the season and
  // standings, which is what the "join this season" screen renders.
  getDashboard: async (seasonId?: string): Promise<FantasyDashboard | null> => {
    const res = await api.get<{ data: FantasyDashboard | null }>(
      "/fantasy/dashboard",
      {
        params: seasonId ? { season_id: seasonId } : undefined,
      },
    );
    return res.data.data;
  },
  // The deliberate opt-in. Nothing is created for a manager until this runs.
  enterSeason: async (
    seasonId: string,
    teamName: string,
  ): Promise<DashboardTeam> => {
    const res = await api.post<{ data: DashboardTeam }>(
      `/fantasy/seasons/${seasonId}/enter`,
      {
        team_name: teamName,
      },
    );
    return res.data.data;
  },
};

/** Fantasy prices are in fantasy millions — the unit the pricing model works in.
 *  Defined once so the label cannot drift between screens. */
export const formatFantasyPrice = (v: number | null | undefined): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return `₦${n.toFixed(1)}m`;
};
