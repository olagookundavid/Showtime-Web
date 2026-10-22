import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ClockIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import { TrophyIcon as TrophySolidIcon } from "@heroicons/react/24/solid";
import {
  getCurrentPOTWPoll,
  getPOTWPoll,
  getPOTWWinners,
  voteForPOTW,
} from "../../services/api";
import type { POTWNominee, POTWPoll, POTWWinner } from "../../types";
import { useAuth } from "../../contexts";
import { withReturnUrl } from "../../hooks";
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  ConfirmSummary,
  PlayerLink,
  PlayerPhoto,
  POTWCountdown,
  POTWResults,
  ReigningWinner,
  ShareVote,
  StatBoxes,
  TeamLink,
  VerifyEmailPrompt,
  WinnerCard,
  formatShare,
} from "../../components";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const NO_WINNERS: POTWWinner[] = [];

/** One headline number in the hero, e.g. "12 awards". */
const HeroFigure = ({ value, label }: { value: number; label: string }) => (
  <div className="min-w-0 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 sm:px-4">
    <p className="text-2xl sm:text-3xl font-black text-white leading-none">
      {value}
    </p>
    <p className="mt-1 text-[11px] sm:text-xs font-bold uppercase tracking-wide leading-tight text-gray-300 wrap-break-word">
      {label}
    </p>
  </div>
);

