import { Loader } from '../../components/ui/Loader';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { DataTable, type Column } from '../../components/ui/DataTable';
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

    // Filters (client-side)
    const [filterTeam, setFilterTeam] = useState('');

    // Client-side filter
    const filtered = filterTeam
        ? allPlayers.filter(p => p.team?.id === filterTeam)
        : allPlayers;

    const handleFilterChange = (teamId: string) => {
        setFilterTeam(teamId);
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
                toast.success('Player updated successfully');
            } else {
                await createPlayer(payload);
                toast.success('Player created successfully');
            }
            queryClient.invalidateQueries({ queryKey: ['adminPlayers'] });
            setShowModal(false);
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to save player');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await deletePlayer(id);
            setDeleteConfirm(null);
            queryClient.invalidateQueries({ queryKey: ['adminPlayers'] });
            toast.success('Player deleted successfully');
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to delete player');
        }
    };

    const set = (field: keyof FormData, value: string) => setForm(p => ({ ...p, [field]: value }));

    const columns: Column<Player>[] = [
        { header: '#', accessor: 'jersey_number', sortable: true, className: "px-4 py-3 font-bold text-sm dark:text-gray-300 w-16" },
        {
            header: 'Player',
            sortable: true,
            sortValue: (p) => p.name,
            cell: (p) => (
                <div className="flex items-center gap-3">
                    {p.image && <img src={p.image} alt={p.name} className="w-8 h-8 rounded-full object-cover" />}
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{p.name}</span>
                </div>
            )
        },
        {
            header: 'Position',
            accessor: 'position',
            sortable: true,
            cell: (p) => <span className="px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded-full text-xs font-bold dark:text-gray-300">{p.position}</span>
        },
        {
            header: 'Team',
            sortable: true,
            sortValue: (p) => p.team?.name || '',
            cell: (p) => <span className="text-sm dark:text-gray-300">{p.team?.name || '—'}</span>
        },
        { header: 'TDs', accessor: 'touchdowns', sortable: true, className: "px-4 py-3 text-sm font-semibold dark:text-gray-300" },
        { header: 'Yards', accessor: 'yards', sortable: true, className: "px-4 py-3 text-sm font-semibold dark:text-gray-300" },
        {
            header: 'Actions',
            className: "px-4 py-3 text-right space-x-2 w-48",
            cell: (p) => (
                <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(p)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 font-bold text-sm rounded-lg transition-colors">Edit</button>
                    <button onClick={() => setDeleteConfirm(p.id)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 font-bold text-sm rounded-lg transition-colors">Delete</button>
                </div>
            )
        },
    ];

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
                <DataTable data={filtered} columns={columns} searchable={true} searchPlaceholder="Search players..." itemsPerPage={15} />
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
