import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    getCompetitions,
    getMatchDays,
    getEligiblePlayersForMatchDay,
    getTOTW,
    createTOTWEntry,
    deleteTOTWEntry,
    type Player,
    type Competition,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { LightboxImage } from '../../components/ui';
import { TrashIcon, StarIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const POSITION_GROUPS = [
    { id: 'QB', label: 'Quarterback', color: 'blue' },
    { id: 'WR', label: 'Wide Receiver / Offense', color: 'green' },
    { id: 'DEF', label: 'Defense', color: 'red' },
] as const;

type PositionGroup = 'QB' | 'WR' | 'DEF';

export const AdminTOTW = () => {
    const queryClient = useQueryClient();

    const savedComp = localStorage.getItem('admin_totw_comp') || '';
    const savedDate = localStorage.getItem('admin_totw_date') || '';

    const [selectedComp, setSelectedComp] = useState<string>(savedComp);
    const [selectedDate, setSelectedDate] = useState<string>(savedDate);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPositionGroup, setSelectedPositionGroup] = useState<PositionGroup>('QB');

    // ── Competitions ──────────────────────────────────────────────────────────
    const { data: compData, isLoading: loadingComps } = useQuery({
        queryKey: ['adminCompsList'],
        queryFn: () => getCompetitions(1, 100, 'active'),
    });
    const comps: Competition[] = compData?.data || [];

    // ── Match Days (from actual match records) ────────────────────────────────
    const { data: matchDays = [], isLoading: loadingDays } = useQuery({
        queryKey: ['adminMatchDays', selectedComp],
        queryFn: () => getMatchDays(selectedComp),
        enabled: !!selectedComp,
    });

    // ── Current TOTW entries for selected comp + date ─────────────────────────
    const { data: totwData, isLoading: loadingTOTW } = useQuery({
        queryKey: ['adminTOTW', selectedComp, selectedDate],
        queryFn: () => getTOTW(selectedComp, selectedDate),
        enabled: !!selectedComp && !!selectedDate,
    });
    const totwEntries = totwData || [];

    // ── Eligible players for the selected match day ───────────────────────────
    const { data: eligiblePlayers = [], isLoading: loadingEligible } = useQuery({
        queryKey: ['eligiblePlayers', selectedComp, selectedDate],
        queryFn: () => getEligiblePlayersForMatchDay(selectedComp, selectedDate),
        enabled: !!selectedComp && !!selectedDate,
    });

    // Client-side filter on eligible players
    const filteredPlayers = useMemo(() => {
        if (!searchQuery) return eligiblePlayers;
        const q = searchQuery.toLowerCase();
        return eligiblePlayers.filter(
            p =>
                p.name.toLowerCase().includes(q) ||
                p.team?.name?.toLowerCase().includes(q) ||
                p.team?.short_name?.toLowerCase().includes(q)
        );
    }, [eligiblePlayers, searchQuery]);

    // ── Auto-select defaults ──────────────────────────────────────────────────
    useEffect(() => {
        if (comps.length > 0 && !selectedComp) {
            setSelectedComp(comps[0].id);
        }
    }, [comps, selectedComp]);

    useEffect(() => {
        if (selectedComp) localStorage.setItem('admin_totw_comp', selectedComp);
    }, [selectedComp]);

    useEffect(() => {
        if (selectedDate) localStorage.setItem('admin_totw_date', selectedDate);
    }, [selectedDate]);

    useEffect(() => {
        if (matchDays.length > 0) {
            if (!selectedDate || !matchDays.includes(selectedDate)) {
                setSelectedDate(matchDays[0]);
            }
        }
    }, [matchDays, selectedDate]);

    // Reset search when date/comp changes
    useEffect(() => {
        setSearchQuery('');
    }, [selectedComp, selectedDate]);

    // ── Mutations ─────────────────────────────────────────────────────────────
    const addMutation = useMutation({
        mutationFn: (player: Player) =>
            createTOTWEntry({
                competition_id: selectedComp,
                event_day_date: selectedDate,
                player_id: player.id,
                position_group: selectedPositionGroup,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminTOTW', selectedComp, selectedDate] });
            toast.success('Player added to TOTW');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to add player');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteTOTWEntry(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminTOTW', selectedComp, selectedDate] });
            toast.success('Player removed from TOTW');
        },
        onError: () => {
            toast.error('Failed to remove player');
        },
    });

    const handleAddPlayer = (player: Player) => {
        if (totwEntries.some(e => e.player_id === player.id)) {
            toast.error('Player is already in TOTW for this date');
            return;
        }
        addMutation.mutate(player);
    };

    const isPlayerInTOTW = (playerId: string) => totwEntries.some(e => e.player_id === playerId);

    if (loadingComps) return <Loader />;

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white flex items-center gap-2">
                        <StarIcon className="w-8 h-8 text-yellow-500" />
                        Team of the Week Manager
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Select a match day to curate top performers from verified rosters
                    </p>
                </div>
                {selectedComp && selectedDate && (
                    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2">
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-black text-green-700 dark:text-green-400 uppercase tracking-wider">
                            {eligiblePlayers.length} eligible players for this day
                        </span>
                    </div>
                )}
            </div>

            {/* Context Selectors */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                        Competition
                    </label>
                    <select
                        value={selectedComp}
                        onChange={e => { setSelectedComp(e.target.value); setSelectedDate(''); }}
                        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none transition-all"
                    >
                        {comps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                        Match Day
                        <span className="ml-2 text-[10px] font-medium text-blue-500 normal-case tracking-normal">
                            (sourced from actual match records)
                        </span>
                    </label>
                    {loadingDays ? (
                        <div className="h-11 flex items-center px-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                            <div className="w-4 h-4 border-2 border-sffl-red border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <select
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none transition-all"
                            disabled={matchDays.length === 0}
                        >
                            {matchDays.length === 0 && (
                                <option value="">No match days found — ensure matches have team sheets</option>
                            )}
                            {matchDays.map(date => (
                                <option key={date} value={date}>
                                    {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                                        weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
                                    })}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {selectedComp && selectedDate ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* TOTW Display — Current Selections */}
                    <div className="lg:col-span-2 space-y-8">
                        {POSITION_GROUPS.map(group => {
                            const groupEntries = totwEntries.filter(e => e.position_group === group.id);

                            return (
                                <div key={group.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                                    <div className={`bg-${group.color}-600 p-4 flex items-center justify-between`}>
                                        <h3 className="text-white font-black italic uppercase tracking-tighter text-lg">
                                            {group.label}
                                        </h3>
                                        <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black text-white">
                                            {groupEntries.length} Players
                                        </span>
                                    </div>

                                    <div className="p-4">
                                        {loadingTOTW ? (
                                            <div className="py-8 flex justify-center"><Loader /></div>
                                        ) : groupEntries.length > 0 ? (
                                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {groupEntries.map(entry => (
                                                    <div
                                                        key={entry.id}
                                                        className="py-4 flex items-center justify-between group px-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all rounded-xl"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="relative group-hover:scale-105 transition-transform">
                                                                <LightboxImage
                                                                    src={entry.player?.image || ''}
                                                                    alt={entry.player?.name || ''}
                                                                    thumbnailClassName="w-14 h-14 rounded-2xl object-cover border-2 border-gray-100 dark:border-gray-700 shadow-sm"
                                                                />
                                                                <span className="absolute -top-2 -left-2 bg-sffl-navy text-white text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-md">
                                                                    {entry.player?.jersey_number}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <p className="font-extrabold text-sffl-navy dark:text-white uppercase tracking-tight text-base">
                                                                    {entry.player?.name}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <LightboxImage
                                                                        src={entry.player?.team?.logo || ''}
                                                                        alt={entry.player?.team?.name || ''}
                                                                        thumbnailClassName="w-5 h-5 object-contain"
                                                                    />
                                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                                        {entry.player?.team?.short_name || entry.player?.team?.name}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => deleteMutation.mutate(entry.id)}
                                                            className="p-2 text-gray-300 hover:text-sffl-red hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                            title="Remove from TOTW"
                                                        >
                                                            <TrashIcon className="w-6 h-6" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-12 text-center text-gray-400 italic text-sm">
                                                No players added to this group yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Add Player Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border-2 border-sffl-navy dark:border-sffl-red sticky top-8">
                            <h3 className="text-xl font-black text-sffl-navy dark:text-white mb-1 uppercase italic">
                                Add to TOTW
                            </h3>
                            <p className="text-xs text-gray-400 mb-4">
                                Only players with team sheets on this match day are shown.
                            </p>

                            <div className="space-y-4">
                                {/* Position Group Selector */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                        1. Select Group
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {POSITION_GROUPS.map(g => (
                                            <button
                                                key={g.id}
                                                onClick={() => setSelectedPositionGroup(g.id)}
                                                className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                                                    selectedPositionGroup === g.id
                                                        ? `bg-${g.color}-600 text-white shadow-lg scale-105`
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                }`}
                                            >
                                                {g.id}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Search / Filter */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                        2. Filter Players
                                    </label>
                                    <div className="relative">
                                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search name or team..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none transition-all shadow-inner"
                                        />
                                    </div>
                                </div>

                                {/* Eligible Players List */}
                                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {loadingEligible ? (
                                        <div className="py-4 text-center"><Loader /></div>
                                    ) : filteredPlayers.length > 0 ? (
                                        filteredPlayers.map(p => {
                                            const alreadyAdded = isPlayerInTOTW(p.id);
                                            return (
                                                <button
                                                    key={p.id}
                                                    onClick={() => handleAddPlayer(p)}
                                                    disabled={alreadyAdded}
                                                    className={`w-full p-2 flex items-center justify-between group rounded-xl border transition-all text-left ${
                                                        alreadyAdded
                                                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 opacity-70 cursor-not-allowed'
                                                            : 'bg-gray-50 dark:bg-gray-900 hover:bg-sffl-red/10 dark:hover:bg-sffl-red/20 border-transparent hover:border-sffl-red/30'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <LightboxImage
                                                            src={p.image || ''}
                                                            alt={p.name}
                                                            thumbnailClassName="w-8 h-8 rounded-full object-cover"
                                                        />
                                                        <div>
                                                            <p className="text-xs font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                                                                {p.name}
                                                            </p>
                                                            <p className="text-[8px] font-bold text-gray-500 uppercase">
                                                                {p.team?.name} {p.jersey_number ? `· #${p.jersey_number}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {alreadyAdded ? (
                                                        <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                                                    ) : (
                                                        <span className="text-[10px] font-black text-gray-300 group-hover:text-sffl-red transition-colors uppercase">
                                                            Add
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })
                                    ) : eligiblePlayers.length === 0 ? (
                                        <div className="py-8 text-center text-gray-400 text-xs italic font-medium">
                                            No team sheets found for this match day. Ensure team sheets are saved for matches on this date.
                                        </div>
                                    ) : (
                                        <div className="py-4 text-center text-gray-400 text-xs italic font-medium">
                                            No players match "{searchQuery}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-20 text-center border-4 border-dashed border-gray-100 dark:border-gray-700 shadow-inner">
                    <StarIcon className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 font-bold text-xl uppercase tracking-widest italic">
                        Select a Competition and Match Day to manage Team of the Week
                    </p>
                </div>
            )}
        </div>
    );
};
