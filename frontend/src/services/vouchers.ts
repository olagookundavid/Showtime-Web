import { isAxiosError } from "axios";
import { withIdempotencyKey } from "./idempotency";
import api from "./client";
import type {
  AdminVoucher,
  AdminVoucherList,
  IssueVoucherInput,
  PurchaseVoucherInput,
  RedeemResult,
  Voucher,
  VoucherAdminFilter,
  VoucherProduct,
  VoucherProductInput,
  WalletUser,
} from "../types";

// Shop and holder

export const listVoucherProducts = async (): Promise<VoucherProduct[]> => {
  const res = await api.get<{ data: VoucherProduct[] }>("/vouchers/products");
  return res.data.data;
};

export const purchaseVoucher = async (
  input: PurchaseVoucherInput,
  idempotencyKey?: string,
): Promise<Voucher> => {
  const res = await api.post<{ data: Voucher }>(
    "/vouchers/purchase",
    input,
    withIdempotencyKey(idempotencyKey),
  );
  return res.data.data;
};

export const listMyVouchers = async (): Promise<Voucher[]> => {
  const res = await api.get<{ data: Voucher[] }>("/vouchers/mine");
  return res.data.data;
};

/** Anyone holding the code can open it; no sign-in is needed. */
export const getVoucherByCode = async (code: string): Promise<Voucher> => {
  const res = await api.get<{ data: Voucher }>(
    `/vouchers/by-code/${encodeURIComponent(code)}`,
  );
  return res.data.data;
};

/** True when a purchase failed because the wallet holds less than the price. */
export const isInsufficientBalance = (err: unknown): boolean =>
  isAxiosError(err) && err.response?.data?.code === "INSUFFICIENT_BALANCE";

// Bar

export const barLookupVoucher = async (code: string): Promise<Voucher> => {
  const res = await api.get<{ data: Voucher }>(
    `/bar/vouchers/${encodeURIComponent(code)}`,
  );
  return res.data.data;
};

/**
 * Redeems a voucher. A voucher that cannot be used answers 409, which is a normal
 * outcome here, so it comes back as `{ redeemed: false, voucher }` with the reason in
 * `voucher.state_message` instead of throwing.
 */
export const barRedeemVoucher = async (code: string): Promise<RedeemResult> => {
  try {
    const res = await api.post<{ data: RedeemResult }>(
      `/bar/vouchers/${encodeURIComponent(code)}/redeem`,
    );
    return res.data.data;
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 409 && err.response.data?.data) {
      return err.response.data.data as RedeemResult;
    }
    throw err;
  }
};

// Admin

export const adminListVoucherProducts = async (): Promise<VoucherProduct[]> => {
  const res = await api.get<{ data: VoucherProduct[] }>("/admin/vouchers/products");
  return res.data.data;
};

export const adminCreateVoucherProduct = async (
  input: VoucherProductInput,
): Promise<VoucherProduct> => {
  const res = await api.post<{ data: VoucherProduct }>("/admin/vouchers/products", input);
  return res.data.data;
};

export const adminUpdateVoucherProduct = async (
  id: string,
  input: VoucherProductInput,
): Promise<VoucherProduct> => {
  const res = await api.put<{ data: VoucherProduct }>(
    `/admin/vouchers/products/${id}`,
    input,
  );
  return res.data.data;
};

export const adminListVouchers = async (
  filter: VoucherAdminFilter,
): Promise<AdminVoucherList> => {
  const res = await api.get<AdminVoucherList>("/admin/vouchers", { params: filter });
  return res.data;
};

export const adminIssueVoucher = async (
  input: IssueVoucherInput,
  idempotencyKey?: string,
): Promise<AdminVoucher> => {
  const res = await api.post<{ data: AdminVoucher }>(
    "/admin/vouchers",
    input,
    withIdempotencyKey(idempotencyKey),
  );
  return res.data.data;
};

export const adminVoidVoucher = async (
  id: string,
  refund: boolean,
): Promise<AdminVoucher> => {
  const res = await api.post<{ data: AdminVoucher }>(`/admin/vouchers/${id}/void`, {
    refund,
  });
  return res.data.data;
};

export const adminListRedemptions = async (): Promise<AdminVoucher[]> => {
  const res = await api.get<{ data: AdminVoucher[] }>("/admin/vouchers/redemptions");
  return res.data.data;
};

export const adminSearchVoucherUsers = async (
  search: string,
): Promise<WalletUser[]> => {
  const res = await api.get<{ data: WalletUser[] }>("/admin/vouchers/users", {
    params: { search },
  });
  return res.data.data;
};
