import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

interface DashboardPageHeaderProps {
  /** The sidebar label for the page, e.g. "Matches". Detail pages pass their own. */
  title: ReactNode;
  /** One sentence saying what the page is for. */
  subtitle?: ReactNode;
  /** Primary buttons for the page. They sit on the right from 640px up. */
  actions?: ReactNode;
  /** Detail pages: a link back to the list they came from. */
  back?: { to: string; label: string };
  className?: string;
}

/**
 * The header every dashboard page (admin, team head, player portal, seller) starts with. The look
 * lives here and only here, so a change to it changes every page. Change the
 * type size, weight or colour in this file, never on a page.
 */
export const DashboardPageHeader = ({
  title,
  subtitle,
  actions,
  back,
  className = "",
}: DashboardPageHeaderProps) => (
  <header
    className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
  >
    <div className="min-w-0">
      {back && (
        <Link
          to={back.to}
          className="inline-flex items-center gap-1.5 min-h-11 text-xs font-bold text-sffl-red hover:underline"
        >
          <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <h1 className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white wrap-break-word">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-3xl">
          {subtitle}
        </p>
      )}
    </div>
    {actions && (
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end sm:shrink-0">
        {actions}
      </div>
    )}
  </header>
);
