import type { ReactNode } from 'react';

type Props = {
    title: string;
    description: string;
    children: ReactNode;
    /** The Save button, placed under the fields. */
    footer?: ReactNode;
};

/** A titled card on the App Settings page: what the setting is, then its controls. */
export const SettingsSection = ({ title, description, children, footer }: Props) => (
    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-5">
        <div className="min-w-0">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">{title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-2xl">{description}</p>
        </div>
        <div className="space-y-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center gap-3 pt-1">{footer}</div>}
    </section>
);
