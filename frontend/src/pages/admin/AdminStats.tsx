import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    getCompetitions,
    getMatches,
    getAdminTeamSheet,
    upsertPlayerStat,
    getPlayerStatById,
    type Competition,
    type Match,
    type TeamSheetPlayer
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { LightboxImage } from '../../components/ui';
import { DataTable, type Column } from '../../components/ui/DataTable';

const STAT_FIELDS = [
    { key: 'passing_attempts', label: 'Pass Attempts' },
    { key: 'completed_passes', label: 'Pass Completions' },
    { key: 'passing_tds', label: 'Pass TDs' },
    { key: 'interceptions_thrown', label: 'INTs Thrown' },
    { key: 'qb_sacks', label: 'QB Sacks' },
    { key: 'rushing_attempts', label: 'Rush Attempts' },
    { key: 'rushing_tds', label: 'Rush TDs' },
    { key: 'receptions', label: 'Receptions' },
    { key: 'receiving_tds', label: 'Rec. TDs' },
    { key: 'drops', label: 'Drops' },
    { key: 'flag_pulls', label: 'Flag Pulls (Tackles)' },
    { key: 'interceptions', label: 'INTs Caught' },
    { key: 'pass_deflections', label: 'Pass Deflections' },
    { key: 'def_sacks', label: 'Defensive Sacks' },
    { key: 'defensive_tds', label: 'Defensive TDs' },
    { key: 'defensive_xp_tds', label: 'Def. XP TDs' },
    { key: 'extra_points_tds', label: 'Extra Points' },
    { key: 'safety', label: 'Safeties' },
] as const;

type StatKeys = typeof STAT_FIELDS[number]['key'];
type FormState = Record<StatKeys, string>;

const emptyForm: FormState = STAT_FIELDS.reduce((acc, field) => {
    acc[field.key] = '0';
    return acc;
}, {} as FormState);

