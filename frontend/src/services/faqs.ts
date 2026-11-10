import api from './client';
import type {
  FaqPage,
  FaqPageSummary,
  FaqCategory,
  FaqItem,
  CreateFaqPagePayload,
  UpdateFaqPagePayload,
  FaqCategoryPayload,
  FaqItemPayload,
  FaqReorderKind,
} from '../types';

// Public: one page's active FAQs, e.g. "game-pass". Use `useFaqPage`.
export const getFaqPage = async (pageKey: string): Promise<FaqPage> => {
  const response = await api.get<{ data: FaqPage }>(`/faqs/${pageKey}`);
  return response.data.data;
};

// Admin: every page that shows FAQs.
export const getAdminFaqPages = async (): Promise<FaqPageSummary[]> => {
  const response = await api.get<{ data: FaqPageSummary[] }>("/admin/faqs/pages");
  return response.data.data || [];
};

// Admin: one page with hidden FAQs included.
export const getAdminFaqPage = async (pageKey: string): Promise<FaqPage> => {
  const response = await api.get<{ data: FaqPage }>(`/admin/faqs/pages/${pageKey}`);
  return response.data.data;
};

export const createFaqPage = async (payload: CreateFaqPagePayload): Promise<FaqPageSummary> => {
  const response = await api.post<FaqPageSummary>("/admin/faqs/pages", payload);
  return response.data;
};

export const updateFaqPage = async (pageKey: string, payload: UpdateFaqPagePayload) => {
  const response = await api.put(`/admin/faqs/pages/${pageKey}`, payload);
  return response.data;
};

export const deleteFaqPage = async (pageKey: string) => {
  const response = await api.delete(`/admin/faqs/pages/${pageKey}`);
  return response.data;
};

export const createFaqCategory = async (pageKey: string, payload: FaqCategoryPayload): Promise<FaqCategory> => {
  const response = await api.post<FaqCategory>(`/admin/faqs/pages/${pageKey}/categories`, payload);
  return response.data;
};

export const updateFaqCategory = async (id: string, payload: FaqCategoryPayload) => {
  const response = await api.put(`/admin/faqs/categories/${id}`, payload);
  return response.data;
};

export const deleteFaqCategory = async (id: string) => {
  const response = await api.delete(`/admin/faqs/categories/${id}`);
  return response.data;
};

export const createFaqItem = async (pageKey: string, payload: FaqItemPayload): Promise<FaqItem> => {
  const response = await api.post<FaqItem>(`/admin/faqs/pages/${pageKey}/items`, payload);
  return response.data;
};

export const updateFaqItem = async (id: string, payload: FaqItemPayload) => {
  const response = await api.put(`/admin/faqs/items/${id}`, payload);
  return response.data;
};

export const deleteFaqItem = async (id: string) => {
  const response = await api.delete(`/admin/faqs/items/${id}`);
  return response.data;
};

// Sets display order to each id's position. Send one category's (or one
// ungrouped page's) items, or one page's categories.
export const reorderFaqs = async (kind: FaqReorderKind, ids: string[]) => {
  const response = await api.put("/admin/faqs/reorder", { kind, ids });
  return response.data;
};
