import { useEffect, useState } from 'react';
import {
    getPlayers, getTeams, createPlayer, updatePlayer, deletePlayer,
    type Player, type Team, type CreatePlayerPayload,
} from '../../services/api';

interface FormData {
    name: string;
    jersey_number: string;
    position: string;
    team_id: string;
    bio: string;
    image: string;
    touchdowns: string;
    yards: string;
    interceptions: string;
    tackles: string;
}

const emptyForm: FormData = {
    name: '', jersey_number: '', position: '', team_id: '',
    bio: '', image: '', touchdowns: '0', yards: '0', interceptions: '0', tackles: '0',
};

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];
const PAGE_SIZE = 15;

export const AdminPlayers = () => {
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Filters & Pagination (client-side)
    const [filterTeam, setFilterTeam] = useState('');
    const [page, setPage] = useState(1);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [playerData, teamData] = await Promise.all([getPlayers(), getTeams()]);
            setAllPlayers(playerData);
            setTeams(teamData);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, []);

    // Client-side filter + paginate
    const filtered = filterTeam
        ? allPlayers.filter(p => p.team?.id === filterTeam)
        : allPlayers;
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const players = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleFilterChange = (teamId: string) => {
        setFilterTeam(teamId);
        setPage(1);
    };

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };

    const openEdit = (p: Player) => {
        setEditingId(p.id);
        setForm({
            name: p.name,
            jersey_number: p.jersey_number?.toString() || '',
            position: p.position || '',
            team_id: p.team?.id || '',
            bio: p.bio || '',
            image: p.image || '',
            touchdowns: p.touchdowns?.toString() || '0',
            yards: p.yards?.toString() || '0',
            interceptions: p.interceptions?.toString() || '0',
            tackles: p.tackles?.toString() || '0',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: CreatePlayerPayload = {
                name: form.name,
                jersey_number: parseInt(form.jersey_number) || 0,
                position: form.position,
                team_id: form.team_id,
                bio: form.bio,
                image: form.image,
                touchdowns: parseInt(form.touchdowns) || 0,
                yards: parseInt(form.yards) || 0,
                interceptions: parseInt(form.interceptions) || 0,
                tackles: parseInt(form.tackles) || 0,
            };
            if (editingId) await updatePlayer(editingId, payload);
            else await createPlayer(payload);
            setShowModal(false);
            await fetchAll();
        } catch (err) { console.error(err); alert('Failed to save player'); }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await deletePlayer(id);
            setDeleteConfirm(null);
            await fetchAll();
        } catch (err) { console.error(err); alert('Failed to delete'); }
    };

    const set = (field: keyof FormData, value: string) => setForm(p => ({ ...p, [field]: value }));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-3xl font-black text-sffl-navy">Player Management</h1>
                <div className="flex items-center gap-3">
                    <select
                        value={filterTeam}
                        onChange={e => handleFilterChange(e.target.value)}
                        className="border rounded-lg px-3 py-2 font-semibold text-sm"
                    >
                        <option value="">All Teams</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button onClick={openCreate} className="px-6 py-2.5 bg-sffl-red text-white font-bold rounded-lg hover:bg-red-700 transition whitespace-nowrap">+ Add Player</button>
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
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">#</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Player</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Position</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Team</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">TDs</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Yards</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {players.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition">
                                        <td className="px-4 py-3 font-bold text-sm">{p.jersey_number}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {p.image && <img src={p.image} alt={p.name} className="w-8 h-8 rounded-full object-cover" />}
                                                <span className="font-semibold text-sm">{p.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3"><span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-bold">{p.position}</span></td>
                                        <td className="px-4 py-3 text-sm">{p.team?.name || '—'}</td>
                                        <td className="px-4 py-3 text-sm font-semibold">{p.touchdowns}</td>
                                        <td className="px-4 py-3 text-sm font-semibold">{p.yards}</td>
                                        <td className="px-4 py-3 text-right space-x-2">
                                            <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800 font-bold text-sm">Edit</button>
                                            <button onClick={() => setDeleteConfirm(p.id)} className="text-red-600 hover:text-red-800 font-bold text-sm">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {players.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No players found</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border rounded-lg font-bold text-sm disabled:opacity-40 hover:bg-gray-50 transition">← Prev</button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                                    const p = start + i;
                                    if (p > totalPages) return null;
                                    return (
                                        <button key={p} onClick={() => setPage(p)} className={`px-3 py-2 rounded-lg font-bold text-sm transition ${p === page ? 'bg-sffl-red text-white' : 'border hover:bg-gray-50'}`}>{p}</button>
                                    );
                                })}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-4 py-2 border rounded-lg font-bold text-sm disabled:opacity-40 hover:bg-gray-50 transition">Next →</button>
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
                            <h2 className="text-2xl font-black text-sffl-navy">{editingId ? 'Edit Player' : 'Add Player'}</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Name *</label>
                                    <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="Player name" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Jersey Number</label>
                                    <input type="number" value={form.jersey_number} onChange={e => set('jersey_number', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="0" max="99" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Position</label>
                                    <select value={form.position} onChange={e => set('position', e.target.value)} className="w-full border rounded-lg px-3 py-2">
                                        <option value="">Select...</option>
                                        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Team *</label>
                                    <select value={form.team_id} onChange={e => set('team_id', e.target.value)} className="w-full border rounded-lg px-3 py-2">
                                        <option value="">Select...</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Bio</label>
                                <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2" placeholder="Player bio..." />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Image URL</label>
                                <input type="url" value={form.image} onChange={e => set('image', e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="https://..." />
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">TDs</label>
                                    <input type="number" value={form.touchdowns} onChange={e => set('touchdowns', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Yards</label>
                                    <input type="number" value={form.yards} onChange={e => set('yards', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">INTs</label>
                                    <input type="number" value={form.interceptions} onChange={e => set('interceptions', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Tackles</label>
                                    <input type="number" value={form.tackles} onChange={e => set('tackles', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="0" />
                                </div>
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
                        <h3 className="text-lg font-bold text-sffl-navy mb-2">Delete Player?</h3>
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
