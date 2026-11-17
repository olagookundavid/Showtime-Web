import type { VoucherItem } from "../../types";

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
