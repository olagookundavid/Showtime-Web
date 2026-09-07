import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    BanknotesIcon,
    UserGroupIcon,
    MagnifyingGlassIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    ArrowLeftIcon,
    MinusIcon,
    LockClosedIcon,
} from '@heroicons/react/24/outline';
import {
    fantasyApi,
    fantasySquadApi,
    formatFantasyPrice as sc,
    type FantasyPlayerListItem,
    type MarketSort,
    type Squad,
    type SquadPlayer,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { useDebounced } from '../../hooks/useDebounced';

const num = (v: number | null | undefined): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0;

const isFemale = (g?: string): boolean => (g || '').toUpperCase().startsWith('F');

/** The side of the ball a player's female quota is counted against. Mirrors
 *  UnitForPosition on the server — the quotas are per unit, so a female receiver
 *  and a female defender are not interchangeable cover. */
const unitOf = (position: string): 'offense' | 'defense' =>
    position === 'Rusher' || position === 'Defender' ? 'defense' : 'offense';

export function FantasyTrading() {
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<'squad' | 'market'>('squad');
    const [confirmSell, setConfirmSell] = useState<SquadPlayer | null>(null);

    const { data: season } = useQuery({
        queryKey: ['fantasySeason'],
        queryFn: fantasyApi.getActiveSeason,
    });
    const seasonId = season?.id;

    const { data: squad, isLoading } = useQuery({
        queryKey: ['fantasySquad', seasonId],
        queryFn: () => fantasySquadApi.getSquad(seasonId as string),
        enabled: !!seasonId,
    });

    const refresh = (next: Squad) => {
        queryClient.setQueryData(['fantasySquad', seasonId], next);
        // The squad drives the dashboard and the lineup, so both are stale now.
        queryClient.invalidateQueries({ queryKey: ['fantasyDashboard'] });
        queryClient.invalidateQueries({ queryKey: ['fantasyLineup'] });
    };

    const buyMutation = useMutation({
        mutationFn: (playerId: string) => fantasySquadApi.buyPlayer(seasonId as string, playerId),
        onSuccess: (next) => {
            refresh(next);
            toast.success('Signed.');
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || 'Could not sign this player.'),
    });

    const sellMutation = useMutation({
        mutationFn: (playerId: string) => fantasySquadApi.sellPlayer(seasonId as string, playerId),
        onSuccess: (next) => {
            refresh(next);
            setConfirmSell(null);
            toast.success('Sold — the money is back in your bank.');
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || 'Could not sell this player.'),
    });


    const starters = (squad?.players ?? []).filter((p) => p.starting);
    const subs = (squad?.players ?? []).filter((p) => !p.starting);

    // The market shuts while a match day is being played. Undefined when open,
    // so it doubles as the `title` on every disabled control.
    const marketClosed = squad && !squad.market_open
        ? squad.market_closed_reason || 'The transfer market is closed while a match day is being played.'
        : undefined;

    if (isLoading || !season) return <Loader />;

    if (!squad) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
                <h1 className="text-2xl font-black uppercase text-sffl-navy dark:text-white mb-2">No Squad Yet</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                    Join the season before building a squad.
                </p>
                <Link to="/fantasy" className="px-6 py-2.5 rounded-xl bg-sffl-red text-white font-bold text-sm">
                    Back to Fantasy
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24">
            {/* Header + the money */}
            <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-6 md:p-8">
                <Link
                    to="/fantasy/dashboard"
                    className="inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-white mb-3 font-semibold"
                >
                    <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to Dashboard
                </Link>
                <h1 className="text-2xl sm:text-4xl font-black italic uppercase tracking-tight">Transfer Market</h1>
                <p className="text-xs md:text-sm text-gray-300 mt-1">
                    Buy the players you want, sell the ones you don't. Money back goes straight into your bank.
                </p>

                {marketClosed && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-400/15 border border-amber-400/30 p-3">
                        <LockClosedIcon className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                                Market closed
                            </p>
                            <p className="text-[11px] text-amber-100/90 mt-0.5">
                                {marketClosed} Your squad is frozen exactly as it was at the deadline, so the
                                points these players earn today are yours whatever you do next.
                            </p>
                        </div>
                    </div>
                )}

                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-4 bg-white/10 rounded-xl">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">In the bank</span>
                        <span className="text-2xl md:text-3xl font-black text-yellow-400">{sc(squad.bank)}</span>
                    </div>
                    <div className="p-4 bg-white/10 rounded-xl">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">Squad value</span>
                        <span className="text-2xl md:text-3xl font-black text-emerald-400">{sc(squad.squad_value)}</span>
                    </div>
                    <div className="p-4 bg-white/10 rounded-xl">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">Squad size</span>
                        <span className="text-2xl md:text-3xl font-black text-white">
                            {squad.squad_size}
                            <span className="text-sm text-gray-300 font-bold"> / {squad.squad_max}</span>
                        </span>
                    </div>
                    <div className="p-4 bg-white/10 rounded-xl">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">Starting / subs</span>
                        <span className="text-2xl md:text-3xl font-black text-white">
                            {squad.starters}
                            <span className="text-sm text-gray-300 font-bold"> + {squad.subs}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* The rules, stated where the trading happens rather than a page away. */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
                <h2 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2 mb-3">
                    <InformationCircleIcon className="w-4 h-4 text-sffl-red" /> What your squad has to satisfy
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-700 dark:text-gray-200">
                    <li>
                        <span className="font-black">{squad.squad_min}–{squad.squad_max} players</span>, all bought
                        out of your {sc(squad.rules.budget)} budget.
                    </li>
                    <li>
                        <span className="font-black">{squad.starting_xi} start</span> each match day. Subs score
                        nothing until you bring them in.
                    </li>
                    <li>
                        At least <span className="font-black">{squad.rules.min_female_offense} women on offense</span>{' '}
                        (QB, receivers, centers) — you have{' '}
                        <span className={squad.female_offense <= squad.rules.min_female_offense ? 'font-black text-amber-600 dark:text-amber-400' : 'font-black'}>
                            {squad.female_offense}
                        </span>.
                    </li>
                    <li>
                        At least <span className="font-black">{squad.rules.min_female_defense} women on defense</span>{' '}
                        (rushers, defenders) — you have{' '}
                        <span className={squad.female_defense <= squad.rules.min_female_defense ? 'font-black text-amber-600 dark:text-amber-400' : 'font-black'}>
                            {squad.female_defense}
                        </span>.
                    </li>
                    <li>
                        No more than <span className="font-black">{squad.rules.max_per_club}</span> players from any
                        one club.
                    </li>
                    <li>You can swap subs in and out for free, up to each gameweek deadline.</li>
                </ul>

            </div>

            {/* The checklist. Advice, not a gate — you can own any nineteen
                players you like; this is what the starting fourteen will demand
                of them when you come to pick it. */}
            <ReadinessChecklist squad={squad} />

            {/* Tabs */}
            <div className="flex gap-2">
                {(['squad', 'market'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                            tab === t
                                ? 'bg-sffl-navy text-white shadow-sm'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                        {t === 'squad' ? `My Squad (${squad.squad_size})` : 'Buy Players'}
                    </button>
                ))}
            </div>

            {tab === 'squad' ? (
                <div className="space-y-6">
                    <SquadSection
                        title={`Starting ${squad.starting_xi}`}
                        hint="These score this match day."
                        players={starters}
                        onSell={setConfirmSell}
                        marketClosed={marketClosed}
                    />
                    <SquadSection
                        title={`Substitutes (${subs.length})`}
                        hint="Cover. They score nothing until you bring them into the lineup."
                        players={subs}
                        onSell={setConfirmSell}
                        marketClosed={marketClosed}
                    />
                </div>
            ) : (
                <PlayerMarket
                    seasonId={seasonId as string}
                    squad={squad}
                    onBuy={(id) => buyMutation.mutate(id)}
                    onSell={(p) => setConfirmSell(p)}
                    buying={buyMutation.isPending}
                    marketClosed={marketClosed}
                />
            )}

            {confirmSell && (
                <SellConfirmation
                    player={confirmSell}
                    squad={squad}
                    pending={sellMutation.isPending}
                    onCancel={() => setConfirmSell(null)}
                    onConfirm={() => sellMutation.mutate(confirmSell.player_id)}
                />
            )}
        </div>
    );
}

