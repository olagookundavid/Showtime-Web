import { Fragment, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
    TrophyIcon,
    CalendarIcon,
    CurrencyDollarIcon,
    PlusIcon,
    ClockIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    BanknotesIcon,
    UsersIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ExclamationTriangleIcon,
    ClipboardDocumentIcon,
    XMarkIcon,
    TrashIcon,
    LockClosedIcon,
    ShieldCheckIcon,
    Cog6ToothIcon,
    ArrowLeftIcon,
    RocketLaunchIcon,
    ChevronRightIcon
} from '@heroicons/react/24/outline';
import {
    fantasyApi,
    fantasyAdminApi,
    formatKobo,
    getCompetitions,
    getEventDays
} from '../../services/api';
import type {
    FantasySeason,
    AdminLeagueRow,
    PayoutRequest,
    PayoutStatus,
    SettlementResult
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';

/** `datetime-local` gives a local wall-clock string; the API wants RFC3339. */
const toRFC3339 = (localValue: string): string => new Date(localValue).toISOString();

/** Formats an RFC3339 instant for a `datetime-local` input, in local time. */
const toDateTimeLocalValue = (isoValue: string): string => {
    const d = new Date(isoValue);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Trails a fast-typing search box so we don't fire a request per keystroke. */
function useDebounced(value: string, ms = 350): string {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return debounced;
}

const ordinal = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

/** "1st" / "Joint 1st (2 way)" when the position was tied. */
const awardPlaceLabel = (rank: number, sharedWith: number): string =>
    sharedWith > 1 ? `Joint ${ordinal(rank)} (${sharedWith} way)` : ordinal(rank);

/**
 * Top level of the page. Payouts sits here rather than inside a season because
 * the payout queue is global — `listPayouts` takes no season id, so nesting it
 * under a season implied a scoping that does not exist.
 */
const TOP_TABS = [
    { key: 'seasons', label: 'Seasons', icon: TrophyIcon },
    { key: 'payouts', label: 'Payouts', icon: CurrencyDollarIcon },
] as const;

type TopTabKey = typeof TOP_TABS[number]['key'];

/** Sub-tabs, only reachable once a specific season has been drilled into. */
const SEASON_TABS = [
    { key: 'setup', label: 'Setup', icon: Cog6ToothIcon },
    { key: 'leagues', label: 'Leagues', icon: TrophyIcon },
    { key: 'managers', label: 'Managers', icon: UsersIcon },
    { key: 'finance', label: 'Finance', icon: BanknotesIcon },
] as const;

type SeasonTabKey = typeof SEASON_TABS[number]['key'];

// ─── Shared presentational bits ──────────────────────────────────────────────

const Spinner = ({ dark = true }: { dark?: boolean }) => (
    <span
        className={`w-4 h-4 border-2 ${dark ? 'border-black' : 'border-white'} border-t-transparent rounded-full animate-spin inline-block`}
    />
);

const SectionCard = ({ title, icon: Icon, children, action }: {
    title: string;
    icon?: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    action?: React.ReactNode;
}) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-700/40">
            <h3 className="text-base font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4 text-sffl-red" />} {title}
            </h3>
            {action}
        </div>
        {children}
    </div>
);

const StatCard = ({ label, value, hint, tone = 'neutral' }: {
    label: string;
    value: string | number;
    hint?: string;
    tone?: 'neutral' | 'yellow' | 'emerald' | 'red';
}) => {
    const toneCls =
        tone === 'yellow' ? 'text-sffl-red' :
        tone === 'emerald' ? 'text-emerald-400' :
        tone === 'red' ? 'text-red-400' : 'text-white';
    return (
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 block">{label}</span>
            <span className={`block mt-1.5 text-xl font-black tabular-nums ${toneCls}`}>{value}</span>
            {hint && <span className="block mt-1 text-[11px] text-gray-400 dark:text-gray-500">{hint}</span>}
        </div>
    );
};

const TypeBadge = ({ type }: { type: 'OVERALL' | 'PUBLIC' | 'PRIVATE' }) => {
    const cls =
        type === 'OVERALL' ? 'bg-yellow-500/10 border-yellow-500/25 text-sffl-red' :
        type === 'PUBLIC' ? 'bg-sky-500/10 border-sky-500/25 text-sky-400' :
        'bg-purple-500/10 border-purple-500/25 text-purple-400';
    return (
        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${cls}`}>
            {type}
        </span>
    );
};

const PaymentBadge = ({ status }: { status: 'FREE' | 'PENDING' | 'PAID' | 'FAILED' }) => {
    const cls =
        status === 'PAID' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' :
        status === 'PENDING' ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400' :
        status === 'FAILED' ? 'bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400' :
        'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300';
    return (
        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${cls}`}>
            {status}
        </span>
    );
};

const PayoutBadge = ({ status }: { status: PayoutStatus }) => {
    const cls =
        status === 'PAID' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' :
        status === 'PENDING' ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400' :
        status === 'PROCESSING' ? 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400' :
        status === 'REJECTED' ? 'bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400' :
        'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300';
    return (
        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${cls}`}>
            {status}
        </span>
    );
};

const SettledBadge = ({ settled }: { settled: boolean }) => (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
        settled
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
            : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
    }`}>
        {settled ? 'Settled' : 'Open'}
    </span>
);

/**
 * A season's status is the single thing that decides whether players can see
 * it at all, so the meaning travels with the badge everywhere it is shown.
 */
const SEASON_STATUS_META: Record<FantasySeason['status'], { cls: string; meaning: string }> = {
    DRAFT: {
        cls: 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400',
        meaning: 'Created but private — players cannot see it',
    },
    ACTIVE: {
        cls: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400',
        meaning: 'Live — players can enter squads',
    },
    COMPLETED: {
        cls: 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300',
        meaning: 'Finished — final standings only',
    },
};

const SeasonStatusBadge = ({ status }: { status: FantasySeason['status'] }) => (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${SEASON_STATUS_META[status].cls}`}>
        {status}
    </span>
);

const SearchBox = ({ value, onChange, placeholder }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
}) => (
    <div className="relative w-full sm:w-80">
        <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
        />
    </div>
);

const Pager = ({ page, totalPages, total, onPage }: {
    page: number;
    totalPages: number;
    total: number;
    onPage: (p: number) => void;
}) => (
    <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Page {page} of {Math.max(totalPages, 1)} · {total} total
        </span>
        <div className="flex items-center gap-2">
            <button
                onClick={() => onPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-bold uppercase transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
                Prev
            </button>
            <button
                onClick={() => onPage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-bold uppercase transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
                Next
            </button>
        </div>
    </div>
);

/**
 * Deliberate-action gate for anything that moves real money. Everything
 * destructive on this page goes through it rather than a bare click handler.
 */
const ConfirmDialog = ({ open, title, warning, body, confirmLabel, pending, onConfirm, onCancel }: {
    open: boolean;
    title: string;
    warning: string;
    body?: React.ReactNode;
    confirmLabel: string;
    pending?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-200 dark:border-gray-700 bg-red-50/50 dark:bg-red-950/20">
                    <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className="w-6 h-6 text-sffl-red shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-base font-black uppercase tracking-wider text-sffl-navy dark:text-white">{title}</h4>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{warning}</p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition cursor-pointer"
                        aria-label="Cancel"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {body && <div className="p-5 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">{body}</div>}

                <div className="p-5 flex items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs uppercase transition cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={pending}
                        className="px-6 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-sffl-red/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {pending ? <Spinner /> : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

const settlementSummary = (r: SettlementResult): string =>
    `${r.leagues_settled} league(s) settled · ${formatKobo(r.total_awarded_kobo)} credited · ${r.leagues_skipped} skipped`;

// ─── Page ────────────────────────────────────────────────────────────────────

export function AdminFantasy() {
    const [topTab, setTopTab] = useState<TopTabKey>('seasons');
    // `null` is the seasons index; a season id drills into that season.
    const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

    // Admin must load every season, not just the active one: a season is
    // created as DRAFT, so getActiveSeason would return null and there would be
    // no way to reach the Release action for the season just created.
    const { data: seasons = [], isLoading: seasonLoading } = useQuery({
        queryKey: ['adminFantasySeason'],
        queryFn: fantasyAdminApi.listSeasons,
    });

    // Falls back to the index if the drilled-into season disappears (deleted).
    const selectedSeason = seasons.find(s => s.id === selectedSeasonId) ?? null;

    if (seasonLoading) {
        return <Loader />;
    }

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-gray-900 dark:text-white">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-5">
                <h1 className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white flex items-center gap-2">
                    <TrophyIcon className="w-6 h-6 text-sffl-red" /> Fantasy League Operations
                </h1>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Every fantasy season you run, and the manual payout queue that spans all of them.
                </p>
            </div>

            {/* Top-level tab bar */}
            <div className="flex flex-wrap gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl p-2 shadow-sm">
                {TOP_TABS.map(({ key, label, icon: Icon }) => {
                    const active = topTab === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTopTab(key)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer ${
                                active
                                    ? 'bg-yellow-500 text-black shadow-lg shadow-sffl-red/20'
                                    : 'bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 hover:text-white hover:bg-neutral-800'
                            }`}
                        >
                            <Icon className="w-4 h-4" /> {label}
                        </button>
                    );
                })}
            </div>

            {topTab === 'payouts' && <PayoutsTab />}

            {topTab === 'seasons' && (
                selectedSeason
                    ? <SeasonDetail season={selectedSeason} onBack={() => setSelectedSeasonId(null)} />
                    : <SeasonsIndex seasons={seasons} onManage={setSelectedSeasonId} />
            )}
        </div>
    );
}

