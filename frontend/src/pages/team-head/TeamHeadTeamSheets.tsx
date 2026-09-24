import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    getMatches,
    getTeamHeadTeamSheet,
    saveTeamHeadTeamSheet,
    type Match,
    type TeamSheetPlayer,
    type SaveTeamSheetPayload,
} from '../../services/api';
import api from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import {
    MagnifyingGlassIcon,
    XMarkIcon,
    ArrowsRightLeftIcon,
    ShieldCheckIcon,
    UserPlusIcon,
    SparklesIcon,
    ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

interface TeamInfo {
    id: string;
    name: string;
    short_name: string;
    logo: string;
}

interface ClubPlayer {
    id: string;
    name: string;
    jersey_number: number;
    position: string;
    secondary_position?: string;
    gender?: string;
    image: string;
    rating?: number | null;
    is_reserve?: boolean;
    status?: string;
}

// ── Coverage Schemes ────────────────────────────────────────────────────────
interface CoverageLayout {
    name: string;
    tagline: string;
    description: string;
    deep: [number, number][];
    under: [number, number][];
}

const COVERAGE_SCHEMES: Record<number, CoverageLayout> = {
    1: {
        name: 'Cover 1',
        tagline: '1 Rusher · 5 Underneath · 1 Deep',
        description: 'Aggressive man coverage underneath with a single deep center-field safety.',
        deep: [[50, 18]],
        under: [[12, 42], [31, 40], [50, 43], [69, 40], [88, 42]],
    },
    2: {
        name: 'Cover 2',
        tagline: '1 Rusher · 4 Underneath · 2 Deep',
        description: 'Balanced coverage with two deep safeties protecting the sidelines and seams.',
        deep: [[32, 18], [68, 18]],
        under: [[14, 42], [38, 40], [62, 40], [86, 42]],
    },
    3: {
        name: 'Cover 3',
        tagline: '1 Rusher · 3 Underneath · 3 Deep',
        description: 'Three deep zone defenders guarding deep thirds, backed by central underneath coverage.',
        deep: [[20, 18], [50, 15], [80, 18]],
        under: [[18, 42], [50, 40], [82, 42]],
    },
    4: {
        name: 'Cover 4',
        tagline: '1 Rusher · 2 Underneath · 4 Deep',
        description: 'Quarters defense with four deep safeties for maximum deep-ball and prevent protection.',
        deep: [[14, 18], [38, 16], [62, 16], [86, 18]],
        under: [[32, 42], [68, 42]],
    },
};

// ── Offensive Starter Slot Definitions ───────────────────────────────────────
interface StarterSlotMeta {
    key: string;
    label: string;
    shortRole: string;
    unit: 'OFFENSE' | 'DEFENSE';
    requiredGender?: 'M' | 'F';
    recommendedPosition: string;
    x: number;
    y: number;
}

const OFFENSE_SLOTS: StarterSlotMeta[] = [
    { key: 'WR_1', label: 'Wide Receiver 1', shortRole: 'Receiver', unit: 'OFFENSE', recommendedPosition: 'Receiver', x: 12, y: 28 },
    { key: 'WR_2', label: 'Wide Receiver 2', shortRole: 'Receiver', unit: 'OFFENSE', recommendedPosition: 'Receiver', x: 36, y: 24 },
    { key: 'CENTER', label: 'Center (Snapper)', shortRole: 'Center', unit: 'OFFENSE', recommendedPosition: 'Center', x: 50, y: 54 },
    { key: 'WR_3', label: 'Wide Receiver 3', shortRole: 'Receiver', unit: 'OFFENSE', recommendedPosition: 'Receiver', x: 64, y: 24 },
    { key: 'WR_4', label: 'Wide Receiver 4', shortRole: 'Receiver', unit: 'OFFENSE', recommendedPosition: 'Receiver', x: 88, y: 28 },
    { key: 'MALE_QB', label: 'Male QB', shortRole: 'Male QB', unit: 'OFFENSE', requiredGender: 'M', recommendedPosition: 'QB', x: 38, y: 77 },
    { key: 'FEMALE_QB', label: 'Female QB / Rec', shortRole: 'Female QB', unit: 'OFFENSE', requiredGender: 'F', recommendedPosition: 'QB', x: 62, y: 77 },
];

const DEFENSE_SLOT_KEYS = ['RUSHER', 'DEF_1', 'DEF_2', 'DEF_3', 'DEF_4', 'DEF_5', 'DEF_6'];

export const TeamHeadTeamSheets = () => {
    const { team } = useOutletContext<{ team: TeamInfo | null }>();
    const queryClient = useQueryClient();

    // ── Fixtures list for this manager's team ─────────────────────────────────
    const { data: matchesData, isLoading: matchesLoading } = useQuery({
        queryKey: ['teamHeadMatches', team?.id],
        queryFn: async () => {
            if (!team?.id) return { data: [] as Match[] };
            const res = await getMatches(undefined, 1, 50, undefined, undefined, team.id);
            return res;
        },
        enabled: !!team?.id,
    });

    const matches = matchesData?.data || [];
    const [selectedMatchId, setSelectedMatchId] = useState<string>('');

    // Auto-select first active or scheduled match
    useEffect(() => {
        if (!selectedMatchId && matches.length > 0) {
            // Prefer an upcoming or live match, else the first match
            const activeMatch = matches.find(m => m.status === 'LIVE' || m.status === 'SCHEDULED') || matches[0];
            setSelectedMatchId(activeMatch.id);
        }
    }, [matches, selectedMatchId]);

    const currentMatch = useMemo(() => {
        return matches.find(m => m.id === selectedMatchId) || null;
    }, [matches, selectedMatchId]);

    // ── Current Match Team Sheet from Server ──────────────────────────────────
    const { data: teamSheetData, isLoading: teamSheetLoading } = useQuery({
        queryKey: ['teamHeadTeamSheet', selectedMatchId],
        queryFn: () => getTeamHeadTeamSheet(selectedMatchId),
        enabled: !!selectedMatchId,
    });

    // ── Main Club Roster for this manager's team (25-man squad, no reserves) ──
    const { data: clubPlayersData, isLoading: rosterLoading } = useQuery({
        queryKey: ['teamHeadSquadPlayers', team?.id],
        queryFn: async () => {
            const res = await api.get('/team-head/players', {
                params: {
                    team_id: team!.id,
                    limit: 100,
                    roster_status: 'main',
                },
            });
            return (res.data?.data || []) as ClubPlayer[];
        },
        enabled: !!team?.id,
    });

    const clubPlayers: ClubPlayer[] = useMemo(() => {
        return (clubPlayersData || []).filter(p => p.status !== 'inactive' && !p.is_reserve);
    }, [clubPlayersData]);

    // ── Local Lineup State ───────────────────────────────────────────────────
    const [coverage, setCoverage] = useState<number>(2);
    const [offenseStarters, setOffenseStarters] = useState<Record<string, ClubPlayer | null>>({
        WR_1: null,
        WR_2: null,
        CENTER: null,
        WR_3: null,
        WR_4: null,
        MALE_QB: null,
        FEMALE_QB: null,
    });
    const [defenseStarters, setDefenseStarters] = useState<Record<string, ClubPlayer | null>>({
        RUSHER: null,
        DEF_1: null,
        DEF_2: null,
        DEF_3: null,
        DEF_4: null,
        DEF_5: null,
        DEF_6: null,
    });
    const [substitutes, setSubstitutes] = useState<ClubPlayer[]>([]);

    // ── Interactive UI Selection State ───────────────────────────────────────
    // User can select a starter slot to initiate swap with another slot or bench player
    const [selectedSlotForSwap, setSelectedSlotForSwap] = useState<{
        unit: 'OFFENSE' | 'DEFENSE';
        slotKey: string;
        player: ClubPlayer | null;
    } | null>(null);

    // Modal to pick a player for a specific slot or to add to bench
    const [pickerTarget, setPickerTarget] = useState<{
        type: 'STARTER' | 'BENCH';
        unit?: 'OFFENSE' | 'DEFENSE';
        slotKey?: string;
        slotLabel?: string;
        requiredGender?: 'M' | 'F';
        recommendedPosition?: string;
    } | null>(null);

    // Filter inside Picker Modal
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerPositionFilter, setPickerPositionFilter] = useState<string>('ALL');

    // UI tab for Mobile view (Pitch Offense vs Pitch Defense vs Bench)
    const [mobileUnitTab, setMobileUnitTab] = useState<'offense' | 'defense' | 'bench'>('offense');

    // ── Populate State when Team Sheet Data Loads ────────────────────────────
    useEffect(() => {
        if (!teamSheetData || !team?.id || clubPlayers.length === 0) return;

        const isHome = currentMatch?.home_team?.id === team.id;
        const serverCoverage = isHome ? (teamSheetData.home_coverage || 2) : (teamSheetData.away_coverage || 2);
        const serverPlayers = isHome ? (teamSheetData.home_team || []) : (teamSheetData.away_team || []);

        setCoverage(serverCoverage >= 1 && serverCoverage <= 4 ? serverCoverage : 2);

        // Helper to find player details from clubPlayers or fallback to server row
        const resolvePlayer = (sp: TeamSheetPlayer): ClubPlayer => {
            const matchInClub = clubPlayers.find(cp => cp.id === sp.player_id);
            if (matchInClub) {
                return {
                    ...matchInClub,
                    rating: sp.rating ?? matchInClub.rating ?? null,
                };
            }
            return {
                id: sp.player_id,
                name: sp.name,
                jersey_number: sp.jersey_number,
                position: sp.position,
                gender: sp.gender,
                image: sp.image,
                rating: sp.rating ?? null,
            };
        };

        const newOffense: Record<string, ClubPlayer | null> = {
            WR_1: null,
            WR_2: null,
            CENTER: null,
            WR_3: null,
            WR_4: null,
            MALE_QB: null,
            FEMALE_QB: null,
        };
        const newDefense: Record<string, ClubPlayer | null> = {
            RUSHER: null,
            DEF_1: null,
            DEF_2: null,
            DEF_3: null,
            DEF_4: null,
            DEF_5: null,
            DEF_6: null,
        };
        const newSubs: ClubPlayer[] = [];

        // Partition starters and substitutes
        serverPlayers.forEach((sp) => {
            const player = resolvePlayer(sp);
            if (sp.is_starter) {
                if (sp.starter_unit === 'OFFENSE' && sp.position_slot && newOffense[sp.position_slot] === null) {
                    newOffense[sp.position_slot] = player;
                } else if (sp.starter_unit === 'DEFENSE' && sp.position_slot && newDefense[sp.position_slot] === null) {
                    newDefense[sp.position_slot] = player;
                } else {
                    // Fallback sequential placement if slots were not keyed
                    const emptyOffenseKey = Object.keys(newOffense).find(k => newOffense[k] === null);
                    if (emptyOffenseKey) {
                        newOffense[emptyOffenseKey] = player;
                    } else {
                        const emptyDefenseKey = Object.keys(newDefense).find(k => newDefense[k] === null);
                        if (emptyDefenseKey) {
                            newDefense[emptyDefenseKey] = player;
                        } else {
                            newSubs.push(player);
                        }
                    }
                }
            } else {
                newSubs.push(player);
            }
        });

        setOffenseStarters(newOffense);
        setDefenseStarters(newDefense);
        setSubstitutes(newSubs);
        setSelectedSlotForSwap(null);
    }, [teamSheetData, currentMatch, team?.id, clubPlayers]);

    // ── Computed Lineup Metrics ──────────────────────────────────────────────
    const allAssignedStarters = useMemo(() => {
        const off = Object.entries(offenseStarters).filter(([, p]) => p !== null) as [string, ClubPlayer][];
        const def = Object.entries(defenseStarters).filter(([, p]) => p !== null) as [string, ClubPlayer][];
        return {
            offense: off,
            defense: def,
            all: [...off.map(([, p]) => p), ...def.map(([, p]) => p)],
        };
    }, [offenseStarters, defenseStarters]);

    const startersCount = allAssignedStarters.all.length;
    const totalSquadCount = startersCount + substitutes.length;

    // Check unique starters
    const starterIdSet = useMemo(() => {
        return new Set(allAssignedStarters.all.map(p => p.id));
    }, [allAssignedStarters]);

    const isStarterUniquenessValid = starterIdSet.size === startersCount;

    const isMatchFinished = currentMatch?.status === 'FINISHED';

    // Mirrors the server rules in SaveTeamHeadTeamSheet so the manager sees why
    // a save is blocked instead of getting an error after pressing Save. A squad
    // with no starters at all is allowed (named squad, lineup announced later).
    const saveBlockReason = useMemo((): string | null => {
        if (isMatchFinished) return 'This match is finished — its team sheet is locked.';
        if (totalSquadCount > 25) return 'Match squad is over the 25-player cap.';
        if (!isStarterUniquenessValid) return 'A player is in more than one starter slot.';
        if (startersCount > 0) {
            if (allAssignedStarters.offense.length !== 7 || allAssignedStarters.defense.length !== 7) {
                return 'Fill all 14 starter slots (7 attack · 7 defence), or clear them to save the squad only.';
            }
            const femaleStarters = allAssignedStarters.all.filter(p => (p.gender || '').toUpperCase() === 'F').length;
            if (femaleStarters < 2) return 'The starting lineup needs at least 2 female players.';
        }
        return null;
    }, [isMatchFinished, totalSquadCount, isStarterUniquenessValid, startersCount, allAssignedStarters]);

    // Helper format rating
    const formatRating = (rating?: number | null) => {
        if (rating === undefined || rating === null || rating <= 0) return '-';
        return Number(rating).toFixed(1);
    };

    // ── Slot & Swap Mutations ────────────────────────────────────────────────
    /**
     * Assigns a player into a starter slot.
     * Enforces uniqueness: If player was already in another starter slot, that slot is cleared.
     * If player was in substitutes, player is removed from substitutes.
     * If target slot already had a player, that old player is moved to bench (if room) or swapped.
     */
    const assignPlayerToStarterSlot = (unit: 'OFFENSE' | 'DEFENSE', slotKey: string, player: ClubPlayer) => {
        setOffenseStarters((prevOff) => {
            const nextOff = { ...prevOff };
            // Clear if already in offense
            for (const k in nextOff) {
                if (nextOff[k]?.id === player.id) nextOff[k] = null;
            }
            if (unit === 'OFFENSE') {
                nextOff[slotKey] = player;
            }
            return nextOff;
        });

        setDefenseStarters((prevDef) => {
            const nextDef = { ...prevDef };
            // Clear if already in defense
            for (const k in nextDef) {
                if (nextDef[k]?.id === player.id) nextDef[k] = null;
            }
            if (unit === 'DEFENSE') {
                nextDef[slotKey] = player;
            }
            return nextDef;
        });

        // Remove from substitutes if they were on bench
        setSubstitutes((prevSubs) => prevSubs.filter(p => p.id !== player.id));
        setSelectedSlotForSwap(null);
        setPickerTarget(null);
    };

    /**
     * Quick swap between selected starter slot and another starter or bench player
     */
    const handleSlotClick = (unit: 'OFFENSE' | 'DEFENSE', slotKey: string, player: ClubPlayer | null) => {
        // If we currently have a starter slot selected for swap:
        if (selectedSlotForSwap) {
            // Clicking same slot cancels selection
            if (selectedSlotForSwap.unit === unit && selectedSlotForSwap.slotKey === slotKey) {
                setSelectedSlotForSwap(null);
                return;
            }

            const sourcePlayer = selectedSlotForSwap.player;
            const targetPlayer = player;

            if (!sourcePlayer) {
                // Just move focus to this slot
                setSelectedSlotForSwap({ unit, slotKey, player });
                return;
            }

            // Perform swap between two starter slots!
            if (selectedSlotForSwap.unit === 'OFFENSE') {
                setOffenseStarters(prev => ({ ...prev, [selectedSlotForSwap.slotKey]: targetPlayer }));
            } else {
                setDefenseStarters(prev => ({ ...prev, [selectedSlotForSwap.slotKey]: targetPlayer }));
            }

            if (unit === 'OFFENSE') {
                setOffenseStarters(prev => ({ ...prev, [slotKey]: sourcePlayer }));
            } else {
                setDefenseStarters(prev => ({ ...prev, [slotKey]: sourcePlayer }));
            }

            setSelectedSlotForSwap(null);
            toast.success('Starters swapped successfully!');
            return;
        }

        // Otherwise, if slot is empty, open picker modal
        if (!player) {
            const meta = unit === 'OFFENSE'
                ? OFFENSE_SLOTS.find(s => s.key === slotKey)
                : null;
            setPickerTarget({
                type: 'STARTER',
                unit,
                slotKey,
                slotLabel: meta?.label || (slotKey === 'RUSHER' ? 'Rusher' : 'Defender'),
                requiredGender: meta?.requiredGender,
                recommendedPosition: meta?.recommendedPosition || (slotKey === 'RUSHER' ? 'Rusher' : 'Defender'),
            });
            setPickerSearch('');
            setPickerPositionFilter('ALL');
        } else {
            // Slot is filled: select it so user can swap with bench or another slot
            setSelectedSlotForSwap({ unit, slotKey, player });
        }
    };

    /**
     * Handle clicking a bench substitute
     */
    const handleSubClick = (sub: ClubPlayer) => {
        // If a starter slot is selected, swap directly!
        if (selectedSlotForSwap && selectedSlotForSwap.player) {
            const starterToMove = selectedSlotForSwap.player;
            const targetUnit = selectedSlotForSwap.unit;
            const targetSlotKey = selectedSlotForSwap.slotKey;

            // Put substitute in starter slot
            if (targetUnit === 'OFFENSE') {
                setOffenseStarters(prev => ({ ...prev, [targetSlotKey]: sub }));
            } else {
                setDefenseStarters(prev => ({ ...prev, [targetSlotKey]: sub }));
            }

            // Put previous starter on bench in place of sub
            setSubstitutes(prev => prev.map(p => p.id === sub.id ? starterToMove : p));
            setSelectedSlotForSwap(null);
            toast.success(`${sub.name} moved into starter lineup!`);
            return;
        }

        // If no starter slot selected, give options or highlight
        toast(`Selected ${sub.name}. Click any starter slot on the pitch to swap.`, {
            icon: '🔄',
        });
    };

    /**
     * Clear a starter slot
     */
    const handleClearSlot = (e: React.MouseEvent, unit: 'OFFENSE' | 'DEFENSE', slotKey: string, player: ClubPlayer) => {
        e.stopPropagation();
        if (unit === 'OFFENSE') {
            setOffenseStarters(prev => ({ ...prev, [slotKey]: null }));
        } else {
            setDefenseStarters(prev => ({ ...prev, [slotKey]: null }));
        }

        // Add to substitutes if not exceeding 25 squad cap
        if (totalSquadCount < 25) {
            setSubstitutes(prev => [...prev, player]);
            toast.success(`${player.name} moved to match substitutes.`);
        } else {
            toast.success(`${player.name} unassigned from lineup.`);
        }

        if (selectedSlotForSwap?.slotKey === slotKey) {
            setSelectedSlotForSwap(null);
        }
    };

    /**
     * Add player to bench
     */
    const handleAddPlayerToBench = (player: ClubPlayer) => {
        if (totalSquadCount >= 25) {
            toast.error('Maximum match squad limit of 25 players reached!');
            return;
        }

        // If already starter, remove from starter slot
        for (const k in offenseStarters) {
            if (offenseStarters[k]?.id === player.id) {
                setOffenseStarters(prev => ({ ...prev, [k]: null }));
            }
        }
        for (const k in defenseStarters) {
            if (defenseStarters[k]?.id === player.id) {
                setDefenseStarters(prev => ({ ...prev, [k]: null }));
            }
        }

        if (!substitutes.some(p => p.id === player.id)) {
            setSubstitutes(prev => [...prev, player]);
            toast.success(`${player.name} added to match bench.`);
        }
        setPickerTarget(null);
    };

    /**
     * Remove player from bench
     */
    const handleRemoveFromBench = (playerId: string) => {
        setSubstitutes(prev => prev.filter(p => p.id !== playerId));
        toast.success('Player removed from match bench.');
    };

    /**
     * Intelligent Auto-Fill Lineup
     * Automatically assigns best available players from roster into 14 starter slots.
     */
    const handleAutoFill = () => {
        // Sort highest rated players first so auto-fill selects the top performers
        const available = [...clubPlayers].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
        const assignedIds = new Set<string>();

        const pickNext = (predicate: (p: ClubPlayer) => boolean): ClubPlayer | null => {
            const found = available.find(p => !assignedIds.has(p.id) && predicate(p));
            if (found) {
                assignedIds.add(found.id);
                return found;
            }
            // Fallback to any remaining player
            const fallback = available.find(p => !assignedIds.has(p.id));
            if (fallback) {
                assignedIds.add(fallback.id);
                return fallback;
            }
            return null;
        };

        const newOff: Record<string, ClubPlayer | null> = {};
        // 1. Male QB
        newOff.MALE_QB = pickNext(p => (p.gender === 'M' || !p.gender) && (p.position === 'QB' || p.secondary_position === 'QB'));
        // 2. Female QB / Rec
        newOff.FEMALE_QB = pickNext(p => (p.gender === 'F') && (p.position === 'QB' || p.position === 'Receiver'));
        // 3. Center
        newOff.CENTER = pickNext(p => p.position === 'Center' || p.secondary_position === 'Center');
        // 4. Receivers
        newOff.WR_1 = pickNext(p => p.position === 'Receiver');
        newOff.WR_2 = pickNext(p => p.position === 'Receiver');
        newOff.WR_3 = pickNext(p => p.position === 'Receiver');
        newOff.WR_4 = pickNext(p => p.position === 'Receiver');

        const newDef: Record<string, ClubPlayer | null> = {};
        // 5. Rusher
        newDef.RUSHER = pickNext(p => p.position === 'Rusher' || p.secondary_position === 'Rusher');
        // 6. Defenders
        for (let i = 1; i <= 6; i++) {
            newDef[`DEF_${i}`] = pickNext(p => p.position === 'Defender' || p.secondary_position === 'Defender');
        }

        // Remaining players become bench substitutes up to 11 (total <= 25)
        const newSubs: ClubPlayer[] = [];
        for (const p of available) {
            if (!assignedIds.has(p.id) && (assignedIds.size + newSubs.length < 25)) {
                newSubs.push(p);
            }
        }

        setOffenseStarters(newOff);
        setDefenseStarters(newDef);
        setSubstitutes(newSubs);
        setSelectedSlotForSwap(null);
        toast.success('Lineup auto-filled based on roster roles!');
    };

    // ── Save Team Sheet Mutation ─────────────────────────────────────────────
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!team?.id || !selectedMatchId) throw new Error('Missing team or match ID');

            const playersPayload: SaveTeamSheetPayload['players'] = [];
            const playerIds: string[] = [];

            // 7 Offense starters
            OFFENSE_SLOTS.forEach((slot, idx) => {
                const p = offenseStarters[slot.key];
                if (p) {
                    playersPayload.push({
                        player_id: p.id,
                        is_starter: true,
                        starter_unit: 'OFFENSE',
                        position_slot: slot.key,
                        order_index: idx,
                    });
                    playerIds.push(p.id);
                }
            });

            // 7 Defense starters
            DEFENSE_SLOT_KEYS.forEach((slotKey, idx) => {
                const p = defenseStarters[slotKey];
                if (p) {
                    playersPayload.push({
                        player_id: p.id,
                        is_starter: true,
                        starter_unit: 'DEFENSE',
                        position_slot: slotKey,
                        order_index: idx + 7,
                    });
                    playerIds.push(p.id);
                }
            });

            // Substitutes
            substitutes.forEach((p, idx) => {
                playersPayload.push({
                    player_id: p.id,
                    is_starter: false,
                    order_index: idx + 14,
                });
                playerIds.push(p.id);
            });

            const payload: SaveTeamSheetPayload = {
                team_id: team.id,
                coverage,
                players: playersPayload,
                player_ids: playerIds,
            };

            return await saveTeamHeadTeamSheet(selectedMatchId, payload);
        },
        onSuccess: () => {
            toast.success('Team Sheet saved successfully!');
            queryClient.invalidateQueries({ queryKey: ['teamHeadTeamSheet', selectedMatchId] });
            queryClient.invalidateQueries({ queryKey: ['publicMatchDetail', selectedMatchId] });
        },
        onError: (err: any) => {
            const msg = err.response?.data?.error || err.message || 'Failed to save team sheet';
            toast.error(msg);
        },
    });

    // ── Defense Slot Mapping for Pitch Based on Coverage ────────────────────
    const currentDefenseScheme = COVERAGE_SCHEMES[coverage] || COVERAGE_SCHEMES[2];

    const defenseSlotsMeta = useMemo(() => {
        const slots: Array<{
            key: string;
            label: string;
            roleOnPitch: string;
            x: number;
            y: number;
        }> = [];

        // Rusher always at 50%, 69%
        slots.push({
            key: 'RUSHER',
            label: 'Rusher',
            roleOnPitch: 'Rusher',
            x: 50,
            y: 69,
        });

        // Underneath defenders
        currentDefenseScheme.under.forEach(([x, y], idx) => {
            const defKey = `DEF_${idx + 1}`;
            slots.push({
                key: defKey,
                label: `Underneath Defender ${idx + 1}`,
                roleOnPitch: 'Underneath Defender',
                x,
                y,
            });
        });

        // Deep defenders
        const underCount = currentDefenseScheme.under.length;
        currentDefenseScheme.deep.forEach(([x, y], idx) => {
            const defKey = `DEF_${underCount + idx + 1}`;
            slots.push({
                key: defKey,
                label: `Deep Defender ${idx + 1}`,
                roleOnPitch: idx === 0 && currentDefenseScheme.deep.length === 1 ? 'Free Safety' : 'Deep Defender',
                x,
                y,
            });
        });

        return slots;
    }, [currentDefenseScheme]);

    // ── Filtered Players for Picker Modal ────────────────────────────────────
    const filteredPickerPlayers = useMemo(() => {
        if (!pickerTarget) return [];

        return clubPlayers.filter(p => {
            // Search query filter
            if (pickerSearch) {
                const q = pickerSearch.toLowerCase();
                const matchesName = p.name.toLowerCase().includes(q);
                const matchesNum = String(p.jersey_number).includes(q);
                if (!matchesName && !matchesNum) return false;
            }

            // Position tab filter
            if (pickerPositionFilter !== 'ALL') {
                if (pickerPositionFilter === 'QB' && p.position !== 'QB' && p.secondary_position !== 'QB') return false;
                if (pickerPositionFilter === 'WR' && p.position !== 'Receiver' && p.secondary_position !== 'Receiver') return false;
                if (pickerPositionFilter === 'C' && p.position !== 'Center' && p.secondary_position !== 'Center') return false;
                if (pickerPositionFilter === 'RUSH' && p.position !== 'Rusher' && p.secondary_position !== 'Rusher') return false;
                if (pickerPositionFilter === 'DEF' && p.position !== 'Defender' && p.secondary_position !== 'Defender') return false;
            }

            return true;
        });
    }, [clubPlayers, pickerTarget, pickerSearch, pickerPositionFilter]);

    if (!team) {
        return (
            <div className="text-center py-20">
                <p className="text-2xl font-black text-gray-400 dark:text-gray-500">No team assigned</p>
                <p className="text-gray-500 mt-2">Contact an administrator to get assigned to a team.</p>
            </div>
        );
    }

    if (matchesLoading || rosterLoading || (selectedMatchId && teamSheetLoading)) {
        return <Loader />;
    }

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
            {/* ── Page Header Banner (Strict Showtime Pattern) ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-sffl-navy text-white p-6 md:p-8 rounded-xl md:rounded-2xl shadow-xl gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs uppercase font-black tracking-widest text-sffl-red bg-white/10 px-2.5 py-0.5 rounded-full">
                            Manager Portal
                        </span>
                        <span className="text-xs text-gray-300 font-bold uppercase">
                            {team.name}
                        </span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">
                        MATCH TEAM SHEET
                    </h1>
                    <p className="text-gray-300 mt-1 text-sm md:text-base">
                        Configure starting units (7 Attack · 7 Defense), coverage scheme, and match substitutes.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Fixture Selector */}
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3.5 py-2 flex items-center gap-2 text-white">
                        <label className="text-[10px] font-black uppercase text-gray-300">Match:</label>
                        <select
                            value={selectedMatchId}
                            onChange={(e) => setSelectedMatchId(e.target.value)}
                            className="bg-transparent text-white font-bold text-xs md:text-sm focus:outline-none cursor-pointer pr-4"
                        >
                            {matchesLoading ? (
                                <option className="text-gray-900">Loading fixtures...</option>
                            ) : matches.length === 0 ? (
                                <option className="text-gray-900">No matches scheduled</option>
                            ) : (
                                matches.map((m) => {
                                    const isHome = m.home_team?.id === team.id;
                                    const opponent = isHome ? m.away_team?.name || 'TBD' : m.home_team?.name || 'TBD';
                                    const venue = isHome ? 'vs' : '@';
                                    const dateStr = m.date ? new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
                                    return (
                                        <option key={m.id} value={m.id} className="text-gray-900">
                                            {venue} {opponent} ({dateStr || m.status}){m.status === 'FINISHED' ? ' · Final' : ''}
                                        </option>
                                    );
                                })
                            )}
                        </select>
                    </div>

                    {/* Auto Fill Button */}
                    <button
                        type="button"
                        onClick={handleAutoFill}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-black text-xs md:text-sm uppercase tracking-tight transition-all active:scale-95 border border-white/20"
                        title="Intelligently auto-populate starters from your squad"
                    >
                        <SparklesIcon className="w-4 h-4 text-amber-300" />
                        Auto-Fill
                    </button>

                    {/* Primary Save Button */}
                    <button
                        type="button"
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending || !selectedMatchId || !!saveBlockReason}
                        title={saveBlockReason || undefined}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs md:text-sm uppercase tracking-tight rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saveMutation.isPending ? (
                            <>
                                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <ShieldCheckIcon className="w-4 h-4" />
                                Save Team Sheet
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Status Bar & Validation Strip ── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Starters counter */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600">
                        <span className={`w-2.5 h-2.5 rounded-full ${startersCount === 14 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                        <span className="text-xs font-black text-gray-900 dark:text-white uppercase">
                            Starters: {startersCount} / 14
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                            ({allAssignedStarters.offense.length} Off · {allAssignedStarters.defense.length} Def)
                        </span>
                    </div>

                    {/* Substitutes counter */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600">
                        <span className="text-xs font-black text-gray-900 dark:text-white uppercase">
                            Substitutes: {substitutes.length}
                        </span>
                    </div>

                    {/* Total 25-cap badge */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black uppercase ${
                        totalSquadCount <= 25
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                    }`}>
                        <span>Match Squad: {totalSquadCount} / 25 Cap</span>
                    </div>

                    {/* Why Save is disabled */}
                    {saveBlockReason && (
                        <div className="w-full text-xs font-bold text-amber-700 dark:text-amber-300">
                            ⚠ {saveBlockReason}
                        </div>
                    )}

                    {/* Uniqueness status */}
                    <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300">
                        {isStarterUniquenessValid ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                ✓ 14 Unique Starters
                            </span>
                        ) : (
                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                ⚠ Duplicate Starters Detected
                            </span>
                        )}
                    </div>
                </div>

                {/* Right Quick Info / Preview Link */}
                <div className="flex items-center gap-2">
                    {selectedMatchId && (
                        <Link
                            to={`/matches/${selectedMatchId}?tab=rating`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-sffl-navy dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                        >
                            <span>Public Centre</span>
                            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                        </Link>
                    )}
                </div>
            </div>

            {/* ── Selection Instruction Banner (if a slot is selected for swapping) ── */}
            {selectedSlotForSwap && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 p-3.5 rounded-xl flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-xs md:text-sm font-bold shadow-sm animate-fade-in">
                    <div className="flex items-center gap-2">
                        <ArrowsRightLeftIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>
                            <strong>{selectedSlotForSwap.player?.name}</strong> is selected. Click another starter slot or any bench substitute to swap positions.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSelectedSlotForSwap(null)}
                        className="px-2.5 py-1 rounded-lg bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-white font-black text-xs uppercase hover:bg-amber-300"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* ── Mobile Unit Switcher (Attack / Defense / Bench) ── */}
            <div className="grid grid-cols-3 xl:hidden bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                <button
                    type="button"
                    onClick={() => setMobileUnitTab('offense')}
                    className={`py-2 px-3 rounded-lg font-black text-xs uppercase tracking-tight transition-all ${
                        mobileUnitTab === 'offense'
                            ? 'bg-sffl-navy text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-300'
                    }`}
                >
                    ⚔️ Attack ({allAssignedStarters.offense.length}/7)
                </button>
                <button
                    type="button"
                    onClick={() => setMobileUnitTab('defense')}
                    className={`py-2 px-3 rounded-lg font-black text-xs uppercase tracking-tight transition-all ${
                        mobileUnitTab === 'defense'
                            ? 'bg-sffl-navy text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-300'
                    }`}
                >
                    🛡️ Defense ({allAssignedStarters.defense.length}/7)
                </button>
                <button
                    type="button"
                    onClick={() => setMobileUnitTab('bench')}
                    className={`py-2 px-3 rounded-lg font-black text-xs uppercase tracking-tight transition-all ${
                        mobileUnitTab === 'bench'
                            ? 'bg-sffl-navy text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-300'
                    }`}
                >
                    🪑 Bench ({substitutes.length})
                </button>
            </div>

            {/* ── Dual Formations: Attack (Offense) & Defense ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* ── 1. ATTACK / OFFENSE FORMATION CARD ── */}
                <div className={`bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 md:p-6 shadow-sm ${
                    mobileUnitTab !== 'offense' ? 'hidden xl:block' : ''
                }`}>
                    <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                        <div>
                            <h2 className="text-lg md:text-xl font-black text-sffl-navy dark:text-white flex items-center gap-2">
                                <span>⚔️ Offensive Starters</span>
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                2 QBs (1 Male · 1 Female) · 1 Center · 4 Receivers
                            </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                            {allAssignedStarters.offense.length} / 7 Selected
                        </span>
                    </div>

                    {/* Turf Pitch for Offense */}
                    <div className="w-full h-[540px] md:h-[580px] rounded-2xl relative overflow-hidden shadow-inner border-2 border-[#1c4d63] bg-gradient-to-b from-[#123c52] to-[#0c2a3b] select-none">
                        {/* Turf Yard Striping */}
                        <div
                            className="absolute inset-0 opacity-20 pointer-events-none"
                            style={{
                                backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 54px, rgba(255,255,255,0.12) 55px 108px)',
                            }}
                        />

                        {/* Sidelines & Markings */}
                        <div className="absolute inset-5 md:inset-6 border border-white/40 rounded-lg pointer-events-none" />
                        <div className="absolute left-5 right-5 md:left-6 md:right-6 top-1/2 border-t border-white/30 pointer-events-none" />
                        <div className="absolute left-5 right-5 md:left-6 md:right-6 top-5 md:top-6 h-14 border-b border-white/20 bg-white/[0.03] pointer-events-none flex items-center justify-center">
                            <span className="text-[10px] font-black tracking-widest uppercase text-white/30">End Zone</span>
                        </div>

                        {/* Line of Scrimmage */}
                        <div className="absolute left-5 right-5 md:left-6 md:right-6 top-[63%] border-t-2 border-dashed border-sffl-red/70 pointer-events-none">
                            <span className="absolute right-2 -top-4 text-[9px] font-black tracking-wider text-red-200">
                                LINE OF SCRIMMAGE
                            </span>
                        </div>

                        {/* 7 Offense Starter Slots on Turf */}
                        {OFFENSE_SLOTS.map((slot) => {
                            const p = offenseStarters[slot.key];
                            const isSelected = selectedSlotForSwap?.unit === 'OFFENSE' && selectedSlotForSwap?.slotKey === slot.key;
                            const isFemale = (p?.gender || '').toUpperCase().startsWith('F');

                            return (
                                <div
                                    key={slot.key}
                                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 text-center z-10"
                                >
                                    {p ? (
                                        <div className="relative group">
                                            <button
                                                type="button"
                                                onClick={() => handleSlotClick('OFFENSE', slot.key, p)}
                                                className={`cursor-pointer transition-all duration-200 focus:outline-none ${
                                                    isSelected ? 'scale-110' : 'hover:scale-105 active:scale-95'
                                                }`}
                                            >
                                                {/* Avatar container */}
                                                <div className={`relative mx-auto w-12 h-12 md:w-14 md:h-14 rounded-full p-0.5 ${
                                                    isSelected
                                                        ? 'ring-4 ring-sffl-red shadow-xl'
                                                        : 'ring-2 ring-white shadow-lg'
                                                }`}>
                                                    {p.image ? (
                                                        <img
                                                            src={p.image}
                                                            alt={p.name}
                                                            className="w-full h-full rounded-full object-cover bg-gray-200"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full rounded-full bg-gradient-to-br from-white to-gray-200 flex items-center justify-center font-black text-sffl-navy text-xs md:text-sm">
                                                            {p.name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}

                                                    {/* Gender badge */}
                                                    <span
                                                        className={`absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full text-[9px] md:text-[10px] font-black text-white flex items-center justify-center border border-white shadow-sm ${
                                                            isFemale ? 'bg-sffl-red' : 'bg-sffl-navy'
                                                        }`}
                                                    >
                                                        {isFemale ? 'F' : 'M'}
                                                    </span>

                                                    {/* Jersey # badge */}
                                                    <span className="absolute -bottom-1 -left-1 px-1.5 py-0.2 rounded-full bg-black/80 text-white font-black text-[9px] border border-white/50">
                                                        #{p.jersey_number}
                                                    </span>
                                                </div>

                                                {/* Player Name & Role */}
                                                <div className="mt-1">
                                                    <div className="max-w-[100px] md:max-w-[115px] truncate px-1.5 py-0.5 rounded-t bg-white/95 text-gray-900 font-black text-[10px] md:text-xs leading-tight shadow-sm mx-auto">
                                                        {p.name}
                                                    </div>
                                                    <div className="max-w-[100px] md:max-w-[115px] truncate px-1 py-0.2 rounded-b bg-gray-100 text-gray-600 font-bold text-[8px] md:text-[9px] uppercase tracking-wider mx-auto">
                                                        {slot.shortRole}
                                                    </div>
                                                </div>

                                                {/* Rating Badge */}
                                                <div className="mt-0.5 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-sffl-navy text-white text-[9px] font-black border border-white/80 shadow-sm">
                                                    <span className="text-amber-400">★</span>
                                                    <span>{formatRating(p.rating)}</span>
                                                </div>
                                            </button>

                                            {/* Clear / Unassign Button */}
                                            <button
                                                type="button"
                                                onClick={(e) => handleClearSlot(e, 'OFFENSE', slot.key, p)}
                                                className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-opacity opacity-80 group-hover:opacity-100"
                                                title="Remove from slot"
                                            >
                                                <XMarkIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        /* Empty Slot Pin */
                                        <button
                                            type="button"
                                            onClick={() => handleSlotClick('OFFENSE', slot.key, null)}
                                            className="cursor-pointer group flex flex-col items-center focus:outline-none hover:scale-105 transition-transform"
                                        >
                                            <div className="w-11 h-11 md:w-13 md:h-13 rounded-full border-2 border-dashed border-white/50 group-hover:border-white bg-black/30 group-hover:bg-black/50 text-white/80 flex flex-col items-center justify-center shadow-md transition-colors">
                                                <UserPlusIcon className="w-5 h-5 text-white/70 group-hover:text-white" />
                                            </div>
                                            <span className="text-[10px] md:text-xs font-black text-white/90 drop-shadow mt-1 block max-w-[90px] truncate">
                                                {slot.shortRole}
                                            </span>
                                            <span className="text-[8px] font-bold text-amber-300 uppercase tracking-widest">
                                                + Assign
                                            </span>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── 2. DEFENSE FORMATION CARD ── */}
                <div className={`bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 md:p-6 shadow-sm ${
                    mobileUnitTab !== 'defense' ? 'hidden xl:block' : ''
                }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                        <div>
                            <h2 className="text-lg md:text-xl font-black text-sffl-navy dark:text-white flex items-center gap-2">
                                <span>🛡️ Defensive Starters</span>
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {currentDefenseScheme.tagline}
                            </p>
                        </div>

                        {/* Coverage Selector (Cover 1 to 4) */}
                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl self-start sm:self-auto">
                            {[1, 2, 3, 4].map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => setCoverage(num)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                        coverage === num
                                            ? 'bg-sffl-navy text-white shadow-sm'
                                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    Cover {num}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Turf Pitch for Defense */}
                    <div className="w-full h-[540px] md:h-[580px] rounded-2xl relative overflow-hidden shadow-inner border-2 border-[#1c4d63] bg-gradient-to-b from-[#123c52] to-[#0c2a3b] select-none">
                        {/* Turf Yard Striping */}
                        <div
                            className="absolute inset-0 opacity-20 pointer-events-none"
                            style={{
                                backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 54px, rgba(255,255,255,0.12) 55px 108px)',
                            }}
                        />

                        {/* Sidelines & Markings */}
                        <div className="absolute inset-5 md:inset-6 border border-white/40 rounded-lg pointer-events-none" />
                        <div className="absolute left-5 right-5 md:left-6 md:right-6 top-1/2 border-t border-white/30 pointer-events-none" />
                        <div className="absolute left-5 right-5 md:left-6 md:right-6 top-5 md:top-6 h-14 border-b border-white/20 bg-white/[0.03] pointer-events-none flex items-center justify-center">
                            <span className="text-[10px] font-black tracking-widest uppercase text-white/30">End Zone</span>
                        </div>

                        {/* Line of Scrimmage */}
                        <div className="absolute left-5 right-5 md:left-6 md:right-6 top-[63%] border-t-2 border-dashed border-sffl-red/70 pointer-events-none">
                            <span className="absolute right-2 -top-4 text-[9px] font-black tracking-wider text-red-200">
                                LINE OF SCRIMMAGE
                            </span>
                        </div>

                        {/* Scheme Note Banner at Bottom of Defense Turf */}
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-3 px-4 py-1 rounded-full bg-sffl-navy/90 text-white text-[10px] font-bold border border-white/20 shadow-md backdrop-blur-sm pointer-events-none max-w-[90%] truncate text-center">
                            Cover {coverage} · {currentDefenseScheme.description}
                        </div>

                        {/* 7 Defense Starter Slots on Turf */}
                        {defenseSlotsMeta.map((slot) => {
                            const p = defenseStarters[slot.key];
                            const isSelected = selectedSlotForSwap?.unit === 'DEFENSE' && selectedSlotForSwap?.slotKey === slot.key;
                            const isFemale = (p?.gender || '').toUpperCase().startsWith('F');

                            return (
                                <div
                                    key={slot.key}
                                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 text-center z-10"
                                >
                                    {p ? (
                                        <div className="relative group">
                                            <button
                                                type="button"
                                                onClick={() => handleSlotClick('DEFENSE', slot.key, p)}
                                                className={`cursor-pointer transition-all duration-200 focus:outline-none ${
                                                    isSelected ? 'scale-110' : 'hover:scale-105 active:scale-95'
                                                }`}
                                            >
                                                {/* Avatar container */}
                                                <div className={`relative mx-auto w-12 h-12 md:w-14 md:h-14 rounded-full p-0.5 ${
                                                    isSelected
                                                        ? 'ring-4 ring-sffl-red shadow-xl'
                                                        : 'ring-2 ring-white shadow-lg'
                                                }`}>
                                                    {p.image ? (
                                                        <img
                                                            src={p.image}
                                                            alt={p.name}
                                                            className="w-full h-full rounded-full object-cover bg-gray-200"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full rounded-full bg-gradient-to-br from-white to-gray-200 flex items-center justify-center font-black text-sffl-navy text-xs md:text-sm">
                                                            {p.name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}

                                                    {/* Gender badge */}
                                                    <span
                                                        className={`absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full text-[9px] md:text-[10px] font-black text-white flex items-center justify-center border border-white shadow-sm ${
                                                            isFemale ? 'bg-sffl-red' : 'bg-sffl-navy'
                                                        }`}
                                                    >
                                                        {isFemale ? 'F' : 'M'}
                                                    </span>

                                                    {/* Jersey # badge */}
                                                    <span className="absolute -bottom-1 -left-1 px-1.5 py-0.2 rounded-full bg-black/80 text-white font-black text-[9px] border border-white/50">
                                                        #{p.jersey_number}
                                                    </span>
                                                </div>

                                                {/* Player Name & Role */}
                                                <div className="mt-1">
                                                    <div className="max-w-[100px] md:max-w-[115px] truncate px-1.5 py-0.5 rounded-t bg-white/95 text-gray-900 font-black text-[10px] md:text-xs leading-tight shadow-sm mx-auto">
                                                        {p.name}
                                                    </div>
                                                    <div className="max-w-[100px] md:max-w-[115px] truncate px-1 py-0.2 rounded-b bg-gray-100 text-gray-600 font-bold text-[8px] md:text-[9px] uppercase tracking-wider mx-auto">
                                                        {slot.roleOnPitch}
                                                    </div>
                                                </div>

                                                {/* Rating Badge */}
                                                <div className="mt-0.5 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-sffl-navy text-white text-[9px] font-black border border-white/80 shadow-sm">
                                                    <span className="text-amber-400">★</span>
                                                    <span>{formatRating(p.rating)}</span>
                                                </div>
                                            </button>

                                            {/* Clear / Unassign Button */}
                                            <button
                                                type="button"
                                                onClick={(e) => handleClearSlot(e, 'DEFENSE', slot.key, p)}
                                                className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-opacity opacity-80 group-hover:opacity-100"
                                                title="Remove from slot"
                                            >
                                                <XMarkIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        /* Empty Slot Pin */
                                        <button
                                            type="button"
                                            onClick={() => handleSlotClick('DEFENSE', slot.key, null)}
                                            className="cursor-pointer group flex flex-col items-center focus:outline-none hover:scale-105 transition-transform"
                                        >
                                            <div className="w-11 h-11 md:w-13 md:h-13 rounded-full border-2 border-dashed border-white/50 group-hover:border-white bg-black/30 group-hover:bg-black/50 text-white/80 flex flex-col items-center justify-center shadow-md transition-colors">
                                                <UserPlusIcon className="w-5 h-5 text-white/70 group-hover:text-white" />
                                            </div>
                                            <span className="text-[10px] md:text-xs font-black text-white/90 drop-shadow mt-1 block max-w-[90px] truncate">
                                                {slot.roleOnPitch}
                                            </span>
                                            <span className="text-[8px] font-bold text-amber-300 uppercase tracking-widest">
                                                + Assign
                                            </span>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── 3. SUBSTITUTES BENCH SECTION (Full Width) ── */}
            <div className={`bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl border border-gray-200 dark:border-gray-700 p-5 md:p-6 shadow-sm ${
                mobileUnitTab !== 'bench' ? 'hidden xl:block' : ''
            }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-sffl-navy dark:text-white">
                                🪑 Match Substitutes (Bench Pool)
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                {substitutes.length} Players
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Bench players for this match. Click any player below to swap into a selected starter slot. (Max 25 total match squad).
                        </p>
                    </div>

                    {/* Add Substitute Button */}
                    <button
                        type="button"
                        onClick={() => {
                            setPickerTarget({
                                type: 'BENCH',
                            });
                            setPickerSearch('');
                            setPickerPositionFilter('ALL');
                        }}
                        disabled={totalSquadCount >= 25}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sffl-navy hover:bg-navy-800 text-white font-black text-xs uppercase tracking-tight shadow transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
                    >
                        <UserPlusIcon className="w-4 h-4" />
                        + Add Substitute
                    </button>
                </div>

                {substitutes.length === 0 ? (
                    <div className="text-center py-10 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                        <span className="text-3xl mb-2 block">🪑</span>
                        <h3 className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase">
                            No Substitutes Assigned Yet
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                            Add bench players from your club roster. You can carry up to 11 substitutes (25 total match squad limit).
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setPickerTarget({ type: 'BENCH' });
                                setPickerSearch('');
                                setPickerPositionFilter('ALL');
                            }}
                            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sffl-red text-white text-xs font-black uppercase hover:bg-red-700 transition-colors"
                        >
                            <UserPlusIcon className="w-4 h-4" />
                            Select Substitutes
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {substitutes.map((sub) => {
                            const isFemale = (sub.gender || '').toUpperCase().startsWith('F');
                            return (
                                <div
                                    key={sub.id}
                                    onClick={() => handleSubClick(sub)}
                                    className="group relative bg-gray-50 dark:bg-gray-700/40 hover:bg-white dark:hover:bg-gray-700 rounded-xl p-3 border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                                >
                                    {/* Remove from bench button */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveFromBench(sub.id);
                                        }}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-400 hover:bg-red-600 text-white flex items-center justify-center opacity-80 group-hover:opacity-100 transition-colors shadow-sm"
                                        title="Remove from match squad"
                                    >
                                        <XMarkIcon className="w-3.5 h-3.5" />
                                    </button>

                                    <div className="flex items-center gap-2.5">
                                        {/* Avatar */}
                                        <div className="relative w-9 h-9 rounded-full bg-gray-200 shrink-0 overflow-hidden border border-gray-300 dark:border-gray-500">
                                            {sub.image ? (
                                                <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center font-black text-xs text-sffl-navy bg-white">
                                                    {sub.name.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                                                isFemale ? 'bg-sffl-red' : 'bg-sffl-navy'
                                            }`} />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-black text-xs text-gray-900 dark:text-white truncate">
                                                {sub.name}
                                            </h4>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold truncate">
                                                #{sub.jersey_number} · {sub.position}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between text-[10px]">
                                        <span className="font-black text-sffl-navy dark:text-amber-400">
                                            ★ {formatRating(sub.rating)}
                                        </span>
                                        <span className="text-[9px] font-bold text-sffl-red group-hover:underline">
                                            Click to Swap →
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── 4. PLAYER SELECTION MODAL (For Empty Slot or Adding to Bench) ── */}
            {pickerTarget && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-5 md:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-sffl-navy dark:text-white">
                                    {pickerTarget.type === 'BENCH' ? 'Add Player to Match Bench' : `Assign: ${pickerTarget.slotLabel}`}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {pickerTarget.type === 'BENCH'
                                        ? 'Select an eligible squad player for the substitute bench pool.'
                                        : `Compulsory starter slot. Recommended position: ${pickerTarget.recommendedPosition || 'Any'}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPickerTarget(null)}
                                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search & Position Filters */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 space-y-3">
                            <div className="relative">
                                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search by player name or jersey #..."
                                    value={pickerSearch}
                                    onChange={(e) => setPickerSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-xs md:text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red"
                                    autoFocus
                                />
                            </div>

                            {/* Position Chips */}
                            <div className="flex flex-wrap gap-1.5 text-xs font-black">
                                {[
                                    { key: 'ALL', label: 'All Players' },
                                    { key: 'QB', label: 'QBs' },
                                    { key: 'WR', label: 'Receivers' },
                                    { key: 'C', label: 'Centers' },
                                    { key: 'RUSH', label: 'Rushers' },
                                    { key: 'DEF', label: 'Defenders' },
                                ].map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setPickerPositionFilter(tab.key)}
                                        className={`px-3 py-1 rounded-lg transition-all ${
                                            pickerPositionFilter === tab.key
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
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {filteredPickerPlayers.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <p className="font-bold text-sm">No players match the criteria.</p>
                                </div>
                            ) : (
                                filteredPickerPlayers.map((p) => {
                                    // Check current assignment status
                                    let assignedLabel: string | null = null;
                                    let isAssignedHere = false;

                                    if (pickerTarget.slotKey && offenseStarters[pickerTarget.slotKey]?.id === p.id) {
                                        isAssignedHere = true;
                                    }
                                    if (pickerTarget.slotKey && defenseStarters[pickerTarget.slotKey]?.id === p.id) {
                                        isAssignedHere = true;
                                    }

                                    for (const k in offenseStarters) {
                                        if (offenseStarters[k]?.id === p.id) {
                                            assignedLabel = `Starting ${k.replace('_', ' ')}`;
                                        }
                                    }
                                    for (const k in defenseStarters) {
                                        if (defenseStarters[k]?.id === p.id) {
                                            assignedLabel = `Starting ${k.replace('_', ' ')}`;
                                        }
                                    }
                                    if (substitutes.some(sub => sub.id === p.id)) {
                                        assignedLabel = 'On Bench';
                                    }

                                    const isFemale = (p.gender || '').toUpperCase().startsWith('F');

                                    return (
                                        <div
                                            key={p.id}
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                                isAssignedHere
                                                    ? 'bg-sffl-navy/5 border-sffl-navy/20 dark:bg-sffl-navy/20'
                                                    : 'bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-700 hover:border-sffl-red/40'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                {/* Avatar */}
                                                <div className="relative w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-600 shrink-0 overflow-hidden border border-gray-200 dark:border-gray-500">
                                                    {p.image ? (
                                                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center font-black text-xs text-sffl-navy dark:text-white">
                                                            {p.name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                                                        isFemale ? 'bg-sffl-red' : 'bg-sffl-navy'
                                                    }`} />
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-black text-sm text-gray-900 dark:text-white truncate">
                                                            {p.name}
                                                        </h4>
                                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                                            #{p.jersey_number}
                                                        </span>
                                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200">
                                                            {p.position}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                                        <span>★ Rating: {formatRating(p.rating)}</span>
                                                        {assignedLabel && (
                                                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                                                                · Currently: {assignedLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Button */}
                                            <div>
                                                {pickerTarget.type === 'BENCH' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddPlayerToBench(p)}
                                                        className="px-3.5 py-1.5 rounded-lg bg-sffl-navy hover:bg-navy-800 text-white font-black text-xs uppercase shadow transition-all active:scale-95"
                                                    >
                                                        + Add to Bench
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => assignPlayerToStarterSlot(pickerTarget.unit!, pickerTarget.slotKey!, p)}
                                                        className="px-3.5 py-1.5 rounded-lg bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase shadow transition-all active:scale-95"
                                                    >
                                                        Select
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setPickerTarget(null)}
                                className="px-5 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamHeadTeamSheets;
