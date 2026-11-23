import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Another product's logo and name, for a dashboard that isn't Showtime's. */
export interface DashboardBrandConfig {
  logoSrc: string;
  /** The product name, rendered in the heading font next to the logo. */
  name: ReactNode;
}

interface DashboardBrandProps {
  /** Where the logo links to: the portal's home page. */
  to: string;
  /** The line under the logo text, e.g. "Admin Panel". */
  label: string;
  /** Collapsed sidebar rail: logo only, text kept for screen readers. */
  collapsed?: boolean;
  /** Phone top bar: a smaller logo, and the text only from 360px up so the bar fits a 320px screen. */
  compact?: boolean;
  onClick?: () => void;
  /** Shows this product's logo and name instead of Showtime's. */
  brand?: DashboardBrandConfig;
}

export const DashboardBrand = ({
  to,
  label,
  collapsed = false,
  compact = false,
  onClick,
  brand,
}: DashboardBrandProps) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center min-w-0 min-h-11 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sffl-red/60 ${
      compact ? "gap-2" : "gap-3"
    } ${collapsed ? "justify-center" : ""}`}
  >
    <img
      src={brand?.logoSrc ?? "/images/branding/showtime-logo.webp"}
      alt=""
      className={`shrink-0 object-contain ${compact ? "w-9 h-9" : "w-10 h-10"}`}
    />
    <span
      className={
        collapsed
          ? "sr-only"
          : compact
            ? "sr-only min-[360px]:not-sr-only min-w-0 leading-none"
            : "min-w-0 leading-none"
      }
    >
      <span
        className={`block font-black italic tracking-tight text-sffl-navy dark:text-white transition-colors ${
          compact ? "text-lg" : "text-xl"
        }`}
      >
        {brand?.name ?? (
          <>
            SHOW<span className="text-sffl-red">TIME</span>
          </>
        )}
      </span>
      <span className="block mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 whitespace-nowrap truncate">
        {label}
      </span>
    </span>
  </Link>
);
