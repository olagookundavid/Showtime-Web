import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCompetitions, getPlayerStats, getTeamStats, getStatDates, getTeams, sortCompetitionsBySeason, type Competition } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { StatsTable } from '../../components/stats/StatsTable';
import { SeasonPlayoffTabs } from '../../components/common/SeasonPlayoffTabs';
import { useSearchParams } from 'react-router-dom';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

export const StatsPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlComp = searchParams.get('comp');
    const urlDate = searchParams.get('date');
    const urlPlayerId = searchParams.get('player_id');
    const urlSearch = searchParams.get('search');
    const urlTeam = searchParams.get('team');
    const urlTab = searchParams.get('tab');
    const urlPos = searchParams.get('pos');

    const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>(() => {
        return urlComp || sessionStorage.getItem('sffl_stats_comp') || '';
    });
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        return urlDate || sessionStorage.getItem('sffl_stats_date') || '';
    });
    const [searchQuery, setSearchQuery] = useState(() => {
        return urlSearch || sessionStorage.getItem('sffl_stats_search') || '';
    });
    const [positionFilter, setPositionFilter] = useState<string>(() => {
        return urlPos || 'QB';
    });
    const [activeTab, setActiveTab] = useState<'players' | 'teams'>(() => {
        const storedTab = sessionStorage.getItem('sffl_stats_tab');
        if (urlTab === 'teams' || urlTab === 'players') return urlTab;
        if (storedTab === 'teams' || storedTab === 'players') return storedTab;
        return 'players';
    });
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState('');
    const [showLegend, setShowLegend] = useState(false);
    const limit = 20;

    const handleSortChange = (key: string) => {
        setSortBy(key);
        setPage(1);
    };

    const handleTabChange = (tab: 'players' | 'teams') => {
        setActiveTab(tab);
        setSortBy('');
        setPage(1);
        const params = new URLSearchParams(searchParams);
        params.set('tab', tab);
        setSearchParams(params, { replace: true });
    };

    // Persist filters to sessionStorage on change
    useEffect(() => {
        sessionStorage.setItem('sffl_stats_comp', selectedCompetitionId);
    }, [selectedCompetitionId]);

    useEffect(() => {
        sessionStorage.setItem('sffl_stats_date', selectedDate);
    }, [selectedDate]);

    useEffect(() => {
        sessionStorage.setItem('sffl_stats_search', searchQuery);
    }, [searchQuery]);

    useEffect(() => {
        sessionStorage.setItem('sffl_stats_tab', activeTab);
    }, [activeTab]);

    // Sync state with URL params when they change (e.g. back button / direct navigation)
    useEffect(() => {
        if (urlComp && urlComp !== selectedCompetitionId) setSelectedCompetitionId(urlComp);
        if (urlDate !== null && urlDate !== selectedDate) setSelectedDate(urlDate);
        if (urlSearch !== null && urlSearch !== searchQuery) setSearchQuery(urlSearch);
        if (urlPos !== null && urlPos !== positionFilter) setPositionFilter(urlPos || 'QB');
        
        const targetTab = urlTab === 'teams' ? 'teams' : 'players';
        if (urlTab && targetTab !== activeTab) {
            setActiveTab(targetTab);
        }
    }, [urlComp, urlDate, urlSearch, urlTab, urlPos]);

    // Sync restored/default state back to URL parameters if they are missing
    useEffect(() => {
        const params = new URLSearchParams(searchParams);
        let updated = false;

        if (selectedCompetitionId && !params.has('comp')) {
            params.set('comp', selectedCompetitionId);
            updated = true;
        }
        if (selectedDate && !params.has('date')) {
            params.set('date', selectedDate);
            updated = true;
        }
        if (searchQuery && !params.has('search')) {
            params.set('search', searchQuery);
            updated = true;
        }
        if (positionFilter && !params.has('pos')) {
            params.set('pos', positionFilter);
            updated = true;
        }
        if (activeTab && !params.has('tab')) {
            params.set('tab', activeTab);
            updated = true;
        }

        if (updated) {
            setSearchParams(params, { replace: true });
        }
    }, [selectedCompetitionId, selectedDate, searchQuery, positionFilter, activeTab, searchParams, setSearchParams]);

    const { data: competitionsData, isLoading: compLoading } = useQuery({
        queryKey: ['publicCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions = sortCompetitionsBySeason(
        (competitionsData?.data || []).filter(c => c.status !== 'inactive')
    );
    const leagueComps = competitions.filter(c => c.format !== 'KNOCKOUT');
    const selectedComp = competitions.find(c => c.id === selectedCompetitionId);

    const isCurrentPlayoff = selectedComp?.format === 'KNOCKOUT';
    const dropdownComps = isCurrentPlayoff
        ? competitions.filter(c => c.format === 'KNOCKOUT')
        : leagueComps;

    const handleCompChange = (compId: string) => {
        setSelectedCompetitionId(compId);
        setSelectedDate('');
        const params = new URLSearchParams(searchParams);
        if (compId) params.set('comp', compId);
        else params.delete('comp');
        params.delete('date');
        setSearchParams(params, { replace: true });
    };

    const { data: datesData, isLoading: datesLoading } = useQuery({
        queryKey: ['statDates', selectedCompetitionId],
        queryFn: () => getStatDates(selectedCompetitionId),
    });
    const statDates = datesData || [];

    // Default to 'All' (empty string) instead of first date
    useEffect(() => {
        if (!selectedDate && !urlDate) {
            setSelectedDate('');
        }
    }, [urlDate, selectedDate]);

    const { data: playerStatsPagination, isLoading: loadingPlayers } = useQuery({
        queryKey: ['playerStatsFiltered', selectedCompetitionId, selectedDate, page, urlPlayerId, searchQuery, sortBy, urlTeam, positionFilter],
        queryFn: () => getPlayerStats(selectedCompetitionId, selectedDate, page, limit, urlPlayerId || undefined, searchQuery || undefined, sortBy || undefined, urlTeam || undefined, positionFilter || undefined),
        enabled: activeTab === 'players',
    });

    const { data: teamStatsPagination, isLoading: loadingTeams } = useQuery({
        queryKey: ['teamStatsFiltered', selectedCompetitionId, selectedDate, page, sortBy, urlTeam],
        queryFn: () => getTeamStats(selectedCompetitionId, selectedDate, page, limit, sortBy || undefined, urlTeam || undefined),
        enabled: activeTab === 'teams',
    });

    const loading = compLoading || datesLoading || (activeTab === 'players' ? loadingPlayers : loadingTeams);

    const pagination = activeTab === 'players' ? playerStatsPagination : teamStatsPagination;
    const playerStats = playerStatsPagination?.data || [];
    const teamStats = teamStatsPagination?.data || [];
    const totalPages = pagination?.total_pages || 0;
    const totalItems = pagination?.total || 0;

    // Look up all teams for the dropdown selector
    const { data: teamsLookupData } = useQuery({
        queryKey: ['publicTeamsLookup'],
        queryFn: () => getTeams(1, 100),
    });
    const teamsList = teamsLookupData?.data || [];
    const filterTeam = urlTeam
        ? teamsList.find(t => t.id === urlTeam)
        : undefined;

    const handleTeamChange = (teamId: string) => {
        setPage(1);
        const params = new URLSearchParams(searchParams);
        if (teamId) {
            params.set('team', teamId);
        } else {
            params.delete('team');
        }
        setSearchParams(params, { replace: true });
    };

    const clearTeamFilter = () => {
        handleTeamChange('');
    };

    return (
        <div className="space-y-4 md:space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center bg-sffl-navy text-white p-6 md:p-8 rounded-xl md:rounded-2xl shadow-xl gap-8 lg:gap-12">
                <div className="shrink-0">
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase whitespace-nowrap">League Stats</h1>
                    <p className="text-gray-300 mt-0.5 text-xs md:text-lg">Player & Team Performance</p>
                </div>

                {/* Filters Group */}
                <div className="flex flex-col sm:flex-row items-end gap-4 md:gap-6 w-full lg:w-auto">
                    <div className={`w-full sm:w-auto overflow-visible transition-opacity duration-300 ${activeTab === 'players' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-wider">Search Players</label>
                        <div className="relative group/search">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within/search:text-sffl-red transition-colors" />
                            <input
                                type="text"
                                placeholder="Player name..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setPage(1);
                                    const params = new URLSearchParams(searchParams);
                                    if (e.target.value) {
                                        params.set('search', e.target.value);
                                    } else {
                                        params.delete('search');
                                        params.delete('player_id'); 
                                    }
                                    setSearchParams(params, { replace: true });
                                }}
                                className="bg-white/10 border border-white/20 text-white pl-9 pr-10 py-2 rounded-lg font-bold text-sm min-w-full sm:min-w-[240px] outline-none focus:ring-2 focus:ring-sffl-red transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setPage(1);
                                        const params = new URLSearchParams(searchParams);
                                        params.delete('search');
                                        params.delete('player_id');
                                        setSearchParams(params, { replace: true });
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-colors"
                                    title="Clear search"
                                >
                                    <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-white" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="w-full sm:w-auto flex flex-col gap-2 sm:w-[200px]">
                        <div className="min-w-[180px]">
                            <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-wider">Competition</label>
                            <div className="relative">
                                <select
                                    value={selectedCompetitionId}
                                    onChange={(e) => handleCompChange(e.target.value)}
                                    className="w-full appearance-none bg-white/10 border border-white/20 text-white py-2 px-4 pr-10 rounded-lg focus:outline-none focus:ring-1 focus:ring-sffl-red font-bold text-sm cursor-pointer hover:bg-white/20 transition-colors"
                                >
                                    <option value="" className="text-black bg-white">All Competitions</option>
                                    {dropdownComps.map((c: Competition) => (
                                        <option key={c.id} value={c.id} className="text-black bg-white">
                                            {c.name} {c.status && !['active', 'completed'].includes(c.status) ? `[${c.status.toUpperCase()}]` : ''}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-white">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`w-full sm:w-auto transition-opacity duration-300 ${!selectedCompetitionId ? 'opacity-40' : 'opacity-100'}`}>
                        <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-wider">Event Day</label>
                        <div className="relative">
                            <select
                                value={selectedDate}
                                onChange={(e) => {
                                    setSelectedDate(e.target.value);
                                    const params = new URLSearchParams(searchParams);
                                    params.set('date', e.target.value);
                                    setSearchParams(params, { replace: true });
                                }}
                                disabled={!selectedCompetitionId}
                                className="w-full appearance-none bg-white/10 border border-white/20 text-white py-2 px-4 pr-10 rounded-lg focus:outline-none focus:ring-1 focus:ring-sffl-red font-bold text-sm min-w-full sm:min-w-[150px] cursor-pointer hover:bg-white/20 transition-colors disabled:cursor-not-allowed"
                            >
                                 <option value="" className="text-black bg-white">All Event Days</option>
                                {statDates.map((date: string) => (
                                    <option key={date} value={date} className="text-black bg-white">
                                        {date}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-white">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {filterTeam && (
                <div className="flex items-center justify-between gap-3 bg-sffl-red/10 border border-sffl-red/30 text-sffl-red dark:bg-sffl-red/20 dark:text-white px-4 py-2.5 rounded-xl">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-bold uppercase tracking-wider">
                        <span>Filtering stats for</span>
                        <span className="font-black">{filterTeam.name}</span>
                    </div>
                    <button
                        onClick={clearTeamFilter}
                        className="text-[10px] md:text-xs font-black uppercase tracking-wider bg-white text-sffl-red hover:bg-gray-100 px-3 py-1 rounded-full transition"
                    >
                        Clear ✕
                    </button>
                </div>
            )}

            {/* Season | Playoffs toggle for the selected competition */}
            <SeasonPlayoffTabs competitions={competitions} currentId={selectedCompetitionId} onChange={handleCompChange} />

            {/* Tabs */}
            <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide">
                <button
                    onClick={() => handleTabChange('players')}
                    className={`px-4 md:px-6 py-3 font-black text-sm md:text-base border-b-4 transition-colors whitespace-nowrap ${activeTab === 'players'
                        ? 'border-sffl-red text-sffl-red'
                        : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                        }`}
                >
                    Player Stats
                </button>
                <button
                    onClick={() => handleTabChange('teams')}
                    className={`px-4 md:px-6 py-3 font-black text-sm md:text-base border-b-4 transition-colors whitespace-nowrap ${activeTab === 'teams'
                        ? 'border-sffl-red text-sffl-red'
                        : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                        }`}
                >
                    Team Stats
                </button>
            </div>

            {/* Content */}
            {loading && !playerStats && !teamStats ? (
                <Loader />
            ) : (
                <div className="space-y-4">
                    {/* Legend / Key - Pro Style (Togglable) */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            onClick={() => setShowLegend(!showLegend)}
                        >
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-sffl-red" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <h3 className="font-black text-xs md:text-sm text-sffl-navy dark:text-white uppercase tracking-wider">Statistical Key</h3>
                            </div>
                            <button className="text-[10px] font-black uppercase tracking-tight text-sffl-red hover:underline">
                                {showLegend ? 'Close Info ↑' : 'See Info ↓'}
                            </button>
                        </div>

                        {showLegend && (
                            <div className="p-6 pt-0 border-t border-gray-50 dark:border-gray-700">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-4">
                                    {/* Category: General */}
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-l-2 border-gray-200 pl-2">General</h4>
                                        <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                                            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-full border border-gray-100 dark:border-gray-600">
                                                <span className="text-sffl-red">APPS:</span> <span className="text-gray-600 dark:text-gray-300">Appearances</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Category: Passing */}
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest border-l-2 border-blue-200 pl-2">Passing</h4>
                                        <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                                            {[
                                                { a: 'Passing ATT', f: 'Pass Attempts' },
                                                { a: 'Passing COMP', f: 'Pass Completions' },
                                                { a: 'Passing TDs', f: 'Passing Touchdowns' },
                                                { a: 'Passing INT', f: 'Interceptions Thrown' },
                                                { a: 'QB Sacks', f: 'QB Sacks Accounted' },
                                            ].map(s => (
                                                <div key={s.a} className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full border border-blue-100 dark:border-blue-800">
                                                    <span className="text-blue-600"> {s.a}:</span> <span className="text-blue-800/80 dark:text-blue-300/80">{s.f}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Category: Rushing & Receiving */}
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-black text-green-400 uppercase tracking-widest border-l-2 border-green-200 pl-2">Offense</h4>
                                        <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                                            {[
                                                { a: 'Rush ATT', f: 'Rush Attempts', c: 'green' },
                                                { a: 'Rush TDs', f: 'Rushing Touchdowns', c: 'green' },
                                                { a: 'Rec', f: 'Receptions', c: 'yellow' },
                                                { a: 'RC TDs', f: 'Receiving Touchdowns', c: 'yellow' },
                                                { a: 'Drops', f: 'Drops', c: 'yellow' },
                                                { a: 'X-Pts TDs', f: 'Extra Point Touchdowns', c: 'purple' },
                                            ].map(s => (
                                                <div key={s.a} className={`flex items-center gap-1.5 bg-${s.c}-50 dark:bg-${s.c}-900/20 px-2 py-1 rounded-full border border-${s.c}-100 dark:border-${s.c}-800`}>
                                                    <span className={`text-${s.c}-600`}> {s.a}:</span> <span className={`text-${s.c}-800/80 dark:text-${s.c}-300/80`}>{s.f}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Category: Defense */}
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest border-l-2 border-red-200 pl-2">Defense</h4>
                                        <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                                            {[
                                                { a: 'Flag Pulls', f: 'Flag Pulls (Tackles)' },
                                                { a: 'Pass Defl', f: 'Pass Deflections' },
                                                { a: 'Def INT', f: 'Interceptions Caught' },
                                                { a: 'Def Sacks', f: 'Defensive Sacks' },
                                                { a: 'Def TDs', f: 'Defensive Touchdowns' },
                                                { a: 'Def XP TDs', f: 'Defensive Extra-Point TDs (INT returned on an extra point)' },
                                                { a: 'Safety', f: 'Safeties' },
                                            ].map(s => (
                                                <div key={s.a} className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full border border-red-100 dark:border-red-800">
                                                    <span className="text-red-600"> {s.a}:</span> <span className="text-red-800/80 dark:text-red-300/80">{s.f}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Position Filter Pills (When Player Stats Tab is Active) */}
                    {activeTab === 'players' && (
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <span className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-400 shrink-0 mr-1 flex items-center gap-1.5">
                                <span>🏈</span> Position:
                            </span>
                            {[
                                { id: 'QB', label: 'Quarterbacks (QB)' },
                                { id: 'REC', label: 'Receivers / Centers (REC)' },
                                { id: 'RUSH', label: 'Rushers (RUSH)' },
                                { id: 'DEF', label: 'Defenders (DEF)' },
                            ].map((pos) => {
                                const isActive = (positionFilter || 'QB') === pos.id;
                                return (
                                    <button
                                        key={pos.id}
                                        type="button"
                                        onClick={() => {
                                            setPositionFilter(pos.id);
                                            setSortBy('');
                                            setPage(1);
                                            const params = new URLSearchParams(searchParams);
                                            params.set('pos', pos.id);
                                            setSearchParams(params, { replace: true });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                                            isActive
                                                ? 'bg-sffl-navy dark:bg-sffl-red text-white shadow-md scale-105'
                                                : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        {pos.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <StatsTable
                        type={activeTab}
                        playerStats={playerStats}
                        teamStats={teamStats}
                        sortBy={sortBy}
                        onSortChange={handleSortChange}
                        isLoading={activeTab === 'players' ? loadingPlayers : loadingTeams}
                        positionFilter={positionFilter}
                    />

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm mt-6">
                            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">
                                Showing <span className="text-sffl-navy dark:text-white font-bold">{((page - 1) * limit) + 1}</span> to <span className="text-sffl-navy dark:text-white font-bold">{Math.min(page * limit, totalItems)}</span> of <span className="text-sffl-navy dark:text-white font-bold">{totalItems}</span> entries
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                {[...Array(totalPages)].map((_, i) => {
                                    const p = i + 1;
                                    // Logic to show limited page numbers if totalPages is large
                                    if (totalPages > 5) {
                                        if (p !== 1 && p !== totalPages && Math.abs(p - page) > 1) {
                                            if (p === 2 && page > 3) return <span key="dots1">...</span>;
                                            if (p === totalPages - 1 && page < totalPages - 2) return <span key="dots2">...</span>;
                                            return null;
                                        }
                                    }
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className={`w-9 h-9 rounded-lg font-bold text-sm transition-all ${page === p
                                                ? 'bg-sffl-red text-white shadow-md shadow-red-500/20'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
