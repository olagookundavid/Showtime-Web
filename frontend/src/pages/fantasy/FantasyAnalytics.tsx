import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ChartBarIcon,
    UserGroupIcon,
    TrophyIcon,
    ShieldCheckIcon,
    SparklesIcon,
    LightBulbIcon,
    ArrowPathIcon,
    FireIcon,
} from '@heroicons/react/24/outline';
import { fantasyApi, type FantasyLineupPick } from '../../services/api';
import { FantasyBackLink } from '../../components/fantasy/FantasyBackLink';

type AnalyticsTab = 'ownership' | 'top_scorers' | 'club_points' | 'dream_team' | 'differentials';

export function FantasyAnalytics() {
    const [searchParams, setSearchParams] = useSearchParams();
    const gwParam = searchParams.get('gw');

    const [selectedTab, setSelectedTab] = useState<AnalyticsTab>('ownership');
    const [positionFilter, setPositionFilter] = useState<string>('ALL');

    // 1. Fetch active fantasy season
    const { data: season, isLoading: seasonLoading } = useQuery({
        queryKey: ['fantasySeason'],
        queryFn: fantasyApi.getActiveSeason,
    });

    const seasonId = season?.id || '';

    // 2. Fetch scheduled gameweeks
    const { data: gameweeks, isLoading: gwLoading } = useQuery({
        queryKey: ['fantasyGameweeks', seasonId],
        queryFn: () => (seasonId ? fantasyApi.getGameweeks(seasonId) : Promise.resolve([])),
        enabled: Boolean(seasonId),
    });

    // 3. Select active gameweek
    const [selectedGwId, setSelectedGwId] = useState<string>('');

    useEffect(() => {
        if (gwParam) {
            setSelectedGwId(gwParam);
        } else if (gameweeks && gameweeks.length > 0 && !selectedGwId) {
            // Find current active, locked or latest gameweek
            const activeGw = gameweeks.find((g) => g.status === 'LIVE' || g.status === 'LOCKED' || g.status === 'FINALIZED');
            setSelectedGwId(activeGw ? activeGw.id : gameweeks[gameweeks.length - 1].id);
        }
    }, [gwParam, gameweeks, selectedGwId]);

    const handleSelectGw = (gwId: string) => {
        setSelectedGwId(gwId);
        setSearchParams({ gw: gwId });
    };

    // 4. Fetch Gameweek Analytics Report
    const { data: report, isLoading: reportLoading, isError, refetch } = useQuery({
        queryKey: ['fantasyGameweekReport', seasonId, selectedGwId],
        queryFn: () => (seasonId && selectedGwId ? fantasyApi.getGameweekReport(seasonId, selectedGwId) : null),
        enabled: Boolean(seasonId) && Boolean(selectedGwId),
        staleTime: 30000,
    });

    const activeGameweek = useMemo(() => {
        return (gameweeks || []).find((g) => g.id === selectedGwId);
    }, [gameweeks, selectedGwId]);

    // Position filter for Top Scorers
    const filteredTopScorers = useMemo(() => {
        if (!report?.top_scorers) return [];
        if (positionFilter === 'ALL') return report.top_scorers;
        if (positionFilter === 'QB') return report.top_scorers.filter((p) => p.position === 'QB' || p.position === 'Quarterback');
        if (positionFilter === 'REC') return report.top_scorers.filter((p) => p.position === 'Receiver' || p.position === 'WR' || p.position === 'Center');
        if (positionFilter === 'RUSH') return report.top_scorers.filter((p) => p.position === 'Rusher' || p.position === 'RUSH');
        if (positionFilter === 'DEF') return report.top_scorers.filter((p) => p.position === 'Defender' || p.position === 'DB' || p.position === 'CB' || p.position === 'Safety' || p.position === 'LB');
        return report.top_scorers;
    }, [report?.top_scorers, positionFilter]);

    const isLoading = seasonLoading || gwLoading || reportLoading;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6">
            <FantasyBackLink to="/fantasy" label="Back to Fantasy Hub" />

            {/* Hero Header Banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-sffl-navy text-white p-6 md:p-8 rounded-2xl shadow-xl gap-4">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-black uppercase tracking-wider mb-2">
                        <ChartBarIcon className="w-3.5 h-3.5 text-yellow-400" /> Week-by-Week Intelligence
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black italic tracking-tighter text-white">
                        GAMEWEEK ANALYTICS &amp; REPORT
                    </h1>
                    <p className="text-gray-300 mt-1 text-xs sm:text-sm max-w-2xl">
                        Deep dive into player popularity, top scoring performers, actual club contributions, and the optimal dream team for every round.
                    </p>
                </div>

                {/* Gameweek Selector Dropdown */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 self-stretch md:self-auto">
                    <span className="text-xs text-gray-300 font-bold uppercase">Gameweek:</span>
                    <select
                        value={selectedGwId}
                        onChange={(e) => handleSelectGw(e.target.value)}
                        className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sffl-red cursor-pointer w-full sm:w-auto"
                    >
                        {(gameweeks || []).map((gw) => (
                            <option key={gw.id} value={gw.id} className="text-gray-900 bg-white">
                                Gameweek {gw.number} ({gw.status})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Quick Navigation Links */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400 font-bold">Round status:</span>
                    <span
                        className={`font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            activeGameweek?.status === 'FINALIZED'
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : activeGameweek?.status === 'LIVE'
                                ? 'bg-sffl-red text-white animate-pulse'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                    >
                        {activeGameweek?.status || 'SCHEDULED'}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        to={`/fantasy/leaderboard/${seasonId}?type=overall`}
                        className="text-sffl-navy dark:text-gray-200 hover:text-sffl-red dark:hover:text-white font-bold transition inline-flex items-center gap-1"
                    >
                        <TrophyIcon className="w-3.5 h-3.5" /> View Standings
                    </Link>
                </div>
            </div>

            {/* KPI Metric Cards Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {/* Average Points */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs font-black uppercase tracking-wider block">
                        Average Score
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-gray-900 dark:text-white mt-1 block">
                        {report?.summary ? `${report.summary.average_points} pts` : '—'}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 block mt-0.5">
                        Across {report?.summary?.total_managers || 0} teams
                    </span>
                </div>

                {/* High Score */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs font-black uppercase tracking-wider block">
                        Peak Score
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-sffl-red mt-1 block">
                        {report?.summary ? `${report.summary.highest_points} pts` : '—'}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 truncate">
                        {report?.summary?.highest_scoring_team ? `by ${report.summary.highest_scoring_team}` : 'Top team'}
                    </span>
                </div>

                {/* Most Owned */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs font-black uppercase tracking-wider block">
                        Most Owned
                    </span>
                    <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-1 block truncate">
                        {report?.most_owned && report.most_owned.length > 0 ? report.most_owned[0].player_name : '—'}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                        {report?.most_owned && report.most_owned.length > 0 ? `${report.most_owned[0].ownership_percentage}% of squads` : '—'}
                    </span>
                </div>

                {/* Gameweek MVP */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs font-black uppercase tracking-wider block">
                        Gameweek MVP
                    </span>
                    <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-1 block truncate">
                        {report?.top_scorers && report.top_scorers.length > 0 ? report.top_scorers[0].player_name : '—'}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-sffl-red block mt-0.5">
                        {report?.top_scorers && report.top_scorers.length > 0 ? `+${report.top_scorers[0].points} pts` : '—'}
                    </span>
                </div>

                {/* Top Real Club */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs font-black uppercase tracking-wider block">
                        Top Club Output
                    </span>
                    <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-1 block truncate">
                        {report?.club_points && report.club_points.length > 0 ? report.club_points[0].club_name : '—'}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-gray-500 dark:text-gray-400 block mt-0.5">
                        {report?.club_points && report.club_points.length > 0 ? `${report.club_points[0].total_points} total pts` : '—'}
                    </span>
                </div>
            </div>

            {/* Tab Navigation Controls */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-2 shadow-sm flex flex-wrap gap-1 sm:gap-2">
                <button
                    type="button"
                    onClick={() => setSelectedTab('ownership')}
                    className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                        selectedTab === 'ownership'
                            ? 'bg-sffl-navy text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                    <UserGroupIcon className="w-4 h-4 text-sffl-red" /> Most Owned
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedTab('top_scorers')}
                    className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                        selectedTab === 'top_scorers'
                            ? 'bg-sffl-navy text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                    <FireIcon className="w-4 h-4 text-amber-500" /> Top Scorers
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedTab('club_points')}
                    className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                        selectedTab === 'club_points'
                            ? 'bg-sffl-navy text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                    <ShieldCheckIcon className="w-4 h-4 text-emerald-500" /> Points by Club
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedTab('dream_team')}
                    className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                        selectedTab === 'dream_team'
                            ? 'bg-sffl-navy text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                    <SparklesIcon className="w-4 h-4 text-yellow-500" /> Dream Team
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedTab('differentials')}
                    className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                        selectedTab === 'differentials'
                            ? 'bg-sffl-navy text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                    <LightBulbIcon className="w-4 h-4 text-indigo-400" /> Differentials
                </button>
            </div>

            {/* Main Content Area */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="py-24 flex flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
                        <ArrowPathIcon className="w-8 h-8 animate-spin text-sffl-red" />
                        <p className="text-xs font-bold uppercase tracking-wider">Compiling gameweek analytics...</p>
                    </div>
                ) : isError ? (
                    <div className="py-16 text-center text-red-600 dark:text-red-400 text-sm">
                        <p className="font-bold">Failed to load gameweek analytics.</p>
                        <button
                            type="button"
                            onClick={() => refetch()}
                            className="mt-3 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                        >
                            Try again
                        </button>
                    </div>
                ) : (
                    <>
                        {/* TAB 1: Most Owned Players */}
                        {selectedTab === 'ownership' && (
                            <div>
                                <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                                            Most Owned Players
                                        </h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            Roster selection frequency across all active fantasy squads for Gameweek {report?.gameweek_number}.
                                        </p>
                                    </div>
                                    <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 hidden sm:inline-block">
                                        Top 15 Most Selected
                                    </span>
                                </div>

                                {(!report?.most_owned || report.most_owned.length === 0) ? (
                                    <div className="py-16 text-center text-gray-500 dark:text-gray-400 text-sm">
                                        No player ownership recorded for this gameweek yet.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                                <tr>
                                                    <th className="py-3 px-4 w-12 text-center">Rank</th>
                                                    <th className="py-3 px-4">Player</th>
                                                    <th className="py-3 px-4">Club</th>
                                                    <th className="py-3 px-4">Price</th>
                                                    <th className="py-3 px-4 min-w-[140px]">Ownership</th>
                                                    <th className="py-3 px-4 text-right">Points</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {report.most_owned.map((p, idx) => (
                                                    <tr key={p.player_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                        <td className="py-3.5 px-4 text-center font-bold text-gray-500 text-xs">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0 border border-gray-200 dark:border-gray-600">
                                                                    {p.player_image ? (
                                                                        <img src={p.player_image} alt={p.player_name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-gray-400">
                                                                            {p.player_name.slice(0, 2).toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
                                                                        <span>{p.player_name}</span>
                                                                        <span className="text-[10px] font-bold px-1 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                                                            {p.gender}
                                                                        </span>
                                                                    </p>
                                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                                        {p.position}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                                                                {p.team_logo && (
                                                                    <img src={p.team_logo} alt={p.team_name} className="w-4 h-4 object-contain" />
                                                                )}
                                                                {p.team_short_name || p.team_name || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-4 font-mono font-bold text-xs text-gray-600 dark:text-gray-300">
                                                            ₦{p.current_price.toFixed(1)}m
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between text-xs font-bold">
                                                                    <span className="text-sffl-navy dark:text-white font-mono">
                                                                        {p.ownership_percentage}%
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-400">
                                                                        ({p.ownership_count} teams)
                                                                    </span>
                                                                </div>
                                                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                                                    <div
                                                                        className="bg-sffl-navy dark:bg-sffl-red h-1.5 rounded-full"
                                                                        style={{ width: `${Math.min(100, p.ownership_percentage)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-4 text-right">
                                                            <span
                                                                className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-mono font-black ${
                                                                    p.points > 0
                                                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                                                        : p.points < 0
                                                                        ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                                                                }`}
                                                            >
                                                                {p.points > 0 ? `+${p.points.toFixed(1)}` : p.points.toFixed(1)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 2: Top Scorers */}
                        {selectedTab === 'top_scorers' && (
                            <div>
                                <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                                            Top Point Scorers
                                        </h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            Highest individual fantasy point performances in Gameweek {report?.gameweek_number}.
                                        </p>
                                    </div>

                                    {/* Position Filter Pills */}
                                    <div className="flex flex-wrap gap-1">
                                        {[
                                            { id: 'ALL', label: 'All Roles' },
                                            { id: 'QB', label: 'QBs' },
                                            { id: 'REC', label: 'Receivers' },
                                            { id: 'RUSH', label: 'Rushers' },
                                            { id: 'DEF', label: 'Defenders' },
                                        ].map((pos) => (
                                            <button
                                                key={pos.id}
                                                type="button"
                                                onClick={() => setPositionFilter(pos.id)}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer ${
                                                    positionFilter === pos.id
                                                        ? 'bg-sffl-navy text-white'
                                                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                                                }`}
                                            >
                                                {pos.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {filteredTopScorers.length === 0 ? (
                                    <div className="py-16 text-center text-gray-500 dark:text-gray-400 text-sm">
                                        No point scorers recorded for this filter yet.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                                <tr>
                                                    <th className="py-3 px-4 w-12 text-center">Rank</th>
                                                    <th className="py-3 px-4">Player</th>
                                                    <th className="py-3 px-4">Club</th>
                                                    <th className="py-3 px-4">Price</th>
                                                    <th className="py-3 px-4 text-center">Ownership</th>
                                                    <th className="py-3 px-4 text-right">Points</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {filteredTopScorers.map((p, idx) => (
                                                    <tr key={p.player_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                        <td className="py-3.5 px-4 text-center font-bold text-gray-500 text-xs">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0 border border-gray-200 dark:border-gray-600">
                                                                    {p.player_image ? (
                                                                        <img src={p.player_image} alt={p.player_name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-gray-400">
                                                                            {p.player_name.slice(0, 2).toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
                                                                        <span>{p.player_name}</span>
                                                                        <span className="text-[10px] font-bold px-1 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                                                            {p.gender}
                                                                        </span>
                                                                    </p>
                                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                                        {p.position}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                                                                {p.team_logo && (
                                                                    <img src={p.team_logo} alt={p.team_name} className="w-4 h-4 object-contain" />
                                                                )}
                                                                {p.team_short_name || p.team_name || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-4 font-mono font-bold text-xs text-gray-600 dark:text-gray-300">
                                                            ₦{p.price.toFixed(1)}m
                                                        </td>
                                                        <td className="py-3.5 px-4 text-center font-mono text-xs font-bold text-gray-600 dark:text-gray-300">
                                                            {p.ownership_percentage}%
                                                        </td>
                                                        <td className="py-3.5 px-4 text-right">
                                                            <span
                                                                className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-mono font-black border ${
                                                                    p.points > 0
                                                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                                                        : p.points < 0
                                                                        ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600'
                                                                }`}
                                                            >
                                                                {p.points > 0 ? `+${p.points.toFixed(1)}` : p.points.toFixed(1)} pts
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 3: Points by Actual SFFL Club */}
                        {selectedTab === 'club_points' && (
                            <div>
                                <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
                                    <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                                        Points Produced by Actual Club
                                    </h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        Total fantasy points generated by players representing real SFFL franchises in Gameweek {report?.gameweek_number}.
                                    </p>
                                </div>

                                {(!report?.club_points || report.club_points.length === 0) ? (
                                    <div className="py-16 text-center text-gray-500 dark:text-gray-400 text-sm">
                                        No club points calculated for this gameweek yet.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                                <tr>
                                                    <th className="py-3 px-4 w-12 text-center">Rank</th>
                                                    <th className="py-3 px-4">Club</th>
                                                    <th className="py-3 px-4 text-center">Active Players</th>
                                                    <th className="py-3 px-4 text-center">Avg / Player</th>
                                                    <th className="py-3 px-4">Top Contributor</th>
                                                    <th className="py-3 px-4 text-right">Total Points</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {report.club_points.map((c, idx) => (
                                                    <tr key={c.club_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                        <td className="py-3.5 px-4 text-center font-bold text-gray-500 text-xs">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            <div className="flex items-center gap-3">
                                                                {c.club_logo ? (
                                                                    <img src={c.club_logo} alt={c.club_name} className="w-7 h-7 object-contain shrink-0" />
                                                                ) : (
                                                                    <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] font-black text-gray-500">
                                                                        {c.club_name.slice(0, 2).toUpperCase()}
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                                                                        {c.club_name}
                                                                    </p>
                                                                    <p className="text-[11px] text-gray-400 font-mono">
                                                                        {c.club_short_name}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-4 text-center font-mono font-bold text-xs text-gray-700 dark:text-gray-300">
                                                            {c.active_player_count}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-center font-mono font-bold text-xs text-gray-700 dark:text-gray-300">
                                                            {c.average_points_per_player} pts
                                                        </td>
                                                        <td className="py-3.5 px-4 text-xs font-medium text-gray-600 dark:text-gray-300">
                                                            {c.top_scorer_name ? (
                                                                <span>
                                                                    <strong className="text-gray-900 dark:text-white">{c.top_scorer_name}</strong> ({c.top_scorer_points} pts)
                                                                </span>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-right">
                                                            <span className="font-mono font-black text-sffl-red text-sm sm:text-base">
                                                                {c.total_points.toFixed(1)} pts
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 4: Gameweek Dream Team */}
                        {selectedTab === 'dream_team' && (
                            <div>
                                <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <SparklesIcon className="w-4 h-4 text-yellow-500" />
                                            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                                                Gameweek {report?.gameweek_number} Dream Team
                                            </h2>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            The optimal legal 14-man starting roster adhering to position, female quotas, and the 3-player club cap.
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-[10px] uppercase font-bold text-gray-400 block">
                                            Dream Team Score
                                        </span>
                                        <span className="text-lg sm:text-2xl font-mono font-black text-sffl-red">
                                            {report?.dream_team_total_points || 0} pts
                                        </span>
                                    </div>
                                </div>

                                {(!report?.dream_team || report.dream_team.length === 0) ? (
                                    <div className="py-16 text-center text-gray-500 dark:text-gray-400 text-sm">
                                        Dream team will be computed once match stats are recorded.
                                    </div>
                                ) : (
                                    <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Offense */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white px-1">
                                                Offensive Unit
                                            </h3>
                                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                                                {report.dream_team
                                                    .filter((p) => ['QB_M', 'QB_F', 'REC_1', 'REC_2', 'REC_3', 'REC_4', 'REC_5'].includes(p.slot))
                                                    .map((p) => (
                                                        <DreamTeamRow key={p.slot + p.player_id} pick={p} />
                                                    ))}
                                            </div>
                                        </div>

                                        {/* Defense */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white px-1">
                                                Defensive Unit
                                            </h3>
                                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                                                {report.dream_team
                                                    .filter((p) => ['RUSHER', 'DEF_1', 'DEF_2', 'DEF_3', 'DEF_4', 'DEF_5', 'DEF_6'].includes(p.slot))
                                                    .map((p) => (
                                                        <DreamTeamRow key={p.slot + p.player_id} pick={p} />
                                                    ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 5: Differential Stars */}
                        {selectedTab === 'differentials' && (
                            <div>
                                <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
                                    <div className="flex items-center gap-2 mb-1">
                                        <LightBulbIcon className="w-4 h-4 text-indigo-400" />
                                        <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                                            Differential Heroes
                                        </h2>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        High-scoring players owned by less than 20% of managers who provided a massive competitive edge this gameweek.
                                    </p>
                                </div>

                                {(!report?.differentials || report.differentials.length === 0) ? (
                                    <div className="py-16 text-center text-gray-500 dark:text-gray-400 text-sm">
                                        No differential stars identified for this gameweek yet.
                                    </div>
                                ) : (
                                    <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {report.differentials.map((p) => (
                                            <div
                                                key={p.player_id}
                                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm hover:border-sffl-red/40 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0 border border-gray-200 dark:border-gray-600">
                                                        {p.player_image ? (
                                                            <img src={p.player_image} alt={p.player_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-xs font-black text-gray-400">
                                                                {p.player_name.slice(0, 2).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                                            {p.player_name}
                                                        </p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                                            <span>{p.team_short_name || p.team_name}</span>
                                                            <span>·</span>
                                                            <span>{p.position} ({p.gender})</span>
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                                    <div>
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 block">
                                                            Ownership
                                                        </span>
                                                        <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                                                            {p.ownership_percentage}%
                                                        </span>
                                                    </div>

                                                    <div className="text-right">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 block">
                                                            Points Scored
                                                        </span>
                                                        <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                                                            +{p.points.toFixed(1)} pts
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function DreamTeamRow({ pick }: { pick: FantasyLineupPick }) {
    return (
        <div className="p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-12 text-[10px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-center shrink-0">
                    {pick.slot.replace('_', ' ')}
                </span>
                <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate flex items-center gap-1">
                        <span>{pick.player_name}</span>
                        <span className="text-[10px] font-bold text-gray-500">({pick.gender})</span>
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        {pick.team_short_name || pick.team_name} · {pick.position}
                    </p>
                </div>
            </div>

            <span
                className={`font-mono font-black shrink-0 ${
                    pick.points > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : pick.points < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-500 dark:text-gray-400'
                }`}
            >
                {pick.points > 0 ? `+${pick.points.toFixed(1)}` : pick.points.toFixed(1)} pts
            </span>
        </div>
    );
}
