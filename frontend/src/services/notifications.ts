import api from "./client";
import type { PaginatedResponse, NotificationData } from "../types";

export const notificationsApi = {
  getAll: async (params?: {
    unread_only?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<NotificationData>> => {
    const res = await api.get<PaginatedResponse<NotificationData>>(
      "/notifications",
      { params },
    );
    return res.data;
  },
  getUnreadCount: async (): Promise<number> => {
    const res = await api.get<{ unread_count: number }>(
      "/notifications/unread-count",
    );
    return res.data.unread_count || 0;
  },
  markAsRead: async (id: string): Promise<void> => {
    await api.put(`/notifications/${id}/read`);
  },
  markAllAsRead: async (): Promise<void> => {
    await api.put("/notifications/read-all");
  },
};
