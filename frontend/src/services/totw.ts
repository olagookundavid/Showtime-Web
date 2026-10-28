import api from "./client";
import type { TeamOfTheWeek, TOTWListItem, SaveTOTWPayload } from "../types";

export const getLatestTOTW = async (
  competitionId?: string,
): Promise<TeamOfTheWeek> => {
  const res = await api.get<{ data: TeamOfTheWeek }>("/totw/latest", {
    params: competitionId ? { competition_id: competitionId } : undefined,
  });
  return res.data.data;
};

export const getTOTWById = async (id: string): Promise<TeamOfTheWeek> => {
  const res = await api.get<{ data: TeamOfTheWeek }>(`/totw/${id}`);
  return res.data.data;
};

export const getTOTWArchive = async (
  competitionId?: string,
): Promise<TOTWListItem[]> => {
  const res = await api.get<{ data: TOTWListItem[] }>("/totw/archive", {
    params: competitionId ? { competition_id: competitionId } : undefined,
  });
  return res.data.data;
};

// Admin TOTW APIs
export const getAdminTOTWs = async (
  competitionId?: string,
): Promise<TOTWListItem[]> => {
  const res = await api.get<{ data: TOTWListItem[] }>("/admin/totw", {
    params: competitionId ? { competition_id: competitionId } : undefined,
  });
  return res.data.data;
};

export const getAdminTOTWById = async (id: string): Promise<TeamOfTheWeek> => {
  const res = await api.get<{ data: TeamOfTheWeek }>(`/admin/totw/${id}`);
  return res.data.data;
};

export const createAdminTOTW = async (
  payload: SaveTOTWPayload,
): Promise<TeamOfTheWeek> => {
  const res = await api.post<{ data: TeamOfTheWeek }>("/admin/totw", payload);
  return res.data.data;
};

export const updateAdminTOTW = async (
  id: string,
  payload: SaveTOTWPayload,
): Promise<TeamOfTheWeek> => {
  const res = await api.put<{ data: TeamOfTheWeek }>(
    `/admin/totw/${id}`,
    payload,
  );
  return res.data.data;
};

export const deleteAdminTOTW = async (id: string): Promise<void> => {
  await api.delete(`/admin/totw/${id}`);
};

export const publishAdminTOTW = async (
  id: string,
  is_published: boolean,
): Promise<TeamOfTheWeek> => {
  const res = await api.patch<{ data: TeamOfTheWeek }>(
    `/admin/totw/${id}/publish`,
    { is_published },
  );
  return res.data.data;
};