// ─── Release (activate) — shared by the index row and the detail header ───────

/**
 * "Release" is the admin-facing word for activating a DRAFT: it is the moment
 * the season becomes visible to every player, so both call sites confirm first.
 */
function useReleaseSeasonMutation(onDone?: () => void) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (seasonId: string) => fantasyApi.adminActivateSeason(seasonId),
        onSuccess: () => {
            toast.success('Season released — players can see it now.');
            queryClient.invalidateQueries({ queryKey: ['adminFantasySeason'] });
            onDone?.();
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err.message),
    });
}

const ReleaseConfirm = ({ season, open, pending, onCancel, onConfirm }: {
    season: FantasySeason;
    open: boolean;
    pending: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) => (
    <ConfirmDialog
        open={open}
        title={`Release ${season.name}?`}
        warning="Releasing publishes this season to every player on the site."
        confirmLabel="Yes, Release Season"
        pending={pending}
        onCancel={onCancel}
        onConfirm={onConfirm}
        body={
            <div className="space-y-2 text-sm">
                <p>
                    The season moves from <strong>DRAFT</strong> to <strong>ACTIVE</strong>. Players will
                    immediately see it and can start entering squads.
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    After releasing, initialize player prices and schedule at least one gameweek —
                    without an open gameweek managers still cannot pick a squad.
                </p>
            </div>
        }
    />
);

// ─── Seasons index ───────────────────────────────────────────────────────────

function SeasonsIndex({ seasons, onManage }: {
    seasons: FantasySeason[];
    onManage: (seasonId: string) => void;
}) {
    const queryClient = useQueryClient();
    const [releasing, setReleasing] = useState<FantasySeason | null>(null);
    const [deleting, setDeleting] = useState<FantasySeason | null>(null);

    const releaseMutation = useReleaseSeasonMutation(() => setReleasing(null));

    const deleteMutation = useMutation({
        mutationFn: async (seasonId: string) => fantasyAdminApi.deleteSeason(seasonId),
        onSuccess: () => {
            toast.success('Season deleted.');
            setDeleting(null);
            queryClient.invalidateQueries({ queryKey: ['adminFantasySeason'] });
        },
        // The server refuses anything that isn't an untouched draft — its own
        // wording ("season has squads entered") is more useful than ours.
        onError: (err: any) => toast.error(err?.response?.data?.error || err.message),
    });

    return (
        <div className="space-y-6">
            {/* What the three statuses actually mean — the thing that confused us */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(Object.keys(SEASON_STATUS_META) as FantasySeason['status'][]).map(status => (
                    <div
                        key={status}
                        className="bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl p-3"
                    >
                        <SeasonStatusBadge status={status} />
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                            {SEASON_STATUS_META[status].meaning}
                        </p>
                    </div>
                ))}
            </div>

            <SectionCard title={`All Seasons (${seasons.length})`} icon={TrophyIcon}>
                {seasons.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                            No fantasy seasons yet
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
                            Creating a season is the first step — everything else (leagues, gameweeks, managers,
                            prize money) hangs off one. A new season starts as a <strong>DRAFT</strong>, which is
                            private to you, so nothing goes live until you release it.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {seasons.map(s => (
                            <div key={s.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <SeasonStatusBadge status={s.status} />
                                        <h4 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                                            {s.name}
                                        </h4>
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                                        {SEASON_STATUS_META[s.status].meaning}
                                    </p>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                                        Budget <strong className="text-gray-600 dark:text-gray-300">{s.budget} SC</strong>
                                        {' · '}Squad <strong className="text-gray-600 dark:text-gray-300">{s.squad_size}</strong>
                                        {' · '}Min female <strong className="text-gray-600 dark:text-gray-300">{s.min_female_offense} OFF / {s.min_female_defense} DEF</strong>
                                        {' · '}Max <strong className="text-gray-600 dark:text-gray-300">{s.max_per_club}</strong> per club
                                        {' · '}Lock <strong className="text-gray-600 dark:text-gray-300">{s.lock_mins_before} mins</strong> before kickoff
                                        {' · '}Created {new Date(s.created_at).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                    {s.status === 'DRAFT' && (
                                        <>
                                            <button
                                                onClick={() => setReleasing(s)}
                                                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                                            >
                                                <RocketLaunchIcon className="w-3.5 h-3.5" /> Release
                                            </button>
                                            <button
                                                onClick={() => setDeleting(s)}
                                                className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-red-500/20 hover:text-red-500 text-gray-500 dark:text-gray-400 transition cursor-pointer"
                                                aria-label={`Delete ${s.name}`}
                                                title="Delete draft season"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => onManage(s.id)}
                                        className="px-5 py-2 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition shadow-md cursor-pointer"
                                    >
                                        Manage <ChevronRightIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            <CreateSeasonCard />

            {releasing && (
                <ReleaseConfirm
                    season={releasing}
                    open
                    pending={releaseMutation.isPending}
                    onCancel={() => setReleasing(null)}
                    onConfirm={() => releaseMutation.mutate(releasing.id)}
                />
            )}

            {deleting && (
                <ConfirmDialog
                    open
                    title={`Delete ${deleting.name}?`}
                    warning="This permanently removes the season and every gameweek scheduled under it."
                    confirmLabel="Yes, Delete Season"
                    pending={deleteMutation.isPending}
                    onCancel={() => setDeleting(null)}
                    onConfirm={() => deleteMutation.mutate(deleting.id)}
                    body={
                        <p className="text-sm">
                            Only a draft season that nobody has entered a squad in can be deleted. The season row
                            and its gameweeks are removed and cannot be recovered.
                        </p>
                    }
                />
            )}
        </div>
    );
}

// ─── Create season (moved off Setup — a season is created from the index) ────

function CreateSeasonCard() {
    const queryClient = useQueryClient();

    const { data: competitionsData } = useQuery({
        queryKey: ['adminCompetitions'],
        queryFn: () => getCompetitions(1, 50),
    });

    const [seasonForm, setSeasonForm] = useState({
        competition_id: '',
        name: 'Showtime Season 2026 Fantasy',
        budget: 230,
        min_female_offense: 3,
        min_female_defense: 3,
        max_per_club: 4,
        lock_mins_before: 15,
    });

    const createSeasonMutation = useMutation({
        mutationFn: async () => {
            if (!seasonForm.competition_id) throw new Error("Select a competition");
            return fantasyApi.adminCreateSeason({
                competition_id: seasonForm.competition_id,
                name: seasonForm.name,
                squad_size: 14,
                budget: seasonForm.budget,
                min_female_offense: seasonForm.min_female_offense,
                min_female_defense: seasonForm.min_female_defense,
                max_per_club: seasonForm.max_per_club,
                lock_mins_before: seasonForm.lock_mins_before,
            });
        },
        onSuccess: () => {
            toast.success("Fantasy season created as a draft!");
            queryClient.invalidateQueries({ queryKey: ['adminFantasySeason'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err.message),
    });

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                <PlusIcon className="w-5 h-5 text-sffl-red" /> Create Fantasy Season
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
                The new season starts as a <strong>DRAFT</strong> — private to admins until you release it.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">Competition</label>
                    <select
                        value={seasonForm.competition_id}
                        onChange={(e) => setSeasonForm({ ...seasonForm, competition_id: e.target.value })}
                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                    >
                        <option value="">Select Competition...</option>
                        {competitionsData?.data?.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">Season Name</label>
                    <input
                        type="text"
                        value={seasonForm.name}
                        onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">Salary Cap Budget (SC)</label>
                    <input
                        type="number"
                        value={seasonForm.budget}
                        onChange={(e) => setSeasonForm({ ...seasonForm, budget: parseFloat(e.target.value) || 230 })}
                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">Lock Minutes Before Kickoff</label>
                    <input
                        type="number"
                        value={seasonForm.lock_mins_before}
                        onChange={(e) => setSeasonForm({ ...seasonForm, lock_mins_before: parseInt(e.target.value) || 15 })}
                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                    />
                </div>
            </div>

            <button
                onClick={() => createSeasonMutation.mutate()}
                disabled={createSeasonMutation.isPending}
                className="mt-6 px-6 py-3 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black shadow-md text-xs uppercase transition shadow-lg cursor-pointer"
            >
                {createSeasonMutation.isPending ? <Spinner /> : 'Create Draft Season'}
            </button>
        </div>
    );
}

// ─── Season detail (one season, four sub-tabs) ───────────────────────────────

function SeasonDetail({ season, onBack }: { season: FantasySeason; onBack: () => void }) {
    const [tab, setTab] = useState<SeasonTabKey>('setup');
    const [releasing, setReleasing] = useState(false);

    const releaseMutation = useReleaseSeasonMutation(() => setReleasing(false));

    // Shares SetupTab's query key, so react-query serves both from one request.
    const { data: gameweeks = [] } = useQuery({
        queryKey: ['adminFantasyGameweeks', season.id],
        queryFn: () => fantasyApi.getGameweeks(season.id),
    });

    // An active season with no open gameweek still shows players nothing, which
    // reads as "the feature is broken" rather than "setup is incomplete".
    const hasOpenGameweek = gameweeks.some(gw => gw.status === 'SCHEDULED');

    return (
        <div className="space-y-6">
            <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-sffl-red transition cursor-pointer"
            >
                <ArrowLeftIcon className="w-4 h-4" /> All Seasons
            </button>

            {/* Season header */}
            <div className="bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <SeasonStatusBadge status={season.status} />
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {SEASON_STATUS_META[season.status].meaning}
                        </span>
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-sffl-navy dark:text-white mt-1.5">
                        {season.name}
                    </h2>
                </div>

                {season.status === 'DRAFT' && (
                    <button
                        onClick={() => setReleasing(true)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20 cursor-pointer shrink-0"
                    >
                        <RocketLaunchIcon className="w-4 h-4" /> Release Season
                    </button>
                )}
            </div>

            {/* A created season is DRAFT until released, and a draft is
                invisible to players. Say so plainly — otherwise "created
                successfully" followed by an empty public site is baffling. */}
            {season.status !== 'ACTIVE' && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            {season.name} is {season.status}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 mt-1">
                            {season.status === 'DRAFT'
                                ? 'Players cannot see this season yet. Release it above, then initialize player prices and schedule at least one gameweek before managers can pick a squad.'
                                : 'This season is completed. Players can still view final standings, but no new squads can be entered.'}
                        </p>
                    </div>
                </div>
            )}

            {season.status === 'ACTIVE' && !hasOpenGameweek && (
                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                            Season is live, but nothing is open for entry
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 mt-1">
                            Managers can't pick a squad until a gameweek is scheduled and still ahead of its deadline.
                            Schedule one in <strong>Setup</strong> — it needs an event day that already has fixtures,
                            since the deadline is derived from the first kickoff.
                        </p>
                    </div>
                </div>
            )}

            {/* Sub-tab bar */}
            <div className="flex flex-wrap gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl p-2 shadow-sm">
                {SEASON_TABS.map(({ key, label, icon: Icon }) => {
                    const active = tab === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer ${
                                active
                                    ? 'bg-yellow-500 text-black shadow-lg shadow-sffl-red/20'
                                    : 'bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 hover:text-white hover:bg-neutral-800'
                            }`}
                        >
                            <Icon className="w-4 h-4" /> {label}
                        </button>
                    );
                })}
            </div>

            {tab === 'setup' && <SetupTab season={season} />}
            {tab === 'leagues' && <LeaguesTab seasonId={season.id} />}
            {tab === 'managers' && <ManagersTab seasonId={season.id} />}
            {tab === 'finance' && <FinanceTab seasonId={season.id} />}

            <ReleaseConfirm
                season={season}
                open={releasing}
                pending={releaseMutation.isPending}
                onCancel={() => setReleasing(false)}
                onConfirm={() => releaseMutation.mutate(season.id)}
            />
        </div>
    );
}

// ─── Setup tab (season + gameweek management) ────────────────────────────────

function SetupTab({ season }: { season: FantasySeason }) {
    const queryClient = useQueryClient();

    const { data: gameweeks = [], isLoading: gwLoading } = useQuery({
        queryKey: ['adminFantasyGameweeks', season.id],
        queryFn: () => fantasyApi.getGameweeks(season.id),
    });

    const { data: eventDays = [] } = useQuery({
        queryKey: ['adminEventDays'],
        queryFn: () => getEventDays(),
    });

    // Create Gameweek Form State. `deadline` is a `datetime-local` value and is
    // optional: left blank, the server derives it from the event day's first
    // kickoff minus the season's lock_mins_before.
    const [gwForm, setGwForm] = useState({
        number: 1,
        event_day_id: '',
        deadline: '',
    });

    // Gameweek whose deadline is being corrected, plus the pending edit value.
    const [editingDeadlineGwId, setEditingDeadlineGwId] = useState<string | null>(null);
    const [deadlineDraft, setDeadlineDraft] = useState('');

    // Mutations
    const initPricesMutation = useMutation({
        mutationFn: async (seasonId: string) => fantasyApi.adminInitializePrices(seasonId),
        onSuccess: () => toast.success("Player prices initialized! (Base 10 SC)"),
        onError: (err: any) => toast.error(err?.response?.data?.error || err.message),
    });

    const createGwMutation = useMutation({
        mutationFn: async () => {
            if (!gwForm.event_day_id) throw new Error("Select an Event Day");
            return fantasyApi.adminCreateGameweek(season.id, {
                number: gwForm.number,
                event_day_id: gwForm.event_day_id,
                deadline: gwForm.deadline ? toRFC3339(gwForm.deadline) : undefined,
            });
        },
        onSuccess: () => {
            toast.success("Gameweek scheduled!");
            setGwForm(prev => ({ number: prev.number + 1, event_day_id: '', deadline: '' }));
            queryClient.invalidateQueries({ queryKey: ['adminFantasyGameweeks'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err.message),
    });

    const updateDeadlineMutation = useMutation({
        mutationFn: async ({ gwId, deadline }: { gwId: string; deadline: string }) => {
            if (!deadline) throw new Error("Pick a new deadline first");
            return fantasyApi.adminUpdateGameweekDeadline(gwId, toRFC3339(deadline));
        },
        onSuccess: () => {
            toast.success("Deadline updated!");
            setEditingDeadlineGwId(null);
            setDeadlineDraft('');
            queryClient.invalidateQueries({ queryKey: ['adminFantasyGameweeks'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err.message),
    });

    const finalizeGwMutation = useMutation({
        mutationFn: async (gwId: string) => fantasyApi.adminFinalizeGameweek(gwId),
        onSuccess: () => {
            toast.success("Gameweek finalized and official scores computed!");
            queryClient.invalidateQueries({ queryKey: ['adminFantasyGameweeks'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err.message),
    });

    if (gwLoading) {
        return <Loader />;
    }

    return (
        <div className="space-y-8">
            {/* Season Operations Card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <SeasonStatusBadge status={season.status} />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Budget: <strong>{season.budget} SC</strong></span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Squad Size: <strong>{season.squad_size} Starters</strong></span>
                        </div>
                        <h2 className="text-xl font-black uppercase text-sffl-navy dark:text-white mt-1">{season.name}</h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => initPricesMutation.mutate(season.id)}
                            disabled={initPricesMutation.isPending}
                            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs uppercase flex items-center gap-1.5 transition cursor-pointer"
                        >
                            <CurrencyDollarIcon className="w-3.5 h-3.5 text-sffl-red" /> Initialize Prices
                        </button>
                    </div>
                </div>
            </div>

            {/* Gameweeks Section */}
            <div className="space-y-6">
                {/* Create Gameweek Form */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-base font-black uppercase text-sffl-navy dark:text-white mb-4 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-sffl-red" /> Schedule New Gameweek
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">Gameweek Number</label>
                            <input
                                type="number"
                                value={gwForm.number}
                                onChange={(e) => setGwForm({ ...gwForm, number: parseInt(e.target.value) || 1 })}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">Associated Event Day</label>
                            <select
                                value={gwForm.event_day_id}
                                onChange={(e) => setGwForm({ ...gwForm, event_day_id: e.target.value })}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            >
                                <option value="">Select Event Day...</option>
                                {eventDays.map(ed => (
                                    <option key={ed.id} value={ed.id}>
                                        {ed.title} ({new Date(ed.date).toLocaleDateString()})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">
                                Lock Deadline <span className="text-gray-400 dark:text-gray-500 normal-case font-medium">(optional)</span>
                            </label>
                            <input
                                type="datetime-local"
                                value={gwForm.deadline}
                                onChange={(e) => setGwForm({ ...gwForm, deadline: e.target.value })}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                                Leave blank and the server computes it from the event day's first kickoff
                                minus the season's lock window ({season.lock_mins_before} mins).
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => createGwMutation.mutate()}
                        disabled={createGwMutation.isPending}
                        className="mt-4 px-5 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold shadow-md text-xs uppercase transition cursor-pointer"
                    >
                        {createGwMutation.isPending ? <Spinner /> : 'Schedule Gameweek'}
                    </button>
                </div>

                {/* Gameweeks List */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-base font-black uppercase text-sffl-navy dark:text-white">Gameweeks</h3>
                    </div>

                    {gameweeks.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-xs">
                            No gameweeks scheduled yet.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {gameweeks.map(gw => {
                                const isFinalized = gw.status === 'FINALIZED';
                                const isEditingDeadline = editingDeadlineGwId === gw.id;

                                return (
                                    <div key={gw.id} className="p-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-gray-900 dark:text-white">Gameweek {gw.number}</span>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                        isFinalized ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' :
                                                        gw.status === 'LOCKED' ? 'bg-red-500/10 text-red-500 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                    }`}>
                                                        {gw.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    Lock Deadline: {new Date(gw.deadline).toLocaleString()}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (isEditingDeadline) {
                                                            setEditingDeadlineGwId(null);
                                                            return;
                                                        }
                                                        setEditingDeadlineGwId(gw.id);
                                                        setDeadlineDraft(toDateTimeLocalValue(gw.deadline));
                                                    }}
                                                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold uppercase flex items-center gap-1.5 transition cursor-pointer"
                                                >
                                                    <ClockIcon className="w-3.5 h-3.5 text-sffl-red" />
                                                    {isEditingDeadline ? 'Cancel' : 'Edit Deadline'}
                                                </button>

                                                {/* Finalizing is re-runnable — it recomputes rather than
                                                    double-counts — and is the path for correcting stats
                                                    after the fact, so it stays available once finalized. */}
                                                <button
                                                    onClick={() => finalizeGwMutation.mutate(gw.id)}
                                                    disabled={finalizeGwMutation.isPending}
                                                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-sffl-red hover:text-white text-gray-700 dark:text-gray-200 text-xs font-bold uppercase flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                                                >
                                                    {isFinalized && <ArrowPathIcon className="w-3.5 h-3.5" />}
                                                    {isFinalized ? 'Re-score' : 'Finalize & Score'}
                                                </button>
                                            </div>
                                        </div>

                                        {isEditingDeadline && (
                                            <div className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-end gap-3">
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">New Lock Deadline</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={deadlineDraft}
                                                        onChange={(e) => setDeadlineDraft(e.target.value)}
                                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => updateDeadlineMutation.mutate({ gwId: gw.id, deadline: deadlineDraft })}
                                                    disabled={updateDeadlineMutation.isPending || !deadlineDraft}
                                                    className="px-5 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold shadow-md text-xs uppercase transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {updateDeadlineMutation.isPending ? <Spinner /> : 'Save Deadline'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Leagues tab ─────────────────────────────────────────────────────────────

function LeaguesTab({ seasonId }: { seasonId: string }) {
    const [searchInput, setSearchInput] = useState('');
    const search = useDebounced(searchInput);
    const [page, setPage] = useState(1);
    const [openLeagueId, setOpenLeagueId] = useState<string | null>(null);
    const limit = 20;

    useEffect(() => { setPage(1); }, [search]);

    const { data, isLoading } = useQuery({
        queryKey: ['adminFantasyLeagues', seasonId, search, page],
        queryFn: () => fantasyAdminApi.listLeagues(seasonId, { search: search.trim() || undefined, page, limit }),
    });

    const leagues = data?.data || [];

    return (
        <div className="space-y-6">
            <CreateLeagueCard seasonId={seasonId} />

            <SectionCard
                title="Leagues"
                icon={TrophyIcon}
                action={<SearchBox value={searchInput} onChange={setSearchInput} placeholder="Search leagues..." />}
            >
                {isLoading ? (
                    <div className="p-10"><Loader /></div>
                ) : leagues.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-xs">No leagues found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                                    <th className="px-4 py-3">League</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Owner</th>
                                    <th className="px-4 py-3 text-right">Entry Fee</th>
                                    <th className="px-4 py-3">Members</th>
                                    <th className="px-4 py-3 text-right">Prize Pool</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {leagues.map(l => {
                                    const isOpen = openLeagueId === l.league_id;
                                    const isPaid = l.entry_fee_kobo > 0;
                                    return (
                                        <Fragment key={l.league_id}>
                                            <tr
                                                onClick={() => setOpenLeagueId(isOpen ? null : l.league_id)}
                                                className={`text-sm cursor-pointer transition ${isOpen ? 'bg-gray-50 dark:bg-gray-700/50' : 'hover:bg-gray-50 dark:bg-gray-700/50/60'}`}
                                            >
                                                <td className="px-4 py-3 font-bold text-white">{l.name}</td>
                                                <td className="px-4 py-3"><TypeBadge type={l.type} /></td>
                                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{l.owner_name || '—'}</td>
                                                <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                                    {isPaid ? formatKobo(l.entry_fee_kobo) : <span className="text-gray-400 dark:text-gray-500">Free</span>}
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    <span className="text-white font-bold tabular-nums">{l.member_count}</span>
                                                    {isPaid && (
                                                        <span className="text-gray-400 dark:text-gray-500 ml-2">
                                                            <span className="text-emerald-400">{l.paid_members} paid</span>
                                                            {' · '}
                                                            <span className="text-amber-400">{l.pending_members} pending</span>
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums font-bold text-sffl-red">
                                                    {isPaid ? formatKobo(l.prize_pool_kobo) : <span className="text-gray-400 dark:text-gray-500">—</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {isPaid ? <SettledBadge settled={l.settled} /> : <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-black">Free league</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-500">
                                                    {isOpen ? <ChevronUpIcon className="w-4 h-4 inline" /> : <ChevronDownIcon className="w-4 h-4 inline" />}
                                                </td>
                                            </tr>
                                            {isOpen && (
                                                <tr className="bg-gray-50 dark:bg-gray-700/50">
                                                    <td colSpan={8} className="px-4 pb-5 pt-1">
                                                        <LeagueDetailPanel league={l} seasonId={seasonId} />
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {data && (
                    <Pager page={data.page || page} totalPages={data.total_pages || 1} total={data.total || 0} onPage={setPage} />
                )}
            </SectionCard>
        </div>
    );
}

// ─── Create league ───────────────────────────────────────────────────────────

/**
 * Entry fee is typed in naira because that's what an operator thinks in, but
 * every money value in the API is integer kobo — convert on the way out only.
 */
function CreateLeagueCard({ seasonId }: { seasonId: string }) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        name: '',
        type: 'PUBLIC' as 'PUBLIC' | 'PRIVATE',
        entry_fee_naira: 0,
        max_members: 0,
    });

    const createLeagueMutation = useMutation({
        mutationFn: async () => {
            if (!form.name.trim()) throw new Error('Give the league a name');
            return fantasyApi.createLeague({
                season_id: seasonId,
                name: form.name.trim(),
                type: form.type,
                entry_fee: Math.round((Number(form.entry_fee_naira) || 0) * 100),
                max_members: Number(form.max_members) || 0,
            });
        },
        onSuccess: () => {
            toast.success('League created!');
            setForm({ name: '', type: 'PUBLIC', entry_fee_naira: 0, max_members: 0 });
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ['adminFantasyLeagues'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err.message),
    });

    const feeKobo = Math.round((Number(form.entry_fee_naira) || 0) * 100);

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-700/40">
                <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                        <PlusIcon className="w-4 h-4 text-sffl-red" /> Create League
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        A <strong>PUBLIC</strong> league is browsable by any player; a <strong>PRIVATE</strong> one is
                        joinable by invite code only.
                    </p>
                </div>
                <button
                    onClick={() => setOpen(o => !o)}
                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs uppercase transition cursor-pointer shrink-0"
                >
                    {open ? 'Cancel' : 'New League'}
                </button>
            </div>

            {open && (
                <div className="p-5 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">League Name</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Showtime Office League"
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">Type</label>
                            <select
                                value={form.type}
                                onChange={(e) => setForm({ ...form, type: e.target.value as 'PUBLIC' | 'PRIVATE' })}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            >
                                <option value="PUBLIC">PUBLIC — anyone can browse and join</option>
                                <option value="PRIVATE">PRIVATE — invite code only</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">Entry Fee (₦)</label>
                            <input
                                type="number"
                                min={0}
                                value={form.entry_fee_naira}
                                onChange={(e) => setForm({ ...form, entry_fee_naira: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white tabular-nums focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                                {feeKobo > 0
                                    ? <>Members pay <strong className="text-sffl-red">{formatKobo(feeKobo)}</strong> to join.</>
                                    : 'Zero makes this a free league — no prize pool and nothing to settle.'}
                            </p>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">Max Members</label>
                            <input
                                type="number"
                                min={0}
                                value={form.max_members}
                                onChange={(e) => setForm({ ...form, max_members: parseInt(e.target.value) || 0 })}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white tabular-nums focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                                0 means unlimited.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => createLeagueMutation.mutate()}
                        disabled={createLeagueMutation.isPending || !form.name.trim()}
                        className="mt-5 px-6 py-3 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black shadow-md text-xs uppercase tracking-wider transition shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {createLeagueMutation.isPending ? <Spinner /> : 'Create League'}
                    </button>
                </div>
            )}
        </div>
    );
}

function LeagueDetailPanel({ league, seasonId }: { league: AdminLeagueRow; seasonId: string }) {
    const queryClient = useQueryClient();
    const leagueId = league.league_id;

    const { data: finance, isLoading: financeLoading } = useQuery({
        queryKey: ['adminLeagueFinance', leagueId],
        queryFn: () => fantasyAdminApi.getLeagueFinance(leagueId),
    });

    const { data: members = [], isLoading: membersLoading } = useQuery({
        queryKey: ['adminLeagueMembers', leagueId],
        queryFn: () => fantasyAdminApi.listLeagueMembers(leagueId),
    });

    // `null` means "not edited yet" — fall through to the server's structure so a
    // background refetch can't clobber a save the operator hasn't made yet.
    const [tierDraft, setTierDraft] = useState<{ rank: number; percent: number }[] | null>(null);
    const [confirmSettle, setConfirmSettle] = useState(false);

    const serverTiers = (finance?.prize_structure || []).map(t => ({ rank: t.rank, percent: t.percent }));
    const tiers = tierDraft ?? serverTiers;
    const totalPercent = tiers.reduce((s, t) => s + (Number(t.percent) || 0), 0);
    const settled = finance?.settled ?? league.settled;
    const isPaid = (finance?.entry_fee_kobo ?? league.entry_fee_kobo) > 0;

    const setTiers = (next: { rank: number; percent: number }[]) =>
        setTierDraft(next.map((t, i) => ({ rank: i + 1, percent: t.percent })));

    const savePrizesMutation = useMutation({
        mutationFn: async () => fantasyAdminApi.setPrizeStructure(leagueId, tiers),
        onSuccess: () => {
            toast.success('Prize structure saved!');
            setTierDraft(null);
            queryClient.invalidateQueries({ queryKey: ['adminLeagueFinance', leagueId] });
            queryClient.invalidateQueries({ queryKey: ['adminFantasyLeagues'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err.message),
    });

    const settleMutation = useMutation({
        mutationFn: async () => fantasyAdminApi.settleLeague(leagueId),
        onSuccess: (res) => {
            toast.success(`League settled — ${settlementSummary(res)}`);
            setConfirmSettle(false);
            queryClient.invalidateQueries({ queryKey: ['adminLeagueFinance', leagueId] });
            queryClient.invalidateQueries({ queryKey: ['adminFantasyLeagues'] });
            queryClient.invalidateQueries({ queryKey: ['adminFantasyOverview', seasonId] });
        },
        onError: (err: any) => {
            // 409 is the "already settled" race, not a failure worth a generic message.
            if (err?.response?.status === 409) {
                toast.error(err?.response?.data?.error || 'This league has already been settled.');
                setConfirmSettle(false);
                queryClient.invalidateQueries({ queryKey: ['adminLeagueFinance', leagueId] });
                queryClient.invalidateQueries({ queryKey: ['adminFantasyLeagues'] });
                return;
            }
            toast.error(err?.response?.data?.error || err.message);
        },
    });

    if (financeLoading || !finance) {
        return <div className="py-8"><Loader /></div>;
    }

    const awardTotal = finance.awards.reduce((s, a) => s + a.amount_kobo, 0);

    return (
        <div className="space-y-4 border-l-2 border-yellow-500/30 pl-4">
            {/* Money ledger */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <BanknotesIcon className="w-4 h-4 text-sffl-red" /> League Finance
                </h4>
                <div className="space-y-1.5 text-sm max-w-md">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Gross collected ({finance.paid_members} paid entries)</span>
                        <span className="font-bold tabular-nums text-white">{formatKobo(finance.gross_entry_kobo)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Less platform cut ({finance.cut_percent}%)</span>
                        <span className="font-bold tabular-nums text-red-400">−{formatKobo(finance.platform_cut_kobo)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-white font-black uppercase text-xs tracking-wider">Prize pool</span>
                        <span className="font-black tabular-nums text-sffl-red text-base">{formatKobo(finance.prize_pool_kobo)}</span>
                    </div>
                    {finance.pending_members > 0 && (
                        <p className="text-[11px] text-amber-400 pt-1">
                            {finance.pending_members} member(s) still pending payment — they are not in these totals.
                        </p>
                    )}
                    {finance.settled_at && (
                        <p className="text-[11px] text-emerald-400 pt-1">
                            Settled {new Date(finance.settled_at).toLocaleString()}.
                        </p>
                    )}
                </div>
            </div>

            {/* Awards */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 flex-wrap">
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <TrophyIcon className="w-4 h-4 text-sffl-red" /> Awards
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                            settled
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                        }`}>
                            {settled ? 'Final' : 'Projected'}
                        </span>
                    </h4>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {finance.awards.length} winner(s) · {formatKobo(awardTotal)}
                    </span>
                </div>
                {finance.awards.length === 0 ? (
                    <div className="p-5 text-center text-gray-400 dark:text-gray-500 text-xs">
                        No awards {settled ? 'were made' : 'projected yet'} — set a prize structure and make sure members have paid.
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                                <th className="px-4 py-2.5">Place</th>
                                <th className="px-4 py-2.5">Manager</th>
                                <th className="px-4 py-2.5">Team</th>
                                <th className="px-4 py-2.5 text-right">Points</th>
                                <th className="px-4 py-2.5 text-right">Award</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {finance.awards.map((a, i) => (
                                <tr key={`${a.user_id}-${a.rank}-${i}`}>
                                    <td className="px-4 py-2.5 font-black text-white whitespace-nowrap">
                                        {awardPlaceLabel(a.rank, a.shared_with)}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{a.user_name}</td>
                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{a.team_name}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{a.points}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums font-black text-sffl-red">
                                        {formatKobo(a.amount_kobo)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Prize structure editor */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <CurrencyDollarIcon className="w-4 h-4 text-sffl-red" /> Prize Structure
                    {settled && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <LockClosedIcon className="w-3 h-3" /> Locked
                        </span>
                    )}
                </h4>

                {settled ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        This league is settled — its prize structure can no longer be changed.
                    </p>
                ) : (
                    <>
                        <div className="space-y-2 max-w-md">
                            {tiers.length === 0 && (
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    No prize structure set. Add positions below — the server requires ranks 1, 2, 3… with no gaps, totalling at most 100%.
                                </p>
                            )}
                            {tiers.map((t, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="w-16 text-xs font-black uppercase text-gray-500 dark:text-gray-400 tabular-nums">
                                        {ordinal(t.rank)}
                                    </span>
                                    <div className="relative flex-1">
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={t.percent}
                                            onChange={(e) => {
                                                const next = [...tiers];
                                                next[i] = { ...next[i], percent: parseFloat(e.target.value) || 0 };
                                                setTiers(next);
                                            }}
                                            className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 pl-3 pr-8 text-sm text-white tabular-nums focus:outline-none focus:border-yellow-500"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">%</span>
                                    </div>
                                    <span className="w-32 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                                        {formatKobo(Math.round(finance.prize_pool_kobo * (Number(t.percent) || 0) / 100))}
                                    </span>
                                    <button
                                        onClick={() => setTiers(tiers.filter((_, idx) => idx !== i))}
                                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-sffl-red text-gray-500 dark:text-gray-400 transition cursor-pointer"
                                        aria-label={`Remove position ${t.rank}`}
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap mt-4">
                            <button
                                onClick={() => setTiers([...tiers, { rank: tiers.length + 1, percent: 0 }])}
                                className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold uppercase flex items-center gap-1.5 transition cursor-pointer"
                            >
                                <PlusIcon className="w-3.5 h-3.5 text-sffl-red" /> Add Position
                            </button>
                            <button
                                onClick={() => savePrizesMutation.mutate()}
                                disabled={savePrizesMutation.isPending || tierDraft === null}
                                className="px-5 py-2 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold shadow-md text-xs uppercase transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {savePrizesMutation.isPending ? <Spinner /> : 'Save Structure'}
                            </button>
                            {tierDraft !== null && (
                                <button
                                    onClick={() => setTierDraft(null)}
                                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold uppercase transition cursor-pointer"
                                >
                                    Discard Changes
                                </button>
                            )}
                            <span className={`text-xs font-bold tabular-nums ${totalPercent > 100 ? 'text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                Total: {totalPercent}% {totalPercent > 100 && '— over 100%, the server will reject this'}
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* Members */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-sffl-red" /> Members ({members.length})
                    </h4>
                </div>
                {membersLoading ? (
                    <div className="py-8"><Loader /></div>
                ) : members.length === 0 ? (
                    <div className="p-5 text-center text-gray-400 dark:text-gray-500 text-xs">No members yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                                    <th className="px-4 py-2.5">Manager</th>
                                    <th className="px-4 py-2.5">Email</th>
                                    <th className="px-4 py-2.5">Team</th>
                                    <th className="px-4 py-2.5 text-right">Points</th>
                                    <th className="px-4 py-2.5">Payment</th>
                                    <th className="px-4 py-2.5">Paystack Ref</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {members.map(m => (
                                    <tr key={m.user_id}>
                                        <td className="px-4 py-2.5 font-bold text-white">{m.user_name}</td>
                                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{m.user_email}</td>
                                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-xs">{m.team_name}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{m.total_points}</td>
                                        <td className="px-4 py-2.5"><PaymentBadge status={m.payment_status} /></td>
                                        <td className="px-4 py-2.5 text-[11px] font-mono text-gray-400 dark:text-gray-500">
                                            {m.paystack_reference || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Settle */}
            {isPaid && !settled && (
                <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                            <ShieldCheckIcon className="w-4 h-4" /> Settle League
                        </h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 max-w-lg">
                            Credits {formatKobo(awardTotal)} to {finance.awards.length} winner wallet(s) and closes this league's prize pool. This moves real money and cannot be undone.
                        </p>
                    </div>
                    <button
                        onClick={() => setConfirmSettle(true)}
                        disabled={finance.awards.length === 0}
                        className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                        Settle League
                    </button>
                </div>
            )}

            <ConfirmDialog
                open={confirmSettle}
                title="Settle this league?"
                warning="This credits real money into user wallets and cannot be reversed."
                confirmLabel="Yes, Settle & Credit"
                pending={settleMutation.isPending}
                onCancel={() => setConfirmSettle(false)}
                onConfirm={() => settleMutation.mutate()}
                body={
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500 dark:text-gray-400">League</span>
                            <span className="font-bold text-white">{finance.league_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Winners to be credited</span>
                            <span className="font-bold text-white tabular-nums">{finance.awards.length}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-white font-black uppercase text-xs tracking-wider">Total credited</span>
                            <span className="font-black text-sffl-red text-lg tabular-nums">{formatKobo(awardTotal)}</span>
                        </div>
                    </div>
                }
            />
        </div>
    );
}

// ─── Managers tab ────────────────────────────────────────────────────────────

function ManagersTab({ seasonId }: { seasonId: string }) {
    const [searchInput, setSearchInput] = useState('');
    const search = useDebounced(searchInput);
    const [page, setPage] = useState(1);
    const limit = 25;

    useEffect(() => { setPage(1); }, [search]);

    const { data, isLoading } = useQuery({
        queryKey: ['adminFantasyManagers', seasonId, search, page],
        queryFn: () => fantasyAdminApi.listManagers(seasonId, { search: search.trim() || undefined, page, limit }),
    });

    const managers = data?.data || [];

    return (
        <SectionCard
            title="Managers"
            icon={UsersIcon}
            action={<SearchBox value={searchInput} onChange={setSearchInput} placeholder="Search name, email or team..." />}
        >
            {isLoading ? (
                <div className="p-10"><Loader /></div>
            ) : managers.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-xs">No managers found.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                                <th className="px-4 py-3 text-right">#</th>
                                <th className="px-4 py-3">Manager</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Team</th>
                                <th className="px-4 py-3 text-right">Points</th>
                                <th className="px-4 py-3 text-right">Lineups</th>
                                <th className="px-4 py-3 text-right">Leagues</th>
                                <th className="px-4 py-3 text-right">Wallet</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {managers.map(m => (
                                <tr key={m.user_id} className="hover:bg-gray-50 dark:bg-gray-700/50/60 transition">
                                    <td className="px-4 py-3 text-right tabular-nums font-black text-gray-400 dark:text-gray-500">{m.rank}</td>
                                    <td className="px-4 py-3 font-bold text-white">{m.user_name}</td>
                                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{m.user_email}</td>
                                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">{m.team_name}</td>
                                    <td className="px-4 py-3 text-right tabular-nums font-bold text-sffl-red">{m.total_points}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{m.lineup_count}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{m.league_count}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-emerald-400 font-bold">
                                        {formatKobo(m.wallet_balance_kobo)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {data && (
                <Pager page={data.page || page} totalPages={data.total_pages || 1} total={data.total || 0} onPage={setPage} />
            )}
        </SectionCard>
    );
}

// ─── Finance tab ─────────────────────────────────────────────────────────────

function FinanceTab({ seasonId }: { seasonId: string }) {
    const queryClient = useQueryClient();
    const [confirmMode, setConfirmMode] = useState<'settle' | 'complete' | null>(null);

    const { data: overview, isLoading } = useQuery({
        queryKey: ['adminFantasyOverview', seasonId],
        queryFn: () => fantasyAdminApi.getOverview(seasonId),
    });

    const invalidateAfterSettlement = () => {
        queryClient.invalidateQueries({ queryKey: ['adminFantasyOverview', seasonId] });
        queryClient.invalidateQueries({ queryKey: ['adminFantasyLeagues'] });
        queryClient.invalidateQueries({ queryKey: ['adminLeagueFinance'] });
        queryClient.invalidateQueries({ queryKey: ['adminFantasySeason'] });
    };

    const settleSeasonMutation = useMutation({
        mutationFn: async () => fantasyAdminApi.settleSeason(seasonId),
        onSuccess: (res) => {
            toast.success(`Season settled — ${settlementSummary(res)}`);
            setConfirmMode(null);
            invalidateAfterSettlement();
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err.message),
    });

    const completeSeasonMutation = useMutation({
        mutationFn: async () => fantasyAdminApi.completeSeason(seasonId),
        onSuccess: (res) => {
            toast.success(`Season completed — ${settlementSummary(res)}`);
            setConfirmMode(null);
            invalidateAfterSettlement();
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err.message),
    });

    if (isLoading || !overview) {
        return <div className="p-10"><Loader /></div>;
    }

    return (
        <div className="space-y-6">
            {/* Participation */}
            <SectionCard title="Participation" icon={UsersIcon}>
                <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Total Managers" value={overview.total_managers.toLocaleString()} />
                    <StatCard label="Lineups Submitted" value={overview.total_lineups.toLocaleString()} />
                    <StatCard label="Leagues" value={overview.total_leagues.toLocaleString()} />
                    <StatCard label="Paid Leagues" value={overview.paid_leagues.toLocaleString()} tone="yellow" />
                </div>
            </SectionCard>

            {/* Money — reads top to bottom as a P&L */}
            <SectionCard title="Season Revenue" icon={BanknotesIcon}>
                <div className="p-5">
                    <div className="max-w-xl space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Gross entry collected</span>
                            <span className="font-bold tabular-nums text-white text-base">{formatKobo(overview.gross_entry_kobo)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Less platform cut ({overview.cut_percent}%)</span>
                            <span className="font-bold tabular-nums text-emerald-400 text-base">{formatKobo(overview.platform_cut_kobo)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-white font-black uppercase text-xs tracking-wider">Prize pool owed to managers</span>
                            <span className="font-black tabular-nums text-sffl-red text-xl">{formatKobo(overview.prize_pool_kobo)}</span>
                        </div>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-4">
                        Platform cut is the house's revenue; the prize pool is what gets distributed to winners at settlement.
                    </p>
                </div>
            </SectionCard>

            {/* Liabilities & payouts */}
            <SectionCard title="Liabilities & Payouts" icon={CurrencyDollarIcon}>
                <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                        label="Unsettled Leagues"
                        value={overview.unsettled_leagues.toLocaleString()}
                        hint="Paid leagues yet to pay out"
                        tone={overview.unsettled_leagues > 0 ? 'red' : 'emerald'}
                    />
                    <StatCard
                        label="Wallet Liability"
                        value={formatKobo(overview.wallet_liability_kobo)}
                        hint="Credited, not yet withdrawn"
                        tone="red"
                    />
                    <StatCard
                        label="Pending Payouts"
                        value={formatKobo(overview.pending_payout_kobo)}
                        hint={`${overview.pending_payout_count} request(s) in the queue`}
                        tone="yellow"
                    />
                    <StatCard
                        label="Total Paid Out"
                        value={formatKobo(overview.paid_out_kobo)}
                        hint="Money that has left the business"
                        tone="emerald"
                    />
                </div>
            </SectionCard>

            {/* Season-wide money actions */}
            <div className="bg-white dark:bg-gray-800 border border-amber-500/30 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-amber-500/5">
                    <h3 className="text-base font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" /> Season Settlement
                    </h3>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                        Both actions credit real money into user wallets. There is no undo.
                    </p>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4 flex flex-col justify-between gap-4">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white">Settle All Leagues</h4>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                                Settles every outstanding paid league and credits winners, but leaves the season open
                                so gameweeks can still be scored.
                            </p>
                        </div>
                        <button
                            onClick={() => setConfirmMode('settle')}
                            disabled={overview.unsettled_leagues === 0}
                            className="w-full px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {overview.unsettled_leagues === 0 ? 'Nothing To Settle' : `Settle ${overview.unsettled_leagues} League(s)`}
                        </button>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 border border-red-500/25 rounded-xl p-4 flex flex-col justify-between gap-4">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white">Complete Season</h4>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                                Settles every outstanding paid league <strong className="text-white">and then closes the season</strong>.
                                Once closed the season is final — do this only when every gameweek has been scored.
                            </p>
                        </div>
                        <button
                            onClick={() => setConfirmMode('complete')}
                            className="w-full px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-red-600/20 cursor-pointer"
                        >
                            Complete Season
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={confirmMode === 'settle'}
                title="Settle all outstanding leagues?"
                warning="This credits real money into user wallets and cannot be reversed."
                confirmLabel="Yes, Settle All"
                pending={settleSeasonMutation.isPending}
                onCancel={() => setConfirmMode(null)}
                onConfirm={() => settleSeasonMutation.mutate()}
                body={
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Unsettled paid leagues</span>
                            <span className="font-bold text-white tabular-nums">{overview.unsettled_leagues}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-white font-black uppercase text-xs tracking-wider">Season prize pool</span>
                            <span className="font-black text-sffl-red text-lg tabular-nums">{formatKobo(overview.prize_pool_kobo)}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 pt-1">
                            The season stays open afterwards — use Complete Season to close it.
                        </p>
                    </div>
                }
            />

            <ConfirmDialog
                open={confirmMode === 'complete'}
                title="Complete the season?"
                warning="This settles every outstanding paid league, credits winners, and permanently closes the season."
                confirmLabel="Yes, Settle & Close Season"
                pending={completeSeasonMutation.isPending}
                onCancel={() => setConfirmMode(null)}
                onConfirm={() => completeSeasonMutation.mutate()}
                body={
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Season</span>
                            <span className="font-bold text-white">{overview.season_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Leagues still to settle</span>
                            <span className="font-bold text-white tabular-nums">{overview.unsettled_leagues}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-white font-black uppercase text-xs tracking-wider">Prize pool to distribute</span>
                            <span className="font-black text-sffl-red text-lg tabular-nums">{formatKobo(overview.prize_pool_kobo)}</span>
                        </div>
                        <p className="text-[11px] text-red-400 pt-1">
                            After this the season is closed and no further gameweeks can be scored.
                        </p>
                    </div>
                }
            />
        </div>
    );
}

// ─── Payouts tab ─────────────────────────────────────────────────────────────

const PAYOUT_FILTERS: { key: PayoutStatus | ''; label: string }[] = [
    { key: '', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'PROCESSING', label: 'Processing' },
    { key: 'PAID', label: 'Paid' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: 'CANCELLED', label: 'Cancelled' },
];

const TERMINAL_STATUSES: PayoutStatus[] = ['PAID', 'REJECTED', 'CANCELLED'];

function PayoutsTab() {
    const [status, setStatus] = useState<PayoutStatus | ''>('PENDING');
    const [page, setPage] = useState(1);
    const limit = 20;

    useEffect(() => { setPage(1); }, [status]);

    const { data, isLoading } = useQuery({
        queryKey: ['adminFantasyPayouts', status, page],
        // An empty filter means "all" — omit the param rather than sending `status=`.
        queryFn: () => fantasyAdminApi.listPayouts({ status: status || undefined, page, limit }),
    });

    // The queue is worked oldest-first: the longest-waiting manager is at the top.
    const payouts = [...(data?.data || [])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return (
        <SectionCard
            title="Payout Queue"
            icon={CurrencyDollarIcon}
            action={
                <div className="flex flex-wrap gap-1.5">
                    {PAYOUT_FILTERS.map(f => (
                        <button
                            key={f.key || 'all'}
                            onClick={() => setStatus(f.key)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer ${
                                status === f.key
                                    ? 'bg-yellow-500 text-black'
                                    : 'bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 hover:text-white hover:bg-neutral-800'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            }
        >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50/50">
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    Manual queue, oldest request first. Transfer the money in your banking app using the account details
                    shown, then mark the request Paid with the bank transfer reference.
                </p>
            </div>

            {isLoading ? (
                <div className="p-10"><Loader /></div>
            ) : payouts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-xs">No payout requests in this view.</div>
            ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {payouts.map(p => <PayoutRow key={p.id} payout={p} />)}
                </div>
            )}

            {data && (
                <Pager page={data.page || page} totalPages={data.total_pages || 1} total={data.total || 0} onPage={setPage} />
            )}
        </SectionCard>
    );
}

function PayoutRow({ payout }: { payout: PayoutRequest }) {
    const queryClient = useQueryClient();
    const [mode, setMode] = useState<'paid' | 'reject' | null>(null);
    const [paymentReference, setPaymentReference] = useState('');
    const [adminNotes, setAdminNotes] = useState('');

    const isTerminal = TERMINAL_STATUSES.includes(payout.status);

    const updateMutation = useMutation({
        mutationFn: async (payload: { status: 'PROCESSING' | 'PAID' | 'REJECTED'; admin_notes?: string; payment_reference?: string }) => {
            if (payload.status === 'PAID' && !payload.payment_reference?.trim()) {
                throw new Error('A bank transfer reference is required to mark a payout paid.');
            }
            if (payload.status === 'REJECTED' && !payload.admin_notes?.trim()) {
                throw new Error('Give a reason for the rejection.');
            }
            return fantasyAdminApi.updatePayoutStatus(payout.id, payload);
        },
        onSuccess: (res) => {
            toast.success(`Payout marked ${res.status}.`);
            setMode(null);
            setPaymentReference('');
            setAdminNotes('');
            queryClient.invalidateQueries({ queryKey: ['adminFantasyPayouts'] });
            queryClient.invalidateQueries({ queryKey: ['adminFantasyOverview'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err.message),
    });

    const copyAccountNumber = async () => {
        try {
            await navigator.clipboard.writeText(payout.account_number);
            toast.success('Account number copied!');
        } catch {
            toast.error('Could not copy — select and copy it manually.');
        }
    };

    return (
        <div className="p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                {/* Who + when */}
                <div className="lg:w-64 shrink-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <PayoutBadge status={payout.status} />
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            {new Date(payout.created_at).toLocaleString()}
                        </span>
                    </div>
                    <p className="text-sm font-black text-white mt-1.5">{payout.user_name || 'Unknown manager'}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{payout.user_email || '—'}</p>
                    {payout.user_notes && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2">
                            “{payout.user_notes}”
                        </p>
                    )}
                    {payout.admin_notes && (
                        <p className="text-[11px] text-amber-400/90 mt-2 border-l-2 border-amber-500/40 pl-2">
                            Admin: {payout.admin_notes}
                        </p>
                    )}
                    {payout.payment_reference && (
                        <p className="text-[11px] text-emerald-400 mt-2 font-mono break-all">
                            Ref: {payout.payment_reference}
                        </p>
                    )}
                </div>

                {/* Bank details — the operator retypes these into their banking app */}
                <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-2">
                        Transfer To
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 block">Bank</span>
                            <span className="text-sm font-bold text-white break-words">{payout.bank_name}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 block">Account Number</span>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-white font-mono tracking-widest tabular-nums">
                                    {payout.account_number}
                                </span>
                                <button
                                    onClick={copyAccountNumber}
                                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-sffl-red hover:text-white text-gray-700 dark:text-gray-300 transition cursor-pointer"
                                    aria-label="Copy account number"
                                    title="Copy account number"
                                >
                                    <ClipboardDocumentIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 block">Account Name</span>
                            <span className="text-sm font-bold text-white break-words">{payout.account_name}</span>
                        </div>
                    </div>
                </div>

                {/* Amount + actions */}
                <div className="lg:w-64 shrink-0 flex flex-col gap-2">
                    <div className="bg-gray-50 dark:bg-gray-700/50 border border-yellow-500/25 rounded-xl px-4 py-3 text-right">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 block">Amount</span>
                        <span className="text-2xl font-black text-sffl-red tabular-nums">{formatKobo(payout.amount_kobo)}</span>
                    </div>

                    {isTerminal ? (
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-right">
                            {payout.status === 'CANCELLED' ? 'Cancelled by the manager.' : 'Closed — status can no longer change.'}
                            {payout.processed_at && ` (${new Date(payout.processed_at).toLocaleDateString()})`}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {payout.status === 'PENDING' && (
                                <button
                                    onClick={() => updateMutation.mutate({ status: 'PROCESSING' })}
                                    disabled={updateMutation.isPending}
                                    className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs uppercase transition cursor-pointer disabled:opacity-50"
                                >
                                    Mark Processing
                                </button>
                            )}
                            <button
                                onClick={() => setMode(mode === 'paid' ? null : 'paid')}
                                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/10 cursor-pointer"
                            >
                                {mode === 'paid' ? 'Cancel' : 'Mark Paid'}
                            </button>
                            <button
                                onClick={() => setMode(mode === 'reject' ? null : 'reject')}
                                className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-sffl-red text-gray-700 dark:text-gray-300 font-bold text-xs uppercase transition cursor-pointer"
                            >
                                {mode === 'reject' ? 'Cancel' : 'Reject'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {mode === 'paid' && (
                <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4">
                    <label className="text-xs font-black uppercase tracking-wider text-emerald-300 block mb-1">
                        Bank Transfer Reference <span className="text-red-400">*required</span>
                    </label>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                        The reference your bank gave for this transfer. Marking paid debits the manager's wallet permanently.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="e.g. GTB/TRF/00918273"
                            className="flex-1 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-white placeholder:text-gray-400 dark:text-gray-500 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                            onClick={() => updateMutation.mutate({
                                status: 'PAID',
                                payment_reference: paymentReference.trim(),
                                admin_notes: adminNotes.trim() || undefined,
                            })}
                            disabled={updateMutation.isPending || !paymentReference.trim()}
                            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {updateMutation.isPending ? <Spinner /> : `Confirm ${formatKobo(payout.amount_kobo)} Paid`}
                        </button>
                    </div>
                </div>
            )}

            {mode === 'reject' && (
                <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
                    <label className="text-xs font-black uppercase tracking-wider text-red-300 block mb-1">
                        Rejection Reason <span className="text-red-400">*required</span>
                    </label>
                    <p className="text-[11px] text-amber-300/90 mb-2 flex items-start gap-1.5">
                        <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                        Rejecting returns {formatKobo(payout.amount_kobo)} to this manager's wallet balance. They will see this reason.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="e.g. Account name does not match the registered manager"
                            className="flex-1 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-white placeholder:text-gray-400 dark:text-gray-500 focus:outline-none focus:border-red-500"
                        />
                        <button
                            onClick={() => updateMutation.mutate({ status: 'REJECTED', admin_notes: adminNotes.trim() })}
                            disabled={updateMutation.isPending || !adminNotes.trim()}
                            className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-red-600/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {updateMutation.isPending ? <Spinner dark={false} /> : 'Reject & Refund Wallet'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
