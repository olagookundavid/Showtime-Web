// The spend wallet: a balance topped up with Paystack and spent inside Showtime.
// Every amount is integer kobo (₦1 = 100 kobo). The Fantasy prize wallet is a
// different thing and lives in ./fantasy/wallet.

export type LedgerType =
  | "TOPUP"
  | "VOUCHER_PURCHASE"
  | "PURCHASE"
  | "REFUND"
  | "ADJUSTMENT"
  | "FANTASY_TRANSFER";

export interface LedgerEntry {
  id: string;
  user_id: string;
  /** Signed: credits are positive, debits negative. */
  amount_kobo: number;
  balance_after_kobo: number;
  type: LedgerType;
  reference?: string;
  voucher_id?: string;
  description: string;
  created_by_user_id?: string;
  created_at: string;
}

export interface SpendWallet {
  balance_kobo: number;
  min_topup_kobo: number;
  max_topup_kobo: number;
  max_balance_kobo: number;
  transactions: LedgerEntry[];
}

export interface TopupInit {
  reference: string;
  authorization_url: string;
}

export type TopupStatus = "PENDING" | "PAID" | "FAILED";

export interface TopupResult {
  reference: string;
  amount_kobo: number;
  status: TopupStatus;
  balance_kobo: number;
}

export interface WalletUser {
  id: string;
  name: string;
  email: string;
}

/** A user's wallet as staff see it. */
export interface AdminSpendWallet extends SpendWallet {
  user: WalletUser;
}
