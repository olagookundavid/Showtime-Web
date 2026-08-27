import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    getMatches, getCompetitions, getTeams, getTeamsByCompetition,
    createMatch, updateMatch, deleteMatch,
    type Match, type Competition, type Team, type CreateMatchPayload,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { AdminTeamSheetModal } from '../../components/admin/AdminTeamSheetModal';
import { AdminKnockoutBracket } from '../../components/admin/AdminKnockoutBracket';
import { KNOCKOUT_STAGES } from '../../components/matches/BracketView';

interface FormData {
    competition_id: string;
    home_team_id: string;
    away_team_id: string;
    date: string;
    start_time: string;
    venue: string;
    status: string;
    home_score: string;
    away_score: string;
    highlights_url: string;
    ticket_url: string;
    round: string;
    bracket_pos: string;
    feeds_match_id: string;
    feeds_slot: string;
    second_leg_match_id: string;
}

const emptyForm: FormData = {
    competition_id: '', home_team_id: '', away_team_id: '',
    date: '', start_time: '12:00', venue: 'Showtime Arena', status: 'FINISHED',
    home_score: '', away_score: '', highlights_url: '', ticket_url: '',
    round: '', bracket_pos: '', feeds_match_id: '', feeds_slot: 'HOME',
    second_leg_match_id: '',
};


