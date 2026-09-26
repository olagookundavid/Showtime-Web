/**
 * The "what is affected" box for a ConfirmDialog `body`: label / value rows
 * naming the record. Empty values show a dash.
 */
export const ConfirmSummary = ({ rows }: { rows: [label: string, value: string | undefined][] }) => (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
        {rows.map(([label, value]) => (
            <div key={label} className="contents">
                <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                <dd className="min-w-0 wrap-break-word font-bold text-gray-900 dark:text-white">{value || '—'}</dd>
            </div>
        ))}
    </dl>
);
