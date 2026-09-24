import { useState, useMemo } from 'react';
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
    UserPlusIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';

export interface TOTWSlotDef {
    slot_code: string;
    position: string;
    unit: 'Offence' | 'Defence';
    label: string;
    coord_x: string;
    coord_y: string;
    // Coordinates when focused on specific unit
    unit_x: string;
    unit_y: string;
    default_stat1_label: string;
    default_stat2_label: string;
    default_stat3_label: string;
}

export const isFemale = (gender?: string): boolean => {
    return (gender || '').trim().toUpperCase().startsWith('F');
};

export const DEFAULT_TOTW_SLOTS: TOTWSlotDef[] = [
    // Offence (7) - Line of scrimmage at 50%, players behind it
    {
        slot_code: 'FQB',
        position: 'FQB/RB',
        unit: 'Offence',
        label: 'Female QB / Running Back',
        coord_x: '32%',
        coord_y: '86%',
        unit_x: '32%',
        unit_y: '78%',
        default_stat1_label: 'Rush Yds',
        default_stat2_label: 'Rush TD',
        default_stat3_label: 'Catches',
    },
    {
        slot_code: 'QB',
        position: 'QB',
        unit: 'Offence',
        label: 'Primary Quarterback',
        coord_x: '68%',
        coord_y: '86%',
        unit_x: '68%',
        unit_y: '78%',
        default_stat1_label: 'Pass TD',
        default_stat2_label: 'Pass Yds',
        default_stat3_label: 'Cmp %',
    },
    {
        slot_code: 'C',
        position: 'C',
        unit: 'Offence',
        label: 'Center (Snapper)',
        coord_x: '50%',
        coord_y: '68%',
        unit_x: '50%',
        unit_y: '50%',
        default_stat1_label: 'Catches',
        default_stat2_label: 'Rec Yds',
        default_stat3_label: 'Rec TD',
    },
    {
        slot_code: 'WR1',
        position: 'WR',
        unit: 'Offence',
        label: 'Wide Receiver 1 (Split End)',
        coord_x: '14%',
        coord_y: '68%',
        unit_x: '15%',
        unit_y: '50%',
        default_stat1_label: 'Catches',
        default_stat2_label: 'Rec Yds',
        default_stat3_label: 'Rec TD',
    },
    {
        slot_code: 'WR2',
        position: 'WR',
        unit: 'Offence',
        label: 'Wide Receiver 2 (Flanker)',
        coord_x: '86%',
        coord_y: '68%',
        unit_x: '85%',
        unit_y: '50%',
        default_stat1_label: 'Catches',
        default_stat2_label: 'Rec Yds',
        default_stat3_label: 'Rec TD',
    },
    {
        slot_code: 'WR3',
        position: 'WR',
        unit: 'Offence',
        label: 'Wide Receiver 3 (Slot Left)',
        coord_x: '28%',
        coord_y: '56%',
        unit_x: '30%',
        unit_y: '26%',
        default_stat1_label: 'Catches',
        default_stat2_label: 'Rec Yds',
        default_stat3_label: 'Rec TD',
    },
    {
        slot_code: 'WR4',
        position: 'WR',
        unit: 'Offence',
        label: 'Wide Receiver 4 (Slot Right)',
        coord_x: '72%',
        coord_y: '56%',
        unit_x: '70%',
        unit_y: '26%',
        default_stat1_label: 'Catches',
        default_stat2_label: 'Rec Yds',
        default_stat3_label: 'Rec TD',
    },

    // Defence (7) - Line of scrimmage at 50%, players in front of it
    {
        slot_code: 'R',
        position: 'R',
        unit: 'Defence',
        label: 'Pass Rusher',
        coord_x: '50%',
        coord_y: '44%',
        unit_x: '50%',
        unit_y: '74%',
        default_stat1_label: 'Sacks',
        default_stat2_label: 'Flag Pulls',
        default_stat3_label: 'Pass Def',
    },
    {
        slot_code: 'DEF1',
        position: 'DEF',
        unit: 'Defence',
        label: 'Cornerback / Defender 1',
        coord_x: '18%',
        coord_y: '40%',
        unit_x: '18%',
        unit_y: '50%',
        default_stat1_label: 'Flag Pulls',
        default_stat2_label: 'Pass Def',
        default_stat3_label: 'Int',
    },
    {
        slot_code: 'DEF2',
        position: 'DEF',
        unit: 'Defence',
        label: 'Inside Defender 2',
        coord_x: '34%',
        coord_y: '38%',
        unit_x: '36%',
        unit_y: '46%',
        default_stat1_label: 'Flag Pulls',
        default_stat2_label: 'Pass Def',
        default_stat3_label: 'Int',
    },
    {
        slot_code: 'DEF3',
        position: 'DEF',
        unit: 'Defence',
        label: 'Inside Defender 3',
        coord_x: '66%',
        coord_y: '38%',
        unit_x: '64%',
        unit_y: '46%',
        default_stat1_label: 'Flag Pulls',
        default_stat2_label: 'Pass Def',
        default_stat3_label: 'Int',
    },
    {
        slot_code: 'DEF4',
        position: 'DEF',
        unit: 'Defence',
        label: 'Cornerback / Defender 4',
        coord_x: '82%',
        coord_y: '40%',
        unit_x: '82%',
        unit_y: '50%',
        default_stat1_label: 'Flag Pulls',
        default_stat2_label: 'Pass Def',
        default_stat3_label: 'Int',
    },
    {
        slot_code: 'S1',
        position: 'S',
        unit: 'Defence',
        label: 'Free Safety 1',
        coord_x: '32%',
        coord_y: '20%',
        unit_x: '32%',
        unit_y: '22%',
        default_stat1_label: 'Int',
        default_stat2_label: 'Flag Pulls',
        default_stat3_label: 'Pass Def',
    },
    {
        slot_code: 'S2',
        position: 'S',
        unit: 'Defence',
        label: 'Strong Safety 2',
        coord_x: '68%',
        coord_y: '20%',
        unit_x: '68%',
        unit_y: '22%',
        default_stat1_label: 'Int',
        default_stat2_label: 'Flag Pulls',
        default_stat3_label: 'Pass Def',
    },
];

