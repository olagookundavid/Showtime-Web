import { useMemo, useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
    TrophyIcon,
    CalendarIcon,
    CurrencyDollarIcon,
    PlusIcon,
    ClockIcon,
    ArrowPathIcon,
    BanknotesIcon,
    UsersIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ExclamationTriangleIcon,
    ClipboardDocumentIcon,
    XMarkIcon,
    XCircleIcon,
    TrashIcon,
    LockClosedIcon,
    ShieldCheckIcon,
    Cog6ToothIcon,
    ArrowLeftIcon,
    RocketLaunchIcon,
    ChevronRightIcon,
    PencilSquareIcon,
    EyeIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
    fantasyApi,
    fantasyAdminApi,
    formatKobo,
    formatFantasyPrice,
    getCompetitions
} from '../../services/api';
import type {
    FantasySeason,
    FantasyGameweek,
    AdminLeagueRow,
    AdminLeagueMemberRow,
    AdminManagerRow,
    AdminPlayerPriceRow,
    OwedRow,
    PayoutRequest,
    PayoutStatus,
    PrizeAward,
    SettlementResult,
    ScheduledMatchDay
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { RowActions } from '../../components/ui/RowActions';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { Pagination } from '../../components/ui/Pagination';
import { getApiErrorMessage } from '../../utils/apiError';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';
import { usePermissions } from '../../hooks/usePermissions';
import { Button, Field, IconButton, Input, Modal, Select } from '../../components/ui';

/**
 * Commissioner has view-only access to Fantasy (backend: routes.go's
 * adminFantasy group, feature "fantasy") — every mutation in this file must
 * check this before calling the API, the same way the existing client-side
 * checks below ("Select a competition", etc.) throw inside mutationFn so
 * errorText() surfaces them. Without it a view-only Commissioner could click
 * a mutating button and get a confusing 403 instead of a clear message.
 */
const VIEW_ONLY_FANTASY_ERROR = 'View-only access: your role can view Fantasy but not make changes.';

/** `datetime-local` gives a local wall-clock string; the API wants RFC3339. */
const toRFC3339 = (localValue: string): string => new Date(localValue).toISOString();

/** Formats an RFC3339 instant for a `datetime-local` input, in local time. */
const toDateTimeLocalValue = (isoValue: string): string => {
    const d = new Date(isoValue);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Formats a YYYY-MM-DD match date into a user-friendly format (e.g., Sun, Sep 13, 2026). */
const formatMatchDate = (dateStr: string): string => {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

/** Formats an ISO kickoff timestamp into a local 12-hour time string (e.g., 10:00 AM). */
const formatKickoff = (isoString?: string): string => {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
};

/** "1st", "2nd", "3rd", "4th"… */
const ordinal = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

/** "1st" / "Joint 1st (2 way)" when the position was tied. */
const awardPlaceLabel = (rank: number, sharedWith: number): string =>
    sharedWith > 1 ? `Joint ${ordinal(rank)} (${sharedWith} way)` : ordinal(rank);

/** "12 hours" / "45 mins" for a lock window. */
const lockLabel = (mins: number): string => (mins >= 60 ? `${mins / 60} hours` : `${mins} mins`);

/**
 * Server error text where there is one, otherwise the message of a locally
 * thrown Error (a failed client-side check), otherwise a generic fallback.
 */
const errorText = (err: unknown, fallback = 'Something went wrong'): string =>
    getApiErrorMessage(err, err instanceof Error && err.message ? err.message : fallback);

const NO_ROWS = [] as never[];

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
    { key: 'pricing', label: 'Player Pricing', icon: CurrencyDollarIcon },
    { key: 'leagues', label: 'Leagues', icon: TrophyIcon },
    { key: 'managers', label: 'Managers', icon: UsersIcon },
    { key: 'finance', label: 'Finance', icon: BanknotesIcon },
] as const;

type SeasonTabKey = typeof SEASON_TABS[number]['key'];

// ─── Shared presentational bits ──────────────────────────────────────────────

function TabBar<K extends string>({ tabs, active, onChange }: {
    tabs: readonly { key: K; label: string; icon: ComponentType<{ className?: string }> }[];
    active: K;
    onChange: (key: K) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl p-2 shadow-sm">
            {tabs.map(({ key, label, icon }) => (
                <Button
                    key={key}
                    variant={active === key ? 'navy' : 'ghost'}
                    icon={icon}
                    aria-pressed={active === key}
                    onClick={() => onChange(key)}
                >
                    {label}
                </Button>
            ))}
        </div>
    );
}

const SectionCard = ({ title, icon: Icon, children, action }: {
    title: string;
    icon?: ComponentType<{ className?: string }>;
    children: ReactNode;
    action?: ReactNode;
}) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-700/40">
            <h3 className="text-base font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2 min-w-0">
                {Icon && <Icon className="w-4 h-4 text-sffl-red shrink-0" aria-hidden="true" />} {title}
            </h3>
            {action}
        </div>
        {children}
    </div>
);

/** Title row above a DataTable, which draws its own card. */
const SectionHeading = ({ title, icon: Icon, action }: {
    title: string;
    icon?: ComponentType<{ className?: string }>;
    action?: ReactNode;
}) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2 min-w-0">
            {Icon && <Icon className="w-4 h-4 text-sffl-red shrink-0" aria-hidden="true" />} {title}
        </h3>
        {action}
    </div>
);

