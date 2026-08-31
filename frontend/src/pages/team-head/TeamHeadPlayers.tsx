import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import { LightboxImage } from '../../components/ui';
import toast from 'react-hot-toast';
import {
    MagnifyingGlassIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    UserPlusIcon,
    XMarkIcon,
    PencilSquareIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';

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
    gender?: string;
    jersey_number: number;
    email?: string;
    image: string;
    team_id: string;
    bio: string;
}

interface PaginatedPlayerResponse {
    data: Player[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

// Center is rated identically to Receiver (same formula) — see
// backend/internal/domain/player_rating.go RateByPosition.
const POSITIONS = ['Defender', 'Receiver', 'Center', '-', 'QB', 'Rusher'];

const emptyForm = {
    name: '', position: '', gender: '', jersey_number: '', email: '', image: '', bio: '', contract_length: '13',
};

const TeamHeadPlayers = () => {
    const { team } = useOutletContext<{ team: TeamInfo | null }>();
    const queryClient = useQueryClient();

    // Pagination & Search States
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search input by 300ms
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to page 1 on new search query
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    // Locked to team.id (manager's own team) with full pagination & search
    const { data: responseData, isLoading: loading, error: queryError } = useQuery<PaginatedPlayerResponse>({
        queryKey: ['teamHeadPlayers', team?.id, page, limit, debouncedSearch],
        queryFn: async () => {
            const res = await api.get('/team-head/players', {
                params: {
                    team_id: team!.id, // Locked to manager's assigned team
                    page,
                    limit,
                    search: debouncedSearch,
                },
            });
            return res.data;
        },
        enabled: !!team?.id,
    });

    const players = responseData?.data || [];
    const totalPlayers = responseData?.total || 0;
    const totalPages = responseData?.total_pages || 1;
    const currentPage = responseData?.page || page;

    const error = queryError ? (queryError as any).response?.data?.error || 'Failed to fetch players.' : '';

    // Modal States
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
            gender: p.gender || '',
            jersey_number: p.jersey_number?.toString() || '0',
            email: p.email || '',
            image: p.image || '',
            bio: p.bio || '',
            contract_length: '13',
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
                gender: form.gender,
                jersey_number: parseInt(form.jersey_number) || 0,
                email: form.email,
                image: form.image,
                bio: form.bio,
                team_id: team.id,
                contract_length: parseInt(form.contract_length) || 13,
            };
            if (editing) {
                await api.put(`/team-head/players/${editing.id}`, payload);
                toast.success('Player updated successfully');
            } else {
                await api.post('/team-head/players', payload);
                toast.success('Player added successfully');
            }
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ['teamHeadPlayers', team.id] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to save player.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this player?')) return;
        try {
            await api.delete(`/team-head/players/${id}`);
            toast.success('Player deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['teamHeadPlayers', team!.id] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to delete player.');
        }
    };

    const setField = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

