import { useCallback, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
    ArrowPathIcon,
    ArrowRightIcon,
    CheckBadgeIcon,
    CheckCircleIcon,
    ClockIcon,
    LockClosedIcon,
    ShieldCheckIcon,
    SparklesIcon,
    TrophyIcon,
} from '@heroicons/react/24/outline';
import {
    getCurrentPOTWPoll,
    getPOTWPoll,
    getPOTWPolls,
    voteForPOTW,
} from '../../services/api';
import type { POTWNominee, POTWPoll, POTWPollSummary } from '../../types';
import { useAuth } from '../../contexts';
import { withReturnUrl } from '../../hooks';
import { ConfirmDialog, ConfirmSummary, Button, ButtonLink, POTWCountdown, NomineeAvatar, POTWResults, ShareVote, VerifyEmailPrompt } from '../../components';

const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** The nominee's three box-score lines from their Team of the Week card. */
const StatLines = ({ n }: { n: POTWNominee }) => {
    const stats = [
        [n.stat1_label, n.stat1_value],
        [n.stat2_label, n.stat2_value],
        [n.stat3_label, n.stat3_value],
    ].filter(([label, value]) => label && value);
    if (stats.length === 0) return null;
    return (
        <dl className="grid grid-cols-3 gap-1.5 text-center">
            {stats.map(([label, value]) => (
                <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-1 py-1.5 min-w-0">
                    <dt className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 truncate">{label}</dt>
                    <dd className="text-sm font-black text-gray-900 dark:text-white truncate">{value}</dd>
                </div>
            ))}
        </dl>
    );
};

