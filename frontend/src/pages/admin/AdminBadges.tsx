import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getAdminBadges,
    createAdminBadge,
    updateAdminBadge,
    deleteAdminBadge,
    awardAdminBadge,
    getAdminBadgeAwards,
    deleteAdminBadgeAward,
    backfillMVPBadges,
    getCompetitions,
    getAllEventDays,
    getPlayers,
    type Badge,
    type PlayerBadgeAward,
    type CreateBadgePayload,
    type Competition,
    type EventDayResponse,
    type Player,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { ImageUploadField } from '../../components/ui/ImageUploadField';
import { BadgeImage, isBadgeImageUrl } from '../../components/common/BadgeImage';
import {
    PlusIcon,
    TrashIcon,
    PencilSquareIcon,
    CheckCircleIcon,
    XCircleIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    GiftIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';

const COLOR_SCHEMES = [
    { value: 'gold', label: 'Gold (Amber)', bg: 'bg-amber-400/20 text-amber-500 border-amber-400/40' },
    { value: 'red', label: 'Showtime Red', bg: 'bg-red-500/20 text-red-500 border-red-500/40' },
    { value: 'blue', label: 'Showtime Navy/Blue', bg: 'bg-blue-500/20 text-blue-500 border-blue-500/40' },
    { value: 'green', label: 'Emerald Green', bg: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40' },
];

export interface OfficialBadgePreset {
    code: string;
    name: string;
    filename: string;
    imageUrl: string;
    localUrl: string;
    category: string;
    color_scheme: string;
    description: string;
}

export const OFFICIAL_BADGE_PRESETS: OfficialBadgePreset[] = [
    {
        code: 'MVP',
        name: 'Game MVP',
        filename: 'game-mvp.png',
        imageUrl: 'https://cdn.sffl.football/badges/game-mvp.png',
        localUrl: '/badges/game-mvp.png',
        category: 'Honors',
        color_scheme: 'gold',
        description: 'Awarded to the most valuable player of an official match',
    },
    {
        code: 'POTW',
        name: 'Player of the Week',
        filename: 'player-of-the-week.png',
        imageUrl: 'https://cdn.sffl.football/badges/player-of-the-week.png',
        localUrl: '/badges/player-of-the-week.png',
        category: 'Honors',
        color_scheme: 'gold',
        description: 'Selected as the standout Player of the Week in the Showtime Team of the Week',
    },
    {
        code: 'TOTW',
        name: 'Team of the Week',
        filename: 'team-of-the-week.png',
        imageUrl: 'https://cdn.sffl.football/badges/team-of-the-week.png',
        localUrl: '/badges/team-of-the-week.png',
        category: 'Honors',
        color_scheme: 'red',
        description: 'Selected as one of the top 14 players of the gameday Starting XIV',
    },
    {
        code: 'TOTS',
        name: 'Team of the Season',
        filename: 'team-of-the-season.png',
        imageUrl: 'https://cdn.sffl.football/badges/team-of-the-season.png',
        localUrl: '/badges/team-of-the-season.png',
        category: 'Honors',
        color_scheme: 'gold',
        description: 'Selected in the prestigious Showtime Team of the Season roster',
    },
    {
        code: 'DPOY',
        name: 'Best Defender',
        filename: 'best-defender.png',
        imageUrl: 'https://cdn.sffl.football/badges/best-defender.png',
        localUrl: '/badges/best-defender.png',
        category: 'Defence',
        color_scheme: 'blue',
        description: 'Honoring the premier defensive playmaker of the season',
    },
    {
        code: 'OPOY',
        name: 'Best Receiver',
        filename: 'best-receiver.png',
        imageUrl: 'https://cdn.sffl.football/badges/best-receiver.png',
        localUrl: '/badges/best-receiver.png',
        category: 'Offence',
        color_scheme: 'red',
        description: 'Honoring the most outstanding pass-catcher and scoring receiver of the season',
    },
    {
        code: 'BEST_RUSHER',
        name: 'Best Rusher',
        filename: 'best-rusher.png',
        imageUrl: 'https://cdn.sffl.football/badges/best-rusher.png',
        localUrl: '/badges/best-rusher.png',
        category: 'Defence',
        color_scheme: 'red',
        description: 'Awarded to the fiercest defensive pass rusher of the season',
    },
    {
        code: 'BEST_CENTER',
        name: 'Best Center',
        filename: 'best-center.png',
        imageUrl: 'https://cdn.sffl.football/badges/best-center.png',
        localUrl: '/badges/best-center.png',
        category: 'Offence',
        color_scheme: 'blue',
        description: 'Awarded to the premier offensive lineman / center of the season',
    },
    {
        code: 'ROOKIE_OF_THE_SEASON',
        name: 'Rookie of the Season',
        filename: 'rookie-of-the-season.png',
        imageUrl: 'https://cdn.sffl.football/badges/rookie-of-the-season.png',
        localUrl: '/badges/rookie-of-the-season.png',
        category: 'Honors',
        color_scheme: 'gold',
        description: 'Awarded to the most outstanding newcomer across the league',
    },
    {
        code: 'TOURNAMENT_MVP',
        name: 'Tournament MVP',
        filename: 'tournament-mvp.png',
        imageUrl: 'https://cdn.sffl.football/badges/tournament-mvp.png',
        localUrl: '/badges/tournament-mvp.png',
        category: 'Honors',
        color_scheme: 'gold',
        description: 'Awarded to the most valuable player across tournament knockout championship play',
    },
];

// Awards rebuilt from their source (match MVP, published TOTW) can't be revoked
// here — the next sync would bring them back. The backend refuses them too.
const isAutomaticAward = (award: PlayerBadgeAward) =>
    !!award.totw_id || (award.badge?.code === 'MVP' && !!award.match_id);

export const AdminBadges = () => {
    const queryClient = useQueryClient();

    // View state
    const [activeTab, setActiveTab] = useState<'catalog' | 'awards'>('catalog');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Modals
    const [showBadgeModal, setShowBadgeModal] = useState(false);
    const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
    const [badgeForm, setBadgeForm] = useState<CreateBadgePayload>({
        code: '',
        name: '',
        description: '',
        icon: '',
        color_scheme: 'gold',
        category: 'Honors',
    });

    const [showAwardModal, setShowAwardModal] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [awardBadgeId, setAwardBadgeId] = useState('');
    const [awardCompId, setAwardCompId] = useState('');
    const [awardSeason, setAwardSeason] = useState(new Date().getFullYear().toString());
    const [awardEventDayId, setAwardEventDayId] = useState('');
    const [awardReason, setAwardReason] = useState('');
    const [awardCount, setAwardCount] = useState(1);

    // Player search inside award modal
    const [playerSearchQuery, setPlayerSearchQuery] = useState('');

    // Queries
    const { data: badges = [], isLoading: loadingBadges } = useQuery<Badge[]>({
        queryKey: ['adminBadges'],
        queryFn: getAdminBadges,
    });

    const { data: awardsResult, isLoading: loadingAwards } = useQuery({
        queryKey: ['adminBadgeAwards'],
        queryFn: () => getAdminBadgeAwards({ page: 1, limit: 100 }),
    });
    const awards: PlayerBadgeAward[] = awardsResult?.data || [];

    const { data: competitionsData } = useQuery({
        queryKey: ['adminCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions: Competition[] = competitionsData?.data || [];

    const { data: eventDays = [] } = useQuery<EventDayResponse[]>({
        queryKey: ['adminAllEventDays'],
        queryFn: getAllEventDays,
    });

    const { data: playersData, isLoading: loadingPlayers } = useQuery({
        queryKey: ['adminPlayersAwardPicker', playerSearchQuery],
        queryFn: () => getPlayers(undefined, 1, 40, playerSearchQuery || undefined),
        enabled: showAwardModal && !selectedPlayer,
    });
    const availablePlayers: Player[] = playersData?.data || [];

    // Mutations
    const saveBadgeMutation = useMutation({
        mutationFn: async () => {
            if (editingBadge) {
                return updateAdminBadge(editingBadge.id, {
                    name: badgeForm.name,
                    description: badgeForm.description,
                    icon: badgeForm.icon,
                    color_scheme: badgeForm.color_scheme,
                    category: badgeForm.category,
                });
            } else {
                return createAdminBadge(badgeForm);
            }
        },
        onSuccess: () => {
            setStatusMessage({
                type: 'success',
                text: editingBadge ? 'Badge updated successfully.' : 'New badge created successfully.',
            });
            queryClient.invalidateQueries({ queryKey: ['adminBadges'] });
            setShowBadgeModal(false);
            setEditingBadge(null);
        },
        onError: (err: any) => {
            setStatusMessage({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to save badge.',
            });
        },
    });

    const deleteBadgeMutation = useMutation({
        mutationFn: (id: string) => deleteAdminBadge(id),
        onSuccess: () => {
            setStatusMessage({ type: 'success', text: 'Badge removed from catalog.' });
            queryClient.invalidateQueries({ queryKey: ['adminBadges'] });
        },
        onError: (err: any) => {
            setStatusMessage({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to delete badge.',
            });
        },
    });

    const awardMutation = useMutation({
        mutationFn: async () => {
            if (!selectedPlayer) throw new Error('Please select a player.');
            if (!awardBadgeId) throw new Error('Please select a badge to award.');
            return awardAdminBadge({
                player_id: selectedPlayer.id,
                badge_id: awardBadgeId,
                competition_id: awardCompId || undefined,
                season: awardSeason || undefined,
                event_day_id: awardEventDayId || undefined,
                reason: awardReason || undefined,
                count: awardCount || 1,
            });
        },
        onSuccess: () => {
            setStatusMessage({
                type: 'success',
                text: `Badge successfully awarded to ${selectedPlayer?.name}!`,
            });
            queryClient.invalidateQueries({ queryKey: ['adminBadgeAwards'] });
            queryClient.invalidateQueries({ queryKey: ['adminBadges'] });
            setShowAwardModal(false);
            setSelectedPlayer(null);
            setAwardReason('');
            setAwardCount(1);
        },
        onError: (err: any) => {
            setStatusMessage({
                type: 'error',
                text: err?.message || err?.response?.data?.error || 'Failed to award badge.',
            });
        },
    });

    const deleteAwardMutation = useMutation({
        mutationFn: (id: string) => deleteAdminBadgeAward(id),
        onSuccess: () => {
            setStatusMessage({ type: 'success', text: 'Award revoked and player badge counter decremented.' });
            queryClient.invalidateQueries({ queryKey: ['adminBadgeAwards'] });
            queryClient.invalidateQueries({ queryKey: ['adminBadges'] });
        },
        onError: (err: any) => {
            setStatusMessage({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to revoke award.',
            });
        },
    });

    const backfillMutation = useMutation({
        mutationFn: backfillMVPBadges,
        onSuccess: (data) => {
            setStatusMessage({
                type: 'success',
                text: `${data.message} (${data.updated_players} players updated with their historical match MVPs).`,
            });
            queryClient.invalidateQueries({ queryKey: ['adminBadges'] });
            queryClient.invalidateQueries({ queryKey: ['adminBadgeAwards'] });
        },
        onError: (err: any) => {
            setStatusMessage({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to run MVP backfill.',
            });
        },
    });

    const openCreateBadge = () => {
        setEditingBadge(null);
        setBadgeForm({
            code: '',
            name: '',
            description: '',
            icon: '',
            color_scheme: 'gold',
            category: 'Honors',
        });
        setShowBadgeModal(true);
    };

    const openEditBadge = (badge: Badge) => {
        setEditingBadge(badge);
        setBadgeForm({
            code: badge.code,
            name: badge.name,
            description: badge.description || '',
            icon: badge.icon || '',
            color_scheme: badge.color_scheme || 'gold',
            category: badge.category || 'Honors',
        });
        setShowBadgeModal(true);
    };

    const openAwardModal = (defaultBadgeId?: string) => {
        setSelectedPlayer(null);
        setPlayerSearchQuery('');
        setAwardBadgeId(defaultBadgeId || badges[0]?.id || '');
        setAwardCompId(competitions[0]?.id || '');
        setAwardEventDayId('');
        setAwardSeason(new Date().getFullYear().toString());
        setAwardReason('');
        setAwardCount(1);
        setShowAwardModal(true);
    };

    const systemBadges = badges.filter((b) => b.is_system);
    const customBadges = badges.filter((b) => !b.is_system);

    return (
        <div className="space-y-6 md:space-y-8 animate-fade-in pb-16">
            {/* Header Banner following DESIGN_SYSTEM.md */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-sffl-navy text-white p-6 md:p-8 rounded-xl md:rounded-2xl shadow-xl gap-4">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">BADGES & HONORS</h1>
                    <p className="text-gray-300 mt-1 text-sm md:text-base">
                        Manage player accolades, MVP counters, Team of the Week/Season badges, and custom league honors
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm('Backfill all 2026 match MVPs into player badge profiles? Only matches from 2026 will receive the MVP badge.')) {
                                backfillMutation.mutate();
                            }
                        }}
                        disabled={backfillMutation.isPending}
                        className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Scan finished 2026 matches and award MVP badges to players"
                    >
                        <SparklesIcon className="w-4 h-4" />
                        <span>{backfillMutation.isPending ? 'Backfilling…' : 'Backfill 2026 MVPs'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => openAwardModal()}
                        className="px-4 py-2.5 bg-white hover:bg-gray-100 text-sffl-navy font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                        <GiftIcon className="w-4 h-4 text-sffl-red" />
                        <span>Award Badge</span>
                    </button>
                    <button
                        type="button"
                        onClick={openCreateBadge}
                        className="px-4 py-2.5 bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                        <PlusIcon className="w-4 h-4 stroke-[2.5]" />
                        <span>Create Badge</span>
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {statusMessage && (
                <div
                    className={`p-4 rounded-xl flex items-center justify-between font-bold text-sm border shadow-sm ${
                        statusMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {statusMessage.type === 'success' ? (
                            <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                            <XCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                        )}
                        <span>{statusMessage.text}</span>
                    </div>
                    <button
                        onClick={() => setStatusMessage(null)}
                        className="text-xs uppercase tracking-wider font-black opacity-75 hover:opacity-100 cursor-pointer"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Accolade Overview Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                    <div className="text-2xl md:text-3xl font-black text-sffl-navy dark:text-white">
                        {systemBadges.length}
                    </div>
                    <div className="text-[10px] md:text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                        System Badges
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                    <div className="text-2xl md:text-3xl font-black text-sffl-red">
                        {customBadges.length}
                    </div>
                    <div className="text-[10px] md:text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                        Custom Badges
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                    <div className="text-2xl md:text-3xl font-black text-amber-500">
                        {awards.length}
                    </div>
                    <div className="text-[10px] md:text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                        Total Awards Logged
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-center">
                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>Auto-Sync Active</span>
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 mt-1">
                        Match MVPs & TOTWs auto-increment
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                <button
                    onClick={() => setActiveTab('catalog')}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                        activeTab === 'catalog'
                            ? 'bg-sffl-red text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                >
                    Badge Catalog ({badges.length})
                </button>
                <button
                    onClick={() => setActiveTab('awards')}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                        activeTab === 'awards'
                            ? 'bg-sffl-red text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                >
                    Award History & Log ({awards.length})
                </button>
            </div>

            {/* ── CATALOG TAB ────────────────────────────────────────────── */}
            {activeTab === 'catalog' && (
                <div className="space-y-6">
                    {loadingBadges ? (
                        <Loader />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {badges.map((b) => (
                                <div
                                    key={b.id}
                                    className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-14 h-14 p-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-inner flex items-center justify-center shrink-0">
                                                    <BadgeImage icon={b.icon} name={b.name} className="w-10 h-10 text-3xl" />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-base text-sffl-navy dark:text-white leading-tight">
                                                        {b.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                            {b.category || 'Honors'}
                                                        </span>
                                                        {b.is_system && (
                                                            <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                                System Auto
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3 mb-4">
                                            {b.description || 'No description provided.'}
                                        </p>
                                    </div>

                                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                                        <span className="text-[10px] font-mono text-gray-400 font-bold uppercase">
                                            CODE: {b.code}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openAwardModal(b.id)}
                                                className="px-2.5 py-1 text-[11px] font-bold text-sffl-red bg-red-50 dark:bg-red-950/30 rounded hover:bg-red-100 transition-colors cursor-pointer"
                                            >
                                                Award →
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openEditBadge(b)}
                                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                                                title="Edit Badge"
                                            >
                                                <PencilSquareIcon className="w-4 h-4" />
                                            </button>
                                            {!b.is_system && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (
                                                            confirm(
                                                                `Delete badge "${b.name}"? Player accolades attached to it will be removed.`
                                                            )
                                                        ) {
                                                            deleteBadgeMutation.mutate(b.id);
                                                        }
                                                    }}
                                                    className="p-1 text-red-400 hover:text-red-600 cursor-pointer"
                                                    title="Delete Custom Badge"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── AWARDS AUDIT LOG TAB ────────────────────────────────────── */}
            {activeTab === 'awards' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                    {loadingAwards ? (
                        <Loader />
                    ) : awards.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                            <div className="text-4xl mb-3">🏅</div>
                            <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-1">
                                No Badge Awards Recorded Yet
                            </h3>
                            <p className="text-xs text-gray-400 max-w-sm mx-auto mb-6">
                                Awards are logged when you manually award a badge or when match MVPs and TOTWs are synced.
                            </p>
                            <button
                                onClick={() => openAwardModal()}
                                className="px-4 py-2 bg-sffl-red hover:bg-[#A52323] text-white font-bold text-xs rounded-lg shadow-md transition-colors cursor-pointer"
                            >
                                Award First Badge
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                                        <th className="py-4 px-6">Player</th>
                                        <th className="py-4 px-6">Badge</th>
                                        <th className="py-4 px-6">Season / Context</th>
                                        <th className="py-4 px-6">Reason / Note</th>
                                        <th className="py-4 px-6">Date Awarded</th>
                                        <th className="py-4 px-6 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-sm font-medium">
                                    {awards.map((award) => (
                                        <tr
                                            key={award.id}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                        >
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0">
                                                        {award.player?.image ? (
                                                            <img
                                                                src={award.player.image}
                                                                alt={award.player.name}
                                                                className="w-full h-full object-cover object-top"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-xs font-black text-gray-400">
                                                                #{award.player?.jersey_number || '?'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-sffl-navy dark:text-white">
                                                            {award.player?.name || 'Player'}
                                                        </div>
                                                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                                            {award.player?.position} {award.player?.team?.name && `• ${award.player.team.name}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <BadgeImage icon={award.badge?.icon} name={award.badge?.name} className="w-6 h-6 text-xl" />
                                                    <span className="font-bold text-gray-900 dark:text-white">
                                                        {award.badge?.name || 'Badge'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-xs text-gray-600 dark:text-gray-300">
                                                {award.competition?.name || award.competition_name || award.season || 'League'}
                                            </td>
                                            <td className="py-4 px-6 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                {award.reason || '—'}
                                            </td>
                                            <td className="py-4 px-6 text-xs text-gray-500 dark:text-gray-400">
                                                {new Date(award.created_at).toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                })}
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                {isAutomaticAward(award) ? (
                                                    <span
                                                        className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500"
                                                        title={award.totw_id
                                                            ? 'Comes from a Team of the Week edition. Remove the player from it or unpublish it to revoke.'
                                                            : 'Comes from the match MVP. Change the MVP on the match to revoke.'}
                                                    >
                                                        Auto
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (
                                                                confirm(
                                                                    `Revoke this award from ${award.player?.name || 'player'}? This will decrement their badge counter.`
                                                                )
                                                            ) {
                                                                deleteAwardMutation.mutate(award.id);
                                                            }
                                                        }}
                                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                        title="Revoke Award"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── CREATE / EDIT BADGE MODAL ──────────────────────────────── */}
            {showBadgeModal && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setShowBadgeModal(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-sffl-navy dark:text-white">
                                    {editingBadge ? 'Edit Badge' : 'Create Badge'}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Select an official Showtime badge design or upload custom artwork
                                </p>
                            </div>
                            <button
                                onClick={() => setShowBadgeModal(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 md:p-6 space-y-5 overflow-y-auto flex-1">
                            {/* ── Official Badge Presets Gallery ──────────────── */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                        Official Showtime Badges (Click to Select) *
                                    </label>
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                        10 official emblems
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 max-h-56 overflow-y-auto">
                                    {OFFICIAL_BADGE_PRESETS.map((preset) => {
                                        const isSelected =
                                            badgeForm.icon === preset.imageUrl ||
                                            badgeForm.icon === preset.localUrl ||
                                            badgeForm.icon?.endsWith(preset.filename);
                                        return (
                                            <button
                                                key={preset.code}
                                                type="button"
                                                onClick={() => {
                                                    setBadgeForm((p) => ({
                                                        ...p,
                                                        icon: preset.imageUrl,
                                                        name: !editingBadge || !p.name ? preset.name : p.name,
                                                        code: !editingBadge && !p.code ? preset.code : p.code,
                                                        category: preset.category,
                                                        color_scheme: preset.color_scheme,
                                                        description: !p.description ? preset.description : p.description,
                                                    }));
                                                }}
                                                className={`group relative p-2.5 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-400/50 shadow-md'
                                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-amber-400 hover:scale-[1.02]'
                                                }`}
                                            >
                                                <div className="w-12 h-12 flex items-center justify-center p-1">
                                                    <img
                                                        src={preset.localUrl}
                                                        alt={preset.name}
                                                        className="w-full h-full object-contain drop-shadow-xs"
                                                        onError={(e) => {
                                                            (e.currentTarget as HTMLImageElement).src = preset.imageUrl;
                                                        }}
                                                    />
                                                </div>
                                                <span className="mt-1.5 text-[10px] font-black leading-tight text-gray-900 dark:text-gray-100 line-clamp-2">
                                                    {preset.name}
                                                </span>
                                                {isSelected && (
                                                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-sffl-navy flex items-center justify-center text-[10px] font-black shadow-xs">
                                                        ✓
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Active Emblem Preview & Custom Upload ───────── */}
                            <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                {badgeForm.icon ? (
                                    <div className="flex items-center gap-3 p-3 bg-amber-500/10 dark:bg-amber-500/5 rounded-xl border border-amber-400/40">
                                        <div className="w-14 h-14 p-1 rounded-xl bg-white dark:bg-gray-800 border border-amber-400/50 flex items-center justify-center shrink-0 shadow-sm">
                                            <BadgeImage icon={badgeForm.icon} name="Preview" className="w-full h-full text-2xl" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-gray-900 dark:text-white truncate">
                                                    {badgeForm.name || 'Selected Badge'}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-400/20 text-amber-700 dark:text-amber-300">
                                                    Active Artwork
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate font-mono mt-0.5">
                                                {badgeForm.icon}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-center text-xs text-gray-500 dark:text-gray-400">
                                        No emblem selected. Click one of the official badges above or upload custom artwork below.
                                    </div>
                                )}

                                <ImageUploadField
                                    label="Or Upload Custom Badge Artwork to R2"
                                    value={badgeForm.icon || ''}
                                    onChange={(url) => setBadgeForm((p) => ({ ...p, icon: url }))}
                                    folder="badges"
                                    helperText="Upload a crisp square badge emblem (PNG, WebP, SVG with transparent background recommended)"
                                />
                            </div>

                            {/* ── Badge Metadata ─────────────────────────────── */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                                {!editingBadge && (
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                            Badge Code (Unique ID) *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. GAME_MVP"
                                            value={badgeForm.code}
                                            onChange={(e) =>
                                                setBadgeForm((p) => ({
                                                    ...p,
                                                    code: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                                                }))
                                            }
                                            className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-sffl-red"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                        Badge Name *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Game MVP"
                                        value={badgeForm.name}
                                        onChange={(e) => setBadgeForm((p) => ({ ...p, name: e.target.value }))}
                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={badgeForm.category}
                                        onChange={(e) => setBadgeForm((p) => ({ ...p, category: e.target.value }))}
                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                                    >
                                        <option value="Honors">Honors</option>
                                        <option value="Match Honor">Match Honor</option>
                                        <option value="Weekly Honor">Weekly Honor</option>
                                        <option value="Season Honor">Season Honor</option>
                                        <option value="Tournament Honor">Tournament Honor</option>
                                        <option value="Offence">Offence</option>
                                        <option value="Defence">Defence</option>
                                        <option value="Milestone">Milestone</option>
                                        <option value="Special">Special Award</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                        Color Theme
                                    </label>
                                    <select
                                        value={badgeForm.color_scheme}
                                        onChange={(e) => setBadgeForm((p) => ({ ...p, color_scheme: e.target.value }))}
                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                                    >
                                        {COLOR_SCHEMES.map((cs) => (
                                            <option key={cs.value} value={cs.value}>
                                                {cs.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                    Description
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Describe the criteria or achievement required for this honor..."
                                    value={badgeForm.description}
                                    onChange={(e) => setBadgeForm((p) => ({ ...p, description: e.target.value }))}
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sffl-red"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowBadgeModal(false)}
                                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 rounded-lg cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => saveBadgeMutation.mutate()}
                                disabled={!badgeForm.name.trim() || !(badgeForm.icon || '').trim() || (!editingBadge && !badgeForm.code.trim())}
                                className="px-5 py-2 bg-sffl-red hover:bg-[#A52323] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {editingBadge ? 'Save Changes' : 'Create Badge'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MANUAL AWARD MODAL ─────────────────────────────────────── */}
            {showAwardModal && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setShowAwardModal(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-sffl-navy dark:text-white">
                                    Award Badge to Player
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Increments the player's accolade counter and logs audit record
                                </p>
                            </div>
                            <button
                                onClick={() => setShowAwardModal(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            {/* Player Selector */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                    Target Player *
                                </label>
                                {selectedPlayer ? (
                                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden shrink-0">
                                                {selectedPlayer.image ? (
                                                    <img
                                                        src={selectedPlayer.image}
                                                        alt={selectedPlayer.name}
                                                        className="w-full h-full object-cover object-top"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center font-black text-xs text-gray-400">
                                                        #{selectedPlayer.jersey_number || '?'}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-black text-sm text-sffl-navy dark:text-white">
                                                    {selectedPlayer.name}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {selectedPlayer.position} • {selectedPlayer.team?.name || 'Free Agent'}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedPlayer(null)}
                                            className="text-xs font-bold text-sffl-red hover:underline cursor-pointer"
                                        >
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search player name..."
                                                value={playerSearchQuery}
                                                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-9 pr-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                                            />
                                        </div>
                                        <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                                            {loadingPlayers ? (
                                                <div className="p-4 text-center text-xs text-gray-400">Loading…</div>
                                            ) : availablePlayers.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-gray-400">No players found</div>
                                            ) : (
                                                availablePlayers.map((p) => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => setSelectedPlayer(p)}
                                                        className="w-full flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/60 text-left text-xs cursor-pointer"
                                                    >
                                                        <span className="font-bold text-gray-900 dark:text-white">
                                                            {p.name} ({p.position})
                                                        </span>
                                                        <span className="text-[11px] text-gray-400">
                                                            {p.team?.short_name || p.team?.name || 'Free Agent'}
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Badge Selection */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                    Honor / Badge to Award *
                                </label>
                                <select
                                    value={awardBadgeId}
                                    onChange={(e) => setAwardBadgeId(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                                >
                                    <option value="">Select Badge</option>
                                    {badges.map((b) => {
                                        const isImg = isBadgeImageUrl(b.icon);
                                        return (
                                            <option key={b.id} value={b.id}>
                                                {isImg ? '🏷️' : b.icon || '🏆'} {b.name} ({b.code})
                                            </option>
                                        );
                                    })}
                                </select>
                                {badges.find((b) => b.id === awardBadgeId) && (
                                    <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 mt-2">
                                        <div className="w-10 h-10 p-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center shrink-0 shadow-xs">
                                            <BadgeImage
                                                icon={badges.find((b) => b.id === awardBadgeId)?.icon}
                                                name={badges.find((b) => b.id === awardBadgeId)?.name}
                                                className="w-full h-full text-xl"
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-black text-sffl-navy dark:text-white">
                                                {badges.find((b) => b.id === awardBadgeId)?.name}
                                            </div>
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                {badges.find((b) => b.id === awardBadgeId)?.description || 'No description'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Context: Competition & Season */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                        Competition
                                    </label>
                                    <select
                                        value={awardCompId}
                                        onChange={(e) => setAwardCompId(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                                    >
                                        <option value="">None / General</option>
                                        {competitions.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                        Season Year
                                    </label>
                                    <input
                                        type="text"
                                        value={awardSeason}
                                        onChange={(e) => setAwardSeason(e.target.value)}
                                        placeholder="2026"
                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                                    />
                                </div>
                            </div>

                            {/* Optional Event Day */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                    Linked Event Day (Optional)
                                </label>
                                <select
                                    value={awardEventDayId}
                                    onChange={(e) => setAwardEventDayId(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                                >
                                    <option value="">None</option>
                                    {eventDays.map((ed) => (
                                        <option key={ed.id} value={ed.id}>
                                            {ed.title || ed.date} ({new Date(ed.date).toLocaleDateString()})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Count & Reason */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                        Add Count
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={awardCount}
                                        onChange={(e) => setAwardCount(parseInt(e.target.value) || 1)}
                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-sffl-red"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                        Award Reason / Citation
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 5 Touchdown performance"
                                        value={awardReason}
                                        onChange={(e) => setAwardReason(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowAwardModal(false)}
                                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 rounded-lg cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => awardMutation.mutate()}
                                disabled={!selectedPlayer || !awardBadgeId || awardMutation.isPending}
                                className="px-5 py-2 bg-sffl-red hover:bg-[#A52323] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {awardMutation.isPending ? 'Awarding…' : 'Award Honor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
