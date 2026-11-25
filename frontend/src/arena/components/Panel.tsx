import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon } from '@heroicons/react/24/outline';

interface PanelProps {
  title: ReactNode;
  /** A link on the right of the heading, e.g. "All matches". */
  link?: { to: string; label: string };
  children: ReactNode;
  className?: string;
  /** Removes the body padding, for a table that runs to the panel's edges. */
  flush?: boolean;
}

/** A titled card. Every section of every page uses it so they all read the same. */
export const Panel = ({ title, link, children, className = '', flush = false }: PanelProps) => (
  <section className={`min-w-0 border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5 ${className}`}>
    <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
      <h2 className="text-xl font-extrabold text-sffl-navy dark:text-white">{title}</h2>
      {link && (
        <Link to={link.to} className="inline-flex items-center gap-1 min-h-11 text-sm font-bold text-sffl-red hover:underline">
          {link.label}
          <ArrowUpRightIcon className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}
    </div>
    <div className={flush ? '' : 'px-4 pb-4 sm:px-5 sm:pb-5'}>{children}</div>
  </section>
);
