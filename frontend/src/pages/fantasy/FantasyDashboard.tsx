import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    TrophyIcon,
    ShieldCheckIcon,
    ClockIcon,
    LockClosedIcon,
    PencilSquareIcon,
    UserGroupIcon,
    ArrowRightIcon,
    SparklesIcon,
    ChartBarIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    MapPinIcon,
} from '@heroicons/react/24/outline';
import {
    fantasySeasonApi,
    formatKobo,
    type FantasyLineupPick,
    type DashboardLeagueRow,
    type LeaderboardEntry,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import {
    useFantasyLeaderboard,
    rankBadgeClass,
    OVERALL,
} from '../../hooks/useFantasyLeaderboard';

/** Everything off the wire is treated as possibly-missing: a brand new season
 *  legitimately has no team, no lineup, no leagues and no managers. */
const num = (v: number | null | undefined): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0;

function formatDeadline(deadline?: string | null): string {
    if (!deadline) return 'To be announced';
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return 'To be announced';
    return d.toLocaleString();
}

/** Cheap live countdown. Returns null when there is nothing sensible to count to. */
function useCountdown(deadline?: string | null): string | null {
    const [label, setLabel] = useState<string | null>(null);

    useEffect(() => {
        if (!deadline) {
            setLabel(null);
            return;
        }
        const target = new Date(deadline).getTime();
        if (Number.isNaN(target)) {
            setLabel(null);
            return;
        }

        const tick = () => {
            const ms = target - Date.now();
            if (ms <= 0) {
                setLabel(null);
                return;
            }
            const totalSecs = Math.floor(ms / 1000);
            const days = Math.floor(totalSecs / 86400);
            const hours = Math.floor((totalSecs % 86400) / 3600);
            const mins = Math.floor((totalSecs % 3600) / 60);
            const secs = totalSecs % 60;
            setLabel(
                days > 0
                    ? `${days}d ${hours}h ${mins}m`
                    : `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
            );
        };

        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [deadline]);

    return label;
}

/** One leaderboard row, shared by the pinned podium and the paged window. */
function LeaderboardRow({
    entry,
    fallbackRank,
    isMe,
}: {
    entry: LeaderboardEntry;
    fallbackRank: number;
    isMe: boolean;
}) {
    const rank = num(entry?.rank) > 0 ? num(entry.rank) : fallbackRank;
    return (
        <div
            className={`px-3 py-3 flex items-center justify-between gap-3 rounded-xl ${
                isMe ? 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-inset ring-emerald-500/40' : ''
            }`}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${rankBadgeClass(rank)}`}
                >
                    {rank > 0 ? rank : '—'}
                </div>
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
            <p className="text-sm font-black text-sffl-red shrink-0">
                {num(entry?.total_points).toFixed(2)} pts
            </p>
        </div>
    );
}

/**
 * Standings panel: Overall plus every league the manager is in, a pinned top 3
 * and a paged window that opens on the manager's own page.
 */
function DashboardLeaderboard({
    seasonId,
    leagues,
}: {
    seasonId: string;
    leagues: DashboardLeagueRow[];
}) {
    const [scope, setScope] = useState<string>(OVERALL);

    const leagueOptions = (leagues ?? [])
        .filter((l) => !!l?.league_id && l.type !== 'OVERALL')
        .map((l) => ({ id: l.league_id, name: l.name || 'Unnamed league' }));

    const {
        isLoading, isEmpty, topThree, windowRows, total, totalPages, page,
        myRank, canJumpToMe, allOnPodium, goToPage, jumpToMe, resetPaging, fallbackRankAt,
    } = useFantasyLeaderboard({ seasonId, scope, queryPrefix: 'fantasyDashLeaderboard' });

    const safePage = page;

    const selectScope = (next: string) => {
        setScope(next);
        resetPaging();
    };

    const fullTableTo =
        scope === OVERALL ? `/fantasy/leaderboard/${seasonId}?type=overall` : `/fantasy/leaderboard/${scope}`;

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-base font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-sffl-red" /> Standings
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {myRank > 0
                            ? `You are ranked #${myRank.toLocaleString()}${total > 0 ? ` of ${total.toLocaleString()}` : ''} here`
                            : 'Season leaders across the table you pick'}
                    </p>
                </div>
                <Link
                    to={fullTableTo}
                    className="text-xs text-sffl-red hover:text-[#A52323] font-black uppercase inline-flex items-center gap-1 transition shrink-0"
                >
                    Full Table <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
            </div>

            {/* League filter */}
            <div className="flex flex-wrap gap-2 pb-4 mb-2 border-b border-gray-100 dark:border-gray-700">
                <button
                    type="button"
                    onClick={() => selectScope(OVERALL)}
                    className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${
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
                        className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${
                            scope === o.id
                                ? 'bg-sffl-navy text-white shadow-sm'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                        {o.name}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="py-10 flex justify-center">
                    <div className="w-8 h-8 border-2 border-sffl-red border-t-transparent rounded-full animate-spin" />
                </div>
            ) : isEmpty ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                    No manager has scored in this table yet. Be the first on the board.
                </p>
            ) : (
                <>
                    {/* Pinned top 3 */}
                    {topThree.length > 0 && (
                        <div className="mb-4">
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                                <TrophyIcon className="w-3.5 h-3.5 text-amber-500" /> Top 3
                            </p>
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 divide-y divide-gray-100 dark:divide-gray-700">
                                {topThree.map((entry, idx) => (
                                    <LeaderboardRow
                                        key={entry?.team_id ?? `top-${idx}`}
                                        entry={entry}
                                        fallbackRank={idx + 1}
                                        isMe={myRank > 0 && num(entry?.rank) === myRank}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Paged window */}
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Rest of the table
                        </p>
                        {canJumpToMe && (
                            <button
                                type="button"
                                onClick={jumpToMe}
                                className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-sffl-red hover:text-white text-gray-700 dark:text-gray-200 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 transition"
                            >
                                <MapPinIcon className="w-3.5 h-3.5" /> Jump to me
                            </button>
                        )}
                    </div>

                    {windowRows.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                            {allOnPodium
                                ? 'Everyone in this table is on the podium above.'
                                : 'Nothing more to show on this page.'}
                        </p>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {windowRows.map((entry, idx) => (
                                <LeaderboardRow
                                    key={entry?.team_id ?? `row-${idx}`}
                                    entry={entry}
                                    fallbackRank={fallbackRankAt(idx)}
                                    isMe={myRank > 0 && num(entry?.rank) === myRank}
                                />
                            ))}
                        </div>
                    )}

                    <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-bold">
                            Page {safePage} of {totalPages}
                            {total > 0 ? ` • ${total.toLocaleString()} manager${total === 1 ? '' : 's'}` : ''}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => goToPage(1)}
                                disabled={safePage === 1}
                                title="First page"
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition"
                            >
                                <ChevronDoubleLeftIcon className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => goToPage(safePage - 1)}
                                disabled={safePage === 1}
                                title="Previous page"
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition"
                            >
                                <ChevronLeftIcon className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => goToPage(safePage + 1)}
                                disabled={safePage >= totalPages}
                                title="Next page"
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition"
                            >
                                <ChevronRightIcon className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => goToPage(totalPages)}
                                disabled={safePage >= totalPages}
                                title="Last page"
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition"
                            >
                                <ChevronDoubleRightIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export function FantasyDashboard() {
    const { data: dashboard, isLoading, isError } = useQuery({
        queryKey: ['fantasyDashboard'],
        queryFn: () => fantasySeasonApi.getDashboard(),
    });

    const gameweek = dashboard?.current_gameweek;
    const countdown = useCountdown(gameweek?.deadline);

    if (isLoading) {
        return <Loader />;
    }

    // No live season (or the call failed) — same shape of empty state the hub uses.
    if (isError || !dashboard || !dashboard.season) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
                <div className="w-16 h-16 rounded-2xl bg-sffl-red/10 dark:bg-sffl-red/20 flex items-center justify-center text-sffl-red mb-4">
                    <ShieldCheckIcon className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white mb-2">
                    No Active Season
                </h1>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
                    There is no fantasy season running right now, so there is nothing to track yet. Check back when the next season opens.
                </p>
                <Link
                    to="/fantasy"
                    className="px-6 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-sm shadow-md transition active:scale-95"
                >
                    Back to Fantasy
                </Link>
            </div>
        );
    }

    const season = dashboard.season;

    // Deliberate entry is required — never pretend a manager is playing.
    if (!dashboard.entered) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
                    <SparklesIcon className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white mb-2">
                    You Haven't Joined This Season
                </h1>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
                    {season.name} is open, but you haven't entered it yet. Nothing is created for you until you choose to join — head back and enter the season to unlock your dashboard.
                </p>
                <Link
                    to="/fantasy"
                    className="px-6 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-sm shadow-md transition active:scale-95 inline-flex items-center gap-2"
                >
                    Join {season.name} <ArrowRightIcon className="w-4 h-4" />
                </Link>
            </div>
        );
    }

    const team = dashboard.team;
    const lineup = dashboard.lineup;
    const picks: FantasyLineupPick[] = lineup?.picks ?? [];
    const leagues: DashboardLeagueRow[] = dashboard.leagues ?? [];
    const deadlinePassed = dashboard.deadline_passed === true;

    const rank = num(team?.overall_rank);
    const totalManagers = num(team?.total_managers);

    return (
        <div className="space-y-6 md:space-y-8 pb-24">
            {/* Hero: personal progress first */}
            <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-black uppercase tracking-wider mb-2">
                            <TrophyIcon className="w-3.5 h-3.5" /> {season.name}
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tight text-white">
                            {team?.name || 'My Squad'}
                        </h1>
                        <p className="text-xs md:text-sm text-gray-300 mt-1 font-medium">
                            Your weekly home — progress, deadline and standings in one place.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to="/fantasy/my-team"
                            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs uppercase flex items-center gap-2 transition backdrop-blur-md"
                        >
                            <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-400" /> Full Squad
                        </Link>
                        {!deadlinePassed && (
                            <Link
                                to="/fantasy/build"
                                className="px-5 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase flex items-center gap-2 transition active:scale-95 shadow-lg shadow-sffl-red/30"
                            >
                                <PencilSquareIcon className="w-3.5 h-3.5" /> Edit Squad
                            </Link>
                        )}
                    </div>
                </div>

                {/* Rank hero + points */}
                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-white/10 rounded-xl sm:row-span-1">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
                            Overall Rank
                        </span>
                        <span className="text-4xl md:text-5xl font-black text-yellow-400 leading-tight">
                            {rank > 0 ? `#${rank.toLocaleString()}` : '—'}
                        </span>
                        <span className="block text-xs text-gray-300 font-bold mt-0.5">
                            {totalManagers > 0
                                ? `of ${totalManagers.toLocaleString()} manager${totalManagers === 1 ? '' : 's'}`
                                : 'Ranking starts once points are scored'}
                        </span>
                    </div>

                    <div className="p-4 bg-white/10 rounded-xl">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
                            {gameweek ? `Gameweek ${gameweek.number} Points` : 'Gameweek Points'}
                        </span>
                        <span className="text-3xl md:text-4xl font-black text-white leading-tight">
                            {num(team?.gameweek_points).toFixed(2)}
                        </span>
                        <span className="block text-xs text-gray-300 font-bold mt-0.5">This match day</span>
                    </div>

                    <div className="p-4 bg-white/10 rounded-xl">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
                            Season Total
                        </span>
                        <span className="text-3xl md:text-4xl font-black text-emerald-400 leading-tight">
                            {num(team?.total_points).toFixed(2)}
                        </span>
                        <span className="block text-xs text-gray-300 font-bold mt-0.5">All gameweeks</span>
                    </div>
                </div>
            </div>

            {/* Standings — first thing under the hero, by design */}
            <DashboardLeaderboard seasonId={season.id} leagues={leagues} />

            {/* Deadline */}
            <div
                className={`rounded-2xl border p-5 md:p-6 shadow-sm ${
                    deadlinePassed
                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        : 'bg-white dark:bg-gray-800 border-emerald-500/40 dark:border-emerald-500/30'
                }`}
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                                deadlinePassed
                                    ? 'bg-sffl-red/10 dark:bg-sffl-red/20 text-sffl-red'
                                    : 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            }`}
                        >
                            {deadlinePassed ? <LockClosedIcon className="w-6 h-6" /> : <ClockIcon className="w-6 h-6" />}
                        </div>
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                                {gameweek ? `Gameweek ${gameweek.number}` : 'Next Gameweek'}
                                {deadlinePassed ? ' — Locked' : ''}
                            </h2>
                            {deadlinePassed ? (
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed max-w-xl">
                                    The deadline passed on <strong>{formatDeadline(gameweek?.deadline)}</strong>. Your squad is fixed for this gameweek and is now scoring live — changes reopen for the next gameweek.
                                </p>
                            ) : (
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed max-w-xl">
                                    Deadline: <strong>{formatDeadline(gameweek?.deadline)}</strong>
                                    {countdown ? (
                                        <>
                                            {' '}
                                            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                                                ({countdown} left)
                                            </span>
                                        </>
                                    ) : null}
                                    . Squads lock {num(season.lock_mins_before)} minutes before kickoff.
                                </p>
                            )}
                        </div>
                    </div>

                    {!deadlinePassed && (
                        <Link
                            to="/fantasy/build"
                            className="shrink-0 px-5 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase flex items-center justify-center gap-2 transition active:scale-95 shadow-md"
                        >
                            <PencilSquareIcon className="w-3.5 h-3.5" /> Edit Squad
                        </Link>
                    )}
                </div>
            </div>

            {/* Squad snapshot */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white flex items-center gap-2">
                        <ShieldCheckIcon className="w-5 h-5 text-sffl-red" /> Squad Snapshot
                    </h2>
                    {picks.length > 0 && (
                        <Link
                            to="/fantasy/my-team"
                            className="text-xs text-sffl-red hover:text-[#A52323] font-black uppercase inline-flex items-center gap-1 transition"
                        >
                            Full Squad <ArrowRightIcon className="w-3.5 h-3.5" />
                        </Link>
                    )}
                </div>

                {picks.length === 0 ? (
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center shadow-sm">
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                            No squad is set for {gameweek ? `Gameweek ${gameweek.number}` : 'this gameweek'} yet. Pick your{' '}
                            {num(season.squad_size) > 0 ? `${num(season.squad_size)}-player` : ''} squad to start scoring points.
                        </p>
                        <Link
                            to="/fantasy/build"
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-sm shadow-md transition active:scale-95"
                        >
                            Build My Squad <ArrowRightIcon className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-gray-100 dark:divide-gray-700">
                            {picks.map((pick, idx) => (
                                <div
                                    key={`${pick.slot}-${pick.player_id ?? idx}`}
                                    className="px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-[10px] font-black px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-200 shrink-0">
                                            {pick.slot}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                {pick.player_name || 'Unnamed player'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {pick.team_short_name || pick.team_name || '—'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-black text-sffl-red shrink-0">
                                        {num(pick.points).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* My leagues */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white flex items-center gap-2">
                        <UserGroupIcon className="w-5 h-5 text-sffl-red" /> My Leagues
                    </h2>
                    <Link
                        to="/fantasy/leagues"
                        className="text-xs text-sffl-red hover:text-[#A52323] font-black uppercase inline-flex items-center gap-1 transition"
                    >
                        Browse Leagues <ArrowRightIcon className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {leagues.length === 0 ? (
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-lg mx-auto mb-4 leading-relaxed">
                            You're not in any mini-leagues — and you don't have to be. <strong>Mini-leagues are entirely optional and separate from playing the season.</strong> Your squad already scores points and climbs the overall rankings without one.
                        </p>
                        <Link
                            to="/fantasy/leagues"
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-sffl-red hover:text-white text-gray-700 dark:text-gray-200 font-bold text-sm transition shadow-sm"
                        >
                            Browse or Create a League <ArrowRightIcon className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {leagues.map((l, idx) => (
                            <Link
                                key={l.league_id ?? idx}
                                to={`/fantasy/leaderboard/${l.league_id}`}
                                className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-sffl-red/50 rounded-2xl shadow-sm flex items-center justify-between gap-3 transition"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                            {l.type || 'LEAGUE'}
                                        </span>
                                        {num(l.entry_fee_kobo) > 0 && (
                                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                                Entry {formatKobo(num(l.entry_fee_kobo))}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1.5 truncate">
                                        {l.name || 'Unnamed league'}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {num(l.my_rank) > 0
                                            ? `Rank ${num(l.my_rank).toLocaleString()} of ${num(l.member_count).toLocaleString()}`
                                            : `${num(l.member_count).toLocaleString()} member${num(l.member_count) === 1 ? '' : 's'} • unranked so far`}
                                    </p>
                                </div>
                                <ArrowRightIcon className="w-4 h-4 text-gray-400 shrink-0" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
