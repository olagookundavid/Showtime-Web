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
    onSearchSubmit?: (searchTerm: string) => void; // For trigger server-side search
    serverPage?: number;
    totalServerPages?: number;
    onPageChange?: (page: number) => void;
}

export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    searchable = true,
    searchPlaceholder = "Search...",
    itemsPerPage = 10,
    emptyMessage = "No records found.",
    headerActions,
    onSearchSubmit,
    serverPage,
    totalServerPages,
    onPageChange
}: DataTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [internalPage, setInternalPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const isServerPaginated = serverPage !== undefined && totalServerPages !== undefined && onPageChange !== undefined;
    const currentPage = isServerPaginated ? serverPage! : internalPage;

    const handlePageChange = (p: number) => {
        if (isServerPaginated) {
            onPageChange!(p);
        } else {
            setInternalPage(p);
        }
    };

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

        // 1. Search (basic stringification of row values) - bypass if server-side
        if (searchTerm && !onSearchSubmit) {
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

    const totalPages = isServerPaginated ? totalServerPages! : Math.ceil(processData.length / itemsPerPage);
    const paginatedData = isServerPaginated ? processData : processData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Reset local pagination when search changes (only if local)
    React.useEffect(() => {
        if (!isServerPaginated) {
            setInternalPage(1);
        }
    }, [searchTerm, data.length, isServerPaginated]);

    return (
        <div className="space-y-4">
            {/* Header Actions & Search - Condensed */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 bg-white dark:bg-gray-800 p-2 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {searchable && (
                        <div className="flex gap-2 w-full sm:w-auto">
                            <input
                                type="text"
                                placeholder={searchPlaceholder}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && onSearchSubmit && onSearchSubmit(searchTerm)}
                                className="w-full sm:w-64 px-4 py-2 min-h-[44px] bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-sffl-red/20 outline-none text-gray-900 dark:text-gray-100 transition-colors"
                            />
                            {onSearchSubmit && (
                                <button
                                    onClick={() => onSearchSubmit(searchTerm)}
                                    className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-xs font-bold rounded-lg shadow hover:bg-red-600 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                                >
                                    Search
                                </button>
                            )}
                        </div>
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

            {/* Pagination Controls - Condensed */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                <p className="text-[10px] md:text-sm text-gray-500 dark:text-gray-400">
                    {isServerPaginated
                        ? `Page ${currentPage} of ${totalPages}`
                        : `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, processData.length)} of ${processData.length}`
                    }
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage <= 1}
                        className="px-3 py-1.5 md:px-4 md:py-2 min-h-[36px] md:min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-xs md:text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-all duration-300"
                    >
                        Prev
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                        const p = start + i;
                        if (p > totalPages) return null;
                        return (
                            <button
                                key={p}
                                onClick={() => handlePageChange(p)}
                                className={`px-3 py-1.5 md:px-4 md:py-2 min-h-[36px] md:min-h-[44px] rounded-lg font-bold text-xs md:text-sm transition-all duration-300 ${p === currentPage
                                    ? 'bg-sffl-red text-white shadow-md border-transparent'
                                    : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                {p}
                            </button>
                        );
                    })}
                    <button
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-1.5 md:px-4 md:py-2 min-h-[36px] md:min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-xs md:text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-all duration-300"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