/**
 * The squad checklist — the "tree" a manager works down while assembling a
 * squad, in the shape a password strength meter uses.
 *
 * Nothing here blocks anything. The squad itself is unrestricted: own nineteen
 * defenders if you want. These are the demands the starting fourteen will make
 * when you come to pick it, shown while there is still time to do something
 * about them.
 */

/** Ordering options. Every one is applied by the server — the list is far too
 *  long to sort in the browser, and a sort over one loaded page would be a lie. */
const SORTS: { key: MarketSort; label: string }[] = [
    { key: '', label: 'Price ▾' },
    { key: 'price_asc', label: 'Price ▴' },
    { key: 'rating', label: 'Highest rated' },
    { key: 'points', label: 'Most points' },
    { key: 'owned', label: 'Most owned' },
    { key: 'transfers_in', label: 'Most bought' },
    { key: 'transfers_out', label: 'Most sold' },
];

const POSITIONS: { key: string; label: string }[] = [
    { key: '', label: 'All' },
    { key: 'QB', label: 'QB' },
    { key: 'Receiver,Center', label: 'Receiver' },
    { key: 'Rusher', label: 'Rusher' },
    { key: 'Defender', label: 'Defender' },
];

/**
 * The transfer market: every player in the season, one long scrolling list.
 *
 * It pages on the server and appends as you reach the bottom rather than
 * offering page buttons — a market is something you scan, not something you
 * navigate. Search, position and ordering are all server-side for the same
 * reason: sorting the rows that happen to be loaded would quietly hide the
 * player you were looking for.
 */
