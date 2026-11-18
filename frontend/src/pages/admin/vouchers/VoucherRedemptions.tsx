import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DataTable,
  formatVoucherDateTime,
  formatVoucherRange,
  summariseItems,
  type Column,
} from "../../../components";
import { adminListRedemptions } from "../../../services";
import type { AdminVoucher } from "../../../types";

const NO_VOUCHERS: AdminVoucher[] = [];

/** What was redeemed at the bar, newest first, and which staff member did it. */
export const VoucherRedemptions = () => {
  const redemptions = useQuery({ queryKey: ["adminVoucherRedemptions"], queryFn: adminListRedemptions });

  const columns = useMemo<Column<AdminVoucher>[]>(
    () => [
      {
        header: "Voucher",
        sortable: true,
        sortValue: (v) => v.name,
        cell: (v) => (
          <div className="min-w-0">
            <p className="font-bold text-sffl-navy dark:text-white break-words">{v.name}</p>
            <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{v.code}</p>
          </div>
        ),
      },
      { header: "For", sortable: true, sortValue: (v) => v.holder_name, cell: (v) => v.holder_name },
      { header: "Covers", cell: (v) => summariseItems(v.items) },
      { header: "Valid", cell: (v) => formatVoucherRange(v.valid_from, v.valid_to) },
      {
        header: "Redeemed",
        sortable: true,
        sortValue: (v) => v.redeemed_at ?? "",
        cell: (v) => (v.redeemed_at ? formatVoucherDateTime(v.redeemed_at) : "—"),
      },
      { header: "By", sortable: true, sortValue: (v) => v.redeemed_by_name ?? "", cell: (v) => v.redeemed_by_name || "—" },
    ],
    [],
  );

  return (
    <DataTable
      data={redemptions.data ?? NO_VOUCHERS}
      columns={columns}
      loading={redemptions.isLoading}
      getRowId={(v) => v.id}
      searchPlaceholder="Search redemptions"
      emptyMessage="Nothing has been redeemed yet. Vouchers show here once the bar scans them."
    />
  );
};
