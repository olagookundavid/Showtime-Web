import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminGetAllocations, adminCreateOrUpdateAllocation, adminDeleteAllocation, getTeams } from '../../services/api';

export const AllocationsManager = ({ eventDayId, eventDayTitle }: { eventDayId: string, eventDayTitle: string }) => {
    const queryClient = useQueryClient();
    const [teamId, setTeamId] = useState('');
    const [allocatedCount, setAllocatedCount] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const { data: allocations = [], isLoading: loadingAllocations } = useQuery({
        queryKey: ['adminAllocations', eventDayId],
        queryFn: () => adminGetAllocations(eventDayId),
    });

    const { data: teamsData } = useQuery({
        queryKey: ['adminTeamsAll'],
        queryFn: () => getTeams(1, 100),
    });
    const teams = teamsData?.data || [];

    const handleSave = async () => {
        if (!teamId || !allocatedCount) return;
        setIsSaving(true);
        try {
            await adminCreateOrUpdateAllocation({
                event_day_id: eventDayId,
                team_id: teamId,
                allocated_count: parseInt(allocatedCount)
            });
            setTeamId('');
            setAllocatedCount('');
            queryClient.invalidateQueries({ queryKey: ['adminAllocations', eventDayId] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to save allocation');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, teamName: string) => {
        if (!confirm(`Revoke allocation for ${teamName}?`)) return;
        try {
            await adminDeleteAllocation(id);
            queryClient.invalidateQueries({ queryKey: ['adminAllocations', eventDayId] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to delete allocation');
        }
    };

    return (
        <div className="mt-4 p-4 bg-purple-50 dark:bg-gray-700/50 rounded-lg border border-purple-200 dark:border-gray-600">
            <h4 className="font-bold text-sffl-navy dark:text-white mb-4">🎟️ Team Allocations for {eventDayTitle}</h4>

            {loadingAllocations ? (
                <p className="text-sm text-gray-500">Loading allocations...</p>
            ) : (
                <div className="space-y-4">
                    {allocations.length > 0 ? (
                        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {allocations.map(a => (
                                <div key={a.id} className="bg-white dark:bg-gray-700 p-3 rounded-md shadow-sm border border-gray-100 dark:border-gray-600 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-sm dark:text-white">{a.team_name || 'Unknown Team'}</p>
                                        <p className="text-xs text-gray-500">{a.allocated_count} Tickets Allocated</p>
                                    </div>
                                    <button onClick={() => handleDelete(a.id, a.team_name || '')} className="text-red-500 hover:text-red-700 p-2 min-h-[44px] min-w-[44px] transition-all duration-300 hover:scale-[1.02] active:scale-95 flex flex-col justify-center items-center">
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No teams have been allocated tickets for this event day.</p>
                    )}

                    {/* Add/Update Form */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-purple-200 dark:border-gray-600">
                        <select
                            value={teamId}
                            onChange={e => setTeamId(e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm flex-1 min-h-[44px] z-50"
                        >
                            <option value="" className="truncate">Select a Team...</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id} className="truncate">{t.name}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            min="1"
                            value={allocatedCount}
                            onChange={e => setAllocatedCount(e.target.value)}
                            placeholder="Ticket Count"
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm w-32 min-h-[44px]"
                        />
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !teamId || !allocatedCount}
                            className="bg-sffl-navy text-white px-4 py-2 min-h-[44px] rounded-lg text-sm font-bold shadow hover:bg-blue-900 disabled:opacity-50 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                        >
                            {isSaving ? 'Saving...' : 'Set Allocation'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