function PlayerMarket({
    seasonId,
    squad,
    onBuy,
    onSell,
    buying,
    marketClosed,
}: {
    seasonId: string;
    squad: Squad;
    onBuy: (playerId: string) => void;
    onSell: (player: SquadPlayer) => void;
    buying: boolean;
    marketClosed?: string;
}) {
    const [searchInput, setSearchInput] = useState('');
    const search = useDebounced(searchInput);
    const [position, setPosition] = useState('');
    const [gender, setGender] = useState<'' | 'M' | 'F'>('');
    const [sort, setSort] = useState<MarketSort>('');

    const query = useInfiniteQuery({
        queryKey: ['fantasyMarket', seasonId, search, position, gender, sort],
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            fantasyApi.listPlayerMarket(seasonId, {
                search: search || undefined,
                position: position || undefined,
                gender: gender || undefined,
                sort: sort || undefined,
                page: pageParam as number,
                limit: 25,
            }),
        getNextPageParam: (last, pages) =>
            pages.length < (last.total_pages || 1) ? pages.length + 1 : undefined,
    });

    const players = (query.data?.pages ?? []).flatMap((p) => p.data ?? []);
    const total = query.data?.pages?.[0]?.total ?? 0;

    // Loading the next page when the sentinel scrolls into view is what makes
    // this feel like a market rather than a paginated table.
    const sentinel = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = sentinel.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
                    query.fetchNextPage();
                }
            },
            { rootMargin: '400px' },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage, query]);

    const squadByPlayer = useMemo(() => {
        const m = new Map<string, SquadPlayer>();
        for (const p of squad.players) m.set(p.player_id, p);
        return m;
    }, [squad.players]);

    const full = squad.squad_size >= squad.squad_max;

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
                <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search every player in the season..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red"
                    />
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {POSITIONS.map((p) => (
                        <FilterChip key={p.key} active={position === p.key} onClick={() => setPosition(p.key)}>
                            {p.label}
                        </FilterChip>
                    ))}
                    <span className="w-px bg-gray-200 dark:bg-gray-600 mx-1" />
                    {([['', 'Any'], ['M', 'Men'], ['F', 'Women']] as const).map(([k, l]) => (
                        <FilterChip key={k} active={gender === k} onClick={() => setGender(k)}>
                            {l}
                        </FilterChip>
                    ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {SORTS.map((o) => (
                        <FilterChip key={o.key || 'default'} active={sort === o.key} onClick={() => setSort(o.key)}>
                            {o.label}
                        </FilterChip>
                    ))}
                </div>

                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {total.toLocaleString()} player{total === 1 ? '' : 's'} · you have{' '}
                    <span className="font-black text-gray-900 dark:text-white">{sc(squad.bank)}</span> to spend
                    {full && <span className="text-amber-600 dark:text-amber-400 font-bold"> · squad full</span>}
                </p>
            </div>

            {query.isLoading ? (
                <div className="p-10"><Loader /></div>
            ) : players.length === 0 ? (
                <div className="p-10 text-center text-xs text-gray-500 dark:text-gray-400">
                    No players match that search.
                </div>
            ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {players.map((p) => (
                        <MarketRow
                            key={p.player_id}
                            player={p}
                            owned={squadByPlayer.get(p.player_id)}
                            affordable={num(p.price) <= num(squad.bank)}
                            squadFull={full}
                            busy={buying}
                            onBuy={() => onBuy(p.player_id)}
                            onSell={onSell}
                            marketClosed={marketClosed}
                        />
                    ))}
                </div>
            )}

            <div ref={sentinel} />
            {query.isFetchingNextPage && (
                <div className="p-4 text-center text-[11px] text-gray-500 dark:text-gray-400">Loading more…</div>
            )}
            {!query.hasNextPage && players.length > 0 && (
                <div className="p-4 text-center text-[11px] text-gray-400 dark:text-gray-500">
                    That's all {total.toLocaleString()} of them.
                </div>
            )}
        </div>
    );
}

function FilterChip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer ${
                active
                    ? 'bg-sffl-navy text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
        >
            {children}
        </button>
    );
}

