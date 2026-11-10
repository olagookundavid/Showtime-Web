import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  isDeletedPlayer,
  Button,
  IconButton,
  Field,
  Input,
  Select,
  Modal,
  Spinner,
  Loader,
  PlayerAvatar,
  FantasyPitch,
  Tabs,
} from "../../components";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  RocketLaunchIcon,
  SparklesIcon,
  BanknotesIcon,
  MinusCircleIcon,
  LockClosedIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  Squares2X2Icon,
  ListBulletIcon,
} from "@heroicons/react/24/outline";
import {
  fantasyApi,
  fantasySeasonApi,
  fantasySquadApi,
  formatFantasyPrice,
} from "../../services/api";
import type { FantasyPlayerListItem, Squad, SquadPlayer } from "../../types";
import {
  isFemale,
  unitOf,
  getDefaultTeamName,
  formatStatNumber,
  groupPlayersByPosition,
  normalizeFantasyPosition,
} from "../../utils";
import { useAuth } from "../../contexts";

// Filter 2's nested sort options. "points" is the default; the other two
// are what a manager would actually want to sort a buy list by. Rating and
// asc-price sorts existed before but weren't asked for here, so they're
// gone rather than carried along unused.
type MarketSortKey = "points" | "price_desc" | "selected";

const MARKET_PAGE_SIZE = 15;

// Filter 3: a real price-range filter, not a sort — narrows the list to a
// budget band on top of whatever Filter 2 orders it by. Applied client-side
// (the market list is already fetched close to exhaustively; the backend
// has no price-range query param to add a round trip for). Brackets span
// the fantasy price curve's floor (3.0) to ceiling (12.5).
const PRICE_RANGE_OPTIONS: {
  value: string;
  label: string;
  min: number;
  max: number;
}[] = [
  { value: "", label: "All Prices", min: 0, max: Infinity },
  { value: "under5", label: "Under ₦5m", min: 0, max: 5 },
  { value: "5to8", label: "₦5m – ₦8m", min: 5, max: 8 },
  { value: "8to10", label: "₦8m – ₦10m", min: 8, max: 10 },
  { value: "10plus", label: "₦10m & above", min: 10, max: Infinity },
];

