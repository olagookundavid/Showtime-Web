import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
    ArrowPathIcon,
    ArrowUturnLeftIcon,
    CheckCircleIcon,
    ClockIcon,
    EyeSlashIcon,
    LockClosedIcon,
    ShieldCheckIcon,
    StopCircleIcon,
    TrashIcon,
    TrophyIcon,
    UserCircleIcon,
} from '@heroicons/react/24/outline';
import {
    clearAdminPOTWOverride,
    deleteAdminPOTWPoll,
    getAdminPOTWPoll,
    getAdminTOTWById,
    overrideAdminPOTW,
    saveAdminPOTWPoll,
} from '../../services/api';
import type { POTWPoll } from '../../types/potw';
import type { TOTWPlayer } from '../../types/totw';
import { Button, Field, Input, Select } from '../ui';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ConfirmSummary } from '../ui/ConfirmSummary';
import { POTWCountdown } from './POTWCountdown';
import { POTWResults } from './POTWResults';
import { potwPollQueryKey, useNow } from './potwUtils';

const MAX_NOMINEES = 5;
const MIN_NOMINEES = 2;

/** Voting-length shortcuts, in hours. */
const DURATIONS: [string, number][] = [
    ['24 hours', 24],
    ['2 days', 48],
    ['3 days', 72],
    ['7 days', 168],
];

/** A Date as the value a <input type="datetime-local"> expects, in local time. */
const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const apiError = (err: unknown, fallback: string) =>
    (axios.isAxiosError(err) && err.response?.data?.error) || fallback;

type Action =
    | { kind: 'save' }
    | { kind: 'endNow' }
    | { kind: 'delete' }
    | { kind: 'override'; playerId: string }
    | { kind: 'clearOverride' };

interface AdminPOTWPanelProps {
    totwId: string;
    canManage: boolean;
}

/**
 * The Player of the Week fan vote for one Team of the Week edition: nominate up to
 * five players from the saved lineup, set when voting closes, watch live counts,
 * and override the winner if needed.
 */
