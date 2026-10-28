import api from "../client";
import type {
  CreateNewsPayload,
  FantasyCarouselSlide,
  UpdateFantasyCarouselSlidePayload,
} from "../../types";

// Public: the visible slides, in order, for the top of the Fantasy page.
export const getFantasyCarousel = async (): Promise<FantasyCarouselSlide[]> => {
  const response = await api.get<{ data: FantasyCarouselSlide[] }>("/fantasy/carousel");
  return response.data.data || [];
};

// Admin: every slide, hidden ones included.
export const getAdminFantasyCarousel = async (): Promise<FantasyCarouselSlide[]> => {
  const response = await api.get<{ data: FantasyCarouselSlide[] }>("/admin/fantasy-carousel");
  return response.data.data || [];
};

/** Feature an existing news article, after the last slide. */
export const addFantasyCarouselSlide = async (newsId: string): Promise<FantasyCarouselSlide> => {
  const response = await api.post<FantasyCarouselSlide>("/admin/fantasy-carousel", { news_id: newsId });
  return response.data;
};

/** Publish a new article to the news site and put it straight on the carousel. */
export const quickAddFantasyArticle = async (payload: CreateNewsPayload): Promise<FantasyCarouselSlide> => {
  const response = await api.post<FantasyCarouselSlide>("/admin/fantasy-carousel/quick-add", payload);
  return response.data;
};

export const updateFantasyCarouselSlide = async (id: string, payload: UpdateFantasyCarouselSlidePayload) => {
  const response = await api.put(`/admin/fantasy-carousel/${id}`, payload);
  return response.data;
};

/** Take a slide off the carousel. The article stays on the news site. */
export const removeFantasyCarouselSlide = async (id: string) => {
  const response = await api.delete(`/admin/fantasy-carousel/${id}`);
  return response.data;
};
