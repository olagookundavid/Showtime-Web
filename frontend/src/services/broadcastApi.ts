import api from './api';
import type { BroadcastDayMatch, BroadcastMatchDay, PaginatedResponse } from '../types';

// Event-day broadcast channels (admin, broadcast_studio feature).

export const getBroadcastDays = async (page = 1, limit = 10): Promise<PaginatedResponse<BroadcastMatchDay>> => {
  const res = await api.get(`/admin/broadcast/days?page=${page}&limit=${limit}`);
  return res.data;
};

export const getBroadcastDay = async (
  date: string,
): Promise<{ day: BroadcastMatchDay; matches: BroadcastDayMatch[] }> => {
  const res = await api.get(`/admin/broadcast/days/${date}`);
  return res.data;
};

/** Switches which match the day's overlay shows; null takes the day off air. */
export const setBroadcastDayOnAir = async (date: string, matchId: string | null) => {
  const res = await api.put(`/admin/broadcast/days/${date}/on-air`, { match_id: matchId ?? '' });
  return res.data as { date: string; on_air_match_id: string };
};
