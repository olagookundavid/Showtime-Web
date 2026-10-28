import api from "./client";
import type {
  PaginatedResponse,
  PlayerStat,
  TeamStat,
  UpsertPlayerStatPayload,
  StatsCompare,
} from "../types";

export const getPlayerStats = async (
  compId?: string,
  eventDay?: string,
  page = 1,
  limit = 20,
  playerId?: string,
  search?: string,
  sort?: string,
  teamId?: string,
  position?: string,
): Promise<PaginatedResponse<PlayerStat>> => {
  let url = "/stats/players";
  const params = new URLSearchParams();
  if (compId) params.append("competition_id", compId);
  if (eventDay) params.append("event_day", eventDay);
  if (playerId) params.append("player_id", playerId);
  if (teamId) params.append("team_id", teamId);
  if (search) params.append("search", search);
  if (sort) params.append("sort", sort);
  if (position && position !== "ALL") params.append("position", position);
  params.append("page", page.toString());
  params.append("limit", limit.toString());
  if (params.toString()) url += `?${params.toString()}`;
  const response = await api.get(url);
  return response.data;
};

export const getPlayerStatById = async (
  id: string,
  compId?: string,
  matchDate?: string,
  matchId?: string,
): Promise<PlayerStat | null> => {
  let url = `/stats/players/${id}`;
  const params = new URLSearchParams();
  if (compId) params.append("competition_id", compId);
  if (matchDate) params.append("match_date", matchDate);
  if (matchId) params.append("match_id", matchId);
  if (params.toString()) url += `?${params.toString()}`;

  const response = await api.get(url);
  return response.data.data;
};

export const getTeamStats = async (
  compId?: string,
  eventDay?: string,
  page = 1,
  limit = 20,
  sort?: string,
  teamId?: string,
): Promise<PaginatedResponse<TeamStat>> => {
  let url = "/stats/teams";
  const params = new URLSearchParams();
  if (compId) params.append("competition_id", compId);
  if (eventDay) params.append("event_day", eventDay);
  if (teamId) params.append("team_id", teamId);
  if (sort) params.append("sort", sort);
  params.append("page", page.toString());
  params.append("limit", limit.toString());
  if (params.toString()) url += `?${params.toString()}`;
  const response = await api.get(url);
  return response.data;
};

export const upsertPlayerStat = async (payload: UpsertPlayerStatPayload) => {
  const response = await api.post("/admin/stats/players", payload);
  return response.data;
};

export const getStatDates = async (compId?: string): Promise<string[]> => {
  let url = "/stats/dates?limit=200";
  if (compId) url += `&competition_id=${compId}`;
  const response = await api.get(url);
  return response.data.data || [];
};

// Step 2 — stats derived from the play log vs the currently-stored manual stats.
export const getStatsCompare = async (
  matchId: string,
): Promise<StatsCompare> => {
  const res = await api.get<StatsCompare>(
    `/admin/matches/${matchId}/stats-compare`,
  );
  return { derived: res.data.derived || [], current: res.data.current || [] };
};

// Box score for the public match page. Same derivation as the admin compare
// endpoint above, but unauthenticated — that one sits under /admin and is gated
// to admin/referee/stats, so using it here left the stats blank for anyone not
// signed in as staff. `current` only ever comes back empty.
export const getPublicMatchStats = async (
  matchId: string,
): Promise<StatsCompare> => {
  const res = await api.get<StatsCompare>(`/matches/${matchId}/stats`);
  return { derived: res.data.derived || [], current: res.data.current || [] };
};
