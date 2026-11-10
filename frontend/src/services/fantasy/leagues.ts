import api from "../client";
import type {
  FantasyLeague,
  JoinLeagueResponse,
  Leaderboard,
  LeaderboardEntry,
  LeagueJoinPreview,
  Paged,
} from "../../types";

interface RawLeaderboard {
  data: LeaderboardEntry[] | null;
  total: number;
  total_pages: number;
  my_rank?: number;
  my_entry?: LeaderboardEntry | null;
}

// Public league browse/join/leaderboard calls — split out of the old combined
// fantasyApi object.
export const fantasyLeaguesApi = {
  // Paged on the server — the public browse list grows with every league
  // anyone creates, so it is never fetched whole.
  listPublicLeagues: async (
    seasonId: string,
    params?: { page?: number; limit?: number },
  ): Promise<Paged<FantasyLeague>> => {
    const res = await api.get<Paged<FantasyLeague>>("/fantasy/leagues/public", {
      params: { season_id: seasonId, ...params },
    });
    return { ...res.data, data: res.data.data ?? [] };
  },
  listMyLeagues: async (seasonId: string): Promise<FantasyLeague[]> => {
    // Feeds the dashboard tiles and the leaderboard's league filter, both of
    // which need every league the manager is in, so it asks for the cap.
    const res = await api.get<{ data: FantasyLeague[] }>(
      "/fantasy/leagues/mine",
      {
        params: { season_id: seasonId, limit: 200 },
      },
    );
    return res.data.data || [];
  },
  createLeague: async (payload: {
    season_id: string;
    name: string;
    type: "PUBLIC" | "PRIVATE";
    entry_fee: number;
    max_members: number;
    // How the creator wants the pool divided. Omitted, the season default
    // (50/30/20) applies.
    prize_structure?: { rank: number; percent: number }[];
  }): Promise<FantasyLeague> => {
    const res = await api.post<{ data: FantasyLeague }>(
      "/fantasy/leagues",
      payload,
    );
    return res.data.data;
  },
  // A PUBLIC league is joined straight from the browse list by id; a PRIVATE
  // one needs its invite code. Pass whichever you have.
  joinLeague: async (
    seasonId: string,
    by: { invite_code?: string; league_id?: string },
  ): Promise<JoinLeagueResponse> => {
    // The handler wraps the payload as { message, data }, so the join
    // details are a level down. Returning the envelope left paystack_url
    // undefined, and a paid join silently reported success instead of
    // sending the manager to checkout.
    const res = await api.post<{ message: string; data: JoinLeagueResponse }>(
      "/fantasy/leagues/join",
      by,
      { params: { season_id: seasonId } },
    );
    return res.data.data;
  },
  // Leaving drops the manager out of the league's table. A free league can be
  // rejoined; a paid one cannot — the entry fee stays in the prize pool.
  leaveLeague: async (leagueId: string): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>(
      `/fantasy/leagues/${leagueId}/leave`,
    );
    return res.data;
  },
  verifyLeaguePayment: async (
    reference: string,
  ): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>("/fantasy/leagues/verify", {
      reference,
    });
    return res.data;
  },
  getLeaderboard: async (
    leagueId: string,
    params?: { gameweek_id?: string; page?: number; limit?: number },
  ): Promise<Leaderboard> => {
    const res = await api.get<RawLeaderboard>(
      `/fantasy/leagues/${leagueId}/leaderboard`,
      { params },
    );
    // An empty list must reach the UI as [], never null — callers read
    // .length and .map on it directly.
    return {
      ...res.data,
      data: res.data.data ?? [],
      my_rank: res.data.my_rank ?? 0,
      my_entry: res.data.my_entry ?? null,
    };
  },
  getOverallLeaderboard: async (
    seasonId: string,
    params?: { gameweek_id?: string; page?: number; limit?: number },
  ): Promise<Leaderboard> => {
    const res = await api.get<RawLeaderboard>(
      `/fantasy/season/${seasonId}/leaderboard`,
      { params },
    );
    return {
      ...res.data,
      data: res.data.data ?? [],
      my_rank: res.data.my_rank ?? 0,
      my_entry: res.data.my_entry ?? null,
    };
  },
};

export const fantasyLeagueApi = {
  // The terms of a league — cost, field size, prize split, refund policy —
  // read before any join or payment is set in motion.
  getJoinPreview: async (leagueId: string): Promise<LeagueJoinPreview> => {
    const res = await api.get<{ data: LeagueJoinPreview }>(
      `/fantasy/leagues/${leagueId}/preview`,
    );
    return res.data.data;
  },
  // A private league is never listed, so its invite code is the only handle a
  // prospective member has. Same terms, resolved by code.
  getJoinPreviewByCode: async (code: string): Promise<LeagueJoinPreview> => {
    const res = await api.get<{ data: LeagueJoinPreview }>(
      "/fantasy/leagues/preview",
      {
        params: { code },
      },
    );
    return res.data.data;
  },
  // The platform's share of entry fees, for the league creation form. Only
  // the creator is shown this — it is what comes off the top before they
  // price an entry fee.
  getPlatformCutPercent: async (): Promise<number> => {
    const res = await api.get<{ data: { cut_percent: number } }>(
      "/fantasy/platform-cut",
    );
    return res.data.data.cut_percent;
  },
};
