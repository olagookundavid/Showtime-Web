import { Button } from "../ui";

type SummaryRow = { label: string; value: string };

type Props = {
  title: string;
  rows: SummaryRow[];
  discount?: { label: string; amount: number } | null;
  standardTotal?: number;
  total: number;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCtaClick: () => void;
  smallPrint?: string[];
};

/** Sticky order-summary card, modeled on the cart summary in pages/store/Cart.tsx. */
export const OrderSummarySidebar = ({
  title,
  rows,
  discount,
  standardTotal,
  total,
  ctaLabel,
  ctaDisabled,
  onCtaClick,
  smallPrint = [],
}: Props) => (
  <div className="space-y-4 border border-gray-100 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-800/40 sm:p-6 lg:sticky lg:top-[calc(var(--chrome-h,8rem)+1rem)]">
    <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-red">{title}</h2>

    <div className="space-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-3 text-gray-500 dark:text-gray-400">
          <span>{row.label}</span>
          <span className="font-bold text-sffl-navy dark:text-white">{row.value}</span>
        </div>
      ))}

      {discount && discount.amount > 0 && standardTotal !== undefined && (
        <>
          <div className="flex justify-between gap-3 border-t pt-2 text-gray-500 dark:border-gray-700/40 dark:text-gray-400">
            <span>Standard total</span>
            <span className="font-bold text-sffl-navy dark:text-white">
              ₦{standardTotal.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between gap-3 text-gray-500 dark:text-gray-400">
            <span>{discount.label}</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              −₦{discount.amount.toLocaleString()}
            </span>
          </div>
        </>
      )}

      <div className="flex justify-between gap-3 border-t pt-3 text-base font-black text-sffl-navy dark:border-gray-700/40 dark:text-white">
        <span>Total</span>
        <span className="text-lg text-sffl-red">₦{total.toLocaleString()}</span>
      </div>
    </div>

    <Button fullWidth shape="square" size="lg" disabled={ctaDisabled} onClick={onCtaClick}>
      {ctaLabel}
    </Button>

    {smallPrint.length > 0 && (
      <div className="space-y-1">
        {smallPrint.map((line) => (
          <p key={line} className="text-[11px] text-gray-500 dark:text-gray-400">
            {line}
          </p>
        ))}
      </div>
    )}
  </div>
);
