import type { Voucher, VoucherItem } from "../../types";
import { formatKobo } from "../../services";

/** A YYYY-MM-DD date as "Sat 21 Nov 2026". Read as UTC so the day never shifts with the viewer's time zone. */
export const formatVoucherDate = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));

/** One date, or "Sat 21 Nov 2026 to Mon 23 Nov 2026" for a range. */
export const formatVoucherRange = (from: string, to: string): string =>
  from === to
    ? formatVoucherDate(from)
    : `${formatVoucherDate(from)} to ${formatVoucherDate(to)}`;

/** Today's date in Lagos as YYYY-MM-DD, for date inputs and "earliest start". */
export const todayInLagos = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());

/** "1 x Burger, 2 x Drink" on one line, for tables. */
export const summariseItems = (items: VoucherItem[]): string =>
  items.map((i) => `${i.qty} × ${i.name}`).join(", ");

/** What a voucher is for on one line, for tables: its items, or "₦10,000 off the bill". */
export const summariseVoucher = (v: Pick<Voucher, "kind" | "items" | "price_kobo">): string =>
  v.kind === "VALUE" ? `${formatKobo(v.price_kobo)} to spend` : summariseItems(v.items);

/** Naira typed by a person ("10,000" or "2500.50") as kobo, or null if it is not a positive amount. */
export const nairaTextToKobo = (text: string): number | null => {
  const clean = text.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const kobo = Math.round(parseFloat(clean) * 100);
  return kobo > 0 ? kobo : null;
};

/** A timestamp as "21 Nov 2026, 14:05" in Lagos time. */
export const formatVoucherDateTime = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
