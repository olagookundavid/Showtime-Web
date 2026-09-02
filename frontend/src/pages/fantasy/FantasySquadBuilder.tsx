import { useState, useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
    UsersIcon, 
    CheckCircleIcon, 
    ExclamationCircleIcon, 
    ChevronRightIcon, 
    XMarkIcon, 
    MagnifyingGlassIcon, 
    BookmarkSquareIcon, 
    SparklesIcon 
} from '@heroicons/react/24/outline';
import { 
    fantasyApi, 
    type FantasySlot, 
    type FantasyPlayerListItem 
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from '../../components/ui/Loader';

interface SlotDefinition {
    slot: FantasySlot;
    label: string;
    unit: 'OFFENSE' | 'DEFENSE';
    allowedPosition: string;
    requiredGender?: 'M' | 'F';
}

const SLOT_DEFINITIONS: SlotDefinition[] = [
    // Offense (7)
    { slot: 'QB_M', label: 'Male Starting QB', unit: 'OFFENSE', allowedPosition: 'QB', requiredGender: 'M' },
    { slot: 'QB_F', label: 'Female Starting QB', unit: 'OFFENSE', allowedPosition: 'QB', requiredGender: 'F' },
    { slot: 'REC_1', label: 'Wide Receiver 1', unit: 'OFFENSE', allowedPosition: 'Receiver' },
    { slot: 'REC_2', label: 'Wide Receiver 2', unit: 'OFFENSE', allowedPosition: 'Receiver' },
    { slot: 'REC_3', label: 'Wide Receiver 3', unit: 'OFFENSE', allowedPosition: 'Receiver' },
    { slot: 'REC_4', label: 'Wide Receiver 4', unit: 'OFFENSE', allowedPosition: 'Receiver' },
    { slot: 'REC_5', label: 'Wide Receiver 5', unit: 'OFFENSE', allowedPosition: 'Receiver' },
    // Defense (7)
    { slot: 'RUSHER', label: 'Pass Rusher', unit: 'DEFENSE', allowedPosition: 'Rusher' },
    { slot: 'DEF_1', label: 'Defender 1', unit: 'DEFENSE', allowedPosition: 'Defender' },
    { slot: 'DEF_2', label: 'Defender 2', unit: 'DEFENSE', allowedPosition: 'Defender' },
    { slot: 'DEF_3', label: 'Defender 3', unit: 'DEFENSE', allowedPosition: 'Defender' },
    { slot: 'DEF_4', label: 'Defender 4', unit: 'DEFENSE', allowedPosition: 'Defender' },
    { slot: 'DEF_5', label: 'Defender 5', unit: 'DEFENSE', allowedPosition: 'Defender' },
    { slot: 'DEF_6', label: 'Defender 6', unit: 'DEFENSE', allowedPosition: 'Defender' },
];

const DEFAULT_TEAM_NAME = 'My Showtime Stars';

function emptySquad(): Record<FantasySlot, FantasyPlayerListItem | null> {
    return {
        QB_M: null,
        QB_F: null,
        REC_1: null,
        REC_2: null,
        REC_3: null,
        REC_4: null,
        REC_5: null,
        RUSHER: null,
        DEF_1: null,
        DEF_2: null,
        DEF_3: null,
        DEF_4: null,
        DEF_5: null,
        DEF_6: null,
    };
}

export function FantasySquadBuilder() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isLoading: authLoading } = useAuth();

    // Active Season & Gameweek
    const { data: season, isLoading: seasonLoading } = useQuery({
        queryKey: ['fantasySeason'],
        queryFn: fantasyApi.getActiveSeason,
    });

    const { data: gameweeks = [], isLoading: gwLoading } = useQuery({
        queryKey: ['fantasyGameweeks', season?.id],
        queryFn: () => (season?.id ? fantasyApi.getGameweeks(season.id) : Promise.resolve([])),
        enabled: !!season?.id,
    });

    const scheduledGW = gameweeks.find(gw => gw.status === 'SCHEDULED') || gameweeks[0];

    // Current Lineup
    const { data: currentLineup, isLoading: lineupLoading } = useQuery({
        queryKey: ['myFantasyLineup', season?.id, scheduledGW?.id],
        queryFn: () => (season?.id && scheduledGW?.id ? fantasyApi.getMyLineup(season.id, scheduledGW.id) : Promise.resolve(null)),
        enabled: !!season?.id && !!scheduledGW?.id,
    });

    // Local squad state: slot -> FantasyPlayerListItem
    const [squad, setSquad] = useState<Record<FantasySlot, FantasyPlayerListItem | null>>(emptySquad);

    const [teamName, setTeamName] = useState(DEFAULT_TEAM_NAME);
    const [selectedUnitTab, setSelectedUnitTab] = useState<'ALL' | 'OFFENSE' | 'DEFENSE'>('ALL');
    const [activeModalSlot, setActiveModalSlot] = useState<SlotDefinition | null>(null);
    const [marketSearch, setMarketSearch] = useState('');

    const hydratedGameweekIdRef = useRef<string | null>(null);

    // Pre-populate from the saved lineup, once per gameweek.
    useEffect(() => {
        const gameweekId = scheduledGW?.id;
        if (!gameweekId || lineupLoading) return;
        if (hydratedGameweekIdRef.current === gameweekId) return;

        const isGameweekSwitch = hydratedGameweekIdRef.current !== null;
        hydratedGameweekIdRef.current = gameweekId;

        if (!currentLineup) {
            if (isGameweekSwitch) {
                setTeamName(DEFAULT_TEAM_NAME);
                setSquad(emptySquad());
            }
            return;
        }

        setTeamName(currentLineup.team_name || DEFAULT_TEAM_NAME);
        setSquad(prev => {
            const next = isGameweekSwitch ? emptySquad() : { ...prev };
            currentLineup.picks.forEach(p => {
                next[p.slot] = {
                    player_id: p.player_id,
                    player_name: p.player_name || 'Unknown Player',
                    player_image: p.player_image || '',
                    position: p.position || '',
                    gender: p.gender || 'M',
                    team_id: p.team_id || '',
                    team_name: p.team_name || '',
                    team_short_name: p.team_short_name || '',
                    team_logo: p.team_logo || '',
                    price: p.purchase_price || 10,
                    rating: 5,
                    total_points: p.points || 0,
                    selected_by_pct: 0,
                };
            });
            return next;
        });
    }, [currentLineup, scheduledGW?.id, lineupLoading]);

    // Player Market Query for Active Modal Slot
    const { data: marketData, isLoading: marketLoading } = useQuery({
        queryKey: ['playerMarket', season?.id, activeModalSlot?.allowedPosition, activeModalSlot?.requiredGender, marketSearch],
        queryFn: () => {
            if (!season?.id || !activeModalSlot) return Promise.resolve({ data: [], total: 0, total_pages: 0 });
            return fantasyApi.listPlayerMarket(season.id, {
                position: activeModalSlot.allowedPosition,
                gender: activeModalSlot.requiredGender,
                search: marketSearch,
                limit: 100,
            });
        },
        enabled: !!season?.id && !!activeModalSlot,
    });

    // Calculations & Invariant Validations
    const calculations = useMemo(() => {
        let totalSpent = 0;
        let filledCount = 0;
        let offenseFemales = 0;
        let defenseFemales = 0;
        const clubCounts: Record<string, number> = {};
        const chosenPlayerIds = new Set<string>();

        SLOT_DEFINITIONS.forEach(def => {
            const player = squad[def.slot];
            if (player) {
                totalSpent += player.price;
                filledCount++;
                chosenPlayerIds.add(player.player_id);

                const isFemale = (player.gender || '').toUpperCase() === 'F';
                if (def.unit === 'OFFENSE' && isFemale) offenseFemales++;
                if (def.unit === 'DEFENSE' && isFemale) defenseFemales++;

                if (player.team_id) {
                    clubCounts[player.team_id] = (clubCounts[player.team_id] || 0) + 1;
                }
            }
        });

        const budget = season?.budget || 230;
        const budgetValid = totalSpent <= budget;
        const slotsFilled = filledCount === 14;
        const offenseFemalesValid = offenseFemales >= (season?.min_female_offense || 3);
        const defenseFemalesValid = defenseFemales >= (season?.min_female_defense || 3);

        const clubExceeded = Object.entries(clubCounts).find(([_, count]) => count > (season?.max_per_club || 4));
        const clubLimitValid = !clubExceeded;

        const isValid = slotsFilled && budgetValid && offenseFemalesValid && defenseFemalesValid && clubLimitValid;

        return {
            totalSpent,
            remainingBudget: budget - totalSpent,
            filledCount,
            offenseFemales,
            defenseFemales,
            clubCounts,
            chosenPlayerIds,
            budgetValid,
            slotsFilled,
            offenseFemalesValid,
            defenseFemalesValid,
            clubLimitValid,
            isValid,
        };
    }, [squad, season]);

    // Save Lineup Mutation
    const saveMutation = useMutation({
        mutationFn: () => {
            if (!season || !scheduledGW) throw new Error("No active season or scheduled gameweek");
            const picks = SLOT_DEFINITIONS.map(def => {
                const p = squad[def.slot];
                if (!p) throw new Error(`Slot ${def.label} is empty`);
                return {
                    player_id: p.player_id,
                    slot: def.slot,
                };
            });
            return fantasyApi.saveLineup({
                season_id: season.id,
                gameweek_id: scheduledGW.id,
                team_name: teamName.trim() || DEFAULT_TEAM_NAME,
                picks,
            });
        },
        onSuccess: () => {
            toast.success("Lineup saved successfully!");
            queryClient.invalidateQueries({ queryKey: ['myFantasyLineup'] });
            navigate('/fantasy/my-team');
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || err.message || "Failed to save lineup");
        }
    });

    const handleSelectPlayer = (player: FantasyPlayerListItem) => {
        if (!activeModalSlot) return;

        const existingSlot = Object.entries(squad).find(([_, p]) => p?.player_id === player.player_id);
        if (existingSlot && existingSlot[0] !== activeModalSlot.slot) {
            toast.error(`${player.player_name} is already picked in slot ${existingSlot[0]}`);
            return;
        }

        setSquad(prev => ({
            ...prev,
            [activeModalSlot.slot]: player,
        }));
        setActiveModalSlot(null);
    };

    const handleRemovePlayer = (slot: FantasySlot, e: MouseEvent) => {
        e.stopPropagation();
        setSquad(prev => ({
            ...prev,
            [slot]: null,
        }));
    };

    if (authLoading || seasonLoading || gwLoading || lineupLoading) {
        return <Loader />;
    }

    if (!season || !scheduledGW) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
                    <ExclamationCircleIcon className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-black uppercase text-sffl-navy dark:text-white mb-2">No Gameweek Open for Submissions</h1>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">Upcoming fixtures are being scheduled. Please check back shortly!</p>
            </div>
        );
    }

    const displayedSlots = SLOT_DEFINITIONS.filter(def => {
        if (selectedUnitTab === 'ALL') return true;
        return def.unit === selectedUnitTab;
    });

    const marketPlayers = marketData?.data || [];

    return (
        <div className="space-y-6 md:space-y-8 pb-24">
            {/* Header Showtime Navy Banner */}
            <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black px-2.5 py-0.5 rounded bg-sffl-red text-white uppercase tracking-wider">
                                Gameweek {scheduledGW.number}
                            </span>
                            <span className="text-xs text-gray-300 font-medium">
                                Lock Deadline: {new Date(scheduledGW.deadline).toLocaleString()}
                            </span>
                        </div>
                        <input
                            type="text"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            placeholder="Enter Team Name..."
                            className="mt-2 text-2xl sm:text-3xl font-black italic bg-transparent border-b border-white/20 hover:border-white/40 focus:border-sffl-red focus:outline-none text-white tracking-tight w-full max-w-md"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => saveMutation.mutate()}
                            disabled={!calculations.isValid || saveMutation.isPending}
                            className={`px-6 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition active:scale-95 shadow-lg ${
                                calculations.isValid
                                    ? 'bg-sffl-red hover:bg-[#A52323] text-white shadow-sffl-red/30 cursor-pointer'
                                    : 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600'
                            }`}
                        >
                            {saveMutation.isPending ? (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <BookmarkSquareIcon className="w-4 h-4" />
                            )}
                            Save Lineup ({calculations.filledCount}/14)
                        </button>
                    </div>
                </div>

                {/* Rollover Alert Strip */}
                {currentLineup?.is_rollover && (
                    <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 shrink-0 text-amber-300" />
                        <span><strong>Lineup Rollover Active:</strong> Loaded from your previous match day. You can save updates now, or let it accumulate points automatically!</span>
                    </div>
                )}
            </div>

            {/* Invariant Validation Strips */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {/* Budget */}
                <div className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between ${
                    calculations.budgetValid 
                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white' 
                        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                }`}>
                    <div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block uppercase font-bold">Remaining Cap</span>
                        <span className="font-black text-base md:text-lg">{calculations.remainingBudget.toFixed(2)} SC</span>
                    </div>
                    {calculations.budgetValid ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <ExclamationCircleIcon className="w-5 h-5 text-red-500" />}
                </div>

                {/* Starters */}
                <div className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between ${
                    calculations.slotsFilled 
                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white' 
                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                }`}>
                    <div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block uppercase font-bold">Starters</span>
                        <span className="font-black text-base md:text-lg">{calculations.filledCount} / 14</span>
                    </div>
                    {calculations.slotsFilled ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <ExclamationCircleIcon className="w-5 h-5 text-amber-500" />}
                </div>

                {/* Offense Females */}
                <div className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between ${
                    calculations.offenseFemalesValid 
                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white' 
                        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                }`}>
                    <div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block uppercase font-bold">Offense ♀ (Min 3)</span>
                        <span className="font-black text-base md:text-lg">{calculations.offenseFemales} / 3</span>
                    </div>
                    {calculations.offenseFemalesValid ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <ExclamationCircleIcon className="w-5 h-5 text-red-500" />}
                </div>

                {/* Defense Females */}
                <div className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between ${
                    calculations.defenseFemalesValid 
                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white' 
                        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                }`}>
                    <div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block uppercase font-bold">Defense ♀ (Min 3)</span>
                        <span className="font-black text-base md:text-lg">{calculations.defenseFemales} / 3</span>
                    </div>
                    {calculations.defenseFemalesValid ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <ExclamationCircleIcon className="w-5 h-5 text-red-500" />}
                </div>

                {/* Club Limit */}
                <div className={`p-3.5 rounded-xl border shadow-sm col-span-2 sm:col-span-1 flex items-center justify-between ${
                    calculations.clubLimitValid 
                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white' 
                        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                }`}>
                    <div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block uppercase font-bold">Max 4 / Club</span>
                        <span className="font-black text-base md:text-lg">{calculations.clubLimitValid ? 'Compliant' : 'Exceeded'}</span>
                    </div>
                    {calculations.clubLimitValid ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <ExclamationCircleIcon className="w-5 h-5 text-red-500" />}
                </div>
            </div>

            {/* Unit Switcher Tabs */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm inline-flex gap-1.5">
                <button
                    onClick={() => setSelectedUnitTab('ALL')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                        selectedUnitTab === 'ALL' 
                            ? 'bg-sffl-navy text-white shadow-md' 
                            : 'text-gray-600 dark:text-gray-300 hover:text-sffl-navy dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                    Full Roster (14)
                </button>
                <button
                    onClick={() => setSelectedUnitTab('OFFENSE')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                        selectedUnitTab === 'OFFENSE' 
                            ? 'bg-sffl-red text-white shadow-md' 
                            : 'text-gray-600 dark:text-gray-300 hover:text-sffl-red hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                    Offensive Unit (7)
                </button>
                <button
                    onClick={() => setSelectedUnitTab('DEFENSE')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                        selectedUnitTab === 'DEFENSE' 
                            ? 'bg-emerald-600 text-white shadow-md' 
                            : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                    Defensive Unit (7)
                </button>
            </div>

            {/* Slots Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 md:gap-4">
                {displayedSlots.map(def => {
                    const player = squad[def.slot];
                    return (
                        <div
                            key={def.slot}
                            onClick={() => setActiveModalSlot(def)}
                            className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                                player
                                    ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 shadow-sm'
                                    : 'bg-white/60 dark:bg-gray-800/40 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-sffl-red dark:hover:border-sffl-red hover:bg-white dark:hover:bg-gray-800 shadow-sm'
                            }`}
                        >
                            <div className="flex items-center gap-3.5">
                                {player ? (
                                    <div className="relative">
                                        <img
                                            src={player.player_image || '/placeholder-player.png'}
                                            alt={player.player_name}
                                            className="w-14 h-14 rounded-xl object-cover bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                                        />
                                        <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase text-white ${
                                            player.gender === 'F' ? 'bg-pink-500' : 'bg-blue-600'
                                        }`}>
                                            {player.gender === 'F' ? '♀' : '♂'}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                                        <span className="text-[10px] font-black uppercase tracking-wider">{def.slot}</span>
                                        <UsersIcon className="w-4 h-4 mt-0.5 text-gray-400" />
                                    </div>
                                )}

                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                            {def.slot}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{def.label}</span>
                                    </div>

                                    {player ? (
                                        <div className="mt-1">
                                            <h4 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{player.player_name}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {player.team_short_name || player.team_name} • {player.position}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-sffl-red font-bold mt-1">Tap to draft athlete</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {player && (
                                    <div className="text-right">
                                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Price</span>
                                        <span className="text-sm font-black text-sffl-red">{player.price.toFixed(2)} SC</span>
                                    </div>
                                )}

                                {player ? (
                                    <button
                                        onClick={(e) => handleRemovePlayer(def.slot, e)}
                                        className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-500 hover:text-sffl-red transition"
                                        title="Remove pick"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <ChevronRightIcon className="w-5 h-5 text-gray-400 dark:text-gray-600" />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Player Selection Modal */}
            {activeModalSlot && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-black text-sffl-red uppercase tracking-wider block">
                                    Selecting for {activeModalSlot.slot}
                                </span>
                                <h3 className="text-lg font-black text-sffl-navy dark:text-white">{activeModalSlot.label}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Position: <strong>{activeModalSlot.allowedPosition}</strong>
                                    {activeModalSlot.requiredGender && (
                                        <span> • Gender: <strong>{activeModalSlot.requiredGender === 'F' ? 'Female' : 'Male'}</strong></span>
                                    )}
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveModalSlot(null)}
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 transition"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                            <div className="relative">
                                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={marketSearch}
                                    onChange={(e) => setMarketSearch(e.target.value)}
                                    placeholder="Search by player name..."
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                />
                            </div>
                        </div>

                        {/* Player Market List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {marketLoading ? (
                                <div className="py-12 flex justify-center">
                                    <div className="w-8 h-8 border-2 border-sffl-red border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : marketPlayers.length === 0 ? (
                                <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                                    No athletes found matching the position/gender filter.
                                </div>
                            ) : (
                                marketPlayers.map((p) => {
                                    const isAlreadyPicked = calculations.chosenPlayerIds.has(p.player_id);
                                    const clubCount = calculations.clubCounts[p.team_id] || 0;
                                    const clubExceeded = clubCount >= (season?.max_per_club || 4);

                                    return (
                                        <div
                                            key={p.player_id}
                                            className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                                                isAlreadyPicked
                                                    ? 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 opacity-60'
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-sffl-red/60 shadow-sm'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <img
                                                        src={p.player_image || '/placeholder-player.png'}
                                                        alt={p.player_name}
                                                        className="w-12 h-12 rounded-xl object-cover bg-gray-100 dark:bg-gray-700"
                                                    />
                                                    <span className={`absolute -top-1 -right-1 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase text-white ${
                                                        p.gender === 'F' ? 'bg-pink-500' : 'bg-blue-600'
                                                    }`}>
                                                        {p.gender === 'F' ? '♀' : '♂'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">{p.player_name}</h4>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                        {p.team_short_name || p.team_name} • {p.position}
                                                    </p>
                                                    {clubExceeded && !isAlreadyPicked && (
                                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                                                            Club limit reached (4/4)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Price</span>
                                                    <span className="text-sm font-black text-sffl-red">{p.price.toFixed(2)} SC</span>
                                                </div>

                                                <button
                                                    onClick={() => handleSelectPlayer(p)}
                                                    disabled={isAlreadyPicked}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                                                        isAlreadyPicked
                                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                            : 'bg-sffl-red hover:bg-[#A52323] text-white cursor-pointer shadow-md'
                                                    }`}
                                                >
                                                    {isAlreadyPicked ? 'Drafted' : 'Select'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
