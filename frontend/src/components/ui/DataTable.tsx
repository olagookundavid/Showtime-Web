import { useMemo, useState, type ReactNode } from 'react';
import {
    columnFilteringFeature,
    createFilteredRowModel,
    createPaginatedRowModel,
    createSortedRowModel,
    filterFns,
    globalFilteringFeature,
    rowPaginationFeature,
    rowSortingFeature,
    sortFns,
    tableFeatures,
    useTable,
    type ColumnDef,
    type Row,
    type RowData,
} from '@tanstack/react-table';
import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { Spinner } from './Spinner';

export interface Column<T> {
    header: string;
    accessor?: keyof T | string;
    cell?: (item: T) => ReactNode;
    sortable?: boolean;
    sortValue?: (item: T) => string | number | null | undefined; // For sorting if accessor isn't enough
    className?: string; // td className
    /** Aligns the header and the cells. */
    align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    searchable?: boolean;
    searchPlaceholder?: string;
    itemsPerPage?: number;
    emptyMessage?: string;
    headerActions?: ReactNode; // Extra filters or buttons
    onSearchSubmit?: (searchTerm: string) => void; // For trigger server-side search
    serverPage?: number;
    totalServerPages?: number;
    onPageChange?: (page: number) => void;
    /** Shows a spinner in place of the rows. The toolbar and header stay on screen. */
    loading?: boolean;
    /** false shows every row and hides the pager. */
    paginated?: boolean;
    /** Stable row keys. Defaults to the row's position. */
    getRowId?: (row: T) => string;
    /** For a few short columns, e.g. inside a dialog: drops the 800px minimum width so the table fits its container. */
    compact?: boolean;
}

// TanStack Table (v9) does the sorting, searching and paging; this file owns the markup and styling.
// Features are declared once, outside the component, so they stay stable between renders.
const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature, // required by global filtering
    globalFilteringFeature,
    rowPaginationFeature,
    sortedRowModel: createSortedRowModel(),
    filteredRowModel: createFilteredRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    sortFns,
    filterFns,
});
type Features = typeof features;

// Sorting has always compared the raw values with < and >, treating null/undefined as ''.
const compareValues = <T extends RowData>(rowA: Row<Features, T>, rowB: Row<Features, T>, columnId: string) => {
    let a = rowA.getValue<unknown>(columnId);
    let b = rowB.getValue<unknown>(columnId);
    if (a == null) a = '';
    if (b == null) b = '';
    if ((a as string | number) < (b as string | number)) return -1;
    if ((a as string | number) > (b as string | number)) return 1;
    return 0;
};

// Search has always matched against every field of the row, not only the visible columns.
const matchesAnyField = <T extends RowData>(row: Row<Features, T>, _columnId: string, term: unknown) => {
    const needle = String(term).toLowerCase();
    return Object.values(row.original as Record<string, unknown>).some((v) => String(v).toLowerCase().includes(needle));
};

const ALIGN_TEXT = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
const ALIGN_FLEX = { left: 'justify-start', center: 'justify-center', right: 'justify-end' } as const;

const DEFAULT_CELL_CLASS = 'px-4 py-3 text-sm text-gray-900 dark:text-gray-300';

