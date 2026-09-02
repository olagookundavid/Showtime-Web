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
    /**
     * Positions eligible for this slot. Receiver slots also accept Centers —
     * Center is a real position here and the rating engine scores it with the
     * Receiver formula verbatim.
     */
    allowedPositions: string[];
    requiredGender?: 'M' | 'F';
}

const SLOT_DEFINITIONS: SlotDefinition[] = [
    // Offense (7)
    { slot: 'QB_M', label: 'Male Starting QB', unit: 'OFFENSE', allowedPositions: ['QB'], requiredGender: 'M' },
    { slot: 'QB_F', label: 'Female Starting QB', unit: 'OFFENSE', allowedPositions: ['QB'], requiredGender: 'F' },
    { slot: 'REC_1', label: 'Wide Receiver 1', unit: 'OFFENSE', allowedPositions: ['Receiver', 'Center'] },
    { slot: 'REC_2', label: 'Wide Receiver 2', unit: 'OFFENSE', allowedPositions: ['Receiver', 'Center'] },
    { slot: 'REC_3', label: 'Wide Receiver 3', unit: 'OFFENSE', allowedPositions: ['Receiver', 'Center'] },
    { slot: 'REC_4', label: 'Wide Receiver 4', unit: 'OFFENSE', allowedPositions: ['Receiver', 'Center'] },
    { slot: 'REC_5', label: 'Wide Receiver 5', unit: 'OFFENSE', allowedPositions: ['Receiver', 'Center'] },
    // Defense (7)
    { slot: 'RUSHER', label: 'Pass Rusher', unit: 'DEFENSE', allowedPositions: ['Rusher'] },
    { slot: 'DEF_1', label: 'Defender 1', unit: 'DEFENSE', allowedPositions: ['Defender'] },
    { slot: 'DEF_2', label: 'Defender 2', unit: 'DEFENSE', allowedPositions: ['Defender'] },
    { slot: 'DEF_3', label: 'Defender 3', unit: 'DEFENSE', allowedPositions: ['Defender'] },
    { slot: 'DEF_4', label: 'Defender 4', unit: 'DEFENSE', allowedPositions: ['Defender'] },
    { slot: 'DEF_5', label: 'Defender 5', unit: 'DEFENSE', allowedPositions: ['Defender'] },
    { slot: 'DEF_6', label: 'Defender 6', unit: 'DEFENSE', allowedPositions: ['Defender'] },
];

const DEFAULT_TEAM_NAME = 'My Showtime Stars';

const emptySquad = (): Record<FantasySlot, FantasyPlayerListItem | null> => ({
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
});

