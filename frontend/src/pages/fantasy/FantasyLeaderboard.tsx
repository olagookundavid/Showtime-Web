import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    TrophyIcon,
    ArrowLeftIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    MapPinIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';
import { fantasyApi, type Leaderboard, type LeaderboardEntry } from '../../services/api';

const LIMIT = 20;
const OVERALL = 'overall';

/** Everything off the wire is treated as possibly-missing. */
const num = (v: number | null | undefined): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0;

const pts = (v: number | null | undefined): string => num(v).toFixed(2);

const EMPTY_BOARD: Leaderboard = { data: [], total: 0, total_pages: 0, my_rank: 0 };

const rankBadgeClass = (rank: number): string =>
    rank === 1
        ? 'bg-amber-400 text-gray-900 shadow-md ring-2 ring-amber-400/50'
        : rank === 2
        ? 'bg-gray-300 text-gray-800'
        : rank === 3
        ? 'bg-amber-700 text-white'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';

export function FantasyLeaderboard() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const urlIsOverall = searchParams.get('type') === 'overall';

    // 'overall' or a league id. Seeded from the route, then driven by the filter.
    const [scope, setScope] = useState<string>(urlIsOverall || !id ? OVERALL : id);
    const [selectedGWId, setSelectedGWId] = useState<string>('');
    // null means "wherever the viewer is"; a number is a page they chose.
    const [pageOverride, setPageOverride] = useState<number | null>(null);

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

    const scopeReady = scope === OVERALL ? !!seasonId : !!scope;

    const fetchBoard = (targetPage: number, limit: number): Promise<Leaderboard> => {
        const params = {
            gameweek_id: selectedGWId || undefined,
            page: targetPage,
            limit,
        };
        if (scope === OVERALL) {
            if (!seasonId) return Promise.resolve(EMPTY_BOARD);
            return fantasyApi.getOverallLeaderboard(seasonId, params);
        }
        return fantasyApi.getLeaderboard(scope, params);
    };

    // The podium is pinned regardless of which page is being browsed. It also
    // carries my_rank and the row count, which is what decides the first page
    // shown — so it is resolved before the windowed query runs.
    const topQuery = useQuery({
        queryKey: ['fantasyLeaderboardTop', scope, seasonId, selectedGWId],
        queryFn: () => fetchBoard(1, 3),
        enabled: scopeReady,
    });
    const topBoard = topQuery.data;

    const knownTotal = num(topBoard?.total);
    const pagesFromTotal = Math.max(1, Math.ceil(knownTotal / LIMIT) || 1);
    const rankForPaging = topQuery.isFetched ? num(topBoard?.my_rank) : 0;
    // Clamped so a rank that runs ahead of the data never lands past the end.
    const myPage =
        rankForPaging > 0 ? Math.min(Math.max(1, Math.ceil(rankForPaging / LIMIT)), pagesFromTotal) : 1;
    // Derived, never set from an effect: the window simply opens on the
    // viewer's page until they choose another one.
    const page = pageOverride ?? myPage;

    const { data: board, isLoading: boardLoading } = useQuery({
        queryKey: ['fantasyLeaderboard', scope, seasonId, selectedGWId, page],
        queryFn: () => fetchBoard(page, LIMIT),
        enabled: scopeReady && topQuery.isFetched,
    });

    const isLoading = topQuery.isLoading || boardLoading;
    const totalPages = Math.max(1, num(board?.total_pages) || pagesFromTotal);
    const total = num(board?.total) || knownTotal;
    const safePage = Math.min(Math.max(1, page), totalPages);
    const myRank = rankForPaging || num(board?.my_rank);

    const goToPage = (p: number) => setPageOverride(Math.min(Math.max(1, p), totalPages));

    const topThree: LeaderboardEntry[] = (topBoard?.data ?? []).filter(Boolean).slice(0, 3);
    const pinnedIds = new Set(topThree.map((e) => e?.team_id).filter(Boolean));

    const rows: LeaderboardEntry[] = (board?.data ?? []).filter(Boolean);
    // Never show the same manager twice — the podium above owns those rows.
    const windowRows = rows.filter((e) => !(e?.team_id && pinnedIds.has(e.team_id)));

    const showGWColumn = !!selectedGWId;
    const isEmpty = !isLoading && total === 0 && rows.length === 0 && topThree.length === 0;
    const canJumpToMe = myRank > 0 && safePage !== myPage;

    const selectScope = (next: string) => {
        setScope(next);
        setPageOverride(null);
    };

    const activeLeagueName =
        scope === OVERALL ? null : leagueOptions.find((o) => o.id === scope)?.name ?? 'League';

    return (
        <div className="space-y-6 md:space-y-8 pb-24">
            {/* Header Showtime Navy Banner */}
            <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-6 md:p-8">
                <Link
                    to="/fantasy/leagues"
                    className="inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-white mb-3 font-semibold transition"
                >
                    <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to Leagues
                </Link>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-black uppercase tracking-wider mb-2">
                            <TrophyIcon className="w-3 h-3 text-yellow-400" /> Official Standings
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-black italic uppercase tracking-tight text-white">
                            {scope === OVERALL ? 'Global Showtime Leaderboard' : activeLeagueName || 'League Standings'}
                        </h1>
                        <p className="text-xs md:text-sm text-gray-300 mt-1 font-medium">
                            {myRank > 0
                                ? `You are ranked #${myRank.toLocaleString()} in this table.`
                                : 'Rankings appear here once points are scored.'}
                        </p>
                    </div>

                    {/* Gameweek Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-300 font-bold uppercase">Filter:</span>
                        <select
                            value={selectedGWId}
                            onChange={(e) => {
                                setSelectedGWId(e.target.value);
                                setPageOverride(null);
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

            {/* Pinned podium */}
            {topThree.length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center gap-2">
                        <TrophyIcon className="w-4 h-4 text-amber-500" />
                        <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                            Top 3 — always in view
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {topThree.map((entry, idx) => {
                            const rank = num(entry?.rank) > 0 ? num(entry.rank) : idx + 1;
                            const isMe = myRank > 0 && rank === myRank;
                            return (
                                <div
                                    key={entry?.team_id ?? `top-${idx}`}
                                    className={`px-4 py-3 flex items-center justify-between gap-3 ${
                                        isMe ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span
                                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black shrink-0 ${rankBadgeClass(rank)}`}
                                        >
                                            {rank}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                {entry?.team_name || 'Unnamed squad'}
                                                {isMe && (
                                                    <span className="ml-2 text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                                        You
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {entry?.user_name || '—'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        {showGWColumn && (
                                            <p className="text-xs font-mono font-bold text-gray-600 dark:text-gray-300">
                                                GW {pts(entry?.gw_points)}
                                            </p>
                                        )}
                                        <p className="text-sm font-mono font-black text-sffl-red">
                                            {pts(entry?.total_points)} pts
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Main Table Card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                            Full Table
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
                            onClick={() => setPageOverride(null)}
                            className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-sffl-red hover:text-white text-gray-700 dark:text-gray-200 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                        >
                            <MapPinIcon className="w-3.5 h-3.5" /> Jump to me
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
                ) : windowRows.length === 0 ? (
                    <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                        {topThree.length > 0 && total <= topThree.length
                            ? 'Everyone in this table is on the podium above.'
                            : 'Nothing more to show on this page.'}
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
                                {windowRows.map((entry, idx) => {
                                    const rank = num(entry?.rank);
                                    const isMe = myRank > 0 && rank === myRank;
                                    return (
                                        <tr
                                            key={entry?.team_id ?? `row-${idx}`}
                                            className={`transition ${
                                                isMe
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-inset ring-emerald-500/40'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                            }`}
                                        >
                                            <td className="py-3.5 px-4 text-center">
                                                <span
                                                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black ${rankBadgeClass(rank)}`}
                                                >
                                                    {rank > 0 ? rank : '—'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <p className="font-bold text-gray-900 dark:text-white text-sm">
                                                    {entry?.team_name || 'Unnamed squad'}
                                                    {isMe && (
                                                        <span className="ml-2 text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                                            You
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {entry?.user_name || '—'}
                                                </p>
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
                            {total > 0 ? ` • ${total.toLocaleString()} total` : ''}
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
        </div>
    );
}
