import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTeamAllocations, issueTeamTicket, getPlayers, type Player } from '../../services/api';
import toast from 'react-hot-toast';

const TeamTickets = () => {
    const queryClient = useQueryClient();

    // Fetch allocations
    const { data: allocations = [], isLoading } = useQuery({
        queryKey: ['myTeamAllocations'],
        queryFn: getTeamAllocations,
    });

    const [issueForms, setIssueForms] = useState<Record<string, { playerId: string; name: string; email: string }>>({});
    const [issuingFor, setIssuingFor] = useState<string | null>(null);

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
            setIssueForms(prev => ({ ...prev, [allocationId]: { playerId: '', name: '', email: '' } }));
            return;
        }

        const player = players.find(p => p.id === playerId);
        if (!player) return;

        if (!player.email || player.email.trim() === '') {
            toast.error(`Player ${player.name} has no email registered. Please update player details in the team section before issuing a ticket.`);
            // Optionally clear or don't prefill if no email
            setIssueForms(prev => ({
                ...prev,
                [allocationId]: { playerId: '', name: '', email: '' }
            }));
            return;
        }

        setIssueForms(prev => ({
            ...prev,
            [allocationId]: {
                playerId: player.id,
                name: player.name,
                email: player.email || ''
            }
        }));
    };

    const handleIssueTicket = async (allocationId: string, eventDayId: string) => {
        const form = issueForms[allocationId];
        if (!form || !form.email || !form.name) {
            toast.error("Please select a player first.");
            return;
        }

        setIssuingFor(allocationId);
        try {
            await issueTeamTicket({
                event_day_id: eventDayId,
                email: form.email,
                name: form.name
            });
            toast.success(`Ticket for ${form.name} successfully issued!`);
            queryClient.invalidateQueries({ queryKey: ['myTeamAllocations'] });

            // Clear selection
            setIssueForms(prev => ({
                ...prev,
                [allocationId]: { playerId: '', name: '', email: '' }
            }));
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to issue ticket.");
        } finally {
            setIssuingFor(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-4 border-sffl-navy border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-black text-sffl-navy dark:text-white mb-2">🎟️ Match Day Tickets</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
                Distribute complimentary tickets allocated to your team for upcoming Event Days. These tickets will be instantly emailed to your players or guests.
            </p>

            {allocations.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow border border-gray-100 dark:border-gray-700">
                    <p className="text-5xl mb-4">🏟️</p>
                    <h3 className="text-xl font-bold dark:text-white">No active allocations</h3>
                    <p className="text-gray-500 mt-2">Your team has not been allocated any tickets for upcoming events yet.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {allocations.map(allocation => {
                        const remaining = allocation.allocated_count - allocation.issued_count;
                        const isExhausted = remaining <= 0;

                        return (
                            <div key={allocation.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                                <div className="bg-sffl-navy text-white p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h3 className="text-2xl font-black">{allocation.event_title || 'Upcoming Match Day'}</h3>
                                    </div>
                                    <div className="bg-white/10 px-4 py-2 rounded-lg text-center min-w-[120px]">
                                        <div className="text-sm text-gray-300 font-medium">Tickets Remaining</div>
                                        <div className={`text-3xl font-black ${isExhausted ? 'text-red-400' : 'text-green-400'}`}>
                                            {remaining} <span className="text-sm font-normal text-white">/ {allocation.allocated_count}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-4">Issue a New Ticket</h4>

                                    {isExhausted ? (
                                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm font-bold flex items-center gap-2">
                                            ⚠️ You have exhausted your ticket allocation for this match day.
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl border border-gray-200 dark:border-gray-600 space-y-4">
                                            <div className="w-full">
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Select Player</label>
                                                <select
                                                    value={issueForms[allocation.id]?.playerId || ''}
                                                    onChange={e => handlePlayerSelect(allocation.id, e.target.value)}
                                                    disabled={issuingFor === allocation.id}
                                                    className="w-full h-[46px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-sffl-navy font-semibold text-sm cursor-pointer"
                                                >
                                                    <option value="">-- Choose a player --</option>
                                                    {players.map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.name} ({p.position || 'N/A'})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {issueForms[allocation.id]?.playerId && (
                                                <div className="grid sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-4 items-end animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Recipient Name</label>
                                                        <input
                                                            type="text"
                                                            value={issueForms[allocation.id].name}
                                                            readOnly
                                                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 outline-none cursor-not-allowed"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Recipient Email</label>
                                                        <input
                                                            type="email"
                                                            value={issueForms[allocation.id].email}
                                                            readOnly
                                                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 outline-none cursor-not-allowed"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => handleIssueTicket(allocation.id, allocation.event_day_id)}
                                                        disabled={issuingFor === allocation.id}
                                                        className="h-[46px] px-6 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg shadow transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                                                    >
                                                        {issuingFor === allocation.id ? (
                                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        ) : (
                                                            <>
                                                                <span>Issue Ticket</span>
                                                                <span>📨</span>
                                                            </>
                                                        )}
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
        </div>
    );
};

export default TeamTickets;
