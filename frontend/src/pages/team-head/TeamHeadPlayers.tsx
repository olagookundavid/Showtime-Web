import { useState, useEffect } from 'react';
import { isDeletedPlayer, DELETED_TITLE } from '../../components/common/DeletedPlayer';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, Link } from 'react-router-dom';
import api, { moveToReserve, graduatePlayer, getTeamRosterSummary, type RosterSummary } from '../../services/api';
import { LightboxImage, ImageUploadField } from '../../components/ui';
import toast from 'react-hot-toast';
import {
    MagnifyingGlassIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
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
    secondary_position?: string;
    gender?: string;
    jersey_number: number;
    email?: string;
    image: string;
    team_id: string;
    bio: string;
    is_reserve?: boolean;
    /** 'active' | 'inactive'. Deleting only deactivates (migration 088). */
    status?: string;
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
const POSITIONS = ['Defender', 'Receiver', 'Center', 'QB', 'Rusher', 'Allrounder'];

const emptyForm = {
    name: '', position: '', secondary_position: '', gender: '', jersey_number: '', email: '', image: '', bio: '', contract_length: '13',
};

const TeamHeadPlayers = () => {
    const { team } = useOutletContext<{ team: TeamInfo | null }>();
    const queryClient = useQueryClient();

    // Pagination, Search & Squad Tab States
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [rosterTab, setRosterTab] = useState<'main' | 'reserve' | 'all'>('main');

    // Debounce search input by 300ms
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to page 1 on new search query
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    // Team Roster Capacity Summary (25-Cap enforcement)
    const { data: rosterSummary } = useQuery<RosterSummary>({
        queryKey: ['teamRosterSummary', team?.id],
        queryFn: () => getTeamRosterSummary(team!.id),
        enabled: !!team?.id,
    });

    // Locked to team.id (manager's own team) with full pagination, search & roster tab
    const { data: responseData, isLoading: loading, error: queryError } = useQuery<PaginatedPlayerResponse>({
        queryKey: ['teamHeadPlayers', team?.id, page, limit, debouncedSearch, rosterTab],
        queryFn: async () => {
            const res = await api.get('/team-head/players', {
                params: {
                    team_id: team!.id, // Locked to manager's assigned team
                    page,
                    limit,
                    search: debouncedSearch,
                    roster_status: rosterTab === 'all' ? undefined : rosterTab,
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

    const openEdit = (p: Player) => {
        setEditing(p);
        setForm({
            name: p.name || '',
            position: p.position || '',
            secondary_position: p.secondary_position || '',
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
        if (!editing) {
            toast.error('Direct player creation is disabled. Please contact league administration.');
            return;
        }
        if (form.secondary_position && form.secondary_position === form.position) {
            toast.error('Secondary position cannot be the same as primary position.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                position: form.position,
                secondary_position: form.secondary_position || undefined,
                gender: form.gender,
                jersey_number: parseInt(form.jersey_number) || 0,
                email: form.email,
                image: form.image,
                bio: form.bio,
                team_id: team.id,
                contract_length: parseInt(form.contract_length) || 13,
            };
            await api.put(`/team-head/players/${editing.id}`, payload);
            toast.success('Player updated successfully');
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ['teamHeadPlayers', team.id] });
            queryClient.invalidateQueries({ queryKey: ['teamRosterSummary', team.id] });
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
            queryClient.invalidateQueries({ queryKey: ['teamRosterSummary', team!.id] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to delete player.');
        }
    };

    const handleMoveToReserve = async (player: Player) => {
        if (!confirm(`Move ${player.name} to the Reserve Squad? They will no longer be eligible for active match team sheets until graduated back to the main squad.`)) return;
        try {
            await moveToReserve(player.id);
            toast.success(`${player.name} moved to Reserve Squad`);
            queryClient.invalidateQueries({ queryKey: ['teamHeadPlayers', team!.id] });
            queryClient.invalidateQueries({ queryKey: ['teamRosterSummary', team!.id] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to move player to reserve.');
        }
    };

    const handleGraduate = async (player: Player) => {
        if (rosterSummary && !rosterSummary.can_add_or_promote) {
            toast.error('Main squad is at capacity (25/25). Move an active player to reserves or release a player first.');
            return;
        }
        try {
            await graduatePlayer(player.id);
            toast.success(`${player.name} graduated to Main Squad!`);
            queryClient.invalidateQueries({ queryKey: ['teamHeadPlayers', team!.id] });
            queryClient.invalidateQueries({ queryKey: ['teamRosterSummary', team!.id] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to graduate player to main squad.');
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
            {/* Header Title & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white flex items-center gap-3">
                        {team.logo && (
                            <img src={team.logo} alt={team.name} className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700" />
                        )}
                        <span>{team.name} — Players</span>
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        View and manage your team's official player roster and reserves.
                    </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                    <Link
                        to="/team-head/transfers"
                        className="flex items-center justify-center gap-1.5 bg-sffl-navy hover:bg-[#001730] text-white font-bold py-2.5 px-4 rounded-xl shadow-sm text-xs sm:text-sm transition-all"
                    >
                        <span>🔄 Transfer Market</span>
                    </Link>
                    <Link
                        to="/team-head/contracts"
                        className="flex items-center justify-center gap-1.5 bg-sffl-red hover:bg-[#A52323] text-white font-bold py-2.5 px-4 rounded-xl shadow-sm text-xs sm:text-sm transition-all"
                    >
                        <span>📝 Sign Free Agent</span>
                    </Link>
                </div>
            </div>

            {/* Roster Capacity Meter & Status Banner */}
            {rosterSummary && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                                <span>Squad Roster Status & Capacity</span>
                                {rosterSummary.main_count > rosterSummary.max_main_limit ? (
                                    <span className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[11px] font-black px-2 py-0.5 rounded-md">
                                        ⚠️ Over Limit ({rosterSummary.main_count}/{rosterSummary.max_main_limit})
                                    </span>
                                ) : rosterSummary.main_count === rosterSummary.max_main_limit ? (
                                    <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[11px] font-black px-2 py-0.5 rounded-md">
                                        Full Capacity ({rosterSummary.max_main_limit}/{rosterSummary.max_main_limit})
                                    </span>
                                ) : (
                                    <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-black px-2 py-0.5 rounded-md">
                                        {rosterSummary.max_main_limit - rosterSummary.main_count} Spot(s) Available
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Teams are capped at 25 main squad players. Reserves are unlimited and excluded from match team sheets until graduated.
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold self-start sm:self-auto">
                            <div className="text-center">
                                <span className="text-gray-400 block text-[10px] uppercase">Main Squad</span>
                                <span className={`text-base font-black ${rosterSummary.main_count > 25 ? 'text-red-600' : 'text-sffl-navy dark:text-white'}`}>
                                    {rosterSummary.main_count} <span className="text-xs text-gray-400 font-normal">/ 25</span>
                                </span>
                            </div>
                            <div className="h-6 w-px bg-gray-200 dark:border-gray-700" />
                            <div className="text-center">
                                <span className="text-gray-400 block text-[10px] uppercase">Reserves</span>
                                <span className="text-base font-black text-amber-600 dark:text-amber-400">
                                    {rosterSummary.reserve_count} <span className="text-xs text-gray-400 font-normal">(unlimited)</span>
                                </span>
                            </div>
                            <div className="h-6 w-px bg-gray-200 dark:border-gray-700" />
                            <div className="text-center">
                                <span className="text-gray-400 block text-[10px] uppercase">All-Rounders</span>
                                <span className={`text-base font-black ${(rosterSummary.allrounder_count || 0) >= 6 ? 'text-amber-600 dark:text-amber-400' : 'text-sffl-navy dark:text-white'}`}>
                                    {rosterSummary.allrounder_count || 0} <span className="text-xs text-gray-400 font-normal">/ 6</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${
                                rosterSummary.main_count > 25
                                    ? 'bg-red-600'
                                    : rosterSummary.main_count === 25
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, (rosterSummary.main_count / 25) * 100)}%` }}
                        />
                    </div>

                    {/* Grandfathered Warning Banner if > 25 */}
                    {rosterSummary.main_count > rosterSummary.max_main_limit && (
                        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-3.5 text-xs text-red-800 dark:text-red-300 flex items-start gap-2.5">
                            <span className="text-base leading-none">⚠️</span>
                            <div>
                                <span className="font-bold">Grandfathered Roster Limit:</span> Your main squad currently holds{' '}
                                <strong>{rosterSummary.main_count} players</strong>, which exceeds the official 25-player cap. Existing players remain active, but you <strong>cannot sign new free agents, accept incoming transfers, or graduate reserves</strong> until you move at least <strong>{rosterSummary.main_count - rosterSummary.max_main_limit} player(s)</strong> to your reserve squad or release them.
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Roster Registration Notice */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5 shadow-sm">
                <span className="text-base leading-none">ℹ️</span>
                <div>
                    <span className="font-bold">Player Creation Policy:</span> Direct creation of player profiles is managed strictly by League Administration to prevent duplicate player entries. To onboard players, sign eligible athletes via <strong>Free Agency Contracts</strong> or submit an official <strong>Transfer Request</strong>.
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800/30 text-sm font-semibold">
                    {error}
                </div>
            )}

            {/* Roster Squad Status Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                <button
                    onClick={() => { setRosterTab('main'); setPage(1); }}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                        rosterTab === 'main'
                            ? 'bg-sffl-navy text-white shadow-sm'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                    }`}
                >
                    <span>⭐ Main Squad</span>
                    {rosterSummary && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-black ${
                            rosterTab === 'main' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                            {rosterSummary.main_count}/25
                        </span>
                    )}
                </button>
                <button
                    onClick={() => { setRosterTab('reserve'); setPage(1); }}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                        rosterTab === 'reserve'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                    }`}
                >
                    <span>🛡️ Reserves</span>
                    {rosterSummary && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-black ${
                            rosterTab === 'reserve' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        }`}>
                            {rosterSummary.reserve_count}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => { setRosterTab('all'); setPage(1); }}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        rosterTab === 'all'
                            ? 'bg-sffl-red text-white shadow-sm'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                    }`}
                >
                    <span>All Players</span>
                </button>
            </div>

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
                            <option value={200}>200 per page</option>
                            <option value={500}>500 per page</option>
                            <option value={800}>800 per page</option>
                            <option value={1000}>1000 per page</option>
                        </select>
                    </div>
                    <span className="hidden sm:inline-block border-l border-gray-200 dark:border-gray-700 h-4" />
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                        {totalPlayers} Total Players
                    </span>
                </div>
            </div>

            {/* Players List View (Universal List View starting with photo) */}
            <div>
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-10 h-10 border-4 border-sffl-red border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : players.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-700">
                        <p className="text-lg font-bold text-gray-600 dark:text-gray-300">
                            {debouncedSearch ? `No players matching "${debouncedSearch}"` : rosterTab === 'reserve' ? 'No players currently in reserve squad.' : 'No players on roster yet.'}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            {debouncedSearch ? 'Try clearing your search query.' : rosterTab === 'reserve' ? 'You can move players from the main squad into reserves at any time.' : 'Sign free agents or submit a transfer request to add players.'}
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
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60">
                        {players.map(player => (
                            <div
                                key={player.id}
                                title={isDeletedPlayer(player) ? DELETED_TITLE : undefined}
                                className={`p-4 sm:p-5 hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                    isDeletedPlayer(player) ? 'opacity-50 grayscale' : ''
                                }`}
                            >
                                <div className="flex items-start sm:items-center gap-4 min-w-0">
                                    {/* Player Picture Thumbnail (Left-most) */}
                                    {player.image ? (
                                        <LightboxImage
                                            src={player.image}
                                            alt={player.name}
                                            thumbnailClassName="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-sffl-navy/10 dark:bg-sffl-red/10 border border-sffl-navy/20 dark:border-sffl-red/20 flex items-center justify-center text-lg font-black text-sffl-navy dark:text-sffl-red flex-shrink-0">
                                            #{player.jersey_number || '?'}
                                        </div>
                                    )}

                                    {/* Player Info */}
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className={`text-base sm:text-lg font-black truncate ${
                                                isDeletedPlayer(player)
                                                    ? 'text-gray-400 dark:text-gray-500 line-through decoration-1'
                                                    : 'text-gray-900 dark:text-white'
                                            }`}>
                                                {player.name}
                                            </h3>
                                            {isDeletedPlayer(player) && (
                                                <span
                                                    title={DELETED_TITLE}
                                                    className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-gray-100 text-gray-500 border border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600"
                                                >
                                                    Deleted
                                                </span>
                                            )}
                                            {player.jersey_number > 0 && (
                                                <span className="bg-sffl-red/10 text-sffl-red px-2 py-0.5 rounded-md text-xs font-black">
                                                    #{player.jersey_number}
                                                </span>
                                            )}
                                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md text-xs font-extrabold uppercase">
                                                {player.position || 'N/A'}
                                            </span>
                                            {player.secondary_position && (
                                                <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md text-xs font-extrabold uppercase">
                                                    Sec: {player.secondary_position}
                                                </span>
                                            )}
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
                                            {/* Squad Status Pill */}
                                            {player.is_reserve ? (
                                                <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                    🛡️ Reserve Squad
                                                </span>
                                            ) : (
                                                <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                    ⭐ Main Squad
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                            {player.email && (
                                                <span className="font-medium">{player.email}</span>
                                            )}
                                            {player.bio && (
                                                <span className="text-gray-600 dark:text-gray-400 italic line-clamp-1">
                                                    "{player.bio}"
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Row Actions */}
                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-700/60">
                                    {player.is_reserve ? (
                                        <button
                                            onClick={() => handleGraduate(player)}
                                            disabled={rosterSummary && !rosterSummary.can_add_or_promote}
                                            title={rosterSummary && !rosterSummary.can_add_or_promote ? "Main squad is at capacity (25/25). Move an active player to reserves first." : "Graduate to Main Squad"}
                                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <span>⬆️</span>
                                            <span>Graduate to Main</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleMoveToReserve(player)}
                                            title="Move to Reserve Squad"
                                            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:hover:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                        >
                                            <span>⬇️</span>
                                            <span>Move to Reserve</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => openEdit(player)}
                                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                                    >
                                        <PencilSquareIcon className="w-4 h-4" />
                                        <span>Edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(player.id)}
                                        className="px-3 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
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
                <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden" data-dialog onClick={() => setShowModal(false)}>
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Primary Role</label>
                                    <select
                                        value={form.position}
                                        onChange={e => {
                                            const newPos = e.target.value;
                                            setField('position', newPos);
                                            if (form.secondary_position === newPos) {
                                                setField('secondary_position', '');
                                            }
                                        }}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red text-sm font-semibold"
                                    >
                                        <option value="" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">Select Primary Role...</option>
                                        {POSITIONS.map(p => <option key={p} value={p} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        Secondary Role <span className="text-xs font-normal text-gray-400">(Optional)</span>
                                    </label>
                                    <select
                                        value={form.secondary_position}
                                        onChange={e => setField('secondary_position', e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red text-sm font-semibold"
                                    >
                                        <option value="" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">None (No Secondary Role)</option>
                                        {POSITIONS.filter(p => p !== form.position).map(p => (
                                            <option key={p} value={p} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">{p}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Gender</label>
                                    <select value={form.gender} onChange={e => setField('gender', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red text-sm font-semibold">
                                        <option value="" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">Select...</option>
                                        <option value="M" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">Male (M)</option>
                                        <option value="F" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">Female (F)</option>
                                    </select>
                                </div>
                                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 p-2">
                                    <span>⚡ <strong>Allrounders Rule:</strong> Teams are limited to a maximum of 6 Allrounders (combined main & secondary roles).</span>
                                </div>
                            </div>
                            <div>
                                <ImageUploadField
                                    label="Player Image"
                                    value={form.image}
                                    onChange={(url) => setField('image', url)}
                                    folder="players"
                                    helperText="Upload a profile photo."
                                    isCommitted={saving}
                                />
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
