import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  TrophyIcon,
  UserGroupIcon,
  PlusIcon,
  KeyIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  CheckBadgeIcon,
  LockClosedIcon,
  TrashIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import {
  fantasyApi,
  fantasyLeagueApi,
  formatKobo,
  type FantasyLeague,
} from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { Loader } from "../../components/ui/Loader";
import { FantasyBackLink } from "../../components/fantasy/FantasyBackLink";
import { Button, ButtonLink, Field, IconButton, Input } from "../../components/ui";
import { Modal } from "../../components/ui/Modal";
import { DataTable } from "../../components/ui/DataTable";
import { Spinner } from "../../components/ui/Spinner";
import { rankBadgeClass } from "../../hooks/useFantasyLeaderboard";

/** Nothing off the wire is trusted to be a finite number. */
const num = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/** The platform cut is a server setting; used only to illustrate a split the
 *  creator has not published yet, and only until a real preview supplies it. */
const FALLBACK_PLATFORM_CUT_PERCENT = 10;

/** The split every new paid league starts from, so the common case is one click. */
const DEFAULT_PRIZE_ROWS = ["50", "30", "20"];

const ordinal = (n: number): string => {
  const v = num(n);
  if (!Number.isInteger(v) || v <= 0) return `#${v}`;
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  switch (v % 10) {
    case 1:
      return `${v}st`;
    case 2:
      return `${v}nd`;
    case 3:
      return `${v}rd`;
    default:
      return `${v}th`;
  }
};

/** Percentages are typed as free text so "12." is survivable mid-keystroke. */
const parsePercent = (raw: string): number => {
  const v = parseFloat(String(raw ?? ""));
  return Number.isFinite(v) ? v : 0;
};

/** Same shape the mutation handlers read: the server's own message wins. */
const apiErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as
    | { response?: { data?: { error?: string } }; message?: string }
    | null
    | undefined;
  return e?.response?.data?.error || e?.message || fallback;
};

const fmtPercent = (v: number | null | undefined): string => {
  const n = num(v);
  return `${Number.isInteger(n) ? n : Number(n.toFixed(2))}%`;
};

// max_members of 0 means unlimited.
const isLeagueFull = (l: FantasyLeague) =>
  num(l.max_members) > 0 && num(l.member_count) >= num(l.max_members);

const formatMembers = (l: FantasyLeague) =>
  num(l.max_members) > 0
    ? `${num(l.member_count)} / ${num(l.max_members)} managers`
    : `${num(l.member_count)} ${num(l.member_count) === 1 ? "manager" : "managers"}`;

