import api from "../client";
import type {
  FantasyGameweek,
  FantasyLineupResponse,
  FantasyPlayerListItem,
  FantasySeason,
  FantasySlot,
  FantasyTeamLineupDetailResponse,
  MarketSort,
  ScheduledMatchDay,
} from "../../types";

// Season/gameweek, market and lineup calls, plus the admin season/gameweek
// management methods — split out of the old combined fantasyApi object.
export const fantasyCoreApi = {
  getActiveSeason: async (): Promise<FantasySeason | null> => {
    const res = await api.get<{ data: FantasySeason | null }>(
      "/fantasy/season",
    );
    return res.data.data;
  },
  getGameweeks: async (seasonId: string): Promise<FantasyGameweek[]> => {
    const res = await api.get<{ data: FantasyGameweek[] }>(
      `/fantasy/season/${seasonId}/gameweeks`,
    );
    return res.data.data || [];
  },
  listPlayerMarket: async (
    seasonId: string,
    params?: {
      /** Comma-separated list of positions, e.g. "Receiver,Center". Filtered server-side. */
      position?: string;
      /** 'M' or 'F'. Omit for any gender. Filtered server-side. */
      gender?: "M" | "F";
      team_id?: string;
      search?: string;
      sort?: MarketSort;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    data: FantasyPlayerListItem[];
    total: number;
    total_pages: number;
  }> => {
    const res = await api.get<{
      data: FantasyPlayerListItem[];
      total: number;
      total_pages: number;
    }>(`/fantasy/season/${seasonId}/market`, { params });
    return res.data;
  },
  /** Clubs and positions present in the season's market, for the filter chips. */
  getMarketFilters: async (
    seasonId: string,
  ): Promise<{
    teams: {
      id: string;
      name: string;
      short_name: string;
      logo: string;
    }[];
    positions: string[];
  }> => {
    const res = await api.get<{
      data: {
        teams: {
          id: string;
          name: string;
          short_name: string;
          logo: string;
        }[];
        positions: string[];
      };
    }>(`/fantasy/season/${seasonId}/market/filters`);
    return res.data.data;
  },
  saveLineup: async (payload: {
    season_id: string;
    gameweek_id: string;
    team_name: string;
    picks: { player_id: string; slot: FantasySlot }[];
    /** Send true only for the manager's explicit "Publish Lineup" action. */
    publish?: boolean;
  }): Promise<FantasyLineupResponse> => {
    const res = await api.post<{ data: FantasyLineupResponse }>(
      "/fantasy/lineups",
      payload,
    );
    return res.data.data;
  },
  getMyLineup: async (
    seasonId: string,
    gameweekId: string,
  ): Promise<FantasyLineupResponse | null> => {
    const res = await api.get<{ data: FantasyLineupResponse | null }>(
      "/fantasy/lineups/mine",
      {
        params: { season_id: seasonId, gameweek_id: gameweekId },
      },
    );
    return res.data.data;
  },
  getTeamLineup: async (
    teamId: string,
    gameweekId: string,
  ): Promise<FantasyTeamLineupDetailResponse> => {
    const res = await api.get<{ data: FantasyTeamLineupDetailResponse }>(
      `/fantasy/teams/${teamId}/gameweeks/${gameweekId}`,
    );
    return res.data.data;
  },

  // Admin
  adminCreateSeason: async (payload: {
    competition_id: string;
    name: string;
    squad_size: number;
    budget: number;
    min_female_offense: number;
    min_female_defense: number;
    max_per_club: number;
    lock_mins_before: number;
  }): Promise<FantasySeason> => {
    const res = await api.post<{ data: FantasySeason }>(
      "/admin/fantasy/seasons",
      payload,
    );
    return res.data.data;
  },
  adminActivateSeason: async (seasonId: string): Promise<void> => {
    await api.post(`/admin/fantasy/seasons/${seasonId}/activate`);
  },
  adminCreateGameweek: async (
    seasonId: string,
    // Omit `deadline` and the server computes it from the event day's first
    // kickoff minus the season's lock_mins_before. Supply an RFC3339 string
    // to override that.
    payload: {
      number: number;
      event_day_id?: string;
      match_date?: string;
      deadline?: string;
    },
  ): Promise<FantasyGameweek> => {
    const res = await api.post<{ data: FantasyGameweek }>(
      `/admin/fantasy/seasons/${seasonId}/gameweeks`,
      payload,
    );
    return res.data.data;
  },
  adminGetScheduledMatchDays: async (
    seasonId: string,
  ): Promise<ScheduledMatchDay[]> => {
    const res = await api.get<{ data: ScheduledMatchDay[] }>(
      `/admin/fantasy/seasons/${seasonId}/match-days`,
    );
    return res.data.data;
  },
  adminAutoScheduleGameweeks: async (
    seasonId: string,
  ): Promise<FantasyGameweek[]> => {
    const res = await api.post<{ data: FantasyGameweek[] }>(
      `/admin/fantasy/seasons/${seasonId}/gameweeks/auto-schedule`,
    );
    return res.data.data;
  },
  /** Corrects a gameweek's lock deadline after creation. `deadline` is RFC3339. */
  adminUpdateGameweekDeadline: async (
    gwId: string,
    deadline: string,
  ): Promise<void> => {
    await api.post(`/admin/fantasy/gameweeks/${gwId}/deadline`, { deadline });
  },
  adminInitializePrices: async (seasonId: string): Promise<void> => {
    await api.post(`/admin/fantasy/seasons/${seasonId}/prices/initialize`);
  },
  /** Safe to re-run: re-finalizing recomputes scores rather than double-counting. */
  adminFinalizeGameweek: async (gwId: string): Promise<void> => {
    await api.post(`/admin/fantasy/gameweeks/${gwId}/finalize`);
  },
  adminDeleteGameweek: async (gwId: string): Promise<void> => {
    await api.delete(`/admin/fantasy/gameweeks/${gwId}`);
  },
};
