import api from './client';
import type { RelivePlaylist, AdminReliveStatus } from '../types';

// The playlist itself is chosen in the admin panel (reliveApi below).
export const getRelivePlaylist = async (): Promise<RelivePlaylist> => {
  const response = await api.get<{ data: RelivePlaylist }>("/relive");
  return response.data.data;
};

export const reliveApi = {
  getAdminStatus: async (): Promise<AdminReliveStatus> => {
    const res = await api.get<AdminReliveStatus>("/admin/relive");
    return res.data;
  },
  setPlaylist: async (playlistId: string): Promise<AdminReliveStatus> => {
    const res = await api.put<AdminReliveStatus>("/admin/relive", {
      playlist_id: playlistId,
    });
    return res.data;
  },
};
