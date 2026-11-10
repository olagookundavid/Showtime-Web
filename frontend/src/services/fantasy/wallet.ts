import api from "../client";
import type { FantasyWallet, Paged, PayoutRequest } from "../../types";

// Every amount below is integer kobo (₦1 = 100 kobo), matching the Paystack
// amounts used on the way in. Divide by 100 to display naira.
export const koboToNaira = (kobo: number) => kobo / 100;

export const formatKobo = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fantasyWalletApi = {
  getWallet: async (): Promise<FantasyWallet> => {
    const res = await api.get<{ data: FantasyWallet }>("/fantasy/wallet");
    return res.data.data;
  },
  // Throws 409 when the balance is too low; the message is in error.response.data.error.
  requestPayout: async (payload: {
    amount_kobo: number;
    bank_name: string;
    account_number: string;
    account_name: string;
    user_notes?: string;
  }): Promise<PayoutRequest> => {
    const res = await api.post<{ data: PayoutRequest }>(
      "/fantasy/payouts",
      payload,
    );
    return res.data.data;
  },
  listMyPayouts: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<Paged<PayoutRequest>> => {
    const res = await api.get<Paged<PayoutRequest>>("/fantasy/payouts", {
      params,
    });
    return { ...res.data, data: res.data.data ?? [] };
  },
  cancelPayout: async (id: string): Promise<PayoutRequest> => {
    const res = await api.post<{ data: PayoutRequest }>(
      `/fantasy/payouts/${id}/cancel`,
    );
    return res.data.data;
  },
};
