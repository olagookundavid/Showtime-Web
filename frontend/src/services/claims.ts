import api from "./client";
import type {
  ClaimCodeData,
  ClaimKind,
  MyClaimStatusData,
  PaginatedResponse,
  PlayerClaimData,
  SubmitClaimData,
  SubmitClaimPayload,
  VerifyClaimCodeData,
} from "../types";

// Every player in the database came from the historical import with no email, phone
// or photo, so none of them can be authenticated by contact details. A claimant
// identifies themselves to their team manager, who is the only party able to confirm
// who they are; approval is what mints the account.

export const claimApi = {
  // Public — the claim page
  verifyCode: async (code: string): Promise<VerifyClaimCodeData> => {
    const res = await api.post<VerifyClaimCodeData>("/claim/verify-code", {
      code,
    });
    return res.data;
  },
  submit: async (payload: SubmitClaimPayload): Promise<SubmitClaimData> => {
    const res = await api.post<SubmitClaimData>("/claim/submit", payload);
    return res.data;
  },
  verifyEmail: async (token: string): Promise<void> => {
    await api.post("/claim/verify-email", { token });
  },

  // The claimant's own pending claim
  getMyStatus: async (): Promise<MyClaimStatusData> => {
    const res = await api.get<MyClaimStatusData>("/claim/my-status");
    return res.data;
  },
  setMyPhoto: async (photo: string): Promise<void> => {
    await api.patch("/claim/my-photo", { photo });
  },
  resendVerification: async (): Promise<void> => {
    await api.post("/claim/resend-verification");
  },
};

// Team manager review + code management
export const teamHeadClaimsApi = {
  list: async (params?: {
    status?: string;
    search?: string;
    kind?: ClaimKind;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PlayerClaimData>> => {
    const res = await api.get<PaginatedResponse<PlayerClaimData>>(
      "/team-head/claims",
      { params },
    );
    return res.data;
  },
  // What is genuinely the manager's to act on — excludes new-player requests they
  // have already endorsed, which now sit with the league office.
  pendingCount: async (): Promise<number> => {
    const res = await api.get<{ pending: number }>(
      "/team-head/claims/pending-count",
    );
    return res.data.pending || 0;
  },
  endorse: async (
    id: string,
    endorse: boolean,
    note?: string,
  ): Promise<void> => {
    await api.post(`/team-head/claims/${id}/endorse`, {
      endorse,
      note: note || "",
    });
  },
  approve: async (
    id: string,
    data?: { name?: string; jersey_number?: number; position?: string },
  ): Promise<void> => {
    await api.post(`/team-head/claims/${id}/approve`, data || {});
  },
  reject: async (id: string, reason: string): Promise<void> => {
    await api.post(`/team-head/claims/${id}/reject`, { reason });
  },
  getCode: async (): Promise<ClaimCodeData | null> => {
    const res = await api.get<ClaimCodeData | { code: null }>(
      "/team-head/claim-codes",
    );
    const data = res.data as ClaimCodeData;
    return data && data.code ? data : null;
  },
  generateCode: async (data?: {
    expires_in_days?: number;
    max_uses?: number;
  }): Promise<ClaimCodeData> => {
    const res = await api.post<ClaimCodeData>(
      "/team-head/claim-codes",
      data || {},
    );
    return res.data;
  },
  revokeCode: async (id: string): Promise<void> => {
    await api.delete(`/team-head/claim-codes/${id}`);
  },
};

export const adminClaimsApi = {
  list: async (params?: {
    status?: string;
    search?: string;
    team_id?: string;
    kind?: ClaimKind;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PlayerClaimData>> => {
    const res = await api.get<PaginatedResponse<PlayerClaimData>>(
      "/admin/claims",
      { params },
    );
    return res.data;
  },
  approve: async (
    id: string,
    data?: { name?: string; jersey_number?: number; position?: string },
  ): Promise<void> => {
    await api.post(`/admin/claims/${id}/approve`, data || {});
  },
  reject: async (id: string, reason: string): Promise<void> => {
    await api.post(`/admin/claims/${id}/reject`, { reason });
  },
  revoke: async (id: string): Promise<void> => {
    await api.post(`/admin/claims/${id}/revoke`);
  },
  listCodes: async (): Promise<ClaimCodeData[]> => {
    const res = await api.get<{ data: ClaimCodeData[] }>("/admin/claim-codes");
    return res.data.data || [];
  },
  generateCode: async (
    team_id: string,
    data?: { expires_in_days?: number; max_uses?: number },
  ): Promise<ClaimCodeData> => {
    const res = await api.post<ClaimCodeData>("/admin/claim-codes", {
      team_id,
      ...(data || {}),
    });
    return res.data;
  },
  revokeCode: async (id: string): Promise<void> => {
    await api.delete(`/admin/claim-codes/${id}`);
  },
};
