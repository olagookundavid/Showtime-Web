import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';

interface TeamInfo {
    id: string;
    name: string;
    short_name: string;
    logo: string;
}

interface Player {
    id: string;
    name: string;
    position: string;
    jersey_number: number;
    image: string;
    team_id: string;
    bio: string;
    touchdowns: number;
    yards: number;
    interceptions: number;
    tackles: number;
}

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];

const emptyForm = {
    name: '', position: '', jersey_number: '', image: '', bio: '',
    touchdowns: '0', yards: '0', interceptions: '0', tackles: '0'
};

const TeamHeadPlayers = () => {
    const { team } = useOutletContext<{ team: TeamInfo | null }>();
    const queryClient = useQueryClient();

    const { data: playersData, isLoading: loading, error: queryError } = useQuery({
        queryKey: ['teamHeadPlayers', team?.id],
        queryFn: async () => {
            const res = await api.get('/team-head/players', { params: { team_id: team!.id } });
            return res.data.data as Player[];
        },
        enabled: !!team?.id,
    });

    const players = playersData || [];
    const error = queryError ? (queryError as any).response?.data?.error || 'Failed to fetch players.' : '';

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Player | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEdit = (p: Player) => {
        setEditing(p);
        setForm({
            name: p.name || '',
            position: p.position || '',
            jersey_number: p.jersey_number?.toString() || '0',
            image: p.image || '',
            bio: p.bio || '',
            touchdowns: p.touchdowns?.toString() || '0',
            yards: p.yards?.toString() || '0',
            interceptions: p.interceptions?.toString() || '0',
            tackles: p.tackles?.toString() || '0',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!team) return;
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                position: form.position,
                jersey_number: parseInt(form.jersey_number) || 0,
                image: form.image,
                bio: form.bio,
                touchdowns: parseInt(form.touchdowns) || 0,
                yards: parseInt(form.yards) || 0,
                interceptions: parseInt(form.interceptions) || 0,
                tackles: parseInt(form.tackles) || 0,
                team_id: team.id
            };
            if (editing) {
                await api.put(`/team-head/players/${editing.id}`, payload);
            } else {
                await api.post('/team-head/players', payload);
            }
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ['teamHeadPlayers', team.id] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to save player.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this player?')) return;
        try {
            await api.delete(`/team-head/players/${id}`);
            queryClient.invalidateQueries({ queryKey: ['teamHeadPlayers', team!.id] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to delete player.');
        }
    };

    const setField = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

    if (!team) {
        return (
            <div className="text-center py-20">
                <p className="text-2xl font-black text-gray-400 dark:text-gray-500">No team assigned</p>
                <p className="text-gray-500 mt-2">Contact an admin to get assigned to a team.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white">{team.name} — Players</h1>
                    <p className="text-gray-600 dark:text-gray-400">Manage your team's roster.</p>
                </div>
                <button onClick={openCreate} className="bg-sffl-red hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                    + Add Player
                </button>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800/30">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full flex justify-center py-12">
                        <div className="w-10 h-10 border-4 border-sffl-red border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : players.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">No players yet. Add your first player!</div>
                ) : (
                    players.map(player => (
                        <div key={player.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-lg">
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    {player.image ? (
                                        <img src={player.image} alt={player.name}
                                            className="w-14 h-14 rounded-full object-cover border-2 border-gray-200" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-full bg-sffl-navy/10 flex items-center justify-center text-xl font-black text-sffl-navy">
                                            #{player.jersey_number || '?'}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            {player.name}
                                        </h3>
                                        <div className="flex gap-2 items-center text-sm text-gray-500 dark:text-gray-400">
                                            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs font-bold">{player.position || 'N/A'}</span>
                                            {player.jersey_number > 0 && (
                                                <span className="text-xs">#{player.jersey_number}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-center">
                                    <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded col-span-1">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-bold">TDs</div>
                                        <div className="font-black text-sffl-navy dark:text-white">{player.touchdowns || 0}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded col-span-1">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-bold">YDS</div>
                                        <div className="font-black text-sffl-navy dark:text-white">{player.yards || 0}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded col-span-1">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-bold">INT</div>
                                        <div className="font-black text-sffl-navy dark:text-white">{player.interceptions || 0}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded col-span-1">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-bold">TAK</div>
                                        <div className="font-black text-sffl-navy dark:text-white">{player.tackles || 0}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                                    <button onClick={() => openEdit(player)}
                                        className="flex-1 text-sm font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                        Edit
                                    </button>
                                    <button onClick={() => handleDelete(player.id)}
                                        className="flex-1 text-sm font-bold text-red-600 hover:text-red-800 dark:text-red-400 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-2xl font-black text-sffl-navy dark:text-white">
                                {editing ? 'Edit Player' : 'Add Player'}
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                                    <input type="text" value={form.name} onChange={e => setField('name', e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" placeholder="Player Full Name" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Jersey #</label>
                                    <input type="number" value={form.jersey_number} onChange={e => setField('jersey_number', e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Position</label>
                                    <select value={form.position} onChange={e => setField('position', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red">
                                        <option value="">Select...</option>
                                        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Image URL</label>
                                    <input type="url" value={form.image} onChange={e => setField('image', e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" placeholder="https://..." />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                                <textarea value={form.bio} onChange={e => setField('bio', e.target.value)} rows={3}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" placeholder="Short bio..." />
                            </div>

                            {/* Stats */}
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <h3 className="text-sm font-black text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Player Stats</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">TDs</label>
                                        <input type="number" value={form.touchdowns} onChange={e => setField('touchdowns', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" min="0" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Yards</label>
                                        <input type="number" value={form.yards} onChange={e => setField('yards', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" min="0" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">INTs</label>
                                        <input type="number" value={form.interceptions} onChange={e => setField('interceptions', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" min="0" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tackles</label>
                                        <input type="number" value={form.tackles} onChange={e => setField('tackles', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" min="0" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors">Cancel</button>
                            <button onClick={handleSave} disabled={saving || !form.name.trim()}
                                className="px-5 py-2 bg-sffl-red text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamHeadPlayers;
