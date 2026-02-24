import { useEffect, useState } from 'react';
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

const PAGE_SIZE = 10;

export const AdminMatches = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Filters & Pagination
    const [filterComp, setFilterComp] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchAll = async (p = page, comp = filterComp) => {
        setLoading(true);
        try {
            const [matchData, compData, teamData] = await Promise.all([
                getMatches(comp || undefined, p, PAGE_SIZE),
                competitions.length ? Promise.resolve(competitions) : getCompetitions(),
                teams.length ? Promise.resolve(teams) : getTeams(),
            ]);
            const result = Array.isArray(matchData) ? { data: matchData, total_pages: 1 } : matchData;
            setMatches(result.data || []);
            setTotalPages(result.total_pages || 1);
            if (!competitions.length) setCompetitions(compData as Competition[]);
            if (!teams.length) setTeams(teamData as Team[]);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    useEffect(() => { fetchAll(page, filterComp); }, [page, filterComp]);

    const handleFilterChange = (compId: string) => {
        setFilterComp(compId);
        setPage(1);
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
            if (editingId) await updateMatch(editingId, payload);
            else await createMatch(payload);
            setShowModal(false);
            await fetchAll(page, filterComp);
        } catch (err) { console.error(err); alert('Failed to save match'); }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteMatch(id);
            setDeleteConfirm(null);
            await fetchAll(page, filterComp);
        } catch (err) { console.error(err); alert('Failed to delete'); }
    };

    const set = (field: keyof FormData, value: string) => setForm(p => ({ ...p, [field]: value }));

    const statusColors: Record<string, string> = {
        SCHEDULED: 'bg-blue-100 text-blue-800',
        LIVE: 'bg-red-100 text-red-800',
        FINISHED: 'bg-green-100 text-green-800',
        POSTPONED: 'bg-yellow-100 text-yellow-800',
    };

    return (
        <div className="space-y-6">
            {/* Header with filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-3xl font-black text-sffl-navy">Match Management</h1>
                <div className="flex items-center gap-3">
                    <select
                        value={filterComp}
                        onChange={e => handleFilterChange(e.target.value)}
                        className="border rounded-lg px-3 py-2 font-semibold text-sm"
                    >
                        <option value="">All Competitions</option>
                        {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={openCreate} className="px-6 py-2.5 bg-sffl-red text-white font-bold rounded-lg hover:bg-red-700 transition whitespace-nowrap">+ Add Match</button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-sffl-red border-t-transparent rounded-full animate-spin" /></div>
            ) : (
                <>
                    <div className="bg-white rounded-xl shadow-md overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Match</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Score</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Competition</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {matches.map(m => (
                                    <tr key={m.id} className="hover:bg-gray-50 transition">
                                        <td className="px-4 py-3 text-sm">{m.date}</td>
                                        <td className="px-4 py-3 font-semibold text-sm">{m.home_team?.short_name || 'TBD'} vs {m.away_team?.short_name || 'TBD'}</td>
                                        <td className="px-4 py-3 text-sm font-bold">{m.status === 'FINISHED' ? `${m.home_score} - ${m.away_score}` : '—'}</td>
                                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[m.status] || 'bg-gray-100'}`}>{m.status}</span></td>
                                        <td className="px-4 py-3 text-sm">{m.competition?.name || '—'}</td>
                                        <td className="px-4 py-3 text-right space-x-2">
                                            <button onClick={() => openEdit(m)} className="text-blue-600 hover:text-blue-800 font-bold text-sm">Edit</button>
                                            <button onClick={() => setDeleteConfirm(m.id)} className="text-red-600 hover:text-red-800 font-bold text-sm">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {matches.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No matches found</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="px-4 py-2 border rounded-lg font-bold text-sm disabled:opacity-40 hover:bg-gray-50 transition"
                                >← Prev</button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                                    const p = start + i;
                                    if (p > totalPages) return null;
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className={`px-3 py-2 rounded-lg font-bold text-sm transition ${p === page ? 'bg-sffl-red text-white' : 'border hover:bg-gray-50'}`}
                                        >{p}</button>
                                    );
                                })}
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="px-4 py-2 border rounded-lg font-bold text-sm disabled:opacity-40 hover:bg-gray-50 transition"
                                >Next →</button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b">
                            <h2 className="text-2xl font-black text-sffl-navy">{editingId ? 'Edit Match' : 'Add Match'}</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Competition *</label>
                                    <select value={form.competition_id} onChange={e => set('competition_id', e.target.value)} className="w-full border rounded-lg px-3 py-2">
                                        <option value="">Select...</option>
                                        {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                                    <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full border rounded-lg px-3 py-2">
                                        {['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Home Team *</label>
                                    <select value={form.home_team_id} onChange={e => set('home_team_id', e.target.value)} className="w-full border rounded-lg px-3 py-2">
                                        <option value="">Select...</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Away Team *</label>
                                    <select value={form.away_team_id} onChange={e => set('away_team_id', e.target.value)} className="w-full border rounded-lg px-3 py-2">
                                        <option value="">Select...</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Date *</label>
                                    <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Kick-off Time *</label>
                                    <input type="datetime-local" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Venue</label>
                                    <input type="text" value={form.venue} onChange={e => set('venue', e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. SFFL Arena" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Home Score</label>
                                    <input type="number" value={form.home_score} onChange={e => set('home_score', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Away Score</label>
                                    <input type="number" value={form.away_score} onChange={e => set('away_score', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="0" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Highlights URL</label>
                                <input type="url" value={form.highlights_url} onChange={e => set('highlights_url', e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="https://..." />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Ticket URL</label>
                                <input type="url" value={form.ticket_url} onChange={e => set('ticket_url', e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="https://..." />
                            </div>
                        </div>
                        <div className="p-6 border-t flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2 border rounded-lg font-bold hover:bg-gray-50 transition">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-sffl-red text-white font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50">
                                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 shadow-2xl max-w-sm w-full">
                        <h3 className="text-lg font-bold text-sffl-navy mb-2">Delete Match?</h3>
                        <p className="text-gray-600 mb-6">This action cannot be undone.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border rounded-lg font-bold hover:bg-gray-50">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
