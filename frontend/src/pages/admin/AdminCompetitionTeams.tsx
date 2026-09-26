import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, PlusIcon, TrashIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import {
    getCompetitions,
    getTeamsByCompetition,
    getTeams,
    addTeamToCompetition,
    removeTeamFromCompetition,
    type Team,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { LightboxImage } from '../../components/ui';

// Adding and removing a team both go through the confirm dialog first.
type PendingAction = { kind: 'add'; team: Team } | { kind: 'remove'; team: Team };

export const AdminCompetitionTeams = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [adding, setAdding] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

    // Fetch competition details (use a distinct key to avoid colliding with
    // AdminCompetitions which uses 'adminCompetitions' + getAdminCompetitions)
    const { data: competitionsData, isLoading: loadingComp } = useQuery({
        queryKey: ['publicCompetitionsList'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competition = (Array.isArray(competitionsData?.data) ? competitionsData.data : []).find(c => c.id === id);

    // Fetch enrolled teams
    const { data: compTeamsData, isLoading: loadingCompTeams } = useQuery({
        queryKey: ['competitionTeams', id],
        queryFn: () => getTeamsByCompetition(id!),
        enabled: !!id,
    });
    const enrolledTeams: Team[] = Array.isArray(compTeamsData?.data)
        ? compTeamsData.data
        : Array.isArray(compTeamsData)
            ? compTeamsData
            : [];

    // Fetch all teams
    const { data: allTeamsData, isLoading: loadingAllTeams } = useQuery({
        queryKey: ['adminTeamsAll'],
        queryFn: () => getTeams(1, 100),
    });
    const allTeams: Team[] = (
        Array.isArray(allTeamsData?.data)
            ? allTeamsData.data
            : Array.isArray(allTeamsData)
                ? allTeamsData
                : []
    ).filter(t => t.status !== 'inactive');

    const enrolledIds = new Set(enrolledTeams.map(t => t.id));
    const availableTeams = allTeams.filter(t => !enrolledIds.has(t.id));

    const handleAddTeam = async (teamId: string) => {
        if (!teamId || !id) return;
        setAdding(true);
        try {
            await addTeamToCompetition(id, teamId);
            toast.success('Team added to competition');
            setSelectedTeamId('');
            queryClient.invalidateQueries({ queryKey: ['competitionTeams', id] });
            queryClient.invalidateQueries({ queryKey: ['publicCompetitions'] });
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to add team');
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
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Cannot remove team');
        } finally {
            setRemovingId(null);
        }
    };

    // Runs once the admin confirms. The handlers report their own errors, so the
    // dialog always closes afterwards.
    const confirmPendingAction = async () => {
        if (!pendingAction) return;
        if (pendingAction.kind === 'add') await handleAddTeam(pendingAction.team.id);
        else await handleRemoveTeam(pendingAction.team.id, pendingAction.team.name);
        setPendingAction(null);
    };

    if (loadingComp || loadingCompTeams || loadingAllTeams) return <Loader />;

    const competitionName = competition?.name || 'this competition';
    const selectedTeam = availableTeams.find(t => t.id === selectedTeamId);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="min-w-0">
                <Link to="/admin/competitions" className="inline-flex items-center gap-1 min-h-11 text-xs font-bold text-sffl-red hover:underline">
                    <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
                    Back to Competitions
                </Link>
                <h1 className="text-2xl md:text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight flex items-center gap-3 wrap-break-word">
                    {competition?.logo && (
                        <img src={competition.logo} alt={competition.name} className="w-8 h-8 shrink-0 object-contain" />
                    )}
                    <span className="min-w-0">{competition?.name || 'Competition'} Teams</span>
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Only enrolled teams appear in match scheduling and standings for this competition.
                </p>
            </div>

            {/* Add Team Card */}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 space-y-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Add Team to Competition
                </h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <select
                        aria-label="Team to add"
                        value={selectedTeamId}
                        onChange={e => setSelectedTeamId(e.target.value)}
                        className="flex-1 min-w-0 w-full min-h-11 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none"
                    >
                        <option value="">Select a team to add…</option>
                        {availableTeams.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.name} ({t.short_name})
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => selectedTeam && setPendingAction({ kind: 'add', team: selectedTeam })}
                        disabled={!selectedTeam || adding}
                        className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-6 py-2.5 min-h-11 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:bg-red-700 disabled:opacity-50 transition-all whitespace-nowrap"
                    >
                        <PlusIcon className="w-4 h-4" aria-hidden="true" />
                        Add Team
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
                            <div key={team.id} className="p-3 sm:p-4 flex items-center justify-between gap-3 sm:gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    {team.logo ? (
                                        <LightboxImage
                                            src={team.logo}
                                            alt={team.name}
                                            thumbnailClassName="w-10 h-10 object-contain rounded-lg p-0.5 bg-gray-50 border border-gray-100"
                                        />
                                    ) : (
                                        <div className="shrink-0 w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center font-black text-xs text-gray-500">
                                            {team.short_name?.slice(0, 2)}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm text-gray-900 dark:text-gray-100 wrap-break-word">{team.name}</div>
                                        <div className="text-xs text-gray-400 font-semibold truncate">{team.short_name}</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPendingAction({ kind: 'remove', team })}
                                    disabled={removingId === team.id}
                                    className="shrink-0 px-3 py-1.5 min-h-11 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={pendingAction !== null}
                title={pendingAction?.kind === 'remove' ? 'Remove this team from the competition?' : 'Add this team to the competition?'}
                description={pendingAction?.kind === 'remove'
                    ? 'It will no longer appear in match scheduling or standings for this competition.'
                    : 'It will appear in match scheduling and standings for this competition.'}
                body={pendingAction && (
                    <ConfirmSummary rows={[
                        ['Team', pendingAction.team.name],
                        ['Short name', pendingAction.team.short_name],
                        ['Competition', competitionName],
                    ]} />
                )}
                confirmLabel={pendingAction?.kind === 'remove' ? 'Remove Team' : 'Add Team'}
                tone={pendingAction?.kind === 'remove' ? 'warning' : 'info'}
                icon={pendingAction?.kind === 'remove' ? TrashIcon : UserPlusIcon}
                pending={adding || removingId !== null}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
            />
        </div>
    );
};