/** One row of the market, in the shape a transfer list takes: face, name, who
 *  they play for, what they are worth, and the one action available. */
function MarketRow({
    player,
    owned,
    affordable,
    squadFull,
    busy,
    onBuy,
    onSell,
    marketClosed,
}: {
    player: FantasyPlayerListItem;
    owned?: SquadPlayer;
    affordable: boolean;
    squadFull: boolean;
    busy: boolean;
    onBuy: () => void;
    onSell: (p: SquadPlayer) => void;
    marketClosed?: string;
}) {
    const female = isFemale(player.gender);

    return (
        <div className="p-3 sm:p-4 flex items-center gap-3">
            {/* Face. Falls back to initials rather than a broken image box. */}
            <Link to={`/players/${player.player_id}`} className="shrink-0">
                {player.player_image ? (
                    <img
                        src={player.player_image}
                        alt=""
                        className="w-11 h-11 rounded-xl object-cover bg-gray-100 dark:bg-gray-700"
                    />
                ) : (
                    <span className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-black text-gray-400">
                        {player.player_name.slice(0, 2).toUpperCase()}
                    </span>
                )}
            </Link>

            <div className="min-w-0 flex-1">
                <Link
                    to={`/players/${player.player_id}`}
                    className="text-sm font-bold text-gray-900 dark:text-white hover:text-sffl-red transition truncate block"
                >
                    {player.player_name}
                </Link>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {player.team_logo && (
                        <img src={player.team_logo} alt="" className="w-3.5 h-3.5 object-contain" />
                    )}
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        {player.team_short_name || player.team_name || '—'}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">{player.position}</span>
                    <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            female
                                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        {female ? 'W' : 'M'}
                    </span>
                    {owned && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            {owned.starting ? 'Starting' : 'Sub'}
                        </span>
                    )}
                </div>
            </div>

            <div className="hidden sm:flex flex-col items-end shrink-0 w-16">
                <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500">Rating</span>
                <span className="text-sm font-black tabular-nums text-gray-900 dark:text-white">
                    {num(player.rating).toFixed(1)}
                </span>
            </div>

            <div className="hidden md:flex flex-col items-end shrink-0 w-20">
                <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500">Owned</span>
                <span className="text-sm font-black tabular-nums text-gray-900 dark:text-white">
                    {num(player.selected_by_pct).toFixed(0)}%
                </span>
            </div>

            <div className="flex flex-col items-end shrink-0">
                <span className="text-sm font-black tabular-nums text-gray-900 dark:text-white">
                    {sc(player.price)}
                </span>
                {owned ? (
                    <button
                        onClick={() => onSell(owned)}
                        disabled={!!marketClosed}
                        title={marketClosed}
                        className="mt-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-red-600 hover:text-white text-gray-700 dark:text-gray-200 font-black text-[10px] uppercase transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        Sell
                    </button>
                ) : (
                    <button
                        onClick={onBuy}
                        disabled={!affordable || squadFull || busy || !!marketClosed}
                        title={
                            marketClosed ? marketClosed
                                : squadFull ? 'Your squad is full'
                                : !affordable ? 'Not enough in the bank'
                                : undefined
                        }
                        className="mt-1 px-3 py-1.5 rounded-lg bg-sffl-red hover:bg-[#A52323] text-white font-black text-[10px] uppercase transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        Buy
                    </button>
                )}
            </div>
        </div>
    );
}

