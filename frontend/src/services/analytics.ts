import api from './client';
import type { GenericApiResponse, AdminAnalyticsResponse, RepeatCustomerReport } from '../types';

export const getAdminAnalytics = async (): Promise<
  GenericApiResponse<AdminAnalyticsResponse>
> => {
  const response =
    await api.get<GenericApiResponse<AdminAnalyticsResponse>>(
      "/admin/analytics",
    );
  return response.data;
};

export const getRepeatCustomerReport = async (
  eventDayId?: string,
): Promise<GenericApiResponse<RepeatCustomerReport>> => {
  const response = await api.get<GenericApiResponse<RepeatCustomerReport>>(
    "/admin/analytics/repeat-customers",
    { params: { event_day_id: eventDayId || undefined } },
  );
  return response.data;
};
