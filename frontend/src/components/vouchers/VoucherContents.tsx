import type { Voucher } from "../../types";
import { formatKobo } from "../../services";
import { VoucherItemsList } from "./VoucherItemsList";

/**
 * What a voucher is worth: the items a bundle covers, or the amount and the
 * description of a price voucher.
 */
export const VoucherContents = ({
  voucher,
}: {
  voucher: Pick<Voucher, "kind" | "items" | "price_kobo" | "description">;
}) =>
  voucher.kind === "VALUE" ? (
    <div className="space-y-1">
      <p className="text-3xl font-black text-sffl-navy dark:text-white">
        {formatKobo(voucher.price_kobo)}
      </p>
      {voucher.description && (
        <p className="text-sm text-gray-600 dark:text-gray-300 break-words">
          {voucher.description}
        </p>
      )}
    </div>
  ) : (
    <VoucherItemsList items={voucher.items} />
  );
