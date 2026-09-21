import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    TrophyIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    MapPinIcon,
    UserGroupIcon,
    ArrowRightStartOnRectangleIcon,
    ExclamationTriangleIcon,
    ChartBarIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';
import { fantasyApi, fantasySeasonApi, formatKobo, type LeaderboardEntry } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useFantasyLeaderboard, num, rankBadgeClass, OVERALL } from '../../hooks/useFantasyLeaderboard';
import { FantasyTeamModal } from '../../components/fantasy/FantasyTeamModal';
import { BackButton } from '../../components/common/BackButton';

const pts = (v: number | null | undefined): string => num(v).toFixed(2);

export function FantasyLeaderboard() {
    const { user } = useAuth();
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const urlIsOverall = searchParams.get('type') === 'overall';

    // 'overall' or a league id. Seeded from the route, then driven by the filter.
    const [scope, setScope] = useState<string>(urlIsOverall || !id ? OVERALL : id);
    const [selectedGWId, setSelectedGWId] = useState<string>('');
    const [inspectingTeamId, setInspectingTeamId] = useState<string | null>(null);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const queryClient = useQueryClient();

    const { data: season } = useQuery({
        queryKey: ['fantasySeason'],
        queryFn: fantasyApi.getActiveSeason,
    });

    // When the route is the overall table, its :id IS the season id.
    const seasonId = urlIsOverall && id ? id : season?.id;

    const { data: gameweeks } = useQuery({
        queryKey: ['fantasyGameweeks', season?.id],
        queryFn: () => (season?.id ? fantasyApi.getGameweeks(season.id) : Promise.resolve([])),
        enabled: !!season?.id,
    });

    // Powers the league filter. Signed-out visitors simply get no leagues.
    const { data: myLeagues } = useQuery({
        queryKey: ['myFantasyLeagues', season?.id],
        queryFn: () => (season?.id ? fantasyApi.listMyLeagues(season.id) : Promise.resolve([])),
        enabled: !!season?.id,
        retry: false,
    });

    const leagueOptions = useMemo(() => {
        const opts = (myLeagues ?? [])
            .filter((l) => !!l?.id && l.type !== 'OVERALL')
            .map((l) => ({ id: l.id, name: l.name || 'Unnamed league' }));
        // Viewing a league you are not a member of: keep it selectable.
        if (scope !== OVERALL && !opts.some((o) => o.id === scope)) {
            opts.unshift({ id: scope, name: 'This League' });
        }
        return opts;
    }, [myLeagues, scope]);

    const { data: dashboard } = useQuery({
        queryKey: ['fantasyDashboard', seasonId],
        queryFn: () => fantasySeasonApi.getDashboard(seasonId),
        enabled: !!seasonId && !!user?.id,
    });

    const {
        isLoading,
        isEmpty,
        rows,
        myEntry: hookMyEntry,
        total,
        totalPages,
        page: safePage,
        myRank,
        canJumpToMe,
        goToPage,
        jumpToMe,
        resetPaging,
        fallbackRankAt,
    } = useFantasyLeaderboard({
        seasonId,
        scope,
        gameweekId: selectedGWId,
        queryPrefix: 'fantasyLeaderboard',
        limit: 10,
        defaultToPage1: true,
    });

    const showGWColumn = !!selectedGWId;

    const selectScope = (next: string) => {
        setScope(next);
        resetPaging();
    };

    // Only a mini-league you are actually in can be left; the overall table is
    // the season itself, and a league you are merely browsing has nothing to leave.
    const leavableLeague = useMemo(
        () => (myLeagues ?? []).find((l) => l?.id === scope && l.type !== 'OVERALL'),
        [myLeagues, scope]
    );
    const leaveEntryFeeKobo = num(leavableLeague?.entry_fee);

    const leaveMutation = useMutation({
        mutationFn: () => fantasyApi.leaveLeague(scope),
        onSuccess: () => {
            toast.success(`You have left ${leavableLeague?.name || 'the league'}.`);
            setConfirmLeave(false);
            queryClient.invalidateQueries({ queryKey: ['myFantasyLeagues'] });
            queryClient.invalidateQueries({ queryKey: ['fantasyDashboard'] });
            queryClient.invalidateQueries({ queryKey: ['fantasyLeaderboard'] });
            // Their old table is no longer theirs to sit in.
            selectScope(OVERALL);
        },
        onError: (err: any) =>
            toast.error(err?.response?.data?.error || 'Could not leave this league. Try again.'),
    });

    const isRowMe = (entry: LeaderboardEntry | undefined) => {
        if (!entry) return false;
        if (user?.id && entry.user_id && entry.user_id === user.id) return true;
        if (dashboard?.team?.id && entry.team_id && entry.team_id === dashboard.team.id) return true;
        return false;
    };

    const myEntry: LeaderboardEntry | null = useMemo(() => {
        if (hookMyEntry) return hookMyEntry;
        const fromRows = (rows ?? []).find(isRowMe);
        if (fromRows) return fromRows;
        if (dashboard?.team && myRank > 0) {
            return {
                rank: myRank,
                team_id: dashboard.team.id,
                team_name: dashboard.team.name,
                user_id: user?.id || '',
                user_name: user?.name || 'You',
                gw_points: dashboard.team.gameweek_points,
                total_points: dashboard.team.total_points,
            };
        }
        return null;
    }, [hookMyEntry, rows, dashboard, myRank, user]);

    const effectiveRank = myEntry?.rank ? num(myEntry.rank) : myRank;

    const activeLeagueName =
        scope === OVERALL ? null : leagueOptions.find((o) => o.id === scope)?.name ?? 'League';

    return (
        <div className="space-y-6 md:space-y-8 pb-36 md:pb-24">
            {/* Header Showtime Navy Banner */}
            <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-6 md:p-8">
                <div className="mb-3">
                    <BackButton
                        fallback="/fantasy/leagues"
                        className="inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-white font-semibold transition cursor-pointer"
                    >
                        Back to Leagues
                    </BackButton>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-black uppercase tracking-wider mb-2">
                            <TrophyIcon className="w-3 h-3 text-yellow-400" /> Official Standings
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-black italic uppercase tracking-tight text-white">
                            {scope === OVERALL ? 'Global Showtime Leaderboard' : activeLeagueName || 'League Standings'}
                        </h1>
                        <p className="text-xs md:text-sm text-gray-300 mt-1 font-medium">
                            {effectiveRank > 0
                                ? `You are ranked #${effectiveRank.toLocaleString()} in this table.`
                                : 'Rankings appear here once points are scored.'}
                        </p>
                    </div>

                    {/* Gameweek Filter */}
                    <div className="flex flex-wrap items-center gap-2">
                        {leavableLeague && (
                            <button
                                type="button"
                                onClick={() => setConfirmLeave(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-xs font-black uppercase tracking-wider text-gray-200 hover:bg-red-600 hover:border-red-600 hover:text-white transition cursor-pointer"
                            >
                                <ArrowRightStartOnRectangleIcon className="w-3.5 h-3.5" /> Leave League
                            </button>
                        )}
                        <span className="text-xs text-gray-300 font-bold uppercase">Filter:</span>
                        <select
                            value={selectedGWId}
                            onChange={(e) => {
                                setSelectedGWId(e.target.value);
                                resetPaging();
                            }}
                            className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-sffl-red cursor-pointer"
                        >
                            <option value="" className="text-gray-900 bg-white">Season Overall</option>
                            {(gameweeks ?? []).map((gw) => (
                                <option key={gw.id} value={gw.id} className="text-gray-900 bg-white">
                                    Gameweek {gw.number}
                                </option>
                            ))}
                        </select>
                        <Link
                            to={`/fantasy/analytics${selectedGWId ? `?gw=${selectedGWId}` : ''}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
                        >
                            <ChartBarIcon className="w-3.5 h-3.5" /> Weekly Report
                        </Link>
                    </div>
                </div>
            </div>

            {/* League filter */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <UserGroupIcon className="w-4 h-4 text-sffl-red" />
                    <h2 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                        Table
                    </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => selectScope(OVERALL)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                            scope === OVERALL
                                ? 'bg-sffl-navy text-white shadow-sm'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                        Overall
                    </button>
                    {leagueOptions.map((o) => (
                        <button
                            key={o.id}
                            type="button"
                            onClick={() => selectScope(o.id)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                                scope === o.id
                                    ? 'bg-sffl-navy text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                            {o.name}
                        </button>
                    ))}
                </div>
                {leagueOptions.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                        You're not in any mini-leagues yet — the overall table is the one to climb.{' '}
                        <Link to="/fantasy/leagues" className="text-sffl-red hover:text-[#A52323] font-bold">
                            Browse leagues
                        </Link>
                    </p>
                )}
            </div>

            {/* Unified Standings Table Card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-700/30">
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-1.5">
                            <TrophyIcon className="w-4 h-4 text-yellow-500" />
                            Standings
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {total > 0
                                ? `${total.toLocaleString()} manager${total === 1 ? '' : 's'} ranked`
                                : 'No managers ranked yet'}
                        </p>
                    </div>
                    {canJumpToMe && (
                        <button
                            type="button"
                            onClick={jumpToMe}
                            className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-sffl-red hover:text-white text-gray-700 dark:text-gray-200 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                        >
                            <MapPinIcon className="w-3.5 h-3.5" /> Jump to my rank {effectiveRank > 0 ? `(#${effectiveRank})` : ''}
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <div className="py-16 flex justify-center">
                        <div className="w-8 h-8 border-2 border-sffl-red border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : isEmpty ? (
                    <div className="py-16 text-center text-gray-500 dark:text-gray-400 text-sm">
                        No team rankings available for this selection yet.
                    </div>
                ) : rows.length === 0 ? (
                    <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                        Nothing more to show on this page.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                                    <th className="py-3.5 px-4">Team &amp; Manager</th>
                                    {showGWColumn && <th className="py-3.5 px-4 text-right">GW Points</th>}
                                    <th className="py-3.5 px-4 text-right">Total Points</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {/* 1. The first thing: Row with your position */}
                                {myEntry && effectiveRank > 0 && (
                                    <tr
                                        onClick={() => myEntry.team_id && setInspectingTeamId(myEntry.team_id)}
                                        className="bg-emerald-50/90 dark:bg-emerald-950/40 border-b-2 border-emerald-500/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 transition cursor-pointer group"
                                        title="Click to view your lineup"
                                    >
                                        <td className="py-3.5 px-4 text-center">
                                            <span
                                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black shadow-xs ring-2 ring-emerald-500/40 ${rankBadgeClass(effectiveRank)}`}
                                            >
                                                {effectiveRank}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-sffl-red transition-colors flex items-center gap-2">
                                                        <span>{myEntry.team_name || 'My Squad'}</span>
                                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white tracking-wider shadow-xs">
                                                            Your Position
                                                        </span>
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {myEntry.user_name || user?.name || 'You'}
                                                    </p>
                                                </div>
                                                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline-flex">
                                                    <EyeIcon className="w-3.5 h-3.5" /> View Lineup
                                                </span>
                                            </div>
                                        </td>
                                        {showGWColumn && (
                                            <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                                                {pts(myEntry.gw_points)}
                                            </td>
                                        )}
                                        <td className="py-3.5 px-4 text-right font-mono font-black text-sffl-red text-base">
                                            {pts(myEntry.total_points)} pts
                                        </td>
                                    </tr>
                                )}

                                {/* Divider indicator between your pinned position and the table */}
                                {myEntry && effectiveRank > 0 && (
                                    <tr className="bg-gray-100/70 dark:bg-gray-700/50 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                                        <td colSpan={showGWColumn ? 4 : 3} className="py-1.5 px-4">
                                            Table Rankings • Page {safePage}
                                        </td>
                                    </tr>
                                )}

                                {/* 2. Then the first 10 (or current page 10) */}
                                {rows.map((entry, idx) => {
                                    const rank = num(entry?.rank) > 0 ? num(entry.rank) : fallbackRankAt(idx);
                                    const isMe = isRowMe(entry);
                                    return (
                                        <tr
                                            key={entry?.team_id ?? `row-${idx}`}
                                            onClick={() => entry?.team_id && setInspectingTeamId(entry.team_id)}
                                            className={`transition cursor-pointer group ${
                                                isMe
                                                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/50'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                            }`}
                                            title="Click to inspect team formation and picks"
                                        >
                                            <td className="py-3.5 px-4 text-center">
                                                <span
                                                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black shrink-0 ${rankBadgeClass(rank)}`}
                                                >
                                                    {rank > 0 ? rank : '—'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-sffl-red transition-colors flex items-center gap-1.5">
                                                            <span>{entry?.team_name || 'Unnamed squad'}</span>
                                                            {isMe && (
                                                                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                                                    You
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {entry?.user_name || '—'}
                                                        </p>
                                                    </div>
                                                    <span className="text-[11px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-sffl-navy dark:text-gray-300 font-bold hidden sm:inline-flex">
                                                        <EyeIcon className="w-3.5 h-3.5" /> View Team
                                                    </span>
                                                </div>
                                            </td>
                                            {showGWColumn && (
                                                <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                                                    {pts(entry?.gw_points)}
                                                </td>
                                            )}
                                            <td className="py-3.5 px-4 text-right font-mono font-black text-sffl-red text-base">
                                                {pts(entry?.total_points)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {!isEmpty && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-bold">
                            Page {safePage} of {totalPages}
                            {total > 0 ? ` • ${total.toLocaleString()} total managers` : ''}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => goToPage(1)}
                                disabled={safePage === 1}
                                title="First page"
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition cursor-pointer"
                            >
                                <ChevronDoubleLeftIcon className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => goToPage(safePage - 1)}
                                disabled={safePage === 1}
                                title="Previous page"
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition cursor-pointer"
                            >
                                <ChevronLeftIcon className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => goToPage(safePage + 1)}
                                disabled={safePage >= totalPages}
                                title="Next page"
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition cursor-pointer"
                            >
                                <ChevronRightIcon className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => goToPage(totalPages)}
                                disabled={safePage >= totalPages}
                                title="Last page"
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition cursor-pointer"
                            >
                                <ChevronDoubleRightIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Leave confirmation. What leaving costs differs sharply between a
                free league and a paid one, so each is spelled out rather than
                hidden behind one generic "are you sure". */}
            {confirmLeave && leavableLeague && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pt-[calc(var(--chrome-h)+1rem)] transition-[padding] duration-300 motion-reduce:transition-none" data-dialog>
                    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                            <h2 className="text-base font-black uppercase italic tracking-tight text-sffl-navy dark:text-white">
                                Leave {leavableLeague.name || 'this league'}?
                            </h2>
                        </div>

                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-700 dark:text-gray-200">
                                You'll come out of this league's table straight away. Your squad and your points in the
                                overall table are untouched.
                            </p>

                            {leaveEntryFeeKobo > 0 ? (
                                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2">
                                    <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-300">
                                            You forfeit your {formatKobo(leaveEntryFeeKobo)} entry
                                        </p>
                                        <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                                            The money stays in the prize pool for whoever finishes on top, and it cannot be
                                            refunded. You will not be able to rejoin this league.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                                    <p className="text-xs text-gray-700 dark:text-gray-200">
                                        This league is free, so nothing is lost — you can join it again whenever you like.
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setConfirmLeave(false)}
                                    disabled={leaveMutation.isPending}
                                    className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-black text-xs uppercase disabled:opacity-50 transition cursor-pointer"
                                >
                                    Stay In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => leaveMutation.mutate()}
                                    disabled={leaveMutation.isPending}
                                    className="flex-1 py-3 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase disabled:opacity-50 transition cursor-pointer"
                                >
                                    {leaveMutation.isPending ? 'Leaving…' : 'Yes, Leave'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Inspector Modal */}
            <FantasyTeamModal
                isOpen={Boolean(inspectingTeamId)}
                onClose={() => setInspectingTeamId(null)}
                teamId={inspectingTeamId}
                gameweeks={gameweeks || []}
                initialGameweekId={selectedGWId}
            />
        </div>
    );
}
