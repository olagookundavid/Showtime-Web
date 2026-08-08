import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    getCompetitions,
    getTeamsByCompetition,
    getTeams,
    addTeamToCompetition,
    removeTeamFromCompetition,
    type Team,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { LightboxImage } from '../../components/ui';

export const AdminCompetitionTeams = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [adding, setAdding] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    // Fetch competition details (use a distinct key to avoid colliding with
    // AdminCompetitions which uses 'adminCompetitions' + getAdminCompetitions)
    const { data: competitionsData, isLoading: loadingComp } = useQuery({
        queryKey: ['publicCompetitionsList'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competition = (competitionsData?.data || []).find(c => c.id === id);

    // Fetch enrolled teams
    const { data: compTeamsData, isLoading: loadingCompTeams } = useQuery({
        queryKey: ['competitionTeams', id],
        queryFn: () => getTeamsByCompetition(id!),
        enabled: !!id,
    });
    const enrolledTeams: Team[] = compTeamsData?.data || compTeamsData || [];

    // Fetch all teams
    const { data: allTeamsData, isLoading: loadingAllTeams } = useQuery({
        queryKey: ['adminTeamsAll'],
        queryFn: () => getTeams(1, 100),
    });
    const allTeams: Team[] = allTeamsData?.data || [];

    const enrolledIds = new Set(enrolledTeams.map(t => t.id));
    const availableTeams = allTeams.filter(t => !enrolledIds.has(t.id));

    const handleAddTeam = async () => {
        if (!selectedTeamId || !id) return;
        setAdding(true);
        try {
            await addTeamToCompetition(id, selectedTeamId);
            toast.success('Team added to competition');
            setSelectedTeamId('');
            queryClient.invalidateQueries({ queryKey: ['competitionTeams', id] });
            queryClient.invalidateQueries({ queryKey: ['publicCompetitions'] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to add team');
        } finally {
            setAdding(false);
        }
    };

    const handleRemoveTeam = async (teamId: string, teamName: string) => {
        if (!id) return;
        setRemovingId(teamId);
        try {
            await removeTeamFromCompetition(id, teamId);
            toast.success(`Removed ${teamName} from competition`);
            queryClient.invalidateQueries({ queryKey: ['competitionTeams', id] });
            queryClient.invalidateQueries({ queryKey: ['publicCompetitions'] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Cannot remove team');
        } finally {
            setRemovingId(null);
        }
    };

    if (loadingComp || loadingCompTeams || loadingAllTeams) return <Loader />;

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <Link to="/admin/competitions" className="text-xs font-bold text-sffl-red hover:underline block mb-1">
                        ← Back to Competitions
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight flex items-center gap-3">
                        {competition?.logo && (
                            <img src={competition.logo} alt={competition.name} className="w-8 h-8 object-contain" />
                        )}
                        {competition?.name || 'Competition'} Teams
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Only enrolled teams appear in match scheduling and standings for this competition.
                    </p>
                </div>
            </div>

            {/* Add Team Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 space-y-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Add Team to Competition
                </h2>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <select
                        value={selectedTeamId}
                        onChange={e => setSelectedTeamId(e.target.value)}
                        className="flex-1 w-full min-h-[44px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none"
                    >
                        <option value="">Select a team to add…</option>
                        {availableTeams.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.name} ({t.short_name})
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={handleAddTeam}
                        disabled={!selectedTeamId || adding}
                        className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:bg-red-700 disabled:opacity-50 transition-all whitespace-nowrap"
                    >
                        {adding ? 'Adding…' : '+ Add Team'}
                    </button>
                </div>
                {availableTeams.length === 0 && (
                    <p className="text-xs text-gray-400 italic">All existing teams are already enrolled in this competition.</p>
                )}
            </div>

            {/* Enrolled Teams List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        Enrolled Teams ({enrolledTeams.length})
                    </h2>
                </div>

                {enrolledTeams.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 italic text-sm">
                        No teams added to this competition yet. Add teams using the form above.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {enrolledTeams.map(team => (
                            <div key={team.id} className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    {team.logo ? (
                                        <LightboxImage
                                            src={team.logo}
                                            alt={team.name}
                                            thumbnailClassName="w-10 h-10 object-contain rounded-lg p-0.5 bg-gray-50 border border-gray-100"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center font-black text-xs text-gray-500">
                                            {team.short_name?.slice(0, 2)}
                                        </div>
                                    )}
                                    <div>
                                        <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{team.name}</div>
                                        <div className="text-xs text-gray-400 font-semibold">{team.short_name}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveTeam(team.id, team.name)}
                                    disabled={removingId === team.id}
                                    className="px-3 py-1.5 min-h-[36px] bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {removingId === team.id ? 'Removing…' : 'Remove'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
