import { useMemo } from "react";
import { DataTable, type Column } from "../ui";
import { formatKobo } from "../../services";
import type { LedgerEntry, LedgerType } from "../../types";

const TYPE_LABEL: Record<LedgerType, string> = {
  TOPUP: "Top-up",
  VOUCHER_PURCHASE: "Voucher purchase",
  PURCHASE: "Purchase",
  REFUND: "Refund",
  ADJUSTMENT: "Adjustment by Showtime",
  FANTASY_TRANSFER: "From Fantasy winnings",
};

const NO_ENTRIES: LedgerEntry[] = [];

const whenLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/** Credits show with a plus sign, debits with a minus. */
const signedKobo = (kobo: number) =>
  `${kobo > 0 ? "+" : "-"}${formatKobo(Math.abs(kobo))}`;

interface LedgerTableProps {
  entries?: LedgerEntry[];
  loading?: boolean;
}

/** A wallet's history, newest first: what happened, when, how much, and the balance after. */
export const LedgerTable = ({ entries, loading }: LedgerTableProps) => {
  const columns = useMemo<Column<LedgerEntry>[]>(
    () => [
      {
        header: "What",
        sortable: true,
        sortValue: (e) => TYPE_LABEL[e.type],
        cell: (e) => (
          <div className="min-w-0">
            <p className="font-bold text-sffl-navy dark:text-white">
              {TYPE_LABEL[e.type]}
            </p>
            {e.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 wrap-break-word">
                {e.description}
              </p>
            )}
          </div>
        ),
      },
      {
        header: "When",
        sortable: true,
        sortValue: (e) => e.created_at,
        cell: (e) => whenLabel(e.created_at),
      },
      {
        header: "Amount",
        align: "right",
        sortable: true,
        sortValue: (e) => e.amount_kobo,
        cell: (e) => (
          <span
            className={`font-bold ${
              e.amount_kobo > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {signedKobo(e.amount_kobo)}
          </span>
        ),
      },
      {
        header: "Balance after",
        align: "right",
        cell: (e) => formatKobo(e.balance_after_kobo),
      },
    ],
    [],
  );

  return (
    <DataTable
      data={entries ?? NO_ENTRIES}
      columns={columns}
      loading={loading}
      searchable={false}
      getRowId={(e) => e.id}
      emptyMessage="Nothing in your wallet yet. Add money and every top-up and payment will show here."
    />
  );
};
