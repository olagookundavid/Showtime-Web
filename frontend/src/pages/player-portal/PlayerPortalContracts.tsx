import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { playerPortalApi } from '../../services/api';
import type { ContractData } from '../../types/contracts';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { RowActions } from '../../components/ui/RowActions';
import { NotLinkedNotice } from '../../components/player-portal/NotLinkedNotice';
import { OfferResponseDialog } from '../../components/player-portal/OfferResponseDialog';
import type { OfferResponse } from '../../types/contracts';
import { apiError } from '../../components/player-portal/apiError';

const NO_ROWS: ContractData[] = [];

const STATUS_CLASS: Record<ContractData['status'], string> = {
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    EXPIRED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    TERMINATED: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    REJECTED: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const TeamCell = ({ c }: { c: ContractData }) => (
    <div className="flex items-center gap-3 min-w-0">
        {c.team?.logo && <img src={c.team.logo} alt="" className="w-6 h-6 shrink-0 object-contain" />}
        <span className="font-bold text-gray-900 dark:text-white wrap-break-word min-w-0">{c.team?.name || 'Team'}</span>
    </div>
);

export const PlayerPortalContracts: React.FC = () => {
    const [contracts, setContracts] = useState<ContractData[]>(NO_ROWS);
    const [loading, setLoading] = useState<boolean>(true);
    const [notLinked, setNotLinked] = useState<boolean>(false);
    // Accept and reject wait here for the confirm dialog.
    const [respondTo, setRespondTo] = useState<OfferResponse | null>(null);

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const res = await playerPortalApi.getContracts();
            setContracts(res || NO_ROWS);
            setNotLinked(false);
        } catch (err) {
            if (apiError(err).code === 'PLAYER_NOT_LINKED') {
                setNotLinked(true);
            } else {
                toast.error('Failed to load contract history');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, []);

    // A pending offer is actionable from this page too. It used to be reachable
    // only from the Overview tab, so players who came looking for their contracts
    // here found the offer listed with no way to answer it.
    const columns = useMemo<Column<ContractData>[]>(() => [
        { header: 'Team', sortable: true, sortValue: (c) => c.team?.name, cell: (c) => <TeamCell c={c} /> },
        {
            header: 'Status',
            sortable: true,
            accessor: 'status',
            cell: (c) => (
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap ${STATUS_CLASS[c.status] ?? STATUS_CLASS.EXPIRED}`}>
                    {c.status}
                </span>
            ),
        },
        {
            header: 'Length',
            cell: (c) => <span className="text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">{c.contract_length?.toLocaleString()} matches</span>,
        },
        {
            header: 'Played',
            cell: (c) => <span className="font-mono font-bold text-gray-900 dark:text-white">{c.matches_played?.toLocaleString()}</span>,
        },
        {
            header: 'Value',
            cell: (c) => <span className="font-bold text-gray-900 dark:text-white whitespace-nowrap">{c.player_value.toLocaleString()} pts</span>,
        },
        {
            header: 'Offered',
            sortable: true,
            sortValue: (c) => new Date(c.offered_at).getTime(),
            cell: (c) => <span className="text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{new Date(c.offered_at).toLocaleDateString()}</span>,
        },
        {
            header: 'Reason / Notes',
            cell: (c) => <span className="text-xs text-gray-500 dark:text-gray-400">{c.termination_reason || c.notes || '—'}</span>,
        },
        {
            header: 'Actions',
            align: 'right',
            cell: (c) => {
                const pending = c.status === 'PENDING';
                const hint = pending ? undefined : 'Only pending offers can be answered';
                return (
                    <RowActions
                        label={`Actions for the ${c.team?.name || 'team'} contract`}
                        actions={[
                            {
                                label: 'Accept offer',
                                icon: CheckCircleIcon,
                                disabled: !pending,
                                hint,
                                onSelect: () => setRespondTo({ contract: c, action: 'accept' }),
                            },
                            {
                                label: 'Reject offer',
                                icon: XCircleIcon,
                                danger: true,
                                disabled: !pending,
                                hint,
                                onSelect: () => setRespondTo({ contract: c, action: 'reject' }),
                            },
                        ]}
                    />
                );
            },
        },
    ], []);

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Contracts"
                subtitle="Every contract you've been offered, with any pending offer to accept or reject."
            />

            {notLinked ? <NotLinkedNotice /> : (
                <DataTable
                    data={contracts}
                    columns={columns}
                    getRowId={(c) => c.id}
                    loading={loading}
                    searchable={false}
                    emptyMessage="No contract records yet. Once your manager offers you a deal it will appear here for you to accept."
                />
            )}

            <OfferResponseDialog
                request={respondTo}
                onCancel={() => setRespondTo(null)}
                onDone={() => {
                    setRespondTo(null);
                    fetchContracts();
                }}
            />
        </div>
    );
};

export default PlayerPortalContracts;
