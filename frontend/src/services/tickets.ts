import api from './client';
import type {
  EventDayResponse,
  TicketProductResponse,
  CreateTicketProductPayload,
  UpdateTicketProductPayload,
  GamePassRule,
  PriceQuote,
  PriceQuoteRequest,
  TicketResponse,
  PurchaseTicketPayload,
  GiftTicketPayload,
  PaginatedResponse,
  Paged,
  SeasonPassResponse,
  CreateSeasonPassPayload,
  UpdateSeasonPassPayload,
  PurchaseSeasonPassPayload,
  TeamTicketAllocation,
  CreateReferralPayload,
  ReferralResponse,
  ReferralStatsResponse,
} from '../types';

// Match day (event day) endpoints
export const getEventDays = async (): Promise<EventDayResponse[]> => {
  const response = await api.get<{ data: EventDayResponse[] }>("/event-days");
  return response.data.data || [];
};

export const getEventDayByDate = async (
  date: string,
): Promise<EventDayResponse> => {
  const response = await api.get<EventDayResponse>(
    `/event-days/by-date/${date}`,
  );
  return response.data;
};

export const getEventDayById = async (
  id: string,
): Promise<EventDayResponse> => {
  const response = await api.get<EventDayResponse>(`/event-days/${id}`);
  return response.data;
};

// Ticket products: what is on sale, and the Game Pass discount ladder
export const getTicketProducts = async (
  accessCode?: string,
): Promise<TicketProductResponse[]> => {
  const response = await api.get<{ data: TicketProductResponse[] }>(
    "/ticket-products",
    { params: { code: accessCode || undefined } },
  );
  return response.data.data || [];
};

export const getGamePassRules = async (): Promise<GamePassRule[]> => {
  const response = await api.get<{ data: GamePassRule[] }>(
    "/ticket-products/game-pass-rules",
  );
  return response.data.data || [];
};

/** Prices a selection with the same code the purchase uses. */
export const quoteTicketPrice = async (
  payload: PriceQuoteRequest,
): Promise<PriceQuote> => {
  const response = await api.post<PriceQuote>(
    "/ticket-products/quote",
    payload,
  );
  return response.data;
};

// Ticket endpoints
export const purchaseTicket = async (
  payload: PurchaseTicketPayload,
): Promise<TicketResponse> => {
  const response = await api.post<TicketResponse>("/tickets/purchase", payload);
  return response.data;
};

// App Admin: issue a complimentary ticket (no payment, sends confirmation email)
export const giftTicket = async (
  payload: GiftTicketPayload,
): Promise<TicketResponse> => {
  const response = await api.post<TicketResponse>(
    "/admin/administrator/gift-ticket",
    payload,
  );
  return response.data;
};

export const getTicketByReference = async (
  reference: string,
): Promise<TicketResponse> => {
  const response = await api.get<TicketResponse>(`/tickets/${reference}`);
  return response.data;
};

export const adminListTickets = async (
  page = 1,
  limit = 10,
  eventDayId?: string,
  status?: string,
) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (eventDayId) params.append("event_day_id", eventDayId);
  if (status) params.append("status", status);
  const response = await api.get<PaginatedResponse<TicketResponse>>(
    `/admin/tickets?${params}`,
  );
  return response.data;
};

/** Checks a ticket in for one match day. Left out, the day is today's. */
export const checkinTicket = async (
  id: string,
  checkedInBy: string,
  eventDayId?: string,
) => {
  const response = await api.post(`/admin/tickets/${id}/checkin`, {
    checked_in_by: checkedInBy,
    event_day_id: eventDayId,
  });
  return response.data;
};

export const verifyTicket = async (
  reference: string,
): Promise<TicketResponse> => {
  const response = await api.post<TicketResponse>(
    `/tickets/verify/${reference}`,
  );
  return response.data;
};

export const adminCheckinTicket = async (
  id: string,
  checkedInBy: string,
  eventDayId?: string,
) => {
  const response = await api.post(`/admin/tickets/${id}/admin-checkin`, {
    checked_in_by: checkedInBy,
    event_day_id: eventDayId,
  });
  return response.data;
};

export const lookupTicketByCode = async (
  code: string,
): Promise<TicketResponse> => {
  const response = await api.get<TicketResponse>(
    `/admin/tickets/lookup/${code}`,
  );
  return response.data;
};

export const searchTicketsByEmail = async (
  email: string,
): Promise<TicketResponse[]> => {
  const response = await api.get<{ data: TicketResponse[] }>(
    `/admin/tickets/search?email=${encodeURIComponent(email)}&limit=200`,
  );
  return response.data.data || [];
};

// Admin Event Day endpoints
export const getAllEventDays = async (): Promise<EventDayResponse[]> => {
  const response = await api.get<{ data: EventDayResponse[] }>(
    "/admin/event-days/all",
    {
      params: { limit: 200 },
    },
  );
  return response.data.data || [];
};

/** Paged and server-searched, for the admin screen that manages event days.
 *  `getAllEventDays` stays for the pickers that want the recent ones. */
