import api from "./client";
import { withIdempotencyKey } from "./idempotency";
import type {
  AdminSpendWallet,
  LedgerEntry,
  SpendWallet,
  TopupInit,
  TopupResult,
  WalletUser,
} from "../types";

export const getWallet = async (): Promise<SpendWallet> => {
  const res = await api.get<{ data: SpendWallet }>("/wallet");
  return res.data.data;
};

/** Starts a top-up. Send the browser to `authorization_url` to pay. */
export const startWalletTopup = async (
  amountKobo: number,
  idempotencyKey?: string,
): Promise<TopupInit> => {
  const res = await api.post<{ data: TopupInit }>(
    "/wallet/topups",
    { amount_kobo: amountKobo },
    withIdempotencyKey(idempotencyKey),
  );
  return res.data.data;
};

/** Asks the server to check a top-up with Paystack and credit it if it was paid. Safe to repeat. */
export const verifyWalletTopup = async (
  reference: string,
): Promise<TopupResult> => {
  const res = await api.post<{ data: TopupResult }>("/wallet/topups/verify", {
    reference,
  });
  return res.data.data;
};

export const adminSearchWalletUsers = async (
  search: string,
): Promise<WalletUser[]> => {
  const res = await api.get<{ data: WalletUser[] }>("/admin/wallets/users", {
    params: { search },
  });
  return res.data.data;
};

export const adminGetUserWallet = async (
  userId: string,
): Promise<AdminSpendWallet> => {
  const res = await api.get<{ data: AdminSpendWallet }>(
    `/admin/wallets/users/${userId}`,
  );
  return res.data.data;
};

/** A positive amount credits the wallet, a negative one debits it. A reason is required. */
export const adminAdjustWallet = async (
  userId: string,
  amountKobo: number,
  reason: string,
  idempotencyKey?: string,
): Promise<LedgerEntry> => {
  const res = await api.post<{ data: LedgerEntry }>(
    `/admin/wallets/users/${userId}/adjust`,
    { amount_kobo: amountKobo, reason },
    withIdempotencyKey(idempotencyKey),
  );
  return res.data.data;
};