    const startItem = totalPlayers === 0 ? 0 : (currentPage - 1) * limit + 1;
    const endItem = Math.min(currentPage * limit, totalPlayers);

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
            {/* Header Title & Add Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white flex items-center gap-3">
                        {team.logo && (
                            <img src={team.logo} alt={team.name} className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700" />
                        )}
                        <span>{team.name} — Players</span>
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        View and manage your team's official player roster.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center justify-center gap-2 bg-sffl-red hover:bg-red-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-transform active:scale-95 text-sm"
                >
                    <UserPlusIcon className="w-5 h-5" />
                    <span>Add Player</span>
                </button>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800/30 text-sm font-semibold">
                    {error}
                </div>
            )}

            {/* Filter Bar: Search + Page Size Control */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                    <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search player by name or position..."
                        className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sffl-red"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Page Size & Summary */}
                <div className="flex items-center gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                        <label htmlFor="pageSizeSelect" className="font-semibold whitespace-nowrap">Show:</label>
                        <select
                            id="pageSizeSelect"
                            value={limit}
                            onChange={e => {
                                setLimit(Number(e.target.value));
                                setPage(1);
                            }}
                            className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sffl-red text-xs"
                        >
                            <option value={10}>10 per page</option>
                            <option value={20}>20 per page</option>
                            <option value={50}>50 per page</option>
                            <option value={100}>100 per page</option>
                        </select>
                    </div>
                    <span className="hidden sm:inline-block border-l border-gray-200 dark:border-gray-700 h-4" />
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                        {totalPlayers} Total Players
                    </span>
                </div>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full flex justify-center py-16">
                        <div className="w-10 h-10 border-4 border-sffl-red border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : players.length === 0 ? (
                    <div className="col-span-full bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-700">
                        <p className="text-lg font-bold text-gray-600 dark:text-gray-300">
                            {debouncedSearch ? `No players matching "${debouncedSearch}"` : 'No players on roster yet.'}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            {debouncedSearch ? 'Try clearing your search query.' : 'Click "+ Add Player" above to add your first team member.'}
                        </p>
                        {debouncedSearch && (
                            <button
                                onClick={() => setSearch('')}
                                className="mt-4 px-4 py-2 bg-sffl-navy dark:bg-gray-700 text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                ) : (
                    players.map(player => (
                        <div
                            key={player.id}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md flex flex-col justify-between"
                        >
                            <div className="p-5">
                                <div className="flex items-start gap-4">
                                    {player.image ? (
                                        <LightboxImage
                                            src={player.image}
                                            alt={player.name}
                                            thumbnailClassName="w-14 h-14 rounded-xl object-cover border border-gray-200 shadow-sm flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-14 h-14 rounded-xl bg-sffl-navy/10 dark:bg-sffl-red/10 border border-sffl-navy/20 dark:border-sffl-red/20 flex items-center justify-center text-lg font-black text-sffl-navy dark:text-sffl-red flex-shrink-0">
                                            #{player.jersey_number || '?'}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-black text-gray-900 dark:text-white truncate" title={player.name}>
                                            {player.name}
                                        </h3>
                                        <div className="flex flex-wrap gap-1.5 items-center mt-1">
                                            <span className="bg-gray-100 dark:bg-gray-700/70 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md text-[11px] font-extrabold uppercase">
                                                {player.position || 'N/A'}
                                            </span>
                                            {player.gender && (
                                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                                                    player.gender === 'F'
                                                        ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300'
                                                        : player.gender === 'M'
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                                }`}>
                                                    {player.gender === 'F' ? 'Female (F)' : player.gender === 'M' ? 'Male (M)' : player.gender}
                                                </span>
                                            )}
                                            {player.jersey_number > 0 && (
                                                <span className="bg-sffl-red/10 text-sffl-red px-2 py-0.5 rounded-md text-[11px] font-black">
                                                    #{player.jersey_number}
                                                </span>
                                            )}
                                        </div>
                                        {player.email && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate" title={player.email}>
                                                {player.email}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {player.bio && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 line-clamp-2">
                                        {player.bio}
                                    </p>
                                )}
                            </div>

                            {/* Card Actions */}
                            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                                <button
                                    onClick={() => openEdit(player)}
                                    className="flex-1 min-h-[38px] flex items-center justify-center gap-1.5 text-xs font-bold text-sffl-navy dark:text-blue-400 hover:bg-gray-200/60 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <PencilSquareIcon className="w-4 h-4" />
                                    <span>Edit</span>
                                </button>
                                <button
                                    onClick={() => handleDelete(player.id)}
                                    className="flex-1 min-h-[38px] flex items-center justify-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
                    <div className="text-gray-500 dark:text-gray-400">
                        Showing <span className="font-bold text-gray-900 dark:text-white">{startItem}</span> to{' '}
                        <span className="font-bold text-gray-900 dark:text-white">{endItem}</span> of{' '}
                        <span className="font-bold text-gray-900 dark:text-white">{totalPlayers}</span> players
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={currentPage <= 1 || loading}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                            <span>Prev</span>
                        </button>

                        <div className="flex items-center gap-1 px-2">
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                .map((p, idx, arr) => (
                                    <div key={p} className="flex items-center">
                                        {idx > 0 && p - arr[idx - 1] > 1 && (
                                            <span className="px-1 text-gray-400">...</span>
                                        )}
                                        <button
                                            onClick={() => setPage(p)}
                                            className={`min-w-[32px] h-8 rounded-lg font-bold text-xs transition-colors ${
                                                p === currentPage
                                                    ? 'bg-sffl-red text-white shadow-sm'
                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    </div>
                                ))}
                        </div>

                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages || loading}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <span>Next</span>
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
                            <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">
                                {editing ? 'Edit Player' : 'Add Player'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl font-bold p-1">✕</button>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                                    <input type="text" value={form.name} onChange={e => setField('name', e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red text-sm font-semibold" placeholder="Player Full Name" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Jersey #</label>
                                    <input type="number" value={form.jersey_number} onChange={e => setField('jersey_number', e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red text-sm font-semibold" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                                    <input type="email" value={form.email} onChange={e => setField('email', e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red text-sm font-semibold" placeholder="player@team.com" />
                                </div>
                                {!editing && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Contract Length (Games) *</label>
                                        <input type="number" min="1" value={form.contract_length} onChange={e => setField('contract_length', e.target.value)}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red text-sm font-semibold" placeholder="Default 13" />
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Position</label>
                                    <select value={form.position} onChange={e => setField('position', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red text-sm font-semibold">
                                        <option value="" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">Select...</option>
                                        {POSITIONS.map(p => <option key={p} value={p} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Gender</label>
                                    <select value={form.gender} onChange={e => setField('gender', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red text-sm font-semibold">
                                        <option value="" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">Select...</option>
                                        <option value="M" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">Male (M)</option>
                                        <option value="F" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">Female (F)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Image URL</label>
                                    <input type="url" value={form.image} onChange={e => setField('image', e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red text-sm font-semibold" placeholder="https://..." />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                                <textarea value={form.bio} onChange={e => setField('bio', e.target.value)} rows={3}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red text-sm font-semibold" placeholder="Short bio..." />
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/90">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-gray-700 dark:text-gray-200 transition-colors min-h-[44px] text-sm">Cancel</button>
                            <button onClick={handleSave} disabled={saving || !form.name.trim()}
                                className="px-5 py-2.5 bg-sffl-red text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] text-sm shadow-sm">
                                {saving ? 'Saving...' : editing ? 'Update Player' : 'Add Player'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamHeadPlayers;
