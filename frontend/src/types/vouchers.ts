// Vouchers: given to a named person for a date or date range, shown at the bar by
// code or QR and used once. A voucher is either a fixed bundle of items or a price
// voucher, a set amount of money taken off the bill. Prices are integer kobo
// (₦1 = 100 kobo). Dates are Lagos calendar dates written YYYY-MM-DD.

export interface VoucherItem {
  name: string;
  qty: number;
}

/** A bundle on sale. */
export interface VoucherProduct {
  id: string;
  name: string;
  description: string;
  price_kobo: number;
  items: VoucherItem[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoucherProductInput {
  name: string;
  description: string;
  price_kobo: number;
  items: VoucherItem[];
  active: boolean;
}

/** A BUNDLE covers a list of items. A VALUE voucher is an amount of money (price_kobo). */
export type VoucherKind = "BUNDLE" | "VALUE";

export type VoucherStatus = "ISSUED" | "REDEEMED" | "VOID";

/** What a voucher can be used for today: its status combined with its dates. */
export type VoucherState =
  | "VALID"
  | "NOT_YET"
  | "EXPIRED"
  | "REDEEMED"
  | "VOID";

/** A voucher as the holder and the bar staff see it. */
export interface Voucher {
  id: string;
  code: string;
  kind: VoucherKind;
  name: string;
  /** What it can be used for, in words. */
  description: string;
  items: VoucherItem[];
  /** The bundle's price, or the amount of a price voucher. */
  price_kobo: number;
  holder_name: string;
  valid_from: string;
  valid_to: string;
  status: VoucherStatus;
  state: VoucherState;
  state_message: string;
  redeemable: boolean;
  redeemed_at?: string;
  redeemed_by_name?: string;
  created_at: string;
}

export type VoucherSource = "PURCHASED" | "ADMIN_ISSUED";

/** A voucher as staff see it, with who it was for and how it came about. */
export interface AdminVoucher extends Voucher {
  source: VoucherSource;
  holder_email?: string;
  holder_user_id?: string;
  purchased_by_user_id?: string;
}

export interface AdminVoucherList {
  data: AdminVoucher[];
  total: number;
  page: number;
  limit: number;
}

export interface PurchaseVoucherInput {
  product_id: string;
  holder_name: string;
  holder_email?: string;
  valid_from: string;
  valid_to: string;
}

/**
 * Giving a voucher away. A bundle needs product_id. A price voucher (kind "VALUE")
 * needs name and amount_kobo instead; description is optional text about what it
 * can be used for.
 */
export interface IssueVoucherInput {
  kind?: VoucherKind;
  product_id?: string;
  name?: string;
  description?: string;
  amount_kobo?: number;
  holder_name: string;
  holder_email?: string;
  holder_user_id?: string;
  valid_from: string;
  valid_to: string;
}

export interface RedeemResult {
  redeemed: boolean;
  voucher: Voucher;
}

export interface VoucherAdminFilter {
  status?: VoucherStatus;
  search?: string;
  page?: number;
  limit?: number;
}
