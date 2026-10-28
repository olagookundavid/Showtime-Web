import api from "../client";
import type {
  AdminFantasyOverview,
  AdminLeagueMemberRow,
  AdminLeagueRow,
  AdminManagerRow,
  AdminPlayerPriceRow,
  FantasySeason,
  FantasyWallet,
  LeagueFinance,
  MoneyOwed,
  Paged,
  PayoutRequest,
  PayoutStatus,
  SettlementResult,
} from "../../types";

export const fantasyAdminApi = {
  // Returns every season including DRAFT ones. `getActiveSeason` only ever
  // returns an ACTIVE season, so admin screens must use this or they cannot
  // see — let alone activate — a season they just created.
  listSeasons: async (): Promise<FantasySeason[]> => {
    const res = await api.get<{ data: FantasySeason[] }>(
      "/admin/fantasy/seasons",
      {
        params: { limit: 200 },
      },
    );
    return res.data.data || [];
  },
  listPlayerPrices: async (
    seasonId: string,
    params?: {
      search?: string;
      position?: string;
      team_id?: string;
      override_status?: "all" | "overridden" | "calculated";
      page?: number;
      limit?: number;
    },
  ): Promise<Paged<AdminPlayerPriceRow>> => {
    const res = await api.get<Paged<AdminPlayerPriceRow>>(
      `/admin/fantasy/seasons/${seasonId}/prices`,
      { params },
    );
    return res.data;
  },
  overridePlayerPrice: async (
    seasonId: string,
    playerId: string,
    payload: { price?: number; reset?: boolean },
  ): Promise<AdminPlayerPriceRow> => {
    const res = await api.put<{ data: AdminPlayerPriceRow }>(
      `/admin/fantasy/seasons/${seasonId}/prices/${playerId}`,
      payload,
    );
    return res.data.data;
  },
  // Only a DRAFT season with no squads entered can be deleted; the server
  // refuses anything already launched.
  deleteSeason: async (seasonId: string): Promise<void> => {
    await api.delete(`/admin/fantasy/seasons/${seasonId}`);
  },
  getOverview: async (seasonId: string): Promise<AdminFantasyOverview> => {
    const res = await api.get<{ data: AdminFantasyOverview }>(
      `/admin/fantasy/seasons/${seasonId}/overview`,
    );
    return res.data.data;
  },
  listManagers: async (
    seasonId: string,
    params?: { search?: string; page?: number; limit?: number },
  ): Promise<Paged<AdminManagerRow>> => {
    const res = await api.get<Paged<AdminManagerRow>>(
      `/admin/fantasy/seasons/${seasonId}/managers`,
      { params },
    );
    return res.data;
  },
  // Includes PRIVATE leagues, unlike the public browse endpoint.
  listLeagues: async (
    seasonId: string,
    params?: { search?: string; page?: number; limit?: number },
  ): Promise<Paged<AdminLeagueRow>> => {
    const res = await api.get<Paged<AdminLeagueRow>>(
      `/admin/fantasy/seasons/${seasonId}/leagues`,
      { params },
    );
    return res.data;
  },
  getLeagueFinance: async (leagueId: string): Promise<LeagueFinance> => {
    const res = await api.get<{ data: LeagueFinance }>(
      `/admin/fantasy/leagues/${leagueId}/finance`,
    );
    // An unfunded league projects no awards, and a Go nil slice arrives as
    // `null`. The page reduces and maps over both of these lists, so they
    // are normalised here rather than guarded at every use.
    const finance = res.data.data;
    return {
      ...finance,
      awards: finance?.awards ?? [],
      prize_structure: finance?.prize_structure ?? [],
    };
  },
  listLeagueMembers: async (
    leagueId: string,
    params?: { page?: number; limit?: number },
  ): Promise<Paged<AdminLeagueMemberRow>> => {
    const res = await api.get<Paged<AdminLeagueMemberRow>>(
      `/admin/fantasy/leagues/${leagueId}/members`,
      { params },
    );
    return { ...res.data, data: res.data.data ?? [] };
  },
  setPrizeStructure: async (
    leagueId: string,
    tiers: { rank: number; percent: number }[],
  ): Promise<LeagueFinance> => {
    const res = await api.put<{ data: LeagueFinance }>(
      `/admin/fantasy/leagues/${leagueId}/prizes`,
      { tiers },
    );
    return res.data.data;
  },
  // Throws 409 if the league was already settled.
  settleLeague: async (leagueId: string): Promise<SettlementResult> => {
    const res = await api.post<{ data: SettlementResult }>(
      `/admin/fantasy/leagues/${leagueId}/settle`,
    );
    return res.data.data;
  },
  settleSeason: async (seasonId: string): Promise<SettlementResult> => {
    const res = await api.post<{ data: SettlementResult }>(
      `/admin/fantasy/seasons/${seasonId}/settle`,
    );
    return res.data.data;
  },
  // Settles every outstanding paid league, then closes the season.
  completeSeason: async (seasonId: string): Promise<SettlementResult> => {
    const res = await api.post<{ data: SettlementResult }>(
      `/admin/fantasy/seasons/${seasonId}/complete`,
    );
    return res.data.data;
  },
  // Everyone the platform currently owes prize money to, and the account it
  // would be sent to. Settling a league credits wallets; this is what those
  // credits add up to before any transfer is made.
  getMoneyOwed: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<MoneyOwed> => {
    const res = await api.get<{ data: MoneyOwed }>("/admin/fantasy/owed", {
      params,
    });
    return { ...res.data.data, rows: res.data.data?.rows ?? [] };
  },
  listPayouts: async (params?: {
    status?: PayoutStatus | "";
    page?: number;
    limit?: number;
  }): Promise<Paged<PayoutRequest>> => {
    const res = await api.get<Paged<PayoutRequest>>("/admin/fantasy/payouts", {
      params,
    });
    return res.data;
  },
  // payment_reference is required when moving a payout to PAID.
  updatePayoutStatus: async (
    payoutId: string,
    payload: {
      status: "PROCESSING" | "PAID" | "REJECTED";
      admin_notes?: string;
      payment_reference?: string;
    },
  ): Promise<PayoutRequest> => {
    const res = await api.put<{ data: PayoutRequest }>(
      `/admin/fantasy/payouts/${payoutId}/status`,
      payload,
    );
    return res.data.data;
  },
  getUserWallet: async (userId: string): Promise<FantasyWallet> => {
    const res = await api.get<{ data: FantasyWallet }>(
      `/admin/fantasy/users/${userId}/wallet`,
    );
    return res.data.data;
  },
};