export function FantasyLeagues() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: season, isLoading: seasonLoading } = useQuery({
    queryKey: ["fantasySeason"],
    queryFn: fantasyApi.getActiveSeason,
  });

  // My Leagues
  const { data: myLeagues = [], isLoading: myLeaguesLoading } = useQuery({
    queryKey: ["myFantasyLeagues", season?.id],
    queryFn: () =>
      season?.id ? fantasyApi.listMyLeagues(season.id) : Promise.resolve([]),
    enabled: !!season?.id && isAuthenticated,
  });

  // Public Leagues — paged on the server, since anyone can create one and the
  // list only ever grows.
  const [publicPage, setPublicPage] = useState(1);
  const { data: publicLeaguesPaged, isLoading: publicLeaguesLoading } =
    useQuery({
      queryKey: ["publicFantasyLeagues", season?.id, publicPage],
      queryFn: () =>
        fantasyApi.listPublicLeagues(season!.id, {
          page: publicPage,
          limit: 20,
        }),
      enabled: !!season?.id,
    });
  const publicLeagues = publicLeaguesPaged?.data ?? [];
  const publicTotalPages = publicLeaguesPaged?.total_pages ?? 0;

  // Modals
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");

  // Create League Form State
  const [createForm, setCreateForm] = useState({
    name: "",
    type: "PUBLIC" as "PUBLIC" | "PRIVATE",
    entryFeeNaira: 0,
    maxMembers: 50,
  });

  // Prize split, one string per paying position. The rank is the row's
  // index + 1, so ranks are always 1,2,3… with no gaps by construction.
  const [prizeRows, setPrizeRows] = useState<string[]>(DEFAULT_PRIZE_ROWS);

  // The terms a manager is currently reading. Either a known league (full
  // preview) or a bare invite code (the league is not identified until the
  // server resolves the code).
  const [termsTarget, setTermsTarget] = useState<{
    leagueId?: string;
    inviteCode?: string;
    name?: string;
  } | null>(null);

  // Join League Mutation
  const joinMutation = useMutation({
    // Either an invite code (private league) or a league id (joining a
    // public one straight from the browse list).
    mutationFn: async (by: { invite_code?: string; league_id?: string }) => {
      if (!season?.id) throw new Error("Season not loaded");
      return fantasyApi.joinLeague(season.id, by);
    },
    onSuccess: (data) => {
      if (data.paystack_url) {
        toast.success("Redirecting to Paystack for league entry fee...");
        window.location.href = data.paystack_url;
      } else {
        toast.success(`Joined ${data.league_name || "league"} successfully!`);
        setTermsTarget(null);
        setShowJoinModal(false);
        setInviteCodeInput("");
        queryClient.invalidateQueries({ queryKey: ["myFantasyLeagues"] });
        queryClient.invalidateQueries({ queryKey: ["publicFantasyLeagues"] });
        queryClient.invalidateQueries({ queryKey: ["fantasyDashboard"] });
        queryClient.invalidateQueries({ queryKey: ["leagueJoinPreview"] });
        queryClient.invalidateQueries({
          queryKey: ["leagueJoinPreviewByCode"],
        });
      }
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to join league"));
    },
  });

  // ─── Prize split (create form) ────────────────────────────────────────────
  const entryFeeKobo = Math.max(
    0,
    Math.round(num(createForm.entryFeeNaira) * 100),
  );
  const createIsPaid = entryFeeKobo > 0;

  const prizePercents = useMemo(
    () => (prizeRows ?? []).map((r) => parsePercent(r)),
    [prizeRows],
  );
  const prizeTotal = useMemo(
    () => prizePercents.reduce((sum, p) => sum + num(p), 0),
    [prizePercents],
  );

  // Mirrors the server's rules so the creator is told before the round trip.
  const splitError = useMemo<string | null>(() => {
    if (!createIsPaid) return null;
    if (prizePercents.length === 0) return "Add at least one paying position.";
    if (prizePercents.some((p) => !(num(p) > 0)))
      return "Every position must be greater than 0%.";
    if (prizePercents.some((p) => num(p) > 100))
      return "No single position can take more than 100%.";
    if (prizeTotal > 100.0001)
      return `Your split adds up to ${fmtPercent(prizeTotal)} — it cannot go over 100%.`;
    return null;
  }, [createIsPaid, prizePercents, prizeTotal]);

  // The platform cut is a server setting, asked for only while this form is
  // open: it is the creator's business, since it comes off the top of what
  // they charge. Nobody joining a league is shown it.
  const { data: serverCutPercent } = useQuery({
    queryKey: ["fantasyPlatformCut"],
    queryFn: fantasyLeagueApi.getPlatformCutPercent,
    enabled: showCreateModal || !!termsTarget,
    staleTime: 5 * 60 * 1000,
  });
  const platformCutPercent = Number.isFinite(serverCutPercent)
    ? (serverCutPercent as number)
    : FALLBACK_PLATFORM_CUT_PERCENT;

  // A full house, as a concrete illustration. 0 max members means unlimited,
  // in which case there is no field size to multiply by and we show none.
  const illustrationFieldSize = Math.max(0, num(createForm.maxMembers));
  const illustrationGrossKobo = entryFeeKobo * illustrationFieldSize;
  const illustrationPoolKobo = Math.max(
    0,
    Math.round(
      illustrationGrossKobo -
        (illustrationGrossKobo * num(platformCutPercent)) / 100,
    ),
  );
  const showIllustration =
    createIsPaid && illustrationFieldSize > 0 && illustrationPoolKobo > 0;

  const setPrizeRow = (index: number, value: string) =>
    setPrizeRows((rows) =>
      (rows ?? []).map((r, i) => (i === index ? value : r)),
    );
  const addPrizeRow = () => setPrizeRows((rows) => [...(rows ?? []), ""]);
  const removePrizeRow = (index: number) =>
    setPrizeRows((rows) => (rows ?? []).filter((_, i) => i !== index));

  // Create League Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!season?.id) throw new Error("Season not loaded");
      if (!createForm.name.trim()) throw new Error("League name required");
      if (splitError) throw new Error(splitError);
      return fantasyApi.createLeague({
        season_id: season.id,
        name: createForm.name.trim(),
        type: createForm.type,
        entry_fee: entryFeeKobo, // kobo
        max_members: Math.max(0, num(createForm.maxMembers)),
        // A free league has nothing to divide, so the server default stands.
        prize_structure: createIsPaid
          ? prizePercents.map((percent, i) => ({
              rank: i + 1,
              percent: num(percent),
            }))
          : undefined,
      });
    },
    onSuccess: () => {
      toast.success("League created successfully!");
      setShowCreateModal(false);
      setCreateForm({
        name: "",
        type: "PUBLIC",
        entryFeeNaira: 0,
        maxMembers: 50,
      });
      setPrizeRows(DEFAULT_PRIZE_ROWS);
      queryClient.invalidateQueries({ queryKey: ["myFantasyLeagues"] });
      queryClient.invalidateQueries({ queryKey: ["publicFantasyLeagues"] });
      queryClient.invalidateQueries({ queryKey: ["fantasyDashboard"] });
    },
    onError: (err: unknown) => {
      const error = err as {
        message?: string;
        response?: { data?: { error?: string } };
      };
      toast.error(
        error.response?.data?.error ||
          error.message ||
          "Failed to create league",
      );
    },
  });

  // Cross-reference the browse list against the leagues the manager is
  // already a member of, so a joined league never offers a Join button.
  const joinedLeagueIds = useMemo(
    () => new Set((myLeagues ?? []).map((l) => l?.id).filter(Boolean)),
    [myLeagues],
  );

  // ─── Join terms ───────────────────────────────────────────────────────────
  // Nothing joins and no payment page opens until the manager has read the
  // terms and confirmed in the dialogue below.
  const termsLeagueId = termsTarget?.leagueId;
  // A private league is never listed, so the invite code is the only handle
  // on it. Same terms either way — only the lookup differs.
  const termsInviteCode = !termsLeagueId
    ? (termsTarget?.inviteCode ?? "").trim() || undefined
    : undefined;

  const previewById = useQuery({
    queryKey: ["leagueJoinPreview", termsLeagueId],
    queryFn: () => fantasyLeagueApi.getJoinPreview(termsLeagueId as string),
    enabled: !!termsLeagueId,
  });
  const previewByCode = useQuery({
    queryKey: ["leagueJoinPreviewByCode", termsInviteCode],
    queryFn: () =>
      fantasyLeagueApi.getJoinPreviewByCode(termsInviteCode as string),
    enabled: !!termsInviteCode,
    retry: false, // a bad code is a 404, not a blip worth retrying
  });

  const activePreviewQuery = termsLeagueId ? previewById : previewByCode;
  const preview = activePreviewQuery.data;
  const previewLoading = activePreviewQuery.isLoading;
  const previewError = activePreviewQuery.error;

  const openTermsForLeague = (league: FantasyLeague) => {
    if (joinMutation.isPending) return;
    if (!league?.id) {
      toast.error(
        "That league could not be identified. Please refresh and try again.",
      );
      return;
    }
    setTermsTarget({ leagueId: league.id, name: league.name });
  };

  const confirmJoin = () => {
    if (!termsTarget || joinMutation.isPending) return;
    if (!isAuthenticated) {
      setTermsTarget(null);
      navigate("/login?redirect=/fantasy/leagues");
      return;
    }
    if (termsTarget.leagueId) {
      joinMutation.mutate({ league_id: termsTarget.leagueId });
      return;
    }
    const code = (termsTarget.inviteCode ?? "").trim();
    if (!code) return;
    joinMutation.mutate({ invite_code: code });
  };

  const previewFee = num(preview?.entry_fee_kobo);
  const previewIsPaid = previewFee > 0;
  const previewStructure = (preview?.prize_structure ?? []).filter(Boolean);
  const activePrizeStructure = useMemo(() => {
    if (previewStructure.length > 0) return previewStructure;
    return [
      { rank: 1, percent: 50, amount_kobo: 0 },
      { rank: 2, percent: 30, amount_kobo: 0 },
      { rank: 3, percent: 20, amount_kobo: 0 },
    ];
  }, [previewStructure]);

  const previewMaxMembers = Math.max(0, num(preview?.max_members));
  const projectedMaxPoolKobo = useMemo(() => {
    if (!previewIsPaid || previewMaxMembers <= 0) return 0;
    const maxGrossKobo = previewFee * previewMaxMembers;
    return Math.max(
      0,
      Math.round(maxGrossKobo - (maxGrossKobo * num(platformCutPercent)) / 100),
    );
  }, [previewIsPaid, previewMaxMembers, previewFee, platformCutPercent]);

  const previewBlocked =
    !!preview &&
    (preview.already_member ||
      preview.is_full ||
      preview.settled ||
      preview.forfeited);
  const previewStandingsId = preview?.league_id || termsTarget?.leagueId || "";
  const previewErrorMessage = apiErrorMessage(
    previewError,
    "Could not load this league's terms.",
  );

  // Only the card that was clicked shows a spinner.
  const pendingLeagueId = joinMutation.isPending
    ? joinMutation.variables?.league_id
    : undefined;

  if (authLoading || seasonLoading) {
    return <Loader />;
  }

  if (!season) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
        <div className="w-16 h-16 rounded-2xl bg-sffl-red/10 dark:bg-sffl-red/20 flex items-center justify-center text-sffl-red mb-4">
          <ShieldCheckIcon className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black uppercase text-sffl-navy dark:text-white mb-2">
          No Active Season
        </h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
          Fantasy leagues are currently closed. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <FantasyBackLink to="/fantasy/dashboard" label="Back to Dashboard" />
      {/* Header Showtime Navy Banner */}
      <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-4 sm:p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-bold uppercase mb-2">
              <TrophyIcon className="w-3.5 h-3.5" /> Leagues & Pools
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black italic uppercase tracking-tight text-white">
              Compete & Win
            </h1>
            <p className="text-xs md:text-sm text-gray-300 mt-1 font-medium">
              Join private friend leagues, company pools, or official Showtime
              cash prize tournaments.
            </p>
          </div>

          <div className="flex flex-col min-[400px]:flex-row gap-3 w-full md:w-auto">
            <Button
              variant="secondary"
              icon={KeyIcon}
              onClick={() => {
                if (!isAuthenticated) {
                  navigate("/login?redirect=/fantasy/leagues");
                  return;
                }
                setShowJoinModal(true);
              }}
            >
              Join via Code
            </Button>
            <Button
              icon={PlusIcon}
              onClick={() => {
                if (!isAuthenticated) {
                  navigate("/login?redirect=/fantasy/leagues");
                  return;
                }
                setShowCreateModal(true);
              }}
            >
              Create League
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* My Leagues Section */}
        {isAuthenticated && (
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white mb-4 flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-sffl-red" /> My Leagues
            </h2>

            {myLeaguesLoading ? (
              <Spinner label="Loading your leagues…" className="py-8" />
            ) : (myLeagues ?? []).length === 0 ? (
              <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center shadow-sm">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You haven't joined any custom leagues yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(myLeagues ?? []).map((l) => (
                  <div
                    key={l.id}
                    className="p-4 sm:p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-sffl-red/50 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                          {l.type}
                        </span>
                        {l.invite_code && (
                          <span className="text-xs font-mono text-sffl-red font-bold">
                            Code: {l.invite_code}
                          </span>
                        )}
                        {num(l.entry_fee) > 0 && (
                          <Button
                            variant="warning"
                            size="sm"
                            icon={TrophyIcon}
                            onClick={() => openTermsForLeague(l)}
                          >
                            Sharing Formula
                          </Button>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1.5 wrap-break-word">
                        {l.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Entry:{" "}
                        {num(l.entry_fee) > 0
                          ? formatKobo(num(l.entry_fee))
                          : "Free"}{" "}
                        • {formatMembers(l)}
                      </p>
                    </div>

                    <ButtonLink
                      to={`/fantasy/leaderboard/${l.id}`}
                      variant="secondary"
                      size="sm"
                      icon={ArrowRightIcon}
                      iconPosition="right"
                    >
                      Standings
                    </ButtonLink>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Public Leagues Section */}
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white mb-4 flex items-center gap-2">
            <TrophyIcon className="w-5 h-5 text-sffl-navy dark:text-white" />{" "}
            Official & Public Leagues
          </h2>

          {publicLeaguesLoading ? (
            <Spinner label="Loading leagues…" className="py-8" />
          ) : (publicLeagues ?? []).length === 0 ? (
            <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No public leagues open at this moment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(publicLeagues ?? []).map((l) => {
                const full = isLeagueFull(l);
                const joined = joinedLeagueIds.has(l.id);
                const fee = num(l.entry_fee);
                const pending = pendingLeagueId === l.id;
                return (
                  <div
                    key={l.id}
                    className="p-4 sm:p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-sffl-red/50 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                          {l.type}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {fee > 0 ? `Entry: ${formatKobo(fee)}` : "Free Entry"}
                        </span>
                        {joined && (
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Joined
                          </span>
                        )}
                        {full && !joined && (
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                            Full
                          </span>
                        )}
                        {fee > 0 && (
                          <Button
                            variant="warning"
                            size="sm"
                            icon={TrophyIcon}
                            onClick={() => openTermsForLeague(l)}
                          >
                            Sharing Formula
                          </Button>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1.5 wrap-break-word">
                        {l.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatMembers(l)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <ButtonLink
                        to={`/fantasy/leaderboard/${l.id}`}
                        variant="secondary"
                        size="sm"
                        icon={ArrowRightIcon}
                        iconPosition="right"
                      >
                        Standings
                      </ButtonLink>

                      {joined ? (
                        <span className="min-h-11 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase flex items-center gap-1.5">
                          <CheckBadgeIcon className="w-4 h-4" /> Joined
                        </span>
                      ) : full ? (
                        <Button
                          variant="secondary"
                          disabled
                          icon={LockClosedIcon}
                          title="This league has reached its member limit"
                        >
                          Full
                        </Button>
                      ) : (
                        <Button
                          icon={PlusIcon}
                          loading={pending}
                          onClick={() => openTermsForLeague(l)}
                          disabled={joinMutation.isPending}
                          title={
                            fee > 0
                              ? `Entry fee ${formatKobo(fee)} — you'll see the full terms before paying`
                              : "See the league terms before joining"
                          }
                        >
                          {fee > 0 ? `Join • ${formatKobo(fee)}` : "Join Free"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {publicTotalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Page {publicLeaguesPaged?.page || publicPage} of{" "}
                {publicTotalPages} · {publicLeaguesPaged?.total ?? 0} leagues
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={publicPage <= 1}
                  onClick={() => setPublicPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={publicPage >= publicTotalPages}
                  onClick={() =>
                    setPublicPage((p) => Math.min(publicTotalPages, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Join League Modal */}
      <Modal
        open={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title="Join with Invite Code"
        maxWidth="md"
      >
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
              Enter the 6-character private invite code provided by your league
              commissioner.
            </p>
            <Input
              type="text"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              aria-label="Invite code"
              maxLength={8}
              className="mb-4"
            />
            <Button
              size="lg"
              fullWidth
              onClick={() => {
                setShowJoinModal(false);
                setTermsTarget({ inviteCode: inviteCodeInput.trim() });
              }}
              disabled={!inviteCodeInput.trim() || joinMutation.isPending}
            >
              Continue
            </Button>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 text-center">
              You'll see the league's terms before anything is joined or paid.
            </p>
          </div>
      </Modal>

      {/* Create League Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New League"
        maxWidth="md"
      >
            <div className="space-y-4">
              <Field label="League Name" htmlFor="create-league-name">
                <Input
                  id="create-league-name"
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  placeholder="e.g. Lagos Flag Masters"
                />
              </Field>

              <Field label="Privacy Type">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="md"
                    variant={createForm.type === "PUBLIC" ? "navy" : "secondary"}
                    onClick={() =>
                      setCreateForm({ ...createForm, type: "PUBLIC" })
                    }
                  >
                    Public
                  </Button>
                  <Button
                    size="md"
                    variant={createForm.type === "PRIVATE" ? "navy" : "secondary"}
                    onClick={() =>
                      setCreateForm({ ...createForm, type: "PRIVATE" })
                    }
                  >
                    Private (Code Only)
                  </Button>
                </div>
              </Field>

              <Field label="Entry Fee (₦ Naira, 0 for Free)" htmlFor="create-league-fee">
                <Input
                  id="create-league-fee"
                  type="number"
                  value={createForm.entryFeeNaira}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      entryFeeNaira: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                />
              </Field>

              <Field label="Max Managers (0 for Unlimited)" htmlFor="create-league-max">
                <Input
                  id="create-league-max"
                  type="number"
                  min={0}
                  value={createForm.maxMembers}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      maxMembers: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                />
              </Field>

              {/* ── Prize split ─────────────────────────────── */}
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-1.5">
                    <BanknotesIcon className="w-4 h-4 text-sffl-red" /> Prize
                    Split
                  </h4>
                  {createIsPaid && (
                    <span
                      className={`text-[11px] font-black uppercase px-2 py-0.5 rounded ${
                        prizeTotal > 100.0001
                          ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                          : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      }`}
                    >
                      Total {fmtPercent(prizeTotal)}
                    </span>
                  )}
                </div>

                {!createIsPaid ? (
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 flex items-start gap-1.5">
                    <InformationCircleIcon className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
                    <span>
                      This is a free league, so there is no pot to divide. Set
                      an entry fee above to decide how the prize money is
                      shared.
                    </span>
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-3">
                      You decide how the pot is shared. Positions are paid in
                      order, top down.
                    </p>

                    <div className="space-y-2">
                      {(prizeRows ?? []).map((row, i) => {
                        const pct = parsePercent(row);
                        const rowKobo = Math.max(
                          0,
                          Math.round((illustrationPoolKobo * num(pct)) / 100),
                        );
                        return (
                          <div
                            key={`prize-row-${i}`}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <span className="w-14 shrink-0 text-xs font-black uppercase text-gray-700 dark:text-gray-200">
                              {ordinal(i + 1)}
                            </span>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="0.5"
                              value={row}
                              onChange={(e) => setPrizeRow(i, e.target.value)}
                              placeholder="0"
                              aria-label={`${ordinal(i + 1)} place share, percent`}
                              className="flex-1 min-w-0"
                              action={
                                <span className="pr-3 text-xs font-bold text-gray-400 dark:text-gray-500">
                                  %
                                </span>
                              }
                            />
                            {showIllustration && (
                              <span className="w-full sm:w-24 order-last sm:order-0 shrink-0 text-right text-xs font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                                {formatKobo(rowKobo)}
                              </span>
                            )}
                            <IconButton
                              variant="danger"
                              icon={TrashIcon}
                              label={`Remove ${ordinal(i + 1)} place`}
                              disabled={(prizeRows ?? []).length <= 1}
                              onClick={() => removePrizeRow(i)}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={PlusIcon}
                        onClick={addPrizeRow}
                        disabled={(prizeRows ?? []).length >= 20}
                      >
                        Add Position
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPrizeRows(DEFAULT_PRIZE_ROWS)}
                      >
                        Reset 50 / 30 / 20
                      </Button>
                    </div>

                    {splitError ? (
                      <p className="mt-3 text-[11px] font-bold text-red-700 dark:text-red-300 flex items-start gap-1.5">
                        <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                        <span>{splitError}</span>
                      </p>
                    ) : prizeTotal < 99.9999 ? (
                      <p className="mt-3 text-[11px] text-gray-600 dark:text-gray-300">
                        {fmtPercent(100 - prizeTotal)} of the pot is left
                        unallocated. That's allowed — raise a position to share
                        it out.
                      </p>
                    ) : null}

                    {showIllustration ? (
                      <p className="mt-3 text-[11px] text-gray-600 dark:text-gray-300">
                        Amounts assume a full league of {illustrationFieldSize}{" "}
                        at {formatKobo(entryFeeKobo)} each (
                        {formatKobo(illustrationGrossKobo)}), less the{" "}
                        {fmtPercent(platformCutPercent)} platform cut — a{" "}
                        {formatKobo(illustrationPoolKobo)} prize pool.
                      </p>
                    ) : (
                      <p className="mt-3 text-[11px] text-gray-600 dark:text-gray-300">
                        No cap on managers, so there's no full-league figure to
                        show. Percentages apply to whatever the pot reaches,
                        after the {fmtPercent(platformCutPercent)} platform cut.
                      </p>
                    )}
                  </>
                )}
              </div>

              <Button
                size="lg"
                fullWidth
                className="mt-2"
                loading={createMutation.isPending}
                disabled={
                  !createForm.name.trim() ||
                  !!splitError
                }
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Creating league…" : "Confirm & Create"}
              </Button>
            </div>
      </Modal>

      {/* League Terms Modal — the only route to an actual join */}
      <Modal
        open={!!termsTarget}
        onClose={() => setTermsTarget(null)}
        title={preview?.name || termsTarget?.name || "League Terms"}
        subtitle={
          preview?.already_member
            ? "League Details & Prize Formula"
            : "Before you join"
        }
        maxWidth="lg"
      >
        {termsTarget && (
          <div>
            {previewLoading ? (
              <Spinner label="Loading league terms…" className="py-10" />
            ) : previewError || !preview ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                  <p className="text-xs font-bold text-red-700 dark:text-red-300">
                    {previewErrorMessage}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={() => setTermsTarget(null)}
                >
                  Close
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                    {preview.type || "LEAGUE"}
                  </span>
                  {termsInviteCode && (
                    <span className="text-xs font-mono font-bold text-sffl-red">
                      Code: {termsInviteCode}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {num(preview.max_members) > 0
                      ? `${num(preview.member_count)} / ${num(preview.max_members)} managers`
                      : `${num(preview.member_count)} ${num(preview.member_count) === 1 ? "manager" : "managers"} • no cap`}
                  </span>
                  {preview.owner_name && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 wrap-break-word">
                      • Run by {preview.owner_name}
                    </span>
                  )}
                </div>

                {/* States that make joining pointless, said plainly */}
                {preview.settled && (
                  <div className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-200">
                      This league has already been settled and paid out. It is
                      closed to new entries.
                    </p>
                  </div>
                )}
                {preview.already_member && (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckBadgeIcon className="w-4 h-4" /> You're already in
                      this league.
                    </p>
                    {preview.invite_code && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                        Invite code:{" "}
                        <span className="font-mono font-black">
                          {preview.invite_code}
                        </span>{" "}
                        — share it to bring others in.
                      </p>
                    )}
                  </div>
                )}
                {preview.forfeited && (
                  <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                    <p className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                      <ExclamationTriangleIcon className="w-4 h-4" /> You left
                      this league and gave up your entry fee.
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      That money stayed in the prize pool, so this league can't
                      be rejoined.
                    </p>
                  </div>
                )}
                {!preview.already_member &&
                  preview.membership_status === "PENDING" && (
                    <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                        Your entry payment hasn't been confirmed yet. If you
                        already paid, give Paystack a moment before trying
                        again.
                      </p>
                    </div>
                  )}
                {!preview.already_member && preview.is_full && (
                  <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                    <p className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                      <LockClosedIcon className="w-4 h-4" /> This league is full
                      — every place has been taken.
                    </p>
                  </div>
                )}

                {!previewIsPaid ? (
                  /* ── Free league: short, as asked ── */
                  <ul className="text-xs text-gray-700 dark:text-gray-200 space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckBadgeIcon className="w-4 h-4 shrink-0 text-sffl-red mt-0.5" />
                      <span>
                        There is no entry fee — this league is free to join.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckBadgeIcon className="w-4 h-4 shrink-0 text-sffl-red mt-0.5" />
                      <span>
                        Open to anyone, and you can join right now.{" "}
                        {num(preview.max_members) > 0
                          ? `${num(preview.member_count)} of ${num(preview.max_members)} places taken.`
                          : `${num(preview.member_count)} ${num(preview.member_count) === 1 ? "manager has" : "managers have"} joined so far.`}
                      </span>
                    </li>
                  </ul>
                ) : (
                  /* ── Paid league: transparent prize pool sharing formula ── */
                  <div className="space-y-4">
                    {/* Headline Metric Cards */}
                    <div
                      className={`grid grid-cols-1 ${previewMaxMembers > 0 ? "min-[400px]:grid-cols-3" : "min-[400px]:grid-cols-2"} gap-2`}
                    >
                      <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          You Pay
                        </p>
                        <p className="text-base sm:text-lg font-black text-sffl-navy dark:text-white mt-0.5">
                          {formatKobo(previewFee)}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          Entry fee
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          Current Pool
                        </p>
                        <p className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                          {formatKobo(num(preview.prize_pool_kobo))}
                        </p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {num(preview.member_count)}{" "}
                          {num(preview.member_count) === 1
                            ? "manager"
                            : "managers"}
                        </p>
                      </div>

                      {previewMaxMembers > 0 ? (
                        <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                            Max Potential
                          </p>
                          <p className="text-base sm:text-lg font-black text-amber-700 dark:text-amber-300 mt-0.5">
                            {formatKobo(projectedMaxPoolKobo)}
                          </p>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                            At {previewMaxMembers} cap
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
                          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Pool Type
                          </p>
                          <p className="text-base sm:text-lg font-black text-sffl-navy dark:text-white mt-0.5">
                            Dynamic
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            No member cap
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Prize Pool Sharing Formula Table */}
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                      <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <TrophyIcon className="w-4 h-4 text-amber-500 shrink-0" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                            Prize Pool Sharing Formula
                          </h4>
                        </div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Fixed Split
                        </span>
                      </div>

                      <DataTable
                        compact
                        searchable={false}
                        paginated={false}
                        getRowId={(t) => `tier-${num(t?.rank) || activePrizeStructure.indexOf(t) + 1}`}
                        data={activePrizeStructure}
                        columns={[
                          {
                            header: "Position",
                            className: "py-2.5 px-3 font-bold text-gray-900 dark:text-white text-xs",
                            cell: (t) => {
                              const rankNum = num(t?.rank) || activePrizeStructure.indexOf(t) + 1;
                              return (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    aria-hidden="true"
                                    className={`inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-full text-[11px] font-black ${rankBadgeClass(rankNum)}`}
                                  >
                                    {rankNum}
                                  </span>
                                  <span className={rankNum === 1 ? "text-sffl-navy dark:text-white font-black" : ""}>
                                    {ordinal(rankNum)} Place
                                  </span>
                                </div>
                              );
                            },
                          },
                          {
                            header: "Formula Share",
                            className: "py-2.5 px-3 text-xs",
                            cell: (t) => (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-gray-100 dark:bg-gray-700 text-sffl-navy dark:text-gray-100 border border-gray-200 dark:border-gray-600">
                                {fmtPercent(num(t?.percent))}
                              </span>
                            ),
                          },
                          {
                            header: "Current Prize",
                            align: "right",
                            className: "py-2.5 px-3 text-xs font-bold text-gray-900 dark:text-white tabular-nums",
                            cell: (t) => formatKobo(num(t?.amount_kobo)),
                          },
                          ...(previewMaxMembers > 0
                            ? [
                                {
                                  header: "At Max Cap",
                                  align: "right" as const,
                                  className: "py-2.5 px-3 text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums",
                                  cell: (t: (typeof activePrizeStructure)[number]) =>
                                    formatKobo(Math.round((projectedMaxPoolKobo * num(t?.percent)) / 100)),
                                },
                              ]
                            : []),
                        ]}
                      />

                      <div className="px-3.5 py-2 bg-gray-50 dark:bg-gray-700/40 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-300 flex items-start gap-2">
                        <InformationCircleIcon className="w-4 h-4 shrink-0 text-sffl-red mt-0.5" />
                        <span>
                          <strong>100% of net pool</strong> is distributed to
                          winners by this fixed formula when the season settles.
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2.5">
                      <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-300">
                          Your entry fee is not refundable
                        </p>
                        <p className="text-xs text-red-700/90 dark:text-red-300/90 mt-0.5">
                          Once paid, {formatKobo(previewFee)} is pooled and
                          cannot be returned — not if you change your mind, and
                          not if you finish outside the prizes.
                        </p>
                      </div>
                    </div>

                    {!previewBlocked && (
                      <p className="text-[11px] text-gray-600 dark:text-gray-300">
                        Confirming takes you to Paystack to pay{" "}
                        {formatKobo(previewFee)}. Your place is held once the
                        payment clears.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                  {previewBlocked ? (
                    <>
                      {previewStandingsId && (
                        <ButtonLink
                          to={`/fantasy/leaderboard/${previewStandingsId}`}
                          variant="secondary"
                          size="lg"
                          className="flex-1"
                          onClick={() => setTermsTarget(null)}
                        >
                          View Standings
                        </ButtonLink>
                      )}
                      <Button
                        variant="secondary"
                        size="lg"
                        className="flex-1"
                        onClick={() => setTermsTarget(null)}
                      >
                        Close
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={() => setTermsTarget(null)}
                      >
                        Cancel
                      </Button>
                      {!isAuthenticated ? (
                        <Button
                          size="lg"
                          className="flex-1"
                          onClick={() => {
                            setTermsTarget(null);
                            navigate("/login?redirect=/fantasy/leagues");
                          }}
                        >
                          {previewIsPaid
                            ? `Log In to Pay ${formatKobo(previewFee)} & Join`
                            : "Log In to Join"}
                        </Button>
                      ) : (
                        <Button
                          size="lg"
                          className="flex-1"
                          loading={joinMutation.isPending}
                          disabled={joinMutation.isPending}
                          onClick={confirmJoin}
                        >
                          {joinMutation.isPending
                            ? "Joining…"
                            : previewIsPaid
                              ? `Pay ${formatKobo(previewFee)} & Join`
                              : "Join League"}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
