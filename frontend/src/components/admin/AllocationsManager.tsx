import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { TicketIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
    adminGetAllocations,
    adminCreateOrUpdateAllocation,
    adminDeleteAllocation,
    getTeams,
    type TeamTicketAllocation,
} from '../../services/api';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ConfirmSummary } from '../ui/ConfirmSummary';
import { Spinner } from '../ui/Spinner';
import { Button, IconButton, Input, Select } from '../ui';
import { getApiErrorMessage } from '../../utils/apiError';
import { usePermissions } from '../../hooks/usePermissions';

type PendingAction = { kind: 'save' } | { kind: 'delete'; allocation: TeamTicketAllocation };

export const AllocationsManager = ({ eventDayId, eventDayTitle }: { eventDayId: string, eventDayTitle: string }) => {
    const queryClient = useQueryClient();
    const { canEdit } = usePermissions();
    const canManage = canEdit('event_days');
    const [teamId, setTeamId] = useState('');
    const [allocatedCount, setAllocatedCount] = useState('');
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    const { data: allocations = [], isLoading: loadingAllocations } = useQuery({
        queryKey: ['adminAllocations', eventDayId],
        queryFn: () => adminGetAllocations(eventDayId),
    });

    const { data: teamsData } = useQuery({
        queryKey: ['adminTeamsAll'],
        queryFn: () => getTeams(1, 100),
    });
    const teams = teamsData?.data || [];

    const count = parseInt(allocatedCount, 10);
    const teamName = teams.find(t => t.id === teamId)?.name;
    const existing = allocations.find(a => a.team_id === teamId);

    const requestSave = () => {
        if (!teamId) return;
        if (!Number.isFinite(count) || count < 1) {
            toast.error('Enter a ticket count of at least 1');
            return;
        }
        setPendingAction({ kind: 'save' });
    };

    const confirmPendingAction = async () => {
        if (!pendingAction) return;
        if (!canManage) {
            toast.error('View-only access: your role can view Event Days but not make changes.');
            setPendingAction(null);
            return;
        }
        setBusy(true);
        try {
            if (pendingAction.kind === 'save') {
                await adminCreateOrUpdateAllocation({
                    event_day_id: eventDayId,
                    team_id: teamId,
                    allocated_count: count,
                });
                setTeamId('');
                setAllocatedCount('');
                toast.success('Allocation saved');
            } else {
                await adminDeleteAllocation(pendingAction.allocation.id);
                toast.success('Allocation revoked');
            }
            queryClient.invalidateQueries({ queryKey: ['adminAllocations', eventDayId] });
        } catch (err) {
            toast.error(getApiErrorMessage(err, pendingAction.kind === 'save' ? 'Failed to save allocation' : 'Failed to delete allocation'));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const dialog = pendingAction?.kind === 'delete'
        ? {
            title: 'Revoke this allocation?',
            description: undefined,
            confirmLabel: 'Revoke Allocation',
            tone: 'warning' as const,
            icon: TrashIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Event', eventDayTitle],
                    ['Team', pendingAction.allocation.team_name || 'Unknown Team'],
                    ['Tickets', String(pendingAction.allocation.allocated_count)],
                ]} />
            ),
        }
        : {
            title: 'Set this allocation?',
            description: existing ? `This replaces the team's current allocation of ${existing.allocated_count} tickets.` : undefined,
            confirmLabel: 'Set Allocation',
            tone: 'info' as const,
            icon: TicketIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Event', eventDayTitle],
                    ['Team', teamName],
                    ['Tickets', allocatedCount],
                ]} />
            ),
        };

    return (
        <div className="mt-4 p-4 bg-purple-50 dark:bg-gray-700/50 rounded-lg border border-purple-200 dark:border-gray-600">
            <h4 className="flex items-center gap-1.5 font-bold text-sffl-navy dark:text-white mb-4 min-w-0">
                <TicketIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 wrap-break-word">Team Allocations for {eventDayTitle}</span>
            </h4>

            {loadingAllocations ? (
                <Spinner label="Loading allocations" className="py-6" size="sm" />
            ) : (
                <div className="space-y-4">
                    {allocations.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {allocations.map(a => (
                                <div key={a.id} className="bg-white dark:bg-gray-700 p-3 rounded-md shadow-sm border border-gray-100 dark:border-gray-600 flex justify-between items-center gap-2">
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm dark:text-white truncate">{a.team_name || 'Unknown Team'}</p>
                                        <p className="text-xs text-gray-500">{a.allocated_count} Tickets Allocated</p>
                                    </div>
                                    <IconButton
                                        variant="danger"
                                        icon={TrashIcon}
                                        label={`Revoke allocation for ${a.team_name || 'this team'}`}
                                        className="shrink-0"
                                        disabled={!canManage}
                                        title={canManage ? undefined : 'View-only access to Event Days'}
                                        onClick={() => setPendingAction({ kind: 'delete', allocation: a })}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No teams have been allocated tickets for this event day.</p>
                    )}

                    {/* Add/Update Form */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-purple-200 dark:border-gray-600">
                        <Select
                            value={teamId}
                            onChange={e => setTeamId(e.target.value)}
                            aria-label="Team"
                            className="w-full sm:flex-1"
                        >
                            <option value="">Select a team</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </Select>
                        <Input
                            type="number"
                            min="1"
                            value={allocatedCount}
                            onChange={e => setAllocatedCount(e.target.value)}
                            placeholder="Ticket Count"
                            aria-label="Ticket count"
                            className="w-full sm:w-32"
                        />
                        <Button
                            variant="navy"
                            className="shrink-0"
                            disabled={busy || !teamId || !allocatedCount || !canManage}
                            title={canManage ? undefined : 'View-only access to Event Days'}
                            onClick={requestSave}
                        >
                            Set Allocation
                        </Button>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={pendingAction !== null}
                title={dialog.title}
                description={dialog.description}
                body={dialog.body}
                confirmLabel={dialog.confirmLabel}
                tone={dialog.tone}
                icon={dialog.icon}
                pending={busy}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
            />
        </div>
    );
};