export const AdminMatches = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [teamSheetMatch, setTeamSheetMatch] = useState<Match | null>(null);

    // Filters
    const [filterComp, setFilterComp] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const { data: compsData, isLoading: loadingComps } = useQuery({
        queryKey: ['adminCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });

    const { data: teamsData, isLoading: loadingTeams } = useQuery({
        queryKey: ['adminTeamsList'],
        queryFn: () => getTeams(1, 100),
    });

    // Knockout comps swap the date-grouped table for the bracket builder,
    // which needs the whole bracket at once (no pagination).
    const isKnockout = (compsData?.data || []).find(c => c.id === filterComp)?.format === 'KNOCKOUT';

    const { data: matchesData, isLoading: loadingMatches } = useQuery({
        queryKey: ['adminMatches', { comp: filterComp, page, search: searchTerm, knockout: isKnockout }],
        queryFn: async () => {
            const data = await getMatches(
                filterComp || undefined,
                isKnockout ? 1 : page,
                isKnockout ? 100 : PAGE_SIZE,
                undefined,
                isKnockout ? undefined : searchTerm,
            );
            return Array.isArray(data) ? { data, total_pages: 1 } : data;
        },
    });

    // All matches of the form's competition, for the "winner advances to" picker.
    const { data: bracketMatchesData } = useQuery({
        queryKey: ['bracketTargets', form.competition_id],
        queryFn: () => getMatches(form.competition_id, 1, 100),
        enabled: showModal && !!form.competition_id,
    });

    // Auto-select first competition when loaded
    useEffect(() => {
        const comps = (compsData?.data || []).filter(c => c.status !== 'inactive');
        if (comps.length > 0 && !filterComp) {
            setFilterComp(comps[0].id);
        }
    }, [compsData, filterComp]);

    const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

    const toggleDateCollapse = (date: string) => {
        setCollapsedDates(prev => ({
            ...prev,
            [date]: !prev[date]
        }));
    };

    const competitions: Competition[] = (compsData?.data || []).filter(c => c.status !== 'inactive');
    const selectedCompData = competitions.find(c => c.id === filterComp);
    const isCompleted = selectedCompData?.status === 'completed';
    const formComp = (compsData?.data || []).find(c => c.id === form.competition_id);
    const formIsKnockout = formComp?.format === 'KNOCKOUT';
    const bracketTargets: Match[] = (bracketMatchesData?.data || []).filter(m => m.id !== editingId);

    // teams must be declared FIRST — compScopedTeams and activeTeamsForForm depend on it.
    const teams: Team[] = (teamsData?.data || []).filter((t: Team) => t.status !== 'inactive');
    const matches: Match[] = matchesData?.data || [];
    const totalPages = matchesData?.total_pages || 1;
    const loading = loadingComps || loadingTeams || loadingMatches;

    // Scope the team picker to competition-enrolled teams so only valid teams appear.
    // Falls back to all teams if the competition has no enrolled teams yet.
    const { data: compScopedTeamsData } = useQuery({
        queryKey: ['adminCompScopedTeams', form.competition_id],
        queryFn: () => getTeamsByCompetition(form.competition_id),
        enabled: !!form.competition_id,
    });
    const compScopedTeams: Team[] = (
        Array.isArray(compScopedTeamsData?.data)
            ? compScopedTeamsData.data
            : Array.isArray(compScopedTeamsData)
                ? compScopedTeamsData
                : []
    ).filter((t: Team) => t.status !== 'inactive');
    const activeTeamsForForm = form.competition_id && compScopedTeams.length > 0 ? compScopedTeams : teams;
    const selectableTeams = (_current: string): Team[] => activeTeamsForForm;

    const groupedMatches = matches.reduce((acc: Record<string, Match[]>, match: Match) => {
        const dateStr = match.date.substring(0, 10);
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(match);
        return acc;
    }, {});

    const handleFilterChange = (compId: string) => {
        setFilterComp(compId);
        setPage(1);
    };

    const openCreate = (round?: string) => {
        setEditingId(null);
        setForm({
            ...emptyForm,
            competition_id: filterComp,
            round: round || '',
        });
        setShowModal(true);
    };

    const openEdit = (m: Match) => {
        console.log('Editing match:', m);
        setEditingId(m.id);

        const compId = m.competition?.id || (m as any).competition_id ||
            (compsData?.data || []).find(c => c.name === m.competition?.name)?.id || '';

        const homeId = m.home_team?.id || (m as any).home_team_id ||
            teams.find(t => t.name === m.home_team?.name)?.id || '';

        const isBye = m.status === 'FINISHED' && ((m.home_team?.id && !m.away_team?.id) || (!m.home_team?.id && m.away_team?.id));
        const awayId = isBye ? 'BYE' : (m.away_team?.id || (m as any).away_team_id ||
            teams.find(t => t.name === m.away_team?.name)?.id || '');

        // Robust time parsing
        let displayTime = m.start_time || '';
        if (displayTime.includes('T')) {
            // It's a full ISO string
            displayTime = displayTime.split('T')[1].slice(0, 5);
        }
        if (displayTime === '00:00:00' || displayTime === '00:00') {
            displayTime = '';
        }

        setForm({
            competition_id: compId,
            home_team_id: homeId,
            away_team_id: awayId,
            date: m.date ? m.date.slice(0, 10) : '',
            start_time: displayTime,
            venue: m.venue || '',
            status: m.status,
            home_score: m.home_score?.toString() ?? '',
            away_score: m.away_score?.toString() ?? '',
            highlights_url: m.highlights_url || '',
            ticket_url: m.ticket_url || '',
            round: m.round || '',
            bracket_pos: m.bracket_pos?.toString() ?? '',
            feeds_match_id: m.feeds_match_id || '',
            feeds_slot: m.feeds_slot || 'HOME',
            second_leg_match_id: m.second_leg_match_id || '',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        const isBye = formIsKnockout && (form.away_team_id === 'BYE' || (form.home_team_id && !form.away_team_id && form.status === 'FINISHED'));
        if (form.status === 'FINISHED' && !isBye && (form.home_score === '' || form.away_score === '')) {
            toast.error('Home and Away scores are required for finished matches');
            return;
        }
        if (!formIsKnockout && (!form.home_team_id || !form.away_team_id)) {
            toast.error('Home and Away teams are required');
            return;
        }
        if (formIsKnockout && !form.round) {
            toast.error('Pick the stage (Wildcard, Playoff 1, Playoff 2 or Bowl)');
            return;
        }


        setSaving(true);
        try {
            const saveAwayId = form.away_team_id === 'BYE' ? '' : form.away_team_id;
            const saveStatus = form.away_team_id === 'BYE' ? 'FINISHED' : form.status;
            const saveHomeScore = form.away_team_id === 'BYE' ? null : (form.home_score !== '' ? parseInt(form.home_score) : null);
            const saveAwayScore = form.away_team_id === 'BYE' ? null : (form.away_score !== '' ? parseInt(form.away_score) : null);

            const payload: CreateMatchPayload = {
                competition_id: form.competition_id,
                home_team_id: form.home_team_id,
                away_team_id: saveAwayId,
                date: form.date,
                start_time: form.start_time,
                venue: form.venue,
                status: saveStatus,
                home_score: saveHomeScore,
                away_score: saveAwayScore,
                highlights_url: form.highlights_url,
                ticket_url: form.ticket_url,
                round: formIsKnockout ? form.round : undefined,
                bracket_pos: formIsKnockout && form.bracket_pos !== '' ? parseInt(form.bracket_pos) : null,
                feeds_match_id: formIsKnockout && form.feeds_match_id ? form.feeds_match_id : null,
                feeds_slot: formIsKnockout && form.feeds_match_id ? form.feeds_slot : undefined,
                second_leg_match_id: formIsKnockout && form.second_leg_match_id ? form.second_leg_match_id : null,
            };
            if (editingId) {
                await updateMatch(editingId, payload);
                toast.success('Match updated successfully');
            } else {
                await createMatch(payload);
                toast.success('Match created successfully');
            }
            queryClient.invalidateQueries({ queryKey: ['adminMatches'] });
            setShowModal(false);
        } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to save match');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteMatch(id);
            queryClient.invalidateQueries({ queryKey: ['adminMatches'] });
            setDeleteConfirm(null);
            toast.success('Match deleted successfully');
        } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to delete match');
        }
    };

    const set = (field: keyof FormData, value: string) => setForm(p => ({ ...p, [field]: value }));

    const statusColors: Record<string, string> = {
        SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        LIVE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        FINISHED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        POSTPONED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    };


    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
    };

    return (
        <div className="space-y-6">
            {/* Header with filter */}
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Match Management</h1>
                <div className="flex flex-wrap items-center gap-3">
                    {!isKnockout && (
                        <form onSubmit={handleSearchSubmit} className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Search matches..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-[44px] z-50 font-semibold text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[200px]"
                            />
                        </form>
                    )}
                    {isKnockout && (
                        <span className="px-2.5 py-1.5 rounded-lg bg-sffl-navy/10 text-sffl-navy dark:bg-gray-700 dark:text-gray-200 text-xs font-black uppercase tracking-wider">
                            Knockout Bracket
                        </span>
                    )}
                    <select
                        value={filterComp}
                        onChange={e => handleFilterChange(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-[44px] z-50 font-semibold text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        {competitions.map(c => <option key={c.id} value={c.id} className="truncate">{c.name}</option>)}
                    </select>
                    <button
                        onClick={() => openCreate()}
                        disabled={isCompleted}
                        className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        + Add Match
                    </button>
                </div>
            </div>

            {isCompleted && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4 flex items-center gap-3 text-amber-800 dark:text-amber-400 font-bold text-sm">
                    <span>🔒</span>
                    <span>Season Completed. Matches are locked and cannot be modified.</span>
                </div>
            )}

            {loading ? (
                <Loader />
            ) : isKnockout ? (
                <AdminKnockoutBracket
                    competitionId={filterComp}
                    matches={matches}
                    isCompleted={isCompleted}
                    onAdd={(stage?: string) => openCreate(stage)}
                    onEdit={openEdit}
                    onDelete={id => setDeleteConfirm(id)}
                    onTeamSheet={m => setTeamSheetMatch(m)}
                />
            ) : matches.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 p-12 rounded-xl text-center shadow-sm">
                    <p className="text-gray-500 font-semibold mb-2">No matches found.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(groupedMatches).map(([dateStr, dayMatches]) => (
                        <div key={dateStr} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => toggleDateCollapse(dateStr)}
                                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-600"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-gray-500 dark:text-gray-400 text-lg">
                                        {new Date(dateStr).getFullYear()}
                                    </span>
                                    <div className="bg-sffl-navy text-white w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold">
                                        <span className="text-xs tracking-wider uppercase">{new Date(dateStr).toLocaleString('default', { month: 'short' })}</span>
                                        <span className="text-sm leading-none">{new Date(dateStr).getDate()}</span>
                                    </div>
                                    <span className="font-bold text-gray-800 dark:text-gray-200 text-lg">
                                        {new Date(dateStr).toLocaleDateString('default', { weekday: 'long' })}
                                    </span>
                                </div>
                                <div className="text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 w-8 h-8 rounded-full flex items-center justify-center shadow-sm">
                                    <svg className={`w-5 h-5 transition-transform duration-200 ${collapsedDates[dateStr] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </button>

                            {!collapsedDates[dateStr] && (
                                <div className="p-0 overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                                                <th className="px-4 py-3 font-semibold w-24">Date</th>
                                                <th className="px-4 py-3 font-semibold">Match</th>
                                                <th className="px-4 py-3 font-semibold">Score</th>
                                                <th className="px-4 py-3 font-semibold">Status</th>
                                                <th className="px-4 py-3 font-semibold">Competition</th>
                                                <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dayMatches.map((m: Match) => (
                                                <tr key={m.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm">
                                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">
                                                        {(!m.start_time || m.start_time.includes('T00:00:00') || m.start_time === '00:00:00' || m.start_time === '00:00') 
                                                            ? 'TBD' 
                                                            : (m.start_time.includes('T') ? m.start_time.split('T')[1].slice(0, 5) : m.start_time)}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100 uppercase">
                                                        {m.home_team?.short_name || 'TBD'} vs {m.away_team?.short_name || 'TBD'}
                                                        {m.round && (
                                                            <span className="ml-2 px-1.5 py-0.5 rounded bg-sffl-navy/10 text-sffl-navy dark:bg-gray-700 dark:text-gray-200 text-[10px] font-bold tracking-wide normal-case">
                                                                {m.round}
                                                            </span>
                                                        )}
                                                        {m.second_leg_match_id && (
                                                            <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 text-[10px] font-bold tracking-wide normal-case">
                                                                2L
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
                                                        {m.status === 'FINISHED' ? `${m.home_score} - ${m.away_score}` : '—'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wide ${statusColors[m.status] || 'bg-gray-100 min-w-16 dark:bg-gray-600 dark:text-gray-300'}`}>
                                                            {m.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                                        {m.competition?.name || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {!isCompleted ? (
                                                                  <>
                                                                    <button onClick={() => setTeamSheetMatch(m)} className="px-2.5 py-1 bg-sffl-navy/10 text-sffl-navy hover:bg-sffl-navy hover:text-white dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 font-bold text-xs rounded-md shadow-sm transition-all">Team Sheet</button>
                                                                    <button onClick={() => openEdit(m)} className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-md shadow-sm transition-all border border-gray-200 dark:border-gray-600">Edit</button>
                                                                    <button onClick={() => setDeleteConfirm(m.id)} className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/50 font-bold text-xs rounded-md shadow-sm transition-all">Delete</button>
                                                                </>
                                                            ) : (
                                                                <span className="text-gray-400 dark:text-gray-600 text-xs font-semibold">Locked</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-8 pt-4">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
                            <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">{editingId ? 'Edit Match' : 'Add Match'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl font-bold p-1">✕</button>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Competition *</label>
                                    <select value={form.competition_id} onChange={e => set('competition_id', e.target.value)} className="w-full min-h-[44px] z-50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-sffl-red">
                                        <option value="" className="truncate">Select...</option>
                                        {(compsData?.data || []).filter(c => c.status !== 'inactive' || c.id === form.competition_id).map(c => <option key={c.id} value={c.id} className="truncate">{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                    <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full min-h-[44px] z-50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                        {['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED'].map(s => <option key={s} value={s} className="truncate">{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{formIsKnockout ? 'Home Team' : 'Home Team *'}</label>
                                    <select value={form.home_team_id} onChange={e => set('home_team_id', e.target.value)} className="w-full min-h-[44px] z-50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                        <option value="" className="truncate">{formIsKnockout ? 'TBD — filled by bracket' : 'Select...'}</option>
                                        {selectableTeams(form.home_team_id).map(t => <option key={t.id} value={t.id} className="truncate">{t.name.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{formIsKnockout ? 'Away Team' : 'Away Team *'}</label>
                                    <select value={form.away_team_id} onChange={e => set('away_team_id', e.target.value)} className="w-full min-h-[44px] z-50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                        <option value="" className="truncate">{formIsKnockout ? 'TBD — filled by bracket' : 'Select...'}</option>
                                        {formIsKnockout && <option value="BYE">BYE (PLAYOFF BYE)</option>}
                                        {selectableTeams(form.away_team_id).map(t => <option key={t.id} value={t.id} className="truncate">{t.name.toUpperCase()}</option>)}
                                    </select>
                                </div>
                            </div>

                            {formIsKnockout && (
                                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4 space-y-4">
                                    <div className="text-xs font-black text-sffl-navy dark:text-gray-200 uppercase tracking-widest">Bracket Setup</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Stage *</label>
                                            <select value={form.round} onChange={e => set('round', e.target.value)}
                                                className="w-full min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                                <option value="">Select stage…</option>
                                                {KNOCKOUT_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Order in Stage</label>
                                            <input type="number" min="1" value={form.bracket_pos} onChange={e => set('bracket_pos', e.target.value)}
                                                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="1 = top of the column" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Second Leg Match (Optional)</label>
                                        <select value={form.second_leg_match_id} onChange={e => set('second_leg_match_id', e.target.value)}
                                            className="w-full min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                            <option value="">None</option>
                                            {bracketTargets.map(m => (
                                                <option key={m.id} value={m.id} className="truncate">
                                                    {(m.round ? `${m.round}: ` : '') + (m.home_team?.short_name || 'TBD') + ' vs ' + (m.away_team?.short_name || 'TBD') + ` (${m.date.substring(0, 10)})`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <details className="text-sm">
                                        <summary className="cursor-pointer text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Auto-advance (optional — for live brackets)</summary>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Winner Advances To</label>
                                                <select value={form.feeds_match_id} onChange={e => set('feeds_match_id', e.target.value)}
                                                    className="w-full min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                                    <option value="">None</option>
                                                    {bracketTargets.map(m => (
                                                        <option key={m.id} value={m.id} className="truncate">
                                                            {(m.round ? `${m.round}: ` : '') + (m.home_team?.short_name || 'TBD') + ' vs ' + (m.away_team?.short_name || 'TBD') + ` (${m.date.substring(0, 10)})`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className={form.feeds_match_id ? '' : 'opacity-40 pointer-events-none'}>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">As</label>
                                                <select value={form.feeds_slot} onChange={e => set('feeds_slot', e.target.value)}
                                                    className="w-full min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                                    <option value="HOME">Home team</option>
                                                    <option value="AWAY">Away team</option>
                                                </select>
                                            </div>
                                        </div>
                                    </details>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                        Pick the stage and set Home/Away yourself. The bracket arranges matches by stage — a two-legged tie is just two matches tagged the same stage. Auto-advance is only needed for live single-leg brackets.
                                    </p>
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                                    <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Kick-off Time</label>
                                    <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Venue</label>
                                    <input type="text" value={form.venue} onChange={e => set('venue', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="e.g. SFFL Arena" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Home Score</label>
                                    <input type="number" value={form.home_score} onChange={e => set('home_score', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Away Score</label>
                                    <input type="number" value={form.away_score} onChange={e => set('away_score', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="0" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Highlights URL</label>
                                <input type="url" value={form.highlights_url} onChange={e => set('highlights_url', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="https://..." />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Ticket URL</label>
                                <input type="url" value={form.ticket_url} onChange={e => set('ticket_url', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="https://..." />
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex justify-end gap-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-2">Delete Match?</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">This action cannot be undone.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 min-h-[44px] bg-red-600 text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Sheet Modal */}
            {teamSheetMatch && (
                <AdminTeamSheetModal
                    match={teamSheetMatch}
                    onClose={() => setTeamSheetMatch(null)}
                />
            )}
        </div>
    );
};
