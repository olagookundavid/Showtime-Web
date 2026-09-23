import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getAdminTOTWs,
    getAdminTOTWById,
    createAdminTOTW,
    updateAdminTOTW,
    deleteAdminTOTW,
    publishAdminTOTW,
    getCompetitions,
    getAllEventDays,
    getPlayers,
    getAdminPlayerDayStats,
    type TOTWListItem,
    type TOTWPlayerSlot,
    type Competition,
    type EventDayResponse,
    type Player,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import {
    PlusIcon,
    TrashIcon,
    PencilSquareIcon,
    CheckCircleIcon,
    XCircleIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    SparklesIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';

export const DEFAULT_TOTW_SLOTS: Array<{
    slot_code: string;
    position: string;
    unit: 'Offence' | 'Defence';
    coord_x: string;
    coord_y: string;
    default_stat1_label: string;
    default_stat2_label: string;
    default_stat3_label: string;
}> = [
    // Offence (7)
    { slot_code: 'QB', position: 'QB', unit: 'Offence', coord_x: '50%', coord_y: '86%', default_stat1_label: 'Pass TD', default_stat2_label: 'Pass Yds', default_stat3_label: 'Cmp %' },
    { slot_code: 'FQB', position: 'FQB/RB', unit: 'Offence', coord_x: '32%', coord_y: '86%', default_stat1_label: 'Rush Yds', default_stat2_label: 'Rush TD', default_stat3_label: 'Catches' },
    { slot_code: 'C', position: 'C', unit: 'Offence', coord_x: '50%', coord_y: '68%', default_stat1_label: 'Catches', default_stat2_label: 'Rec Yds', default_stat3_label: 'Rec TD' },
    { slot_code: 'WR1', position: 'WR', unit: 'Offence', coord_x: '14%', coord_y: '68%', default_stat1_label: 'Catches', default_stat2_label: 'Rec Yds', default_stat3_label: 'Rec TD' },
    { slot_code: 'WR2', position: 'WR', unit: 'Offence', coord_x: '86%', coord_y: '68%', default_stat1_label: 'Catches', default_stat2_label: 'Rec Yds', default_stat3_label: 'Rec TD' },
    { slot_code: 'WR3', position: 'WR', unit: 'Offence', coord_x: '28%', coord_y: '56%', default_stat1_label: 'Catches', default_stat2_label: 'Rec Yds', default_stat3_label: 'Rec TD' },
    { slot_code: 'WR4', position: 'WR', unit: 'Offence', coord_x: '72%', coord_y: '56%', default_stat1_label: 'Catches', default_stat2_label: 'Rec Yds', default_stat3_label: 'Rec TD' },
    // Defence (7)
    { slot_code: 'R', position: 'R', unit: 'Defence', coord_x: '50%', coord_y: '44%', default_stat1_label: 'Sacks', default_stat2_label: 'Flag Pulls', default_stat3_label: 'Pass Def' },
    { slot_code: 'DEF1', position: 'DEF', unit: 'Defence', coord_x: '18%', coord_y: '40%', default_stat1_label: 'Flag Pulls', default_stat2_label: 'Pass Def', default_stat3_label: 'Int' },
    { slot_code: 'DEF2', position: 'DEF', unit: 'Defence', coord_x: '34%', coord_y: '38%', default_stat1_label: 'Flag Pulls', default_stat2_label: 'Pass Def', default_stat3_label: 'Int' },
    { slot_code: 'DEF3', position: 'DEF', unit: 'Defence', coord_x: '66%', coord_y: '38%', default_stat1_label: 'Flag Pulls', default_stat2_label: 'Pass Def', default_stat3_label: 'Int' },
    { slot_code: 'DEF4', position: 'DEF', unit: 'Defence', coord_x: '82%', coord_y: '40%', default_stat1_label: 'Flag Pulls', default_stat2_label: 'Pass Def', default_stat3_label: 'Int' },
    { slot_code: 'S1', position: 'S', unit: 'Defence', coord_x: '32%', coord_y: '20%', default_stat1_label: 'Int', default_stat2_label: 'Flag Pulls', default_stat3_label: 'Pass Def' },
    { slot_code: 'S2', position: 'S', unit: 'Defence', coord_x: '68%', coord_y: '20%', default_stat1_label: 'Int', default_stat2_label: 'Flag Pulls', default_stat3_label: 'Pass Def' },
];

// Maps a stat label (as shown on the TOTW card) to the key returned by
// /admin/totw/player-stats. Autofill fills each stat by its label, so the value
// always matches what the card says. 'Tackles' is kept for editions saved before
// the labels were renamed — in flag football a tackle is a flag pull.
const STAT_LABEL_KEYS: Record<string, string> = {
    'pass td': 'pass_td',
    'pass yds': 'pass_yards',
    'cmp %': 'cmp_pct',
    'completions': 'pass_completions',
    'rush yds': 'rush_yards',
    'rush td': 'rush_td',
    'catches': 'catches',
    'rec yds': 'rec_yards',
    'rec td': 'rec_td',
    'sacks': 'sacks',
    'flag pulls': 'flag_pulls',
    'tackles': 'flag_pulls',
    'pass def': 'pass_defended',
    'int': 'interceptions',
};

// Returns the slot with stat values (and rating, when one was computed) filled
// from a day-stats response. Stats whose label has no known key are left as-is.
function applyDayStats<T extends { rating: number; stat1_label?: string; stat1_value?: string; stat2_label?: string; stat2_value?: string; stat3_label?: string; stat3_value?: string }>(
    slot: T,
    stats: Record<string, string>,
): T {
    const valueFor = (label: string | undefined, current: string | undefined) => {
        const key = STAT_LABEL_KEYS[(label || '').trim().toLowerCase()];
        return key && stats[key] !== undefined ? stats[key] : current;
    };
    const rating = stats['rating'] ? parseFloat(stats['rating']) : NaN;
    return {
        ...slot,
        stat1_value: valueFor(slot.stat1_label, slot.stat1_value),
        stat2_value: valueFor(slot.stat2_label, slot.stat2_value),
        stat3_value: valueFor(slot.stat3_label, slot.stat3_value),
        rating: Number.isFinite(rating) ? rating : slot.rating,
    };
}

interface SlotFormData extends TOTWPlayerSlot {
    player_name?: string;
    player_image?: string;
    player_jersey?: number;
    team_name?: string;
}

export const AdminTOTW = () => {
    const queryClient = useQueryClient();

    // Filters & Mode State
    const [selectedCompId, setSelectedCompId] = useState<string>('');
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [editingTotwId, setEditingTotwId] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [formCompId, setFormCompId] = useState<string>('');
    const [formEventDayId, setFormEventDayId] = useState<string>('');
    const [formWeekTitle, setFormWeekTitle] = useState<string>('');
    const [formHeadline, setFormHeadline] = useState<string>('TEAM OF THE WEEK');
    const [formSubHeadline, setFormSubHeadline] = useState<string>('Starting XIV honors for top performers');
    const [formIsPublished, setFormIsPublished] = useState<boolean>(false);
    const [slots, setSlots] = useState<SlotFormData[]>(() =>
        DEFAULT_TOTW_SLOTS.map((s) => ({
            player_id: '',
            slot_code: s.slot_code,
            position: s.position,
            unit: s.unit,
            coord_x: s.coord_x,
            coord_y: s.coord_y,
            rating: 9.0,
            stat1_label: s.default_stat1_label,
            stat1_value: '',
            stat2_label: s.default_stat2_label,
            stat2_value: '',
            stat3_label: s.default_stat3_label,
            stat3_value: '',
        }))
    );

    // Player picker modal state
    const [pickingSlotIndex, setPickingSlotIndex] = useState<number | null>(null);
    const [playerSearchQuery, setPlayerSearchQuery] = useState<string>('');
    const [previewMode, setPreviewMode] = useState<boolean>(false);

    // Queries
    const { data: competitionsData } = useQuery({
        queryKey: ['adminCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions: Competition[] = competitionsData?.data || [];

    const { data: eventDays = [] } = useQuery<EventDayResponse[]>({
        queryKey: ['adminAllEventDays'],
        queryFn: getAllEventDays,
    });

    const { data: totwList = [], isLoading: loadingList } = useQuery<TOTWListItem[]>({
        queryKey: ['adminTOTWList', selectedCompId],
        queryFn: () => getAdminTOTWs(selectedCompId || undefined),
    });

    // Players list for picker
    const { data: playersData, isLoading: loadingPlayers } = useQuery({
        queryKey: ['adminPlayersForPicker', playerSearchQuery],
        queryFn: () => getPlayers(undefined, 1, 60, playerSearchQuery || undefined),
    });
    const availablePlayers: Player[] = playersData?.data || [];

    // Mutations
    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteAdminTOTW(id),
        onSuccess: () => {
            setStatusMessage({ type: 'success', text: 'Team of the Week edition deleted.' });
            queryClient.invalidateQueries({ queryKey: ['adminTOTWList'] });
            queryClient.invalidateQueries({ queryKey: ['totw'] });
            queryClient.invalidateQueries({ queryKey: ['totwArchive'] });
        },
        onError: (err: any) => {
            setStatusMessage({ type: 'error', text: err?.response?.data?.error || 'Failed to delete Team of the Week.' });
        },
    });

    const publishMutation = useMutation({
        mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
            publishAdminTOTW(id, isPublished),
        onSuccess: (data) => {
            setStatusMessage({
                type: 'success',
                text: data.is_published ? 'Edition published successfully! Badges synced.' : 'Edition set to draft.',
            });
            queryClient.invalidateQueries({ queryKey: ['adminTOTWList'] });
            queryClient.invalidateQueries({ queryKey: ['totw'] });
            queryClient.invalidateQueries({ queryKey: ['totwArchive'] });
        },
        onError: (err: any) => {
            setStatusMessage({ type: 'error', text: err?.response?.data?.error || 'Failed to toggle publish status.' });
        },
    });

    // Initialize or Reset Form
    const handleNewTOTW = () => {
        setIsEditing(true);
        setEditingTotwId(null);
        setFormCompId(selectedCompId || competitions[0]?.id || '');
        setFormEventDayId('');
        setFormWeekTitle('Week ' + (totwList.length + 1));
        setFormHeadline('TEAM OF THE WEEK');
        setFormSubHeadline('Starting XIV honors for top performers');
        setFormIsPublished(false);
        setSlots(
            DEFAULT_TOTW_SLOTS.map((s) => ({
                player_id: '',
                slot_code: s.slot_code,
                position: s.position,
                unit: s.unit,
                coord_x: s.coord_x,
                coord_y: s.coord_y,
                rating: 9.0,
                stat1_label: s.default_stat1_label,
                stat1_value: '',
                stat2_label: s.default_stat2_label,
                stat2_value: '',
                stat3_label: s.default_stat3_label,
                stat3_value: '',
            }))
        );
        setStatusMessage(null);
    };

    const handleEditTOTW = async (id: string) => {
        try {
            setStatusMessage(null);
            const fullTotw = await getAdminTOTWById(id);
            setEditingTotwId(fullTotw.id);
            setFormCompId(fullTotw.competition_id);
            setFormEventDayId(fullTotw.event_day_id || '');
            setFormWeekTitle(fullTotw.week_title);
            setFormHeadline(fullTotw.headline || 'TEAM OF THE WEEK');
            setFormSubHeadline(fullTotw.sub_headline || '');
            setFormIsPublished(fullTotw.is_published);

            // Map loaded players onto the 14 default slots
            const newSlots: SlotFormData[] = DEFAULT_TOTW_SLOTS.map((defaultSlot) => {
                const found = fullTotw.players?.find(
                    (p) => p.slot_code === defaultSlot.slot_code || p.position === defaultSlot.position
                );
                if (found) {
                    return {
                        player_id: found.player_id,
                        slot_code: found.slot_code || defaultSlot.slot_code,
                        position: found.position || defaultSlot.position,
                        unit: (found.unit as 'Offence' | 'Defence') || defaultSlot.unit,
                        coord_x: found.coord_x || defaultSlot.coord_x,
                        coord_y: found.coord_y || defaultSlot.coord_y,
                        rating: found.rating || 9.0,
                        stat1_label: found.stat1_label || defaultSlot.default_stat1_label,
                        stat1_value: found.stat1_value || '',
                        stat2_label: found.stat2_label || defaultSlot.default_stat2_label,
                        stat2_value: found.stat2_value || '',
                        stat3_label: found.stat3_label || defaultSlot.default_stat3_label,
                        stat3_value: found.stat3_value || '',
                        player_name: found.player?.name,
                        player_image: found.player?.image,
                        player_jersey: found.player?.jersey_number,
                        team_name: found.player?.team?.name,
                    };
                }
                return {
                    player_id: '',
                    slot_code: defaultSlot.slot_code,
                    position: defaultSlot.position,
                    unit: defaultSlot.unit,
                    coord_x: defaultSlot.coord_x,
                    coord_y: defaultSlot.coord_y,
                    rating: 9.0,
                    stat1_label: defaultSlot.default_stat1_label,
                    stat1_value: '',
                    stat2_label: defaultSlot.default_stat2_label,
                    stat2_value: '',
                    stat3_label: defaultSlot.default_stat3_label,
                    stat3_value: '',
                };
            });

            setSlots(newSlots);
            setIsEditing(true);
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: 'Failed to load Team of the Week details.' });
        }
    };

    const handleSelectPlayer = (slotIndex: number, player: Player) => {
        setSlots((prev) => {
            const copy = [...prev];
            copy[slotIndex] = {
                ...copy[slotIndex],
                player_id: player.id,
                player_name: player.name,
                player_image: player.image,
                player_jersey: player.jersey_number,
                team_name: player.team?.name,
            };
            return copy;
        });
        setPickingSlotIndex(null);
        setPlayerSearchQuery('');
    };

    const handleClearSlotPlayer = (slotIndex: number) => {
        setSlots((prev) => {
            const copy = [...prev];
            copy[slotIndex] = {
                ...copy[slotIndex],
                player_id: '',
                player_name: undefined,
                player_image: undefined,
                player_jersey: undefined,
                team_name: undefined,
                stat1_value: '',
                stat2_value: '',
                stat3_value: '',
            };
            return copy;
        });
    };

    const handleSlotChange = (slotIndex: number, field: keyof SlotFormData, value: any) => {
        setSlots((prev) => {
            const copy = [...prev];
            copy[slotIndex] = {
                ...copy[slotIndex],
                [field]: value,
            };
            return copy;
        });
    };

    // Auto-fill individual player stats for selected event day
    const handleAutofillSlot = async (slotIndex: number) => {
        const slot = slots[slotIndex];
        if (!slot.player_id) {
            alert('Please select a player for this slot first.');
            return;
        }
        if (!formEventDayId) {
            alert('Please select an Event Day above to autofill match statistics.');
            return;
        }

        try {
            const stats = await getAdminPlayerDayStats(slot.player_id, formEventDayId);
            if (!stats || Object.keys(stats).length === 0) {
                alert('No box score statistics found for this player on the selected Event Day.');
                return;
            }

            setSlots((prev) => {
                const copy = [...prev];
                copy[slotIndex] = applyDayStats(copy[slotIndex], stats);
                return copy;
            });
        } catch (err: any) {
            alert('Could not retrieve player statistics for this Event Day.');
        }
    };

    // Auto-fill all slots that have players assigned
    const handleAutofillAll = async () => {
        if (!formEventDayId) {
            alert('Please select an Event Day first.');
            return;
        }

        const filledSlots = slots
            .map((s, idx) => ({ ...s, index: idx }))
            .filter((s) => s.player_id);

        if (filledSlots.length === 0) {
            alert('No players are assigned to any slots yet.');
            return;
        }

        let updated = 0;
        for (const item of filledSlots) {
            try {
                const stats = await getAdminPlayerDayStats(item.player_id, formEventDayId);
                if (stats && Object.keys(stats).length > 0) {
                    setSlots((prev) => {
                        const copy = [...prev];
                        copy[item.index] = applyDayStats(copy[item.index], stats);
                        return copy;
                    });
                    updated++;
                }
            } catch (e) {
                // Continue to next player
            }
        }

        setStatusMessage({
            type: 'success',
            text: `Autofilled statistics for ${updated} of ${filledSlots.length} players.`,
        });
    };

    // Save TOTW
    const handleSave = async () => {
        if (!formCompId) {
            setStatusMessage({ type: 'error', text: 'Please select a Competition.' });
            return;
        }
        if (!formWeekTitle.trim()) {
            setStatusMessage({ type: 'error', text: 'Please enter a Week Title (e.g. Week 1).' });
            return;
        }

        const validSlots = slots.filter((s) => s.player_id.trim() !== '');
        if (validSlots.length === 0) {
            setStatusMessage({ type: 'error', text: 'Please assign at least one player to the Starting XIV.' });
            return;
        }

        const payload = {
            competition_id: formCompId,
            event_day_id: formEventDayId || undefined,
            week_title: formWeekTitle.trim(),
            headline: formHeadline.trim() || 'TEAM OF THE WEEK',
            sub_headline: formSubHeadline.trim(),
            is_published: formIsPublished,
            players: validSlots.map((s) => ({
                player_id: s.player_id,
                slot_code: s.slot_code,
                position: s.position,
                unit: s.unit,
                coord_x: s.coord_x,
                coord_y: s.coord_y,
                rating: Number(s.rating) || 9.0,
                stat1_label: s.stat1_label || 'Stat 1',
                stat1_value: s.stat1_value || '0',
                stat2_label: s.stat2_label || 'Stat 2',
                stat2_value: s.stat2_value || '0',
                stat3_label: s.stat3_label || 'Stat 3',
                stat3_value: s.stat3_value || '0',
            })),
        };

        try {
            if (editingTotwId) {
                await updateAdminTOTW(editingTotwId, payload);
                setStatusMessage({ type: 'success', text: 'Team of the Week updated successfully!' });
            } else {
                await createAdminTOTW(payload);
                setStatusMessage({ type: 'success', text: 'Team of the Week created successfully!' });
            }
            queryClient.invalidateQueries({ queryKey: ['adminTOTWList'] });
            queryClient.invalidateQueries({ queryKey: ['totw'] });
            queryClient.invalidateQueries({ queryKey: ['totwArchive'] });
            setIsEditing(false);
            setEditingTotwId(null);
        } catch (err: any) {
            setStatusMessage({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to save Team of the Week.',
            });
        }
    };

    return (
        <div className="space-y-6 md:space-y-8 animate-fade-in pb-16">
            {/* Header Banner following DESIGN_SYSTEM.md */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-sffl-navy text-white p-6 md:p-8 rounded-xl md:rounded-2xl shadow-xl gap-4">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">TEAM OF THE WEEK</h1>
                    <p className="text-gray-300 mt-1 text-sm md:text-base">
                        Manage Starting XIV selections, match ratings, and player honours after each game day
                    </p>
                </div>
                {!isEditing && (
                    <button
                        onClick={handleNewTOTW}
                        className="px-5 py-3 bg-sffl-red hover:bg-[#A52323] text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                        <PlusIcon className="w-5 h-5 stroke-[2.5]" />
                        <span>Create New Edition</span>
                    </button>
                )}
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

            {!isEditing ? (
                /* ── LIST VIEW ────────────────────────────────────────────── */
                <div className="space-y-6">
                    {/* Filter controls */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                Filter Competition:
                            </span>
                            <select
                                value={selectedCompId}
                                onChange={(e) => setSelectedCompId(e.target.value)}
                                className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-sffl-red outline-none"
                            >
                                <option value="">All Competitions</option>
                                {competitions.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                            {totwList.length} {totwList.length === 1 ? 'Edition' : 'Editions'} Recorded
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                        {loadingList ? (
                            <Loader />
                        ) : totwList.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                                <div className="text-4xl mb-3">🛡️</div>
                                <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-1">
                                    No Team of the Week Editions Found
                                </h3>
                                <p className="text-xs text-gray-400 max-w-sm mx-auto mb-6">
                                    Start highlighting your star performers by creating the first Starting XIV edition.
                                </p>
                                <button
                                    onClick={handleNewTOTW}
                                    className="px-4 py-2 bg-sffl-red hover:bg-[#A52323] text-white font-bold text-xs rounded-lg shadow-md transition-colors cursor-pointer"
                                >
                                    Create First Edition
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                                            <th className="py-4 px-6">Week Edition</th>
                                            <th className="py-4 px-6">Headline</th>
                                            <th className="py-4 px-6">Status</th>
                                            <th className="py-4 px-6">Created</th>
                                            <th className="py-4 px-6 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-sm font-medium">
                                        {totwList.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                            >
                                                <td className="py-4 px-6">
                                                    <div className="font-black text-sffl-navy dark:text-white">
                                                        {item.week_title}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-gray-600 dark:text-gray-300">
                                                    {item.headline || 'TEAM OF THE WEEK'}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                            item.is_published
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`w-1.5 h-1.5 rounded-full ${
                                                                item.is_published ? 'bg-emerald-500' : 'bg-amber-500'
                                                            }`}
                                                        />
                                                        {item.is_published ? 'Published' : 'Draft'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-gray-500 dark:text-gray-400 text-xs">
                                                    {new Date(item.created_at).toLocaleDateString(undefined, {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                publishMutation.mutate({
                                                                    id: item.id,
                                                                    isPublished: !item.is_published,
                                                                })
                                                            }
                                                            title={item.is_published ? 'Unpublish' : 'Publish'}
                                                            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                                                                item.is_published
                                                                    ? 'text-amber-600 hover:bg-amber-50 border-amber-200 dark:border-amber-800'
                                                                    : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-800'
                                                            }`}
                                                        >
                                                            {item.is_published ? 'Unpublish' : 'Publish'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditTOTW(item.id)}
                                                            className="p-1.5 text-gray-600 hover:text-sffl-navy dark:text-gray-300 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                                            title="Edit Edition"
                                                        >
                                                            <PencilSquareIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (
                                                                    confirm(
                                                                        `Are you sure you want to delete ${item.week_title}? This action cannot be undone.`
                                                                    )
                                                                ) {
                                                                    deleteMutation.mutate(item.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                                                            title="Delete Edition"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* ── EDIT / CREATE VIEW ────────────────────────────────────── */
                <div className="space-y-6">
                    {/* Top Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditingTotwId(null);
                                }}
                                className="px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                            >
                                ← Back to Editions
                            </button>
                            <h2 className="text-xl font-black text-sffl-navy dark:text-white">
                                {editingTotwId ? 'Edit Team of the Week' : 'Create Team of the Week'}
                            </h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setPreviewMode(!previewMode)}
                                className="px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <EyeIcon className="w-4 h-4" />
                                <span>{previewMode ? 'Hide Preview' : 'Live Field Preview'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="px-6 py-2.5 bg-sffl-red hover:bg-[#A52323] text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-md transition-colors cursor-pointer"
                            >
                                {editingTotwId ? 'Save Changes' : 'Create & Save'}
                            </button>
                        </div>
                    </div>

                    {/* Metadata Settings Card */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">
                            Edition Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                    Competition *
                                </label>
                                <select
                                    value={formCompId}
                                    onChange={(e) => setFormCompId(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-sffl-red outline-none"
                                >
                                    <option value="">Select Competition</option>
                                    {competitions.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                    Linked Event Day (Optional)
                                </label>
                                <select
                                    value={formEventDayId}
                                    onChange={(e) => setFormEventDayId(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-sffl-red outline-none"
                                >
                                    <option value="">None / Custom</option>
                                    {eventDays.map((ed) => (
                                        <option key={ed.id} value={ed.id}>
                                            {ed.title || ed.date} ({new Date(ed.date).toLocaleDateString()})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                    Week Title *
                                </label>
                                <input
                                    type="text"
                                    value={formWeekTitle}
                                    onChange={(e) => setFormWeekTitle(e.target.value)}
                                    placeholder="e.g. Week 4 or Divisional Finals"
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-sffl-red outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                    Banner Headline
                                </label>
                                <input
                                    type="text"
                                    value={formHeadline}
                                    onChange={(e) => setFormHeadline(e.target.value)}
                                    placeholder="TEAM OF THE WEEK"
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-sffl-red outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                                    Sub-headline / Description
                                </label>
                                <input
                                    type="text"
                                    value={formSubHeadline}
                                    onChange={(e) => setFormSubHeadline(e.target.value)}
                                    placeholder="Honoring top performers from Game Day 4"
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-sffl-red outline-none"
                                />
                            </div>
                            <div className="flex flex-col justify-end">
                                <label className="inline-flex items-center gap-2 cursor-pointer pb-2">
                                    <input
                                        type="checkbox"
                                        checked={formIsPublished}
                                        onChange={(e) => setFormIsPublished(e.target.checked)}
                                        className="w-4 h-4 text-sffl-red rounded border-gray-300 focus:ring-sffl-red"
                                    />
                                    <span className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                        Publish immediately (Visible on Landing Page)
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Live Preview (Toggleable) */}
                    {previewMode && (
                        <div className="bg-[#07182E] p-6 rounded-2xl border border-white/20 text-white space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black italic tracking-wide text-white flex items-center gap-2">
                                    <span>🏟️ LIVE PITCH FORMATION PREVIEW</span>
                                </h3>
                                <span className="text-xs text-gray-300 font-bold">Starting XIV Formation</span>
                            </div>
                            <div className="relative aspect-[16/10] max-h-[480px] w-full max-w-[800px] mx-auto rounded-xl overflow-hidden border border-white/20 shadow-inner bg-gradient-to-b from-[#1b5e20] via-[#2e7d32] to-[#1b5e20]">
                                {/* Line of scrimmage */}
                                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-yellow-300/80 -translate-y-1/2 z-0" />
                                {slots.map((s) => (
                                    <div
                                        key={s.slot_code}
                                        style={{ left: s.coord_x, top: s.coord_y }}
                                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center z-10"
                                    >
                                        <div
                                            className={`w-9 h-9 md:w-11 md:h-11 rounded-full border-2 flex items-center justify-center font-black text-xs shadow-md overflow-hidden ${
                                                s.unit === 'Offence'
                                                    ? 'bg-red-600 border-red-300 text-white'
                                                    : 'bg-blue-600 border-blue-300 text-white'
                                            }`}
                                        >
                                            {s.player_image ? (
                                                <img
                                                    src={s.player_image}
                                                    alt={s.player_name}
                                                    className="w-full h-full object-cover object-top"
                                                />
                                            ) : (
                                                <span>{s.player_jersey ? `#${s.player_jersey}` : s.position}</span>
                                            )}
                                        </div>
                                        <span className="text-[9px] font-black text-white bg-black/70 px-1.5 py-0.5 rounded mt-0.5 max-w-[80px] truncate">
                                            {s.player_name || `[${s.slot_code}]`}
                                        </span>
                                        <span className="text-[8px] font-bold text-yellow-300 bg-black/60 px-1 rounded">
                                            ★ {s.rating}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Starting XIV Slots Header & Batch Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 dark:bg-gray-800/80 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div>
                            <h3 className="text-base font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                                Starting XIV Position Roster (14 Slots)
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                7 Offensive slots and 7 Defensive slots with match ratings & box-score highlights
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {formEventDayId && (
                                <button
                                    type="button"
                                    onClick={handleAutofillAll}
                                    className="px-3.5 py-2 bg-sffl-navy hover:bg-sffl-navy/90 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                                >
                                    <SparklesIcon className="w-4 h-4 text-yellow-300" />
                                    <span>Autofill All Day Stats</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Slots Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Offence Unit (7 slots) */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-sffl-red" />
                                <h4 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                                    Offence (7 Slots)
                                </h4>
                            </div>
                            {slots
                                .map((s, idx) => ({ ...s, index: idx }))
                                .filter((s) => s.unit === 'Offence')
                                .map((slot) => (
                                    <div
                                        key={slot.slot_code}
                                        className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs space-y-3"
                                    >
                                        {/* Slot top info */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded text-xs font-black bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                                    {slot.slot_code}
                                                </span>
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                                    Position: {slot.position}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {slot.player_id && formEventDayId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAutofillSlot(slot.index)}
                                                        title="Autofill stats from match day"
                                                        className="text-[11px] font-bold text-sffl-red hover:underline flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <SparklesIcon className="w-3.5 h-3.5" />
                                                        <span>Auto Stats</span>
                                                    </button>
                                                )}
                                                {slot.player_id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleClearSlotPlayer(slot.index)}
                                                        className="text-xs text-gray-400 hover:text-red-500 cursor-pointer"
                                                        title="Remove player"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Player Picker / Info */}
                                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-600/50">
                                            {slot.player_id ? (
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden shrink-0 border border-gray-300 dark:border-gray-500">
                                                            {slot.player_image ? (
                                                                <img
                                                                    src={slot.player_image}
                                                                    alt={slot.player_name}
                                                                    className="w-full h-full object-cover object-top"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center font-black text-xs text-gray-500">
                                                                    #{slot.player_jersey || '?'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-sm text-sffl-navy dark:text-white">
                                                                {slot.player_name}
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                {slot.team_name || 'Free Agent'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPickingSlotIndex(slot.index)}
                                                        className="px-2.5 py-1 text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 cursor-pointer"
                                                    >
                                                        Change
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setPickingSlotIndex(slot.index)}
                                                    className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-xs font-bold text-gray-500 hover:text-sffl-red hover:border-sffl-red flex items-center justify-center gap-2 cursor-pointer transition-colors"
                                                >
                                                    <PlusIcon className="w-4 h-4" />
                                                    <span>Assign Player to {slot.slot_code}</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Rating & 3 Stats Row */}
                                        <div className="grid grid-cols-4 gap-2 pt-1">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5">
                                                    Rating (★)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="5"
                                                    max="10"
                                                    value={slot.rating}
                                                    onChange={(e) =>
                                                        handleSlotChange(slot.index, 'rating', parseFloat(e.target.value) || 0)
                                                    }
                                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded px-2 py-1 text-xs font-black text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 truncate">
                                                    {slot.stat1_label || 'Stat 1'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={slot.stat1_value || ''}
                                                    onChange={(e) =>
                                                        handleSlotChange(slot.index, 'stat1_value', e.target.value)
                                                    }
                                                    placeholder="0"
                                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded px-2 py-1 text-xs font-bold text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 truncate">
                                                    {slot.stat2_label || 'Stat 2'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={slot.stat2_value || ''}
                                                    onChange={(e) =>
                                                        handleSlotChange(slot.index, 'stat2_value', e.target.value)
                                                    }
                                                    placeholder="0"
                                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded px-2 py-1 text-xs font-bold text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 truncate">
                                                    {slot.stat3_label || 'Stat 3'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={slot.stat3_value || ''}
                                                    onChange={(e) =>
                                                        handleSlotChange(slot.index, 'stat3_value', e.target.value)
                                                    }
                                                    placeholder="0"
                                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded px-2 py-1 text-xs font-bold text-center"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>

                        {/* Defence Unit (7 slots) */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                                <h4 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                                    Defence (7 Slots)
                                </h4>
                            </div>
                            {slots
                                .map((s, idx) => ({ ...s, index: idx }))
                                .filter((s) => s.unit === 'Defence')
                                .map((slot) => (
                                    <div
                                        key={slot.slot_code}
                                        className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs space-y-3"
                                    >
                                        {/* Slot top info */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded text-xs font-black bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                    {slot.slot_code}
                                                </span>
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                                    Position: {slot.position}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {slot.player_id && formEventDayId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAutofillSlot(slot.index)}
                                                        title="Autofill stats from match day"
                                                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <SparklesIcon className="w-3.5 h-3.5" />
                                                        <span>Auto Stats</span>
                                                    </button>
                                                )}
                                                {slot.player_id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleClearSlotPlayer(slot.index)}
                                                        className="text-xs text-gray-400 hover:text-red-500 cursor-pointer"
                                                        title="Remove player"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Player Picker / Info */}
                                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-600/50">
                                            {slot.player_id ? (
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden shrink-0 border border-gray-300 dark:border-gray-500">
                                                            {slot.player_image ? (
                                                                <img
                                                                    src={slot.player_image}
                                                                    alt={slot.player_name}
                                                                    className="w-full h-full object-cover object-top"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center font-black text-xs text-gray-500">
                                                                    #{slot.player_jersey || '?'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-sm text-sffl-navy dark:text-white">
                                                                {slot.player_name}
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                {slot.team_name || 'Free Agent'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPickingSlotIndex(slot.index)}
                                                        className="px-2.5 py-1 text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 cursor-pointer"
                                                    >
                                                        Change
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setPickingSlotIndex(slot.index)}
                                                    className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-xs font-bold text-gray-500 hover:text-blue-500 hover:border-blue-500 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                                                >
                                                    <PlusIcon className="w-4 h-4" />
                                                    <span>Assign Player to {slot.slot_code}</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Rating & 3 Stats Row */}
                                        <div className="grid grid-cols-4 gap-2 pt-1">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5">
                                                    Rating (★)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="5"
                                                    max="10"
                                                    value={slot.rating}
                                                    onChange={(e) =>
                                                        handleSlotChange(slot.index, 'rating', parseFloat(e.target.value) || 0)
                                                    }
                                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded px-2 py-1 text-xs font-black text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 truncate">
                                                    {slot.stat1_label || 'Stat 1'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={slot.stat1_value || ''}
                                                    onChange={(e) =>
                                                        handleSlotChange(slot.index, 'stat1_value', e.target.value)
                                                    }
                                                    placeholder="0"
                                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded px-2 py-1 text-xs font-bold text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 truncate">
                                                    {slot.stat2_label || 'Stat 2'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={slot.stat2_value || ''}
                                                    onChange={(e) =>
                                                        handleSlotChange(slot.index, 'stat2_value', e.target.value)
                                                    }
                                                    placeholder="0"
                                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded px-2 py-1 text-xs font-bold text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 truncate">
                                                    {slot.stat3_label || 'Stat 3'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={slot.stat3_value || ''}
                                                    onChange={(e) =>
                                                        handleSlotChange(slot.index, 'stat3_value', e.target.value)
                                                    }
                                                    placeholder="0"
                                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded px-2 py-1 text-xs font-bold text-center"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>

                    {/* Bottom Save Action Bar */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => {
                                setIsEditing(false);
                                setEditingTotwId(null);
                            }}
                            className="px-5 py-2.5 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-6 py-2.5 bg-sffl-red hover:bg-[#A52323] text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-md transition-colors cursor-pointer"
                        >
                            {editingTotwId ? 'Save Changes' : 'Create & Save'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── PLAYER PICKER MODAL ─────────────────────────────────────── */}
            {pickingSlotIndex !== null && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setPickingSlotIndex(null)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-sffl-navy dark:text-white">
                                    Assign Player: {slots[pickingSlotIndex]?.slot_code} ({slots[pickingSlotIndex]?.position})
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Select a player from the league roster
                                </p>
                            </div>
                            <button
                                onClick={() => setPickingSlotIndex(null)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search input */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                            <div className="relative">
                                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search player by name..."
                                    value={playerSearchQuery}
                                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl pl-10 pr-4 py-2 text-sm font-bold focus:ring-2 focus:ring-sffl-red outline-none"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Player List */}
                        <div className="p-4 overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-700/50 space-y-1">
                            {loadingPlayers ? (
                                <Loader />
                            ) : availablePlayers.length === 0 ? (
                                <div className="text-center py-8 text-xs font-bold text-gray-400">
                                    No players found matching "{playerSearchQuery}"
                                </div>
                            ) : (
                                availablePlayers.map((player) => (
                                    <button
                                        key={player.id}
                                        type="button"
                                        onClick={() => handleSelectPlayer(pickingSlotIndex, player)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors text-left group cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0">
                                                {player.image ? (
                                                    <img
                                                        src={player.image}
                                                        alt={player.name}
                                                        className="w-full h-full object-cover object-top"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs font-black text-gray-400">
                                                        #{player.jersey_number || '?'}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-black text-sm text-sffl-navy dark:text-white group-hover:text-sffl-red transition-colors">
                                                    {player.name}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                    <span className="font-bold text-sffl-red">{player.position}</span>
                                                    {player.team?.name && <span>• {player.team.name}</span>}
                                                    {player.jersey_number && <span>• #{player.jersey_number}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-black text-sffl-red opacity-0 group-hover:opacity-100 transition-opacity">
                                            Select →
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