const StatCard = ({ label, value, hint, tone = 'neutral' }: {
    label: string;
    value: string | number;
    hint?: string;
    tone?: 'neutral' | 'yellow' | 'emerald' | 'red';
}) => {
    // These cards sit on a near-white surface in light mode and a dark one in
    // dark mode, so every tone needs both halves. A single light-only colour
    // here leaves the figure invisible on one of the two themes.
    const toneCls =
        tone === 'yellow' ? 'text-sffl-red' :
        tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
        tone === 'red' ? 'text-red-600 dark:text-red-400' :
        'text-gray-900 dark:text-white';
    return (
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">{label}</span>
            <span className={`block mt-1.5 text-xl font-black tabular-nums wrap-break-word ${toneCls}`}>{value}</span>
            {hint && <span className="block mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</span>}
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
        <div className="space-y-6 text-gray-900 dark:text-white">
            <DashboardPageHeader
                title="Fantasy"
                subtitle="Every fantasy season you run, and the manual payout queue that spans all of them."
            />

            {/* Top-level tab bar */}
            <TabBar tabs={TOP_TABS} active={topTab} onChange={setTopTab} />

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
function useReleaseSeasonMutation(onSettled?: () => void) {
    const queryClient = useQueryClient();
    const { canEdit } = usePermissions();
    return useMutation({
        mutationFn: async (seasonId: string) => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            return fantasyApi.adminActivateSeason(seasonId);
        },
        onSuccess: () => {
            toast.success('Season released — players can see it now.');
            queryClient.invalidateQueries({ queryKey: ['adminFantasySeason'] });
        },
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => onSettled?.(),
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
        description="Releasing publishes this season to every player on the site."
        confirmLabel="Release Season"
        tone="success"
        icon={RocketLaunchIcon}
        pending={pending}
        onCancel={onCancel}
        onConfirm={onConfirm}
        body={
            <div className="space-y-3">
                <ConfirmSummary rows={[
                    ['Season', season.name],
                    ['Now', 'DRAFT'],
                    ['Becomes', 'ACTIVE'],
                ]} />
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Players will immediately see it and can start entering squads. After releasing, initialize
                    player prices and schedule at least one gameweek — without an open gameweek managers still
                    cannot pick a squad.
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
    const { canEdit } = usePermissions();
    const [releasing, setReleasing] = useState<FantasySeason | null>(null);
    const [deleting, setDeleting] = useState<FantasySeason | null>(null);

    const releaseMutation = useReleaseSeasonMutation(() => setReleasing(null));

    const deleteMutation = useMutation({
        mutationFn: async (seasonId: string) => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            return fantasyAdminApi.deleteSeason(seasonId);
        },
        onSuccess: () => {
            toast.success('Season deleted.');
            queryClient.invalidateQueries({ queryKey: ['adminFantasySeason'] });
        },
        // The server refuses anything that isn't an untouched draft — its own
        // wording ("season has squads entered") is more useful than ours.
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => setDeleting(null),
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
                    <div className="p-6 sm:p-8 text-center">
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
                                        <h4 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white wrap-break-word">
                                            {s.name}
                                        </h4>
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                                        {SEASON_STATUS_META[s.status].meaning}
                                    </p>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                                        Budget <strong className="text-gray-600 dark:text-gray-300">₦{s.budget}m</strong>
                                        {' · '}Squad <strong className="text-gray-600 dark:text-gray-300">{s.squad_size}</strong>
                                        {' · '}Min female <strong className="text-gray-600 dark:text-gray-300">{s.min_female_offense} OFF / {s.min_female_defense} DEF</strong>
                                        {' · '}Max <strong className="text-gray-600 dark:text-gray-300">{s.max_per_club}</strong> per club
                                        {' · '}Lock <strong className="text-gray-600 dark:text-gray-300">{lockLabel(s.lock_mins_before)}</strong> before kickoff
                                        {' · '}Created {new Date(s.created_at).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                    {s.status === 'DRAFT' && (
                                        <>
                                            <Button
                                                variant="success"
                                                icon={RocketLaunchIcon}
                                                onClick={() => setReleasing(s)}
                                            >
                                                Release
                                            </Button>
                                            <IconButton
                                                icon={TrashIcon}
                                                variant="danger"
                                                label={`Delete ${s.name}`}
                                                title="Delete draft season"
                                                onClick={() => setDeleting(s)}
                                            />
                                        </>
                                    )}
                                    <Button
                                        icon={ChevronRightIcon}
                                        iconPosition="right"
                                        onClick={() => onManage(s.id)}
                                    >
                                        Manage
                                    </Button>
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
                    description="This permanently removes the season and every gameweek scheduled under it."
                    confirmLabel="Delete Season"
                    tone="warning"
                    icon={TrashIcon}
                    pending={deleteMutation.isPending}
                    onCancel={() => setDeleting(null)}
                    onConfirm={() => deleteMutation.mutate(deleting.id)}
                    body={
                        <div className="space-y-3">
                            <ConfirmSummary rows={[['Season', deleting.name], ['Status', deleting.status]]} />
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                Only a draft season that nobody has entered a squad in can be deleted. The season row
                                and its gameweeks are removed and cannot be recovered.
                            </p>
                        </div>
                    }
                />
            )}
        </div>
    );
}

// ─── Create season (moved off Setup — a season is created from the index) ────

function CreateSeasonCard() {
    const queryClient = useQueryClient();
    const { canEdit } = usePermissions();
    const [confirming, setConfirming] = useState(false);

    const { data: competitionsData } = useQuery({
        queryKey: ['adminCompetitions'],
        queryFn: () => getCompetitions(1, 50),
    });

    const [seasonForm, setSeasonForm] = useState({
        competition_id: '',
        name: 'Showtime Season 2026 Fantasy',
        budget: 100,
        min_female_offense: 3,
        min_female_defense: 3,
        max_per_club: 3,
        lock_mins_before: 720,
    });

    const createSeasonMutation = useMutation({
        mutationFn: async () => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
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
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => setConfirming(false),
    });

    const requestCreate = () => {
        if (!seasonForm.competition_id) {
            toast.error('Select a competition');
            return;
        }
        if (!seasonForm.name.trim()) {
            toast.error('Give the season a name');
            return;
        }
        setConfirming(true);
    };

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 shadow-sm">
            <h2 className="text-lg font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                <PlusIcon className="w-5 h-5 text-sffl-red shrink-0" aria-hidden="true" /> Create Fantasy Season
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
                The new season starts as a <strong>DRAFT</strong> — private to admins until you release it.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Competition" htmlFor="fantasy-season-competition">
                    <Select
                        id="fantasy-season-competition"
                        value={seasonForm.competition_id}
                        onChange={(e) => setSeasonForm({ ...seasonForm, competition_id: e.target.value })}
                    >
                        <option value="">Select a competition</option>
                        {competitionsData?.data?.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </Select>
                </Field>

                <Field label="Season name" htmlFor="fantasy-season-name">
                    <Input
                        id="fantasy-season-name"
                        type="text"
                        value={seasonForm.name}
                        onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                    />
                </Field>

                <Field label="Salary cap budget (SC)" htmlFor="fantasy-season-budget">
                    <Input
                        id="fantasy-season-budget"
                        type="number"
                        value={seasonForm.budget}
                        onChange={(e) => setSeasonForm({ ...seasonForm, budget: parseFloat(e.target.value) || 100 })}
                    />
                </Field>

                <Field
                    label={<>Lock minutes before kickoff <span className="font-normal text-gray-400">(720 = 12 hours)</span></>}
                    htmlFor="fantasy-season-lock"
                >
                    <Input
                        id="fantasy-season-lock"
                        type="number"
                        value={seasonForm.lock_mins_before}
                        onChange={(e) => setSeasonForm({ ...seasonForm, lock_mins_before: parseInt(e.target.value) || 720 })}
                    />
                </Field>
            </div>

            <Button
                onClick={requestCreate}
                disabled={createSeasonMutation.isPending}
                className="mt-6 w-full sm:w-auto"
            >
                Create draft season
            </Button>

            <ConfirmDialog
                open={confirming}
                title="Create this fantasy season?"
                description="It starts as a draft, private to admins until you release it."
                confirmLabel="Create Draft Season"
                tone="info"
                icon={PlusIcon}
                pending={createSeasonMutation.isPending}
                onCancel={() => setConfirming(false)}
                onConfirm={() => createSeasonMutation.mutate()}
                body={
                    <ConfirmSummary rows={[
                        ['Competition', competitionsData?.data?.find(c => c.id === seasonForm.competition_id)?.name],
                        ['Season', seasonForm.name.trim()],
                        ['Budget', `${seasonForm.budget} SC`],
                        ['Lock', `${lockLabel(seasonForm.lock_mins_before)} before kickoff`],
                    ]} />
                }
            />
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
            <Button variant="ghost" icon={ArrowLeftIcon} onClick={onBack}>
                All seasons
            </Button>

            {/* Season header */}
            <div className="bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <SeasonStatusBadge status={season.status} />
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {SEASON_STATUS_META[season.status].meaning}
                        </span>
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-sffl-navy dark:text-white mt-1.5 wrap-break-word">
                        {season.name}
                    </h2>
                </div>

                {season.status === 'DRAFT' && (
                    <Button variant="success" icon={RocketLaunchIcon} onClick={() => setReleasing(true)} className="shrink-0">
                        Release season
                    </Button>
                )}
            </div>

            {/* A created season is DRAFT until released, and a draft is
                invisible to players. Say so plainly — otherwise "created
                successfully" followed by an empty public site is baffling. */}
            {season.status !== 'ACTIVE' && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-sm min-w-0">
                        <p className="font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 wrap-break-word">
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
                    <ExclamationTriangleIcon className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-sm min-w-0">
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
            <TabBar tabs={SEASON_TABS} active={tab} onChange={setTab} />

            {tab === 'setup' && <SetupTab season={season} />}
            {tab === 'pricing' && <PricingTab seasonId={season.id} />}
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

type SetupAction =
    | { kind: 'initPrices' }
    | { kind: 'autoSchedule' }
    | { kind: 'createGw' }
    | { kind: 'deadline'; gw: FantasyGameweek }
    | { kind: 'finalize'; gw: FantasyGameweek }
    | { kind: 'deleteGw'; gw: FantasyGameweek };

function SetupTab({ season }: { season: FantasySeason }) {
    const queryClient = useQueryClient();
    const { canEdit } = usePermissions();

    const { data: gameweeks = [], isLoading: gwLoading } = useQuery({
        queryKey: ['adminFantasyGameweeks', season.id],
        queryFn: () => fantasyApi.getGameweeks(season.id),
    });

    const { data: matchDays = [], isLoading: matchDaysLoading } = useQuery<ScheduledMatchDay[]>({
        queryKey: ['adminFantasyScheduledMatchDays', season.id],
        queryFn: () => fantasyApi.adminGetScheduledMatchDays(season.id),
    });

    // Every write waits here for the confirm dialog
    const [action, setAction] = useState<SetupAction | null>(null);

    // Create Gameweek Form State. `deadline` is a `datetime-local` value and is
    // optional: left blank, the server derives it from the match day's first
    // kickoff minus the season's lock_mins_before.
    const [gwForm, setGwForm] = useState({
        match_date: '',
        deadline: '',
    });

    // The next free number follows the schedule; typing one overrides it until the next gameweek is created.
    const [gwNumberInput, setGwNumberInput] = useState<number | null>(null);
    const nextGwNumber = gameweeks.length > 0 ? Math.max(...gameweeks.map(g => g.number)) + 1 : 1;
    const gwNumber = gwNumberInput ?? nextGwNumber;

    // Gameweek whose deadline is being corrected, plus the pending edit value.
    const [editingDeadlineGwId, setEditingDeadlineGwId] = useState<string | null>(null);
    const [deadlineDraft, setDeadlineDraft] = useState('');

    const handleMatchDateChange = (dateStr: string) => {
        const md = matchDays.find(m => m.date === dateStr);
        let suggestedDeadline = '';
        if (md && md.earliest_kickoff) {
            const kickoff = new Date(md.earliest_kickoff);
            const lockMins = season.lock_mins_before || 720;
            const deadlineDate = new Date(kickoff.getTime() - lockMins * 60 * 1000);
            suggestedDeadline = toDateTimeLocalValue(deadlineDate.toISOString());
        }
        setGwForm(prev => ({
            ...prev,
            match_date: dateStr,
            deadline: suggestedDeadline || prev.deadline,
        }));
    };

    const invalidateGameweeks = () => {
        queryClient.invalidateQueries({ queryKey: ['adminFantasyGameweeks', season.id] });
        queryClient.invalidateQueries({ queryKey: ['adminFantasyScheduledMatchDays', season.id] });
    };

    // Mutations
    const initPricesMutation = useMutation({
        mutationFn: async (seasonId: string) => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            return fantasyApi.adminInitializePrices(seasonId);
        },
        onSuccess: () => toast.success("Player prices initialized!"),
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => setAction(null),
    });

    const autoScheduleMutation = useMutation({
        mutationFn: async () => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            return fantasyApi.adminAutoScheduleGameweeks(season.id);
        },
        onSuccess: (gws) => {
            toast.success(`Successfully auto-scheduled ${gws.length} gameweek(s) from match fixtures!`);
            invalidateGameweeks();
        },
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => setAction(null),
    });

    const createGwMutation = useMutation({
        mutationFn: async () => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            if (!gwForm.match_date) throw new Error("Select a Match Date from the competition schedule");
            return fantasyApi.adminCreateGameweek(season.id, {
                number: gwNumber,
                match_date: gwForm.match_date,
                deadline: gwForm.deadline ? toRFC3339(gwForm.deadline) : undefined,
            });
        },
        onSuccess: () => {
            toast.success("Gameweek scheduled!");
            setGwForm({ match_date: '', deadline: '' });
            setGwNumberInput(null);
            invalidateGameweeks();
        },
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => setAction(null),
    });

    const updateDeadlineMutation = useMutation({
        mutationFn: async ({ gwId, deadline }: { gwId: string; deadline: string }) => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            if (!deadline) throw new Error("Pick a new deadline first");
            return fantasyApi.adminUpdateGameweekDeadline(gwId, toRFC3339(deadline));
        },
        onSuccess: () => {
            toast.success("Deadline updated!");
            setEditingDeadlineGwId(null);
            setDeadlineDraft('');
            queryClient.invalidateQueries({ queryKey: ['adminFantasyGameweeks', season.id] });
        },
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => setAction(null),
    });

    const finalizeGwMutation = useMutation({
        mutationFn: async (gwId: string) => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            return fantasyApi.adminFinalizeGameweek(gwId);
        },
        onSuccess: () => {
            toast.success("Gameweek finalized and official scores computed!");
            queryClient.invalidateQueries({ queryKey: ['adminFantasyGameweeks', season.id] });
        },
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => setAction(null),
    });

    const deleteGwMutation = useMutation({
        mutationFn: async (gwId: string) => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            return fantasyApi.adminDeleteGameweek(gwId);
        },
        onSuccess: () => {
            toast.success("Gameweek deleted and remaining schedule re-synced!");
            invalidateGameweeks();
        },
        onError: (err: unknown) => toast.error(errorText(err, 'Failed to delete gameweek')),
        onSettled: () => setAction(null),
    });

    const requestCreateGw = () => {
        if (!gwForm.match_date) {
            toast.error('Select a Match Date from the competition schedule');
            return;
        }
        setAction({ kind: 'createGw' });
    };

    const requestDeadline = (gw: FantasyGameweek) => {
        if (!deadlineDraft) {
            toast.error('Pick a new deadline first');
            return;
        }
        setAction({ kind: 'deadline', gw });
    };

    const runAction = () => {
        if (!action) return;
        switch (action.kind) {
            case 'initPrices': return initPricesMutation.mutate(season.id);
            case 'autoSchedule': return autoScheduleMutation.mutate();
            case 'createGw': return createGwMutation.mutate();
            case 'deadline': return updateDeadlineMutation.mutate({ gwId: action.gw.id, deadline: deadlineDraft });
            case 'finalize': return finalizeGwMutation.mutate(action.gw.id);
            case 'deleteGw': return deleteGwMutation.mutate(action.gw.id);
        }
    };

    const anyPending =
        initPricesMutation.isPending || autoScheduleMutation.isPending || createGwMutation.isPending ||
        updateDeadlineMutation.isPending || finalizeGwMutation.isPending || deleteGwMutation.isPending;

    if (gwLoading) {
        return <Loader />;
    }

    const dialog = (() => {
        switch (action?.kind) {
            case 'initPrices':
                return {
                    title: 'Initialize player prices?',
                    description: 'Calculates a starting price for every player from their ratings. Prices you have overridden are protected.',
                    confirmLabel: 'Initialize Prices',
                    tone: 'info' as const,
                    icon: CurrencyDollarIcon,
                    body: <ConfirmSummary rows={[['Season', season.name], ['Budget', `₦${season.budget}m`]]} />,
                };
            case 'autoSchedule':
                return {
                    title: `Auto-schedule ${matchDays.length} gameweek${matchDays.length === 1 ? '' : 's'}?`,
                    description: `Maps each competition match date to a gameweek, with lock deadlines ${lockLabel(season.lock_mins_before || 720)} before the earliest kickoff.`,
                    confirmLabel: 'Auto-Schedule',
                    tone: 'info' as const,
                    icon: RocketLaunchIcon,
                    body: <ConfirmSummary rows={[['Season', season.name], ['Match days', String(matchDays.length)]]} />,
                };
            case 'createGw':
                return {
                    title: `Schedule Gameweek ${gwNumber}?`,
                    description: undefined,
                    confirmLabel: 'Schedule Gameweek',
                    tone: 'info' as const,
                    icon: CalendarIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Season', season.name],
                            ['Gameweek', String(gwNumber)],
                            ['Match date', gwForm.match_date ? formatMatchDate(gwForm.match_date) : undefined],
                            ['Lock deadline', gwForm.deadline ? new Date(gwForm.deadline).toLocaleString() : 'Worked out from the first kickoff'],
                        ]} />
                    ),
                };
            case 'deadline':
                return {
                    title: `Change the deadline for Gameweek ${action.gw.number}?`,
                    description: undefined,
                    confirmLabel: 'Save Deadline',
                    tone: 'info' as const,
                    icon: ClockIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Gameweek', String(action.gw.number)],
                            ['Now', new Date(action.gw.deadline).toLocaleString()],
                            ['Change to', deadlineDraft ? new Date(deadlineDraft).toLocaleString() : undefined],
                        ]} />
                    ),
                };
            case 'finalize': {
                const rescore = action.gw.status === 'FINALIZED';
                return {
                    title: `${rescore ? 'Re-score' : 'Finalize'} Gameweek ${action.gw.number}?`,
                    description: rescore
                        ? 'Official scores are recomputed. This replaces the earlier result rather than double-counting.'
                        : 'Official scores are computed for every lineup in this gameweek.',
                    confirmLabel: rescore ? 'Re-score' : 'Finalize & Score',
                    tone: 'info' as const,
                    icon: rescore ? ArrowPathIcon : CheckCircleIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Gameweek', String(action.gw.number)],
                            ['Status', action.gw.status],
                            ['Lock deadline', new Date(action.gw.deadline).toLocaleString()],
                        ]} />
                    ),
                };
            }
            case 'deleteGw':
                return {
                    title: `Delete Gameweek ${action.gw.number}?`,
                    description: 'Unfinalized draft or rollover lineups for this gameweek are removed, and remaining scheduled gameweeks are renumbered in calendar order.',
                    confirmLabel: 'Delete Gameweek',
                    tone: 'warning' as const,
                    icon: TrashIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Gameweek', String(action.gw.number)],
                            ['Lock deadline', new Date(action.gw.deadline).toLocaleString()],
                        ]} />
                    ),
                };
            default:
                return { title: '', description: undefined, confirmLabel: 'Confirm', tone: 'info' as const, icon: CheckCircleIcon, body: undefined };
        }
    })();

    return (
        <div className="space-y-8">
            {/* Season Operations Card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <SeasonStatusBadge status={season.status} />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Budget: <strong>₦{season.budget}m</strong></span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Squad Size: <strong>{season.squad_size} Starters</strong></span>
                        </div>
                        <h2 className="text-xl font-black uppercase text-sffl-navy dark:text-white mt-1 wrap-break-word">{season.name}</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="secondary"
                            icon={CurrencyDollarIcon}
                            onClick={() => setAction({ kind: 'initPrices' })}
                            disabled={anyPending}
                        >
                            Initialize prices
                        </Button>
                    </div>
                </div>
            </div>

            {/* Gameweeks Section */}
            <div className="space-y-6">
                {/* 1-Click Fast Schedule from Matches */}
                {matchDays.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-full bg-sffl-red text-white text-[10px] font-black uppercase tracking-wider">
                                    Fast Setup
                                </span>
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                    {matchDays.length} Match Day{matchDays.length !== 1 ? 's' : ''} Found in Competition Fixtures
                                </span>
                            </div>
                            <h3 className="text-base font-black uppercase text-sffl-navy dark:text-white mt-1">
                                Auto-Schedule All Gameweeks from Matches
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
                                Automatically maps each competition match date to Gameweek 1, 2, and so on, with lock deadlines set {lockLabel(season.lock_mins_before || 720)} before the earliest kickoff.
                            </p>
                        </div>
                        <Button
                            icon={RocketLaunchIcon}
                            onClick={() => setAction({ kind: 'autoSchedule' })}
                            disabled={anyPending}
                            className="shrink-0"
                        >
                            Auto-schedule {matchDays.length} gameweeks
                        </Button>
                    </div>
                )}

                {/* Create Gameweek Form */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 shadow-sm">
                    <h3 className="text-base font-black uppercase text-sffl-navy dark:text-white mb-4 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-sffl-red shrink-0" aria-hidden="true" /> Schedule Individual Gameweek
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Gameweek number" htmlFor="gw-number">
                            <Input
                                id="gw-number"
                                type="number"
                                value={gwNumber}
                                onChange={(e) => setGwNumberInput(parseInt(e.target.value) || 1)}
                            />
                        </Field>

                        <Field
                            label="Competition match date"
                            htmlFor="gw-match-date"
                            error={!matchDaysLoading && matchDays.length === 0 ? "No matches found with dates for this season's competition. Add matches in Match Schedule first." : undefined}
                        >
                            <Select
                                id="gw-match-date"
                                value={gwForm.match_date}
                                onChange={(e) => handleMatchDateChange(e.target.value)}
                            >
                                <option value="">
                                    {matchDaysLoading
                                        ? 'Loading match fixtures'
                                        : matchDays.length === 0
                                        ? 'No matches scheduled for this competition'
                                        : 'Select a match date'}
                                </option>
                                {matchDays.map(md => {
                                    const kickoffStr = md.earliest_kickoff ? ` · Kickoff: ${formatKickoff(md.earliest_kickoff)}` : '';
                                    return (
                                        <option key={md.date} value={md.date}>
                                            {formatMatchDate(md.date)} ({md.match_count} Match{md.match_count !== 1 ? 'es' : ''}{kickoffStr})
                                        </option>
                                    );
                                })}
                            </Select>
                        </Field>

                        <Field
                            className="sm:col-span-2"
                            label={<>Lock deadline <span className="text-gray-400 dark:text-gray-500 font-medium">(optional)</span></>}
                            htmlFor="gw-deadline"
                            hint={`Leave blank and the server automatically computes it from the match day's earliest kickoff minus the lock window (${lockLabel(season.lock_mins_before)}).`}
                        >
                            <Input
                                id="gw-deadline"
                                type="datetime-local"
                                value={gwForm.deadline}
                                onChange={(e) => setGwForm({ ...gwForm, deadline: e.target.value })}
                            />
                        </Field>
                    </div>

                    <Button
                        onClick={requestCreateGw}
                        disabled={anyPending || !gwForm.match_date}
                        className="mt-4 w-full sm:w-auto"
                    >
                        Schedule gameweek
                    </Button>
                </div>

                {/* Gameweeks List */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h3 className="text-base font-black uppercase text-sffl-navy dark:text-white">Gameweeks</h3>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block shrink-0" />
                            Auto-Scoring Active: automatically finalizes when all games finish & stats are submitted
                        </span>
                    </div>

                    {gameweeks.length === 0 ? (
                        <div className="p-6 sm:p-8 text-center text-gray-500 dark:text-gray-400 text-xs">
                            No gameweeks scheduled yet. Use the Auto-Schedule button above or select a match date to schedule one.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {gameweeks.map(gw => {
                                const isFinalized = gw.status === 'FINALIZED';
                                const isEditingDeadline = editingDeadlineGwId === gw.id;
                                const matchedDay = matchDays.find(md => md.event_day_id === gw.event_day_id);

                                return (
                                    <div key={gw.id} className="p-4">
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-gray-900 dark:text-white">Gameweek {gw.number}</span>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                        isFinalized ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' :
                                                        gw.status === 'LOCKED' ? 'bg-red-500/10 text-red-500 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                    }`}>
                                                        {gw.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap">
                                                    {matchedDay && (
                                                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                                                            Match Day: {formatMatchDate(matchedDay.date)} ({matchedDay.match_count} Match{matchedDay.match_count !== 1 ? 'es' : ''})
                                                        </span>
                                                    )}
                                                    <span>Lock Deadline: {new Date(gw.deadline).toLocaleString()}</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    variant="secondary"
                                                    icon={isEditingDeadline ? XMarkIcon : ClockIcon}
                                                    onClick={() => {
                                                        if (isEditingDeadline) {
                                                            setEditingDeadlineGwId(null);
                                                            return;
                                                        }
                                                        setEditingDeadlineGwId(gw.id);
                                                        setDeadlineDraft(toDateTimeLocalValue(gw.deadline));
                                                    }}
                                                >
                                                    {isEditingDeadline ? 'Cancel' : 'Edit deadline'}
                                                </Button>

                                                {/* Finalizing is re-runnable — it recomputes rather than
                                                    double-counts — and is the path for correcting stats
                                                    after the fact, so it stays available once finalized. */}
                                                <Button
                                                    variant="secondary"
                                                    icon={isFinalized ? ArrowPathIcon : undefined}
                                                    onClick={() => setAction({ kind: 'finalize', gw })}
                                                    disabled={anyPending}
                                                >
                                                    {isFinalized ? 'Re-score' : 'Finalize & score'}
                                                </Button>

                                                {!isFinalized && (
                                                    <Button
                                                        variant="danger"
                                                        icon={TrashIcon}
                                                        onClick={() => setAction({ kind: 'deleteGw', gw })}
                                                        disabled={anyPending}
                                                        title={`Delete Gameweek ${gw.number}`}
                                                    >
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {isEditingDeadline && (
                                            <div className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-end gap-3">
                                                <Field label="New lock deadline" htmlFor={`gw-deadline-${gw.id}`} className="flex-1">
                                                    <Input
                                                        id={`gw-deadline-${gw.id}`}
                                                        type="datetime-local"
                                                        value={deadlineDraft}
                                                        onChange={(e) => setDeadlineDraft(e.target.value)}
                                                    />
                                                </Field>
                                                <Button
                                                    onClick={() => requestDeadline(gw)}
                                                    disabled={anyPending || !deadlineDraft}
                                                >
                                                    Save deadline
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog
                open={action !== null}
                title={dialog.title}
                description={dialog.description}
                body={dialog.body}
                confirmLabel={dialog.confirmLabel}
                tone={dialog.tone}
                icon={dialog.icon}
                pending={anyPending}
                onConfirm={runAction}
                onCancel={() => setAction(null)}
            />
        </div>
    );
}

// ─── Leagues tab ─────────────────────────────────────────────────────────────

function LeaguesTab({ seasonId }: { seasonId: string }) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [openLeague, setOpenLeague] = useState<AdminLeagueRow | null>(null);
    const limit = 20;

    const { data, isLoading } = useQuery({
        queryKey: ['adminFantasyLeagues', seasonId, search, page],
        queryFn: () => fantasyAdminApi.listLeagues(seasonId, { search: search || undefined, page, limit }),
        placeholderData: (prev) => prev,
    });

    const leagues = data?.data ?? NO_ROWS as AdminLeagueRow[];

    // The list refetches after a settlement, so the open league reads its badges from the live row.
    const activeLeague = openLeague ? (leagues.find(l => l.league_id === openLeague.league_id) ?? openLeague) : null;

    const columns = useMemo<Column<AdminLeagueRow>[]>(() => [
        {
            header: 'League',
            accessor: 'name',
            sortable: true,
            cell: (l) => (
                <button
                    type="button"
                    onClick={() => setOpenLeague(l)}
                    className="min-h-11 text-left font-bold text-gray-900 dark:text-white hover:text-sffl-red hover:underline cursor-pointer wrap-break-word"
                >
                    {l.name}
                </button>
            ),
        },
        { header: 'Type', cell: (l) => <TypeBadge type={l.type} /> },
        {
            header: 'Owner',
            accessor: 'owner_name',
            sortable: true,
            cell: (l) => <span className="text-gray-500 dark:text-gray-400 text-xs">{l.owner_name || '—'}</span>,
        },
        {
            header: 'Entry Fee',
            align: 'right',
            sortable: true,
            sortValue: (l) => l.entry_fee_kobo,
            cell: (l) => (
                <span className="tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {l.entry_fee_kobo > 0 ? formatKobo(l.entry_fee_kobo) : <span className="text-gray-400 dark:text-gray-500">Free</span>}
                </span>
            ),
        },
        {
            header: 'Members',
            sortable: true,
            sortValue: (l) => l.member_count,
            cell: (l) => (
                <span className="text-xs">
                    <span className="text-gray-900 dark:text-white font-bold tabular-nums">{l.member_count}</span>
                    {l.entry_fee_kobo > 0 && (
                        <span className="text-gray-400 dark:text-gray-500 ml-2 whitespace-nowrap">
                            <span className="text-emerald-400">{l.paid_members} paid</span>
                            {' · '}
                            <span className="text-amber-400">{l.pending_members} pending</span>
                        </span>
                    )}
                </span>
            ),
        },
        {
            header: 'Prize Pool',
            align: 'right',
            sortable: true,
            sortValue: (l) => l.prize_pool_kobo,
            cell: (l) => (
                <span className="tabular-nums font-bold text-sffl-red whitespace-nowrap">
                    {l.entry_fee_kobo > 0 ? formatKobo(l.prize_pool_kobo) : <span className="text-gray-400 dark:text-gray-500">—</span>}
                </span>
            ),
        },
        {
            header: 'Status',
            cell: (l) => l.entry_fee_kobo > 0
                ? <SettledBadge settled={l.settled} />
                : <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-black whitespace-nowrap">Free league</span>,
        },
        {
            header: 'Actions',
            align: 'right',
            cell: (l) => (
                <RowActions
                    label={`Actions for ${l.name}`}
                    actions={[{ label: 'View league', icon: EyeIcon, onSelect: () => setOpenLeague(l) }]}
                />
            ),
        },
    ], []);

    return (
        <div className="space-y-6">
            {activeLeague && <LeagueDetailView league={activeLeague} seasonId={seasonId} onBack={() => setOpenLeague(null)} />}

            {/* The list stays mounted while a league is open so its search and page survive going back. */}
            <div className={openLeague ? 'hidden' : 'space-y-6'}>
                <CreateLeagueCard seasonId={seasonId} />

                <div className="space-y-3">
                    <SectionHeading title="Leagues" icon={TrophyIcon} />
                    <DataTable
                        data={leagues}
                        columns={columns}
                        getRowId={(l) => l.league_id}
                        loading={isLoading}
                        searchPlaceholder="Search leagues"
                        onSearchSubmit={(q) => { setSearch(q.trim()); setPage(1); }}
                        serverPage={page}
                        totalServerPages={data?.total_pages || 1}
                        onPageChange={setPage}
                        itemsPerPage={limit}
                        emptyMessage="No leagues found."
                    />
                </div>
            </div>
        </div>
    );
}

function LeagueDetailView({ league, seasonId, onBack }: { league: AdminLeagueRow; seasonId: string; onBack: () => void }) {
    return (
        <div className="space-y-4">
            <Button variant="ghost" icon={ArrowLeftIcon} onClick={onBack}>
                All leagues
            </Button>
            <div className="bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap">
                    <TypeBadge type={league.type} />
                    {league.entry_fee_kobo > 0 && <SettledBadge settled={league.settled} />}
                </div>
                <h2 className="text-xl font-black uppercase tracking-wider text-sffl-navy dark:text-white mt-1.5 wrap-break-word">
                    {league.name}
                </h2>
                {league.owner_name && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Owner: {league.owner_name}</p>
                )}
            </div>
            <LeagueDetailPanel league={league} seasonId={seasonId} />
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
    const { canEdit } = usePermissions();
    const [open, setOpen] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [form, setForm] = useState({
        name: '',
        type: 'PUBLIC' as 'PUBLIC' | 'PRIVATE',
        entry_fee_naira: 0,
        max_members: 0,
    });

    const createLeagueMutation = useMutation({
        mutationFn: async () => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
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
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => setConfirming(false),
    });

    const feeKobo = Math.round((Number(form.entry_fee_naira) || 0) * 100);

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-700/40">
                <div className="min-w-0">
                    <h3 className="text-base font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                        <PlusIcon className="w-4 h-4 text-sffl-red shrink-0" aria-hidden="true" /> Create League
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        A <strong>PUBLIC</strong> league is browsable by any player; a <strong>PRIVATE</strong> one is
                        joinable by invite code only.
                    </p>
                </div>
                <Button
                    variant="secondary"
                    icon={open ? XMarkIcon : PlusIcon}
                    onClick={() => setOpen(o => !o)}
                    className="shrink-0"
                >
                    {open ? 'Cancel' : 'New league'}
                </Button>
            </div>

            {open && (
                <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="League name" htmlFor="league-name">
                            <Input
                                id="league-name"
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Showtime Office League"
                            />
                        </Field>

                        <Field label="Type" htmlFor="league-type">
                            <Select
                                id="league-type"
                                value={form.type}
                                onChange={(e) => setForm({ ...form, type: e.target.value as 'PUBLIC' | 'PRIVATE' })}
                            >
                                <option value="PUBLIC">PUBLIC — anyone can browse and join</option>
                                <option value="PRIVATE">PRIVATE — invite code only</option>
                            </Select>
                        </Field>

                        <Field
                            label="Entry fee (₦)"
                            htmlFor="league-entry-fee"
                            hint={feeKobo > 0
                                ? `Members pay ${formatKobo(feeKobo)} to join.`
                                : 'Zero makes this a free league — no prize pool and nothing to settle.'}
                        >
                            <Input
                                id="league-entry-fee"
                                type="number"
                                min={0}
                                value={form.entry_fee_naira}
                                onChange={(e) => setForm({ ...form, entry_fee_naira: parseFloat(e.target.value) || 0 })}
                            />
                        </Field>

                        <Field label="Max members" htmlFor="league-max-members" hint="0 means unlimited.">
                            <Input
                                id="league-max-members"
                                type="number"
                                min={0}
                                value={form.max_members}
                                onChange={(e) => setForm({ ...form, max_members: parseInt(e.target.value) || 0 })}
                            />
                        </Field>
                    </div>

                    <Button
                        onClick={() => {
                            if (!form.name.trim()) {
                                toast.error('Give the league a name');
                                return;
                            }
                            setConfirming(true);
                        }}
                        disabled={createLeagueMutation.isPending || !form.name.trim()}
                        className="mt-5 w-full sm:w-auto"
                    >
                        Create league
                    </Button>
                </div>
            )}

            <ConfirmDialog
                open={confirming}
                title="Create this league?"
                description={feeKobo > 0 ? `Members pay ${formatKobo(feeKobo)} to join.` : 'It is a free league, so it has no prize pool.'}
                confirmLabel="Create League"
                tone="info"
                icon={PlusIcon}
                pending={createLeagueMutation.isPending}
                onCancel={() => setConfirming(false)}
                onConfirm={() => createLeagueMutation.mutate()}
                body={
                    <ConfirmSummary rows={[
                        ['League', form.name.trim()],
                        ['Type', form.type],
                        ['Entry fee', feeKobo > 0 ? formatKobo(feeKobo) : 'Free'],
                        ['Max members', form.max_members > 0 ? String(form.max_members) : 'Unlimited'],
                    ]} />
                }
            />
        </div>
    );
}

// Awards and members are the same on every league, so their columns are built once.
const AWARD_COLUMNS: Column<PrizeAward>[] = [
    {
        header: 'Manager',
        sortable: true,
        sortValue: (a) => a.user_name,
        cell: (a) => <span className="text-gray-700 dark:text-gray-300 font-bold">{a.user_name}</span>,
    },
    {
        header: 'Place',
        sortable: true,
        sortValue: (a) => a.rank,
        cell: (a) => <span className="font-black text-gray-900 dark:text-white whitespace-nowrap">{awardPlaceLabel(a.rank, a.shared_with)}</span>,
    },
    { header: 'Team', accessor: 'team_name', cell: (a) => <span className="text-gray-500 dark:text-gray-400 text-xs">{a.team_name}</span> },
    {
        header: 'Points',
        align: 'right',
        sortable: true,
        sortValue: (a) => a.points,
        cell: (a) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{a.points}</span>,
    },
    {
        header: 'Award',
        align: 'right',
        sortable: true,
        sortValue: (a) => a.amount_kobo,
        cell: (a) => <span className="tabular-nums font-black text-sffl-red whitespace-nowrap">{formatKobo(a.amount_kobo)}</span>,
    },
];

const MEMBER_COLUMNS: Column<AdminLeagueMemberRow>[] = [
    {
        header: 'Manager',
        sortable: true,
        sortValue: (m) => m.user_name,
        cell: (m) => <span className="font-bold text-gray-900 dark:text-white">{m.user_name}</span>,
    },
    { header: 'Email', cell: (m) => <span className="text-gray-500 dark:text-gray-400 text-xs">{m.user_email}</span> },
    { header: 'Team', cell: (m) => <span className="text-gray-700 dark:text-gray-300 text-xs">{m.team_name}</span> },
    {
        header: 'Points',
        align: 'right',
        sortable: true,
        sortValue: (m) => m.total_points,
        cell: (m) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{m.total_points}</span>,
    },
    { header: 'Payment', cell: (m) => <PaymentBadge status={m.payment_status} /> },
    {
        header: 'Paystack Ref',
        cell: (m) => <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500 break-all">{m.paystack_reference || '—'}</span>,
    },
];

const MEMBERS_PAGE_SIZE = 25;

function LeagueDetailPanel({ league, seasonId }: { league: AdminLeagueRow; seasonId: string }) {
    const queryClient = useQueryClient();
    const { canEdit } = usePermissions();
    const leagueId = league.league_id;

    const { data: finance, isLoading: financeLoading } = useQuery({
        queryKey: ['adminLeagueFinance', leagueId],
        queryFn: () => fantasyAdminApi.getLeagueFinance(leagueId),
    });

    const [membersPage, setMembersPage] = useState(1);
    const { data: membersPaged, isLoading: membersLoading } = useQuery({
        queryKey: ['adminLeagueMembers', leagueId, membersPage],
        queryFn: () => fantasyAdminApi.listLeagueMembers(leagueId, { page: membersPage, limit: MEMBERS_PAGE_SIZE }),
        placeholderData: (prev) => prev,
    });
    const members = membersPaged?.data ?? NO_ROWS as AdminLeagueMemberRow[];

    // `null` means "not edited yet" — fall through to the server's structure so a
    // background refetch can't clobber a save the operator hasn't made yet.
    const [tierDraft, setTierDraft] = useState<{ rank: number; percent: number }[] | null>(null);
    const [confirm, setConfirm] = useState<'settle' | 'prizes' | null>(null);

    const serverTiers = (finance?.prize_structure || []).map(t => ({ rank: t.rank, percent: t.percent }));
    const tiers = tierDraft ?? serverTiers;
    const totalPercent = tiers.reduce((s, t) => s + (Number(t.percent) || 0), 0);
    const settled = finance?.settled ?? league.settled;
    const isPaid = (finance?.entry_fee_kobo ?? league.entry_fee_kobo) > 0;

    const setTiers = (next: { rank: number; percent: number }[]) =>
        setTierDraft(next.map((t, i) => ({ rank: i + 1, percent: t.percent })));

    const savePrizesMutation = useMutation({
        mutationFn: async () => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            return fantasyAdminApi.setPrizeStructure(leagueId, tiers);
        },
        onSuccess: () => {
            toast.success('Prize structure saved!');
            setTierDraft(null);
            queryClient.invalidateQueries({ queryKey: ['adminLeagueFinance', leagueId] });
            queryClient.invalidateQueries({ queryKey: ['adminFantasyLeagues'] });
        },
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => setConfirm(null),
    });

    const settleMutation = useMutation({
        mutationFn: async () => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            return fantasyAdminApi.settleLeague(leagueId);
        },
        onSuccess: (res) => {
            toast.success(`League settled — ${settlementSummary(res)}`);
            queryClient.invalidateQueries({ queryKey: ['adminLeagueFinance', leagueId] });
            queryClient.invalidateQueries({ queryKey: ['adminFantasyLeagues'] });
            queryClient.invalidateQueries({ queryKey: ['adminFantasyOverview', seasonId] });
            queryClient.invalidateQueries({ queryKey: ['adminFantasyOwed'] });
        },
        onError: (err: unknown) => {
            // 409 is the "already settled" race, not a failure worth a generic message.
            if ((err as { response?: { status?: number } })?.response?.status === 409) {
                toast.error(getApiErrorMessage(err, 'This league has already been settled.'));
                queryClient.invalidateQueries({ queryKey: ['adminLeagueFinance', leagueId] });
                queryClient.invalidateQueries({ queryKey: ['adminFantasyLeagues'] });
                return;
            }
            toast.error(errorText(err));
        },
        onSettled: () => setConfirm(null),
    });

    if (financeLoading || !finance) {
        return <div className="py-8"><Loader /></div>;
    }

    const awardTotal = finance.awards.reduce((s, a) => s + a.amount_kobo, 0);

    return (
        <div className="space-y-4">
            {/* Money ledger */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <BanknotesIcon className="w-4 h-4 text-sffl-red shrink-0" aria-hidden="true" /> League Finance
                </h4>
                <div className="space-y-1.5 text-sm max-w-md">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">Gross collected ({finance.paid_members} paid entries)</span>
                        <span className="font-bold tabular-nums text-gray-900 dark:text-white shrink-0">{formatKobo(finance.gross_entry_kobo)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">Less platform cut ({finance.cut_percent}%)</span>
                        <span className="font-bold tabular-nums text-red-400 shrink-0">−{formatKobo(finance.platform_cut_kobo)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-gray-900 dark:text-white font-black uppercase text-xs tracking-wider">Prize pool</span>
                        <span className="font-black tabular-nums text-sffl-red text-base shrink-0">{formatKobo(finance.prize_pool_kobo)}</span>
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
            <div className="space-y-3">
                <SectionHeading
                    title="Awards"
                    icon={TrophyIcon}
                    action={
                        <span className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                                settled
                                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                    : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                            }`}>
                                {settled ? 'Final' : 'Projected'}
                            </span>
                            {finance.awards.length} winner(s) · {formatKobo(awardTotal)}
                        </span>
                    }
                />
                <DataTable
                    data={finance.awards}
                    columns={AWARD_COLUMNS}
                    getRowId={(a) => `${a.user_id}-${a.rank}`}
                    searchable={false}
                    paginated={false}
                    compact
                    emptyMessage={`No awards ${settled ? 'were made' : 'projected yet'} — set a prize structure and make sure members have paid.`}
                />
            </div>

            {/* Prize structure editor */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex flex-wrap items-center gap-2">
                    <CurrencyDollarIcon className="w-4 h-4 text-sffl-red shrink-0" aria-hidden="true" /> Prize Structure
                    {settled && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <LockClosedIcon className="w-3 h-3" aria-hidden="true" /> Locked
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
                                <div key={i} className="flex flex-wrap items-center gap-2">
                                    <span className="w-12 text-xs font-black uppercase text-gray-500 dark:text-gray-400 tabular-nums">
                                        {ordinal(t.rank)}
                                    </span>
                                    <div className="flex-1 min-w-28">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={t.percent}
                                            aria-label={`Percent for ${ordinal(t.rank)} place`}
                                            onChange={(e) => {
                                                const next = [...tiers];
                                                next[i] = { ...next[i], percent: parseFloat(e.target.value) || 0 };
                                                setTiers(next);
                                            }}
                                            action={<span className="pr-3 text-xs text-gray-400 dark:text-gray-500 pointer-events-none">%</span>}
                                        />
                                    </div>
                                    <span className="min-w-24 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                                        {formatKobo(Math.round(finance.prize_pool_kobo * (Number(t.percent) || 0) / 100))}
                                    </span>
                                    <IconButton
                                        icon={TrashIcon}
                                        variant="danger"
                                        label={`Remove position ${t.rank}`}
                                        onClick={() => setTiers(tiers.filter((_, idx) => idx !== i))}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap mt-4">
                            <Button
                                variant="secondary"
                                icon={PlusIcon}
                                onClick={() => setTiers([...tiers, { rank: tiers.length + 1, percent: 0 }])}
                            >
                                Add position
                            </Button>
                            <Button
                                onClick={() => setConfirm('prizes')}
                                disabled={savePrizesMutation.isPending || tierDraft === null}
                            >
                                Save structure
                            </Button>
                            {tierDraft !== null && (
                                <Button variant="secondary" onClick={() => setTierDraft(null)}>
                                    Discard changes
                                </Button>
                            )}
                            <span className={`text-xs font-bold tabular-nums ${totalPercent > 100 ? 'text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                Total: {totalPercent}% {totalPercent > 100 && '— over 100%, the server will reject this'}
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* Members */}
            <div className="space-y-3">
                <SectionHeading title={`Members (${membersPaged?.total ?? 0})`} icon={UsersIcon} />
                <DataTable
                    data={members}
                    columns={MEMBER_COLUMNS}
                    getRowId={(m) => m.user_id}
                    loading={membersLoading}
                    searchable={false}
                    serverPage={membersPage}
                    totalServerPages={membersPaged?.total_pages || 1}
                    onPageChange={setMembersPage}
                    itemsPerPage={MEMBERS_PAGE_SIZE}
                    emptyMessage="No members yet."
                />
            </div>

            {/* Settle */}
            {isPaid && !settled && (
                <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                            <ShieldCheckIcon className="w-4 h-4 shrink-0" aria-hidden="true" /> Settle League
                        </h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 max-w-lg">
                            Credits {formatKobo(awardTotal)} to {finance.awards.length} winner wallet(s) and closes this league's prize pool. This moves real money and cannot be undone.
                        </p>
                    </div>
                    <Button
                        variant="warning"
                        icon={ShieldCheckIcon}
                        onClick={() => setConfirm('settle')}
                        disabled={finance.awards.length === 0}
                        className="shrink-0"
                    >
                        Settle league
                    </Button>
                </div>
            )}

            <ConfirmDialog
                open={confirm === 'settle'}
                title="Settle this league?"
                description="This credits real money into user wallets and cannot be reversed."
                confirmLabel="Settle & Credit"
                tone="warning"
                icon={ShieldCheckIcon}
                pending={settleMutation.isPending}
                onCancel={() => setConfirm(null)}
                onConfirm={() => settleMutation.mutate()}
                body={
                    <div className="space-y-3">
                        <ConfirmSummary rows={[
                            ['League', finance.league_name],
                            ['Winners to be credited', String(finance.awards.length)],
                            ['Total credited', formatKobo(awardTotal)],
                        ]} />
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            No money leaves the business here. Winners are credited in-app and have to request a
                            withdrawal with their bank details; you then pay it by hand from the Payouts tab.
                        </p>
                    </div>
                }
            />

            <ConfirmDialog
                open={confirm === 'prizes'}
                title="Save this prize structure?"
                description="It decides how the prize pool is split between finishing positions when the league is settled."
                confirmLabel="Save Structure"
                tone="info"
                icon={CurrencyDollarIcon}
                pending={savePrizesMutation.isPending}
                onCancel={() => setConfirm(null)}
                onConfirm={() => savePrizesMutation.mutate()}
                body={
                    <ConfirmSummary rows={[
                        ['League', finance.league_name],
                        ['Positions paid', String(tiers.length)],
                        ['Total', `${totalPercent}% of the prize pool`],
                        ...tiers.map((t): [string, string] => [ordinal(t.rank), `${t.percent}%`]),
                    ]} />
                }
            />
        </div>
    );
}

// ─── Managers tab ────────────────────────────────────────────────────────────

// The row is named by the manager, which stays frozen; rank is a narrow number so it sits second.
const MANAGER_COLUMNS: Column<AdminManagerRow>[] = [
    {
        header: 'Manager',
        sortable: true,
        sortValue: (m) => m.user_name,
        cell: (m) => <span className="font-bold text-gray-900 dark:text-white wrap-break-word">{m.user_name}</span>,
    },
    {
        header: 'Rank',
        align: 'right',
        sortable: true,
        sortValue: (m) => m.rank,
        cell: (m) => <span className="tabular-nums font-black text-gray-400 dark:text-gray-500">#{m.rank}</span>,
    },
    { header: 'Email', cell: (m) => <span className="text-gray-500 dark:text-gray-400 text-xs">{m.user_email}</span> },
    { header: 'Team', cell: (m) => <span className="text-gray-700 dark:text-gray-300 text-xs">{m.team_name}</span> },
    {
        header: 'Points',
        align: 'right',
        sortable: true,
        sortValue: (m) => m.total_points,
        cell: (m) => <span className="tabular-nums font-bold text-sffl-red">{m.total_points}</span>,
    },
    {
        header: 'Lineups',
        align: 'right',
        sortable: true,
        sortValue: (m) => m.lineup_count,
        cell: (m) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{m.lineup_count}</span>,
    },
    {
        header: 'Leagues',
        align: 'right',
        sortable: true,
        sortValue: (m) => m.league_count,
        cell: (m) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{m.league_count}</span>,
    },
    {
        header: 'Wallet',
        align: 'right',
        sortable: true,
        sortValue: (m) => m.wallet_balance_kobo,
        cell: (m) => <span className="tabular-nums text-emerald-500 dark:text-emerald-400 font-bold whitespace-nowrap">{formatKobo(m.wallet_balance_kobo)}</span>,
    },
];

const MANAGERS_PAGE_SIZE = 25;

function ManagersTab({ seasonId }: { seasonId: string }) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ['adminFantasyManagers', seasonId, search, page],
        queryFn: () => fantasyAdminApi.listManagers(seasonId, { search: search || undefined, page, limit: MANAGERS_PAGE_SIZE }),
        placeholderData: (prev) => prev,
    });

    return (
        <div className="space-y-3">
            <SectionHeading title="Managers" icon={UsersIcon} />
            <DataTable
                data={data?.data ?? NO_ROWS as AdminManagerRow[]}
                columns={MANAGER_COLUMNS}
                getRowId={(m) => m.user_id}
                loading={isLoading}
                searchPlaceholder="Search name, email or team"
                onSearchSubmit={(q) => { setSearch(q.trim()); setPage(1); }}
                serverPage={page}
                totalServerPages={data?.total_pages || 1}
                onPageChange={setPage}
                itemsPerPage={MANAGERS_PAGE_SIZE}
                emptyMessage="No managers found."
            />
        </div>
    );
}

// ─── Finance tab ─────────────────────────────────────────────────────────────

function FinanceTab({ seasonId }: { seasonId: string }) {
    const queryClient = useQueryClient();
    const { canEdit } = usePermissions();
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
        // Settling is what creates the obligation, so the owed list is stale.
        queryClient.invalidateQueries({ queryKey: ['adminFantasyOwed'] });
    };

    const settleSeasonMutation = useMutation({
        mutationFn: async () => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            return fantasyAdminApi.settleSeason(seasonId);
        },
        onSuccess: (res) => {
            toast.success(`Season settled — ${settlementSummary(res)}`);
            invalidateAfterSettlement();
        },
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => setConfirmMode(null),
    });

    const completeSeasonMutation = useMutation({
        mutationFn: async () => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            return fantasyAdminApi.completeSeason(seasonId);
        },
        onSuccess: (res) => {
            toast.success(`Season completed — ${settlementSummary(res)}`);
            invalidateAfterSettlement();
        },
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => setConfirmMode(null),
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
                <div className="p-4 sm:p-5">
                    <div className="max-w-xl space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-gray-500 dark:text-gray-400">Gross entry collected</span>
                            <span className="font-bold tabular-nums text-gray-900 dark:text-white text-base shrink-0">{formatKobo(overview.gross_entry_kobo)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-gray-500 dark:text-gray-400">Less platform cut ({overview.cut_percent}%)</span>
                            <span className="font-bold tabular-nums text-emerald-500 dark:text-emerald-400 text-base shrink-0">{formatKobo(overview.platform_cut_kobo)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-gray-900 dark:text-white font-black uppercase text-xs tracking-wider">Prize pool owed to managers</span>
                            <span className="font-black tabular-nums text-sffl-red text-xl shrink-0">{formatKobo(overview.prize_pool_kobo)}</span>
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
                        <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" /> Season Settlement
                    </h3>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                        Both actions credit real money into user wallets. There is no undo.
                    </p>
                </div>

                <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4 flex flex-col justify-between gap-4">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white">Settle All Leagues</h4>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                                Settles every outstanding paid league and credits winners, but leaves the season open
                                so gameweeks can still be scored.
                            </p>
                        </div>
                        <Button
                            variant="warning"
                            onClick={() => setConfirmMode('settle')}
                            disabled={overview.unsettled_leagues === 0}
                            fullWidth
                        >
                            {overview.unsettled_leagues === 0 ? 'Nothing to settle' : `Settle ${overview.unsettled_leagues} league(s)`}
                        </Button>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 border border-red-500/25 rounded-xl p-4 flex flex-col justify-between gap-4">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white">Complete Season</h4>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                                Settles every outstanding paid league <strong className="text-gray-900 dark:text-white">and then closes the season</strong>.
                                Once closed the season is final — do this only when every gameweek has been scored.
                            </p>
                        </div>
                        <Button variant="danger" onClick={() => setConfirmMode('complete')} fullWidth>
                            Complete season
                        </Button>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={confirmMode === 'settle'}
                title="Settle all outstanding leagues?"
                description="This credits real money into user wallets and cannot be reversed."
                confirmLabel="Settle All"
                tone="warning"
                icon={ShieldCheckIcon}
                pending={settleSeasonMutation.isPending}
                onCancel={() => setConfirmMode(null)}
                onConfirm={() => settleSeasonMutation.mutate()}
                body={
                    <div className="space-y-3">
                        <ConfirmSummary rows={[
                            ['Unsettled paid leagues', String(overview.unsettled_leagues)],
                            ['Season prize pool', formatKobo(overview.prize_pool_kobo)],
                        ]} />
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            No money leaves the business here — winners are credited in-app, and each withdrawal is
                            paid by hand from the Payouts tab. The season stays open afterwards; use Complete Season
                            to close it.
                        </p>
                    </div>
                }
            />

            <ConfirmDialog
                open={confirmMode === 'complete'}
                title="Complete the season?"
                description="This settles every outstanding paid league, credits winners, and permanently closes the season."
                confirmLabel="Settle & Close Season"
                tone="warning"
                icon={ExclamationTriangleIcon}
                pending={completeSeasonMutation.isPending}
                onCancel={() => setConfirmMode(null)}
                onConfirm={() => completeSeasonMutation.mutate()}
                body={
                    <div className="space-y-3">
                        <ConfirmSummary rows={[
                            ['Season', overview.season_name],
                            ['Leagues still to settle', String(overview.unsettled_leagues)],
                            ['Prize pool to distribute', formatKobo(overview.prize_pool_kobo)],
                        ]} />
                        <p className="text-[11px] text-red-500 dark:text-red-400">
                            After this the season is closed and no further gameweeks can be scored.
                        </p>
                    </div>
                }
            />
        </div>
    );
}

// ─── Player Pricing tab ──────────────────────────────────────────────────────

// The band an override has to stay inside. These mirror PriceFloor and
// PriceCeiling in backend/internal/domain/fantasy_pricing.go, where the spread
// between them is what makes the 230.00 squad budget bind. The server enforces
// the same bounds — these only save a round trip.
const PRICE_FLOOR = 3.0;
const PRICE_CEILING = 12.5;

// Must match the position values stored on players verbatim — the server
// filters on `p.position = $n`, so anything not in this list matches nothing.
// Same vocabulary as AdminPlayers, TeamHeadPlayers and AdminTeamSheetModal.
const POSITION_OPTIONS = [
    { value: '', label: 'All Positions' },
    { value: 'QB', label: 'Quarterback (QB)' },
    { value: 'Receiver', label: 'Receiver' },
    { value: 'Center', label: 'Center' },
    { value: 'Rusher', label: 'Rusher' },
    { value: 'Defender', label: 'Defender' },
    { value: 'Allrounder', label: 'All-Rounder' },
];

type PricingAction = { kind: 'override'; player: AdminPlayerPriceRow; price: number } | { kind: 'reset'; player: AdminPlayerPriceRow };

const PRICING_PAGE_SIZE = 25;

function PricingTab({ seasonId }: { seasonId: string }) {
    const queryClient = useQueryClient();
    const { canEdit } = usePermissions();
    const [search, setSearch] = useState('');
    const [position, setPosition] = useState('');
    const [overrideStatus, setOverrideStatus] = useState<'all' | 'overridden' | 'calculated'>('all');
    const [page, setPage] = useState(1);

    const [editingPlayer, setEditingPlayer] = useState<AdminPlayerPriceRow | null>(null);
    const [overridePriceInput, setOverridePriceInput] = useState('');
    const [action, setAction] = useState<PricingAction | null>(null);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['adminPlayerPrices', seasonId, search, position, overrideStatus, page],
        queryFn: () => fantasyAdminApi.listPlayerPrices(seasonId, {
            search: search || undefined,
            position: position || undefined,
            override_status: overrideStatus,
            page,
            limit: PRICING_PAGE_SIZE,
        }),
        placeholderData: (prev) => prev,
    });

    const overrideMutation = useMutation({
        mutationFn: ({ playerId, price }: { playerId: string; price: number }) => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            return fantasyAdminApi.overridePlayerPrice(seasonId, playerId, { price });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminPlayerPrices', seasonId] });
            toast.success('Player price override saved');
            setEditingPlayer(null);
            setOverridePriceInput('');
        },
        onError: (err: unknown) => {
            toast.error(errorText(err, 'Failed to override price'));
        },
        onSettled: () => setAction(null),
    });

    const resetMutation = useMutation({
        mutationFn: (playerId: string) => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
            return fantasyAdminApi.overridePlayerPrice(seasonId, playerId, { reset: true });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminPlayerPrices', seasonId] });
            toast.success('Player price reset to calculated value');
        },
        onError: (err: unknown) => {
            toast.error(errorText(err, 'Failed to reset price'));
        },
        onSettled: () => setAction(null),
    });

    const columns = useMemo<Column<AdminPlayerPriceRow>[]>(() => [
        {
            header: 'Player',
            sortable: true,
            sortValue: (p) => p.player_name,
            cell: (p) => (
                <div className="flex items-center gap-3 min-w-0">
                    {p.player_image ? (
                        <img
                            src={p.player_image}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700 shrink-0"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-sffl-navy/10 dark:bg-gray-700 text-sffl-navy dark:text-gray-300 font-black text-xs flex items-center justify-center shrink-0">
                            {p.player_name.slice(0, 2).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0">
                        <span className="font-bold text-gray-900 dark:text-white block truncate">
                            {p.player_name}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            Rating: {p.rating ? p.rating.toFixed(1) : '5.0'}
                        </span>
                    </div>
                </div>
            ),
        },
        {
            header: 'Position',
            sortable: true,
            sortValue: (p) => p.position,
            cell: (p) => (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                    {p.position}
                </span>
            ),
        },
        {
            header: 'Team',
            cell: (p) => (
                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                    {p.team_logo && <img src={p.team_logo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                    <span className="truncate">{p.team_short_name || p.team_name || '—'}</span>
                </div>
            ),
        },
        {
            header: 'Calculated',
            align: 'right',
            sortable: true,
            sortValue: (p) => p.calculated_price ?? p.price,
            cell: (p) => <span className="tabular-nums text-xs text-gray-500 dark:text-gray-400">{formatFantasyPrice(p.calculated_price ?? p.price)}</span>,
        },
        {
            header: 'Active Price',
            align: 'right',
            sortable: true,
            sortValue: (p) => p.price,
            cell: (p) => (
                <span className={`tabular-nums font-black ${p.is_overridden ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                    {formatFantasyPrice(p.price)}
                </span>
            ),
        },
        {
            header: 'Status',
            align: 'center',
            cell: (p) => p.is_overridden ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                    Overridden
                </span>
            ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
                    Calculated
                </span>
            ),
        },
        {
            header: 'Actions',
            align: 'right',
            cell: (p) => (
                <RowActions
                    label={`Actions for ${p.player_name}`}
                    actions={[
                        {
                            label: 'Override price',
                            icon: PencilSquareIcon,
                            onSelect: () => {
                                setEditingPlayer(p);
                                setOverridePriceInput(p.price.toString());
                            },
                        },
                        {
                            label: 'Reset to calculated price',
                            icon: ArrowPathIcon,
                            danger: true,
                            disabled: !p.is_overridden,
                            hint: p.is_overridden ? undefined : 'Already using the calculated price.',
                            onSelect: () => setAction({ kind: 'reset', player: p }),
                        },
                    ]}
                />
            ),
        },
    ], []);

    const handleSaveOverride = (e: FormEvent) => {
        e.preventDefault();
        if (!editingPlayer) return;
        const val = parseFloat(overridePriceInput);
        if (isNaN(val) || val < PRICE_FLOOR || val > PRICE_CEILING) {
            toast.error(`Price must be between ₦${PRICE_FLOOR.toFixed(1)}m and ₦${PRICE_CEILING.toFixed(1)}m`);
            return;
        }
        setAction({ kind: 'override', player: editingPlayer, price: val });
    };

    const runAction = () => {
        if (!action) return;
        if (action.kind === 'override') overrideMutation.mutate({ playerId: action.player.player_id, price: action.price });
        else resetMutation.mutate(action.player.player_id);
    };

    const dialog = action?.kind === 'reset'
        ? {
            title: 'Reset to the calculated price?',
            description: 'The override is removed, so future gameweek calculations can change this price again.',
            confirmLabel: 'Reset Price',
            icon: ArrowPathIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Player', action.player.player_name],
                    ['Now', formatFantasyPrice(action.player.price)],
                    ['Resets to', formatFantasyPrice(action.player.calculated_price ?? action.player.price)],
                ]} />
            ),
        }
        : {
            title: 'Save this price override?',
            description: 'Overriding protects this price from being overwritten by future gameweek calculations.',
            confirmLabel: 'Save Override',
            icon: PencilSquareIcon,
            body: action ? (
                <ConfirmSummary rows={[
                    ['Player', action.player.player_name],
                    ['Now', formatFantasyPrice(action.player.price)],
                    ['New price', formatFantasyPrice(action.price)],
                ]} />
            ) : undefined,
        };

    return (
        <div className="space-y-3">
            <SectionHeading title="Player Pricing & Manual Overrides" icon={CurrencyDollarIcon} />

            <DataTable
                data={data?.data ?? NO_ROWS as AdminPlayerPriceRow[]}
                columns={columns}
                getRowId={(p) => p.player_id}
                loading={isLoading}
                searchPlaceholder="Search player by name"
                onSearchSubmit={(q) => { setSearch(q.trim()); setPage(1); }}
                serverPage={page}
                totalServerPages={data?.total_pages || 1}
                onPageChange={setPage}
                itemsPerPage={PRICING_PAGE_SIZE}
                emptyMessage="No players found matching your filters."
                headerActions={
                    <>
                        {isFetching && !isLoading && (
                            <ArrowPathIcon className="w-4 h-4 animate-spin text-gray-400" role="img" aria-label="Refreshing" />
                        )}
                        <Select
                            value={position}
                            onChange={(e) => { setPosition(e.target.value); setPage(1); }}
                            aria-label="Filter by position"
                            className="w-full sm:w-56"
                        >
                            {POSITION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </Select>

                        {/* Status filter */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            {(['all', 'overridden', 'calculated'] as const).map((st) => (
                                <Button
                                    key={st}
                                    variant={overrideStatus === st ? 'primary' : 'secondary'}
                                    size="sm"
                                    aria-pressed={overrideStatus === st}
                                    onClick={() => { setOverrideStatus(st); setPage(1); }}
                                >
                                    {st === 'all' ? 'All' : st === 'overridden' ? 'Overridden' : 'Calculated'}
                                </Button>
                            ))}
                        </div>
                    </>
                }
            />

            {/* Price Edit Modal Dialog */}
            {editingPlayer && (
                <Modal
                    open
                    onClose={() => setEditingPlayer(null)}
                    title={editingPlayer.player_name}
                    subtitle={`Manual Price Override · ${editingPlayer.position} · ${editingPlayer.team_short_name || editingPlayer.team_name}`}
                    maxWidth="md"
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setEditingPlayer(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" form="fantasy-override-form" disabled={overrideMutation.isPending}>
                                Save override
                            </Button>
                        </>
                    }
                >
                        <form id="fantasy-override-form" onSubmit={handleSaveOverride}>
                            <div className="space-y-4">
                                <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-200 dark:border-gray-600 space-y-1">
                                    <div className="flex justify-between gap-3 text-xs">
                                        <span className="text-gray-500 dark:text-gray-400">Model Calculated:</span>
                                        <span className="font-bold tabular-nums text-gray-700 dark:text-gray-200">
                                            {formatFantasyPrice(editingPlayer.calculated_price ?? editingPlayer.price)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3 text-xs">
                                        <span className="text-gray-500 dark:text-gray-400">Current Active Price:</span>
                                        <span className="font-bold tabular-nums text-gray-900 dark:text-white">
                                            {formatFantasyPrice(editingPlayer.price)}
                                        </span>
                                    </div>
                                </div>

                                <Field
                                    label={`New override price (₦${PRICE_FLOOR.toFixed(1)}m – ₦${PRICE_CEILING.toFixed(1)}m)`}
                                    htmlFor="override-price"
                                    hint={`Preview: ${formatFantasyPrice(parseFloat(overridePriceInput) || 0)}. Overriding protects this price from being overwritten by future gameweek calculations.`}
                                >
                                    <Input
                                        id="override-price"
                                        type="number"
                                        step="0.1"
                                        min={PRICE_FLOOR}
                                        max={PRICE_CEILING}
                                        required
                                        value={overridePriceInput}
                                        onChange={(e) => setOverridePriceInput(e.target.value)}
                                        placeholder="e.g. 10.5"
                                        action={<span className="pr-3 text-xs font-bold text-gray-400 pointer-events-none">m</span>}
                                    />
                                </Field>
                            </div>

                        </form>
                </Modal>
            )}

            <ConfirmDialog
                open={action !== null}
                title={dialog.title}
                description={dialog.description}
                body={dialog.body}
                confirmLabel={dialog.confirmLabel}
                tone={action?.kind === 'reset' ? 'warning' : 'info'}
                icon={dialog.icon}
                pending={overrideMutation.isPending || resetMutation.isPending}
                onConfirm={runAction}
                onCancel={() => setAction(null)}
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

    const { data, isLoading } = useQuery({
        queryKey: ['adminFantasyPayouts', status, page],
        // An empty filter means "all" — omit the param rather than sending `status=`.
        queryFn: () => fantasyAdminApi.listPayouts({ status: status || undefined, page, limit }),
        placeholderData: (prev) => prev,
    });

    // The queue is worked oldest-first: the longest-waiting manager is at the top.
    const payouts = [...(data?.data || [])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return (
        <div className="space-y-4 md:space-y-6">
            <MoneyOwedPanel />
            <SectionCard
                title="Payout Queue"
                icon={CurrencyDollarIcon}
                action={
                    <div className="flex flex-wrap gap-1.5">
                        {PAYOUT_FILTERS.map(f => (
                            <Button
                                key={f.key || 'all'}
                                size="sm"
                                variant={status === f.key ? 'navy' : 'secondary'}
                                aria-pressed={status === f.key}
                                onClick={() => { setStatus(f.key); setPage(1); }}
                            >
                                {f.label}
                            </Button>
                        ))}
                    </div>
                }
            >
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
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

                {data && data.total_pages > 1 && (
                    <div className="px-4 pb-6 border-t border-gray-200 dark:border-gray-700">
                        <Pagination currentPage={data.page || page} totalPages={data.total_pages} onPageChange={setPage} />
                    </div>
                )}
            </SectionCard>
        </div>
    );
}

/**
 * What settlement actually created: an obligation. Settling a league credits
 * winners' in-app wallets — no money leaves the business at that point — so this
 * is the standing list of who is owed what, and which account it goes to.
 *
 * Money nobody has requested yet is still owed, so it is counted here rather
 * than waiting to appear in the queue below.
 */
const OWED_COLUMNS: Column<OwedRow>[] = [
    {
        header: 'Person',
        sortable: true,
        sortValue: (r) => r.user_name || '',
        cell: (r) => (
            <div className="min-w-0">
                <p className="text-sm font-black text-sffl-navy dark:text-white truncate">{r.user_name || 'Unnamed'}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{r.user_email}</p>
            </div>
        ),
    },
    {
        header: 'Account',
        cell: (r) => r.account_number ? (
            <p className="text-[11px] text-gray-600 dark:text-gray-300">
                {r.bank_name} ·{' '}
                <span className="font-mono font-bold text-gray-900 dark:text-white">{r.account_number}</span>
                {' '}· {r.account_name}
            </p>
        ) : (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                <ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                No account on file — they need to request a withdrawal first.
            </p>
        ),
    },
    {
        header: 'In Wallet',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.balance_kobo,
        cell: (r) => <span className="text-sm font-black tabular-nums text-gray-900 dark:text-white whitespace-nowrap">{formatKobo(r.balance_kobo)}</span>,
    },
    {
        header: 'Requested',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.pending_payout_kobo,
        cell: (r) => (
            <span className={`text-sm font-black tabular-nums whitespace-nowrap ${r.pending_payout_kobo > 0 ? 'text-yellow-500' : 'text-gray-400 dark:text-gray-500'}`}>
                {formatKobo(r.pending_payout_kobo)}
            </span>
        ),
    },
    {
        header: 'Owed',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.total_owed_kobo,
        cell: (r) => <span className="text-sm font-black tabular-nums text-sffl-red whitespace-nowrap">{formatKobo(r.total_owed_kobo)}</span>,
    },
];

const OWED_PAGE_SIZE = 25;

function MoneyOwedPanel() {
    const [expanded, setExpanded] = useState(true);
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ['adminFantasyOwed', page],
        queryFn: () => fantasyAdminApi.getMoneyOwed({ page, limit: OWED_PAGE_SIZE }),
        placeholderData: (prev) => prev,
    });

    const rows = data?.rows ?? NO_ROWS as OwedRow[];

    return (
        <SectionCard
            title="Money Owed"
            icon={BanknotesIcon}
            action={
                <Button
                    variant="ghost"
                    size="sm"
                    icon={expanded ? ChevronUpIcon : ChevronDownIcon}
                    iconPosition="right"
                    onClick={() => setExpanded(v => !v)}
                    aria-expanded={expanded}
                >
                    {expanded ? 'Hide' : 'Show'}
                </Button>
            }
        >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    Settling a league credits each winner's wallet — it does not move any money. This is what those
                    credits add up to. A winner has to send us their account details before anything can be transferred.
                </p>
            </div>

            {isLoading ? (
                <div className="p-10"><Loader /></div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
                        <StatCard
                            label="Total owed"
                            value={formatKobo(data?.total_owed_kobo || 0)}
                            hint={`${data?.people || 0} ${data?.people === 1 ? 'person' : 'people'}`}
                            tone={(data?.total_owed_kobo || 0) > 0 ? 'yellow' : 'neutral'}
                        />
                        <StatCard
                            label="Requested"
                            value={formatKobo(data?.requested_kobo || 0)}
                            hint="waiting in the queue below"
                        />
                        <StatCard
                            label="Not yet requested"
                            value={formatKobo(data?.unrequested_kobo || 0)}
                            hint="sitting in wallets"
                        />
                        <StatCard
                            label="No account yet"
                            value={data?.awaiting_details || 0}
                            hint="cannot be paid until they add one"
                            tone={(data?.awaiting_details || 0) > 0 ? 'red' : 'neutral'}
                        />
                    </div>

                    {expanded && (
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                            <DataTable
                                data={rows}
                                columns={OWED_COLUMNS}
                                getRowId={(r) => r.user_id}
                                searchable={false}
                                serverPage={page}
                                totalServerPages={data?.total_pages || 1}
                                onPageChange={setPage}
                                itemsPerPage={OWED_PAGE_SIZE}
                                emptyMessage="Nobody is owed anything right now. Settle a paid league and its winners appear here."
                            />
                        </div>
                    )}
                </>
            )}
        </SectionCard>
    );
}

type PayoutConfirm = 'processing' | 'paid' | 'reject';

function PayoutRow({ payout }: { payout: PayoutRequest }) {
    const queryClient = useQueryClient();
    const { canEdit } = usePermissions();
    const [mode, setMode] = useState<'paid' | 'reject' | null>(null);
    const [paymentReference, setPaymentReference] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [confirm, setConfirm] = useState<PayoutConfirm | null>(null);

    const isTerminal = TERMINAL_STATUSES.includes(payout.status);
    const amount = formatKobo(payout.amount_kobo);

    const updateMutation = useMutation({
        mutationFn: async (payload: { status: 'PROCESSING' | 'PAID' | 'REJECTED'; admin_notes?: string; payment_reference?: string }) => {
            if (!canEdit('fantasy')) throw new Error(VIEW_ONLY_FANTASY_ERROR);
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
            queryClient.invalidateQueries({ queryKey: ['adminFantasyOwed'] });
        },
        onError: (err: unknown) => toast.error(errorText(err)),
        onSettled: () => setConfirm(null),
    });

    const requestPaid = () => {
        if (!paymentReference.trim()) {
            toast.error('A bank transfer reference is required to mark a payout paid.');
            return;
        }
        setConfirm('paid');
    };

    const requestReject = () => {
        if (!adminNotes.trim()) {
            toast.error('Give a reason for the rejection.');
            return;
        }
        setConfirm('reject');
    };

    const runConfirmed = () => {
        if (confirm === 'processing') {
            updateMutation.mutate({ status: 'PROCESSING' });
        } else if (confirm === 'paid') {
            updateMutation.mutate({
                status: 'PAID',
                payment_reference: paymentReference.trim(),
                admin_notes: adminNotes.trim() || undefined,
            });
        } else if (confirm === 'reject') {
            updateMutation.mutate({ status: 'REJECTED', admin_notes: adminNotes.trim() });
        }
    };

    const copyAccountNumber = async () => {
        try {
            await navigator.clipboard.writeText(payout.account_number);
            toast.success('Account number copied!');
        } catch {
            toast.error('Could not copy — select and copy it manually.');
        }
    };

    const dialog = (() => {
        const manager = payout.user_name || 'Unknown manager';
        switch (confirm) {
            case 'paid':
                return {
                    title: `Mark ${amount} as paid?`,
                    description: "This debits the manager's wallet permanently. Only confirm once the bank transfer has gone through.",
                    confirmLabel: `Confirm ${amount} Paid`,
                    tone: 'warning' as const,
                    icon: BanknotesIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Manager', manager],
                            ['Amount', amount],
                            ['Bank', payout.bank_name],
                            ['Account number', payout.account_number],
                            ['Account name', payout.account_name],
                            ['Reference', paymentReference.trim()],
                        ]} />
                    ),
                };
            case 'reject':
                return {
                    title: 'Reject this payout?',
                    description: `Rejecting returns ${amount} to this manager's wallet balance. They will see your reason.`,
                    confirmLabel: 'Reject & Refund Wallet',
                    tone: 'warning' as const,
                    icon: XCircleIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Manager', manager],
                            ['Amount', amount],
                            ['Reason', adminNotes.trim()],
                        ]} />
                    ),
                };
            default:
                return {
                    title: 'Mark this payout as processing?',
                    description: 'It moves out of the pending pile while you make the bank transfer.',
                    confirmLabel: 'Mark Processing',
                    tone: 'info' as const,
                    icon: ClockIcon,
                    body: <ConfirmSummary rows={[['Manager', manager], ['Amount', amount]]} />,
                };
        }
    })();

    return (
        <div className="p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                {/* Who + when */}
                <div className="lg:w-64 shrink-0 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <PayoutBadge status={payout.status} />
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            {new Date(payout.created_at).toLocaleString()}
                        </span>
                    </div>
                    <p className="text-sm font-black text-gray-900 dark:text-white mt-1.5 wrap-break-word">{payout.user_name || 'Unknown manager'}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 break-all">{payout.user_email || '—'}</p>
                    {payout.user_notes && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2 wrap-break-word">
                            “{payout.user_notes}”
                        </p>
                    )}
                    {payout.admin_notes && (
                        <p className="text-[11px] text-amber-500 dark:text-amber-400/90 mt-2 border-l-2 border-amber-500/40 pl-2 wrap-break-word">
                            Admin: {payout.admin_notes}
                        </p>
                    )}
                    {payout.payment_reference && (
                        <p className="text-[11px] text-emerald-500 dark:text-emerald-400 mt-2 font-mono break-all">
                            Ref: {payout.payment_reference}
                        </p>
                    )}
                </div>

                {/* Bank details — the operator retypes these into their banking app */}
                <div className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-2">
                        Transfer To
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 block">Bank</span>
                            <span className="text-sm font-bold text-gray-900 dark:text-white wrap-break-word">{payout.bank_name}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 block">Account Number</span>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-gray-900 dark:text-white font-mono tracking-widest tabular-nums">
                                    {payout.account_number}
                                </span>
                                <IconButton
                                    icon={ClipboardDocumentIcon}
                                    variant="secondary"
                                    label="Copy account number"
                                    onClick={copyAccountNumber}
                                />
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 block">Account Name</span>
                            <span className="text-sm font-bold text-gray-900 dark:text-white wrap-break-word">{payout.account_name}</span>
                        </div>
                    </div>
                </div>

                {/* Amount + actions */}
                <div className="lg:w-64 shrink-0 flex flex-col gap-2">
                    <div className="bg-gray-50 dark:bg-gray-700/50 border border-yellow-500/25 rounded-xl px-4 py-3 text-right">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 block">Amount</span>
                        <span className="text-2xl font-black text-sffl-red tabular-nums wrap-break-word">{amount}</span>
                    </div>

                    {isTerminal ? (
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-right">
                            {payout.status === 'CANCELLED' ? 'Cancelled by the manager.' : 'Closed — status can no longer change.'}
                            {payout.processed_at && ` (${new Date(payout.processed_at).toLocaleDateString()})`}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {payout.status === 'PENDING' && (
                                <Button
                                    variant="secondary"
                                    onClick={() => setConfirm('processing')}
                                    disabled={updateMutation.isPending}
                                >
                                    Mark processing
                                </Button>
                            )}
                            <Button
                                variant={mode === 'paid' ? 'secondary' : 'success'}
                                onClick={() => setMode(mode === 'paid' ? null : 'paid')}
                            >
                                {mode === 'paid' ? 'Cancel' : 'Mark paid'}
                            </Button>
                            <Button
                                variant={mode === 'reject' ? 'secondary' : 'danger'}
                                onClick={() => setMode(mode === 'reject' ? null : 'reject')}
                            >
                                {mode === 'reject' ? 'Cancel' : 'Reject'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {mode === 'paid' && (
                <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4">
                    <Field
                        label={<>Bank transfer reference <span className="text-red-400">*required</span></>}
                        htmlFor="payout-payment-reference"
                        hint="The reference your bank gave for this transfer. Marking paid debits the manager's wallet permanently."
                    >
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                id="payout-payment-reference"
                                type="text"
                                value={paymentReference}
                                onChange={(e) => setPaymentReference(e.target.value)}
                                placeholder="e.g. GTB/TRF/00918273"
                                className="flex-1"
                            />
                            <Button
                                variant="success"
                                onClick={requestPaid}
                                disabled={updateMutation.isPending || !paymentReference.trim()}
                                className="shrink-0"
                            >
                                {`Confirm ${amount} paid`}
                            </Button>
                        </div>
                    </Field>
                </div>
            )}

            {mode === 'reject' && (
                <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
                    <Field
                        label={<>Rejection reason <span className="text-red-400">*required</span></>}
                        htmlFor="payout-reject-reason"
                        hint={`Rejecting returns ${amount} to this manager's wallet balance. They will see this reason.`}
                    >
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                id="payout-reject-reason"
                                type="text"
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder="e.g. Account name does not match the registered manager"
                                className="flex-1"
                            />
                            <Button
                                variant="danger"
                                onClick={requestReject}
                                disabled={updateMutation.isPending || !adminNotes.trim()}
                                className="shrink-0"
                            >
                                Reject & refund wallet
                            </Button>
                        </div>
                    </Field>
                </div>
            )}

            <ConfirmDialog
                open={confirm !== null}
                title={dialog.title}
                description={dialog.description}
                body={dialog.body}
                confirmLabel={dialog.confirmLabel}
                tone={dialog.tone}
                icon={dialog.icon}
                pending={updateMutation.isPending}
                onConfirm={runConfirmed}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}
