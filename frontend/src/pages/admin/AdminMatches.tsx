import { Loader } from '../../components/ui/Loader';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import {
    getMatches, getCompetitions, getTeams,
    createMatch, updateMatch, deleteMatch,
    type Match, type Competition, type Team, type CreateMatchPayload,
} from '../../services/api';

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
}

const emptyForm: FormData = {
    competition_id: '', home_team_id: '', away_team_id: '',
    date: '', start_time: '', venue: '', status: 'SCHEDULED',
    home_score: '', away_score: '', highlights_url: '', ticket_url: '',
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

    // Filters
    const [filterComp, setFilterComp] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const { data: compsData, isLoading: loadingComps } = useQuery({
        queryKey: ['adminCompetitions'],
        queryFn: () => getCompetitions(1, 100, 'active'),
    });

    const { data: teamsData, isLoading: loadingTeams } = useQuery({
        queryKey: ['adminTeamsList'],
        queryFn: () => getTeams(1, 100),
    });

    const { data: matchesData, isLoading: loadingMatches } = useQuery({
        queryKey: ['adminMatches', { comp: filterComp, page, search: searchTerm }],
        queryFn: async () => {
            const data = await getMatches(filterComp || undefined, page, PAGE_SIZE, undefined, searchTerm);
            return Array.isArray(data) ? { data, total_pages: 1 } : data;
        },
    });

    // Auto-select first competition when loaded
    useEffect(() => {
        const comps = compsData?.data || [];
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

    const competitions: Competition[] = compsData?.data || [];
    const teams: Team[] = teamsData?.data || [];
    const matches: Match[] = matchesData?.data || [];
    const totalPages = matchesData?.total_pages || 1;
    const loading = loadingComps || loadingTeams || loadingMatches;

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

    const openCreate = () => { setEditingId(null); setForm({...emptyForm, competition_id: filterComp}); setShowModal(true); };

    const openEdit = (m: Match) => {
        console.log('Editing match:', m);
        setEditingId(m.id);

        // Smart lookup for IDs if they are missing but names are present
        const compId = m.competition?.id || (m as any).competition_id ||
            competitions.find(c => c.name === m.competition?.name)?.id || '';

        const homeId = m.home_team?.id || (m as any).home_team_id ||
            teams.find(t => t.name === m.home_team?.name)?.id || '';

        const awayId = m.away_team?.id || (m as any).away_team_id ||
            teams.find(t => t.name === m.away_team?.name)?.id || '';

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
            date: m.date,
            start_time: displayTime,
            venue: m.venue || '',
            status: m.status,
            home_score: m.home_score?.toString() ?? '',
            away_score: m.away_score?.toString() ?? '',
            highlights_url: m.highlights_url || '',
            ticket_url: m.ticket_url || '',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: CreateMatchPayload = {
                competition_id: form.competition_id,
                home_team_id: form.home_team_id,
                away_team_id: form.away_team_id,
                date: form.date,
                start_time: form.start_time,
                venue: form.venue,
                status: form.status,
                home_score: form.home_score !== '' ? parseInt(form.home_score) : null,
                away_score: form.away_score !== '' ? parseInt(form.away_score) : null,
                highlights_url: form.highlights_url,
                ticket_url: form.ticket_url,
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
        } catch (err: any) {
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
        } catch (err: any) {
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
                    <form onSubmit={handleSearchSubmit} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Search matches..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-[44px] z-50 font-semibold text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[200px]"
                        />
                    </form>
                    <select
                        value={filterComp}
                        onChange={e => handleFilterChange(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-[44px] z-50 font-semibold text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        {competitions.map(c => <option key={c.id} value={c.id} className="truncate">{c.name}</option>)}
                    </select>
                    <button onClick={openCreate} className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 whitespace-nowrap">+ Add Match</button>
                </div>
            </div>

            {loading ? (
                <Loader />
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
                                                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
                                                        {m.home_team?.short_name || 'TBD'} vs {m.away_team?.short_name || 'TBD'}
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
                                                            <button onClick={() => openEdit(m)} className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 font-bold text-xs rounded-md shadow-sm transition-all">Edit</button>
                                                            <button onClick={() => setDeleteConfirm(m.id)} className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 font-bold text-xs rounded-md shadow-sm transition-all">Delete</button>
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-2xl font-black text-sffl-navy dark:text-white">{editingId ? 'Edit Match' : 'Add Match'}</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Competition *</label>
                                    <select value={form.competition_id} onChange={e => set('competition_id', e.target.value)} className="w-full min-h-[44px] z-50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-sffl-red">
                                        <option value="" className="truncate">Select...</option>
                                        {competitions.map(c => <option key={c.id} value={c.id} className="truncate">{c.name}</option>)}
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
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Home Team *</label>
                                    <select value={form.home_team_id} onChange={e => set('home_team_id', e.target.value)} className="w-full min-h-[44px] z-50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                        <option value="" className="truncate">Select...</option>
                                        {teams.map(t => <option key={t.id} value={t.id} className="truncate">{t.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Away Team *</label>
                                    <select value={form.away_team_id} onChange={e => set('away_team_id', e.target.value)} className="w-full min-h-[44px] z-50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                        <option value="" className="truncate">Select...</option>
                                        {teams.map(t => <option key={t.id} value={t.id} className="truncate">{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
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
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl max-w-sm w-full">
                        <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-2">Delete Match?</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">This action cannot be undone.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 min-h-[44px] bg-red-600 text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
