import api from './client';
import type { LiveStatus, AdminLiveStatus } from '../types';

export const getLiveStatus = async (): Promise<LiveStatus> => {
  const response = await api.get<LiveStatus>("/live");
  return response.data;
};

export const liveApi = {
  getAdminStatus: async (): Promise<AdminLiveStatus> => {
    const res = await api.get<AdminLiveStatus>("/admin/live");
    return res.data;
  },
  setOverride: async (payload: {
    mode: "auto" | "on" | "off" | "video";
    video_id?: string;
    title?: string;
  }): Promise<AdminLiveStatus> => {
    const res = await api.put<AdminLiveStatus>("/admin/live", payload);
    return res.data;
  },
};
