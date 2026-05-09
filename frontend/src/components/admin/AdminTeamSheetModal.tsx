import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    getAdminTeamSheet, getPlayers, saveTeamSheet,
    createPlayer, updatePlayer,
    type Match, type Player, type TeamSheetPlayer,
} from '../../services/api';
import { Loader } from '../ui/Loader';

interface AdminTeamSheetModalProps {
    match: Match;
    onClose: () => void;
}

interface QuickAddForm {
    name: string;
    position: string;
    jersey_number: string;
}

const POSITIONS = ['QB', 'WR', 'RB', 'C', 'LB', 'CB', 'S', 'DE', 'K', 'Flex'];

const emptyQuickAdd: QuickAddForm = { name: '', position: '', jersey_number: '' };

export const AdminTeamSheetModal = ({ match, onClose }: AdminTeamSheetModalProps) => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'home' | 'away'>('home');
    const [selectedHomePlayers, setSelectedHomePlayers] = useState<string[]>([]);
    const [selectedAwayPlayers, setSelectedAwayPlayers] = useState<string[]>([]);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Quick-add inline form
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickAdd, setQuickAdd] = useState<QuickAddForm>(emptyQuickAdd);

    // Team-change confirmation
    const [pendingPlayer, setPendingPlayer] = useState<Player | null>(null);

    // ── Existing team sheet ──────────────────────────────────────────────────
    const { data: teamSheet, isLoading: loadingSheet } = useQuery({
        queryKey: ['adminTeamSheet', match.id],
        queryFn: () => getAdminTeamSheet(match.id),
    });

    useEffect(() => {
        if (teamSheet) {
            setSelectedHomePlayers(teamSheet.home_team.map(p => p.player_id));
            setSelectedAwayPlayers(teamSheet.away_team.map(p => p.player_id));
        }
    }, [teamSheet]);

    // ── Search across ALL players ───────────────────────────────────────────
    const { data: searchResults, isLoading: searching } = useQuery({
        queryKey: ['playerSearch', searchQuery],
        queryFn: () => getPlayers(undefined, 1, 15, searchQuery),
        enabled: searchQuery.trim().length >= 2,
    });
    const foundPlayers = searchResults?.data || [];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    // ── Roster state helpers ─────────────────────────────────────────────────
    const activeTeamId = activeTab === 'home' ? match.home_team?.id : match.away_team?.id;
    const activeSelected = activeTab === 'home' ? selectedHomePlayers : selectedAwayPlayers;

    // Players currently on the active team (for the bottom checklist)
    const { data: activeTeamPlayersData } = useQuery({
        queryKey: ['players', activeTeamId],
        queryFn: () => getPlayers(activeTeamId, 1, 200),
        enabled: !!activeTeamId,
    });
    const activeTeamPlayers: Player[] = activeTeamPlayersData?.data || [];

    const addToSelected = useCallback((id: string) => {
        if (activeTab === 'home') {
            setSelectedHomePlayers(prev => prev.includes(id) ? prev : [...prev, id]);
        } else {
            setSelectedAwayPlayers(prev => prev.includes(id) ? prev : [...prev, id]);
        }
    }, [activeTab]);

    const togglePlayer = (id: string) => {
        if (activeTab === 'home') {
            setSelectedHomePlayers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
        } else {
            setSelectedAwayPlayers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
        }
    };

    // ── Create player mutation ───────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: async (form: QuickAddForm) => {
            const res = await createPlayer({
                name: form.name.trim(),
                position: form.position,
                jersey_number: form.jersey_number ? parseInt(form.jersey_number) : undefined,
                team_id: activeTeamId!,
                email: '',
            });
            return res;
        },
        onSuccess: (res) => {
            const newId = res.id;
            toast.success(`Player created and added to roster`);
            queryClient.invalidateQueries({ queryKey: ['players', activeTeamId] });
            addToSelected(newId);
            setShowQuickAdd(false);
            setQuickAdd(emptyQuickAdd);
            setSearchQuery('');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to create player');
        },
    });

    // ── Reassign team mutation ───────────────────────────────────────────────
    const reassignMutation = useMutation({
        mutationFn: async (player: Player) =>
            updatePlayer(player.id, { team_id: activeTeamId, name: player.name }),
        onSuccess: (_, player) => {
            toast.success(`${player.name} moved to ${activeTab === 'home' ? match.home_team?.name : match.away_team?.name}`);
            queryClient.invalidateQueries({ queryKey: ['players'] });
            addToSelected(player.id);
            setPendingPlayer(null);
            setSearchQuery('');
            setShowDropdown(false);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to reassign team');
        },
    });

    // ── Handle search result click ───────────────────────────────────────────
    const handleSelectFromSearch = (player: Player) => {
        setShowDropdown(false);
        // Already on the right team — just add
        if (player.team?.id === activeTeamId) {
            addToSelected(player.id);
            setSearchQuery('');
            return;
        }
        // Different team — ask to reassign
        setPendingPlayer(player);
    };

    // ── Save BOTH team sheets in one shot ───────────────────────────────────
    const saveBothMutation = useMutation({
        mutationFn: async () => {
            const homeTeamId = match.home_team?.id;
            const awayTeamId = match.away_team?.id;
            if (!homeTeamId || !awayTeamId) throw new Error('Team IDs not found');
            await Promise.all([
                saveTeamSheet(match.id, { team_id: homeTeamId, player_ids: selectedHomePlayers }),
                saveTeamSheet(match.id, { team_id: awayTeamId, player_ids: selectedAwayPlayers }),
            ]);
        },
        onSuccess: () => {
            toast.success('Both team sheets saved!');
            queryClient.invalidateQueries({ queryKey: ['adminTeamSheet', match.id] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to save');
        },
    });

    const selectedCount = activeSelected.length;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-sffl-navy dark:text-white">Team Sheet</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {match.home_team?.short_name} vs {match.away_team?.short_name} · {match.date?.split('T')[0]}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-1">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    {(['home', 'away'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSearchQuery(''); setShowQuickAdd(false); setShowDropdown(false); }}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === tab ? 'border-sffl-red text-sffl-red' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            {tab === 'home' ? match.home_team?.name : match.away_team?.name}
                        </button>
                    ))}
                </div>

                <div className="p-5 overflow-y-auto flex-1 space-y-5">
                    {loadingSheet ? <div className="py-8"><Loader /></div> : (
                        <>
                            {/* ── Search / Add Player ── */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                                    Add Player to Roster
                                </label>
                                <div ref={searchRef} className="relative">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); setShowQuickAdd(false); }}
                                        onFocus={() => searchQuery.length >= 2 && setShowDropdown(true)}
                                        placeholder="Search by player name…"
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-transparent outline-none"
                                    />

                                    {/* Search Dropdown */}
                                    {showDropdown && searchQuery.trim().length >= 2 && (
                                        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                                            {searching ? (
                                                <div className="p-3 text-center text-xs text-gray-500">Searching…</div>
                                            ) : foundPlayers.length > 0 ? (
                                                <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-52 overflow-y-auto">
                                                    {foundPlayers.map(p => (
                                                        <li key={p.id}>
                                                            <button
                                                                onClick={() => handleSelectFromSearch(p)}
                                                                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                                                            >
                                                                <div className="font-semibold text-sm text-gray-900 dark:text-white flex justify-between items-center">
                                                                    <span>{p.name} <span className="text-gray-400 font-normal">#{p.jersey_number}</span></span>
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.team?.id === activeTeamId ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                                                                        {p.team?.name || 'No Team'}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-0.5">{p.position}</div>
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="p-4 text-center">
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No player found for "{searchQuery}"</p>
                                                    <button
                                                        onClick={() => { setShowQuickAdd(true); setShowDropdown(false); setQuickAdd({ ...emptyQuickAdd, name: searchQuery }); }}
                                                        className="text-sm font-bold text-sffl-red hover:underline"
                                                    >
                                                        + Create new player
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Quick-add form */}
                                {showQuickAdd && (
                                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/40 space-y-3">
                                        <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">New Player — Quick Add</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input
                                                type="text"
                                                value={quickAdd.name}
                                                onChange={e => setQuickAdd(f => ({ ...f, name: e.target.value }))}
                                                placeholder="Full name *"
                                                className="col-span-3 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none"
                                            />
                                            <select
                                                value={quickAdd.position}
                                                onChange={e => setQuickAdd(f => ({ ...f, position: e.target.value }))}
                                                className="col-span-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none"
                                            >
                                                <option value="">Position *</option>
                                                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                                            </select>
                                            <input
                                                type="number"
                                                value={quickAdd.jersey_number}
                                                onChange={e => setQuickAdd(f => ({ ...f, jersey_number: e.target.value }))}
                                                placeholder="# Jersey"
                                                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none"
                                            />
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={() => { setShowQuickAdd(false); setSearchQuery(''); }}
                                                className="px-3 py-1.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (!quickAdd.name.trim()) return toast.error('Name is required');
                                                    if (!quickAdd.position) return toast.error('Position is required');
                                                    createMutation.mutate(quickAdd);
                                                }}
                                                disabled={createMutation.isPending}
                                                className="px-4 py-1.5 text-sm font-bold bg-sffl-navy text-white rounded-lg hover:bg-sffl-navy-light transition-colors disabled:opacity-50"
                                            >
                                                {createMutation.isPending ? 'Creating…' : 'Create & Add'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Currently selected chips ── */}
                            {activeSelected.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                                        On Sheet ({selectedCount})
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {activeSelected.map(pid => {
                                            const p = activeTeamPlayers.find(pl => pl.id === pid) ||
                                                (teamSheet?.home_team.find(p => p.player_id === pid) || teamSheet?.away_team.find(p => p.player_id === pid)) as TeamSheetPlayer | undefined;
                                            const name = (p as any)?.name || pid.slice(0, 8);
                                            return (
                                                <span key={pid} className="inline-flex items-center gap-1 bg-sffl-navy/10 dark:bg-sffl-navy/30 text-sffl-navy dark:text-white text-xs font-bold px-3 py-1.5 rounded-full">
                                                    {name}
                                                    <button onClick={() => togglePlayer(pid)} className="ml-1 text-gray-400 hover:text-red-500">×</button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── Team roster checklist ── */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                                    {activeTab === 'home' ? match.home_team?.name : match.away_team?.name} Roster
                                </label>
                                {activeTeamPlayers.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No players registered for this team yet.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {activeTeamPlayers.map(player => (
                                            <label key={player.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={activeSelected.includes(player.id)}
                                                    onChange={() => togglePlayer(player.id)}
                                                    className="w-4 h-4 text-sffl-red rounded border-gray-300 focus:ring-sffl-red dark:border-gray-600"
                                                />
                                                <div className="flex-1 font-semibold text-sm text-gray-800 dark:text-gray-200">
                                                    {player.name}
                                                </div>
                                                <span className="text-xs text-gray-400 font-semibold">#{player.jersey_number} · {player.position}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold space-y-0.5">
                        <div>🏠 Home: {selectedHomePlayers.length} player{selectedHomePlayers.length !== 1 ? 's' : ''}</div>
                        <div>✈️ Away: {selectedAwayPlayers.length} player{selectedAwayPlayers.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 min-h-[40px] border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-all">Close</button>
                        <button
                            onClick={() => saveBothMutation.mutate()}
                            disabled={saveBothMutation.isPending || loadingSheet}
                            className="px-5 py-2 min-h-[40px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:bg-red-700 transition-all disabled:opacity-50"
                        >
                            {saveBothMutation.isPending ? 'Saving…' : 'Save Both Sheets'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Team Reassignment Confirmation Modal ── */}
            {pendingPlayer && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                        <h3 className="text-lg font-black text-sffl-navy dark:text-white mb-2">Move Player?</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            <strong className="text-gray-900 dark:text-white">{pendingPlayer.name}</strong> is currently on{' '}
                            <strong className="text-sffl-red">{pendingPlayer.team?.name || 'another team'}</strong>.
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
                            Moving them to <strong className="text-gray-900 dark:text-white">{activeTab === 'home' ? match.home_team?.name : match.away_team?.name}</strong> will update their team in the database. This is fine for historical data entry.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPendingPlayer(null)}
                                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => reassignMutation.mutate(pendingPlayer)}
                                disabled={reassignMutation.isPending}
                                className="flex-1 px-4 py-2.5 bg-sffl-red text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {reassignMutation.isPending ? 'Moving…' : 'Yes, Move & Add'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
