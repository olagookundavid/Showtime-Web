import api from './client';
import type {
  HeroSlide,
  CreateHeroSlidePayload,
  UpdateHeroSlidePayload,
} from '../types';

// Legacy: slides created before `destination_url` existed link to a hidden
// news article (authored inline, from this admin — not the News admin)
// instead. It's "hidden" in the sense that it's excluded from /news and the
// News admin list; see backend news.is_hero_only. Kept read-only so those
// old slides keep rendering/linking correctly.
// Public: only active slides — what MainHeroCarousel renders.
export const getHeroSlides = async (): Promise<HeroSlide[]> => {
  const response = await api.get<{ data: HeroSlide[] }>("/hero-slides");
  return response.data.data || [];
};

// Admin: list ALL (active + inactive).
export const getAdminHeroSlides = async (): Promise<HeroSlide[]> => {
  const response = await api.get<{ data: HeroSlide[] }>("/admin/hero-slides");
  return response.data.data || [];
};

export const createHeroSlide = async (
  payload: CreateHeroSlidePayload,
): Promise<HeroSlide> => {
  const response = await api.post<HeroSlide>("/admin/hero-slides", payload);
  return response.data;
};

export const updateHeroSlide = async (
  id: string,
  payload: UpdateHeroSlidePayload,
) => {
  const response = await api.put(`/admin/hero-slides/${id}`, payload);
  return response.data;
};

export const deleteHeroSlide = async (id: string) => {
  const response = await api.delete(`/admin/hero-slides/${id}`);
  return response.data;
};