/**
 * Normalizes any slot code alias to canonical DEFAULT_TOTW_SLOTS code
 */
export const normalizeSlotCode = (code: string | undefined): string => {
    if (!code) return '';
    const clean = code.trim().toUpperCase().replace(/[- ]/g, '_');
    const map: Record<string, string> = {
        // Offence
        QB: 'QB',
        OFF_QB: 'QB',
        MALE_QB: 'QB',
        OFF2: 'QB',
        OFF_2: 'QB',

        FQB: 'FQB',
        OFF_FQB: 'FQB',
        FEMALE_QB: 'FQB',
        OFF_FQB_RB: 'FQB',
        RB: 'FQB',
        OFF1: 'FQB',
        OFF_1: 'FQB',

        C: 'C',
        OFF_C: 'C',
        CENTER: 'C',
        OFF3: 'C',
        OFF_3: 'C',

        WR1: 'WR1',
        WR_1: 'WR1',
        OFF_WR1: 'WR1',
        OFF_WR_1: 'WR1',
        OFF4: 'WR1',
        OFF_4: 'WR1',

        WR2: 'WR2',
        WR_2: 'WR2',
        OFF_WR2: 'WR2',
        OFF_WR_2: 'WR2',
        OFF5: 'WR2',
        OFF_5: 'WR2',

        WR3: 'WR3',
        WR_3: 'WR3',
        OFF_WR3: 'WR3',
        OFF_WR_3: 'WR3',
        OFF6: 'WR3',
        OFF_6: 'WR3',

        WR4: 'WR4',
        WR_4: 'WR4',
        OFF_WR4: 'WR4',
        OFF_WR_4: 'WR4',
        OFF7: 'WR4',
        OFF_7: 'WR4',

        // Defence
        R: 'R',
        RUSH: 'R',
        RUSHER: 'R',
        DEF_R: 'R',
        DEF_RUSH: 'R',

        DEF1: 'DEF1',
        DEF_1: 'DEF1',
        DEF_UNDER_1: 'DEF1',
        DEF2: 'DEF1', // legacy migration support

        DEF2_ACTUAL: 'DEF2',
        DEF_2: 'DEF2',
        DEF_UNDER_2: 'DEF2',
        DEF3: 'DEF2', // legacy migration support

        DEF3_ACTUAL: 'DEF3',
        DEF_3: 'DEF3',
        DEF_UNDER_3: 'DEF3',
        DEF4: 'DEF3', // legacy migration support

        DEF4_ACTUAL: 'DEF4',
        DEF_4: 'DEF4',
        DEF_UNDER_4: 'DEF4',
        DEF5: 'DEF4', // legacy migration support

        S1: 'S1',
        DEF_S1: 'S1',
        S_1: 'S1',
        DEF6: 'S1',
        DEF_6: 'S1',

        S2: 'S2',
        DEF_S2: 'S2',
        S_2: 'S2',
        DEF7: 'S2',
        DEF_7: 'S2',
    };
    return map[clean] || clean;
};

// Maps stat labels to keys returned by /admin/totw/player-stats
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

function applyDayStats<
    T extends {
        rating: number;
        stat1_label?: string;
        stat1_value?: string;
        stat2_label?: string;
        stat2_value?: string;
        stat3_label?: string;
        stat3_value?: string;
    }
>(slot: T, stats: Record<string, string>): T {
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
    label?: string;
    player_name?: string;
    player_image?: string;
    player_jersey?: number;
    player_gender?: string;
    team_name?: string;
    unit_x?: string;
    unit_y?: string;
}

