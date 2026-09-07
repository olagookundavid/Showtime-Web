import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    UsersIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    ChevronRightIcon,
    XMarkIcon,
    MagnifyingGlassIcon,
    BookmarkSquareIcon,
    SparklesIcon,
    BanknotesIcon,
    ArrowsRightLeftIcon,
    ArrowUturnDownIcon,
    ArrowUpTrayIcon,
    MinusCircleIcon,
    PlusCircleIcon,
    ExclamationTriangleIcon,
    LockClosedIcon,
} from '@heroicons/react/24/outline';
import {
    fantasyApi,
    fantasySeasonApi,
    fantasySquadApi,
    type FantasySlot,
    type FantasyPlayerListItem,
    type Squad,
    type SquadPlayer,
    formatFantasyPrice,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from '../../components/ui/Loader';
import { PlayerAvatar } from '../../components/fantasy/PlayerAvatar';

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

const isFemale = (g?: string): boolean => (g || '').toUpperCase().startsWith('F');

const unitOf = (position: string): 'offense' | 'defense' =>
    position === 'Rusher' || position === 'Defender' ? 'defense' : 'offense';

export function FantasySquadBuilder() {
    // Shares the hub/dashboard query key, so this is a cache hit rather than
    // an extra request.
    const { data: dashboard, isLoading: enteredLoading } = useQuery({
        queryKey: ['fantasyDashboard'],
        queryFn: () => fantasySeasonApi.getDashboard(),
    });
    const hasJoined = dashboard ? dashboard.entered : undefined;

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
    // Player action popover: which slot's player is showing actions
    const [actionSlot, setActionSlot] = useState<FantasySlot | null>(null);
    // Sell confirmation dialog
    const [confirmSell, setConfirmSell] = useState<SquadPlayer | null>(null);
    // When selling from the starting 14: open market after sell completes
    const [pendingTransferOutSlot, setPendingTransferOutSlot] = useState<SlotDefinition | null>(null);
    // Market browser for bench signing
    const [showBenchMarket, setShowBenchMarket] = useState(false);

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
                    price: p.purchase_price || 0,
                    rating: 5,
                    total_points: p.points || 0,
                    // A lineup pick carries no market context — these are the
                    // market's fields, and this player was resolved from a
                    // saved team sheet rather than the listing.
                    owned_by: 0,
                    selected_by_pct: 0,
                    transfers_in: 0,
                    transfers_out: 0,
                };
            });
            return next;
        });
    }, [currentLineup, scheduledGW?.id, lineupLoading]);

    // The manager's owned squad. A lineup can only name players they own, so
    // this is the primary source for the picker — the market below it is for
    // filling gaps when the nineteen isn't complete.
    const { data: mySquad } = useQuery({
        queryKey: ['fantasySquad', season?.id],
        queryFn: () => fantasySquadApi.getSquad(season!.id),
        enabled: !!season?.id,
    });

    const refreshSquad = (next: Squad) => {
        queryClient.setQueryData(['fantasySquad', season?.id], next);
        queryClient.invalidateQueries({ queryKey: ['fantasyDashboard'] });
        queryClient.invalidateQueries({ queryKey: ['fantasyLineup'] });
    };

    // Buying from inside the picker, for a squad that has no one for this slot.
    const buyMutation = useMutation({
        mutationFn: (playerId: string) => fantasySquadApi.buyPlayer(season!.id, playerId),
        onSuccess: (next, playerId) => {
            refreshSquad(next);
            const signed = next.players.find((p) => p.player_id === playerId);
            if (signed) toast.success(`Signed ${signed.name}.`);
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || 'Could not sign this player.'),
    });

    // Selling a player from the squad
    const sellMutation = useMutation({
        mutationFn: (playerId: string) => fantasySquadApi.sellPlayer(season!.id, playerId),
        onSuccess: (next) => {
            refreshSquad(next);
            setConfirmSell(null);
            toast.success('Sold — the money is back in your bank.');

            // If this was a "Transfer Out" from a starting slot, open market for replacement
            if (pendingTransferOutSlot) {
                setActiveModalSlot(pendingTransferOutSlot);
                setPendingTransferOutSlot(null);
            }
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || 'Could not sell this player.'),
    });

    // Player Market Query for Active Modal Slot
    const { data: marketData, isLoading: marketLoading } = useQuery({
        queryKey: ['playerMarket', season?.id, activeModalSlot?.allowedPositions, activeModalSlot?.requiredGender, marketSearch],
        queryFn: () => {
            if (!season?.id || !activeModalSlot) return Promise.resolve({ data: [], total: 0, total_pages: 0, my_rank: 0 });
            return fantasyApi.listPlayerMarket(season.id, {
                // Every eligible position, not just the first: a receiver slot
                // takes Receivers and Centers, and sending only "Receiver"
                // silently hid every Center from the market.
                position: activeModalSlot.allowedPositions.join(','),
                gender: activeModalSlot.requiredGender,
                search: marketSearch,
                limit: 100,
            });
        },
        enabled: !!season?.id && !!activeModalSlot,
    });

    // Market for bench signings — all positions, no slot filter
    const { data: benchMarketData, isLoading: benchMarketLoading } = useQuery({
        queryKey: ['benchMarket', season?.id, marketSearch],
        queryFn: () => {
            if (!season?.id) return Promise.resolve({ data: [], total: 0, total_pages: 0, my_rank: 0 });
            return fantasyApi.listPlayerMarket(season.id, {
                search: marketSearch,
                limit: 100,
            });
        },
        enabled: !!season?.id && showBenchMarket,
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

                const isFem = (player.gender || '').toUpperCase() === 'F';
                if (def.unit === 'OFFENSE' && isFem) offenseFemales++;
                if (def.unit === 'DEFENSE' && isFem) defenseFemales++;

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

    // Bench / reserve players (owned but not in the starting 14)
    const benchPlayers = useMemo(() => {
        if (!mySquad) return [];
        return mySquad.players.filter(p => !p.starting);
    }, [mySquad]);

    // Already filtered by position and gender server-side.
    const marketPlayers = marketData?.data ?? [];

    // Split the picker in two: who the manager already owns and can field right
    // away, and who they would have to buy first. Owned players come first
    // because fielding one costs nothing and is almost always the intent.
    const ownedForSlot = useMemo(() => {
        if (!activeModalSlot || !mySquad) return [];
        const allowed = new Set(activeModalSlot.allowedPositions);
        return mySquad.players
            .filter((p) => allowed.has(p.position))
            .filter((p) => !activeModalSlot.requiredGender ||
                (p.gender || 'M').toUpperCase().startsWith(activeModalSlot.requiredGender))
            .filter((p) => !marketSearch ||
                p.name.toLowerCase().includes(marketSearch.toLowerCase()));
    }, [activeModalSlot, mySquad, marketSearch]);

    const ownedIds = useMemo(
        () => new Set((mySquad?.players ?? []).map((p) => p.player_id)),
        [mySquad],
    );

    // Anyone already owned is shown in the section above, so the market half
    // lists only players who would need signing.
    const buyablePlayers = useMemo(
        () => marketPlayers.filter((p) => !ownedIds.has(p.player_id)),
        [marketPlayers, ownedIds],
    );

    // Bench market: anyone not already owned
    const buyableBenchPlayers = useMemo(
        () => (benchMarketData?.data ?? []).filter((p) => !ownedIds.has(p.player_id)),
        [benchMarketData, ownedIds],
    );

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
            queryClient.invalidateQueries({ queryKey: ['fantasyDashboard'] });
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


    // "Move to Bench" — remove from starting slot
    const handleMoveToBench = (slot: FantasySlot) => {
        setSquad(prev => ({
            ...prev,
            [slot]: null,
        }));
        setActionSlot(null);
        toast.success('Moved to bench. Remember to save your lineup.');
    };

    // "Swap with Reserve" — open the slot's picker (owned players first)
    const handleSwapWithReserve = (slot: FantasySlot) => {
        setActionSlot(null);
        const def = SLOT_DEFINITIONS.find(d => d.slot === slot);
        if (def) setActiveModalSlot(def);
    };

    // "Transfer Out" — sell the player, then open market for replacement
    const handleTransferOut = (slot: FantasySlot) => {
        setActionSlot(null);
        const player = squad[slot];
        if (!player || !mySquad) return;

        // Find the squad player entry for sell confirmation
        const squadPlayer = mySquad.players.find(p => p.player_id === player.player_id);
        if (!squadPlayer) {
            toast.error('Could not find this player in your squad.');
            return;
        }

        // Remove from local lineup state immediately
        setSquad(prev => ({ ...prev, [slot]: null }));

        // Set the pending transfer out slot so the market opens after sell
        const def = SLOT_DEFINITIONS.find(d => d.slot === slot);
        if (def) setPendingTransferOutSlot(def);

        setConfirmSell(squadPlayer);
    };

    // "Start" — promote a bench reserve into an open matching slot
    const handleStartReserve = (reservePlayer: SquadPlayer) => {
        // Find the first empty slot that matches position & gender
        const matchingSlot = SLOT_DEFINITIONS.find(def => {
            if (squad[def.slot] !== null) return false; // Already filled
            if (!def.allowedPositions.includes(reservePlayer.position)) return false;
            if (def.requiredGender && !reservePlayer.gender.toUpperCase().startsWith(def.requiredGender)) return false;
            return true;
        });

        if (!matchingSlot) {
            toast.error('No open slot matches this player\'s position. Remove a starter first.');
            return;
        }

        setSquad(prev => ({
            ...prev,
            [matchingSlot.slot]: {
                player_id: reservePlayer.player_id,
                player_name: reservePlayer.name,
                player_image: '',
                position: reservePlayer.position,
                gender: reservePlayer.gender,
                team_id: reservePlayer.club_id,
                team_name: '',
                team_short_name: '',
                team_logo: '',
                price: reservePlayer.purchase_price,
                rating: 0,
                total_points: 0,
                owned_by: 0,
                selected_by_pct: 0,
                transfers_in: 0,
                transfers_out: 0,
            },
        }));
        toast.success(`${reservePlayer.name} promoted to ${matchingSlot.label}.`);
    };

    // Market closed detection
    const marketClosed = mySquad && !mySquad.market_open
        ? mySquad.market_closed_reason || 'The transfer market is closed while a match day is being played.'
        : undefined;

    if (authLoading || seasonLoading || gwLoading || lineupLoading || enteredLoading) {
        return <Loader />;
    }

    // Building a squad without having joined would only fail at save time,
    // after picking all 14 players. Say so up front instead.
    if (hasJoined === false) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
                    <ExclamationCircleIcon className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-black uppercase text-sffl-navy dark:text-white mb-2">Join The Season First</h1>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
                    You need to join this season before you can pick a squad. It only takes a team name.
                </p>
                <Link
                    to="/fantasy"
                    className="px-6 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-sm shadow-md transition-all active:scale-95"
                >
                    Go To The Season
                </Link>
            </div>
        );
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

    // Filter slots for unit tab
    const displayedSlots = SLOT_DEFINITIONS.filter(def => {
        if (selectedUnitTab === 'ALL') return true;
        return def.unit === selectedUnitTab;
    });


    // Signing from the picker puts them in the squad, then straight into the
    // slot the manager opened — one action, not two.
    const buyAndSelect = async (p: FantasyPlayerListItem) => {
        try {
            await buyMutation.mutateAsync(p.player_id);
            handleSelectPlayer(p);
        } catch {
            // The mutation already surfaced the reason.
        }
    };

    // Signing for the bench (no slot assignment)
    const buyForBench = async (playerId: string) => {
        try {
            await buyMutation.mutateAsync(playerId);
            setShowBenchMarket(false);
            setMarketSearch('');
        } catch {
            // The mutation already surfaced the reason.
        }
    };

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
                        <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase mt-2">
                            My Team &amp; Transfers
                        </h1>
                        <p className="text-gray-300 mt-1 text-xs md:text-sm font-medium">
                            Manage your starting 14, bench depth, and transfer market signings in one place.
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                            <label htmlFor="team-name-input" className="text-[11px] font-black uppercase text-gray-300 tracking-wider cursor-pointer">
                                Team:
                            </label>
                            <input
                                id="team-name-input"
                                type="text"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                placeholder="Enter Team Name..."
                                aria-label="Team Name"
                                className="text-base sm:text-lg font-black italic bg-transparent border-b border-white/20 hover:border-white/40 focus:border-sffl-red focus:outline-none text-white tracking-tight w-full max-w-xs"
                            />
                        </div>
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

                {/* Market Closed Alert */}
                {marketClosed && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-400/15 border border-amber-400/30 p-3">
                        <LockClosedIcon className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                                Market closed
                            </p>
                            <p className="text-[11px] text-amber-100/90 mt-0.5">
                                {marketClosed} You can still rearrange your lineup, but buys and sells are paused.
                            </p>
                        </div>
                    </div>
                )}

                {/* Rollover Alert Strip */}
                {currentLineup?.is_rollover && (
                    <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 shrink-0 text-amber-300" />
                        <span><strong>Lineup Rollover Active:</strong> Loaded from your previous match day. You can save updates now, or let it accumulate points automatically!</span>
                    </div>
                )}

                {/* Financial Strip */}
                {mySquad && (
                    <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="p-4 bg-white/10 rounded-xl">
                            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">In the bank</span>
                            <span className="text-2xl md:text-3xl font-black text-yellow-400">{formatFantasyPrice(mySquad.bank)}</span>
                        </div>
                        <div className="p-4 bg-white/10 rounded-xl">
                            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">Squad value</span>
                            <span className="text-2xl md:text-3xl font-black text-emerald-400">{formatFantasyPrice(mySquad.squad_value)}</span>
                        </div>
                        <div className="p-4 bg-white/10 rounded-xl">
                            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">Starting 14</span>
                            <span className="text-2xl md:text-3xl font-black text-white">
                                {calculations.filledCount}
                                <span className="text-sm text-gray-300 font-bold"> / 14</span>
                            </span>
                        </div>
                        <div className="p-4 bg-white/10 rounded-xl">
                            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">Bench / Reserves</span>
                            <span className="text-2xl md:text-3xl font-black text-white">
                                {benchPlayers.length}
                                <span className="text-sm text-gray-300 font-bold"> / {(mySquad.squad_max || 19) - 14}</span>
                            </span>
                        </div>
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
                        <span className="font-black text-base md:text-lg">{formatFantasyPrice(calculations.remainingBudget)}</span>
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

            {/* Starting 14 Section Header & Unit Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-sffl-red" />
                        Starting 14 Lineup
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Tap an empty slot to draft an athlete, or tap a starter to swap, transfer, or bench.
                    </p>
                </div>

                {/* Unit Switcher Tabs */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm inline-flex gap-1.5 shrink-0">
                    <button
                        onClick={() => setSelectedUnitTab('ALL')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                            selectedUnitTab === 'ALL'
                                ? 'bg-sffl-navy text-white shadow-md'
                                : 'text-gray-600 dark:text-gray-300 hover:text-sffl-navy dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        Full Roster (14)
                    </button>
                    <button
                        onClick={() => setSelectedUnitTab('OFFENSE')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                            selectedUnitTab === 'OFFENSE'
                                ? 'bg-sffl-red text-white shadow-md'
                                : 'text-gray-600 dark:text-gray-300 hover:text-sffl-red hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        Offensive Unit (7)
                    </button>
                    <button
                        onClick={() => setSelectedUnitTab('DEFENSE')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                            selectedUnitTab === 'DEFENSE'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        Defensive Unit (7)
                    </button>
                </div>
            </div>

            {/* Slots Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 md:gap-4">
                {displayedSlots.map(def => {
                    const player = squad[def.slot];
                    const isActionOpen = actionSlot === def.slot;
                    return (
                        <div key={def.slot} className="relative">
                            <div
                                role="button"
                                tabIndex={0}
                                aria-label={player ? `${def.label}: ${player.player_name}` : `Draft athlete for ${def.label}`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        if (player) {
                                            setActionSlot(isActionOpen ? null : def.slot);
                                        } else {
                                            setActiveModalSlot(def);
                                        }
                                    }
                                }}
                                onClick={() => {
                                    if (player) {
                                        // Toggle action popover on occupied slots
                                        setActionSlot(isActionOpen ? null : def.slot);
                                    } else {
                                        setActiveModalSlot(def);
                                    }
                                }}
                                className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                                    player
                                        ? isActionOpen
                                            ? 'bg-white dark:bg-gray-800 border-sffl-red shadow-md ring-1 ring-sffl-red/30'
                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 shadow-sm'
                                        : 'bg-white/60 dark:bg-gray-800/40 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-sffl-red dark:hover:border-sffl-red hover:bg-white dark:hover:bg-gray-800 shadow-sm'
                                }`}
                            >
                                <div className="flex items-center gap-3.5">
                                    {player ? (
                                        <PlayerAvatar
                                            name={player.player_name}
                                            image={player.player_image}
                                            gender={player.gender}
                                            size="lg"
                                        />
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
                                                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{player.player_name}</h3>
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
                                            <span className="text-sm font-black text-sffl-red">{formatFantasyPrice(player.price)}</span>
                                        </div>
                                    )}

                                    {player ? (
                                        <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500">
                                            <ArrowsRightLeftIcon className="w-4 h-4" />
                                        </div>
                                    ) : (
                                        <ChevronRightIcon className="w-5 h-5 text-gray-400 dark:text-gray-600" />
                                    )}
                                </div>
                            </div>

                            {/* Action Popover for occupied slot */}
                            {isActionOpen && player && (
                                <div className="absolute top-full left-0 right-0 z-30 mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleSwapWithReserve(def.slot); }}
                                        className="w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer"
                                    >
                                        <ArrowsRightLeftIcon className="w-4.5 h-4.5 text-sffl-navy dark:text-white shrink-0" />
                                        <div>
                                            <span className="text-xs font-black text-gray-900 dark:text-white block">Swap with Reserve</span>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400">Replace with an eligible bench player</span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleTransferOut(def.slot); }}
                                        disabled={!!marketClosed}
                                        title={marketClosed}
                                        className="w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <ArrowUpTrayIcon className="w-4.5 h-4.5 text-sffl-red shrink-0" />
                                        <div>
                                            <span className="text-xs font-black text-sffl-red block">Transfer Out</span>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400">Sell back to market & sign replacement</span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleMoveToBench(def.slot); }}
                                        className="w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer"
                                    >
                                        <ArrowUturnDownIcon className="w-4.5 h-4.5 text-gray-600 dark:text-gray-300 shrink-0" />
                                        <div>
                                            <span className="text-xs font-black text-gray-900 dark:text-white block">Move to Bench</span>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400">Remove from starting 14 without selling</span>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                BENCH / RESERVES SECTION
            ────────────────────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                            <UsersIcon className="w-4 h-4 text-sffl-red" />
                            Substitutes & Reserves
                            <span className="text-gray-400 font-bold">({benchPlayers.length})</span>
                        </h2>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            Bench depth. Score nothing until promoted to the starting 14.
                        </p>
                    </div>
                    {mySquad && mySquad.squad_size < mySquad.squad_max && !marketClosed && (
                        <button
                            onClick={() => { setShowBenchMarket(true); setMarketSearch(''); }}
                            className="px-3.5 py-2 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                        >
                            <PlusCircleIcon className="w-3.5 h-3.5" /> Add Reserve
                        </button>
                    )}
                </div>

                {benchPlayers.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-500 dark:text-gray-400">
                        No reserves. Your squad only has the starting 14.
                        {mySquad && mySquad.squad_size < mySquad.squad_max && !marketClosed && (
                            <button
                                onClick={() => { setShowBenchMarket(true); setMarketSearch(''); }}
                                className="ml-2 text-sffl-red font-bold hover:underline cursor-pointer"
                            >
                                Sign bench depth →
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {benchPlayers.map((p) => {
                            // Can this reserve be promoted into an open matching slot?
                            const hasOpenSlot = SLOT_DEFINITIONS.some(def => {
                                if (squad[def.slot] !== null) return false;
                                if (!def.allowedPositions.includes(p.position)) return false;
                                if (def.requiredGender && !p.gender.toUpperCase().startsWith(def.requiredGender)) return false;
                                return true;
                            });

                            return (
                                <div key={p.player_id} className="p-4 flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                            {p.name}
                                            {isFemale(p.gender) && (
                                                <span className="ml-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                                    {unitOf(p.position)} quota
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                            {p.position} · {formatFantasyPrice(p.purchase_price)}
                                            {(p.current_price ?? 0) !== p.purchase_price && (
                                                <span className={(p.current_price ?? 0) > p.purchase_price
                                                    ? ' text-emerald-600 dark:text-emerald-400 font-bold'
                                                    : ' text-red-600 dark:text-red-400 font-bold'
                                                }>
                                                    {' '}· now {formatFantasyPrice(p.current_price)}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {hasOpenSlot && (
                                            <button
                                                onClick={() => handleStartReserve(p)}
                                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider transition cursor-pointer shadow-sm"
                                            >
                                                Start
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setConfirmSell(p)}
                                            disabled={!!marketClosed}
                                            title={marketClosed}
                                            className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-red-600 hover:text-white text-gray-700 dark:text-gray-200 font-black text-[10px] uppercase flex items-center gap-1 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            <MinusCircleIcon className="w-3.5 h-3.5" /> Sell {formatFantasyPrice(p.sell_price)}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                PLAYER SELECTION MODAL (For starting 14 slots)
            ────────────────────────────────────────────────────────────────── */}
            {activeModalSlot && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[calc(var(--chrome-h)+1rem)] transition-[padding] duration-300 motion-reduce:transition-none" data-dialog>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[calc(100dvh-var(--chrome-h)-2rem)] flex flex-col overflow-hidden shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-5 md:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-black text-sffl-red uppercase tracking-wider block">
                                    Selecting for {activeModalSlot.slot}
                                </span>
                                <h3 className="text-lg font-black text-sffl-navy dark:text-white">{activeModalSlot.label}</h3>
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                        {formatPositions(activeModalSlot.allowedPositions)}
                                    </span>
                                    {activeModalSlot.requiredGender && (
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${
                                            activeModalSlot.requiredGender === 'F'
                                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                                : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                                        }`}>
                                            {activeModalSlot.requiredGender === 'F' ? 'Women only' : 'Men only'}
                                        </span>
                                    )}
                                    {/* The budget belongs next to the choice it constrains, not on
                                        the page behind the dialog where it cannot be seen. */}
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                        {formatFantasyPrice(calculations.remainingBudget)} left
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveModalSlot(null)}
                                aria-label="Close modal"
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 transition cursor-pointer"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                            <div className="relative">
                                <label htmlFor="slot-player-search" className="sr-only">Search by player name</label>
                                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    id="slot-player-search"
                                    type="text"
                                    value={marketSearch}
                                    onChange={(e) => setMarketSearch(e.target.value)}
                                    placeholder="Search by player name..."
                                    aria-label="Search by player name"
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
                            ) : ownedForSlot.length === 0 && buyablePlayers.length === 0 ? (
                                <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                                    No athletes found matching the position/gender filter.
                                </div>
                            ) : (
                                <>
                                {/* Your squad first: fielding someone you already own
                                    costs nothing and is nearly always the intent. */}
                                <div className="flex items-center gap-2 pt-1 pb-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                                        In your squad
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400">{ownedForSlot.length}</span>
                                    <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                                </div>

                                {ownedForSlot.length === 0 ? (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 pb-2">
                                        Nobody in your squad can play this slot — sign someone below.
                                    </p>
                                ) : (
                                    ownedForSlot.map((p) => {
                                        const isAlreadyPicked = calculations.chosenPlayerIds.has(p.player_id);
                                        return (
                                            <div
                                                key={p.player_id}
                                                className={`px-3 py-2.5 rounded-xl border flex items-center gap-3 transition ${
                                                    isAlreadyPicked
                                                        ? 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 opacity-60'
                                                        : 'bg-white dark:bg-gray-800 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 shadow-sm'
                                                }`}
                                            >
                                                <PlayerAvatar name={p.name} image={null} gender={p.gender} />
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                        {p.name}
                                                    </h4>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                        {p.position}
                                                        {p.starting && <span className="ml-1.5 text-emerald-600 dark:text-emerald-400 font-bold">· already starting</span>}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleSelectPlayer({
                                                        player_id: p.player_id,
                                                        player_name: p.name,
                                                        player_image: '',
                                                        position: p.position,
                                                        gender: p.gender,
                                                        team_id: p.club_id,
                                                        team_name: '',
                                                        team_short_name: '',
                                                        team_logo: '',
                                                        price: p.purchase_price,
                                                        rating: 0,
                                                        total_points: 0,
                                                        owned_by: 0,
                                                        selected_by_pct: 0,
                                                        transfers_in: 0,
                                                        transfers_out: 0,
                                                    })}
                                                    disabled={isAlreadyPicked}
                                                    className={`shrink-0 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition ${
                                                        isAlreadyPicked
                                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm'
                                                    }`}
                                                >
                                                    {isAlreadyPicked ? 'Picked' : 'Field'}
                                                </button>
                                            </div>
                                        );
                                    })
                                )}

                                {/* Then the rest of the market, for a squad with a
                                    gap at this position. Signing here spends money. */}
                                <div className="flex items-center gap-2 pt-3 pb-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                                        Available to sign
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400">
                                        {mySquad ? `${mySquad.squad_size}/${mySquad.squad_max} squad · ${formatFantasyPrice(mySquad.bank)} to spend` : ''}
                                    </span>
                                    <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                                </div>

                                {buyablePlayers.map((p) => {
                                    const isAlreadyPicked = calculations.chosenPlayerIds.has(p.player_id);
                                    const clubCount = calculations.clubCounts[p.team_id] || 0;
                                    const clubExceeded = clubCount >= (season?.max_per_club || 4);
                                    // Signing spends real money out of the bank — the
                                    // lineup no longer has a budget of its own.
                                    const affordable = p.price <= (mySquad?.bank ?? 0);
                                    const squadFull = !!mySquad && mySquad.squad_size >= mySquad.squad_max;
                                    // Signing spends from the bank, so it obeys the
                                    // same closed window as the transfer market.
                                    const mktClosed = mySquad && !mySquad.market_open
                                        ? mySquad.market_closed_reason ||
                                          'The transfer market is closed while a match day is being played.'
                                        : undefined;

                                    return (
                                        <div
                                            key={p.player_id}
                                            className={`px-3 py-2.5 rounded-xl border flex items-center gap-3 transition ${
                                                isAlreadyPicked
                                                    ? 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 opacity-60'
                                                    : affordable
                                                      ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-sffl-red/60 shadow-sm'
                                                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                            }`}
                                        >
                                            <PlayerAvatar name={p.player_name} image={p.player_image} gender={p.gender} />

                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                    {p.player_name}
                                                </h4>
                                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                    {p.team_logo && (
                                                        <img src={p.team_logo} alt="" className="w-3.5 h-3.5 object-contain" />
                                                    )}
                                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                        {p.team_short_name || p.team_name || '—'}
                                                    </span>
                                                    <span className="text-gray-300 dark:text-gray-600">·</span>
                                                    <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                                                        {p.position}
                                                    </span>
                                                    <span className="text-gray-300 dark:text-gray-600">·</span>
                                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                        rated <strong className="text-gray-700 dark:text-gray-200">{(p.rating ?? 0).toFixed(1)}</strong>
                                                    </span>
                                                </div>
                                                {clubExceeded && !isAlreadyPicked && (
                                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                                                        Club limit reached ({clubCount}/{season?.max_per_club || 4})
                                                    </span>
                                                )}
                                                {!affordable && !isAlreadyPicked && (
                                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                                                        {formatFantasyPrice(p.price - (mySquad?.bank ?? 0))} more than you have in the bank
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-end shrink-0">
                                                <span className={`text-sm font-black tabular-nums ${
                                                    affordable ? 'text-gray-900 dark:text-white' : 'text-amber-600 dark:text-amber-400'
                                                }`}>
                                                    {formatFantasyPrice(p.price)}
                                                </span>
                                                {/* Signing and fielding in one action: a
                                                    manager opening this slot wants the player in
                                                    it, not merely in the squad. */}
                                                <button
                                                    onClick={() => buyAndSelect(p)}
                                                    disabled={isAlreadyPicked || !affordable || squadFull || !!mktClosed || buyMutation.isPending}
                                                    title={
                                                        mktClosed ? mktClosed
                                                            : squadFull ? `Your squad is full at ${mySquad?.squad_max}`
                                                            : !affordable ? 'Not enough in the bank'
                                                            : undefined
                                                    }
                                                    className={`mt-1 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition ${
                                                        isAlreadyPicked || !affordable || squadFull || mktClosed
                                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                            : 'bg-sffl-red hover:bg-[#A52323] text-white cursor-pointer shadow-sm'
                                                    }`}
                                                >
                                                    {isAlreadyPicked ? 'Picked' : buyMutation.isPending ? 'Signing…' : 'Sign & field'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {buyablePlayers.length === 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 py-2">
                                        Everyone available for this slot is already in your squad.
                                    </p>
                                )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ──────────────────────────────────────────────────────────────────
                BENCH MARKET MODAL (for signing reserve depth)
            ────────────────────────────────────────────────────────────────── */}
            {showBenchMarket && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[calc(var(--chrome-h)+1rem)] transition-[padding] duration-300 motion-reduce:transition-none" data-dialog>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[calc(100dvh-var(--chrome-h)-2rem)] flex flex-col overflow-hidden shadow-2xl">
                        <div className="p-5 md:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-black text-sffl-red uppercase tracking-wider block">Sign for Bench</span>
                                <h3 className="text-lg font-black text-sffl-navy dark:text-white">Add Reserve Player</h3>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 mt-1 inline-block">
                                    {formatFantasyPrice(mySquad?.bank ?? 0)} to spend · {mySquad?.squad_size ?? 0}/{mySquad?.squad_max ?? 19} squad
                                </span>
                            </div>
                            <button
                                onClick={() => { setShowBenchMarket(false); setMarketSearch(''); }}
                                aria-label="Close modal"
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 transition cursor-pointer"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                            <div className="relative">
                                <label htmlFor="bench-player-search" className="sr-only">Search for a player</label>
                                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    id="bench-player-search"
                                    type="text"
                                    value={marketSearch}
                                    onChange={(e) => setMarketSearch(e.target.value)}
                                    placeholder="Search for a player..."
                                    aria-label="Search for a player"
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {benchMarketLoading ? (
                                <div className="py-12 flex justify-center">
                                    <div className="w-8 h-8 border-2 border-sffl-red border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : buyableBenchPlayers.length === 0 ? (
                                <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                                    No players found.
                                </div>
                            ) : (
                                buyableBenchPlayers.map((p) => {
                                    const affordable = p.price <= (mySquad?.bank ?? 0);
                                    const squadFull = !!mySquad && mySquad.squad_size >= mySquad.squad_max;

                                    return (
                                        <div
                                            key={p.player_id}
                                            className={`px-3 py-2.5 rounded-xl border flex items-center gap-3 transition ${
                                                affordable
                                                    ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-sffl-red/60 shadow-sm'
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                            }`}
                                        >
                                            <PlayerAvatar name={p.player_name} image={p.player_image} gender={p.gender} />
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.player_name}</h4>
                                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                    {p.team_logo && <img src={p.team_logo} alt="" className="w-3.5 h-3.5 object-contain" />}
                                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">{p.team_short_name || p.team_name || '—'}</span>
                                                    <span className="text-gray-300 dark:text-gray-600">·</span>
                                                    <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">{p.position}</span>
                                                </div>
                                                {!affordable && (
                                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                                                        {formatFantasyPrice(p.price - (mySquad?.bank ?? 0))} more than you have
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                <span className={`text-sm font-black tabular-nums ${affordable ? 'text-gray-900 dark:text-white' : 'text-amber-600 dark:text-amber-400'}`}>
                                                    {formatFantasyPrice(p.price)}
                                                </span>
                                                <button
                                                    onClick={() => buyForBench(p.player_id)}
                                                    disabled={!affordable || squadFull || buyMutation.isPending}
                                                    className={`mt-1 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition ${
                                                        !affordable || squadFull
                                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                            : 'bg-sffl-red hover:bg-[#A52323] text-white cursor-pointer shadow-sm'
                                                    }`}
                                                >
                                                    {buyMutation.isPending ? 'Signing…' : 'Sign'}
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

            {/* ──────────────────────────────────────────────────────────────────
                SELL CONFIRMATION MODAL
            ────────────────────────────────────────────────────────────────── */}
            {confirmSell && mySquad && (
                <SellConfirmation
                    player={confirmSell}
                    squad={mySquad}
                    pending={sellMutation.isPending}
                    onCancel={() => { setConfirmSell(null); setPendingTransferOutSlot(null); }}
                    onConfirm={() => sellMutation.mutate(confirmSell.player_id)}
                />
            )}
        </div>
    );
}

// ─── Sell Confirmation Dialog ────────────────────────────────────────────────

function SellConfirmation({
    player,
    squad,
    pending,
    onCancel,
    onConfirm,
}: {
    player: SquadPlayer;
    squad: Squad;
    pending: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const female = isFemale(player.gender);
    const unit = unitOf(player.position);
    const have = unit === 'offense' ? squad.female_offense : squad.female_defense;
    const need = unit === 'offense' ? squad.rules.min_female_offense : squad.rules.min_female_defense;
    const after = have - 1;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pt-[calc(var(--chrome-h)+1rem)] transition-[padding] duration-300 motion-reduce:transition-none" data-dialog>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white w-full max-w-md rounded-2xl md:rounded-3xl p-6 shadow-2xl max-h-[calc(100dvh-var(--chrome-h)-2rem)] overflow-y-auto">
                <h3 className="text-lg font-black text-sffl-navy dark:text-white uppercase">
                    Sell {player.name}?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    You'll get <span className="font-black text-emerald-600 dark:text-emerald-400">{formatFantasyPrice(player.sell_price)}</span>{' '}
                    back in your bank, and they leave your squad straight away — including any lineup they're
                    already in.
                </p>

                {female && (
                    <div className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                        <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                            <ExclamationTriangleIcon className="w-4 h-4" /> Mind the female quota
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1.5">
                            She counts towards your <span className="font-black">{unit}</span> quota. The two
                            quotas are separate — extra women on the other unit will not cover this one.
                        </p>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className={`p-2.5 rounded-xl border ${unit === 'offense' ? 'bg-white dark:bg-gray-800 border-amber-300 dark:border-amber-700' : 'bg-amber-100/50 dark:bg-amber-900/20 border-transparent'}`}>
                                <p className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">Offense</p>
                                <p className="font-black text-gray-900 dark:text-white">
                                    {squad.female_offense} <span className="text-gray-400 font-bold">/ min {squad.rules.min_female_offense}</span>
                                </p>
                            </div>
                            <div className={`p-2.5 rounded-xl border ${unit === 'defense' ? 'bg-white dark:bg-gray-800 border-amber-300 dark:border-amber-700' : 'bg-amber-100/50 dark:bg-amber-900/20 border-transparent'}`}>
                                <p className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">Defense</p>
                                <p className="font-black text-gray-900 dark:text-white">
                                    {squad.female_defense} <span className="text-gray-400 font-bold">/ min {squad.rules.min_female_defense}</span>
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
                            Selling her leaves you <span className="font-black">{after} on {unit}</span>, against a
                            minimum of {need}.
                            {player.quota_critical && (
                                <span className="font-black">
                                    {' '}That is exactly the minimum — you won't be able to sell another woman on
                                    that unit, and you'll need to buy one back before you can.
                                </span>
                            )}
                        </p>
                    </div>
                )}

                {/* Selling is never refused, so the consequence has to be stated
                    here — this is the last point at which it can be. */}
                {player.breaks_lineup && (
                    <div className="mt-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                        <p className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-300 flex items-center gap-1.5">
                            <ExclamationTriangleIcon className="w-4 h-4" /> This breaks your team sheet
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-300 mt-1.5">
                            {squad.squad_size - 1 < squad.squad_min
                                ? `You would be down to ${squad.squad_size - 1} players. Under ${squad.squad_min} you cannot field a lineup at all, and you forfeit your points for that match day.`
                                : 'With them gone you could not put out a legal starting fourteen. You can still sell — but buy a replacement before the deadline or you forfeit the match day.'}
                        </p>
                    </div>
                )}

                <div className="flex items-center gap-2 pt-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={pending}
                        className="flex-1 py-3 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 dark:border-gray-600 font-bold text-xs uppercase disabled:opacity-50 transition cursor-pointer shadow-sm"
                    >
                        Keep {player.name.split(' ')[0]}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={pending}
                        className="flex-1 py-3 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        <BanknotesIcon className="w-4 h-4" />
                        {pending ? 'Selling…' : `Sell for ${formatFantasyPrice(player.sell_price)}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