/** "Receiver" / "Receiver or Center" — reads naturally in the modal caption. */
const formatPositions = (positions: string[]): string =>
    positions.length <= 1
        ? positions[0] || ''
        : `${positions.slice(0, -1).join(', ')} or ${positions[positions.length - 1]}`;

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

    // Which gameweek's server lineup has already been loaded into local state.
    // Hydration must happen exactly once per gameweek: any react-query refetch
    // (a window refocus, say) hands us a fresh `currentLineup` object, and
    // re-hydrating on that would silently throw away the user's unsaved picks.
    const hydratedGameweekIdRef = useRef<string | null>(null);

    // Pre-populate from the saved lineup, once per gameweek.
    useEffect(() => {
        const gameweekId = scheduledGW?.id;
        // Wait for the lineup query to settle, or we'd mark the gameweek
        // hydrated off a not-yet-loaded lineup and never prefill it.
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
            // Switching gameweeks starts from a clean sheet so picks from the
            // previous gameweek can't linger in slots this lineup doesn't fill.
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
    }, [scheduledGW?.id, currentLineup, lineupLoading]);

    // Player Market Query for Active Modal Slot
    const { data: marketData, isLoading: marketLoading } = useQuery({
        queryKey: [
            'playerMarket',
            season?.id,
            activeModalSlot?.allowedPositions.join(','),
            activeModalSlot?.requiredGender,
            marketSearch,
        ],
        queryFn: () => {
            if (!season?.id || !activeModalSlot) return Promise.resolve({ data: [], total: 0, total_pages: 0 });
            // Position and gender are both filtered server-side, so a page of
            // results is a page of *eligible* results.
            return fantasyApi.listPlayerMarket(season.id, {
                position: activeModalSlot.allowedPositions.join(','),
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

        // Check if already in squad in another slot
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
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
                <ExclamationCircleIcon className="w-16 h-16 text-yellow-500 mb-4" />
                <h1 className="text-2xl font-black uppercase text-white mb-2">No Gameweek Open for Submissions</h1>
                <p className="text-neutral-400 max-w-md mb-6">Upcoming fixtures are being scheduled. Please check back shortly!</p>
            </div>
        );
    }

    // Filter slots for unit tab
    const displayedSlots = SLOT_DEFINITIONS.filter(def => {
        if (selectedUnitTab === 'ALL') return true;
        return def.unit === selectedUnitTab;
    });

    // Already filtered by position and gender server-side.
    const marketPlayers = marketData?.data ?? [];

    return (
        <div className="min-h-screen bg-black text-white pb-24">
            {/* Header Sticky Bar */}
            <div className="sticky top-0 z-30 bg-neutral-950/95 border-b border-neutral-800 backdrop-blur-md px-4 sm:px-6 py-4">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 uppercase">
                                Gameweek {scheduledGW.number}
                            </span>
                            <span className="text-xs text-neutral-400 font-medium">
                                Deadline: {new Date(scheduledGW.deadline).toLocaleString()}
                            </span>
                        </div>
                        <input
                            type="text"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            placeholder="Enter Team Name..."
                            className="mt-1 text-xl sm:text-2xl font-black bg-transparent border-b border-transparent hover:border-neutral-700 focus:border-yellow-500 focus:outline-none text-white tracking-tight"
                        />
                    </div>

                    {/* Action button */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => saveMutation.mutate()}
                            disabled={!calculations.isValid || saveMutation.isPending}
                            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition active:scale-95 shadow-lg ${
                                calculations.isValid
                                    ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/20 cursor-pointer'
                                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                            }`}
                        >
                            {saveMutation.isPending ? (
                                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <BookmarkSquareIcon className="w-4 h-4" />
                            )}
                            Save Lineup ({calculations.filledCount}/14)
                        </button>
                    </div>
                </div>

                {/* Rollover Notification Banner */}
                {currentLineup?.is_rollover && (
                    <div className="max-w-6xl mx-auto mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 shrink-0" />
                        <span><strong>Lineup Rollover Active:</strong> Loaded from your previous match day. You can save updates now, or let it accumulate points automatically!</span>
                    </div>
                )}

                {/* Live Rules Validation Strip */}
                <div className="max-w-6xl mx-auto mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    {/* Budget */}
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        calculations.budgetValid ? 'bg-neutral-900/60 border-neutral-800 text-neutral-300' : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                        <div>
                            <span className="text-[10px] text-neutral-400 block uppercase font-bold">Remaining Budget</span>
                            <span className="font-black text-sm">{calculations.remainingBudget.toFixed(2)} SC</span>
                        </div>
                        {calculations.budgetValid ? <CheckCircleIcon className="w-4 h-4 text-emerald-400" /> : <ExclamationCircleIcon className="w-4 h-4 text-red-400" />}
                    </div>

                    {/* Starters */}
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        calculations.slotsFilled ? 'bg-neutral-900/60 border-neutral-800 text-neutral-300' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                    }`}>
                        <div>
                            <span className="text-[10px] text-neutral-400 block uppercase font-bold">Starters</span>
                            <span className="font-black text-sm">{calculations.filledCount} / 14</span>
                        </div>
                        {calculations.slotsFilled ? <CheckCircleIcon className="w-4 h-4 text-emerald-400" /> : <ExclamationCircleIcon className="w-4 h-4 text-yellow-400" />}
                    </div>

                    {/* Offense Females */}
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        calculations.offenseFemalesValid ? 'bg-neutral-900/60 border-neutral-800 text-neutral-300' : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                        <div>
                            <span className="text-[10px] text-neutral-400 block uppercase font-bold">Offense ♀ (Min 3)</span>
                            <span className="font-black text-sm">{calculations.offenseFemales} / 3</span>
                        </div>
                        {calculations.offenseFemalesValid ? <CheckCircleIcon className="w-4 h-4 text-emerald-400" /> : <ExclamationCircleIcon className="w-4 h-4 text-red-400" />}
                    </div>

                    {/* Defense Females */}
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        calculations.defenseFemalesValid ? 'bg-neutral-900/60 border-neutral-800 text-neutral-300' : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                        <div>
                            <span className="text-[10px] text-neutral-400 block uppercase font-bold">Defense ♀ (Min 3)</span>
                            <span className="font-black text-sm">{calculations.defenseFemales} / 3</span>
                        </div>
                        {calculations.defenseFemalesValid ? <CheckCircleIcon className="w-4 h-4 text-emerald-400" /> : <ExclamationCircleIcon className="w-4 h-4 text-red-400" />}
                    </div>

                    {/* Club Quota */}
                    <div className={`p-2.5 rounded-xl border col-span-2 sm:col-span-1 flex items-center justify-between ${
                        calculations.clubLimitValid ? 'bg-neutral-900/60 border-neutral-800 text-neutral-300' : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                        <div>
                            <span className="text-[10px] text-neutral-400 block uppercase font-bold">Max 4 / Club</span>
                            <span className="font-black text-sm">{calculations.clubLimitValid ? 'Compliant' : 'Exceeded'}</span>
                        </div>
                        {calculations.clubLimitValid ? <CheckCircleIcon className="w-4 h-4 text-emerald-400" /> : <ExclamationCircleIcon className="w-4 h-4 text-red-400" />}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6">
                {/* Unit Switcher Tabs */}
                <div className="flex items-center gap-2 mb-6 border-b border-neutral-800 pb-3">
                    <button
                        onClick={() => setSelectedUnitTab('ALL')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                            selectedUnitTab === 'ALL' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white'
                        }`}
                    >
                        Full Roster (14)
                    </button>
                    <button
                        onClick={() => setSelectedUnitTab('OFFENSE')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                            selectedUnitTab === 'OFFENSE' ? 'bg-yellow-500 text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white'
                        }`}
                    >
                        Offensive Unit (7)
                    </button>
                    <button
                        onClick={() => setSelectedUnitTab('DEFENSE')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                            selectedUnitTab === 'DEFENSE' ? 'bg-emerald-500 text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white'
                        }`}
                    >
                        Defensive Unit (7)
                    </button>
                </div>

                {/* Slots Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayedSlots.map(def => {
                        const player = squad[def.slot];
                        return (
                            <div
                                key={def.slot}
                                onClick={() => setActiveModalSlot(def)}
                                className={`p-4 rounded-2xl border transition cursor-pointer hover:border-neutral-600 relative flex items-center justify-between ${
                                    player
                                        ? 'bg-neutral-900/80 border-neutral-800'
                                        : 'bg-neutral-950/60 border-dashed border-neutral-800 hover:bg-neutral-900/40'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Slot Badge or Player Photo */}
                                    {player ? (
                                        <div className="relative">
                                            <img
                                                src={player.player_image || '/placeholder-player.png'}
                                                alt={player.player_name}
                                                className="w-14 h-14 rounded-xl object-cover bg-neutral-800 border border-neutral-700"
                                            />
                                            <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                                                player.gender === 'F' ? 'bg-pink-500 text-white' : 'bg-blue-600 text-white'
                                            }`}>
                                                {player.gender === 'F' ? '♀' : '♂'}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="w-14 h-14 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center text-neutral-500">
                                            <span className="text-[10px] font-black uppercase">{def.slot}</span>
                                            <UsersIcon className="w-4 h-4 mt-0.5" />
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-extrabold uppercase px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                                                {def.slot}
                                            </span>
                                            <span className="text-xs text-neutral-400">{def.label}</span>
                                        </div>

                                        {player ? (
                                            <div className="mt-1">
                                                <h4 className="text-base font-bold text-white leading-tight">{player.player_name}</h4>
                                                <p className="text-xs text-neutral-400 mt-0.5">
                                                    {player.team_short_name || player.team_name} • {player.position}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-yellow-500/80 font-bold mt-1">Tap to select athlete</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {player && (
                                        <div className="text-right">
                                            <span className="text-xs text-neutral-400 block font-medium">Price</span>
                                            <span className="text-sm font-black text-yellow-400">{player.price.toFixed(2)} SC</span>
                                        </div>
                                    )}

                                    {player ? (
                                        <button
                                            onClick={(e) => handleRemovePlayer(def.slot, e)}
                                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition"
                                            title="Remove pick"
                                        >
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <ChevronRightIcon className="w-5 h-5 text-neutral-600" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Player Selection Modal */}
            {activeModalSlot && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-6 border-b border-neutral-800 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider block">
                                    Selecting for {activeModalSlot.slot}
                                </span>
                                <h3 className="text-lg font-black text-white">{activeModalSlot.label}</h3>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                    Position: <strong>{formatPositions(activeModalSlot.allowedPositions)}</strong>
                                    {activeModalSlot.requiredGender && (
                                        <span> • Gender: <strong>{activeModalSlot.requiredGender === 'F' ? 'Female' : 'Male'}</strong></span>
                                    )}
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveModalSlot(null)}
                                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="p-4 border-b border-neutral-800 bg-neutral-950/50">
                            <div className="relative">
                                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="text"
                                    value={marketSearch}
                                    onChange={(e) => setMarketSearch(e.target.value)}
                                    placeholder="Search by player name..."
                                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-yellow-500"
                                />
                            </div>
                        </div>

                        {/* Player Market List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {marketLoading ? (
                                <div className="py-12 flex justify-center">
                                    <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : marketPlayers.length === 0 ? (
                                <div className="py-12 text-center text-neutral-400 text-sm">
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
                                                    ? 'bg-neutral-950/40 border-neutral-800 opacity-60'
                                                    : 'bg-neutral-950/80 border-neutral-800 hover:border-yellow-500/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <img
                                                        src={p.player_image || '/placeholder-player.png'}
                                                        alt={p.player_name}
                                                        className="w-12 h-12 rounded-xl object-cover bg-neutral-800"
                                                    />
                                                    <span className={`absolute -top-1 -right-1 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                                                        p.gender === 'F' ? 'bg-pink-500 text-white' : 'bg-blue-600 text-white'
                                                    }`}>
                                                        {p.gender === 'F' ? '♀' : '♂'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-white">{p.player_name}</h4>
                                                    <p className="text-xs text-neutral-400 mt-0.5">
                                                        {p.team_short_name || p.team_name} • {p.position}
                                                    </p>
                                                    {clubExceeded && !isAlreadyPicked && (
                                                        <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                                                            Club limit reached (4/4)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="text-xs text-neutral-400 block font-medium">Price</span>
                                                    <span className="text-sm font-black text-yellow-400">{p.price.toFixed(2)} SC</span>
                                                </div>

                                                <button
                                                    onClick={() => handleSelectPlayer(p)}
                                                    disabled={isAlreadyPicked}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                                                        isAlreadyPicked
                                                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                                            : 'bg-yellow-500 hover:bg-yellow-400 text-black cursor-pointer shadow-md'
                                                    }`}
                                                >
                                                    {isAlreadyPicked ? 'Picked' : 'Select'}
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