export const AdminTOTW = () => {
    const queryClient = useQueryClient();

    // Filters & Mode State
    const [selectedCompId, setSelectedCompId] = useState<string>('');
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [editingTotwId, setEditingTotwId] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form metadata state
    const [formCompId, setFormCompId] = useState<string>('');
    const [formEventDayId, setFormEventDayId] = useState<string>('');
    const [formWeekTitle, setFormWeekTitle] = useState<string>('');
    const [formHeadline, setFormHeadline] = useState<string>('TEAM OF THE WEEK');
    const [formSubHeadline, setFormSubHeadline] = useState<string>('Starting XIV honors for top performers');
    const [formIsPublished, setFormIsPublished] = useState<boolean>(false);

    // Pitch & Slot State
    const [pitchTab, setPitchTab] = useState<'all' | 'offence' | 'defence'>('all');
    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);

    const [slots, setSlots] = useState<SlotFormData[]>(() =>
        DEFAULT_TOTW_SLOTS.map((s) => ({
            player_id: '',
            slot_code: s.slot_code,
            position: s.position,
            unit: s.unit,
            label: s.label,
            coord_x: s.coord_x,
            coord_y: s.coord_y,
            unit_x: s.unit_x,
            unit_y: s.unit_y,
            rating: 9.0,
            stat1_label: s.default_stat1_label,
            stat1_value: '',
            stat2_label: s.default_stat2_label,
            stat2_value: '',
            stat3_label: s.default_stat3_label,
            stat3_value: '',
        }))
    );

    // Player picker modal state (Default to slot position tab with ALL and Women available)
    const [pickingSlotIndex, setPickingSlotIndex] = useState<number | null>(null);
    const [playerSearchQuery, setPlayerSearchQuery] = useState<string>('');
    const [positionFilter, setPositionFilter] = useState<string>('ALL');

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
        queryFn: () => getPlayers(undefined, 1, 200, playerSearchQuery || undefined),
    });
    const availablePlayers: Player[] = playersData?.data || [];

    // Optional quick filter tabs in picker modal
    const filteredAvailablePlayers = useMemo(() => {
        let list = availablePlayers;
        if (positionFilter === 'FEMALE') {
            list = list.filter((p) => isFemale(p.gender));
        } else if (positionFilter === 'QB') {
            list = list.filter((p) => {
                const pos = (p.position || '').toUpperCase();
                const sec = (p.secondary_position || '').toUpperCase();
                return pos === 'QB' || sec === 'QB';
            });
        } else if (positionFilter === 'WR') {
            list = list.filter((p) => {
                const pos = (p.position || '').toUpperCase();
                const sec = (p.secondary_position || '').toUpperCase();
                return pos === 'WR' || pos === 'RECEIVER' || sec === 'WR' || sec === 'RECEIVER';
            });
        } else if (positionFilter === 'C') {
            list = list.filter((p) => {
                const pos = (p.position || '').toUpperCase();
                const sec = (p.secondary_position || '').toUpperCase();
                return pos === 'C' || pos === 'CENTER' || sec === 'C' || sec === 'CENTER';
            });
        } else if (positionFilter === 'RUSH') {
            list = list.filter((p) => {
                const pos = (p.position || '').toUpperCase();
                const sec = (p.secondary_position || '').toUpperCase();
                return pos === 'R' || pos === 'RUSH' || pos === 'RUSHER' || sec === 'RUSH' || sec === 'RUSHER';
            });
        } else if (positionFilter === 'DEF') {
            list = list.filter((p) => {
                const pos = (p.position || '').toUpperCase();
                const sec = (p.secondary_position || '').toUpperCase();
                return pos === 'DEF' || pos === 'DEFENDER' || sec === 'DEF' || sec === 'DEFENDER' || pos === 'DB' || pos === 'CB' || pos === 'LB';
            });
        } else if (positionFilter === 'S') {
            list = list.filter((p) => {
                const pos = (p.position || '').toUpperCase();
                const sec = (p.secondary_position || '').toUpperCase();
                return pos === 'S' || pos === 'SAFETY' || sec === 'S' || sec === 'SAFETY';
            });
        }
        return list;
    }, [availablePlayers, positionFilter]);

    // Helper to retrieve slot player's gender
    const getSlotGender = (slot: SlotFormData): string => {
        if (slot.player_gender) return slot.player_gender;
        if (slot.player_id) {
            const found = availablePlayers.find((p) => p.id === slot.player_id);
            if (found?.gender) return found.gender;
        }
        return '';
    };

    // Assigned players counts
    const filledCount = useMemo(() => slots.filter((s) => s.player_id.trim() !== '').length, [slots]);
    const filledOffenceCount = useMemo(
        () => slots.filter((s) => s.unit === 'Offence' && s.player_id.trim() !== '').length,
        [slots]
    );
    const filledDefenceCount = useMemo(
        () => slots.filter((s) => s.unit === 'Defence' && s.player_id.trim() !== '').length,
        [slots]
    );

    // Female quota counts (3 females required in Offence and 3 females required in Defence)
    const offenseFemalesCount = useMemo(
        () => slots.filter((s) => s.unit === 'Offence' && s.player_id && isFemale(getSlotGender(s))).length,
        [slots, availablePlayers]
    );
    const defenseFemalesCount = useMemo(
        () => slots.filter((s) => s.unit === 'Defence' && s.player_id && isFemale(getSlotGender(s))).length,
        [slots, availablePlayers]
    );
    const offenseFemalesValid = offenseFemalesCount >= 3;
    const defenseFemalesValid = defenseFemalesCount >= 3;

    // Active slot being inspected
    const activeSlot = slots[selectedSlotIndex] || slots[0];

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
            setStatusMessage({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to delete Team of the Week.',
            });
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
            setStatusMessage({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to toggle publish status.',
            });
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
        setPitchTab('all');
        setSelectedSlotIndex(0);
        setSlots(
            DEFAULT_TOTW_SLOTS.map((s) => ({
                player_id: '',
                slot_code: s.slot_code,
                position: s.position,
                unit: s.unit,
                label: s.label,
                coord_x: s.coord_x,
                coord_y: s.coord_y,
                unit_x: s.unit_x,
                unit_y: s.unit_y,
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

    /**
     * Edit existing TOTW:
     * Maps loaded players to canonical OFF1..OFF7 and DEF1..DEF7 slots without duplication.
     */
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
            setPitchTab('all');

            // Initialize 14 canonical default slots (OFF1..OFF7, DEF1..DEF7)
            const newSlots: SlotFormData[] = DEFAULT_TOTW_SLOTS.map((defaultSlot) => ({
                player_id: '',
                slot_code: defaultSlot.slot_code,
                position: defaultSlot.position,
                unit: defaultSlot.unit,
                label: defaultSlot.label,
                coord_x: defaultSlot.coord_x,
                coord_y: defaultSlot.coord_y,
                unit_x: defaultSlot.unit_x,
                unit_y: defaultSlot.unit_y,
                rating: 9.0,
                stat1_label: defaultSlot.default_stat1_label,
                stat1_value: '',
                stat2_label: defaultSlot.default_stat2_label,
                stat2_value: '',
                stat3_label: defaultSlot.default_stat3_label,
                stat3_value: '',
            }));

            if (fullTotw.players && fullTotw.players.length > 0) {
                const assignedPlayerIds = new Set<string>();
                const filledSlotIndices = new Set<number>();

                // Pass 1: Match by exact normalized slot_code (supports OFF1..OFF7, DEF1..DEF7 and legacy QB/WR/etc.)
                for (const p of fullTotw.players) {
                    if (!p.player_id || assignedPlayerIds.has(p.player_id)) continue;
                    const normCode = normalizeSlotCode(p.slot_code);
                    const slotIdx = newSlots.findIndex(
                        (s, idx) => !filledSlotIndices.has(idx) && s.slot_code === normCode
                    );
                    if (slotIdx !== -1) {
                        filledSlotIndices.add(slotIdx);
                        assignedPlayerIds.add(p.player_id);
                        const defSlot = DEFAULT_TOTW_SLOTS[slotIdx];
                        newSlots[slotIdx] = {
                            player_id: p.player_id,
                            slot_code: defSlot.slot_code,
                            position: defSlot.position,
                            unit: (p.unit as 'Offence' | 'Defence') || defSlot.unit,
                            label: defSlot.label,
                            coord_x: defSlot.coord_x,
                            coord_y: defSlot.coord_y,
                            unit_x: defSlot.unit_x,
                            unit_y: defSlot.unit_y,
                            rating: p.rating || 9.0,
                            stat1_label: p.stat1_label || defSlot.default_stat1_label,
                            stat1_value: p.stat1_value || '',
                            stat2_label: p.stat2_label || defSlot.default_stat2_label,
                            stat2_value: p.stat2_value || '',
                            stat3_label: p.stat3_label || defSlot.default_stat3_label,
                            stat3_value: p.stat3_value || '',
                            player_name: p.player?.name,
                            player_image: p.player?.image,
                            player_jersey: p.player?.jersey_number,
                            player_gender: p.player?.gender,
                            team_name: p.player?.team?.name,
                        };
                    }
                }

                // Pass 2: Fallback for any leftover players, matching by unit into remaining unfilled slots
                for (const p of fullTotw.players) {
                    if (!p.player_id || assignedPlayerIds.has(p.player_id)) continue;
                    const slotIdx = newSlots.findIndex(
                        (s, idx) => !filledSlotIndices.has(idx) && s.unit === p.unit
                    );
                    if (slotIdx !== -1) {
                        filledSlotIndices.add(slotIdx);
                        assignedPlayerIds.add(p.player_id);
                        const defSlot = DEFAULT_TOTW_SLOTS[slotIdx];
                        newSlots[slotIdx] = {
                            player_id: p.player_id,
                            slot_code: defSlot.slot_code,
                            position: defSlot.position,
                            unit: (p.unit as 'Offence' | 'Defence') || defSlot.unit,
                            label: defSlot.label,
                            coord_x: defSlot.coord_x,
                            coord_y: defSlot.coord_y,
                            unit_x: defSlot.unit_x,
                            unit_y: defSlot.unit_y,
                            rating: p.rating || 9.0,
                            stat1_label: p.stat1_label || defSlot.default_stat1_label,
                            stat1_value: p.stat1_value || '',
                            stat2_label: p.stat2_label || defSlot.default_stat2_label,
                            stat2_value: p.stat2_value || '',
                            stat3_label: p.stat3_label || defSlot.default_stat3_label,
                            stat3_value: p.stat3_value || '',
                            player_name: p.player?.name,
                            player_image: p.player?.image,
                            player_jersey: p.player?.jersey_number,
                            player_gender: p.player?.gender,
                            team_name: p.player?.team?.name,
                        };
                    }
                }
            }

            setSlots(newSlots);
            setSelectedSlotIndex(0);
            setIsEditing(true);
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: 'Failed to load Team of the Week details.' });
        }
    };

    /**
     * Open player picker modal for any slot index
     */
    const handleOpenPicker = (slotIndex: number) => {
        setPickingSlotIndex(slotIndex);
        setPlayerSearchQuery('');
        const slot = slots[slotIndex];
        if (slot) {
            if (slot.slot_code === 'FQB') {
                setPositionFilter('FEMALE');
            } else if (slot.slot_code === 'QB') {
                setPositionFilter('QB');
            } else if (slot.slot_code.startsWith('WR')) {
                setPositionFilter('WR');
            } else if (slot.slot_code === 'C') {
                setPositionFilter('C');
            } else if (slot.slot_code === 'R') {
                setPositionFilter('RUSH');
            } else if (slot.slot_code.startsWith('DEF')) {
                setPositionFilter('DEF');
            } else if (slot.slot_code.startsWith('S')) {
                setPositionFilter('S');
            } else {
                setPositionFilter('ALL');
            }
        } else {
            setPositionFilter('ALL');
        }
    };

    /**
     * Assigns a player to a slot.
     * Enforces the single rule: the same player cannot be chosen twice on the board.
     * If the player was in another slot, they are unassigned from that slot automatically.
     */
    const handleSelectPlayer = async (slotIndex: number, player: Player) => {
        setSlots((prev) => {
            const copy = [...prev];
            // Clear player from any other slot on the board so no duplicate can exist
            const otherIdx = copy.findIndex((s, idx) => idx !== slotIndex && s.player_id === player.id);
            if (otherIdx !== -1) {
                copy[otherIdx] = {
                    ...copy[otherIdx],
                    player_id: '',
                    player_name: undefined,
                    player_image: undefined,
                    player_jersey: undefined,
                    player_gender: undefined,
                    team_name: undefined,
                    stat1_value: '',
                    stat2_value: '',
                    stat3_value: '',
                };
            }
            copy[slotIndex] = {
                ...copy[slotIndex],
                player_id: player.id,
                player_name: player.name,
                player_image: player.image,
                player_jersey: player.jersey_number,
                player_gender: player.gender,
                team_name: player.team?.name,
            };
            return copy;
        });

        setSelectedSlotIndex(slotIndex);
        setPickingSlotIndex(null);
        setPlayerSearchQuery('');

        // If an event day is selected, autofill day stats
        if (formEventDayId) {
            try {
                const stats = await getAdminPlayerDayStats(player.id, formEventDayId);
                if (stats && Object.keys(stats).length > 0) {
                    setSlots((prev) => {
                        const copy = [...prev];
                        copy[slotIndex] = applyDayStats(copy[slotIndex], stats);
                        return copy;
                    });
                }
            } catch (e) {
                // Non-blocking
            }
        }
    };

    /**
     * Unassign a slot
     */
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

    /**
     * Clear all slots
     */
    const handleClearAllSlots = () => {
        if (!confirm('Are you sure you want to clear all 14 positions?')) return;
        setSlots(
            DEFAULT_TOTW_SLOTS.map((s) => ({
                player_id: '',
                slot_code: s.slot_code,
                position: s.position,
                unit: s.unit,
                label: s.label,
                coord_x: s.coord_x,
                coord_y: s.coord_y,
                unit_x: s.unit_x,
                unit_y: s.unit_y,
                rating: 9.0,
                stat1_label: s.default_stat1_label,
                stat1_value: '',
                stat2_label: s.default_stat2_label,
                stat2_value: '',
                stat3_label: s.default_stat3_label,
                stat3_value: '',
            }))
        );
        setSelectedSlotIndex(0);
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
            setStatusMessage({
                type: 'success',
                text: `Updated match statistics for ${slot.player_name || slot.slot_code}.`,
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
            text: `Autofilled statistics for ${updated} of ${filledSlots.length} assigned players.`,
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

        // Strict validation: The same player cannot be chosen twice on the board
        const playerIds = validSlots.map((s) => s.player_id);
        const uniqueIds = new Set(playerIds);
        if (uniqueIds.size !== playerIds.length) {
            setStatusMessage({
                type: 'error',
                text: 'A player cannot be chosen twice on the Team of the Week board.',
            });
            return;
        }

        // Female quota validation: At least 3 female players in Offence and at least 3 female players in Defence
        const offFilled = validSlots.filter((s) => s.unit === 'Offence');
        const defFilled = validSlots.filter((s) => s.unit === 'Defence');
        const offFemales = offFilled.filter((s) => isFemale(getSlotGender(s))).length;
        const defFemales = defFilled.filter((s) => isFemale(getSlotGender(s))).length;

        if (formIsPublished) {
            if (validSlots.length < 14) {
                setStatusMessage({
                    type: 'error',
                    text: 'Cannot publish incomplete Team of the Week: all 14 starting positions must be filled.',
                });
                return;
            }
            if (offFemales < 3) {
                setStatusMessage({
                    type: 'error',
                    text: `Cannot publish: Offence requires at least 3 female players (currently has ${offFemales} of 3).`,
                });
                return;
            }
            if (defFemales < 3) {
                setStatusMessage({
                    type: 'error',
                    text: `Cannot publish: Defence requires at least 3 female players (currently has ${defFemales} of 3).`,
                });
                return;
            }
        } else {
            // In draft mode: if unit is complete, enforce female quota
            if (offFilled.length === 7 && offFemales < 3) {
                setStatusMessage({
                    type: 'error',
                    text: `Offence requires at least 3 female players (currently has ${offFemales} of 3).`,
                });
                return;
            }
            if (defFilled.length === 7 && defFemales < 3) {
                setStatusMessage({
                    type: 'error',
                    text: `Defence requires at least 3 female players (currently has ${defFemales} of 3).`,
                });
                return;
            }
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

    // Filter slots according to active pitch tab
    const visibleSlots = useMemo(() => {
        return slots.map((s, idx) => ({ ...s, index: idx })).filter((s) => {
            if (pitchTab === 'offence') return s.unit === 'Offence';
            if (pitchTab === 'defence') return s.unit === 'Defence';
            return true;
        });
    }, [slots, pitchTab]);

    return (
        <div className="space-y-6 md:space-y-8 animate-fade-in pb-16">
            {/* Header Banner following DESIGN_SYSTEM.md */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-sffl-navy text-white p-6 md:p-8 rounded-xl md:rounded-2xl shadow-xl gap-4">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">TEAM OF THE WEEK</h1>
                    <p className="text-gray-300 mt-1 text-sm md:text-base">
                        Manage Starting XIV selections (OFF 1–7 & DEF 1–7), ratings, and player honours
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
                                className="px-3.5 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
                            >
                                ← Back to Editions
                            </button>
                            <div>
                                <h2 className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white">
                                    {editingTotwId ? 'Edit Team of the Week' : 'Create Team of the Week'}
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Click any slot on the pitch to assign any player (OFF 1–7 & DEF 1–7)
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditingTotwId(null);
                                }}
                                className="px-4 py-2.5 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="px-6 py-2.5 bg-sffl-red hover:bg-[#A52323] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-colors cursor-pointer"
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
                                    Linked Event Day (For Stat Autofill)
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

                    {/* ── THE INTERACTIVE PITCH UI BUILDER ───────────────────────── */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 md:p-6 shadow-sm space-y-4">
                        {/* Pitch Controls Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                            {/* View Switcher Tabs */}
                            <div className="flex items-center bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setPitchTab('all')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all cursor-pointer ${
                                        pitchTab === 'all'
                                            ? 'bg-sffl-navy text-white shadow-sm'
                                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                                    }`}
                                >
                                    🏟️ Full Pitch (14)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPitchTab('offence')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all cursor-pointer ${
                                        pitchTab === 'offence'
                                            ? 'bg-sffl-navy text-white shadow-sm'
                                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                                    }`}
                                >
                                    ⚔️ Offence ({filledOffenceCount}/7)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPitchTab('defence')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all cursor-pointer ${
                                        pitchTab === 'defence'
                                            ? 'bg-sffl-navy text-white shadow-sm'
                                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                                    }`}
                                >
                                    🛡️ Defence ({filledDefenceCount}/7)
                                </button>
                            </div>

                            {/* Batch Action Buttons & Female Quota Badges */}
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Offence Female Quota */}
                                <div
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-colors ${
                                        offenseFemalesValid
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                    }`}
                                    title="Offence requires at least 3 female players"
                                >
                                    <span>Offence ♀:</span>
                                    <span className="font-black">{offenseFemalesCount}/3</span>
                                    {offenseFemalesValid ? (
                                        <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black">NEED 3</span>
                                    )}
                                </div>

                                {/* Defence Female Quota */}
                                <div
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-colors ${
                                        defenseFemalesValid
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                    }`}
                                    title="Defence requires at least 3 female players"
                                >
                                    <span>Defence ♀:</span>
                                    <span className="font-black">{defenseFemalesCount}/3</span>
                                    {defenseFemalesValid ? (
                                        <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black">NEED 3</span>
                                    )}
                                </div>

                                <span className="text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600">
                                    {filledCount} / 14 Starters
                                </span>
                                {formEventDayId && (
                                    <button
                                        type="button"
                                        onClick={handleAutofillAll}
                                        className="px-3.5 py-1.5 bg-sffl-navy hover:bg-sffl-navy/90 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                                    >
                                        <SparklesIcon className="w-4 h-4 text-yellow-300" />
                                        <span>Autofill All Stats</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleClearAllSlots}
                                    className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                                >
                                    Clear Lineup
                                </button>
                            </div>
                        </div>

                        {/* Interactive Pitch Canvas */}
                        <div
                            className="relative w-full h-[620px] md:h-[700px] rounded-2xl overflow-hidden border-2 border-emerald-500/30 shadow-2xl select-none"
                            style={{
                                background: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(20% - 1px), rgba(229, 243, 220, 0.12) calc(20% - 1px), rgba(229, 243, 220, 0.12) 20%),
                                             repeating-linear-gradient(to bottom, #174C3A 0, #174C3A 20%, #134332 20%, #134332 40%)`,
                                boxShadow: 'inset 0 0 100px rgba(0, 20, 12, 0.85)',
                            }}
                            role="group"
                            aria-label="Team of the Week Formation Pitch"
                        >
                            {/* Sidelines & Markings */}
                            <div className="absolute top-[10%] bottom-[10%] left-[3%] right-[3%] border border-white/20 rounded-lg pointer-events-none" />

                            {/* Top Endzone */}
                            <div className="absolute top-0 left-0 right-0 h-[10%] flex items-center justify-center text-white/25 bg-[#0C2D28]/80 border-b border-white/20 font-black italic tracking-[0.25em] text-lg md:text-2xl pointer-events-none">
                                {pitchTab === 'offence' ? 'END ZONE' : 'DEFENCE'}
                            </div>

                            {/* Bottom Endzone */}
                            <div className="absolute bottom-0 left-0 right-0 h-[10%] flex items-center justify-center text-white/25 bg-[#0C2D28]/80 border-t border-white/20 font-black italic tracking-[0.25em] text-lg md:text-2xl pointer-events-none">
                                {pitchTab === 'defence' ? 'LINE OF SCRIMMAGE' : 'OFFENCE'}
                            </div>

                            {/* Line of Scrimmage (visible in full pitch view) */}
                            {pitchTab === 'all' && (
                                <>
                                    <div className="absolute top-1/2 left-[2%] right-[2%] border-t-2 border-dashed border-yellow-300/70 -translate-y-1/2 z-10 pointer-events-none" />
                                    <span className="absolute top-1/2 right-[4%] -translate-y-1/2 z-20 px-2 py-0.5 rounded bg-yellow-300/90 text-sffl-navy text-[8px] md:text-[9px] font-black tracking-wider uppercase shadow-xs pointer-events-none">
                                        Line of Scrimmage
                                    </span>
                                </>
                            )}

                            {/* 14 Interactive Position Nodes on Pitch: OFF 1-7 & DEF 1-7 */}
                            {visibleSlots.map((slot) => {
                                const isSelected = selectedSlotIndex === slot.index;
                                const isOccupied = Boolean(slot.player_id);
                                const isDef = slot.unit === 'Defence';

                                // Choose coordinates based on current tab
                                const posX = pitchTab === 'all' ? slot.coord_x : slot.unit_x || slot.coord_x;
                                const posY = pitchTab === 'all' ? slot.coord_y : slot.unit_y || slot.coord_y;

                                return (
                                    <div
                                        key={slot.slot_code}
                                        style={{ left: posX, top: posY }}
                                        className="absolute -translate-x-1/2 -translate-y-1/2 text-center z-20"
                                    >
                                        {isOccupied ? (
                                            /* Occupied Position Node */
                                            <div className="relative group">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedSlotIndex(slot.index)}
                                                    className={`cursor-pointer transition-all duration-200 focus:outline-none flex flex-col items-center ${
                                                        isSelected
                                                            ? 'scale-110 z-30 drop-shadow-2xl'
                                                            : 'hover:scale-105 active:scale-95 opacity-95 hover:opacity-100'
                                                    }`}
                                                >
                                                    {/* Avatar Ring */}
                                                    <div
                                                        className={`relative w-12 h-12 md:w-14 md:h-14 rounded-full p-0.5 transition-all ${
                                                            isSelected
                                                                ? 'ring-4 ring-yellow-400 shadow-xl'
                                                                : isDef
                                                                ? 'ring-2 ring-blue-400 shadow-lg'
                                                                : 'ring-2 ring-sffl-red shadow-lg'
                                                        }`}
                                                    >
                                                        {slot.player_image ? (
                                                            <img
                                                                src={slot.player_image}
                                                                alt={slot.player_name || 'Player'}
                                                                className="w-full h-full rounded-full object-cover object-top bg-gray-200"
                                                            />
                                                        ) : (
                                                            <div
                                                                className={`w-full h-full rounded-full flex items-center justify-center font-black text-xs md:text-sm text-white ${
                                                                    isDef ? 'bg-blue-600' : 'bg-red-600'
                                                                }`}
                                                            >
                                                                {slot.player_jersey ? `#${slot.player_jersey}` : slot.slot_code}
                                                            </div>
                                                        )}

                                                        {/* Rating badge on bottom right */}
                                                        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-sffl-navy text-amber-300 font-black text-[9px] border border-white/60 shadow-sm flex items-center gap-0.5">
                                                            <span>★</span>
                                                            <span>{slot.rating}</span>
                                                        </span>

                                                        {/* Slot code badge on top left */}
                                                        <span
                                                            className={`absolute -top-1 -left-1 px-1.5 py-0.2 rounded-full text-[8px] font-black text-white border border-white/50 shadow-sm flex items-center gap-0.5 ${
                                                                isDef ? 'bg-blue-700' : 'bg-sffl-red'
                                                            }`}
                                                        >
                                                            <span>{slot.slot_code}</span>
                                                            {isFemale(getSlotGender(slot)) && (
                                                                <span className="text-yellow-300 text-[9px] leading-none" title="Female Player (Counts towards Quota)">♀</span>
                                                            )}
                                                        </span>
                                                    </div>

                                                    {/* Player Name Badge */}
                                                    <div className="mt-1 max-w-[85px] md:max-w-[105px]">
                                                        <div className="truncate px-1.5 py-0.5 rounded bg-black/85 text-white font-black text-[10px] md:text-xs leading-tight shadow-sm">
                                                            {slot.player_name || 'Assigned'}
                                                        </div>
                                                        {slot.team_name && (
                                                            <div className="truncate text-[8px] md:text-[9px] font-bold text-gray-300/90 mt-0.2">
                                                                {slot.team_name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>

                                                {/* Clear Button (Top Right Corner) */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleClearSlotPlayer(slot.index);
                                                    }}
                                                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer"
                                                    title="Remove player from slot"
                                                >
                                                    <XMarkIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                                </button>
                                            </div>
                                        ) : (
                                            /* Empty Position Pin */
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedSlotIndex(slot.index);
                                                    handleOpenPicker(slot.index);
                                                }}
                                                className={`cursor-pointer group flex flex-col items-center focus:outline-none transition-transform ${
                                                    isSelected ? 'scale-110' : 'hover:scale-105 active:scale-95'
                                                }`}
                                            >
                                                <div
                                                    className={`w-11 h-11 md:w-13 md:h-13 rounded-full border-2 border-dashed flex flex-col items-center justify-center shadow-lg transition-colors ${
                                                        isSelected
                                                            ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300'
                                                            : 'border-white/60 group-hover:border-white bg-black/35 group-hover:bg-black/60 text-white/90'
                                                    }`}
                                                >
                                                    <UserPlusIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                </div>
                                                <span className="text-[10px] md:text-xs font-black text-white drop-shadow mt-1 block max-w-[85px] truncate">
                                                    + {slot.slot_code}
                                                </span>
                                                <span className="text-[8px] font-bold text-amber-300 uppercase tracking-widest leading-none">
                                                    {slot.unit}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Quick 14-Slot Navigation Strip */}
                        <div className="space-y-1.5 pt-2">
                            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                                <span>Starting XIV Position Navigator</span>
                                <span>Click any slot to inspect & edit</span>
                            </div>
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                                {slots.map((s, idx) => {
                                    const isSelected = selectedSlotIndex === idx;
                                    const isFilled = Boolean(s.player_id);
                                    return (
                                        <button
                                            key={s.slot_code}
                                            type="button"
                                            onClick={() => setSelectedSlotIndex(idx)}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                                                isSelected
                                                    ? 'bg-sffl-navy text-white shadow-sm ring-2 ring-sffl-red'
                                                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            <span
                                                className={`w-2 h-2 rounded-full ${
                                                    isFilled ? 'bg-emerald-500' : 'bg-gray-400'
                                                }`}
                                            />
                                            <span className="font-black">{s.slot_code}</span>
                                            {isFilled && (
                                                <>
                                                    <span className="text-[10px] opacity-80 max-w-[70px] truncate hidden sm:inline">
                                                        {s.player_name}
                                                    </span>
                                                    {isFemale(getSlotGender(s)) && (
                                                        <span
                                                            title="Female player (Counts towards quota)"
                                                            className="text-[10px] font-black text-amber-500 dark:text-amber-400"
                                                        >
                                                            ♀
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── SELECTED SLOT INSPECTOR & QUICK EDITOR CARD ───────── */}
                        {activeSlot && (
                            <div className="bg-gray-50 dark:bg-gray-750 p-4 md:p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-sm animate-fade-in">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-3">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`px-2.5 py-1 rounded-md text-xs font-black uppercase text-white ${
                                                activeSlot.unit === 'Offence' ? 'bg-sffl-red' : 'bg-blue-600'
                                            }`}
                                        >
                                            {activeSlot.unit}
                                        </span>
                                        <h4 className="text-base font-black text-sffl-navy dark:text-white">
                                            Slot: {activeSlot.slot_code} ({activeSlot.label || activeSlot.unit})
                                        </h4>
                                    </div>

                                    {/* Slot Carousel / Navigation */}
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelectedSlotIndex(
                                                    (selectedSlotIndex - 1 + slots.length) % slots.length
                                                )
                                            }
                                            className="p-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                                            title="Previous slot"
                                        >
                                            <ChevronLeftIcon className="w-4 h-4" />
                                        </button>
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 px-2">
                                            {selectedSlotIndex + 1} of 14
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelectedSlotIndex((selectedSlotIndex + 1) % slots.length)
                                            }
                                            className="p-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                                            title="Next slot"
                                        >
                                            <ChevronRightIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {activeSlot.player_id ? (
                                    <div className="space-y-4">
                                        {/* Player Summary Row */}
                                        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center gap-3.5">
                                                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border border-gray-300 dark:border-gray-600 shrink-0">
                                                    {activeSlot.player_image ? (
                                                        <img
                                                            src={activeSlot.player_image}
                                                            alt={activeSlot.player_name || 'Player'}
                                                            className="w-full h-full object-cover object-top"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center font-black text-sm text-gray-500">
                                                            #{activeSlot.player_jersey || '?'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-lg font-black text-sffl-navy dark:text-white flex items-center gap-2">
                                                        <span>{activeSlot.player_name}</span>
                                                        {isFemale(getSlotGender(activeSlot)) ? (
                                                            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                                                ♀ Female (Quota)
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                                                ♂ Male
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                        <span className="text-sffl-red font-black">
                                                            {activeSlot.slot_code}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{activeSlot.team_name || 'Free Agent'}</span>
                                                        {activeSlot.player_jersey && (
                                                            <>
                                                                <span>•</span>
                                                                <span>#{activeSlot.player_jersey}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2">
                                                {formEventDayId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAutofillSlot(selectedSlotIndex)}
                                                        className="px-3 py-1.5 bg-sffl-navy hover:bg-sffl-navy/90 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                                                    >
                                                        <SparklesIcon className="w-4 h-4 text-yellow-300" />
                                                        <span>Autofill Stats</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenPicker(selectedSlotIndex)}
                                                    className="px-3 py-1.5 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                                >
                                                    <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                                                    <span>Change Player</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleClearSlotPlayer(selectedSlotIndex)}
                                                    className="px-2.5 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>

                                        {/* Match Rating & 3 Stats Row */}
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                            {/* Rating */}
                                            <div>
                                                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                                                    Match Rating (★)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="5"
                                                    max="10"
                                                    value={activeSlot.rating}
                                                    onChange={(e) =>
                                                        handleSlotChange(
                                                            selectedSlotIndex,
                                                            'rating',
                                                            parseFloat(e.target.value) || 0
                                                        )
                                                    }
                                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm font-black text-center focus:ring-2 focus:ring-sffl-red outline-none"
                                                />
                                            </div>

                                            {/* Stat 1 */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 truncate">
                                                    Stat 1: {activeSlot.stat1_label || 'Value'}
                                                </label>
                                                <div className="flex gap-1.5">
                                                    <input
                                                        type="text"
                                                        value={activeSlot.stat1_label || ''}
                                                        onChange={(e) =>
                                                            handleSlotChange(
                                                                selectedSlotIndex,
                                                                'stat1_label',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Label"
                                                        className="w-1/2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg px-2 py-2 text-xs font-bold"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={activeSlot.stat1_value || ''}
                                                        onChange={(e) =>
                                                            handleSlotChange(
                                                                selectedSlotIndex,
                                                                'stat1_value',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="0"
                                                        className="w-1/2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-2 py-2 text-sm font-black text-center focus:ring-2 focus:ring-sffl-red outline-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* Stat 2 */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 truncate">
                                                    Stat 2: {activeSlot.stat2_label || 'Value'}
                                                </label>
                                                <div className="flex gap-1.5">
                                                    <input
                                                        type="text"
                                                        value={activeSlot.stat2_label || ''}
                                                        onChange={(e) =>
                                                            handleSlotChange(
                                                                selectedSlotIndex,
                                                                'stat2_label',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Label"
                                                        className="w-1/2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg px-2 py-2 text-xs font-bold"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={activeSlot.stat2_value || ''}
                                                        onChange={(e) =>
                                                            handleSlotChange(
                                                                selectedSlotIndex,
                                                                'stat2_value',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="0"
                                                        className="w-1/2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-2 py-2 text-sm font-black text-center focus:ring-2 focus:ring-sffl-red outline-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* Stat 3 */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 truncate">
                                                    Stat 3: {activeSlot.stat3_label || 'Value'}
                                                </label>
                                                <div className="flex gap-1.5">
                                                    <input
                                                        type="text"
                                                        value={activeSlot.stat3_label || ''}
                                                        onChange={(e) =>
                                                            handleSlotChange(
                                                                selectedSlotIndex,
                                                                'stat3_label',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Label"
                                                        className="w-1/2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg px-2 py-2 text-xs font-bold"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={activeSlot.stat3_value || ''}
                                                        onChange={(e) =>
                                                            handleSlotChange(
                                                                selectedSlotIndex,
                                                                'stat3_value',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="0"
                                                        className="w-1/2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-2 py-2 text-sm font-black text-center focus:ring-2 focus:ring-sffl-red outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Empty slot call to action */
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-center sm:text-left bg-white dark:bg-gray-800">
                                        <div>
                                            <h5 className="font-black text-base text-sffl-navy dark:text-white">
                                                Position Unassigned: {activeSlot.slot_code} ({activeSlot.label || activeSlot.unit})
                                            </h5>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                Click to select any player from the roster for this Starting XIV spot.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenPicker(selectedSlotIndex)}
                                            className="px-5 py-2.5 bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer shrink-0"
                                        >
                                            <UserPlusIcon className="w-4 h-4" />
                                            <span>Assign Player to {activeSlot.slot_code}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Bottom Save Action Bar */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => {
                                setIsEditing(false);
                                setEditingTotwId(null);
                            }}
                            className="px-5 py-2.5 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-6 py-2.5 bg-sffl-red hover:bg-[#A52323] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-colors cursor-pointer"
                        >
                            {editingTotwId ? 'Save Changes' : 'Create & Save'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── PLAYER PICKER MODAL (NO RESTRICTIONS) ────────────────────── */}
            {pickingSlotIndex !== null && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setPickingSlotIndex(null)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-sffl-navy dark:text-white">
                                    Assign Player: {slots[pickingSlotIndex]?.slot_code} ({slots[pickingSlotIndex]?.unit})
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Select any player from the roster at admin discretion
                                </p>
                            </div>
                            <button
                                onClick={() => setPickingSlotIndex(null)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search & Optional Filters */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 space-y-3">
                            <div className="relative">
                                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by player name or jersey #..."
                                    value={playerSearchQuery}
                                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl pl-10 pr-4 py-2 text-sm font-bold focus:ring-2 focus:ring-sffl-red outline-none"
                                    autoFocus
                                />
                            </div>

                            {/* Position Chips for convenience */}
                            <div className="flex flex-wrap gap-1.5 text-xs font-black">
                                {[
                                    { key: 'ALL', label: 'All Players' },
                                    { key: 'FEMALE', label: 'Women (Quota ♀)' },
                                    { key: 'QB', label: 'QBs' },
                                    { key: 'WR', label: 'Receivers' },
                                    { key: 'C', label: 'Centers' },
                                    { key: 'RUSH', label: 'Rushers' },
                                    { key: 'DEF', label: 'Defenders' },
                                    { key: 'S', label: 'Safeties' },
                                ].map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setPositionFilter(tab.key)}
                                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                            positionFilter === tab.key
                                                ? 'bg-sffl-red text-white shadow-sm'
                                                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Player List */}
                        <div className="p-4 overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-700/50 space-y-1">
                            {loadingPlayers ? (
                                <Loader />
                            ) : filteredAvailablePlayers.length === 0 ? (
                                <div className="text-center py-8 text-xs font-bold text-gray-400">
                                    No players found matching your criteria.
                                </div>
                            ) : (
                                filteredAvailablePlayers.map((player) => {
                                    // Check if this player is currently assigned anywhere on the board
                                    const assignedSlot = slots.find((s) => s.player_id === player.id);
                                    const isAssignedToThisSlot =
                                        pickingSlotIndex !== null &&
                                        slots[pickingSlotIndex]?.player_id === player.id;

                                    return (
                                        <button
                                            key={player.id}
                                            type="button"
                                            onClick={() => handleSelectPlayer(pickingSlotIndex, player)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors text-left group cursor-pointer ${
                                                isAssignedToThisSlot
                                                    ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
                                            }`}
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
                                                    <div className="font-black text-sm text-sffl-navy dark:text-white group-hover:text-sffl-red transition-colors flex items-center gap-2">
                                                        <span>{player.name}</span>
                                                        {assignedSlot && (
                                                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                                                                {isAssignedToThisSlot
                                                                    ? 'Current'
                                                                    : `In ${assignedSlot.slot_code}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                        <span className="font-bold text-gray-600 dark:text-gray-300">
                                                            {player.position}
                                                        </span>
                                                        {isFemale(player.gender) && (
                                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                                                ♀ Female
                                                            </span>
                                                        )}
                                                        {player.team?.name && <span>• {player.team.name}</span>}
                                                        {player.jersey_number && (
                                                            <span>• #{player.jersey_number}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-black text-sffl-red opacity-0 group-hover:opacity-100 transition-opacity">
                                                {isAssignedToThisSlot
                                                    ? 'Selected ✓'
                                                    : assignedSlot
                                                    ? `Move to ${slots[pickingSlotIndex]?.slot_code} →`
                                                    : 'Select →'}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