// The first column stays put while the rest of the table scrolls sideways under it, so its
// cells need an opaque background. The row hover is opaque for the same reason; in dark mode
// it is the old gray-700/50 over the gray-800 card, mixed into one solid colour.
const STICKY_CELL = 'sticky left-0 z-10 border-r border-gray-200 dark:border-gray-700';
const ROW_HOVER = 'transition-colors group-hover:bg-gray-50 dark:group-hover:bg-[color-mix(in_oklab,var(--color-gray-700)_50%,var(--color-gray-800))]';
const ROW_DIVIDER = 'border-b border-gray-200 dark:border-gray-700 group-last:border-b-0';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    onPageChange,
    loading = false,
    paginated = true,
    getRowId,
    compact = false,
}: DataTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [internalPage, setInternalPage] = useState(1);

    const isServerPaginated = serverPage !== undefined && totalServerPages !== undefined && onPageChange !== undefined;
    const currentPage = isServerPaginated ? serverPage! : internalPage;

    // Back to page 1 whenever the search or the number of rows changes (only matters for local paging).
    const resetKey = `${searchTerm}|${data.length}`;
    const [pageResetKey, setPageResetKey] = useState(resetKey);
    if (pageResetKey !== resetKey) {
        setPageResetKey(resetKey);
        setInternalPage(1);
    }

    const handlePageChange = (p: number) => {
        if (isServerPaginated) {
            onPageChange!(p);
        } else {
            setInternalPage(p);
        }
    };

    // Callers pass a fresh `columns` array every render, so this recomputes each time. That is cheap
    // at these table sizes. Callers that memoize their columns skip the work.
    const tableColumns = useMemo<ColumnDef<Features, T>[]>(
        () =>
            columns.map((col, i) => ({
                id: String(i),
                header: col.header,
                accessorFn: (row: T) => {
                    const value = col.sortValue ? col.sortValue(row) : col.accessor ? row[col.accessor as keyof T] : '';
                    return value ?? '';
                },
                cell: ({ row }) =>
                    col.cell ? col.cell(row.original) : col.accessor ? (row.original[col.accessor as keyof T] as ReactNode) : null,
                enableSorting: !!col.sortable,
                sortFn: compareValues,
                sortUndefined: false,
            })),
        [columns],
    );

    // Owned here, not by the table, so the page can come from the server.
    const pagination = useMemo(
        () => ({ pageIndex: currentPage - 1, pageSize: paginated ? itemsPerPage : Infinity }),
        [currentPage, paginated, itemsPerPage],
    );

    const table = useTable({
        features,
        columns: tableColumns,
        data,
        getRowId: getRowId ? (row: T) => getRowId(row) : undefined,
        state: {
            pagination,
            // Server-side search leaves the rows alone; the parent refetches instead.
            globalFilter: onSearchSubmit || !searchTerm ? undefined : searchTerm,
        },
        globalFilterFn: matchesAnyField,
        manualPagination: isServerPaginated,
        pageCount: isServerPaginated ? totalServerPages : undefined,
        autoResetPageIndex: false, // we reset the page ourselves, above
        enableSortingRemoval: false, // clicking a header only flips between ascending and descending
        sortDescFirst: false,
        enableMultiSort: false,
    });

    const rows = table.getRowModel().rows;
    const totalRows = table.getRowCount();
    const totalPages = paginated ? table.getPageCount() : 1;
    const showToolbar = searchable || !!headerActions;

    const cellClass = (col: Column<T>, first: boolean) =>
        `${col.className || DEFAULT_CELL_CLASS}${col.align ? ` ${ALIGN_TEXT[col.align]}` : ''} ${ROW_DIVIDER} ${ROW_HOVER}${first ? ` ${STICKY_CELL} bg-white dark:bg-gray-800` : ''}`;

    return (
        <div className="space-y-4">
            {/* Header Actions & Search - Condensed */}
            {showToolbar && (
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
                    {headerActions && <div className="flex flex-wrap items-center gap-3">{headerActions}</div>}
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* The same table on every screen: on a phone it scrolls sideways and the first column
                    stays frozen. `isolate` keeps the frozen cells' z-index inside the table.
                    Borders sit on the cells (border-separate), because with border-collapse a sticky
                    cell's borders scroll away and the row lines vanish under the frozen column. */}
                <div className="relative isolate overflow-x-auto">
                    <table className={`w-full text-left border-separate border-spacing-0 ${compact ? '' : 'min-w-200'}`}>
                        <thead>
                            {table.getHeaderGroups().map((group) => (
                                <tr key={group.id} className="bg-gray-50 dark:bg-gray-800/50">
                                    {group.headers.map((header, i) => {
                                        const col = columns[Number(header.column.id)];
                                        const align = col?.align ?? 'left';
                                        const canSort = header.column.getCanSort();
                                        const sorted = header.column.getIsSorted();
                                        const labelClass = `flex items-center gap-1.5 w-full min-h-11 px-4 py-2 ${ALIGN_FLEX[align]}`;
                                        return (
                                            <th
                                                key={header.id}
                                                scope="col"
                                                aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : canSort ? 'none' : undefined}
                                                className={`p-0 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 ${ALIGN_TEXT[align]}${i === 0 ? ` ${STICKY_CELL} bg-gray-50 dark:bg-gray-800` : ''}`}
                                            >
                                                {canSort ? (
                                                    <button
                                                        type="button"
                                                        onClick={header.column.getToggleSortingHandler()}
                                                        className={`${labelClass} uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition`}
                                                    >
                                                        <table.FlexRender header={header} />
                                                        {sorted === 'asc' ? (
                                                            <ChevronUpIcon className="w-4 h-4 text-sffl-red" aria-hidden="true" />
                                                        ) : sorted === 'desc' ? (
                                                            <ChevronDownIcon className="w-4 h-4 text-sffl-red" aria-hidden="true" />
                                                        ) : (
                                                            <ChevronUpDownIcon className="w-4 h-4 opacity-40" aria-hidden="true" />
                                                        )}
                                                    </button>
                                                ) : (
                                                    <div className={labelClass}>
                                                        <table.FlexRender header={header} />
                                                    </div>
                                                )}
                                            </th>
                                        );
                                    })}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length}>
                                        <Spinner />
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => (
                                    <tr key={row.id} className="group">
                                        {row.getAllCells().map((cell, i) => (
                                            <td key={cell.id} className={cellClass(columns[Number(cell.column.id)], i === 0)}>
                                                {i === 0 ? (
                                                    // Table cells ignore max-width, so the cap goes on a wrapper. It stops a
                                                    // long name from covering most of a phone screen.
                                                    <div className="max-w-[45vw] md:max-w-none">
                                                        <table.FlexRender cell={cell} />
                                                    </div>
                                                ) : (
                                                    <table.FlexRender cell={cell} />
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                            {!loading && rows.length === 0 && (
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
            {paginated && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                    <p className="text-[10px] md:text-sm text-gray-500 dark:text-gray-400">
                        {isServerPaginated
                            ? `Page ${currentPage} of ${totalPages}`
                            : totalRows === 0
                                ? 'Showing 0 of 0'
                                : `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, totalRows)} of ${totalRows}`
                        }
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        <button
                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage <= 1}
                            className="px-3 md:px-4 py-2 min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-xs md:text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-all duration-300"
                        >
                            Prev
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                            const p = start + i;
                            if (p > totalPages) return null;
                            return (
                                <button
                                    key={p}
                                    onClick={() => handlePageChange(p)}
                                    className={`px-3 md:px-4 py-2 min-h-11 min-w-11 rounded-lg font-bold text-xs md:text-sm transition-all duration-300 ${p === currentPage
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
                            className="px-3 md:px-4 py-2 min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-xs md:text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-all duration-300"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
