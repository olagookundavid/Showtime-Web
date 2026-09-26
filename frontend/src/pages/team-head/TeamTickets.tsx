import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExclamationTriangleIcon, PaperAirplaneIcon, TicketIcon } from '@heroicons/react/24/outline';
import { getTeamAllocations, issueTeamTicket, getPlayers, type Player, type TeamTicketAllocation } from '../../services/api';
import toast from 'react-hot-toast';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { Spinner } from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../utils/apiError';

type IssueForm = { playerId: string; name: string; email: string };

const EMPTY_FORM: IssueForm = { playerId: '', name: '', email: '' };
const NO_ALLOCATIONS: TeamTicketAllocation[] = [];

const TeamTickets = () => {
    const queryClient = useQueryClient();

    // Fetch allocations
    const { data: allocations = NO_ALLOCATIONS, isLoading } = useQuery({
        queryKey: ['myTeamAllocations'],
        queryFn: getTeamAllocations,
    });

    const [issueForms, setIssueForms] = useState<Record<string, IssueForm>>({});
    // The ticket waiting on the confirm dialog, and whether it is being sent.
    const [pendingIssue, setPendingIssue] = useState<{ allocation: TeamTicketAllocation; form: IssueForm } | null>(null);
    const [busy, setBusy] = useState(false);

    // Get current team ID from allocations
    const teamId = allocations.length > 0 ? allocations[0].team_id : undefined;

    // Fetch team players
    const { data: playersData } = useQuery({
        queryKey: ['myTeamPlayers', teamId],
        queryFn: () => getPlayers(teamId, 1, 100),
        enabled: !!teamId,
    });
    const players: Player[] = playersData?.data || [];

    const handlePlayerSelect = (allocationId: string, playerId: string) => {
        if (!playerId) {
            setIssueForms(prev => ({ ...prev, [allocationId]: EMPTY_FORM }));
            return;
        }

        const player = players.find(p => p.id === playerId);
        if (!player) return;

        if (!player.email || player.email.trim() === '') {
            toast.error(`Player ${player.name} has no email registered. Please update player details in the team section before issuing a ticket.`);
            setIssueForms(prev => ({ ...prev, [allocationId]: EMPTY_FORM }));
            return;
        }

        setIssueForms(prev => ({
            ...prev,
            [allocationId]: { playerId: player.id, name: player.name, email: player.email || '' },
        }));
    };

    const askToIssue = (allocation: TeamTicketAllocation) => {
        const form = issueForms[allocation.id];
        if (!form || !form.email || !form.name) {
            toast.error('Please select a player first.');
            return;
        }
        setPendingIssue({ allocation, form });
    };

    const confirmIssue = async () => {
        if (!pendingIssue) return;
        const { allocation, form } = pendingIssue;
        setBusy(true);
        try {
            await issueTeamTicket({ event_day_id: allocation.event_day_id, email: form.email, name: form.name });
            toast.success(`Ticket for ${form.name} successfully issued!`);
            queryClient.invalidateQueries({ queryKey: ['myTeamAllocations'] });
            setIssueForms(prev => ({ ...prev, [allocation.id]: EMPTY_FORM }));
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to issue ticket.'));
        } finally {
            setBusy(false);
            setPendingIssue(null);
        }
    };

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Match Tickets"
                subtitle="Send the complimentary tickets allocated to your team for upcoming event days. Each one is emailed to the player straight away."
            />

            {isLoading ? (
                <Spinner label="Loading allocations" />
            ) : allocations.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 sm:p-12 text-center shadow border border-gray-100 dark:border-gray-700">
                    <TicketIcon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                    <h2 className="text-xl font-bold dark:text-white">No active allocations</h2>
                    <p className="text-gray-500 mt-2">Your team has not been allocated any tickets for upcoming events yet.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {allocations.map(allocation => {
                        const remaining = allocation.allocated_count - allocation.issued_count;
                        const isExhausted = remaining <= 0;
                        const form = issueForms[allocation.id];

                        return (
                            <div key={allocation.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                                <div className="bg-sffl-navy text-white p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <h2 className="text-xl sm:text-2xl font-black min-w-0 wrap-break-word">{allocation.event_title || 'Upcoming Match Day'}</h2>
                                    <div className="bg-white/10 px-4 py-2 rounded-lg text-center min-w-30 shrink-0">
                                        <div className="text-sm text-gray-300 font-medium">Tickets Remaining</div>
                                        <div className={`text-3xl font-black ${isExhausted ? 'text-red-400' : 'text-green-400'}`}>
                                            {remaining} <span className="text-sm font-normal text-white">/ {allocation.allocated_count}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 sm:p-6">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4">Issue a New Ticket</h3>

                                    {isExhausted ? (
                                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm font-bold flex items-start gap-2">
                                            <ExclamationTriangleIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                                            You have used your ticket allocation for this match day.
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-600 space-y-4">
                                            <label className="block">
                                                <span className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Select Player</span>
                                                <select
                                                    value={form?.playerId || ''}
                                                    onChange={e => handlePlayerSelect(allocation.id, e.target.value)}
                                                    className="w-full min-h-11 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-sffl-navy font-semibold text-sm cursor-pointer"
                                                >
                                                    <option value="">Choose a player</option>
                                                    {players.map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.name} ({p.position || 'N/A'})
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>

                                            {form?.playerId && (
                                                <div className="grid sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-4 items-end animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <label className="block min-w-0">
                                                        <span className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Recipient Name</span>
                                                        <input
                                                            type="text"
                                                            value={form.name}
                                                            readOnly
                                                            className="w-full min-h-11 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 outline-none cursor-not-allowed"
                                                        />
                                                    </label>
                                                    <label className="block min-w-0">
                                                        <span className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Recipient Email</span>
                                                        <input
                                                            type="email"
                                                            value={form.email}
                                                            readOnly
                                                            className="w-full min-h-11 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 outline-none cursor-not-allowed"
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => askToIssue(allocation)}
                                                        className="min-h-11 px-6 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg shadow transition-colors flex justify-center items-center gap-2 sm:col-span-2 lg:col-span-1"
                                                    >
                                                        <PaperAirplaneIcon className="w-5 h-5" aria-hidden="true" />
                                                        Issue Ticket
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                open={pendingIssue !== null}
                title={pendingIssue ? `Send a ticket to ${pendingIssue.form.name}?` : 'Send this ticket?'}
                description="It is emailed straight away and uses one of your team's tickets."
                body={pendingIssue && (
                    <ConfirmSummary rows={[
                        ['Player', pendingIssue.form.name],
                        ['Email', pendingIssue.form.email],
                        ['Event day', pendingIssue.allocation.event_title || 'Upcoming Match Day'],
                    ]} />
                )}
                confirmLabel="Issue Ticket"
                tone="info"
                icon={PaperAirplaneIcon}
                pending={busy}
                onConfirm={confirmIssue}
                onCancel={() => setPendingIssue(null)}
            />
        </div>
    );
};

export default TeamTickets;