export function FantasyTransfers() {
  // Shares the hub/dashboard query key, so this is a cache hit rather than
  // an extra request.
  const { data: dashboard, isLoading: enteredLoading } = useQuery({
    queryKey: ["fantasyDashboard"],
    queryFn: () => fantasySeasonApi.getDashboard(),
  });
  const hasJoined = dashboard ? dashboard.entered : undefined;

  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();

  // Active Season & Gameweek
  const { data: season, isLoading: seasonLoading } = useQuery({
    queryKey: ["fantasySeason"],
    queryFn: fantasyApi.getActiveSeason,
  });

  const { data: gameweeks = [], isLoading: gwLoading } = useQuery({
    queryKey: ["fantasyGameweeks", season?.id],
    queryFn: () =>
      season?.id ? fantasyApi.getGameweeks(season.id) : Promise.resolve([]),
    enabled: !!season?.id,
  });

  // For context only — this page has no deadline to meet, only a market
  // that may be closed while a match day plays out.
  const scheduledGW =
    gameweeks.find((gw) => gw.status === "SCHEDULED") || gameweeks[0];

  // Team names lock once the season is underway — matches the gate on the
  // Pick Team page, computed from the same already-fetched gameweeks. Cheap
  // enough that it doesn't need memoizing.
  const seasonHasStarted = gameweeks.some((gw) => gw.status !== "SCHEDULED");

  // The manager's owned squad — the primary subject of this whole page.
  const { data: mySquad } = useQuery({
    queryKey: ["fantasySquad", season?.id],
    queryFn: () => fantasySquadApi.getSquad(season!.id),
    enabled: !!season?.id,
  });

  // Current starting lineup, purely to draw the read-only Pitch view of Your
  // Squad — same query key Pick Team uses, so this is a cache hit whenever
  // that page has been visited this session. No slot editing happens here.
  const { data: currentLineup, isLoading: lineupLoading } = useQuery({
    queryKey: ["myFantasyLineup", season?.id, scheduledGW?.id],
    queryFn: () =>
      season?.id && scheduledGW?.id
        ? fantasyApi.getMyLineup(season.id, scheduledGW.id)
        : Promise.resolve(null),
    enabled: !!season?.id && !!scheduledGW?.id,
  });

  const refreshSquad = (next: Squad) => {
    queryClient.setQueryData(["fantasySquad", season?.id], next);
    queryClient.invalidateQueries({ queryKey: ["fantasyDashboard"] });
    queryClient.invalidateQueries({ queryKey: ["fantasyLineup"] });
  };

  // Clubs and positions on this season's market, for the filter chips. Served
  // by its own endpoint so it never depends on paging the whole player list.
  const { data: marketFilters } = useQuery({
    queryKey: ["playerMarketFilters", season?.id],
    queryFn: () => fantasyApi.getMarketFilters(season!.id),
    enabled: !!season?.id,
    staleTime: 5 * 60 * 1000,
  });
  const marketTeams = useMemo(
    () =>
      (marketFilters?.teams ?? []).map((t) => ({
        id: t.id,
        name: t.short_name || t.name || "—",
      })),
    [marketFilters],
  );
  const marketPositions = useMemo(
    () => marketFilters?.positions ?? [],
    [marketFilters],
  );

  // Player metadata cache, so photos/club art are never dropped between the
  // squad list and the market lists.
  const playerMetadataLookup = useMemo(() => {
    const map = new Map<string, { image: string }>();
    for (const p of mySquad?.players ?? []) {
      if (p.player_id) map.set(p.player_id, { image: p.image || "" });
    }
    return map;
  }, [mySquad]);

  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editModalNameInput, setEditModalNameInput] = useState("");
  const [joinTeamNameInput, setJoinTeamNameInput] = useState("");
  // How Your Squad is shown — the pitch is the default, richer view; List is
  // the plain fallback for scanning everyone at once.
  const [squadView, setSquadView] = useState<"pitch" | "list">("pitch");
  // Once the manager dismisses the legacy-name auto-prompt (below) without
  // renaming, it stays dismissed for the rest of the session instead of
  // reopening on every render.
  const [renameDismissed, setRenameDismissed] = useState(false);

  // Player Selection pane's filter bar — one unified market list now, not
  // scoped to a specific role or to a separate bench section. Four nested
  // filters: Filter 1 (position or team, "All Players" by default), Filter
  // 2 (sort — points by default), Filter 3 (price range) and Filter 4
  // (gender), plus search.
  const [marketSearch, setMarketSearch] = useState("");
  // "" = All Players, "pos:<Position>" or "team:<id>" otherwise — one
  // control standing in for what used to be two separate selects.
  const [marketPrimaryFilter, setMarketPrimaryFilter] = useState("");
  const [marketSortFilter, setMarketSortFilter] =
    useState<MarketSortKey>("points");
  const [marketPriceRange, setMarketPriceRange] = useState("");
  const [marketGenderFilter, setMarketGenderFilter] = useState<"" | "F" | "M">(
    "",
  );
  const [marketPage, setMarketPage] = useState(1);
  // Any filter change can shrink the matching set below the page you were
  // on — back to page 1 rather than stranding you on an empty page. Done
  // during render (the React-docs "adjusting state when a prop changes"
  // pattern — compare against last render's key, setState if it moved) so
  // it resolves before paint, not as a cascading effect.
  const marketFilterKey = `${marketSearch}|${marketPrimaryFilter}|${marketSortFilter}|${marketPriceRange}|${marketGenderFilter}`;
  const [prevMarketFilterKey, setPrevMarketFilterKey] =
    useState(marketFilterKey);
  if (marketFilterKey !== prevMarketFilterKey) {
    setPrevMarketFilterKey(marketFilterKey);
    setMarketPage(1);
  }

  const [confirmSell, setConfirmSell] = useState<SquadPlayer | null>(null);

  // If an entered manager still has the legacy placeholder name, prompt them
  // to pick one — but never once the season has started, since naming is
  // locked by then. Derived during render rather than pushed via an effect,
  // so there's no extra render pass; `renameDismissed` is what stops it from
  // reopening the instant the manager cancels out of it.
  const needsLegacyRename =
    !seasonHasStarted &&
    !renameDismissed &&
    !!hasJoined &&
    dashboard?.team?.name === "My Showtime Stars";

  const closeEditNameModal = () => {
    setShowEditNameModal(false);
    setRenameDismissed(true);
  };

  // Filter 1 packs position-or-team into one value ("pos:<Position>" /
  // "team:<id>" / "" for All Players) — split back out for the API call,
  // which still takes the two separately.
  const [marketPrimaryKind, marketPrimaryValue] = marketPrimaryFilter.includes(
    ":",
  )
    ? (marketPrimaryFilter.split(":") as [string, string])
    : ["", ""];
  const derivedPositionFilter =
    marketPrimaryKind === "pos" ? marketPrimaryValue : "";
  const derivedTeamFilter =
    marketPrimaryKind === "team" ? marketPrimaryValue : "";

  // Player Selection's market query — covers every position at once now,
  // grouped client-side (see groupedMarket below) instead of being opened
  // per-role from the pitch.
  const { data: marketData, isLoading: marketLoading } = useQuery({
    queryKey: [
      "playerMarket",
      season?.id,
      derivedPositionFilter,
      marketGenderFilter,
      derivedTeamFilter,
      marketSearch,
      marketSortFilter,
    ],
    queryFn: () => {
      if (!season?.id)
        return Promise.resolve({ data: [], total: 0, total_pages: 0 });
      return fantasyApi.listPlayerMarket(season.id, {
        position: derivedPositionFilter || undefined,
        gender: marketGenderFilter
          ? (marketGenderFilter as "M" | "F")
          : undefined,
        team_id: derivedTeamFilter || undefined,
        search: marketSearch,
        sort: marketSortFilter,
        // The whole market now, not one role at a time.
        limit: 300,
      });
    },
    enabled: !!season?.id,
  });

  // Helper to look up a player's real name in the squad or the market list,
  // so an API error naming a raw UUID can be turned into a name.
  const getPlayerFriendlyInfo = (id: string): { name: string } | null => {
    if (mySquad?.players) {
      const sp = mySquad.players.find((p) => p.player_id === id);
      if (sp) return { name: sp.name };
    }
    const mp = marketData?.data?.find((p) => p.player_id === id);
    if (mp) return { name: mp.player_name };
    return null;
  };

  // Format any raw API / validation error into a clear, meaningful message without raw UUIDs
  const formatErrorMessage = (raw: unknown, fallback: string): string => {
    let msg = "";
    if (typeof raw === "string") {
      msg = raw;
    } else if (raw && typeof raw === "object") {
      const errObj = raw as {
        response?: { data?: { error?: unknown } };
        message?: unknown;
      };
      if (typeof errObj.response?.data?.error === "string") {
        msg = errObj.response.data.error;
      } else if (typeof errObj.message === "string") {
        msg = errObj.message;
      }
    }
    if (!msg) return fallback;

    // Pattern 1: "player <UUID> not found or belongs to an inactive team"
    const inactiveMatch = msg.match(
      /player\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+(?:was\s+)?not found or belongs to an inactive team/i,
    );
    if (inactiveMatch) {
      const id = inactiveMatch[1];
      const info = getPlayerFriendlyInfo(id);
      return info
        ? `${info.name} is not eligible to sign because the player or their club is inactive.`
        : "That player is not eligible to sign because they or their club is inactive.";
    }

    // Pattern 2: Replace any remaining raw UUID in the error message with the player's name if known, or "selected player"
    const uuidRegex =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    msg = msg.replace(uuidRegex, (id) => {
      const info = getPlayerFriendlyInfo(id);
      return info ? info.name : "selected player";
    });

    // Clean up grammatical artifacts like "player selected player"
    msg = msg.replace(/\bplayer\s+selected player\b/gi, "selected player");

    return msg;
  };

  // Signing a player onto the squad. No slot placement here — that's Pick
  // Team's job; this just buys them.
  const buyMutation = useMutation({
    mutationFn: (playerId: string) =>
      fantasySquadApi.buyPlayer(season!.id, playerId),
    onSuccess: (next, playerId) => {
      refreshSquad(next);
      const signed = next.players.find((p) => p.player_id === playerId);
      if (signed) toast.success(`Signed ${signed.name}.`);
    },
    onError: (err: unknown) => {
      toast.error(formatErrorMessage(err, "Could not sign this player."));
    },
  });

  // Selling a player from the squad entirely.
  const sellMutation = useMutation({
    mutationFn: (playerId: string) =>
      fantasySquadApi.sellPlayer(season!.id, playerId),
    onSuccess: (next) => {
      refreshSquad(next);
      setConfirmSell(null);
      toast.success("Sold — the money is back in your bank.");
    },
    onError: (err: unknown) => {
      toast.error(formatErrorMessage(err, "Could not sell this player."));
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (newName: string) => {
      if (!season?.id) throw new Error("Season not loaded");
      const clean = newName.trim();
      if (clean.length < 3 || clean.length > 40) {
        throw new Error("Team name must be between 3 and 40 characters.");
      }
      return fantasySeasonApi.enterSeason(season.id, clean);
    },
    onSuccess: () => {
      closeEditNameModal();
      toast.success("Team name updated!");
      queryClient.invalidateQueries({ queryKey: ["fantasyDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["myFantasyLineup"] });
    },
    onError: (err: unknown) => {
      toast.error(formatErrorMessage(err, "Failed to update team name"));
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (chosenName: string) => {
      if (!season?.id) throw new Error("Season not loaded");
      const clean = chosenName.trim();
      if (clean.length < 3 || clean.length > 40) {
        throw new Error("Team name must be between 3 and 40 characters.");
      }
      return fantasySeasonApi.enterSeason(season.id, clean);
    },
    onSuccess: () => {
      toast.success("You're in! Welcome to Showtime Fantasy.");
      queryClient.invalidateQueries({ queryKey: ["fantasyDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["myFantasyLineup"] });
    },
    onError: (err: unknown) => {
      toast.error(formatErrorMessage(err, "Failed to join season"));
    },
  });

  // Every owned player's id, for excluding them from "available to sign" lists.
  const ownedIds = useMemo(
    () => new Set((mySquad?.players ?? []).map((p) => p.player_id)),
    [mySquad],
  );

  const marketPlayers = useMemo(() => marketData?.data ?? [], [marketData]);

  // Filter 3 — applied client-side, see PRICE_RANGE_OPTIONS above.
  const activePriceRange =
    PRICE_RANGE_OPTIONS.find((opt) => opt.value === marketPriceRange) ??
    PRICE_RANGE_OPTIONS[0];

  // Anyone already owned shows up in Your Squad instead, so Player Selection
  // lists only players who'd actually need signing.
  const buyableMarketPlayers = useMemo(
    () =>
      marketPlayers.filter(
        (p) =>
          !ownedIds.has(p.player_id) &&
          p.price > 0 &&
          p.price >= activePriceRange.min &&
          p.price < activePriceRange.max,
      ),
    [marketPlayers, ownedIds, activePriceRange],
  );

  const groupedSquad = useMemo(
    () => groupPlayersByPosition(mySquad?.players ?? [], (p) => p.position),
    [mySquad],
  );

  // Player Selection is a flat, paginated list now rather than grouped by
  // position — Filter 1 already narrows to one position directly, which
  // made grouping headers mostly redundant once pagination needed a plain
  // list to slice.
  const marketTotalPages = Math.max(
    1,
    Math.ceil(buyableMarketPlayers.length / MARKET_PAGE_SIZE),
  );
  const pagedMarketPlayers = useMemo(
    () =>
      buyableMarketPlayers.slice(
        (marketPage - 1) * MARKET_PAGE_SIZE,
        marketPage * MARKET_PAGE_SIZE,
      ),
    [buyableMarketPlayers, marketPage],
  );

  // Each readiness card is solid green or red, never a neutral/default
  // state — met or not met is the entire point of the card.
  const readinessTone = (met: boolean) =>
    met
      ? {
          box: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
          value: "text-emerald-700 dark:text-emerald-300",
          label: "text-emerald-600 dark:text-emerald-400",
        }
      : {
          box: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
          value: "text-red-700 dark:text-red-300",
          label: "text-red-600 dark:text-red-400",
        };

  // "Players selected" shows have/max (squad_size vs. squad_max) rather
  // than the backend requirement's own have/min pairing, but still keys its
  // color off that requirement's `met` (against the minimum). Budget is its
  // own card, not one of the backend's requirements, keyed off the bank
  // going negative instead.
  const readinessCards = useMemo(() => {
    if (!mySquad) return [];
    const squadSizeMet =
      mySquad.readiness.requirements.find((req) => req.key === "squad_size")
        ?.met !== false;
    return [
      {
        key: "squad_size",
        met: squadSizeMet,
        value: `${mySquad.squad_size}/${mySquad.squad_max}`,
        label: "Players selected",
      },
      ...mySquad.readiness.requirements
        .filter((req) => req.key !== "squad_size")
        .map((req) => ({
          key: req.key,
          met: req.met,
          value: `${req.have}/${req.need}`,
          label: req.label,
        })),
      {
        key: "budget",
        met: mySquad.bank >= 0,
        value: formatFantasyPrice(mySquad.bank),
        label: mySquad.bank < 0 ? "Overspent" : "Budget",
      },
    ];
  }, [mySquad]);

  // Pitch view only ever draws the 14 starting slots — anyone else owned
  // (bench/reserve signings, or players not yet placed in a lineup) renders
  // as avatar tokens under the FANTASY end zone instead, same as Pick
  // Team's substitutes row. There's no start action here (this pitch is
  // read-only), so unlike Pick Team, everyone benched goes in — not just
  // start-eligible players.
  const startingIds = useMemo(
    () => new Set((currentLineup?.picks ?? []).map((p) => p.player_id)),
    [currentLineup],
  );
  const benchPlayers = useMemo(
    () => (mySquad?.players ?? []).filter((p) => !startingIds.has(p.player_id)),
    [mySquad, startingIds],
  );
  const pitchBench = useMemo(
    () =>
      benchPlayers.map((p) => ({
        playerId: p.player_id,
        name: p.name,
        image: p.image || playerMetadataLookup.get(p.player_id)?.image || undefined,
        position: p.position,
        gender: p.gender,
      })),
    [benchPlayers, playerMetadataLookup],
  );

  // Market closed detection — buying and selling both spend out of the bank,
  // so both pause while a match day is being played.
  const marketClosed =
    mySquad && !mySquad.market_open
      ? mySquad.market_closed_reason ||
        "The transfer market is closed while a match day is being played."
      : undefined;

  const squadFull = !!mySquad && mySquad.squad_size >= mySquad.squad_max;

  // Signing from the market list: one plain buy, no slot placement.
  const handleBuy = (playerId: string) => buyMutation.mutate(playerId);

  const handleResetMarketFilters = () => {
    setMarketSearch("");
    setMarketPrimaryFilter("");
    setMarketSortFilter("points");
    setMarketPriceRange("");
    setMarketGenderFilter("");
  };

  if (authLoading || seasonLoading || gwLoading || enteredLoading) {
    return <Loader />;
  }

  // Signing players without having joined would only fail at purchase time.
  // Say so up front instead.
  if (hasJoined === false) {
    const initialDefault = joinTeamNameInput || getDefaultTeamName(user?.name);
    const trimmedJoin = initialDefault.trim();
    const joinValid = trimmedJoin.length >= 3 && trimmedJoin.length <= 40;

    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl p-6 md:p-10 max-w-lg w-full">
          <div className="w-14 h-14 bg-sffl-red/10 dark:bg-sffl-red/20 flex items-center justify-center text-sffl-red mb-5">
            <SparklesIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tight uppercase text-sffl-navy dark:text-white">
            Name Your Fantasy Team
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm leading-relaxed">
            Welcome to Showtime Fantasy! Choose a unique name for your squad to
            enter the season and start signing players.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (joinValid && !joinMutation.isPending) {
                joinMutation.mutate(trimmedJoin);
              }
            }}
            className="mt-6 space-y-4"
          >
            <Field
              label="Team Name (3–40 characters)"
              htmlFor="join-team-name-input"
              hint={
                trimmedJoin.length === 0
                  ? "Team names must be unique across the season."
                  : joinValid
                    ? `${trimmedJoin.length}/40 characters • Must be unique in this season`
                    : "Team name must be between 3 and 40 characters."
              }
            >
              <Input
                id="join-team-name-input"
                type="text"
                shape="square"
                value={joinTeamNameInput || initialDefault}
                onChange={(e) => setJoinTeamNameInput(e.target.value)}
                placeholder="e.g. Lagos Blitz"
                maxLength={40}
              />
            </Field>

            <Button
              type="submit"
              size="lg"
              shape="square"
              fullWidth
              variant="primary"
              disabled={!joinValid}
              loading={joinMutation.isPending}
              icon={RocketLaunchIcon}
              iconPosition="right"
            >
              {joinMutation.isPending
                ? "Entering Season…"
                : "Confirm Name & Start Signing"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Buying/selling needs an active season, but not a specific open
  // gameweek — that's Pick Team's concern, not this page's.
  if (!season) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
        <div className="w-16 h-16 bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
          <ExclamationCircleIcon className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black uppercase text-sffl-navy dark:text-white mb-2">
          No Active Season
        </h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
          There's no fantasy season running right now, so there's nothing to buy
          or sell yet. Check back once the next one kicks off.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="space-y-6 md:space-y-8 min-w-0">
        {!mySquad ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-8">
            <Spinner label="Loading your squad…" className="py-10" />
          </div>
        ) : (
          // Player Selection + everything else — 1:2. Player Selection
          // stretches the full height of the stack beside it (grid's
          // default row stretch), so it runs top to bottom of the page
          // rather than stopping at the readiness card's height.
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 md:gap-8">
            {/* Player Selection */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm min-w-0 lg:flex lg:flex-col">
              <div className="p-5 md:p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-base font-black uppercase tracking-tight text-sffl-navy dark:text-white">
                  Player Selection
                </h2>
              </div>

              <div className="p-4 md:p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 space-y-2.5">
                <Input
                  id="market-player-search"
                  type="text"
                  shape="square"
                  icon={MagnifyingGlassIcon}
                  value={marketSearch}
                  onChange={(e) => setMarketSearch(e.target.value)}
                  placeholder="Search by player name..."
                  aria-label="Search by player name"
                />
                {/* Four nested filters in one wrapping row — however many
                    fit at the current width sit on a line, the rest wrap
                    below, down to one per line on a phone. */}
                <div className="flex flex-wrap gap-2">
                  {/* Filter 1: All Players, or narrow to one position or
                      one team. */}
                  <Select
                    id="market-primary-filter"
                    shape="square"
                    value={marketPrimaryFilter}
                    onChange={(e) => setMarketPrimaryFilter(e.target.value)}
                    aria-label="Filter by position or team"
                    className="flex-1 min-w-[150px]"
                  >
                    <option value="">All Players</option>
                    <optgroup label="Position">
                      {marketPositions.map((pos) => (
                        <option key={`pos:${pos}`} value={`pos:${pos}`}>
                          {normalizeFantasyPosition(pos)}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Team">
                      {marketTeams.map((t) => (
                        <option key={`team:${t.id}`} value={`team:${t.id}`}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  </Select>

                  {/* Filter 2: sort — Total Points by default. */}
                  <Select
                    id="market-sort-filter"
                    shape="square"
                    value={marketSortFilter}
                    onChange={(e) =>
                      setMarketSortFilter(e.target.value as MarketSortKey)
                    }
                    aria-label="Sort by"
                    className="flex-1 min-w-[150px]"
                  >
                    <option value="points">Total Points</option>
                    <option value="price_desc">Price</option>
                    <option value="selected">% Selected</option>
                  </Select>

                  {/* Filter 3: price range. */}
                  <Select
                    id="market-price-range-filter"
                    shape="square"
                    value={marketPriceRange}
                    onChange={(e) => setMarketPriceRange(e.target.value)}
                    aria-label="Filter by price range"
                    className="flex-1 min-w-[150px]"
                  >
                    {PRICE_RANGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>

                  {/* Filter 4: gender. */}
                  <Select
                    id="market-gender-filter"
                    shape="square"
                    value={marketGenderFilter}
                    onChange={(e) =>
                      setMarketGenderFilter(e.target.value as "" | "F" | "M")
                    }
                    aria-label="Filter by gender"
                    className="flex-1 min-w-[150px]"
                  >
                    <option value="">All Genders</option>
                    <option value="F">Women</option>
                    <option value="M">Men</option>
                  </Select>

                  <Button
                    variant="secondary"
                    size="sm"
                    shape="square"
                    icon={ArrowPathIcon}
                    onClick={handleResetMarketFilters}
                    className="shrink-0"
                  >
                    Reset filters
                  </Button>
                </div>
              </div>

              <div className="p-4 md:p-5 space-y-3 lg:flex-1 lg:overflow-y-auto">
                {marketLoading ? (
                  <Spinner label="Loading players…" className="py-12" />
                ) : buyableMarketPlayers.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400 space-y-3">
                    <p>No players match your filters.</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      shape="square"
                      onClick={handleResetMarketFilters}
                    >
                      Reset filters
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Total matching the current filters, declared up
                        front rather than buried after the list. */}
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                      {buyableMarketPlayers.length} player
                      {buyableMarketPlayers.length === 1 ? "" : "s"} shown
                    </p>

                    <div className="space-y-2">
                      {pagedMarketPlayers.map((p) => (
                        <MarketPlayerRow
                          key={p.player_id}
                          player={p}
                          marketSort={marketSortFilter}
                          bank={mySquad.bank}
                          squadFull={squadFull}
                          marketClosed={marketClosed}
                          buying={buyMutation.isPending}
                          onBuy={() => handleBuy(p.player_id)}
                        />
                      ))}
                    </div>

                    {marketTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-3 pt-2">
                        <IconButton
                          icon={ChevronLeftIcon}
                          label="Previous page"
                          variant="secondary"
                          shape="circle"
                          disabled={marketPage <= 1}
                          onClick={() =>
                            setMarketPage((page) => Math.max(1, page - 1))
                          }
                        />
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 tabular-nums">
                          Page {marketPage} of {marketTotalPages}
                        </span>
                        <IconButton
                          icon={ChevronRightIcon}
                          label="Next page"
                          variant="secondary"
                          shape="circle"
                          disabled={marketPage >= marketTotalPages}
                          onClick={() =>
                            setMarketPage((page) =>
                              Math.min(marketTotalPages, page + 1),
                            )
                          }
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Everything else, stacked: the gameweek banner, then
                    Your Squad (which carries its own readiness tiles). */}
            <div className="space-y-6 md:space-y-8 min-w-0">
              {/* Slim strip — the page's own title/subtitle are already
                  shown by FantasyLayout's shared hero, so this only adds
                  what that doesn't: gameweek context and the market-closed
                  alert, pinned to its right. Squad readiness now lives
                  inside Your Squad, under its Pitch/List toggle. */}
              <div className="bg-sffl-navy text-white shadow-xl p-4 sm:p-6 md:p-8 flex items-center justify-between gap-3 flex-wrap">
                {scheduledGW ? (
                  <div className="min-w-0">
                    <span className="text-xs font-black px-2.5 py-0.5 bg-sffl-red text-white uppercase tracking-wider inline-block">
                      Gameweek {scheduledGW.number}
                    </span>
                    <p className="text-[11px] text-gray-300 mt-1">
                      Deadline:{" "}
                      {new Date(scheduledGW.deadline).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-300">
                    No upcoming gameweek scheduled.
                  </p>
                )}

                {marketClosed && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300 shrink-0">
                    <LockClosedIcon className="w-4 h-4" aria-hidden="true" />
                    Market closed
                  </span>
                )}
              </div>

              {/* Your Squad */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm min-w-0">
                <div className="p-5 md:p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h2 className="text-lg font-black uppercase tracking-tight text-sffl-navy dark:text-white">
                    Your Squad
                  </h2>
                  <div className="flex items-center gap-3 shrink-0">
                    <Tabs
                      items={[
                        {
                          value: "pitch",
                          label: "Pitch",
                          icon: Squares2X2Icon,
                        },
                        { value: "list", label: "List", icon: ListBulletIcon },
                      ]}
                      value={squadView}
                      onChange={setSquadView}
                      aria-label="Squad view"
                    />
                    <Link
                      to="/fantasy/build"
                      className="inline-flex items-center gap-1 text-xs font-bold text-sffl-red hover:underline shrink-0"
                    >
                      Pick Team
                      <ArrowRightIcon
                        className="w-3.5 h-3.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                </div>

                {/* Readiness rules — one small card per rule, wrapping onto
                    further lines rather than scrolling. Solid green or red
                    fill, not just the text, so met/not-met reads at a
                    glance. */}
                <div className="flex flex-wrap gap-2 p-4 md:p-5 border-b border-gray-200 dark:border-gray-700">
                  {readinessCards.map((card) => {
                    const tone = readinessTone(card.met);
                    return (
                      <div
                        key={card.key}
                        className={`min-w-[92px] px-3.5 py-2.5 text-center border ${tone.box}`}
                      >
                        <span
                          className={`block text-sm font-black tabular-nums ${tone.value}`}
                        >
                          {card.value}
                        </span>
                        <span
                          className={`block text-[10px] mt-0.5 leading-tight ${tone.label}`}
                        >
                          {card.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {mySquad.players.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500 dark:text-gray-400">
                    You haven't signed anyone yet — use Player Selection to get
                    started.
                  </div>
                ) : squadView === "pitch" ? (
                  <div className="p-4 md:p-5 space-y-5">
                    {lineupLoading ? (
                      <Spinner label="Loading your lineup…" className="py-12" />
                    ) : (
                      <FantasyPitch
                        picks={currentLineup?.picks ?? []}
                        mode="display"
                        showPoints={false}
                        title="Your Squad"
                        substitutes={pitchBench}
                        hideDetailStrip
                        onRemovePlayer={
                          mySquad.market_open
                            ? (playerId) => {
                                const player = mySquad.players.find(
                                  (p) => p.player_id === playerId,
                                );
                                if (player) setConfirmSell(player);
                              }
                            : undefined
                        }
                      />
                    )}
                  </div>
                ) : (
                  <div className="p-4 md:p-5 space-y-5">
                    {groupedSquad.map((group) => (
                      <div key={group.label}>
                        <h3 className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          {group.label}{" "}
                          <span className="text-gray-300 dark:text-gray-600 font-bold">
                            ({group.players.length})
                          </span>
                        </h3>
                        {group.players.length === 0 ? (
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-1">
                            No {group.label.toLowerCase()} signed yet.
                          </p>
                        ) : (
                          <div className="divide-y divide-gray-100 dark:divide-gray-700 mt-2">
                            {group.players.map((p) => (
                              <SquadPlayerRow
                                key={p.player_id}
                                player={p}
                                image={
                                  p.image ||
                                  playerMetadataLookup.get(p.player_id)
                                    ?.image ||
                                  undefined
                                }
                                marketOpen={mySquad.market_open}
                                onSell={() => setConfirmSell(p)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────
                SELL CONFIRMATION MODAL
            ────────────────────────────────────────────────────────────────── */}
      {confirmSell && mySquad && (
        <SellConfirmation
          player={confirmSell}
          squad={mySquad}
          pending={sellMutation.isPending}
          onCancel={() => setConfirmSell(null)}
          onConfirm={() => sellMutation.mutate(confirmSell.player_id)}
        />
      )}

      {/* ──────────────────────────────────────────────────────────────────
                EDIT TEAM NAME MODAL
            ────────────────────────────────────────────────────────────────── */}
      {(() => {
        // Falls back to a suggested default when nothing's been typed yet —
        // the same pattern the join-gate form above uses — so the
        // legacy-name auto-prompt (which never pre-fills the field) still
        // shows a sensible starting value instead of an empty box.
        const editNameValue =
          editModalNameInput || getDefaultTeamName(user?.name);
        const trimmedEditName = editNameValue.trim();
        const editNameValid =
          trimmedEditName.length >= 3 && trimmedEditName.length <= 40;

        return (
          <Modal
            open={(showEditNameModal && !seasonHasStarted) || needsLegacyRename}
            shape="square"
            onClose={closeEditNameModal}
            title="Edit Team Name"
            maxWidth="md"
          >
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                Personalize your fantasy squad name. Team names must be unique
                within the season and appear across all leaderboards and match
                day summaries.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editNameValid && !renameMutation.isPending) {
                    renameMutation.mutate(trimmedEditName);
                  }
                }}
                className="space-y-4"
              >
                <Field
                  label="Team Name (3–40 characters)"
                  htmlFor="edit-team-name-modal-input"
                  hint={
                    editNameValid
                      ? `${trimmedEditName.length}/40 characters • Must be unique in this season`
                      : "Must be between 3 and 40 characters."
                  }
                >
                  <Input
                    id="edit-team-name-modal-input"
                    type="text"
                    shape="square"
                    value={editNameValue}
                    onChange={(e) => setEditModalNameInput(e.target.value)}
                    placeholder="Enter unique team name..."
                    maxLength={40}
                    autoFocus
                  />
                </Field>

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                  <Button
                    variant="secondary"
                    shape="square"
                    className="flex-1"
                    onClick={closeEditNameModal}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    shape="square"
                    className="flex-1"
                    loading={renameMutation.isPending}
                    disabled={!editNameValid}
                  >
                    {renameMutation.isPending ? "Saving…" : "Save Name"}
                  </Button>
                </div>
              </form>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

// ─── Market player row (role market + bench market) ─────────────────────────

// The right-hand stat mirrors whichever of Filter 2's options is active —
// the card shows exactly one extra fact about a player, not every fact.
function statForSort(
  sort: MarketSortKey,
  player: FantasyPlayerListItem,
): { label: string; value: string } {
  switch (sort) {
    case "price_desc":
      return { label: "Price", value: formatFantasyPrice(player.price) };
    case "selected":
      return {
        label: "Selected",
        value: `${(player.selected_by_pct ?? 0).toFixed(0)}%`,
      };
    case "points":
    default:
      return {
        label: "Points",
        value: formatStatNumber(Math.round(player.total_points ?? 0)),
      };
  }
}

function MarketPlayerRow({
  player,
  marketSort,
  bank,
  squadFull,
  marketClosed,
  buying,
  onBuy,
}: {
  player: FantasyPlayerListItem;
  marketSort: MarketSortKey;
  bank: number;
  squadFull: boolean;
  marketClosed?: string;
  buying: boolean;
  onBuy: () => void;
}) {
  const affordable = player.price <= bank;
  const stat = statForSort(marketSort, player);

  return (
    <div className="px-3 py-2.5 border flex items-center gap-3 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
      <PlayerAvatar
        name={player.player_name}
        image={player.player_image}
        gender={player.gender}
      />

      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
          {player.player_name}
        </h4>
        <div className="flex items-center gap-1.5 mt-0.5">
          {player.team_logo && (
            <img
              src={player.team_logo}
              alt=""
              className="w-3.5 h-3.5 object-contain shrink-0"
            />
          )}
          <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {player.team_short_name || player.team_name || "—"}
          </span>
          <span className="text-gray-300 dark:text-gray-600 shrink-0">·</span>
          <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 truncate">
            {normalizeFantasyPosition(player.position)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className="text-right">
          <span className="block text-sm font-black tabular-nums text-gray-900 dark:text-white">
            {stat.value}
          </span>
          <span className="block text-[9px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {stat.label}
          </span>
        </div>
        <IconButton
          icon={PlusIcon}
          shape="circle"
          variant="ghost"
          onClick={onBuy}
          disabled={
            !affordable ||
            squadFull ||
            !!marketClosed ||
            buying ||
            player.price <= 0
          }
          label={
            marketClosed
              ? `Cannot sign ${player.player_name}: ${marketClosed}`
              : player.price <= 0
                ? `${player.player_name} is not on the market this season`
                : squadFull
                  ? `Cannot sign ${player.player_name}: your squad is full`
                  : !affordable
                    ? `Cannot sign ${player.player_name}: not enough in the bank`
                    : `Sign ${player.player_name} for ${formatFantasyPrice(player.price)}`
          }
          className="bg-sffl-navy hover:bg-sffl-navy/90 text-white"
        />
      </div>
    </div>
  );
}

// ─── Owned squad row (Your Squad pane) ───────────────────────────────────────

function SquadPlayerRow({
  player,
  image,
  marketOpen,
  onSell,
}: {
  player: SquadPlayer;
  image?: string;
  marketOpen: boolean;
  onSell: () => void;
}) {
  const inactive =
    player.team_active === false ||
    isDeletedPlayer({ status: player.player_status });
  const clubReserve = !inactive && !!player.is_reserve;

  return (
    <div
      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        inactive ? "bg-red-50/40 dark:bg-red-950/20" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={inactive ? "filter grayscale opacity-60" : ""}>
          <PlayerAvatar
            name={player.name}
            image={image}
            gender={player.gender}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className={`text-sm font-bold wrap-break-word ${
                inactive
                  ? "text-gray-500 dark:text-gray-400 line-through"
                  : "text-gray-900 dark:text-white"
              }`}
            >
              {player.name}
            </h3>
            {player.starting && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-sffl-navy/10 text-sffl-navy dark:bg-white/10 dark:text-white border border-sffl-navy/20 dark:border-white/20">
                Starting
              </span>
            )}
            {inactive && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
                Inactive {player.team_active === false ? "Club" : "Player"}
              </span>
            )}
            {clubReserve && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                Club reserve
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {player.club_short_name || player.club_name || "—"} ·{" "}
            {formatFantasyPrice(player.current_price)}
          </p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        shape="square"
        icon={MinusCircleIcon}
        disabled={!marketOpen}
        title={
          !marketOpen
            ? "Selling is paused while the market is closed."
            : undefined
        }
        onClick={onSell}
        className="shrink-0"
      >
        Sell {formatFantasyPrice(player.sell_price)}
      </Button>
    </div>
  );
}

// ─── Sell confirmation dialog ────────────────────────────────────────────────

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
  const have = unit === "offense" ? squad.female_offense : squad.female_defense;
  const need =
    unit === "offense"
      ? squad.rules.min_female_offense
      : squad.rules.min_female_defense;
  const after = have - 1;

  return (
    <Modal
      open
      shape="square"
      onClose={onCancel}
      title={`Sell ${player.name}?`}
      maxWidth="md"
      footer={
        <>
          <Button
            variant="secondary"
            size="lg"
            shape="square"
            className="flex-1"
            disabled={pending}
            onClick={onCancel}
          >
            Keep {player.name.split(" ")[0]}
          </Button>
          <Button
            size="lg"
            shape="square"
            className="flex-1"
            icon={BanknotesIcon}
            loading={pending}
            onClick={onConfirm}
          >
            {pending
              ? "Selling…"
              : `Sell for ${formatFantasyPrice(player.sell_price)}`}
          </Button>
        </>
      }
    >
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          You'll get{" "}
          <span className="font-black text-emerald-600 dark:text-emerald-400">
            {formatFantasyPrice(player.sell_price)}
          </span>{" "}
          back in your bank, and they leave your squad straight away — including
          any lineup they're already in.
        </p>

        {female && (
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="w-4 h-4" /> Mind the female
              quota
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1.5">
              She counts towards your <span className="font-black">{unit}</span>{" "}
              quota. The two quotas are separate — extra women on the other unit
              will not cover this one.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div
                className={`p-2.5 border ${unit === "offense" ? "bg-white dark:bg-gray-800 border-amber-300 dark:border-amber-700" : "bg-amber-100/50 dark:bg-amber-900/20 border-transparent"}`}
              >
                <p className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                  Offense
                </p>
                <p className="font-black text-gray-900 dark:text-white">
                  {squad.female_offense}{" "}
                  <span className="text-gray-400 font-bold">
                    / min {squad.rules.min_female_offense}
                  </span>
                </p>
              </div>
              <div
                className={`p-2.5 border ${unit === "defense" ? "bg-white dark:bg-gray-800 border-amber-300 dark:border-amber-700" : "bg-amber-100/50 dark:bg-amber-900/20 border-transparent"}`}
              >
                <p className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                  Defense
                </p>
                <p className="font-black text-gray-900 dark:text-white">
                  {squad.female_defense}{" "}
                  <span className="text-gray-400 font-bold">
                    / min {squad.rules.min_female_defense}
                  </span>
                </p>
              </div>
            </div>

            <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
              Selling her leaves you{" "}
              <span className="font-black">
                {after} on {unit}
              </span>
              , against a minimum of {need}.
              {player.quota_critical && (
                <span className="font-black">
                  {" "}
                  That is exactly the minimum — you won't be able to sell
                  another woman on that unit, and you'll need to buy one back
                  before you can.
                </span>
              )}
            </p>
          </div>
        )}

        {player.breaks_lineup && (
          <div className="mt-3 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
            <p className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-300 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="w-4 h-4" /> This breaks your
              team sheet
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1.5">
              {squad.squad_size - 1 < squad.squad_min
                ? `You would be down to ${squad.squad_size - 1} players. Under ${squad.squad_min} you cannot field a lineup at all, and you forfeit your points for that match day.`
                : "With them gone you could not put out a legal starting fourteen. You can still sell — but buy a replacement before the deadline or you forfeit the match day."}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
