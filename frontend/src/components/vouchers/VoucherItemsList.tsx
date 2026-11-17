import type { VoucherItem } from "../../types";

/** What a voucher covers, one line per item: "2 x Drink". */
export const VoucherItemsList = ({ items }: { items: VoucherItem[] }) => (
  <ul className="space-y-1">
    {items.map((item, i) => (
      <li
        // Two lines may share a name, so the position keeps keys unique.
        key={`${i}-${item.name}`}
        className="text-base font-bold text-sffl-navy dark:text-white break-words"
      >
        {item.qty} × {item.name}
      </li>
    ))}
  </ul>
);
