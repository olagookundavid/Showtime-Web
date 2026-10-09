import { useMemo, useState } from 'react';
import { TrophyIcon, UserCircleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { DataTable, type Column } from '../ui';
import type { POTWNominee, POTWPoll } from '../../types';
import { formatShare } from './potwUtils';

// Single-series charts: one navy hue on light surfaces, a lighter blue step on
// dark ones (both validated >= 3:1 against their surface). The unfilled track is
// a light step of the surface. The winner is marked with an icon and a label,
// never by colour alone.
const BAR_FILL = 'bg-sffl-navy dark:bg-blue-400';
const BAR_TRACK = 'bg-gray-100 dark:bg-gray-700';

const formatDay = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const votesLabel = (n: number) => `${n.toLocaleString()} vote${n === 1 ? '' : 's'}`;

export const NomineeAvatar = ({ nominee, size = 'md' }: { nominee: POTWNominee; size?: 'sm' | 'md' | 'lg' }) => {
    const cls = size === 'lg' ? 'w-20 h-20' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
    return nominee.image ? (
        <img src={nominee.image} alt="" className={`${cls} rounded-full object-cover object-top bg-gray-200 dark:bg-gray-700 shrink-0`} />
    ) : (
        <div className={`${cls} rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 flex items-center justify-center shrink-0`}>
            <UserCircleIcon className="w-3/4 h-3/4" aria-hidden="true" />
        </div>
    );
};

/**
 * Vote share per nominee as horizontal bars, biggest share first. `showCounts`
 * (admins) adds the raw vote numbers to the tooltip; fans see percentages only.
 */
const VoteShareBars = ({ nominees, showCounts }: { nominees: POTWNominee[]; showCounts: boolean }) => {
    const [active, setActive] = useState<string | null>(null);
    const rows = useMemo(
        () =>
            [...nominees].sort(
                (a, b) => (b.percent ?? 0) - (a.percent ?? 0) || (b.votes ?? 0) - (a.votes ?? 0) || a.display_order - b.display_order,
            ),
        [nominees],
    );

    return (
        <ul className="space-y-3">
            {rows.map((n) => {
                const pct = n.percent ?? 0;
                const share = formatShare(pct);
                const isActive = active === n.player_id;
                return (
                    <li
                        key={n.player_id}
                        tabIndex={0}
                        onMouseEnter={() => setActive(n.player_id)}
                        onMouseLeave={() => setActive(null)}
                        onFocus={() => setActive(n.player_id)}
                        onBlur={() => setActive(null)}
                        aria-label={`${n.name}: ${showCounts ? `${votesLabel(n.votes ?? 0)}, ` : ''}${share}%${n.is_winner ? ', winner' : ''}`}
                        className="relative rounded-lg p-1 -m-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sffl-red"
                    >
                        <div className="flex items-center gap-2 mb-1.5 min-w-0">
                            <NomineeAvatar nominee={n} size="sm" />
                            <span className="min-w-0 truncate text-sm font-bold text-gray-900 dark:text-white">{n.name}</span>
                            {n.is_winner && (
                                <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                    <TrophyIcon className="w-4 h-4" aria-hidden="true" />
                                    Winner
                                </span>
                            )}
                            <span className="ml-auto shrink-0 text-sm font-black text-gray-900 dark:text-white">{share}%</span>
                        </div>
                        <div className={`h-3 w-full rounded-full ${BAR_TRACK}`} aria-hidden="true">
                            <div
                                className={`h-3 rounded-full ${BAR_FILL} transition-[width] duration-500`}
                                style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                            />
                        </div>
                        {isActive && (
                            <div
                                role="tooltip"
                                className="absolute right-0 -top-9 z-10 whitespace-nowrap rounded-lg bg-gray-900 dark:bg-gray-100 px-2.5 py-1.5 text-xs font-bold text-white dark:text-gray-900 shadow-lg"
                            >
                                {n.name} · {showCounts ? `${votesLabel(n.votes ?? 0)} · ` : ''}{share}%
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};

/** Votes cast per day, as columns with the count on each cap. */
const VotesByDayColumns = ({ days }: { days: { day: string; votes: number }[] }) => {
    const [active, setActive] = useState<string | null>(null);
    const max = Math.max(1, ...days.map((d) => d.votes));

    return (
        <div>
            <div className="flex items-end gap-2 sm:gap-3 h-36 border-b border-gray-200 dark:border-gray-700 overflow-x-auto pb-px">
                {days.map((d) => {
                    const height = Math.max(4, Math.round((d.votes / max) * 112));
                    const isActive = active === d.day;
                    return (
                        <div
                            key={d.day}
                            tabIndex={0}
                            onMouseEnter={() => setActive(d.day)}
                            onMouseLeave={() => setActive(null)}
                            onFocus={() => setActive(d.day)}
                            onBlur={() => setActive(null)}
                            aria-label={`${formatDay(d.day)}: ${votesLabel(d.votes)}`}
                            className="relative flex flex-col items-center justify-end min-w-10 flex-1 h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sffl-red rounded-md"
                        >
                            <span className="text-xs font-bold text-gray-900 dark:text-white mb-1">{d.votes}</span>
                            <div className={`w-full max-w-6 rounded-t ${BAR_FILL}`} style={{ height }} aria-hidden="true" />
                            {isActive && (
                                <div
                                    role="tooltip"
                                    className="absolute -top-8 z-10 whitespace-nowrap rounded-lg bg-gray-900 dark:bg-gray-100 px-2.5 py-1.5 text-xs font-bold text-white dark:text-gray-900 shadow-lg"
                                >
                                    {formatDay(d.day)} · {votesLabel(d.votes)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="flex gap-2 sm:gap-3 mt-1.5 overflow-hidden" aria-hidden="true">
                {days.map((d) => (
                    <span key={d.day} className="min-w-10 flex-1 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 truncate">
                        {formatDay(d.day)}
                    </span>
                ))}
            </div>
        </div>
    );
};

const NO_ROWS: POTWNominee[] = [];

interface POTWResultsProps {
    poll: POTWPoll;
    title?: string;
    /**
     * Admins: the full breakdown — total votes, winner, vote counts, votes per
     * day and a results table. Fans (the default) see only each nominee's
     * percentage share; the API sends them no counts at all.
     */
    detailed?: boolean;
}

/** The result of a Player of the Week vote. */
export const POTWResults = ({ poll, title = 'Share of the vote', detailed = false }: POTWResultsProps) => {
    const winner = poll.nominees.find((n) => n.is_winner);
    const decidedByAdmin = poll.winner_source === 'ADMIN';
    // Fans get percentages but no totals, so "any votes?" reads off the shares.
    const hasVotes = poll.total_votes > 0 || poll.nominees.some((n) => (n.percent ?? 0) > 0);

    const columns = useMemo<Column<POTWNominee>[]>(
        () => [
            {
                header: 'Player',
                accessor: 'name',
                sortable: true,
                cell: (n) => (
                    <div className="flex items-center gap-2.5 min-w-0">
                        <NomineeAvatar nominee={n} size="sm" />
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white">
                                <span className="truncate">{n.name}</span>
                                {n.is_winner && <TrophyIcon className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-300" aria-label="Winner" />}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.team_name || '—'}</div>
                        </div>
                    </div>
                ),
            },
            { header: 'Votes', accessor: 'votes', sortable: true, align: 'right', sortValue: (n) => n.votes ?? 0, cell: (n) => (n.votes ?? 0).toLocaleString() },
            { header: 'Share', accessor: 'percent', sortable: true, align: 'right', sortValue: (n) => n.percent ?? 0, cell: (n) => `${formatShare(n.percent)}%` },
            { header: 'TOTW rating', accessor: 'rating', sortable: true, align: 'right', cell: (n) => (n.rating ? n.rating.toFixed(1) : '—') },
        ],
        [],
    );

    const sortedRows = useMemo(
        () => (poll.nominees.length ? [...poll.nominees].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)) : NO_ROWS),
        [poll.nominees],
    );

    if (!detailed) {
        return (
            <section
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5"
                aria-labelledby={`potw-results-${poll.id}`}
            >
                <h2 id={`potw-results-${poll.id}`} className="text-lg sm:text-xl font-black text-sffl-navy dark:text-white">
                    {title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Percentage of all votes each nominee received</p>
                {hasVotes ? (
                    <VoteShareBars nominees={poll.nominees} showCounts={false} />
                ) : (
                    <p className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No votes were cast in this poll.
                    </p>
                )}
            </section>
        );
    }

    return (
        <section className="space-y-6" aria-labelledby={`potw-results-${poll.id}`}>
            <h2 id={`potw-results-${poll.id}`} className="text-lg sm:text-xl font-black text-sffl-navy dark:text-white">
                {title}
            </h2>

            {/* Headline figures */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total votes</p>
                    <p className="mt-1 text-3xl font-black text-gray-900 dark:text-white">{poll.total_votes.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 min-w-0">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Player of the Week</p>
                    <p className="mt-1 text-lg font-black text-gray-900 dark:text-white truncate">{winner?.name || 'Not decided'}</p>
                    {winner?.percent !== undefined && !decidedByAdmin && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatShare(winner.percent)}% of the vote</p>
                    )}
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Decided by</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-lg font-black text-gray-900 dark:text-white">
                        {decidedByAdmin ? (
                            <>
                                <ShieldCheckIcon className="w-5 h-5" aria-hidden="true" />
                                League office
                            </>
                        ) : winner ? (
                            'Fan vote'
                        ) : (
                            '—'
                        )}
                    </p>
                    {decidedByAdmin && <p className="text-xs text-gray-500 dark:text-gray-400">The fan vote is shown for reference</p>}
                </div>
            </div>

            {!hasVotes ? (
                <p className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No votes were cast in this poll.
                </p>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">Share of the vote</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Percentage of all votes each nominee received</p>
                        <VoteShareBars nominees={poll.nominees} showCounts />
                    </div>
                    {poll.votes_by_day && poll.votes_by_day.length > 0 && (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white">Votes per day</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">When fans cast their votes</p>
                            <VotesByDayColumns days={poll.votes_by_day} />
                        </div>
                    )}
                </div>
            )}

            <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white mb-2">All results</h3>
                <DataTable
                    data={sortedRows}
                    columns={columns}
                    getRowId={(n) => n.player_id}
                    searchable={false}
                    paginated={false}
                    compact
                    emptyMessage="No nominees in this poll."
                />
            </div>
        </section>
    );
};
