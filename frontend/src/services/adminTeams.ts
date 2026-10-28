import api from './client';
import type { PaginatedResponse, Team, TeamManager, ManagerCandidate } from "../types";

// Every team, inactive ones included (the public list hides them).
export const getAdminTeams = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<PaginatedResponse<Team>> => {
  const response = await api.get<PaginatedResponse<Team>>("/admin/teams", {
    params,
  });
  return response.data;
};

export const getTeamsByCompetition = async (
  competitionId: string,
  status?: string,
) => {
  const response = await api.get("/admin/teams/by-competition", {
    params: { competition_id: competitionId, status },
  });
  if (response.data && response.data.data !== undefined) {
    return {
      data: Array.isArray(response.data.data) ? response.data.data : [],
    };
  }
  return { data: Array.isArray(response.data) ? response.data : [] };
};

export const addTeamToCompetition = async (
  competitionId: string,
  teamId: string,
) => {
  const response = await api.post(
    `/admin/competitions/${competitionId}/teams`,
    { team_id: teamId },
  );
  return response.data;
};

export const removeTeamFromCompetition = async (
  competitionId: string,
  teamId: string,
) => {
  const response = await api.delete(
    `/admin/competitions/${competitionId}/teams/${teamId}`,
  );
  return response.data;
};

export const createTeam = async (payload: {
  name: string;
  short_name: string;
  logo: string;
  status?: string;
}) => {
  const response = await api.post("/admin/teams", payload);
  return response.data;
};

export const updateTeam = async (
  id: string,
  payload: { name: string; short_name: string; logo: string; status?: string },
) => {
  const response = await api.put(`/admin/teams/${id}`, payload);
  return response.data;
};

export const deleteTeam = async (id: string) => {
  const response = await api.delete(`/admin/teams/${id}`);
  return response.data;
};

export const getTeamManagers = async (
  teamId: string,
): Promise<TeamManager[]> => {
  const response = await api.get<{ data: TeamManager[] | null }>(
    `/admin/teams/${teamId}/managers`,
  );
  return response.data.data || [];
};

// Every team_head user, with whichever team they currently manage (if any) —
// powers the "Assign Team Head" dropdown so it can show ALL team_head users
// (not just unassigned ones) and explain why a name is greyed out.
export const getManagerCandidates = async (): Promise<ManagerCandidate[]> => {
  const response = await api.get<{ data: ManagerCandidate[] }>(
    "/admin/teams/manager-candidates",
  );
  return response.data.data || [];
};

export const assignTeamManager = async (teamId: string, userId: string) => {
  const response = await api.post(`/admin/teams/${teamId}/manager`, {
    user_id: userId,
  });
  return response.data;
};

export const removeTeamManager = async (teamId: string, userId: string) => {
  const response = await api.delete(`/admin/teams/${teamId}/manager/${userId}`);
  return response.data;
};
