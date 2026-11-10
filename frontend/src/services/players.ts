import api from './client';
import type { RosterSummary, PaginatedResponse, Player, CreatePlayerPayload } from "../types";

export const getTeamRosterSummary = async (
  teamId?: string,
): Promise<RosterSummary> => {
  const url = teamId
    ? `/team-head/roster-summary?team_id=${teamId}`
    : `/team-head/roster-summary`;
  const response = await api.get<RosterSummary>(url);
  return response.data;
};

export const moveToReserve = async (
  playerId: string,
  teamId?: string,
): Promise<{ message: string }> => {
  const url = teamId
    ? `/admin/teams/${teamId}/players/${playerId}/move-to-reserve`
    : `/team-head/players/${playerId}/move-to-reserve`;
  const response = await api.post<{ message: string }>(url);
  return response.data;
};

export const graduatePlayer = async (
  playerId: string,
  teamId?: string,
): Promise<{ message: string }> => {
  const url = teamId
    ? `/admin/teams/${teamId}/players/${playerId}/graduate`
    : `/team-head/players/${playerId}/graduate`;
  const response = await api.post<{ message: string }>(url);
  return response.data;
};

export const getPlayers = async (
  teamId?: string,
  page: number = 1,
  limit: number = 20,
  search?: string,
  rosterStatus?: "main" | "reserve" | "all",
): Promise<PaginatedResponse<Player>> => {
  let url = `/players?page=${page}&limit=${limit}`;
  if (teamId) {
    url += `&team_id=${teamId}`;
  }
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  if (rosterStatus) {
    url += `&roster_status=${rosterStatus}`;
  }
  const response = await api.get<PaginatedResponse<Player>>(url);
  return response.data;
};

export const getPlayerById = async (id: string): Promise<Player> => {
  const response = await api.get<{ data: Player }>(`/players/${id}`);
  return response.data.data;
};

export const createPlayer = async (payload: CreatePlayerPayload) => {
  const response = await api.post("/admin/players", payload);
  return response.data;
};

export const updatePlayer = async (
  id: string,
  payload: Partial<CreatePlayerPayload>,
) => {
  const response = await api.put(`/admin/players/${id}`, payload);
  return response.data;
};

export const deletePlayer = async (id: string) => {
  const response = await api.delete(`/admin/players/${id}`);
  return response.data;
};

// Reverses deletePlayer. Deleting sets status to inactive rather than removing
// the row, so nothing has to be recreated.
export const restorePlayer = async (id: string) => {
  const response = await api.post(`/admin/players/${id}/restore`);
  return response.data;
};

export const assignRandomJerseyNumbers = async (teamId?: string) => {
  const response = await api.post(
    "/admin/players/assign-jersey-numbers",
    null,
    {
      params: teamId ? { team_id: teamId } : undefined,
    },
  );
  return response.data as { message: string; assigned_count: number };
};
