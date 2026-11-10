import api from "../client";
import type { Squad, SquadReadiness } from "../../types";

const normaliseSquad = (s: Squad): Squad => ({
  ...s,
  players: s?.players ?? [],
  readiness: {
    ...s?.readiness,
    requirements: s?.readiness?.requirements ?? [],
  } as SquadReadiness,
});

export const fantasySquadApi = {
  getSquad: async (seasonId: string): Promise<Squad> => {
    const res = await api.get<{ data: Squad }>("/fantasy/squad", {
      params: { season_id: seasonId },
    });
    return normaliseSquad(res.data.data);
  },
  // Buy and sell both return the whole squad, so the dashboard reflects the
  // new balance without a second round trip.
  buyPlayer: async (seasonId: string, playerId: string): Promise<Squad> => {
    const res = await api.post<{ data: Squad }>(
      "/fantasy/squad/buy",
      { player_id: playerId },
      { params: { season_id: seasonId } },
    );
    return normaliseSquad(res.data.data);
  },
  sellPlayer: async (seasonId: string, playerId: string): Promise<Squad> => {
    const res = await api.post<{ data: Squad }>(
      "/fantasy/squad/sell",
      { player_id: playerId },
      { params: { season_id: seasonId } },
    );
    return normaliseSquad(res.data.data);
  },
};
