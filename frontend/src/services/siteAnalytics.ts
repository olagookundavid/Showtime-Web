import api from './client';
import type {
  GenericApiResponse,
  SiteTrafficSummary,
  SiteEventsPage,
  SiteMatchDay,
  SiteRange,
} from '../types';

export const getSiteTrafficSummary = async (
  range: SiteRange,
): Promise<GenericApiResponse<SiteTrafficSummary>> => {
  const response = await api.get<GenericApiResponse<SiteTrafficSummary>>(
    "/admin/site-analytics/summary",
    { params: range },
  );
  return response.data;
};

/** Every match day up to today (or within a range) with its traffic, for the dashboard's calendar. */
export const getSiteMatchDays = async (): Promise<
  GenericApiResponse<SiteMatchDay[]>
> => {
  const response = await api.get<GenericApiResponse<SiteMatchDay[]>>(
    "/admin/site-analytics/match-days",
  );
  return response.data;
};

export const getSiteEvents = async (
  params: SiteRange & {
    page: number;
    limit: number;
    type?: string;
    include_bots?: boolean;
  },
): Promise<GenericApiResponse<SiteEventsPage>> => {
  const response = await api.get<GenericApiResponse<SiteEventsPage>>(
    "/admin/site-analytics/events",
    { params },
  );
  return response.data;
};

/** Downloads a CSV through the authenticated client, then hands it to the browser as a file. */
export const downloadSiteTrafficExport = async (
  kind: "summary" | "events",
  range: SiteRange,
): Promise<void> => {
  const response = await api.get<Blob>("/admin/site-analytics/export", {
    params: { ...range, kind },
    responseType: "blob",
  });
  const disposition: string = response.headers["content-disposition"] ?? "";
  const filename =
    /filename="([^"]+)"/.exec(disposition)?.[1] ?? `showtime-traffic-${kind}.csv`;

  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
