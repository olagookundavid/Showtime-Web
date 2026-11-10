import api from "../client";
import type { PlayerLeaderboardResponse, PlayerLeaderboardSort } from "../../types";

/** Every player in the season ranked by fantasy points, with picking and transfer figures. */
export const getPlayerLeaderboard = async (
  seasonId: string,
  params?: {
    gameweek_id?: string;
    search?: string;
    position?: string;
    team_id?: string;
    gender?: "M" | "F";
    sort?: PlayerLeaderboardSort;
    page?: number;
    limit?: number;
  },
): Promise<PlayerLeaderboardResponse> => {
  const res = await api.get<PlayerLeaderboardResponse>(
    `/fantasy/season/${seasonId}/players/leaderboard`,
    { params },
  );
  return res.data;
};
