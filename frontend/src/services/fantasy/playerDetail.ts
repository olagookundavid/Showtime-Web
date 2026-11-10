import api from "../client";
import type { FantasyPlayerDetail } from "../../types";

/** One player's fantasy season: ranked figures, games, gameweeks, price history and facts. */
export const getFantasyPlayerDetail = async (
  seasonId: string,
  playerId: string,
  gameweekId?: string,
): Promise<FantasyPlayerDetail> => {
  const res = await api.get<FantasyPlayerDetail>(
    `/fantasy/season/${seasonId}/players/${playerId}`,
    { params: gameweekId ? { gameweek_id: gameweekId } : undefined },
  );
  return res.data;
};
