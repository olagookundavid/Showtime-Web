import api from './client';
import type { PaginatedResponse, News, CreateNewsPayload } from '../types';

export const getNews = async (
  page = 1,
  limit = 10,
  search?: string,
  category?: string,
  author?: string,
) => {
  let url = `/news?page=${page}&limit=${limit}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;
  if (author) url += `&author=${encodeURIComponent(author)}`;

  const response = await api.get<PaginatedResponse<News>>(url);
  return response.data;
};

export const getNewsBySlug = async (slug: string): Promise<News | null> => {
  try {
    const response = await api.get<News>(
      `/news/slug/${encodeURIComponent(slug)}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching news by slug:", error);
    return null;
  }
};

export const getNewsById = async (id: string) => {
  const response = await api.get<News>(`/news/${id}`);
  return response.data;
};

export const createNews = async (payload: CreateNewsPayload) => {
  const response = await api.post("/admin/news", payload);
  return response.data;
};

export const updateNews = async (
  id: string,
  payload: Partial<CreateNewsPayload>,
) => {
  const response = await api.put(`/admin/news/${id}`, payload);
  return response.data;
};

export const deleteNews = async (id: string) => {
  const response = await api.delete(`/admin/news/${id}`);
  return response.data;
};
