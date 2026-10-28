import api from "../client";
import type {
  GameweekReportResponse,
  PlayerGWBreakdownResponse,
  PlayerPriceHistoryResponse,
} from "../../types";

export const getPlayerBreakdown = async (
  playerId: string,
  gwId: string,
): Promise<PlayerGWBreakdownResponse> => {
  const res = await api.get<{ data: PlayerGWBreakdownResponse }>(
    `/fantasy/players/${playerId}/gameweek/${gwId}/breakdown`,
  );
  return res.data.data;
};

export const getPlayerPriceHistory = async (
  playerId: string,
  seasonId?: string,
): Promise<PlayerPriceHistoryResponse> => {
  const res = await api.get<{ data: PlayerPriceHistoryResponse }>(
    `/fantasy/players/${playerId}/price-history`,
    { params: seasonId ? { season_id: seasonId } : undefined },
  );
  return res.data.data;
};

export const getGameweekReport = async (
  seasonId: string,
  gameweekId: string,
): Promise<GameweekReportResponse> => {
  const res = await api.get<{ data: GameweekReportResponse }>(
    `/fantasy/seasons/${seasonId}/gameweeks/${gameweekId}/report`,
  );
  return res.data.data;
};
