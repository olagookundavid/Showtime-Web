import type { ComponentType } from "react";
import {
  CheckBadgeIcon,
  CheckCircleIcon,
  ClockIcon,
  NoSymbolIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import type { VoucherState } from "../../types";

const STATES: Record<
  VoucherState,
  { label: string; icon: ComponentType<{ className?: string }>; className: string }
> = {
  VALID: {
    label: "Valid today",
    icon: CheckCircleIcon,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  NOT_YET: {
    label: "Not yet valid",
    icon: ClockIcon,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  },
  EXPIRED: {
    label: "Expired",
    icon: XCircleIcon,
    className: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  },
  REDEEMED: {
    label: "Used",
    icon: CheckBadgeIcon,
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  },
  VOID: {
    label: "Cancelled",
    icon: NoSymbolIcon,
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  },
};

/** What a voucher can be used for today, as a coloured label with an icon (colour is never the only cue). */
export const VoucherStateBadge = ({ state }: { state: VoucherState }) => {
  const { label, icon: Icon, className } = STATES[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${className}`}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      {label}
    </span>
  );
};
