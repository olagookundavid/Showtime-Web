import type { ComponentType, ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  /** Why it's empty and what to do about it. */
  description?: ReactNode;
  /** A button or link that fixes it. */
  action?: ReactNode;
}

/** What to show where there is nothing yet: say what's missing and how to fix it. */
export const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center text-center gap-2 px-4 py-10">
    {Icon && <Icon className="w-9 h-9 text-gray-400" aria-hidden="true" />}
    <p className="text-base font-bold text-sffl-navy dark:text-white">{title}</p>
    {description && <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
