import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTeamAllocations, issueTeamTicket } from '../../services/api';
import toast from 'react-hot-toast';

const TeamTickets = () => {
    const queryClient = useQueryClient();

    // Fetch allocations
    const { data: allocations = [], isLoading } = useQuery({
        queryKey: ['myTeamAllocations'],
        queryFn: getTeamAllocations,
    });

    const [issueForms, setIssueForms] = useState<Record<string, { email: string; name: string }>>({});
    const [issuingFor, setIssuingFor] = useState<string | null>(null);

    const handleFormChange = (allocationId: string, field: 'email' | 'name', value: string) => {
        setIssueForms(prev => ({
            ...prev,
            [allocationId]: {
                ...(prev[allocationId] || { email: '', name: '' }),
                [field]: value
            }
        }));
    };

    const handleIssueTicket = async (allocationId: string, eventDayId: string) => {
        const form = issueForms[allocationId];
        if (!form || !form.email || !form.name) {
            toast.error("Please provide both name and email.");
            return;
        }

        setIssuingFor(allocationId);
        try {
            await issueTeamTicket({
                event_day_id: eventDayId,
                email: form.email,
                name: form.name
            });
            toast.success("Ticket successfully issued and emailed!");

            // Clear form
            setIssueForms(prev => ({
                ...prev,
                [allocationId]: { email: '', name: '' }
            }));

            // Refresh allocations data (so issued_count increments)
            queryClient.invalidateQueries({ queryKey: ['myTeamAllocations'] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to issue ticket. Allocation may be exhausted.");
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
                        const form = issueForms[allocation.id] || { email: '', name: '' };

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
                                        <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl border border-gray-200 dark:border-gray-600 grid sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Recipient Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. John Doe"
                                                    value={form.name}
                                                    onChange={e => handleFormChange(allocation.id, 'name', e.target.value)}
                                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-sffl-navy"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Recipient Email</label>
                                                <input
                                                    type="email"
                                                    placeholder="e.g. player@team.com"
                                                    value={form.email}
                                                    onChange={e => handleFormChange(allocation.id, 'email', e.target.value)}
                                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-sffl-navy"
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleIssueTicket(allocation.id, allocation.event_day_id)}
                                                disabled={issuingFor === allocation.id || !form.name || !form.email}
                                                className="h-[46px] px-6 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg shadow transition-colors disabled:opacity-50 flex justify-center items-center"
                                            >
                                                {issuingFor === allocation.id ? (
                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    'Issue Ticket 📨'
                                                )}
                                            </button>
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
