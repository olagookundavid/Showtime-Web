import api from './client';
import type { GenericApiResponse, AdminAnalyticsResponse } from '../types';

export const getAdminAnalytics = async (): Promise<
  GenericApiResponse<AdminAnalyticsResponse>
> => {
  const response =
    await api.get<GenericApiResponse<AdminAnalyticsResponse>>(
      "/admin/analytics",
    );
  return response.data;
};
