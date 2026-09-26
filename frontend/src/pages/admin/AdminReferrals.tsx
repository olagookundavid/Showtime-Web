import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminListReferrals, type ReferralStatsResponse } from '../../services/api';
import { DataTable, type Column } from '../../components/ui/DataTable';

const PAGE_SIZE = 10;
const NO_ROWS: ReferralStatsResponse[] = [];

export const AdminReferrals = () => {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const { data, isLoading, error } = useQuery({
        queryKey: ['adminReferrals', page, search],
        queryFn: () => adminListReferrals(page, PAGE_SIZE, search || undefined),
        staleTime: 15_000,
        placeholderData: (prev) => prev,
    });

    const statsList = data?.data ?? NO_ROWS;
    const totalItems = data?.total ?? 0;
    const totalPages = data?.total_pages || 1;

    // Simple client side summary for the current view
    const totalReferredTickets = statsList.reduce((sum, item) => sum + item.tickets_sold, 0);
    const totalReferredRevenue = statsList.reduce((sum, item) => sum + item.total_revenue, 0);

    const columns = useMemo<Column<ReferralStatsResponse>[]>(
        () => [
            {
                header: 'Name',
                accessor: 'name',
                sortable: true,
                cell: (r) => <span className="font-bold">{r.name}</span>,
            },
            {
                header: 'Referral Code',
                cell: (r) => (
                    <span className="font-mono font-bold uppercase tracking-wider text-sffl-navy dark:text-white">
                        {r.code}
                    </span>
                ),
            },
            {
                header: 'Email',
                cell: (r) =>
                    r.email ? (
                        <span className="text-gray-500 dark:text-gray-400">{r.email}</span>
                    ) : (
                        <span className="italic text-gray-400 dark:text-gray-500">None</span>
                    ),
            },
            {
                header: 'Tickets Sold',
                accessor: 'tickets_sold',
                align: 'center',
                sortable: true,
                cell: (r) => <span className="font-bold">{r.tickets_sold}</span>,
            },
            {
                header: 'Revenue',
                accessor: 'total_revenue',
                align: 'right',
                sortable: true,
                cell: (r) => <span className="font-black text-sffl-red">₦{r.total_revenue.toLocaleString()}</span>,
            },
            {
                header: 'Created At',
                accessor: 'created_at',
                sortable: true,
                cell: (r) => (
                    <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {new Date(r.created_at).toLocaleDateString()}
                    </span>
                ),
            },
        ],
        [],
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white">
                    TICKET REFERRERS
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Monitor, search, and manage user referral codes, tickets sold, and total revenue.
                    {data && ` ${totalItems} referrer${totalItems === 1 ? '' : 's'}${search ? ` matching "${search}"` : ''}.`}
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">
                        Tickets Sold (Current Page)
                    </span>
                    <span className="text-3xl font-black text-sffl-navy dark:text-white">
                        {totalReferredTickets}
                    </span>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">
                        Revenue Generated (Current Page)
                    </span>
                    <span className="text-3xl font-black text-sffl-red wrap-break-word">
                        ₦{totalReferredRevenue.toLocaleString()}
                    </span>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-sm font-medium text-red-700 dark:text-red-300">
                    Failed to load referral statistics. Please try again.
                </div>
            )}

            <DataTable
                data={statsList}
                columns={columns}
                getRowId={(r) => r.id}
                loading={isLoading}
                searchPlaceholder="Search by code or referrer name"
                onSearchSubmit={(q) => {
                    setSearch(q.trim());
                    setPage(1);
                }}
                serverPage={page}
                totalServerPages={totalPages}
                onPageChange={setPage}
                itemsPerPage={PAGE_SIZE}
                emptyMessage={search ? 'No referrers match that search.' : 'No referrers found.'}
            />
        </div>
    );
};
