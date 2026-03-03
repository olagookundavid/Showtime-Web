import { Loader } from '../../components/ui/Loader';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    const queryClient = useQueryClient();

    const { data: allPlayersData, isLoading: loadingPlayers } = useQuery({
        queryKey: ['adminPlayers'],
        queryFn: () => getPlayers(),
    });

    const { data: teamsData, isLoading: loadingTeams } = useQuery({
        queryKey: ['adminTeamsList'], // distinct from paginated adminTeams
        queryFn: getTeams,
    });

    const allPlayers: Player[] = allPlayersData || [];
    const teams: Team[] = teamsData || [];
    const loading = loadingPlayers || loadingTeams;
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Filters & Pagination (client-side)
    const [filterTeam, setFilterTeam] = useState('');
    const [page, setPage] = useState(1);



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
            if (editingId) {
                await updatePlayer(editingId, payload);
            } else {
                await createPlayer(payload);
            }
            queryClient.invalidateQueries({ queryKey: ['adminPlayers'] });
            setShowModal(false);
        } catch (err: any) { console.error(err); alert('Failed to save player'); }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await deletePlayer(id);
            setDeleteConfirm(null);
            queryClient.invalidateQueries({ queryKey: ['adminPlayers'] });
        } catch (err: any) { console.error(err); alert('Failed to delete'); }
    };

    const set = (field: keyof FormData, value: string) => setForm(p => ({ ...p, [field]: value }));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Player Management</h1>
                <div className="flex items-center gap-3">
                    <select
                        value={filterTeam}
                        onChange={e => handleFilterChange(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 font-semibold text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="">All Teams</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button onClick={openCreate} className="px-4 py-1.5 bg-sffl-red text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:bg-red-700 transition whitespace-nowrap">+ Add Player</button>
                </div>
            </div>

            {loading ? (
                <Loader />
            ) : (
                <>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">#</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Player</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Position</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Team</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">TDs</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Yards</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {players.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                        <td className="px-4 py-3 font-bold text-sm dark:text-gray-300">{p.jersey_number}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {p.image && <img src={p.image} alt={p.name} className="w-8 h-8 rounded-full object-cover" />}
                                                <span className="font-semibold text-sm text-gray-900 dark:text-white">{p.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3"><span className="px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded-full text-xs font-bold dark:text-gray-300">{p.position}</span></td>
                                        <td className="px-4 py-3 text-sm dark:text-gray-300">{p.team?.name || '—'}</td>
                                        <td className="px-4 py-3 text-sm font-semibold dark:text-gray-300">{p.touchdowns}</td>
                                        <td className="px-4 py-3 text-sm font-semibold dark:text-gray-300">{p.yards}</td>
                                        <td className="px-4 py-3 text-right space-x-2">
                                            <button onClick={() => openEdit(p)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 font-bold text-sm rounded-lg transition-colors">Edit</button>
                                            <button onClick={() => setDeleteConfirm(p.id)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 font-bold text-sm rounded-lg transition-colors">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {players.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">No players found</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition">← Prev</button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                                    const p = start + i;
                                    if (p > totalPages) return null;
                                    return (
                                        <button key={p} onClick={() => setPage(p)} className={`px-3 py-2 rounded-xl font-bold text-sm transition ${p === page ? 'bg-sffl-red text-white shadow-md border-transparent' : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>{p}</button>
                                    );
                                })}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition">Next →</button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-2xl font-black text-sffl-navy dark:text-white">{editingId ? 'Edit Player' : 'Add Player'}</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                                    <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="Player name" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Jersey Number</label>
                                    <input type="number" value={form.jersey_number} onChange={e => set('jersey_number', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="0" max="99" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Position</label>
                                    <select value={form.position} onChange={e => set('position', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                        <option value="">Select...</option>
                                        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Team *</label>
                                    <select value={form.team_id} onChange={e => set('team_id', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                                        <option value="">Select...</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                                <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="Player bio..." />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Image URL</label>
                                <input type="url" value={form.image} onChange={e => set('image', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="https://..." />
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">TDs</label>
                                    <input type="number" value={form.touchdowns} onChange={e => set('touchdowns', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Yards</label>
                                    <input type="number" value={form.yards} onChange={e => set('yards', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">INTs</label>
                                    <input type="number" value={form.interceptions} onChange={e => set('interceptions', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Tackles</label>
                                    <input type="number" value={form.tackles} onChange={e => set('tackles', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="0" />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-sffl-red text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:bg-red-700 transition disabled:opacity-50">
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
                        <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-2">Delete Player?</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">This action cannot be undone.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:bg-red-700 transition">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
