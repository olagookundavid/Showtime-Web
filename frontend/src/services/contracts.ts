import api from "./client";
import type {
  ContractData,
  IssueContractPayload,
  PaginatedResponse,
  Player,
} from "../types";

export const contractsApi = {
  issue: async (data: IssueContractPayload): Promise<ContractData> => {
    const res = await api.post<{ data: ContractData }>("/contracts", data);
    return res.data.data;
  },
  getTeamContracts: async (params?: {
    team_id?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<ContractData>> => {
    const res = await api.get<PaginatedResponse<ContractData>>(
      "/contracts/team",
      { params },
    );
    return res.data;
  },
  getFreeAgents: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Player>> => {
    const res = await api.get<PaginatedResponse<Player>>(
      "/contracts/free-agents",
      { params },
    );
    return res.data;
  },
  getById: async (id: string): Promise<ContractData> => {
    const res = await api.get<{ data: ContractData }>(`/contracts/${id}`);
    return res.data.data;
  },
  renew: async (
    id: string,
    data: { contract_length?: number; player_value?: number },
  ): Promise<ContractData> => {
    const res = await api.post<{ data: ContractData }>(
      `/contracts/${id}/renew`,
      data,
    );
    return res.data.data;
  },
  release: async (id: string): Promise<void> => {
    await api.delete(`/contracts/${id}/release`);
  },
  cancelOffer: async (id: string): Promise<void> => {
    await api.post(`/contracts/${id}/cancel`);
  },
};

// Admin overrides, split out of the old combined admin transfer/contract object.
export const adminContractsApi = {
  overrideContract: async (
    id: string,
    status: string,
    reason?: string,
  ): Promise<void> => {
    await api.put(`/admin/contracts/${id}/override`, { status, reason });
  },
  forceAcceptContract: async (id: string): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>(
      `/admin/contracts/${id}/force-accept`,
    );
    return res.data;
  },
};

// The signed-in player's own contracts, split out of the old playerPortalApi.
export const playerContractsApi = {
  getContracts: async (): Promise<ContractData[]> => {
    const res = await api.get<{ data: ContractData[] }>(
      "/player-portal/contracts",
    );
    return res.data.data || [];
  },
  getContractById: async (id: string): Promise<ContractData> => {
    const res = await api.get<{ data: ContractData }>(
      `/player-portal/contracts/${id}`,
    );
    return res.data.data;
  },
  respondToContract: async (
    id: string,
    action: "accept" | "reject",
    notes?: string,
  ): Promise<void> => {
    await api.put(`/player-portal/contracts/${id}/respond`, { action, notes });
  },
};