export const AdminPOTWPanel = ({ totwId, canManage }: AdminPOTWPanelProps) => {
    const queryClient = useQueryClient();
    const now = useNow();

    // The saved lineup — nominees must be in it, and unsaved editor changes don't count.
    const { data: totw } = useQuery({
        queryKey: ['adminTOTWSaved', totwId],
        queryFn: () => getAdminTOTWById(totwId),
    });
    const { data: poll, isLoading } = useQuery<POTWPoll | null>({
        queryKey: potwPollQueryKey(totwId),
        queryFn: () => getAdminPOTWPoll(totwId),
        // Live counts while voting runs.
        refetchInterval: (q) => (q.state.data?.status === 'open' ? 30_000 : false),
    });

    const lineup: TOTWPlayer[] = useMemo(() => {
        const seen = new Set<string>();
        return (totw?.players ?? []).filter((p) => p.player_id && !seen.has(p.player_id) && seen.add(p.player_id));
    }, [totw]);

    // Form state, seeded from the poll when there is one. `draftFor` records which
    // poll the draft belongs to so a refetch doesn't wipe edits in progress.
    const [draftFor, setDraftFor] = useState<string | null>(null);
    const [nominees, setNominees] = useState<string[]>([]);
    const [opensAt, setOpensAt] = useState('');
    const [closesAt, setClosesAt] = useState('');
    const draftKey = poll
        ? `${poll.id}:${poll.opens_at}:${poll.closes_at}:${poll.nominees.map((n) => n.player_id).join(',')}`
        : 'new';
    if (!isLoading && draftFor !== draftKey) {
        setDraftFor(draftKey);
        if (poll) {
            setNominees([...poll.nominees].sort((a, b) => a.display_order - b.display_order).map((n) => n.player_id));
            setOpensAt(toLocalInput(new Date(poll.opens_at)));
            setClosesAt(toLocalInput(new Date(poll.closes_at)));
        } else {
            setNominees([]);
            setOpensAt('');
            setClosesAt(toLocalInput(new Date(now + 72 * 3600_000)));
        }
    }

    const [overridePick, setOverridePick] = useState('');
    const [action, setAction] = useState<Action | null>(null);

    const nomineesLocked = Boolean(poll && poll.total_votes > 0);
    const isOverridden = poll?.winner_source === 'ADMIN';
    const playerName = (id: string) => lineup.find((p) => p.player_id === id)?.player?.name ?? 'Player';

    const toggleNominee = (playerId: string) => {
        setNominees((prev) => {
            if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
            if (prev.length >= MAX_NOMINEES) {
                toast.error(`You can nominate up to ${MAX_NOMINEES} players.`);
                return prev;
            }
            return [...prev, playerId];
        });
    };

    const setDuration = (hours: number) => {
        const start = opensAt ? new Date(opensAt).getTime() : now;
        const base = Math.max(start, now);
        setClosesAt(toLocalInput(new Date(base + hours * 3600_000)));
    };

    const onSaved = (updated: POTWPoll | null, message: string) => {
        queryClient.setQueryData(potwPollQueryKey(totwId), updated);
        void queryClient.invalidateQueries({ queryKey: ['adminTOTWSaved', totwId] });
        void queryClient.invalidateQueries({ queryKey: ['totw'] });
        toast.success(message);
        setAction(null);
    };

    const mutation = useMutation({
        mutationFn: async (a: Action): Promise<[POTWPoll | null, string]> => {
            switch (a.kind) {
                case 'save':
                    return [
                        await saveAdminPOTWPoll(totwId, {
                            nominee_ids: nominees,
                            opens_at: opensAt ? new Date(opensAt).toISOString() : undefined,
                            closes_at: new Date(closesAt).toISOString(),
                        }),
                        poll ? 'Fan vote updated' : 'Fan vote started',
                    ];
                case 'endNow':
                    return [
                        await saveAdminPOTWPoll(totwId, {
                            nominee_ids: poll!.nominees.map((n) => n.player_id),
                            opens_at: poll!.opens_at,
                            closes_at: new Date().toISOString(),
                        }),
                        'Voting closed and the winner applied',
                    ];
                case 'delete':
                    await deleteAdminPOTWPoll(totwId);
                    return [null, 'Fan vote deleted'];
                case 'override':
                    return [await overrideAdminPOTW(totwId, a.playerId), `${playerName(a.playerId)} set as Player of the Week`];
                case 'clearOverride':
                    return [await clearAdminPOTWOverride(totwId), 'Override removed — the fan vote decides'];
            }
        },
        onSuccess: ([updated, message]) => onSaved(updated, message),
        onError: (err) => {
            toast.error(apiError(err, 'That change could not be saved.'));
            setAction(null);
        },
    });

    const formError =
        nominees.length < MIN_NOMINEES
            ? `Choose at least ${MIN_NOMINEES} nominees.`
            : !closesAt
              ? 'Set when voting closes.'
              : new Date(closesAt).getTime() <= (opensAt ? new Date(opensAt).getTime() : now)
                ? 'Voting must close after it opens.'
                : !poll && new Date(closesAt).getTime() <= now
                  ? 'The closing time must be in the future.'
                  : null;

    const statusBadge = !poll ? null : poll.status === 'open' ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <ClockIcon className="w-4 h-4" aria-hidden="true" />
            Voting open
        </span>
    ) : poll.status === 'scheduled' ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
            <ClockIcon className="w-4 h-4" aria-hidden="true" />
            Opens {formatDateTime(poll.opens_at)}
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs font-bold text-gray-700 dark:text-gray-200">
            <LockClosedIcon className="w-4 h-4" aria-hidden="true" />
            Voting closed
        </span>
    );

    const dialog = (() => {
        if (!action) return null;
        switch (action.kind) {
            case 'save':
                return {
                    title: poll ? 'Save changes to the fan vote?' : 'Start the fan vote?',
                    description: poll
                        ? 'Fans see the new closing time straight away.'
                        : totw?.is_published
                          ? 'Fans can vote as soon as voting opens. Any Player of the Week picked by hand is cleared so the vote decides.'
                          : 'Fans will see the vote once this Team of the Week is published.',
                    confirmLabel: poll ? 'Save changes' : 'Start vote',
                    tone: 'info' as const,
                    icon: CheckCircleIcon,
                    rows: [
                        ['Nominees', nominees.map(playerName).join(', ')],
                        ['Opens', opensAt ? formatDateTime(new Date(opensAt).toISOString()) : 'Now'],
                        ['Closes', closesAt ? formatDateTime(new Date(closesAt).toISOString()) : undefined],
                    ] as [string, string | undefined][],
                };
            case 'endNow':
                return {
                    title: 'End voting now?',
                    description: 'Voting closes immediately, results are revealed, and the leader becomes Player of the Week (unless you have overridden it).',
                    confirmLabel: 'End voting',
                    tone: 'warning' as const,
                    icon: StopCircleIcon,
                    rows: [
                        ['Edition', totw?.week_title],
                        ['Votes so far', String(poll?.total_votes ?? 0)],
                    ] as [string, string | undefined][],
                };
            case 'delete':
                return {
                    title: 'Delete this fan vote?',
                    description: 'All votes are removed and cannot be recovered. The edition keeps its current Player of the Week.',
                    confirmLabel: 'Delete vote',
                    tone: 'warning' as const,
                    icon: TrashIcon,
                    rows: [
                        ['Edition', totw?.week_title],
                        ['Votes', String(poll?.total_votes ?? 0)],
                    ] as [string, string | undefined][],
                };
            case 'override':
                return {
                    title: `Make ${playerName(action.playerId)} Player of the Week?`,
                    description: 'This replaces the fan vote result. Fans still see the vote breakdown when voting closes.',
                    confirmLabel: 'Set Player of the Week',
                    tone: 'info' as const,
                    icon: ShieldCheckIcon,
                    rows: [
                        ['Player', playerName(action.playerId)],
                        ['Edition', totw?.week_title],
                    ] as [string, string | undefined][],
                };
            case 'clearOverride':
                return {
                    title: 'Hand the decision back to the fans?',
                    description:
                        poll?.status === 'closed'
                            ? 'The fan vote leader becomes Player of the Week now.'
                            : 'The fan vote leader becomes Player of the Week when voting closes.',
                    confirmLabel: 'Use the fan vote',
                    tone: 'info' as const,
                    icon: ArrowUturnLeftIcon,
                    rows: [['Current pick', poll?.winner_player_id ? playerName(poll.winner_player_id) : undefined]] as [string, string | undefined][],
                };
        }
    })();

    return (
        <section
            aria-labelledby={`potw-panel-${totwId}`}
            className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 md:p-6 space-y-6"
        >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 id={`potw-panel-${totwId}`} className="inline-flex items-center gap-2 text-base md:text-lg font-black text-sffl-navy dark:text-white">
                        <TrophyIcon className="w-5 h-5" aria-hidden="true" />
                        Player of the Week fan vote
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        Nominate up to five players from this lineup and set when voting closes. Logged-in fans vote, and the winner
                        becomes this edition's Player of the Week automatically. You can override it at any time.
                    </p>
                </div>
                {statusBadge}
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <ArrowPathIcon className="w-5 h-5 animate-spin" aria-hidden="true" />
                    Loading the vote
                </div>
            ) : (
                <>
                    {totw && !totw.is_published && (
                        <p className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">
                            <EyeSlashIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                            This Team of the Week isn't published, so fans can't see or vote in this poll yet.
                        </p>
                    )}

                    {poll && poll.status === 'open' && (
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 rounded-xl bg-gray-50 dark:bg-gray-700/40 p-4">
                            <POTWCountdown
                                target={poll.closes_at}
                                serverTime={poll.server_time}
                                label="Voting closes in"
                                onElapsed={() => void queryClient.invalidateQueries({ queryKey: potwPollQueryKey(totwId) })}
                            />
                            <Button
                                variant="secondary"
                                icon={StopCircleIcon}
                                disabled={!canManage}
                                onClick={() => setAction({ kind: 'endNow' })}
                            >
                                End voting now
                            </Button>
                        </div>
                    )}

                    {/* ── Nominees ─────────────────────────────────── */}
                    <div>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white">Nominees</h3>
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                {nominees.length} of {MAX_NOMINEES} selected
                            </span>
                        </div>
                        {nomineesLocked && (
                            <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                <LockClosedIcon className="w-4 h-4" aria-hidden="true" />
                                Nominees are locked because fans have started voting. You can still change the closing time or override the winner.
                            </p>
                        )}
                        {lineup.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-500 dark:text-gray-400">
                                Save this Team of the Week with players first — nominees are chosen from the saved lineup.
                            </p>
                        ) : (
                            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                {lineup.map((p) => {
                                    const selected = nominees.includes(p.player_id);
                                    const disabled = !canManage || nomineesLocked || (!selected && nominees.length >= MAX_NOMINEES);
                                    return (
                                        <li key={p.player_id}>
                                            <button
                                                type="button"
                                                role="checkbox"
                                                aria-checked={selected}
                                                disabled={disabled}
                                                onClick={() => toggleNominee(p.player_id)}
                                                className={`flex w-full items-center gap-3 min-h-11 rounded-xl border p-2.5 text-left transition-colors disabled:cursor-not-allowed ${
                                                    selected
                                                        ? 'border-sffl-navy dark:border-blue-400 bg-sffl-navy/5 dark:bg-blue-400/10'
                                                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 disabled:opacity-50'
                                                }`}
                                            >
                                                {p.player?.image ? (
                                                    <img src={p.player.image} alt="" className="w-9 h-9 rounded-full object-cover object-top shrink-0" />
                                                ) : (
                                                    <UserCircleIcon className="w-9 h-9 text-gray-400 shrink-0" aria-hidden="true" />
                                                )}
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{p.player?.name ?? 'Player'}</span>
                                                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                                                        {p.position} · rating {Number(p.rating || 0).toFixed(1)}
                                                    </span>
                                                </span>
                                                {selected && <CheckCircleIcon className="w-5 h-5 shrink-0 text-sffl-navy dark:text-blue-400" aria-hidden="true" />}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* ── Voting window ────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Voting opens" htmlFor="potw-opens" hint="Leave empty to open as soon as you save.">
                            <Input
                                id="potw-opens"
                                type="datetime-local"
                                value={opensAt}
                                disabled={!canManage || poll?.status === 'open' || poll?.status === 'closed'}
                                onChange={(e) => setOpensAt(e.target.value)}
                            />
                        </Field>
                        <Field label="Voting closes" htmlFor="potw-closes" hint="The countdown fans see runs to this time.">
                            <Input
                                id="potw-closes"
                                type="datetime-local"
                                value={closesAt}
                                disabled={!canManage}
                                onChange={(e) => setClosesAt(e.target.value)}
                            />
                        </Field>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Run for:</span>
                        {DURATIONS.map(([label, hours]) => (
                            <Button
                                key={label}
                                size="sm"
                                variant="secondary"
                                disabled={!canManage}
                                onClick={() => setDuration(hours)}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                    {poll?.status === 'closed' && poll.winner_source !== 'ADMIN' && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Moving the closing time into the future reopens voting and clears the current result until it closes again.
                        </p>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-700 pt-4">
                        {poll ? (
                            <Button
                                variant="danger"
                                icon={TrashIcon}
                                disabled={!canManage}
                                onClick={() => setAction({ kind: 'delete' })}
                            >
                                Delete vote
                            </Button>
                        ) : (
                            <span />
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            {formError && canManage && <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{formError}</span>}
                            <Button
                                disabled={!canManage || Boolean(formError)}
                                title={canManage ? undefined : 'View-only access to Team of the Week'}
                                onClick={() => setAction({ kind: 'save' })}
                            >
                                {poll ? 'Save vote changes' : 'Start fan vote'}
                            </Button>
                        </div>
                    </div>

                    {/* ── Override ─────────────────────────────────── */}
                    {poll && (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                            <div>
                                <h3 className="inline-flex items-center gap-1.5 text-sm font-black text-gray-900 dark:text-white">
                                    <ShieldCheckIcon className="w-5 h-5" aria-hidden="true" />
                                    Override the winner
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {isOverridden && poll.winner_player_id
                                        ? `${playerName(poll.winner_player_id)} is Player of the Week by your override. The fan vote result is ignored.`
                                        : 'By default the fans decide. Pick a player here only if the result needs to change.'}
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Select
                                    value={overridePick}
                                    disabled={!canManage}
                                    onChange={(e) => setOverridePick(e.target.value)}
                                    aria-label="Player to make Player of the Week"
                                    className="flex-1 min-w-0"
                                >
                                    <option value="">Choose a player from this lineup</option>
                                    {lineup.map((p) => (
                                        <option key={p.player_id} value={p.player_id}>
                                            {p.player?.name ?? 'Player'}
                                            {nominees.includes(p.player_id) ? ' (nominee)' : ''}
                                        </option>
                                    ))}
                                </Select>
                                <Button
                                    variant="navy"
                                    className="shrink-0"
                                    disabled={!canManage || !overridePick}
                                    onClick={() => setAction({ kind: 'override', playerId: overridePick })}
                                >
                                    Set as Player of the Week
                                </Button>
                                {isOverridden && (
                                    <Button
                                        variant="secondary"
                                        className="shrink-0"
                                        icon={ArrowUturnLeftIcon}
                                        disabled={!canManage}
                                        onClick={() => setAction({ kind: 'clearOverride' })}
                                    >
                                        Use the fan vote
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Live results (admins only until the deadline) ─ */}
                    {poll && (
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-5">
                            {poll.status !== 'closed' && (
                                <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                    <EyeSlashIcon className="w-4 h-4" aria-hidden="true" />
                                    Only admins see these counts until voting closes.
                                </p>
                            )}
                            <POTWResults poll={poll} title={poll.status === 'closed' ? 'Results' : 'Live results'} />
                        </div>
                    )}
                </>
            )}

            <ConfirmDialog
                open={dialog !== null}
                title={dialog?.title ?? ''}
                description={dialog?.description}
                body={dialog ? <ConfirmSummary rows={dialog.rows} /> : undefined}
                confirmLabel={dialog?.confirmLabel ?? 'Confirm'}
                tone={dialog?.tone ?? 'info'}
                icon={dialog?.icon}
                pending={mutation.isPending}
                onConfirm={() => action && mutation.mutate(action)}
                onCancel={() => setAction(null)}
            />
        </section>
    );
};
