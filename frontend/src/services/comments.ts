import api from "./client";
import { COMMENTS_PAGE_SIZE } from "../constants";
import type { CommentData, CommentPage } from "../types";

export const commentsApi = {
  getComments: async (
    entityType: string,
    entityId: string,
    page = 1,
    limit = COMMENTS_PAGE_SIZE,
  ): Promise<CommentPage> => {
    const res = await api.get<CommentPage>("/comments", {
      params: { entity_type: entityType, entity_id: entityId, page, limit },
    });
    return {
      ...res.data,
      data: res.data.data || [],
    };
  },
  createComment: async (data: {
    entity_type: string;
    entity_id: string;
    content: string;
    parent_id?: string;
  }): Promise<CommentData> => {
    const res = await api.post<{ data: CommentData }>("/comments", data);
    return res.data.data;
  },
  deleteComment: async (id: string): Promise<void> => {
    await api.delete(`/comments/${id}`);
  },
  likeComment: async (
    id: string,
  ): Promise<{ liked: boolean; likes_count: number }> => {
    const res = await api.post<{ liked: boolean; likes_count: number }>(
      `/comments/${id}/like`,
    );
    return res.data;
  },
  updateNewsCommentSettings: async (
    newsId: string,
    commentsEnabled: boolean,
  ): Promise<void> => {
    await api.put(`/admin/news/${newsId}/comment-settings`, {
      comments_enabled: commentsEnabled,
    });
  },
};