function ReadinessChecklist({ squad }: { squad: Squad }) {
    const { readiness } = squad;
    const met = readiness.requirements.filter((r) => r.met).length;
    const total = readiness.requirements.length;

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                        Can you field a team?
                    </h2>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        A guide, not a restriction — your squad can hold anyone. These are the rules your
                        starting {squad.starting_xi} has to satisfy.
                    </p>
                </div>
                <span
                    className={`shrink-0 text-[11px] font-black uppercase px-3 py-1.5 rounded-full ${
                        readiness.ready
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                    }`}
                >
                    {met}/{total}
                </span>
            </div>

            {readiness.forfeits && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800 flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
                    <div>
                        <p className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-300">
                            You would score nothing on match day
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                            A squad under {squad.squad_min} cannot put out a team sheet. Anyone short on the
                            deadline forfeits their points for that match day.
                        </p>
                    </div>
                </div>
            )}

            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {readiness.requirements.map((r) => (
                    <li key={r.key} className="px-4 py-3 flex items-start gap-3">
                        <span
                            className={`mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black ${
                                r.met
                                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                            }`}
                            aria-hidden
                        >
                            {r.met ? '✓' : '·'}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p
                                className={`text-sm font-bold ${
                                    r.met
                                        ? 'text-gray-900 dark:text-white'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                {r.label}
                                <span className="ml-2 text-xs font-black tabular-nums">
                                    <span className={r.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                                        {r.have}
                                    </span>
                                    <span className="text-gray-400"> / {r.need}</span>
                                </span>
                            </p>
                            {r.hint && (
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{r.hint}</p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {!readiness.ready && !readiness.forfeits && readiness.blocker && (
                <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{readiness.blocker}</p>
                </div>
            )}
        </div>
    );
}

function SquadSection({
    title,
    hint,
    players,
    onSell,
    marketClosed,
}: {
    title: string;
    hint: string;
    players: SquadPlayer[];
    onSell: (p: SquadPlayer) => void;
    /** Set while a match day is in progress — Sell is disabled, not hidden, so
     *  the squad still reads normally and the reason is on the button. */
    marketClosed?: string;
}) {
    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                    <UserGroupIcon className="w-4 h-4 text-sffl-red" /> {title}
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>
            </div>

            {players.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500 dark:text-gray-400">Nobody here yet.</div>
            ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {players.map((p) => (
                        <div key={p.player_id} className="p-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                    {p.name}
                                    {isFemale(p.gender) && (
                                        <span className="ml-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                            {unitOf(p.position)} quota
                                        </span>
                                    )}
                                </p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    {p.position} · bought at {sc(p.purchase_price)}
                                    {num(p.current_price) !== num(p.purchase_price) && (
                                        <span
                                            className={
                                                num(p.current_price) > num(p.purchase_price)
                                                    ? ' text-emerald-600 dark:text-emerald-400 font-bold'
                                                    : ' text-red-600 dark:text-red-400 font-bold'
                                            }
                                        >
                                            {' '}· now {sc(p.current_price)}
                                        </span>
                                    )}
                                </p>
                                {p.breaks_lineup && (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-bold">
                                        Selling them leaves you unable to field a legal fourteen.
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => onSell(p)}
                                disabled={!!marketClosed}
                                title={marketClosed}
                                className="shrink-0 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-red-600 hover:text-white text-gray-700 dark:text-gray-200 font-black text-[11px] uppercase flex items-center gap-1 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-100 dark:disabled:hover:bg-gray-700 dark:disabled:hover:text-gray-200 disabled:hover:text-gray-700 cursor-pointer"
                            >
                                <MinusIcon className="w-3.5 h-3.5" /> Sell {sc(p.sell_price)}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Confirmation before a sale.
 *
 * Selling a woman always stops for a word, whether or not the squad would still
 * be legal afterwards: the female minimums are per unit, so the cover that looks
 * plentiful on offense does nothing for a hole on defense, and a replacement may
 * cost more than the sale brings in. The quotas are restated here with the
 * manager's actual counts rather than left for them to remember.
 */
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
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full max-w-md rounded-3xl p-6 shadow-2xl max-h-[calc(100dvh-var(--chrome-h)-2rem)] overflow-y-auto">
                <h3 className="text-lg font-black text-sffl-navy dark:text-white uppercase">
                    Sell {player.name}?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    You'll get <span className="font-black text-emerald-600 dark:text-emerald-400">{sc(player.sell_price)}</span>{' '}
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
                        className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-black text-xs uppercase disabled:opacity-50 transition cursor-pointer"
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
                        {pending ? 'Selling…' : `Sell for ${sc(player.sell_price)}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
