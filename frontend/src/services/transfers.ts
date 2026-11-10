import api from "./client";
import type {
  PaginatedResponse,
  TeamBudgetData,
  TransferBidData,
  TransferData,
  TransferWindowData,
} from "../types";

export const transfersApi = {
  createRequest: async (data: {
    player_id: string;
    to_team_id: string;
    notes?: string;
  }): Promise<TransferData> => {
    const res = await api.post<{ data: TransferData }>(
      "/transfers/request",
      data,
    );
    return res.data.data;
  },
  createListing: async (data: {
    player_id: string;
    asking_price: number;
  }): Promise<TransferData> => {
    const res = await api.post<{ data: TransferData }>(
      "/transfers/listing",
      data,
    );
    return res.data.data;
  },
  createDirectSale: async (data: {
    player_id: string;
    to_team_id: string;
    price: number;
  }): Promise<TransferData> => {
    const res = await api.post<{ data: TransferData }>(
      "/transfers/direct-sale",
      data,
    );
    return res.data.data;
  },
  getMarket: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<TransferData>> => {
    const res = await api.get<PaginatedResponse<TransferData>>(
      "/transfers/market",
      { params },
    );
    return res.data;
  },
  getTeamTransfers: async (params?: {
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<TransferData>> => {
    const res = await api.get<PaginatedResponse<TransferData>>(
      "/transfers/team",
      { params },
    );
    return res.data;
  },
  getById: async (id: string): Promise<TransferData> => {
    const res = await api.get<{ data: TransferData }>(`/transfers/${id}`);
    return res.data.data;
  },
  respond: async (
    id: string,
    data: { action: "accept" | "reject" | "review"; notes?: string },
  ): Promise<TransferData> => {
    const res = await api.put<{ data: TransferData }>(
      `/transfers/${id}/respond`,
      data,
    );
    return res.data.data;
  },
  placeBid: async (
    id: string,
    data: { bid_value: number },
  ): Promise<TransferBidData> => {
    const res = await api.post<{ data: TransferBidData }>(
      `/transfers/${id}/bid`,
      data,
    );
    return res.data.data;
  },
  respondToBid: async (
    transferId: string,
    bidId: string,
    action: "accept" | "reject",
  ): Promise<void> => {
    await api.put(`/transfers/${transferId}/bids/${bidId}/respond`, { action });
  },
  getBudget: async (): Promise<TeamBudgetData> => {
    const res = await api.get<{ data: TeamBudgetData }>("/transfers/budget");
    return res.data.data;
  },
  getWindowStatus: async (): Promise<{
    data: TransferWindowData | null;
    is_open: boolean;
  }> => {
    const res = await api.get<{
      data: TransferWindowData | null;
      is_open: boolean;
    }>("/transfers/window");
    return res.data;
  },
  getPlayerTransfers: async (
    playerID: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<TransferData>> => {
    const res = await api.get<PaginatedResponse<TransferData>>(
      `/transfers/player/${playerID}`,
      { params },
    );
    return res.data;
  },
};

// The signed-in player's own transfer history, split out of the old playerPortalApi.
// Distinct from transfersApi.getPlayerTransfers, which looks up any player by id.
export const getMyTransfers = async (params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<TransferData>> => {
  const res = await api.get<PaginatedResponse<TransferData>>(
    "/player-portal/transfers",
    { params },
  );
  return res.data;
};

// Admin Transfer API — overrideContract/forceAcceptContract moved to contracts.ts's
// adminContractsApi; everything else here is unchanged.
export const adminTransfersApi = {
  overrideTransfer: async (
    id: string,
    status: string,
    notes?: string,
  ): Promise<void> => {
    await api.put(`/admin/transfers/${id}/override`, { status, notes });
  },
  getWindows: async (): Promise<TransferWindowData[]> => {
    const res = await api.get<{ data: TransferWindowData[] }>(
      "/admin/transfer-windows",
    );
    return res.data.data || [];
  },
  createWindow: async (data: {
    name: string;
    opens_at: string;
    closes_at: string;
    is_active?: boolean;
  }): Promise<TransferWindowData> => {
    const res = await api.post<{ data: TransferWindowData }>(
      "/admin/transfer-windows",
      data,
    );
    return res.data.data;
  },
  updateWindow: async (
    id: string,
    data: {
      name?: string;
      opens_at?: string;
      closes_at?: string;
      is_active?: boolean;
    },
  ): Promise<TransferWindowData> => {
    const res = await api.put<{ data: TransferWindowData }>(
      `/admin/transfer-windows/${id}`,
      data,
    );
    return res.data.data;
  },
  deleteWindow: async (id: string): Promise<void> => {
    await api.delete(`/admin/transfer-windows/${id}`);
  },
  getAllBudgets: async (): Promise<TeamBudgetData[]> => {
    const res = await api.get<{ data: TeamBudgetData[] }>(
      "/admin/team-budgets",
    );
    return res.data.data || [];
  },
  adjustBudget: async (teamId: string, total_budget: number): Promise<void> => {
    await api.put(`/admin/team-budgets/${teamId}`, { total_budget });
  },
  seedBudgets: async (): Promise<void> => {
    await api.post("/admin/team-budgets/seed");
  },
};
