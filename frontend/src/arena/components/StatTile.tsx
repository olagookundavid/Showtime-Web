import type { ComponentType, ReactNode } from 'react';

interface StatTileProps {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}

/** One headline number with a label and a line of context. */
export const StatTile = ({ label, value, note, icon: Icon }: StatTileProps) => (
  <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      {Icon && <Icon className="w-5 h-5 shrink-0 text-sffl-red dark:text-arena-lime" aria-hidden="true" />}
    </div>
    <p className="tabular mt-2 text-3xl font-black text-sffl-navy dark:text-white truncate">{value}</p>
    {note && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{note}</p>}
  </div>
);