export const PlayerOfTheWeek = () => {
    const { id: routePollId } = useParams<{ id?: string }>();
    const { pathname } = useLocation();
    const { user, refreshUser } = useAuth();
    const queryClient = useQueryClient();
    const [pendingVote, setPendingVote] = useState<POTWNominee | null>(null);

    const pollKey = ['potwPoll', routePollId ?? 'current', user?.id ?? 'guest'];
    const { data: poll, isLoading, isError, refetch } = useQuery<POTWPoll | null>({
        queryKey: pollKey,
        queryFn: () => (routePollId ? getPOTWPoll(routePollId) : getCurrentPOTWPoll()),
    });

    const { data: archive = [] } = useQuery<POTWPollSummary[]>({
        queryKey: ['potwArchive'],
        queryFn: getPOTWPolls,
    });

    // When the countdown hits zero, reload: the server tallies on that request and
    // the results replace the ballot.
    const handleElapsed = useCallback(() => {
        void refetch();
        void queryClient.invalidateQueries({ queryKey: ['potwArchive'] });
    }, [refetch, queryClient]);

    const voteMutation = useMutation({
        mutationFn: (nominee: POTWNominee) => voteForPOTW(poll!.id, nominee.player_id),
        onSuccess: (updated, nominee) => {
            queryClient.setQueryData(pollKey, updated);
            toast.success(`Vote cast for ${nominee.name}`);
            setPendingVote(null);
        },
        onError: (err) => {
            setPendingVote(null);
            // The account isn't verified (e.g. a stale tab): reload it so the
            // verify step replaces the vote buttons.
            if (axios.isAxiosError(err) && err.response?.data?.code === 'email_not_verified') {
                toast.error('Verify your email address to vote.');
                void refreshUser();
                return;
            }
            const message = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
            toast.error(message || 'Your vote could not be saved. Please try again.');
            void refetch();
        },
    });

    // After logging in, come straight back to this ballot (see useReturnUrl).
    const loginHref = withReturnUrl('/login', pathname);
    const isOpen = poll?.status === 'open';
    const winner = poll?.nominees.find((n) => n.is_winner);
    const myPick = poll?.nominees.find((n) => n.player_id === poll.my_vote);
    const pastPolls = archive.filter((p) => p.id !== poll?.id);
    // Only verified accounts can vote, so one person can't vote many times.
    const needsVerification = Boolean(user && !user.emailVerified);
    const shareUrl = poll ? `${window.location.origin}/potw/${poll.id}` : '';

    return (
        <div className="space-y-8 md:space-y-10 pb-mobile-nav-2x">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="bg-sffl-navy text-white p-4 sm:p-6 md:p-8 rounded-xl md:rounded-2xl shadow-xl border border-white/10">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="space-y-2 max-w-2xl min-w-0">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sffl-red/20 border border-sffl-red/40 text-red-200 text-xs font-black uppercase tracking-wider">
                            <SparklesIcon className="w-4 h-4" aria-hidden="true" />
                            Fan vote
                        </span>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tight">Player of the Week</h1>
                        <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                            {poll
                                ? `${poll.week_title}${poll.competition_name ? ` · ${poll.competition_name}` : ''}. `
                                : ''}
                            The league office shortlists standout players from the Team of the Week, and fans pick the winner. One vote per verified account — you can change it until voting closes.
                        </p>
                    </div>
                    {poll && isOpen && (
                        <POTWCountdown
                            target={poll.closes_at}
                            serverTime={poll.server_time}
                            label="Voting closes in"
                            onElapsed={handleElapsed}
                            onDark
                        />
                    )}
                </div>
            </div>

            {/* ── Body ───────────────────────────────────────────────────── */}
            {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-500 dark:text-gray-400">
                    <ArrowPathIcon className="w-5 h-5 animate-spin" aria-hidden="true" />
                    <span className="text-sm font-semibold">Loading the vote</span>
                </div>
            ) : isError ? (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-10 text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">This vote couldn't be found</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">It may not be open yet, or the link is wrong.</p>
                    <Link to="/potw" className="mt-4 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl bg-sffl-red text-white text-sm font-bold">
                        Go to the latest vote
                        <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
                    </Link>
                </div>
            ) : !poll ? (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-10 text-center">
                    <TrophyIcon className="w-12 h-12 mx-auto text-gray-400" aria-hidden="true" />
                    <p className="mt-3 text-lg font-bold text-gray-900 dark:text-white">No Player of the Week vote yet</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                        Voting opens after the league office publishes a Team of the Week and shortlists its nominees. In the meantime, see who made the team.
                    </p>
                    <Link to="/totw" className="mt-4 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl bg-sffl-red text-white text-sm font-bold">
                        View Team of the Week
                        <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
                    </Link>
                </div>
            ) : isOpen ? (
                <section aria-labelledby="potw-ballot" className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                        <div>
                            <h2 id="potw-ballot" className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">
                                Choose your Player of the Week
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                Voting closes {formatDateTime(poll.closes_at)}. Results are revealed when it closes.
                            </p>
                        </div>
                    </div>

                    {!user && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4">
                            <p className="inline-flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-200">
                                <LockClosedIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                                Log in to vote. Each verified account gets one vote.
                            </p>
                            <Link to={loginHref} className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl bg-sffl-navy text-white text-sm font-bold">
                                Log in to vote
                            </Link>
                        </div>
                    )}

                    {needsVerification && (
                        <div id="verify-email">
                            <VerifyEmailPrompt reason="To keep the vote fair, each fan votes once from a verified account. We'll email you a 6-digit code." />
                        </div>
                    )}

                    {myPick && (
                        <p className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-4 py-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                            <CheckCircleIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                            You voted for {myPick.name}. You can change your vote until voting closes.
                        </p>
                    )}

                    {poll.winner_source === 'ADMIN' && winner && (
                        <p className="inline-flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                            <ShieldCheckIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                            The league office has named {winner.name} Player of the Week. Fan votes are still counted and shown when voting closes.
                        </p>
                    )}

                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        {poll.nominees.map((n) => {
                            const mine = poll.my_vote === n.player_id;
                            return (
                                <li
                                    key={n.player_id}
                                    className={`flex flex-col rounded-2xl border bg-white dark:bg-gray-800 p-4 transition-shadow ${
                                        mine
                                            ? 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-md'
                                            : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <NomineeAvatar nominee={n} size="md" />
                                        <div className="min-w-0">
                                            <Link
                                                to={`/players/${n.player_id}`}
                                                className="block font-black text-gray-900 dark:text-white truncate hover:text-sffl-red underline-offset-2 hover:underline"
                                            >
                                                {n.name}
                                            </Link>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {[n.totw_position || n.position, n.team_name].filter(Boolean).join(' · ')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between text-xs">
                                        <span className="font-semibold text-gray-500 dark:text-gray-400">Match rating</span>
                                        <span className="font-black text-gray-900 dark:text-white">{n.rating ? n.rating.toFixed(1) : '—'}</span>
                                    </div>
                                    <div className="mt-2">
                                        <StatLines n={n} />
                                    </div>

                                    <div className="mt-auto pt-4">
                                        {!user ? (
                                            <ButtonLink
                                                to={loginHref}
                                                variant="secondary"
                                                fullWidth
                                                icon={LockClosedIcon}
                                            >
                                                Log in to vote
                                            </ButtonLink>
                                        ) : needsVerification ? (
                                            <ButtonLink
                                                to="#verify-email"
                                                variant="secondary"
                                                fullWidth
                                                icon={LockClosedIcon}
                                            >
                                                Verify email to vote
                                            </ButtonLink>
                                        ) : mine ? (
                                            <span className="flex w-full items-center justify-center gap-1.5 min-h-11 rounded-xl bg-emerald-600 text-sm font-bold text-white">
                                                <CheckBadgeIcon className="w-5 h-5" aria-hidden="true" />
                                                Your vote
                                            </span>
                                        ) : (
                                            <Button
                                                variant="primary"
                                                fullWidth
                                                onClick={() => setPendingVote(n)}
                                            >
                                                {poll.my_vote ? 'Change vote to this player' : 'Vote for this player'}
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    <ShareVote
                        url={shareUrl}
                        text={`Vote for the ${poll.week_title} Showtime Player of the Week — voting closes ${formatDateTime(poll.closes_at)}.`}
                    />
                </section>
            ) : (
                <div className="space-y-8">
                    {/* Winner spotlight */}
                    <section className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-4 sm:p-6">
                        {winner ? (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                                <NomineeAvatar nominee={winner} size="lg" />
                                <div className="min-w-0 flex-1">
                                    <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                                        <TrophyIcon className="w-4 h-4" aria-hidden="true" />
                                        {poll.week_title} Player of the Week
                                    </p>
                                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white wrap-break-word">{winner.name}</h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        {poll.winner_source === 'ADMIN'
                                            ? 'Named by the league office.'
                                            : `Chosen by fans with ${winner.percent ?? 0}% of ${poll.total_votes.toLocaleString()} votes.`}{' '}
                                        Voting closed {formatDateTime(poll.closes_at)}.
                                    </p>
                                </div>
                                <Link
                                    to={`/totw/${poll.totw_id}`}
                                    className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl bg-sffl-navy text-white text-sm font-bold shrink-0"
                                >
                                    See the Team of the Week
                                    <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
                                </Link>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3">
                                <ClockIcon className="w-6 h-6 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                                <div>
                                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Voting has closed</h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        {poll.total_votes === 0
                                            ? 'No votes were cast, so the league office will name the Player of the Week.'
                                            : 'The result is being confirmed. Check back shortly.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </section>

                    <ShareVote
                        url={shareUrl}
                        text={
                            winner
                                ? `${winner.name} is the ${poll.week_title} Showtime Player of the Week. See the fan vote results.`
                                : `See the ${poll.week_title} Showtime Player of the Week results.`
                        }
                    />

                    <POTWResults poll={poll} />
                </div>
            )}

            {/* ── Past votes ─────────────────────────────────────────────── */}
            {pastPolls.length > 0 && (
                <section aria-labelledby="potw-archive" className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 id="potw-archive" className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">
                            Past votes
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Every Player of the Week vote and who won it.</p>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pastPolls.map((p) => (
                            <li key={p.id}>
                                <Link
                                    to={`/potw/${p.id}`}
                                    className="flex h-full flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-sffl-red/60 hover:shadow-md transition-all"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-black text-gray-900 dark:text-white truncate">{p.week_title}</span>
                                        <span
                                            className={`shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-black uppercase tracking-wider ${
                                                p.status === 'open'
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            {p.status === 'open' ? (
                                                <>
                                                    <ClockIcon className="w-3.5 h-3.5" aria-hidden="true" />
                                                    Voting open
                                                </>
                                            ) : (
                                                'Closed'
                                            )}
                                        </span>
                                    </div>
                                    {p.competition_name && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.competition_name}</p>}
                                    <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-gray-800 dark:text-gray-200 min-w-0">
                                        <TrophyIcon className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
                                        <span className="truncate">
                                            {p.status === 'open' ? 'Winner revealed when voting closes' : p.winner_name || 'No winner named'}
                                        </span>
                                    </p>
                                    <p className="mt-auto pt-3 text-xs text-gray-500 dark:text-gray-400">
                                        {p.status === 'open'
                                            ? `Voting closes ${formatDate(p.closes_at)}`
                                            : `${p.total_votes.toLocaleString()} votes · closed ${formatDate(p.closes_at)}`}
                                    </p>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <ConfirmDialog
                open={pendingVote !== null}
                title={poll?.my_vote ? `Change your vote to ${pendingVote?.name}?` : `Vote for ${pendingVote?.name}?`}
                description="You can change your vote until voting closes. Results are revealed when it closes."
                body={
                    pendingVote && poll ? (
                        <ConfirmSummary
                            rows={[
                                ['Player', pendingVote.name],
                                ['Team', pendingVote.team_name],
                                ['Week', poll.week_title],
                                ...(myPick ? ([['Current vote', myPick.name]] as [string, string][]) : []),
                            ]}
                        />
                    ) : undefined
                }
                confirmLabel={poll?.my_vote ? 'Change vote' : 'Cast vote'}
                tone="success"
                icon={CheckCircleIcon}
                pending={voteMutation.isPending}
                onConfirm={() => pendingVote && voteMutation.mutate(pendingVote)}
                onCancel={() => setPendingVote(null)}
            />
        </div>
    );
};

export default PlayerOfTheWeek;
