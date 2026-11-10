import api from './client';
import type {
  SeasonGraphic,
  SeasonMVP,
  UpsertSeasonGraphicPayload,
  CreateSeasonMVPPayload,
  UpdateSeasonMVPPayload,
} from '../types';

// Public
export const getSeasonGraphics = async (): Promise<SeasonGraphic[]> => {
  const res = await api.get<{ data: SeasonGraphic[] }>("/season/graphics", {
    params: { limit: 200 },
  });
  return res.data.data || [];
};

export const getSeasonMVPs = async (): Promise<SeasonMVP[]> => {
  const res = await api.get<{ data: SeasonMVP[] }>("/season/mvps", {
    params: { limit: 200 },
  });
  return res.data.data || [];
};

// Admin
export const getAdminSeasonGraphics = async (): Promise<SeasonGraphic[]> => {
  const res = await api.get<{ data: SeasonGraphic[] }>(
    "/admin/season/graphics",
    { params: { limit: 200 } },
  );
  return res.data.data || [];
};

export const upsertSeasonGraphic = async (
  payload: UpsertSeasonGraphicPayload,
): Promise<SeasonGraphic> => {
  const res = await api.put<SeasonGraphic>("/admin/season/graphics", payload);
  return res.data;
};

export const getAdminSeasonMVPs = async (): Promise<SeasonMVP[]> => {
  const res = await api.get<{ data: SeasonMVP[] }>("/admin/season/mvps", {
    params: { limit: 200 },
  });
  return res.data.data || [];
};

export const createSeasonMVP = async (
  payload: CreateSeasonMVPPayload,
): Promise<SeasonMVP> => {
  const res = await api.post<SeasonMVP>("/admin/season/mvps", payload);
  return res.data;
};

export const updateSeasonMVP = async (
  id: string,
  payload: UpdateSeasonMVPPayload,
) => {
  const res = await api.put(`/admin/season/mvps/${id}`, payload);
  return res.data;
};

export const deleteSeasonMVP = async (id: string) => {
  const res = await api.delete(`/admin/season/mvps/${id}`);
  return res.data;
};