/** A ballot card: the nominee's photo, team, week stats and the vote button. */
const NomineeCard = ({
  nominee,
  mine,
  children,
}: {
  nominee: POTWNominee;
  mine: boolean;
  children: React.ReactNode;
}) => (
  <li
    className={`flex flex-col overflow-hidden border bg-white dark:bg-gray-800 transition-shadow ${
      mine
        ? "border-emerald-500 ring-2 ring-emerald-500/40 shadow-md"
        : "border-gray-200 dark:border-gray-700 hover:shadow-lg"
    }`}
  >
    <div className="relative">
      <PlayerPhoto
        player={nominee}
        className="aspect-3/4 sm:aspect-2/3 w-full"
      />
      <div
        className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/85 via-black/40 to-transparent"
        aria-hidden="true"
      />
      {mine && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow">
          <CheckBadgeIcon className="w-3.5 h-3.5" aria-hidden="true" />
          Your pick
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 p-4 min-w-0">
        <Link
          to={`/players/${nominee.player_id}`}
          className="block text-lg font-black leading-tight text-white truncate underline-offset-4 hover:underline"
        >
          {nominee.name}
        </Link>
        <p className="text-xs text-gray-200 truncate">
          {nominee.totw_position || nominee.position}
          {(nominee.totw_position || nominee.position) &&
            nominee.team_name &&
            " · "}
          {nominee.team_name && (
            <TeamLink id={nominee.team_id}>{nominee.team_name}</TeamLink>
          )}
        </p>
      </div>
    </div>
    <div className="flex flex-1 flex-col gap-3 p-4">
      {nominee.rating > 0 && (
        <p className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-500 dark:text-gray-400">
            Match rating
          </span>
          <span className="text-base font-black text-gray-900 dark:text-white">
            {nominee.rating.toFixed(1)}
          </span>
        </p>
      )}
      <StatBoxes player={nominee} />
      <div className="mt-auto pt-1">{children}</div>
    </div>
  </li>
);

export const PlayerOfTheWeek = () => {
  const { id: routePollId } = useParams<{ id?: string }>();
  const { pathname } = useLocation();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [pendingVote, setPendingVote] = useState<POTWNominee | null>(null);

  const pollKey = ["potwPoll", routePollId ?? "current", user?.id ?? "guest"];
  const {
    data: poll,
    isLoading: pollLoading,
    isError,
    refetch,
  } = useQuery<POTWPoll | null>({
    queryKey: pollKey,
    queryFn: () =>
      routePollId ? getPOTWPoll(routePollId) : getCurrentPOTWPoll(),
  });

  const { data: winners = NO_WINNERS, isLoading: winnersLoading } = useQuery<
    POTWWinner[]
  >({
    queryKey: ["potwWinners"],
    queryFn: getPOTWWinners,
  });

  // How many times each player has won, for the "2× winner" marks.
  const winsByPlayer = useMemo(() => {
    const counts = new Map<string, number>();
    winners.forEach((w) =>
      counts.set(w.player.player_id, (counts.get(w.player.player_id) ?? 0) + 1),
    );
    return counts;
  }, [winners]);
  const fanChoices = winners.filter((w) => w.source === "VOTE").length;
  const reigning = winners[0];
  // On the reigning winner's own result page, the result section already shows them.
  const showReigning = Boolean(
    reigning && !(routePollId && reigning.poll_id === routePollId),
  );
  const honours = winners.slice(1);

  // When the countdown hits zero, reload: the server tallies on that request and
  // the results replace the ballot, and the new winner joins the honours list.
  const handleElapsed = useCallback(() => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ["potwWinners"] });
  }, [refetch, queryClient]);

  const voteMutation = useMutation({
    mutationFn: (nominee: POTWNominee) =>
      voteForPOTW(poll!.id, nominee.player_id),
    onSuccess: (updated, nominee) => {
      queryClient.setQueryData(pollKey, updated);
      toast.success(`Vote cast for ${nominee.name}`);
      setPendingVote(null);
    },
    onError: (err) => {
      setPendingVote(null);
      // The account isn't verified (e.g. a stale tab): reload it so the
      // verify step replaces the vote buttons.
      if (
        axios.isAxiosError(err) &&
        err.response?.data?.code === "email_not_verified"
      ) {
        toast.error("Verify your email address to vote.");
        void refreshUser();
        return;
      }
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error
        : undefined;
      toast.error(message || "Your vote could not be saved. Please try again.");
      void refetch();
    },
  });

  // After logging in, come straight back to this ballot (see useReturnUrl).
  const loginHref = withReturnUrl("/login", pathname);
  const isOpen = poll?.status === "open";
  const pollWinner = poll?.nominees.find((n) => n.is_winner);
  const myPick = poll?.nominees.find((n) => n.player_id === poll.my_vote);
  // Only verified accounts can vote, so one person can't vote many times.
  const needsVerification = Boolean(user && !user.emailVerified);
  const shareUrl = poll ? `${window.location.origin}/potw/${poll.id}` : "";
  // A specific past vote (from a link or the honours list) shows its full result.
  const showPollResult = Boolean(routePollId && poll && !isOpen);
  // The latest vote closed but its winner isn't confirmed yet: say so.
  const awaitingResult = Boolean(
    !routePollId && poll && poll.status === "closed" && !pollWinner,
  );
  const loading = pollLoading || winnersLoading;

  return (
    <div className="space-y-10 md:space-y-14 pb-mobile-nav-2x">
      {/* ── Hero: the award and its current holder ──────────────────── */}
      <section
        aria-labelledby="potw-title"
        className="relative overflow-hidden rounded-xl md:rounded-2xl bg-sffl-navy text-white shadow-xl border border-white/10"
      >
        <TrophySolidIcon
          className="pointer-events-none absolute -right-10 -top-10 w-64 h-64 sm:w-80 sm:h-80 text-white/4"
          aria-hidden="true"
        />
        <div className="relative space-y-6 md:space-y-8 p-4 sm:p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl min-w-0">
              <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-300/40 text-amber-200 text-xs font-black uppercase tracking-wider">
                <TrophyIcon className="w-4 h-4" aria-hidden="true" />
                Showtime awards
              </p>
              <h1
                id="potw-title"
                className="text-3xl md:text-5xl font-black tracking-tight"
              >
                Player of the Week
              </h1>
              <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                Every week one standout player is honoured. The league office
                shortlists the best of the Team of the Week, and fans vote for
                the winner.
              </p>
            </div>
            {winners.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full lg:w-auto lg:min-w-96">
                <HeroFigure
                  value={winners.length}
                  label={winners.length === 1 ? "Award" : "Awards"}
                />
                <HeroFigure value={fanChoices} label="Fan picks" />
                <HeroFigure
                  value={winsByPlayer.size}
                  label={winsByPlayer.size === 1 ? "Winner" : "Winners"}
                />
              </div>
            )}
          </div>

          {/* Voting open: point straight at the ballot. */}
          {poll && isOpen && !routePollId && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-sffl-red/15 border border-sffl-red/40 p-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-red-200">
                  Voting is open
                </p>
                <p className="text-lg font-black text-white">
                  Pick the {poll.week_title} Player of the Week
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <POTWCountdown
                  target={poll.closes_at}
                  serverTime={poll.server_time}
                  label="Closes in"
                  onElapsed={handleElapsed}
                  onDark
                />
                <Button
                  variant="primary"
                  tone="dark"
                  icon={ArrowRightIcon}
                  iconPosition="right"
                  onClick={() =>
                    document
                      .getElementById("potw-vote")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  Vote now
                </Button>
              </div>
            </div>
          )}

          {reigning
            ? showReigning && (
                <ReigningWinner
                  winner={reigning}
                  wins={winsByPlayer.get(reigning.player.player_id) ?? 1}
                />
              )
            : !loading && (
                <div className="rounded-2xl bg-white/5 border border-white/15 p-5 text-center">
                  <TrophyIcon
                    className="w-10 h-10 mx-auto text-amber-300"
                    aria-hidden="true"
                  />
                  <p className="mt-2 font-black text-white">
                    The first Player of the Week is still to be crowned
                  </p>
                  <p className="text-sm text-gray-300">
                    Winners appear here as soon as each week's award is decided.
                  </p>
                </div>
              )}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500 dark:text-gray-400">
          <ArrowPathIcon className="w-5 h-5 animate-spin" aria-hidden="true" />
          <span className="text-sm font-semibold">
            Loading Player of the Week
          </span>
        </div>
      ) : (
        <>
          {/* ── A vote link that doesn't work ───────────────────────── */}
          {isError && routePollId && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-10 text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                This vote couldn't be found
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                It may not be open yet, or the link is wrong.
              </p>
              <ButtonLink
                to="/potw"
                variant="primary"
                className="mt-4"
                icon={ArrowRightIcon}
                iconPosition="right"
              >
                Go to Player of the Week
              </ButtonLink>
            </div>
          )}

          {/* ── The ballot ─────────────────────────────────────────── */}
          {poll && isOpen && (
            <section
              id="potw-vote"
              aria-labelledby="potw-ballot"
              className="scroll-mt-24 space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2
                    id="potw-ballot"
                    className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white"
                  >
                    Vote: {poll.week_title} Player of the Week
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {poll.competition_name ? `${poll.competition_name}. ` : ""}
                    One vote per verified account, and you can change it until{" "}
                    {formatDateTime(poll.closes_at)}. The winner is revealed
                    when voting closes.
                  </p>
                </div>
                {routePollId && (
                  <POTWCountdown
                    target={poll.closes_at}
                    serverTime={poll.server_time}
                    label="Voting closes in"
                    onElapsed={handleElapsed}
                  />
                )}
              </div>

              {!user && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-200">
                    <LockClosedIcon
                      className="w-5 h-5 shrink-0"
                      aria-hidden="true"
                    />
                    Log in to vote. Each verified account gets one vote.
                  </p>
                  <ButtonLink to={loginHref} variant="navy">
                    Log in to vote
                  </ButtonLink>
                </div>
              )}

              {needsVerification && (
                <div id="verify-email">
                  <VerifyEmailPrompt reason="To keep the vote fair, each fan votes once from a verified account. We'll email you a 6-digit code." />
                </div>
              )}

              {myPick && (
                <p className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-4 py-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  <CheckCircleIcon
                    className="w-5 h-5 shrink-0"
                    aria-hidden="true"
                  />
                  You voted for{" "}
                  <PlayerLink id={myPick.player_id} className="font-black">
                    {myPick.name}
                  </PlayerLink>
                  . You can change your vote until voting closes.
                </p>
              )}

              {poll.winner_source === "ADMIN" && pollWinner && (
                <p className="inline-flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                  <ShieldCheckIcon
                    className="w-5 h-5 shrink-0"
                    aria-hidden="true"
                  />
                  The league office has named{" "}
                  <PlayerLink id={pollWinner.player_id} className="font-black">
                    {pollWinner.name}
                  </PlayerLink>{" "}
                  Player of the Week. Fan votes are still counted and shown when
                  voting closes.
                </p>
              )}

              <ul
                className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${
                  poll.nominees.length >= 5 ? "xl:grid-cols-5" : "xl:grid-cols-4"
                }`}
              >
                {poll.nominees.map((n) => {
                  const mine = poll.my_vote === n.player_id;
                  return (
                    <NomineeCard key={n.player_id} nominee={n} mine={mine}>
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
                          <CheckBadgeIcon
                            className="w-5 h-5"
                            aria-hidden="true"
                          />
                          Your vote
                        </span>
                      ) : (
                        <Button
                          variant="primary"
                          fullWidth
                          onClick={() => setPendingVote(n)}
                        >
                          {poll.my_vote
                            ? "Change vote to this player"
                            : "Vote for this player"}
                        </Button>
                      )}
                    </NomineeCard>
                  );
                })}
              </ul>

              <ShareVote
                url={shareUrl}
                text={`Vote for the ${poll.week_title} Showtime Player of the Week — voting closes ${formatDateTime(poll.closes_at)}.`}
              />
            </section>
          )}

          {/* ── The latest vote has closed but isn't decided yet ────── */}
          {awaitingResult && poll && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-4 sm:p-6">
              <ClockIcon
                className="w-6 h-6 shrink-0 text-amber-700 dark:text-amber-300"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  Voting for {poll.week_title} has closed
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {!poll.nominees.some((n) => (n.percent ?? 0) > 0)
                    ? "No votes were cast, so the league office will name the Player of the Week."
                    : "The result is being confirmed. Check back shortly."}
                </p>
              </div>
            </div>
          )}

          {/* ── One past vote in full (opened from a link) ──────────── */}
          {showPollResult && poll && (
            <section aria-labelledby="potw-result" className="space-y-6">
              <div>
                <h2
                  id="potw-result"
                  className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white"
                >
                  {poll.week_title} result
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {poll.competition_name ? `${poll.competition_name}. ` : ""}
                  Voting closed {formatDateTime(poll.closes_at)}.
                </p>
              </div>

              {pollWinner ? (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,12rem)_1fr] gap-5 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-4 sm:p-6">
                  <PlayerPhoto
                    player={pollWinner}
                    className="aspect-4/5 w-full max-w-60 sm:max-w-none rounded-xl ring-2 ring-amber-400/80"
                  />
                  <div className="min-w-0 space-y-3">
                    <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      <TrophyIcon className="w-4 h-4" aria-hidden="true" />
                      {poll.week_title} Player of the Week
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white wrap-break-word">
                      <Link
                        to={`/players/${pollWinner.player_id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {pollWinner.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {[pollWinner.totw_position || pollWinner.position]
                        .filter(Boolean)
                        .join("")}
                      {pollWinner.team_name && (
                        <>
                          {" · "}
                          <TeamLink id={pollWinner.team_id}>
                            {pollWinner.team_name}
                          </TeamLink>
                        </>
                      )}
                      {" · "}
                      {poll.winner_source === "ADMIN"
                        ? "Named by the league office."
                        : `Chosen by fans with ${formatShare(pollWinner.percent)}% of the vote.`}
                    </p>
                    <StatBoxes player={pollWinner} />
                    <ButtonLink
                      to={`/totw/${poll.totw_id}`}
                      variant="navy"
                      icon={ArrowRightIcon}
                      iconPosition="right"
                    >
                      See the Team of the Week
                    </ButtonLink>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-4 sm:p-6">
                  <ClockIcon
                    className="w-6 h-6 shrink-0 text-amber-700 dark:text-amber-300"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    {!poll.nominees.some((n) => (n.percent ?? 0) > 0)
                      ? "No votes were cast, so the league office will name the Player of the Week."
                      : "The result is being confirmed. Check back shortly."}
                  </p>
                </div>
              )}

              <ShareVote
                url={shareUrl}
                text={
                  pollWinner
                    ? `${pollWinner.name} is the ${poll.week_title} Showtime Player of the Week. See the fan vote results.`
                    : `See the ${poll.week_title} Showtime Player of the Week results.`
                }
              />

              <POTWResults poll={poll} />
            </section>
          )}

          {/* ── Honours list ───────────────────────────────────────── */}
          {honours.length > 0 && (
            <section aria-labelledby="potw-honours" className="space-y-5">
              <div>
                <h2
                  id="potw-honours"
                  className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white"
                >
                  Past winners
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Every Player of the Week so far, newest first, with their
                  numbers from the week they won.
                </p>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                {honours.map((w) => (
                  <li key={w.totw_id}>
                    <WinnerCard
                      winner={w}
                      wins={winsByPlayer.get(w.player.player_id) ?? 1}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Nothing at all yet ─────────────────────────────────── */}
          {!poll && !isError && winners.length === 0 && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-10 text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                No Player of the Week yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                The award starts once the league office publishes a Team of the
                Week and opens the fan vote. In the meantime, see who made the
                team.
              </p>
              <ButtonLink
                to="/totw"
                variant="primary"
                className="mt-4"
                icon={ArrowRightIcon}
                iconPosition="right"
              >
                View Team of the Week
              </ButtonLink>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingVote !== null}
        title={
          poll?.my_vote
            ? `Change your vote to ${pendingVote?.name}?`
            : `Vote for ${pendingVote?.name}?`
        }
        description="You can change your vote until voting closes. Results are revealed when it closes."
        body={
          pendingVote && poll ? (
            <ConfirmSummary
              rows={[
                ["Player", pendingVote.name],
                ["Team", pendingVote.team_name],
                ["Week", poll.week_title],
                ...(myPick
                  ? ([["Current vote", myPick.name]] as [string, string][])
                  : []),
              ]}
            />
          ) : undefined
        }
        confirmLabel={poll?.my_vote ? "Change vote" : "Cast vote"}
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
