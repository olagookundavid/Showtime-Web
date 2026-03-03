import React, { useState, useMemo } from 'react';

export interface Column<T> {
    header: string;
    accessor?: keyof T | string;
    cell?: (item: T) => React.ReactNode;
    sortable?: boolean;
    sortValue?: (item: T) => string | number | null | undefined; // For sorting if accessor isn't enough
    className?: string; // td className
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    searchable?: boolean;
    searchPlaceholder?: string;
    itemsPerPage?: number;
    emptyMessage?: string;
    headerActions?: React.ReactNode; // Extra filters or buttons
}

export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    searchable = true,
    searchPlaceholder = "Search...",
    itemsPerPage = 10,
    emptyMessage = "No records found.",
    headerActions
}: DataTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (col: Column<T>, keyIndex: string) => {
        if (!col.sortable) return;
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === keyIndex && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key: keyIndex, direction });
    };

    const processData = useMemo(() => {
        let processed = [...data];

        // 1. Search (basic stringification of row values)
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            processed = processed.filter(row => {
                return Object.values(row).some(val =>
                    String(val).toLowerCase().includes(lowerSearch)
                );
            });
        }

        // 2. Sort
        if (sortConfig) {
            const col = columns.find((c, i) => (c.accessor || i.toString()) === sortConfig.key);
            if (col) {
                processed.sort((a, b) => {
                    let aVal = col.sortValue ? col.sortValue(a) : (col.accessor ? a[col.accessor as keyof T] : '');
                    let bVal = col.sortValue ? col.sortValue(b) : (col.accessor ? b[col.accessor as keyof T] : '');

                    if (aVal == null) aVal = '';
                    if (bVal == null) bVal = '';

                    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                });
            }
        }

        return processed;
    }, [data, searchTerm, sortConfig, columns]);

    const totalPages = Math.ceil(processData.length / itemsPerPage);
    const paginatedData = processData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    // Reset pagination when search changes
    React.useEffect(() => {
        setPage(1);
    }, [searchTerm, data.length]);

    return (
        <div className="space-y-4">
            {/* Header Actions & Search */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {searchable && (
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full sm:w-64 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-sffl-red/20 outline-none text-gray-900 dark:text-gray-100 transition"
                        />
                    )}
                </div>
                {headerActions && <div className="flex items-center gap-3">{headerActions}</div>}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                                {columns.map((col, i) => {
                                    const headKey = String(col.accessor || i);
                                    return (
                                        <th
                                            key={headKey}
                                            onClick={() => handleSort(col, headKey)}
                                            className={`px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition' : ''}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {col.header}
                                                {col.sortable && sortConfig?.key === headKey && (
                                                    <span className="text-sffl-red">
                                                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {paginatedData.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                    {columns.map((col, j) => (
                                        <td key={j} className={col.className || "px-4 py-3 text-sm text-gray-900 dark:text-gray-300"}>
                                            {col.cell ? col.cell(row) : (col.accessor ? row[col.accessor as keyof T] as React.ReactNode : null)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {paginatedData.length === 0 && (
                                <tr>
                                    <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                                        {emptyMessage}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Showing {(page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, processData.length)} of {processData.length}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition"
                        >
                            ← Prev
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let start = Math.max(1, Math.min(page - 2, totalPages - 4));
                            const p = start + i;
                            if (p > totalPages) return null;
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`px-3 py-2 rounded-xl font-bold text-sm transition ${p === page
                                            ? 'bg-sffl-red text-white shadow-md border-transparent'
                                            : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
