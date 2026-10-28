import api from "./client";
import type {
  Badge,
  BadgeIcon,
  SaveBadgeIconPayload,
  UpdateBadgeIconResult,
  PlayerBadgeAward,
  PlayerBadge,
  CreateBadgePayload,
  UpdateBadgePayload,
  AwardBadgePayload,
} from "../types";

export const getBadges = async (): Promise<Badge[]> => {
  const res = await api.get<{ data: Badge[] }>("/badges");
  return res.data.data;
};

export const getPlayerBadges = async (
  playerId: string,
): Promise<PlayerBadge[]> => {
  const res = await api.get<{ data: PlayerBadge[] }>(
    `/badges/players/${playerId}`,
  );
  return res.data.data;
};

// Admin Badge APIs
export const getAdminBadges = async (): Promise<Badge[]> => {
  const res = await api.get<{ data: Badge[] }>("/admin/badges");
  return res.data.data;
};

export const createAdminBadge = async (
  payload: CreateBadgePayload,
): Promise<Badge> => {
  const res = await api.post<{ data: Badge }>("/admin/badges", payload);
  return res.data.data;
};

export const updateAdminBadge = async (
  id: string,
  payload: UpdateBadgePayload,
): Promise<Badge> => {
  const res = await api.put<{ data: Badge }>(`/admin/badges/${id}`, payload);
  return res.data.data;
};

export const deleteAdminBadge = async (id: string): Promise<void> => {
  await api.delete(`/admin/badges/${id}`);
};

// ── Badge artwork library ────────────────────────────────────────────────
export const getBadgeIcons = async (): Promise<BadgeIcon[]> => {
  const res = await api.get<{ data: BadgeIcon[] }>("/admin/badges/icons");
  return res.data.data ?? [];
};

export const createBadgeIcon = async (payload: SaveBadgeIconPayload): Promise<BadgeIcon> => {
  const res = await api.post<{ data: BadgeIcon }>("/admin/badges/icons", payload);
  return res.data.data;
};

/** Rename artwork or replace its image; badges showing the old image move to the new one. */
export const updateBadgeIcon = async (
  id: string,
  payload: SaveBadgeIconPayload,
): Promise<UpdateBadgeIconResult> => {
  const res = await api.put<{ data: UpdateBadgeIconResult }>(`/admin/badges/icons/${id}`, payload);
  return res.data.data;
};

export const deleteBadgeIcon = async (id: string): Promise<void> => {
  await api.delete(`/admin/badges/icons/${id}`);
};

export const awardAdminBadge = async (
  payload: AwardBadgePayload,
): Promise<PlayerBadge> => {
  const res = await api.post<{ data: PlayerBadge }>(
    "/admin/badges/award",
    payload,
  );
  return res.data.data;
};

export const deleteAdminBadgeAward = async (id: string): Promise<void> => {
  await api.delete(`/admin/badges/awards/${id}`);
};

export const backfillMVPBadges = async (): Promise<{
  message: string;
  updated_players: number;
}> => {
  const res = await api.post<{ message: string; updated_players: number }>(
    "/admin/badges/backfill-mvps",
  );
  return res.data;
};

export const getAdminBadgeAwards = async (params?: {
  badge_id?: string;
  player_id?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: PlayerBadgeAward[]; total: number }> => {
  const res = await api.get<{ data: PlayerBadgeAward[]; total: number }>(
    "/admin/badges/awards",
    { params },
  );
  return res.data;
};
