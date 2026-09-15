import { Loader } from '../../components/ui/Loader';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ImageUploadField, LightboxImage } from '../../components/ui';
import {
    getPlayers, getTeams, createPlayer, updatePlayer, deletePlayer, restorePlayer,
    moveToReserve, graduatePlayer,
    type Player, type Team, type CreatePlayerPayload,
} from '../../services/api';
import { isDeletedPlayer, DeletedPlayerName, deletedRowClass } from '../../components/common/DeletedPlayer';

interface FormData {
    name: string;
    jersey_number: string;
    position: string;
    secondary_position: string;
    gender: string;
    team_id: string;
    bio: string;
    image: string;
    email: string;
}
const emptyForm: FormData = {
    name: '', jersey_number: '', position: '', secondary_position: '', gender: '', team_id: '',
    bio: '', image: '', email: ''
};

// Center is rated identically to Receiver (same formula) — see
// backend/internal/domain/player_rating.go RateByPosition.
const POSITIONS = ['Defender', 'Receiver', 'Center', 'QB', 'Rusher', 'Allrounder'];

export const AdminPlayers = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [searchTerm, setSearchTerm] = useState('');
    const [rosterStatus, setRosterStatus] = useState<'main' | 'reserve' | 'all'>('all');

    // Filters
    const [filterTeam, setFilterTeam] = useState('');

    const { data: allPlayersData, isLoading: loadingPlayers } = useQuery({
        queryKey: ['adminPlayers', { page, limit, search: searchTerm, team: filterTeam, rosterStatus }],
        queryFn: () => getPlayers(filterTeam || undefined, page, limit, searchTerm, rosterStatus),
    });

    const { data: teamsData, isLoading: loadingTeams } = useQuery({
        queryKey: ['adminTeamsList'], // distinct from paginated adminTeams
        queryFn: () => getTeams(1, 100),
    });

    const allPlayers: Player[] = allPlayersData?.data || [];
    const totalPages = allPlayersData?.total_pages || 1;
    const teams: Team[] = (teamsData?.data || []).filter((t: Team) => t.status !== 'inactive');
    const loading = loadingPlayers || loadingTeams;
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
            secondary_position: p.secondary_position || '',
            gender: p.gender || '',
            team_id: p.team?.id || '',
            bio: p.bio || '',
            image: p.image || '',
            email: p.email || '',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error('Player name is required');
            return;
        }
        if (!form.jersey_number || form.jersey_number.trim() === '') {
            toast.error('Jersey number is required');
            return;
        }
        const jerseyNum = parseInt(form.jersey_number, 10);
        if (isNaN(jerseyNum) || jerseyNum < 1 || jerseyNum > 99) {
            toast.error('Please enter a valid jersey number (1 to 99)');
            return;
        }
        if (!form.team_id) {
            toast.error('Team selection is required');
            return;
        }
        if (form.secondary_position && form.secondary_position === form.position) {
            toast.error('Secondary position cannot be the same as primary position');
            return;
        }

        setSaving(true);
        try {
            const payload: CreatePlayerPayload = {
                name: form.name.trim(),
                jersey_number: jerseyNum,
                position: form.position,
                secondary_position: form.secondary_position || undefined,
                gender: form.gender,
                team_id: form.team_id,
                bio: form.bio,
                image: form.image,
                email: form.email,
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
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deletePlayer(id);
            setDeleteConfirm(null);
            queryClient.invalidateQueries({ queryKey: ['adminPlayers'] });
            toast.success('Player deleted. Their stats and history are kept, and they can be restored.');
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to delete player');
        }
    };

    const handleRestore = async (id: string) => {
        try {
            await restorePlayer(id);
            queryClient.invalidateQueries({ queryKey: ['adminPlayers'] });
            toast.success('Player restored');
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to restore player');
        }
    };

    const set = (field: keyof FormData, value: string) => setForm(p => ({ ...p, [field]: value }));

    const columns: Column<Player>[] = [
        {
            header: 'Player',
            sortable: true,
            sortValue: (p) => p.name,
            cell: (p) => {
                const deleted = isDeletedPlayer(p);
                return (
                    <div className={`flex items-center gap-3 ${deletedRowClass(deleted)}`}>
                        {p.image ? (
                            <LightboxImage
                                src={p.image}
                                alt={p.name}
                                thumbnailClassName="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-sffl-navy/10 dark:bg-sffl-navy/50 border border-sffl-navy/20 dark:border-gray-700 flex items-center justify-center text-xs font-black text-sffl-navy dark:text-gray-200 flex-shrink-0">
                                #{p.jersey_number || '?'}
                            </div>
                        )}
                        <div className="flex flex-col">
                            {deleted
                                ? <DeletedPlayerName name={p.name} deleted showLabel className="font-semibold text-sm" />
                                : <span className="font-semibold text-sm text-gray-900 dark:text-white">{p.name}</span>}
                            {p.email && (
                                <span className="text-xs text-gray-400 truncate max-w-[180px]">{p.email}</span>
                            )}
                        </div>
                    </div>
                );
            }
        },
        { header: '#', accessor: 'jersey_number', sortable: true, className: "px-4 py-3 font-bold text-sm dark:text-gray-300 w-16" },
        {
            header: 'Position',
            accessor: 'position',
            sortable: true,
            cell: (p) => (
                <div className="flex flex-col gap-1 items-start">
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded-md text-xs font-bold dark:text-gray-300">
                        {p.position}
                    </span>
                    {p.secondary_position && (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded text-[10px] font-extrabold whitespace-nowrap">
                            Sec: {p.secondary_position}
                        </span>
                    )}
                </div>
            )
        },
        {
            header: 'Gender',
            sortable: true,
            sortValue: (p) => p.gender || '',
            cell: (p) => (
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    p.gender === 'F' 
                        ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' 
                        : p.gender === 'M' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' 
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                    {p.gender === 'F' ? 'Female (F)' : p.gender === 'M' ? 'Male (M)' : '—'}
                </span>
            )
        },
        {
            header: 'Team',
            sortable: true,
            sortValue: (p) => p.team?.name || '',
            cell: (p) => <span className="text-sm dark:text-gray-300">{p.team?.name || '—'}</span>
        },
        {
            header: 'Squad',
            sortable: true,
            sortValue: (p) => p.is_reserve ? 'Reserve' : 'Main',
            cell: (p) => p.is_reserve ? (
                <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Reserve
                </span>
            ) : (
                <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Main
                </span>
            )
        },
        {
            header: 'Actions',
            className: "px-4 py-3 text-right space-x-2 w-56",
            cell: (p) => (
                <div className="flex justify-end gap-1.5 flex-wrap">
                    {p.team?.id && !isDeletedPlayer(p) && (
                        p.is_reserve ? (
                            <button
                                onClick={async () => {
                                    try {
                                        await graduatePlayer(p.id, p.team.id);
                                        toast.success(`${p.name} graduated to main squad`);
                                        queryClient.invalidateQueries({ queryKey: ['adminPlayers'] });
                                    } catch (err: any) {
                                        toast.error(err.response?.data?.error || 'Failed to graduate player');
                                    }
                                }}
                                title="Promote from reserves to main squad"
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold text-xs rounded-md transition-colors"
                            >
                                Graduate
                            </button>
                        ) : (
                            <button
                                onClick={async () => {
                                    try {
                                        await moveToReserve(p.id, p.team.id);
                                        toast.success(`${p.name} moved to reserves`);
                                        queryClient.invalidateQueries({ queryKey: ['adminPlayers'] });
                                    } catch (err: any) {
                                        toast.error(err.response?.data?.error || 'Failed to move player to reserves');
                                    }
                                }}
                                title="Move player to reserve squad"
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-bold text-xs rounded-md transition-colors"
                            >
                                To Reserve
                            </button>
                        )
                    )}
                    <button onClick={() => openEdit(p)} className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 font-bold text-xs rounded-md transition-colors">Edit</button>
                    {isDeletedPlayer(p) ? (
                        <button
                            onClick={() => handleRestore(p.id)}
                            title="Put this player back on the active roster"
                            className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400 font-bold text-xs rounded-md transition-colors"
                        >Restore</button>
                    ) : (
                        <button onClick={() => setDeleteConfirm(p.id)} className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 font-bold text-xs rounded-md transition-colors">Delete</button>
                    )}
                </div>
            )
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Player Management</h1>
                <div className="flex items-center gap-3 flex-wrap">
                    <select
                        value={filterTeam}
                        onChange={e => handleFilterChange(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-[44px] z-50 font-semibold text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="" className="truncate">All Teams</option>
                        <option value="FREE_AGENT" className="truncate">Free Agents (no active contract)</option>
                        {teams.map(t => <option key={t.id} value={t.id} className="truncate">{t.name}</option>)}
                    </select>
                    <select
                        value={rosterStatus}
                        onChange={e => {
                            setRosterStatus(e.target.value as any);
                            setPage(1);
                        }}
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-[44px] z-50 font-semibold text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="all">All Squads</option>
                        <option value="main">Main Squad Only</option>
                        <option value="reserve">Reserves Only</option>
                    </select>
                    <div className="flex items-center gap-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 min-h-[44px]">
                        <label htmlFor="limitSelectInput" className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Limit:</label>
                        <select
                            id="limitSelectInput"
                            value={limit}
                            onChange={e => {
                                setLimit(Number(e.target.value));
                                setPage(1);
                            }}
                            className="bg-transparent font-bold text-sm text-gray-900 dark:text-white focus:outline-none cursor-pointer"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                            <option value={500}>500</option>
                            <option value={800}>800</option>
                            <option value={1000}>1000</option>
                        </select>
                    </div>
                    <button onClick={openCreate} className="px-4 py-2 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 min-h-[44px] whitespace-nowrap">+ Add Player</button>
                </div>
            </div>

            {loading ? (
                <Loader />
            ) : (
                <DataTable
                    data={allPlayers}
                    columns={columns}
                    searchable={true}
                    searchPlaceholder="Search players..."
                    itemsPerPage={limit}
                    serverPage={page}
                    totalServerPages={totalPages}
                    onPageChange={setPage}
                    onSearchSubmit={(term) => {
                        setSearchTerm(term);
                        setPage(1);
                    }}
                />
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden" data-dialog onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
                            <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">{editingId ? 'Edit Player' : 'Add Player'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl font-bold p-1">✕</button>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                                    <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="Player name" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Jersey Number *</label>
                                    <input type="number" value={form.jersey_number} onChange={e => set('jersey_number', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="1" max="99" placeholder="e.g. 10" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Primary Role</label>
                                    <select
                                        value={form.position}
                                        onChange={e => {
                                            const newPos = e.target.value;
                                            set('position', newPos);
                                            if (form.secondary_position === newPos) {
                                                set('secondary_position', '');
                                            }
                                        }}
                                        className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 min-h-[44px] z-50"
                                    >
                                        <option value="" className="truncate">Select Primary Role...</option>
                                        {POSITIONS.map(p => <option key={p} value={p} className="truncate">{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        Secondary Role <span className="text-xs font-normal text-gray-400">(Optional)</span>
                                    </label>
                                    <select
                                        value={form.secondary_position}
                                        onChange={e => set('secondary_position', e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 min-h-[44px] z-50"
                                    >
                                        <option value="" className="truncate">None (No Secondary Role)</option>
                                        {POSITIONS.filter(p => p !== form.position).map(p => (
                                            <option key={p} value={p} className="truncate">{p}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Gender</label>
                                    <select value={form.gender} onChange={e => set('gender', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 min-h-[44px] z-50">
                                        <option value="">Select...</option>
                                        <option value="M">Male (M)</option>
                                        <option value="F">Female (F)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Team *</label>
                                    {editingId ? (
                                        <div className="w-full border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-2 min-h-[44px] flex items-center font-semibold text-sm cursor-not-allowed select-none">
                                            {teams.find(t => t.id === form.team_id)?.name || 'Unassigned / Free Agent'}
                                        </div>
                                    ) : (
                                        <select value={form.team_id} onChange={e => set('team_id', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 min-h-[44px] z-50">
                                            <option value="" className="truncate">Select...</option>
                                            {teams.map(t => <option key={t.id} value={t.id} className="truncate">{t.name}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Email <span className="text-gray-400 font-normal">(optional)</span></label>
                                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="player@example.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                                <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="Player bio..." />
                            </div>
                            <div>
                                <ImageUploadField
                                    label="Player Image"
                                    value={form.image}
                                    onChange={(url) => set('image', url)}
                                    folder="players"
                                    helperText="Upload a profile photo.  "
                                    isCommitted={saving}
                                />
                            </div>

                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex justify-end gap-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-gray-700 text-sm dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 min-h-[44px]">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 min-h-[44px] disabled:opacity-50">
                                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" data-dialog onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-2">Delete Player?</h3>
                        {/* It genuinely is reversible now — saying otherwise made
                            admins avoid a safe action, or delete believing the
                            history was going with it. */}
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            They come off the active roster and stop appearing in the fantasy market
                            and new team sheets. Their stats and match history are kept, they stay
                            searchable, and you can restore them at any time.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 min-h-[44px]">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 min-h-[44px]">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