export const AdminStats = () => {
    const [selectedComp, setSelectedComp] = useState<string>('');
    const [selectedMatch, setSelectedMatch] = useState<string>('');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');

    // Queries
    const { data: compData, isLoading: loadingComps } = useQuery({
        queryKey: ['adminCompsList'],
        queryFn: () => getCompetitions(1, 100),
    });
    const comps: Competition[] = (compData?.data || []).filter(c => c.status !== 'inactive');
    const selectedCompData = comps.find(c => c.id === selectedComp);
    const isCompleted = selectedCompData?.status === 'completed';

    const { data: matchesData, isLoading: loadingMatches } = useQuery({
        queryKey: ['adminMatchesForStats', selectedComp],
        queryFn: () => getMatches(selectedComp, 1, 100),
        enabled: !!selectedComp,
    });
    const matches: Match[] = matchesData?.data || [];
    const activeMatch = matches.find(m => m.id === selectedMatch);

    const { data: teamSheetData, isLoading: loadingTeamSheet } = useQuery({
        queryKey: ['adminTeamSheet', selectedMatch],
        queryFn: () => getAdminTeamSheet(selectedMatch),
        enabled: !!selectedMatch,
    });

    // Auto-select latest competition
    useEffect(() => {
        if (comps.length > 0 && !selectedComp) {
            setSelectedComp(comps[0].id);
        }
    }, [comps, selectedComp]);

    // Auto-select first match when matches load
    useEffect(() => {
        if (matches.length > 0 && (!selectedMatch || !matches.find(m => m.id === selectedMatch))) {
            setSelectedMatch(matches[0].id);
        } else if (matches.length === 0) {
            setSelectedMatch('');
        }
    }, [matches, selectedMatch]);

    // Auto-select Home Team when Match loads
    useEffect(() => {
        if (activeMatch && (!selectedTeamId || (selectedTeamId !== activeMatch.home_team.id && selectedTeamId !== activeMatch.away_team.id))) {
            setSelectedTeamId(activeMatch.home_team.id);
        }
    }, [activeMatch, selectedTeamId]);

    let players: TeamSheetPlayer[] = [];
    if (teamSheetData && activeMatch) {
        if (selectedTeamId === activeMatch.home_team.id) {
            players = teamSheetData.home_team;
        } else if (selectedTeamId === activeMatch.away_team.id) {
            players = teamSheetData.away_team;
        }
    }

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [activePlayer, setActivePlayer] = useState<TeamSheetPlayer | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [loadingExisting, setLoadingExisting] = useState(false);

    const openStatsModal = async (p: TeamSheetPlayer) => {
        if (!selectedComp || !selectedMatch) {
            toast.error('Please select a Competition and Match first');
            return;
        }
        setActivePlayer(p);
        setLoadingExisting(true);
        setShowModal(true);

        try {
            const existing = await getPlayerStatById(p.player_id, selectedComp, undefined, selectedMatch);

            if (existing) {
                const loadedForm: any = { ...emptyForm };
                STAT_FIELDS.forEach(f => {
                    loadedForm[f.key] = String((existing as any)[f.key] || 0);
                });
                setForm(loadedForm);
                toast.success('Existing stats loaded for editing');
            } else {
                setForm(emptyForm);
            }
        } catch (err) {
            console.error('Failed to fetch existing stats:', err);
            setForm(emptyForm);
        } finally {
            setLoadingExisting(false);
        }
    };

    const handleSave = async () => {
        if (!activePlayer || !selectedComp || !selectedMatch || !activeMatch) return;
        setSaving(true);
        try {
            const payload: any = {
                player_id: activePlayer.player_id,
                team_id: selectedTeamId,
                competition_id: selectedComp,
                match_id: selectedMatch,
                match_date: activeMatch.date.split('T')[0],
            };

            STAT_FIELDS.forEach(f => {
                payload[f.key] = parseInt(form[f.key]) || 0;
            });

            await upsertPlayerStat(payload as any);
            toast.success('Stats recorded successfully!');
            setShowModal(false);
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save stats');
        }
        setSaving(false);
    };

    const columns: Column<TeamSheetPlayer>[] = [
        { header: '#', accessor: 'jersey_number', sortable: true, className: "px-4 py-3 font-bold text-sm dark:text-gray-300 w-16" },
        {
            header: 'Player',
            sortable: true,
            sortValue: (p) => p.name,
            cell: (p) => (
                <div className="flex items-center gap-3">
                    {p.image ? (
                        <LightboxImage
                            src={p.image}
                            alt={p.name}
                            thumbnailClassName="w-8 h-8 rounded-full shadow-sm border border-gray-100 dark:border-gray-700"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500">#{p.jersey_number}</div>
                    )}
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{p.name}</span>
                </div>
            )
        },
        {
            header: 'Position',
            accessor: 'position',
            sortable: true,
            cell: (p) => <span className="px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded-full text-xs font-bold dark:text-gray-300">{p.position || 'N/A'}</span>
        },
        {
            header: 'Actions',
            className: "px-4 py-3 text-right space-x-2 w-32",
            cell: (p) => (
                <button
                    onClick={() => openStatsModal(p)}
                    disabled={isCompleted}
                    className="px-3 py-1.5 bg-sffl-navy text-white font-bold text-xs rounded-lg shadow-sm hover:shadow-md hover:bg-sffl-navy-light transition-all duration-300 hover:scale-[1.02] active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isCompleted ? 'Locked' : 'Edit Stats'}
                </button>
            )
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Stats Entry</h1>
                    <p className="text-gray-500 text-sm mt-1">Select match context to record player stats</p>
                </div>
            </div>

            {/* Context Selectors */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Competition *</label>
                    <select
                        value={selectedComp}
                        onChange={e => setSelectedComp(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        {comps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Match *</label>
                    <select
                        value={selectedMatch}
                        onChange={e => setSelectedMatch(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        disabled={loadingMatches || matches.length === 0}
                    >
                        {matches.length === 0 && <option value="">No matches found</option>}
                        {matches.map(m => (
                            <option key={m.id} value={m.id}>
                                {m.date.split('T')[0]} : {m.home_team.short_name?.toUpperCase()} vs {m.away_team.short_name?.toUpperCase()}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Team Filter</label>
                    <select
                        value={selectedTeamId}
                        onChange={e => setSelectedTeamId(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        disabled={!activeMatch}
                    >
                        {activeMatch ? (
                            <>
                                <option value={activeMatch.home_team.id}>{activeMatch.home_team.name}</option>
                                <option value={activeMatch.away_team.id}>{activeMatch.away_team.name}</option>
                            </>
                        ) : (
                            <option value="">Select a match first</option>
                        )}
                    </select>
                </div>
            </div>

            {isCompleted && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4 flex items-center gap-3 text-amber-800 dark:text-amber-400 font-bold text-sm">
                    <span>🔒</span>
                    <span>Season Completed. Stats are locked and cannot be modified.</span>
                </div>
            )}

            {(loadingComps || loadingMatches || loadingTeamSheet) ? (
                <Loader />
            ) : !selectedMatch ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-gray-500 font-semibold">Please select a Match to view players.</p>
                </div>
            ) : players.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-gray-500 font-semibold">No players found on the team sheet for this team. Please add them via Match Management.</p>
                </div>
            ) : (
                <DataTable
                    data={players}
                    columns={columns}
                    searchable={true}
                    searchPlaceholder="Search players..."
                    itemsPerPage={20}
                />
            )}

            {/* Stats Entry Modal */}
            {showModal && activePlayer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center z-10">
                            <div>
                                <h2 className="text-2xl font-black text-sffl-navy dark:text-white">Record Stats</h2>
                                <p className="text-gray-500 text-sm mt-1">
                                    <span className="font-bold text-sffl-red">{activePlayer.name}</span> • {activeMatch?.date.split('T')[0]}
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 relative">
                            {loadingExisting && (
                                <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-[1px] flex items-center justify-center z-20">
                                    <Loader />
                                </div>
                            )}

                            <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 p-4 rounded-xl mb-6 text-sm font-medium border border-blue-100 dark:border-blue-800">
                                ℹ️ Update the stats for this player. <b>Saving will add to existing stats</b> for this specific match.
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {STAT_FIELDS.map(field => (
                                    <div key={field.key} className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{field.label}</label>
                                        <input
                                            type="number"
                                            value={form[field.key]}
                                            onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 font-bold text-center text-sffl-navy dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-transparent outline-none transition-all"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800/90 backdrop-blur-md p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 rounded-b-2xl z-10">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all min-h-[44px]">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-8 py-2 bg-sffl-navy hover:bg-sffl-navy-light text-white font-black uppercase tracking-wider text-sm rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 min-h-[44px] disabled:opacity-50 flex items-center gap-2">
                                {saving ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Saving...</>
                                ) : 'Update Stats'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
