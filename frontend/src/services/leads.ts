import api from "./client";
import type {
  JoinPayload,
  LeadListParams,
  LeadResponse,
  LeadSummary,
} from "../types";

/** The public join form. Needs no account. */
export const joinInterestList = async (payload: JoinPayload): Promise<void> => {
  await api.post("/leads", payload);
};

export const adminListLeads = async (
  params: LeadListParams,
): Promise<{ data: LeadResponse[]; total: number; total_pages: number }> => {
  const response = await api.get<{
    data: LeadResponse[];
    total: number;
    total_pages: number;
  }>("/admin/leads", {
    params: {
      page: params.page,
      limit: params.limit,
      search: params.search || undefined,
      source: params.source || undefined,
      interest: params.interest || undefined,
      bought: params.bought || undefined,
    },
  });
  return response.data;
};

export const getLeadSummary = async (): Promise<LeadSummary> => {
  const response = await api.get<{ data: LeadSummary }>("/admin/leads/summary");
  return response.data.data;
};

/** Downloads the leads matching the filters as a CSV file. */
export const downloadLeadsExport = async (
  params: Omit<LeadListParams, "page" | "limit">,
): Promise<void> => {
  const response = await api.get<Blob>("/admin/leads/export", {
    params: {
      search: params.search || undefined,
      source: params.source || undefined,
      interest: params.interest || undefined,
      bought: params.bought || undefined,
    },
    responseType: "blob",
  });
  const disposition: string = response.headers["content-disposition"] ?? "";
  const filename =
    /filename="([^"]+)"/.exec(disposition)?.[1] ?? "showtime-leads.csv";

  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
