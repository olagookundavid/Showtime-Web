import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { playerPortalApi } from '../../services/api';
import type { TransferData } from '../../types';
import { DashboardPageHeader, DataTable, type Column, NotLinkedNotice, apiError } from '../../components';

const PAGE_SIZE = 20;
const NO_ROWS: TransferData[] = [];

const TYPE_LABEL: Record<TransferData['type'], string> = {
    REQUEST: 'Transfer request',
    LISTING: 'Listing',
    DIRECT_SALE: 'Direct sale',
};

const badgeClass = 'px-2.5 py-1 text-xs font-bold rounded-full border whitespace-nowrap';

const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
        case 'COMPLETED':
        case 'ACCEPTED':
            return <span className={`${badgeClass} bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20`}>Completed</span>;
        case 'PENDING':
            return <span className={`${badgeClass} bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20`}>Pending</span>;
        case 'REJECTED':
        case 'CANCELLED':
            return <span className={`${badgeClass} bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20`}>{status}</span>;
        default:
            return <span className={`${badgeClass} bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20`}>{status}</span>;
    }
};

// The destination names the row; the kind of move sits under it.
const ToClubCell = ({ t }: { t: TransferData }) => (
    <div className="min-w-0">
        <div className="font-semibold text-sffl-red wrap-break-word">
            {t.to_team?.name || (t.type === 'LISTING' ? 'Open Market' : 'Free Agent')}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{TYPE_LABEL[t.type] ?? t.type}</div>
    </div>
);

export const PlayerPortalTransfers: React.FC = () => {
    const [transfers, setTransfers] = useState<TransferData[]>(NO_ROWS);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);
    const [notLinked, setNotLinked] = useState<boolean>(false);

    useEffect(() => {
        const fetchTransfers = async () => {
            setLoading(true);
            try {
                const res = await playerPortalApi.getMyTransfers({ page, limit: PAGE_SIZE });
                setTransfers(res.data || NO_ROWS);
                setTotalPages(res.total_pages || 1);
                setNotLinked(false);
            } catch (err) {
                // Expected state for an account whose claim hasn't been approved —
                // explain it rather than firing an error toast.
                if (apiError(err).code === 'PLAYER_NOT_LINKED') {
                    setNotLinked(true);
                } else {
                    toast.error('Failed to load transfer history');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchTransfers();
    }, [page]);

    const columns = useMemo<Column<TransferData>[]>(() => [
        { header: 'To Club', cell: (t) => <ToClubCell t={t} /> },
        {
            header: 'From Club',
            cell: (t) => <span className="font-semibold text-gray-800 dark:text-gray-200">{t.from_team?.name || 'Free Agent'}</span>,
        },
        {
            // Transfer values are league points, as on the team-head and admin pages.
            header: 'Fee / Value',
            cell: (t) => (
                <span className="font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {t.asking_price ? `${t.asking_price.toLocaleString()} pts` : '—'}
                </span>
            ),
        },
        { header: 'Status', cell: (t) => <StatusBadge status={t.status} /> },
        {
            header: 'Date',
            cell: (t) => (
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
            ),
        },
    ], []);

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Transfers"
                subtitle="Your moves between clubs, including direct sales and transfer requests."
            />

            {notLinked ? <NotLinkedNotice /> : (
                <DataTable
                    data={transfers}
                    columns={columns}
                    getRowId={(t) => t.id}
                    loading={loading}
                    searchable={false}
                    serverPage={page}
                    totalServerPages={totalPages}
                    onPageChange={setPage}
                    emptyMessage="No transfer records yet. Moves between clubs will appear here once they complete."
                />
            )}
        </div>
    );
};
