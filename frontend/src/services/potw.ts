import axios from "axios";
import api from "./client";
import type {
  POTWPoll,
  POTWPollSummary,
  POTWWinner,
  SavePOTWPollPayload,
  TeamOfTheWeek,
  CreateNewsPayload,
} from "../types";

/** The newest open or closed vote; null when there has never been one. */
export const getCurrentPOTWPoll = async (): Promise<POTWPoll | null> => {
  try {
    const res = await api.get<{ data: POTWPoll }>("/potw/current");
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
};

export const getPOTWPoll = async (pollId: string): Promise<POTWPoll> => {
  const res = await api.get<{ data: POTWPoll }>(`/potw/${pollId}`);
  return res.data.data;
};

export const getPOTWPolls = async (): Promise<POTWPollSummary[]> => {
  const res = await api.get<{ data: POTWPollSummary[] }>("/potw");
  return res.data.data || [];
};

/** Every Player of the Week, newest first: fan-vote winners and league office picks. */
export const getPOTWWinners = async (): Promise<POTWWinner[]> => {
  const res = await api.get<{ data: POTWWinner[] }>("/potw/winners");
  return res.data.data ?? [];
};

export const voteForPOTW = async (
  pollId: string,
  playerId: string,
): Promise<POTWPoll> => {
  const res = await api.post<{ data: POTWPoll }>(`/potw/${pollId}/vote`, {
    player_id: playerId,
  });
  return res.data.data;
};

/** The edition's vote with live counts; null when the edition has no vote yet. */
export const getAdminPOTWPoll = async (
  totwId: string,
): Promise<POTWPoll | null> => {
  try {
    const res = await api.get<{ data: POTWPoll }>(`/admin/totw/${totwId}/potw`);
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
};

export const saveAdminPOTWPoll = async (
  totwId: string,
  payload: SavePOTWPollPayload,
): Promise<POTWPoll> => {
  const res = await api.put<{ data: POTWPoll }>(
    `/admin/totw/${totwId}/potw`,
    payload,
  );
  return res.data.data;
};

export const deleteAdminPOTWPoll = async (totwId: string): Promise<void> => {
  await api.delete(`/admin/totw/${totwId}/potw`);
};

export const overrideAdminPOTW = async (
  totwId: string,
  playerId: string,
): Promise<POTWPoll> => {
  const res = await api.post<{ data: POTWPoll }>(
    `/admin/totw/${totwId}/potw/override`,
    { player_id: playerId },
  );
  return res.data.data;
};

export const clearAdminPOTWOverride = async (
  totwId: string,
): Promise<POTWPoll> => {
  const res = await api.delete<{ data: POTWPoll }>(
    `/admin/totw/${totwId}/potw/override`,
  );
  return res.data.data;
};

export const getAdminPlayerDayStats = async (
  playerId: string,
  eventDayId: string,
): Promise<Record<string, string>> => {
  const res = await api.get<{ data: Record<string, string> }>(
    "/admin/totw/player-stats",
    {
      params: { player_id: playerId, event_day_id: eventDayId },
    },
  );
  return res.data.data;
};

export const saveTOTWArticle = async (
  totwId: string,
  payload: CreateNewsPayload,
): Promise<TeamOfTheWeek> => {
  const res = await api.put<{ data: TeamOfTheWeek }>(
    `/admin/totw/${totwId}/article`,
    payload,
  );
  return res.data.data;
};
