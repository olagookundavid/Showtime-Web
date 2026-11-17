import type { VoucherItem } from "../../types";

/** What a voucher covers, one line per item: "2 x Drink". */
export const VoucherItemsList = ({ items }: { items: VoucherItem[] }) => (
  <ul className="space-y-1">
    {items.map((item) => (
      <li
        key={item.name}
        className="text-base font-bold text-sffl-navy dark:text-white break-words"
      >
        {item.qty} × {item.name}
      </li>
    ))}
  </ul>
);
