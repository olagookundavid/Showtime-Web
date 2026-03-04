import { Loader } from '../../components/ui/Loader';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { DataTable, type Column } from '../../components/ui/DataTable';
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
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Filters
    const [filterComp, setFilterComp] = useState('');

    const { data: compsData, isLoading: loadingComps } = useQuery({
        queryKey: ['adminCompetitions'],
        queryFn: () => getCompetitions(1, 20),
    });

    const { data: teamsData, isLoading: loadingTeams } = useQuery({
        queryKey: ['adminTeamsList'],
        queryFn: () => getTeams(1, 20),
    });

    const { data: matchesData, isLoading: loadingMatches } = useQuery({
        queryKey: ['adminMatches', { comp: filterComp }],
        queryFn: async () => {
            const data = await getMatches(filterComp || undefined, 1, 20);
            return Array.isArray(data) ? { data, total_pages: 1 } : data;
        },
    });

    const competitions: Competition[] = compsData?.data || [];
    const teams: Team[] = teamsData?.data || [];
    const matches: Match[] = matchesData?.data || [];
    const loading = loadingComps || loadingTeams || loadingMatches;

    const handleFilterChange = (compId: string) => {
        setFilterComp(compId);
    };

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };

    const openEdit = (m: Match) => {
        setEditingId(m.id);
        setForm({
            competition_id: m.competition?.id || '',
            home_team_id: m.home_team?.id || '',
            away_team_id: m.away_team?.id || '',
            date: m.date,
            start_time: m.start_time ? new Date(m.start_time).toISOString().slice(0, 16) : '',
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
                start_time: form.start_time ? new Date(form.start_time).toISOString() : '',
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

    const columns: Column<Match>[] = [
        { header: 'Date', accessor: 'date', sortable: true, className: "px-4 py-3 text-sm dark:text-gray-300 w-24" },
        {
            header: 'Match',
            sortable: true,
            sortValue: (m) => `${m.home_team?.short_name} vs ${m.away_team?.short_name}`,
            cell: (m) => <span className="font-semibold text-sm text-gray-900 dark:text-white">{m.home_team?.short_name || 'TBD'} vs {m.away_team?.short_name || 'TBD'}</span>
        },
        {
            header: 'Score',
            sortable: true,
            sortValue: (m) => `${m.home_score} - ${m.away_score}`,
            cell: (m) => <span className="text-sm font-bold dark:text-gray-300">{m.status === 'FINISHED' ? `${m.home_score} - ${m.away_score}` : '—'}</span>
        },
        {
            header: 'Status',
            accessor: 'status',
            sortable: true,
            cell: (m) => <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[m.status] || 'bg-gray-100 dark:bg-gray-600 dark:text-gray-300'}`}>{m.status}</span>
        },
        {
            header: 'Competition',
            sortable: true,
            sortValue: (m) => m.competition?.name || '',
            cell: (m) => <span className="text-sm dark:text-gray-300">{m.competition?.name || '—'}</span>
        },
        {
            header: 'Actions',
            className: "px-4 py-3 text-right space-x-2 w-48",
            cell: (m) => (
                <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(m)} className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 font-bold text-xs rounded-md shadow-sm hover:shadow-md transition-all">Edit</button>
                    <button onClick={() => setDeleteConfirm(m.id)} className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 font-bold text-xs rounded-md shadow-sm hover:shadow-md transition-all">Delete</button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            {/* Header with filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Match Management</h1>
                <div className="flex items-center gap-3">
                    <select
                        value={filterComp}
                        onChange={e => handleFilterChange(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 font-semibold text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="">All Competitions</option>
                        {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={openCreate} className="px-3 py-1.5 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all whitespace-nowrap">+ Add Match</button>
                </div>
            </div>

            {loading ? (
                <Loader />
            ) : (
                <DataTable data={matches} columns={columns} searchable={true} searchPlaceholder="Search matches..." itemsPerPage={10} />
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-2xl font-black text-sffl-navy dark:text-white">{editingId ? 'Edit Match' : 'Add Match'}</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Competition *</label>
                                    <select value={form.competition_id} onChange={e => set('competition_id', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                        <option value="">Select...</option>
                                        {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                    <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                        {['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Home Team *</label>
                                    <select value={form.home_team_id} onChange={e => set('home_team_id', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                        <option value="">Select...</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Away Team *</label>
                                    <select value={form.away_team_id} onChange={e => set('away_team_id', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                        <option value="">Select...</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                                    <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Kick-off Time *</label>
                                    <input type="datetime-local" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Venue</label>
                                    <input type="text" value={form.venue} onChange={e => set('venue', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="e.g. SFFL Arena" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
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
                            <button onClick={() => setShowModal(false)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition disabled:opacity-50">
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
                            <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-3 py-1.5 bg-red-600 text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