export const listEventDays = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<Paged<EventDayResponse>> => {
  const response = await api.get<Paged<EventDayResponse>>(
    "/admin/event-days/all",
    {
      params: { ...params, search: params?.search || undefined },
    },
  );
  return { ...response.data, data: response.data.data ?? [] };
};

export const createEventDay = async (payload: {
  title: string;
  date: string;
  venue?: string;
  is_active?: boolean;
}): Promise<EventDayResponse> => {
  const response = await api.post<EventDayResponse>(
    "/admin/event-days",
    payload,
  );
  return response.data;
};

export const updateEventDay = async (
  id: string,
  payload: {
    title?: string;
    date?: string;
    venue?: string;
    is_active?: boolean;
  },
) => {
  const response = await api.put(`/admin/event-days/${id}`, payload);
  return response.data;
};

export const deleteEventDay = async (id: string) => {
  const response = await api.delete(`/admin/event-days/${id}`);
  return response.data;
};

// Admin ticket products
export const adminListTicketProducts = async (): Promise<
  TicketProductResponse[]
> => {
  const response = await api.get<{ data: TicketProductResponse[] }>(
    "/admin/ticket-products",
  );
  return response.data.data || [];
};

export const adminCreateTicketProduct = async (
  payload: CreateTicketProductPayload,
): Promise<TicketProductResponse> => {
  const response = await api.post<TicketProductResponse>(
    "/admin/ticket-products",
    payload,
  );
  return response.data;
};

export const adminUpdateTicketProduct = async (
  id: string,
  payload: UpdateTicketProductPayload,
): Promise<TicketProductResponse> => {
  const response = await api.put<TicketProductResponse>(
    `/admin/ticket-products/${id}`,
    payload,
  );
  return response.data;
};

export const adminDeleteTicketProduct = async (id: string) => {
  const response = await api.delete(`/admin/ticket-products/${id}`);
  return response.data;
};

export const adminSaveGamePassRules = async (
  rules: GamePassRule[],
): Promise<GamePassRule[]> => {
  const response = await api.put<{ data: GamePassRule[] }>(
    "/admin/game-pass/rules",
    { rules },
  );
  return response.data.data || [];
};

// Season passes (public): a standalone pass with an admin-set price and end date
export const getSeasonPasses = async (): Promise<SeasonPassResponse[]> => {
  const response = await api.get<{ data: SeasonPassResponse[] }>(
    "/season-passes",
  );
  return response.data.data || [];
};

export const getSeasonPassById = async (
  id: string,
): Promise<SeasonPassResponse> => {
  const response = await api.get<SeasonPassResponse>(`/season-passes/${id}`);
  return response.data;
};

export const purchaseSeasonPass = async (
  payload: PurchaseSeasonPassPayload,
): Promise<TicketResponse> => {
  const response = await api.post<TicketResponse>(
    "/tickets/season-pass",
    payload,
  );
  return response.data;
};

// Admin season passes
export const adminListSeasonPasses = async (): Promise<
  SeasonPassResponse[]
> => {
  const response = await api.get<{ data: SeasonPassResponse[] }>(
    "/admin/season-passes",
  );
  return response.data.data || [];
};

export const adminCreateSeasonPass = async (
  payload: CreateSeasonPassPayload,
): Promise<SeasonPassResponse> => {
  const response = await api.post<SeasonPassResponse>(
    "/admin/season-passes",
    payload,
  );
  return response.data;
};

export const adminUpdateSeasonPass = async (
  id: string,
  payload: UpdateSeasonPassPayload,
): Promise<SeasonPassResponse> => {
  const response = await api.put<SeasonPassResponse>(
    `/admin/season-passes/${id}`,
    payload,
  );
  return response.data;
};

export const adminDeleteSeasonPass = async (id: string) => {
  const response = await api.delete(`/admin/season-passes/${id}`);
  return response.data;
};

export const adminGetAllocations = async (
  eventDayId: string,
): Promise<TeamTicketAllocation[]> => {
  const response = await api.get<{ data: TeamTicketAllocation[] }>(
    `/admin/allocations/event-day/${eventDayId}`,
  );
  return response.data.data || [];
};

export const adminCreateOrUpdateAllocation = async (payload: {
  event_day_id: string;
  team_id: string;
  allocated_count: number;
}) => {
  const response = await api.post("/admin/allocations", payload);
  return response.data;
};

export const adminDeleteAllocation = async (id: string) => {
  const response = await api.delete(`/admin/allocations/${id}`);
  return response.data;
};

export const createReferralCode = async (
  payload: CreateReferralPayload,
): Promise<ReferralResponse> => {
  const response = await api.post<ReferralResponse>(
    "/tickets/referrals",
    payload,
  );
  return response.data;
};

export const lookupReferrals = async (
  name: string,
): Promise<ReferralResponse[]> => {
  const response = await api.get<ReferralResponse[]>(
    `/tickets/referrals/lookup?name=${encodeURIComponent(name)}`,
  );
  return response.data;
};

export const adminListReferrals = async (
  page = 1,
  limit = 10,
  search?: string,
) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) params.append("search", search);
  const response = await api.get<PaginatedResponse<ReferralStatsResponse>>(
    `/admin/tickets/referrals?${params}`,
  );
  return response.data;
};
