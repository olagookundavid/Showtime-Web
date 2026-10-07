import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LockClosedIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
    getStandings, getCompetitions,
    deleteStanding,
} from '../../services/api';
import type { Standing, Competition } from '../../types';
import { ConfirmDialog, ConfirmSummary, DataTable, type Column, RowActions, LightboxImage, Select, DashboardPageHeader } from '../../components';
import { usePermissions } from '../../hooks';

// A stable empty list, so the table isn't handed a fresh array on every render.
const NO_STANDINGS: Standing[] = [];

export const AdminStandings = () => {
    const queryClient = useQueryClient();
    const { canEdit } = usePermissions();
    const canManage = canEdit('teams_standings');
    const [selectedComp, setSelectedComp] = useState('');

    const { data: compsData, isLoading: loadingComps } = useQuery({
        queryKey: ['adminCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });

    // Auto-select first competition when loaded
    useEffect(() => {
        const comps = (compsData?.data || []).filter(c => c.status !== 'inactive');
        if (comps.length > 0 && !selectedComp) {
            setSelectedComp(comps[0].id);
        }
    }, [compsData, selectedComp]);

    const { data: standingsData, isLoading: loadingStandings } = useQuery({
        queryKey: ['adminStandings', selectedComp],
        queryFn: () => getStandings(selectedComp),
        enabled: !!selectedComp,
    });

    const competitions: Competition[] = (compsData?.data || []).filter(c => c.status !== 'inactive');
    const selectedCompData = competitions.find(c => c.id === selectedComp);
    const isCompleted = selectedCompData?.status === 'completed';
    const standings: Standing[] = Array.isArray(standingsData) ? standingsData : NO_STANDINGS;
    const loading = loadingComps || (!!selectedComp && loadingStandings);
    // Deleting a standing asks first.
    const [pendingDelete, setPendingDelete] = useState<Standing | null>(null);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async (id: string) => {
        setDeleting(true);
        try {
            await deleteStanding(id);
            queryClient.invalidateQueries({ queryKey: ['adminStandings', selectedComp] });
            toast.success('Standing deleted successfully');
        } catch (err: unknown) {
            console.error(err);
            const response = (err as { response?: { data?: { message?: string; error?: string } } }).response;
            toast.error(response?.data?.message || response?.data?.error || 'Failed to delete standing');
        } finally {
            setDeleting(false);
        }
    };

    // Runs once the admin confirms. handleDelete reports its own errors, so the
    // dialog always closes afterwards.
    const confirmDelete = async () => {
        if (!pendingDelete) return;
        await handleDelete(pendingDelete.id);
        setPendingDelete(null);
    };

    const columns = useMemo<Column<Standing>[]>(() => {
        // The numeric columns are all the same shape, so they are built from one helper.
        const stat = (header: string, value: (s: Standing) => string | number): Column<Standing> => ({
            header,
            align: 'center',
            cell: (s) => <span className="text-sm dark:text-gray-300">{value(s)}</span>,
        });
        return [
            {
                // The position sits inside the Team cell, because the first column stays frozen
                // when the table scrolls sideways and a frozen position alone names no team.
                header: 'Team',
                cell: (s) => (
                    <div className="flex items-center gap-3">
                        <span className="w-5 shrink-0 text-center font-black text-sffl-navy dark:text-white">{s.position}</span>
                        {s.team?.logo && (
                            <LightboxImage
                                src={s.team.logo}
                                alt={s.team?.name}
                                thumbnailClassName="w-6 h-6 object-contain rounded-md shrink-0"
                            />
                        )}
                        <span className="font-semibold text-sm text-gray-900 dark:text-white wrap-break-word">{s.team?.name || '—'}</span>
                    </div>
                ),
            },
            stat('P', (s) => s.played ?? 0),
            stat('W', (s) => s.won ?? 0),
            stat('D', (s) => s.drawn ?? 0),
            stat('L', (s) => s.lost ?? 0),
            stat('PF', (s) => s.goals_for ?? 0),
            stat('PA', (s) => s.goals_against ?? 0),
            {
                header: 'PD',
                align: 'center',
                cell: (s) => <span className="text-sm font-semibold dark:text-gray-300">{(s.goal_diff ?? 0) > 0 ? '+' : ''}{s.goal_diff ?? 0}</span>,
            },
            stat('PCT', (s) => s.pct != null ? `${s.pct}%` : '—'),
            {
                header: 'L5',
                align: 'center',
                cell: (s) => (
                    <div className="flex justify-center gap-1 text-xs font-mono dark:text-gray-300">
                        {s.l5 ? s.l5.split('').filter(c => c !== '-').map((res, i) => (
                            <span key={i} title={res} className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${res === 'W' ? 'bg-green-500 text-white' : res === 'D' ? 'bg-yellow-400 text-gray-900' : res === 'L' ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'}`}>
                                {res}
                            </span>
                        )) : '—'}
                    </div>
                ),
            },
            {
                header: 'Actions',
                align: 'right',
                cell: (s) => (
                    <RowActions
                        label={`Actions for ${s.team?.name || 'team'}`}
                        actions={[{
                            label: 'Delete',
                            icon: TrashIcon,
                            danger: true,
                            disabled: isCompleted || !canManage,
                            hint: isCompleted ? 'Competition is completed' : !canManage ? 'View-only access to Standings' : undefined,
                            onSelect: () => setPendingDelete(s),
                        }]}
                    />
                ),
            },
        ];
    }, [isCompleted, canManage]);

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Standings"
                subtitle="Review and adjust the league table for each competition."
                actions={
                    <Select
                        aria-label="Competition"
                        value={selectedComp}
                        onChange={e => setSelectedComp(e.target.value)}
                        className="w-full sm:w-72 max-w-full"
                    >
                        {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                }
            />

            {isCompleted && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4 flex items-center gap-3 text-amber-800 dark:text-amber-400 font-bold text-sm">
                    <LockClosedIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                    <span>Season Completed. Standings are locked and cannot be modified.</span>
                </div>
            )}

            <DataTable
                data={standings}
                columns={columns}
                searchable={false}
                paginated={false}
                loading={loading}
                getRowId={(s) => s.id}
                emptyMessage="No standings data for this competition"
            />

            <ConfirmDialog
                open={pendingDelete !== null}
                title="Delete this standing?"
                description="This action cannot be undone."
                body={pendingDelete && (
                    <ConfirmSummary rows={[
                        ['Team', pendingDelete.team?.name],
                        ['Position', String(pendingDelete.position)],
                        ['Competition', selectedCompData?.name],
                    ]} />
                )}
                confirmLabel="Delete Standing"
                tone="warning"
                icon={TrashIcon}
                pending={deleting}
                onConfirm={confirmDelete}
                onCancel={() => setPendingDelete(null)}
            />
        </div>
    );
};
