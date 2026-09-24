import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    type Match,
    type MatchTeamSheet,
    type TeamSheetPlayer,
    getPublicMatchStats,
} from '../../services/api';
import { calculatePlayerFantasyPoints } from './MatchSummaryTab';
import { isDeletedPlayer, DELETED_TITLE } from '../common/DeletedPlayer';
import { XMarkIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';

interface MatchTeamSheetTabProps {
    match: Match;
    teamSheet?: MatchTeamSheet;
    mvpPlayerId?: string | null;
}

type UnitFilter = 'ALL' | 'OFFENSE' | 'DEFENSE';
type ViewFormat = 'pitch' | 'list';
type RatingSort = 'default' | 'high' | 'low';

const RATING_SORT_LABEL: Record<RatingSort, string> = {
    default: '↕ By Number',
    high: '▼ Highest Rated',
    low: '▲ Lowest Rated',
};

// Defensive coordinate formations for 7 players: 1 Rusher + 6 Defenders
// Top half of pitch (y: 16% - 43%)
interface DefensiveScheme {
    name: string;
    description: string;
    points: Array<{ x: number; y: number; role: string }>;
}

const DEFENSIVE_SCHEMES: Record<number, DefensiveScheme> = {
    1: {
        name: 'Cover 1',
        description: 'Aggressive man coverage with 1 deep safety',
        points: [
            { x: 50, y: 42, role: 'Rusher' },
            { x: 14, y: 33, role: 'Underneath Defender' },
            { x: 32, y: 31, role: 'Underneath Defender' },
            { x: 50, y: 33, role: 'Underneath Defender' },
            { x: 68, y: 31, role: 'Underneath Defender' },
            { x: 86, y: 33, role: 'Underneath Defender' },
            { x: 50, y: 17, role: 'Deep Safety' },
        ],
    },
    2: {
        name: 'Cover 2',
        description: 'Balanced coverage with 4 underneath defenders and 2 deep safeties',
        points: [
            { x: 50, y: 42, role: 'Rusher' },
            { x: 16, y: 33, role: 'Underneath Defender' },
            { x: 38, y: 31, role: 'Underneath Defender' },
            { x: 62, y: 31, role: 'Underneath Defender' },
            { x: 84, y: 33, role: 'Underneath Defender' },
            { x: 33, y: 17, role: 'Deep Safety' },
            { x: 67, y: 17, role: 'Deep Safety' },
        ],
    },
    3: {
        name: 'Cover 3',
        description: '3 deep zones with 3 underneath zone defenders',
        points: [
            { x: 50, y: 42, role: 'Rusher' },
            { x: 22, y: 33, role: 'Underneath Defender' },
            { x: 50, y: 31, role: 'Underneath Defender' },
            { x: 78, y: 33, role: 'Underneath Defender' },
            { x: 20, y: 17, role: 'Deep Zone Defender' },
            { x: 50, y: 16, role: 'Deep Safety' },
            { x: 80, y: 17, role: 'Deep Zone Defender' },
        ],
    },
    4: {
        name: 'Cover 4',
        description: 'Quarters defense with 4 deep safeties and 2 underneath defenders',
        points: [
            { x: 50, y: 42, role: 'Rusher' },
            { x: 35, y: 33, role: 'Underneath Defender' },
            { x: 65, y: 33, role: 'Underneath Defender' },
            { x: 15, y: 18, role: 'Quarter Defender' },
            { x: 38, y: 16, role: 'Quarter Defender' },
            { x: 62, y: 16, role: 'Quarter Defender' },
            { x: 85, y: 18, role: 'Quarter Defender' },
        ],
    },
};

interface OffensiveSlotDef {
    key: string;
    label: string;
    shortRole: string;
    x: number;
    y: number;
    aliases: string[];
    isFemale?: boolean;
    isMale?: boolean;
    positionMatcher?: (pos: string, gender: string) => boolean;
}

// Canonical offensive 7-player coordinate layout
// Bottom half of pitch (y: 56% - 79%)
const OFFENSIVE_SLOTS: OffensiveSlotDef[] = [
    { key: 'CENTER', label: 'Center (Snapper)', shortRole: 'Center', x: 50, y: 56, aliases: ['CENTER', 'C', 'OFF_C'], positionMatcher: (pos) => pos === 'center' },
    { key: 'WR_1', label: 'Receiver 1', shortRole: 'Receiver', x: 12, y: 64, aliases: ['WR_1', 'WR1', 'OFF_WR1'], positionMatcher: (pos) => pos === 'receiver' || pos === 'allrounder' },
    { key: 'WR_2', label: 'Receiver 2', shortRole: 'Receiver', x: 31, y: 66, aliases: ['WR_2', 'WR2', 'OFF_WR2'], positionMatcher: (pos) => pos === 'receiver' || pos === 'allrounder' },
    { key: 'WR_3', label: 'Receiver 3', shortRole: 'Receiver', x: 69, y: 66, aliases: ['WR_3', 'WR3', 'OFF_WR3'], positionMatcher: (pos) => pos === 'receiver' || pos === 'allrounder' },
    { key: 'WR_4', label: 'Receiver 4', shortRole: 'Receiver', x: 88, y: 64, aliases: ['WR_4', 'WR4', 'OFF_WR4'], positionMatcher: (pos) => pos === 'receiver' || pos === 'allrounder' },
    { key: 'MALE_QB', label: 'Male QB', shortRole: 'Male QB', x: 38, y: 79, aliases: ['MALE_QB', 'QB_M', 'OFF_QB_M', 'OFF_QB', 'QB'], isMale: true, positionMatcher: (pos, g) => pos === 'qb' && !g.startsWith('f') },
    { key: 'FEMALE_QB', label: 'Female QB / Rec', shortRole: 'Female QB', x: 62, y: 79, aliases: ['FEMALE_QB', 'QB_F', 'OFF_QB_F', 'OFF_FQB', 'FQB'], isFemale: true, positionMatcher: (pos, g) => g.startsWith('f') && (pos === 'qb' || pos === 'receiver') },
];

export interface PitchStarterNode {
    player?: TeamSheetPlayer;
    role: string;
    unit: 'OFFENSE' | 'DEFENSE';
    x: number;
    y: number;
    slotKey: string;
}

export const MatchTeamSheetTab = ({ match, teamSheet, mvpPlayerId }: MatchTeamSheetTabProps) => {
    const homeTeam = match.home_team;
    const awayTeam = match.away_team;

    // View state
    const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
    const [unitFilter, setUnitFilter] = useState<UnitFilter>('ALL');
    const [viewFormat, setViewFormat] = useState<ViewFormat>('pitch');
    const [ratingSort, setRatingSort] = useState<RatingSort>('default');
    const [modalPlayer, setModalPlayer] = useState<{
        player: TeamSheetPlayer;
        isStarter: boolean;
        assignedRole: string;
    } | null>(null);

    // Fetch stats for fantasy points and ratings
    const { data: statsData } = useQuery({
        queryKey: ['publicMatchStatsCompare', match.id],
        queryFn: () => getPublicMatchStats(match.id),
        enabled: !!match.id,
    });

    const playerStatsMap = useMemo(() => {
        const stats = statsData?.derived || statsData?.current || [];
        const map = new Map<string, any>();
        stats.forEach(s => map.set(s.player_id, s));
        return map;
    }, [statsData]);

    const activeTeam = selectedTeam === 'home' ? homeTeam : awayTeam;
    const activeSheet = useMemo(() => {
        const list = selectedTeam === 'home' ? teamSheet?.home_team : teamSheet?.away_team;
        return list || [];
    }, [teamSheet, selectedTeam]);

    const activeCoverage = useMemo(() => {
        const cov = selectedTeam === 'home' ? teamSheet?.home_coverage : teamSheet?.away_coverage;
        return cov && DEFENSIVE_SCHEMES[cov] ? cov : 2;
    }, [teamSheet, selectedTeam]);

    // Check if team sheet has confirmed starters
    const hasConfirmedStarters = useMemo(() => {
        return activeSheet.some(p => p.is_starter);
    }, [activeSheet]);

    // Partition players into Starters (Offense/Defense) and Substitutes
    const { offensiveStarters, defensiveStarters, substitutes } = useMemo(() => {
        if (hasConfirmedStarters) {
            const off = activeSheet.filter(p => p.is_starter && p.starter_unit === 'OFFENSE');
            const def = activeSheet.filter(p => p.is_starter && p.starter_unit === 'DEFENSE');
            const subs = activeSheet.filter(p => !p.is_starter);
            return { offensiveStarters: off, defensiveStarters: def, substitutes: subs };
        }

        // Intelligently project 7 Offense and 7 Defense from available roster
        const usedIds = new Set<string>();
        const isFem = (p: TeamSheetPlayer) => (p.gender || '').toUpperCase().startsWith('F');
        const posOf = (p: TeamSheetPlayer) => (p.position || '').toLowerCase();

        // 1. Offense selection (7 players: 2 QBs [1 M, 1 F], 1 Center, 4 Receivers)
        const off: TeamSheetPlayer[] = [];

        // Male QB
        const maleQB = activeSheet.find(p => !usedIds.has(p.player_id) && posOf(p) === 'qb' && !isFem(p)) ||
            activeSheet.find(p => !usedIds.has(p.player_id) && posOf(p) === 'qb');
        if (maleQB) {
            off.push({ ...maleQB, position_slot: 'QB_M' });
            usedIds.add(maleQB.player_id);
        }

        // Female QB / Receiver
        const femaleQB = activeSheet.find(p => !usedIds.has(p.player_id) && isFem(p) && (posOf(p) === 'qb' || posOf(p) === 'receiver')) ||
            activeSheet.find(p => !usedIds.has(p.player_id) && isFem(p));
        if (femaleQB) {
            off.push({ ...femaleQB, position_slot: 'QB_F' });
            usedIds.add(femaleQB.player_id);
        }

        // Center
        const center = activeSheet.find(p => !usedIds.has(p.player_id) && posOf(p) === 'center');
        if (center) {
            off.push({ ...center, position_slot: 'C' });
            usedIds.add(center.player_id);
        }

        // 4 Receivers
        activeSheet
            .filter(p => !usedIds.has(p.player_id) && (posOf(p) === 'receiver' || posOf(p) === 'allrounder'))
            .slice(0, 4)
            .forEach((p, idx) => {
                off.push({ ...p, position_slot: `WR${idx + 1}` });
                usedIds.add(p.player_id);
            });

        // Fill remaining off slots up to 7
        if (off.length < 7) {
            activeSheet
                .filter(p => !usedIds.has(p.player_id))
                .slice(0, 7 - off.length)
                .forEach(p => {
                    off.push(p);
                    usedIds.add(p.player_id);
                });
        }

        // 2. Defense selection (7 players: 1 Rusher, 6 Defenders)
        const def: TeamSheetPlayer[] = [];

        // Rusher
        const rusher = activeSheet.find(p => !usedIds.has(p.player_id) && posOf(p) === 'rusher');
        if (rusher) {
            def.push({ ...rusher, position_slot: 'RUSH' });
            usedIds.add(rusher.player_id);
        }

        // 6 Defenders
        activeSheet
            .filter(p => !usedIds.has(p.player_id) && (posOf(p) === 'defender' || posOf(p) === 'allrounder'))
            .slice(0, 6)
            .forEach((p, idx) => {
                def.push({ ...p, position_slot: `DEF${idx + 1}` });
                usedIds.add(p.player_id);
            });

        // Fill remaining def slots up to 7
        if (def.length < 7) {
            activeSheet
                .filter(p => !usedIds.has(p.player_id))
                .slice(0, 7 - def.length)
                .forEach(p => {
                    def.push(p);
                    usedIds.add(p.player_id);
                });
        }

        // 3. Substitutes (all remaining squad players)
        const subs = activeSheet.filter(p => !usedIds.has(p.player_id));

        return { offensiveStarters: off, defensiveStarters: def, substitutes: subs };
    }, [activeSheet, hasConfirmedStarters]);

    // Unified 14-player field starters: 7 Defense (top) + 7 Offense (bottom)
    const fieldStarters = useMemo(() => {
        // 1. Offense mapping
        const assignedOffIds = new Set<string>();
        const offenseNodes: PitchStarterNode[] = OFFENSIVE_SLOTS.map((slotDef) => {
            let player = offensiveStarters.find(p =>
                !assignedOffIds.has(p.player_id) &&
                p.position_slot &&
                slotDef.aliases.some(alias => alias.toUpperCase() === p.position_slot!.toUpperCase())
            );

            if (!player && slotDef.positionMatcher) {
                player = offensiveStarters.find(p => {
                    if (assignedOffIds.has(p.player_id)) return false;
                    const pos = (p.position || '').toLowerCase();
                    const g = (p.gender || '').toLowerCase();
                    return slotDef.positionMatcher!(pos, g);
                });
            }

            if (!player) {
                player = offensiveStarters.find(p => !assignedOffIds.has(p.player_id));
            }

            if (player) {
                assignedOffIds.add(player.player_id);
            }

            return {
                player,
                role: slotDef.label,
                unit: 'OFFENSE' as const,
                x: slotDef.x,
                y: slotDef.y,
                slotKey: slotDef.key,
            };
        });

        // 2. Defense mapping
        const scheme = DEFENSIVE_SCHEMES[activeCoverage] || DEFENSIVE_SCHEMES[2];
        const assignedDefIds = new Set<string>();
        const defenseNodes: PitchStarterNode[] = scheme.points.map((pt, idx) => {
            const aliases = idx === 0 ? ['RUSHER', 'RUSH', 'DEF_R'] : [`DEF_${idx}`, `DEF${idx}`];

            let player = defensiveStarters.find(p =>
                !assignedDefIds.has(p.player_id) &&
                p.position_slot &&
                aliases.some(a => a.toUpperCase() === p.position_slot!.toUpperCase())
            );

            if (!player && idx === 0) {
                player = defensiveStarters.find(p => !assignedDefIds.has(p.player_id) && (p.position || '').toLowerCase() === 'rusher');
            }

            if (!player) {
                player = defensiveStarters.find(p => !assignedDefIds.has(p.player_id));
            }

            if (player) {
                assignedDefIds.add(player.player_id);
            }

            return {
                player,
                role: pt.role,
                unit: 'DEFENSE' as const,
                x: pt.x,
                y: pt.y,
                slotKey: idx === 0 ? 'RUSHER' : `DEF_${idx}`,
            };
        });

        return [...defenseNodes, ...offenseNodes];
    }, [offensiveStarters, defensiveStarters, activeCoverage]);

    // Filter substitutes based on unit filter
    const filteredSubstitutes = useMemo(() => {
        if (unitFilter === 'ALL') return substitutes;
        return substitutes.filter(p => {
            const pos = (p.position || '').toLowerCase();
            if (pos === 'allrounder' || pos === 'all-rounder') return true;
            if (unitFilter === 'OFFENSE') {
                return pos === 'qb' || pos === 'receiver' || pos === 'center' || p.starter_unit === 'OFFENSE';
            }
            if (unitFilter === 'DEFENSE') {
                return pos === 'rusher' || pos === 'defender' || p.starter_unit === 'DEFENSE';
            }
            return true;
        });
    }, [substitutes, unitFilter]);

    // Formatted rating helper: "-" when unrated or no stats recorded
    const getRatingDisplay = (p?: TeamSheetPlayer) => {
        if (!p) return '-';
        if (p.rating_status === 'UNRATED' || p.rating == null) return '-';
        return p.rating.toFixed(1);
    };

    // Helper to preserve comp, date, and match context for player detail page
    const getPlayerProfileLink = (playerId: string) => {
        const params = new URLSearchParams();
        const compId = match.competition?.id;
        if (compId) params.set('comp', compId);
        if (match.date) params.set('date', match.date.split('T')[0]);
        params.set('match', match.id);
        return `/players/${playerId}?${params.toString()}`;
    };

    // Sorted roster list for List View
    const sortedRoster = useMemo(() => {
        const list = [...activeSheet];
        if (ratingSort === 'high') {
            return list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
        }
        if (ratingSort === 'low') {
            return list.sort((a, b) => (a.rating ?? 99) - (b.rating ?? 99));
        }
        return list.sort((a, b) => (a.jersey_number || 999) - (b.jersey_number || 999));
    }, [activeSheet, ratingSort]);

    // Filtered roster for List View based on unitFilter
    const displayedList = useMemo(() => {
        if (unitFilter === 'ALL') return sortedRoster;
        return sortedRoster.filter(p => {
            const isOff = offensiveStarters.some(s => s.player_id === p.player_id);
            const isDef = defensiveStarters.some(s => s.player_id === p.player_id);
            const pos = (p.position || '').toLowerCase();
            const isAR = pos === 'allrounder' || pos === 'all-rounder';
            if (unitFilter === 'OFFENSE') {
                return isOff || p.starter_unit === 'OFFENSE' || (!isDef && (pos === 'qb' || pos === 'receiver' || pos === 'center' || isAR));
            }
            if (unitFilter === 'DEFENSE') {
                return isDef || p.starter_unit === 'DEFENSE' || (!isOff && (pos === 'rusher' || pos === 'defender' || isAR));
            }
            return true;
        });
    }, [sortedRoster, unitFilter, offensiveStarters, defensiveStarters]);

    return (
        <div className="space-y-6">

            {/* ── Sub-Header & Controls Bar ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-5">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">

                    {/* Team Selector Pills */}
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700/60 p-1.5 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setSelectedTeam('home')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-black text-xs md:text-sm uppercase tracking-tight transition-all ${
                                selectedTeam === 'home'
                                    ? 'bg-sffl-navy text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            {homeTeam?.logo ? (
                                <img src={homeTeam.logo} alt={homeTeam.name} className="w-4 h-4 object-contain" />
                            ) : (
                                <span className="w-4 h-4 rounded-full bg-sffl-navy text-white text-[9px] flex items-center justify-center font-black">H</span>
                            )}
                            <span className="truncate max-w-[130px] md:max-w-[180px]">{homeTeam?.name || 'Home'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelectedTeam('away')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-black text-xs md:text-sm uppercase tracking-tight transition-all ${
                                selectedTeam === 'away'
                                    ? 'bg-sffl-red text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            {awayTeam?.logo ? (
                                <img src={awayTeam.logo} alt={awayTeam.name} className="w-4 h-4 object-contain" />
                            ) : (
                                <span className="w-4 h-4 rounded-full bg-sffl-red text-white text-[9px] flex items-center justify-center font-black">A</span>
                            )}
                            <span className="truncate max-w-[130px] md:max-w-[180px]">{awayTeam?.name || 'Away'}</span>
                        </button>
                    </div>

                    {/* Status Pill & View Controls */}
                    <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
                        <span
                            className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-wider border ${
                                hasConfirmedStarters
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                            }`}
                        >
                            {hasConfirmedStarters
                                ? '✓ Confirmed Lineup'
                                : match.status === 'FINISHED'
                                ? '📋 Historical Squad'
                                : '⚡ Projected Lineup'}
                        </span>

                        {/* View Mode Toggle: Pitch vs Detailed List */}
                        <div className="flex items-center bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setViewFormat('pitch')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    viewFormat === 'pitch'
                                        ? 'bg-white dark:bg-gray-800 text-sffl-navy dark:text-white shadow-sm font-black'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                                }`}
                            >
                                🏟️ Pitch
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewFormat('list')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    viewFormat === 'list'
                                        ? 'bg-white dark:bg-gray-800 text-sffl-navy dark:text-white shadow-sm font-black'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                                }`}
                            >
                                📋 Detailed List
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub-bar: Unit Filter Pills (Full Lineup / Attack / Defense) & Tactical Details */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setUnitFilter('ALL')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all cursor-pointer ${
                                unitFilter === 'ALL'
                                    ? 'bg-sffl-navy text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <span>Full Lineup (14)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setUnitFilter('OFFENSE')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all cursor-pointer ${
                                unitFilter === 'OFFENSE'
                                    ? 'bg-sffl-red text-white shadow-sm ring-1 ring-white/30'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-sffl-red" />
                            <span>Attack (7)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setUnitFilter('DEFENSE')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all cursor-pointer ${
                                unitFilter === 'DEFENSE'
                                    ? 'bg-[#2563eb] text-white shadow-sm ring-1 ring-white/30'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-[#7fbbfa]" />
                            <span>Defense (7)</span>
                        </button>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400 font-bold flex flex-wrap items-center gap-2">
                        <span>🛡️ Scheme: {DEFENSIVE_SCHEMES[activeCoverage]?.name}</span>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <span>🏈 Offense: 2 QBs · 1 C · 4 WRs</span>
                    </div>
                </div>
            </div>

            {/* Context Note when Projected */}
            {!hasConfirmedStarters && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
                    <span className="text-base flex-shrink-0">💡</span>
                    <span>
                        {match.status === 'FINISHED' ? (
                            <>
                                <strong>Historical Squad:</strong> No official starting lineup was recorded for this completed fixture. Displaying participating players from the squad roster.
                            </>
                        ) : (
                            <>
                                <strong>Projected Lineup:</strong> Positions are filled using top eligible players until official manager team sheets are announced. Unrecorded ratings are shown as <code className="font-bold">-</code>.
                            </>
                        )}
                    </span>
                </div>
            )}

            {/* ── VIEW 1: Interactive Pitch Formation ── */}
            {viewFormat === 'pitch' && (
                <div className="space-y-6">
                    {/* The Unified Turf Pitch (14 Starters: Defense Top, Offense Bottom) */}
                    <div
                        className="w-full h-[680px] sm:h-[760px] md:h-[840px] rounded-2xl relative overflow-hidden shadow-xl border-2 border-[#1c4d63] bg-gradient-to-b from-[#123c52] to-[#0c2a3b] select-none"
                        style={{
                            backgroundImage:
                                'repeating-linear-gradient(to bottom, transparent 0, transparent calc(14.28% - 2px), rgba(255,255,255,0.08) calc(14.28% - 1px), rgba(255,255,255,0.08) 14.28%), repeating-linear-gradient(to bottom, #11384e 0, #11384e 14.28%, #0d2f42 14.28%, #0d2f42 28.56%)',
                            boxShadow: 'inset 0 0 80px rgba(0,0,0,0.5)',
                        }}
                    >
                        {/* Sideline Borders */}
                        <div className="absolute top-[10%] bottom-[10%] left-[3%] right-[3%] border border-white/30 rounded-lg pointer-events-none" />

                        {/* Top End Zone: Defense */}
                        <div className="absolute inset-x-0 top-0 h-[10%] flex items-center justify-center bg-black/25 border-b border-white/20 text-white/30 font-black italic tracking-[0.24em] text-sm sm:text-lg md:text-xl pointer-events-none select-none">
                            DEFENSE · {DEFENSIVE_SCHEMES[activeCoverage]?.name.toUpperCase()}
                        </div>

                        {/* Bottom End Zone: Offense */}
                        <div className="absolute inset-x-0 bottom-0 h-[10%] flex items-center justify-center bg-black/25 border-t border-white/20 text-white/30 font-black italic tracking-[0.24em] text-sm sm:text-lg md:text-xl pointer-events-none select-none">
                            OFFENSE · {activeTeam?.name?.toUpperCase() || 'ATTACK'}
                        </div>

                        {/* Unit Half Markers */}
                        <span className="absolute left-[4.5%] top-[11.5%] text-[9px] sm:text-[10px] md:text-xs font-black tracking-widest text-white/40 uppercase pointer-events-none">
                            🛡️ DEFENSIVE HALF
                        </span>
                        <span className="absolute left-[4.5%] top-[51%] text-[9px] sm:text-[10px] md:text-xs font-black tracking-widest text-white/40 uppercase pointer-events-none">
                            🏈 OFFENSIVE HALF
                        </span>

                        {/* Line of Scrimmage (LOS) */}
                        <div className="absolute left-[3%] right-[3%] top-[49.5%] border-t-2 border-dashed border-sffl-red/70 pointer-events-none" />
                        <span className="absolute top-[49.5%] right-[2.5%] -translate-y-1/2 bg-sffl-red text-white rounded px-2 py-0.5 text-[8px] sm:text-[9px] md:text-[10px] font-black tracking-wider uppercase pointer-events-none shadow-md z-[5]">
                            LINE OF SCRIMMAGE
                        </span>

                        {/* 14 Starters on the field */}
                        {fieldStarters.map((item, idx) => {
                            const p = item.player;
                            const isDimmed = unitFilter !== 'ALL' && item.unit !== unitFilter;

                            if (!p) {
                                return (
                                    <div
                                        key={`empty-${item.unit}-${item.slotKey}-${idx}`}
                                        style={{ left: `${item.x}%`, top: `${item.y}%` }}
                                        className={`absolute -translate-x-1/2 -translate-y-1/2 text-center transition-all duration-300 ${
                                            isDimmed ? 'opacity-20 pointer-events-none filter blur-[1.5px] grayscale scale-90 z-0' : 'opacity-80 scale-100 z-10'
                                        }`}
                                    >
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center bg-black/20 text-white/50 text-xs font-bold mx-auto">
                                            ?
                                        </div>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/70 block mt-1">{item.role}</span>
                                    </div>
                                );
                            }

                            const isMvp = p.player_id === mvpPlayerId;
                            const ratingText = getRatingDisplay(p);
                            const isFemale = (p.gender || '').toUpperCase().startsWith('F');

                            return (
                                <button
                                    key={`${item.unit}-${item.slotKey}-${p.player_id}`}
                                    type="button"
                                    onClick={() => setModalPlayer({ player: p, isStarter: true, assignedRole: item.role })}
                                    style={{ left: `${item.x}%`, top: `${item.y}%` }}
                                    className={`absolute -translate-x-1/2 -translate-y-1/2 text-center transition-all duration-300 group focus:outline-none ${
                                        isDimmed
                                            ? 'opacity-20 pointer-events-none filter blur-[1.5px] grayscale scale-90 z-0'
                                            : 'opacity-100 scale-100 z-10 hover:scale-105 active:scale-95 cursor-pointer'
                                    }`}
                                >
                                    {/* Avatar circle */}
                                    <div className="relative mx-auto w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14">
                                        {p.image ? (
                                            <img
                                                src={p.image}
                                                alt={p.name}
                                                className="w-full h-full rounded-full object-cover border-2 border-white shadow-lg bg-gray-200"
                                            />
                                        ) : (
                                            <div className="w-full h-full rounded-full bg-gradient-to-br from-white to-gray-200 border-2 border-white shadow-lg flex items-center justify-center font-black text-sffl-navy text-xs md:text-sm">
                                                {p.name.slice(0, 2).toUpperCase()}
                                            </div>
                                        )}

                                        {/* Gender Badge */}
                                        <span
                                            className={`absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full text-[8px] md:text-[9px] font-black text-white flex items-center justify-center border border-white shadow-sm ${
                                                isFemale ? 'bg-sffl-red' : 'bg-sffl-navy'
                                            }`}
                                        >
                                            {isFemale ? 'F' : 'M'}
                                        </span>

                                        {/* MVP Star */}
                                        {isMvp && (
                                            <span className="absolute -top-2 -left-2 text-sm md:text-base drop-shadow-md animate-bounce">
                                                ⭐
                                            </span>
                                        )}
                                    </div>

                                    {/* Player Name Tag */}
                                    <div className="mt-1 bg-white/95 dark:bg-gray-900/95 px-1.5 sm:px-2 py-0.5 rounded-t-md shadow-sm max-w-[80px] sm:max-w-[100px] md:max-w-[120px] mx-auto truncate text-[9px] sm:text-[10px] md:text-xs font-black text-sffl-navy dark:text-white group-hover:text-sffl-red transition-colors">
                                        {p.name}
                                    </div>

                                    {/* Role Tag */}
                                    <div className="bg-white/95 dark:bg-gray-900/95 px-1 sm:px-1.5 py-0.5 rounded-b-md shadow-sm max-w-[80px] sm:max-w-[100px] md:max-w-[120px] mx-auto truncate text-[8px] sm:text-[9px] font-semibold text-gray-500 dark:text-gray-400">
                                        #{p.jersey_number} · {item.role}
                                    </div>

                                    {/* Rating Badge */}
                                    <div className="inline-flex items-center gap-1 mt-0.5 sm:mt-1 bg-sffl-navy text-white px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] md:text-[10px] font-black border border-white/80 shadow-md">
                                        <span className="text-amber-400">★</span>
                                        <span>{ratingText}</span>
                                    </div>
                                </button>
                            );
                        })}

                        {/* Formation Badge on Pitch bottom */}
                        <div className="absolute left-1/2 bottom-3 -translate-x-1/2 px-4 py-1.5 rounded-full bg-sffl-navy/90 border border-white/20 text-white font-bold text-[9px] sm:text-xs shadow-lg backdrop-blur-sm whitespace-nowrap z-[6]">
                            {unitFilter === 'ALL'
                                ? '🏟️ Showtime 7v7 Lineup · 14 Starters (7 Defense / 7 Attack)'
                                : unitFilter === 'OFFENSE'
                                ? '🏈 Showtime Attack · 7 Starters (2 QBs · 1 Center · 4 Receivers)'
                                : `🛡️ Showtime Defense · ${DEFENSIVE_SCHEMES[activeCoverage]?.name} (1 Rusher · 6 Defenders)`}
                        </div>
                    </div>

                    {/* Substitutes Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-base">🔄</span>
                                <h3 className="text-sm font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                                    Substitutes
                                </h3>
                                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold px-2 py-0.5 rounded-full tabular-nums">
                                    {filteredSubstitutes.length}
                                </span>
                            </div>
                            <span className="text-[11px] text-gray-400 font-semibold">
                                {unitFilter === 'ALL'
                                    ? 'Club bench players'
                                    : unitFilter === 'OFFENSE'
                                    ? 'Attack bench substitutes'
                                    : 'Defensive bench substitutes'}
                            </span>
                        </div>

                        {filteredSubstitutes.length === 0 ? (
                            <p className="text-center py-6 text-xs text-gray-400 italic">No substitutes listed for this selection.</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {filteredSubstitutes.map(sub => {
                                    const ratingText = getRatingDisplay(sub);
                                    const isFemale = (sub.gender || '').toUpperCase().startsWith('F');
                                    return (
                                        <button
                                            key={sub.player_id}
                                            type="button"
                                            onClick={() => setModalPlayer({ player: sub, isStarter: false, assignedRole: sub.position || 'Sub' })}
                                            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-sffl-red/40 dark:hover:border-sffl-red/40 hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-all text-left group"
                                        >
                                            <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700">
                                                {sub.image ? (
                                                    <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center font-black text-xs text-sffl-navy dark:text-gray-300">
                                                        #{sub.jersey_number}
                                                    </div>
                                                )}
                                                <span
                                                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full text-[7px] font-black text-white flex items-center justify-center ${
                                                        isFemale ? 'bg-sffl-red' : 'bg-sffl-navy'
                                                    }`}
                                                >
                                                    {isFemale ? 'F' : 'M'}
                                                </span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-xs text-sffl-navy dark:text-white truncate group-hover:text-sffl-red transition-colors">
                                                    {sub.name}
                                                </div>
                                                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                    #{sub.jersey_number} · {sub.position}
                                                </div>
                                            </div>

                                            <div className="flex-shrink-0 text-right">
                                                <span className="text-[11px] font-black text-sffl-navy dark:text-gray-200 tabular-nums">
                                                    ★ {ratingText}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── VIEW 2: Detailed Sorted Roster Table (Previous Tab Capability) ── */}
            {viewFormat === 'list' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h3 className="text-base font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                                {activeTeam?.name} Team Sheet Roster
                            </h3>
                            <span className="text-xs bg-sffl-navy/10 dark:bg-white/10 text-sffl-navy dark:text-gray-300 font-bold px-2 py-0.5 rounded-full">
                                {displayedList.length} Players
                            </span>
                        </div>

                        {/* Sort Dropdown */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sort</span>
                            <button
                                type="button"
                                onClick={() => setRatingSort(s => (s === 'default' ? 'high' : s === 'high' ? 'low' : 'default'))}
                                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 text-sffl-navy dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors tabular-nums"
                            >
                                <ChevronUpDownIcon className="w-3.5 h-3.5" />
                                {RATING_SORT_LABEL[ratingSort]}
                            </button>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                        {displayedList.map(player => {
                            const isMvp = player.player_id === mvpPlayerId;
                            const ratingVal = getRatingDisplay(player);
                            const isStarter = player.is_starter || offensiveStarters.some(p => p.player_id === player.player_id) || defensiveStarters.some(p => p.player_id === player.player_id);

                            return (
                                <Link
                                    key={player.player_id}
                                    to={getPlayerProfileLink(player.player_id)}
                                    className="flex items-center justify-between p-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {player.image ? (
                                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700">
                                                <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-sffl-navy/10 dark:bg-white/10 flex items-center justify-center text-xs font-black text-sffl-navy dark:text-gray-300 flex-shrink-0">
                                                #{player.jersey_number}
                                            </div>
                                        )}

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    title={isDeletedPlayer(player) ? DELETED_TITLE : undefined}
                                                    className={`font-black text-sm text-sffl-navy dark:text-white truncate group-hover:text-sffl-red transition-colors ${
                                                        isDeletedPlayer(player) ? 'line-through text-gray-400' : ''
                                                    }`}
                                                >
                                                    {player.name}
                                                </span>
                                                {isMvp && <span title="Match MVP">⭐</span>}
                                                <span
                                                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                        isStarter
                                                            ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                                    }`}
                                                >
                                                    {isStarter ? 'Starter' : 'Sub'}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold block truncate">
                                                #{player.jersey_number} · {player.position}
                                                {player.gender ? ` · ${player.gender}` : ''}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                                        <span className="text-sm font-black tabular-nums text-sffl-navy dark:text-white">
                                            {ratingVal === '-' ? '-' : `★ ${ratingVal}`}
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Player Summary Lightbox Modal ── */}
            {modalPlayer && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setModalPlayer(null)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                            <span className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                Player Card
                            </span>
                            <button
                                type="button"
                                onClick={() => setModalPlayer(null)}
                                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Profile Header */}
                        <div className="flex items-center gap-3.5">
                            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-sffl-navy dark:border-white shadow-md bg-gray-100 dark:bg-gray-700">
                                {modalPlayer.player.image ? (
                                    <img src={modalPlayer.player.image} alt={modalPlayer.player.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center font-black text-xl text-sffl-navy dark:text-white">
                                        #{modalPlayer.player.jersey_number}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-base font-black text-sffl-navy dark:text-white truncate">
                                    {modalPlayer.player.name}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold truncate">
                                    {activeTeam?.name} · #{modalPlayer.player.jersey_number}
                                </p>
                                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    {modalPlayer.assignedRole}
                                </span>
                            </div>
                        </div>

                        {/* Stats Metrics Strip */}
                        {(() => {
                            const pStat = playerStatsMap.get(modalPlayer.player.player_id);
                            const fp = pStat ? calculatePlayerFantasyPoints(pStat) : 0;
                            const rating = getRatingDisplay(modalPlayer.player);

                            return (
                                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-600">
                                        <span className="text-[10px] font-black uppercase text-gray-400 block tracking-tight">Rating</span>
                                        <strong className="text-sm font-black text-sffl-navy dark:text-white">
                                            {rating === '-' ? '-' : `★ ${rating}`}
                                        </strong>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-600">
                                        <span className="text-[10px] font-black uppercase text-gray-400 block tracking-tight">Fantasy</span>
                                        <strong className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">
                                            {fp.toFixed(1)} FP
                                        </strong>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-600">
                                        <span className="text-[10px] font-black uppercase text-gray-400 block tracking-tight">Status</span>
                                        <strong className="text-xs font-black text-sffl-navy dark:text-white">
                                            {modalPlayer.isStarter ? 'Starter' : 'Substitute'}
                                        </strong>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* View Full Profile Action */}
                        <div className="pt-2">
                            <Link
                                to={getPlayerProfileLink(modalPlayer.player.player_id)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-xs uppercase tracking-tight shadow-md transition-all"
                            >
                                View Player Profile →
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
