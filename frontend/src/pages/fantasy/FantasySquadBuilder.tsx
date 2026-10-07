import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { isDeletedPlayer, FemaleIcon, Button, Field, Input, Select, Modal, Spinner, Loader, PlayerAvatar, FantasyBackLink, FantasyPitch } from "../../components";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  UsersIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  RocketLaunchIcon,
  SparklesIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon,
  ArrowUturnDownIcon,
  ArrowUpTrayIcon,
  MinusCircleIcon,
  PlusCircleIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  ClockIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  FireIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";
import type { ComponentType, SVGProps } from "react";
import {
  fantasyApi,
  fantasySeasonApi,
  fantasySquadApi,
  formatFantasyPrice,
} from "../../services/api";
import type { FantasySlot, FantasyPlayerListItem, FantasySeason, Squad, SquadPlayer } from "../../types";
import { formatStatNumber } from "../../utils";
import { useAuth } from "../../contexts";
import { useReserveDrag } from "../../hooks";

const getDefaultTeamName = (userName?: string | null): string => {
  const clean = (userName || "").trim();
  return clean ? `${clean} Team` : "Showtime Team";
};

const getDraftKey = (seasonId?: string, gwId?: string, userId?: string) => {
  if (!seasonId || !gwId) return null;
  return `showtime_fantasy_draft_${seasonId}_${gwId}_${userId || "anon"}`;
};

interface SlotDefinition {
  slot: FantasySlot;
  label: string;
  unit: "OFFENSE" | "DEFENSE";
  /**
   * Positions eligible for this slot. Receiver slots also accept Centers —
   * Center is a real position here and the rating engine scores it with the
   * Receiver formula verbatim.
   */
  allowedPositions: string[];
  requiredGender?: "M" | "F";
}

// An All-Rounder plays anywhere their gender is eligible to play. Mirrors
// domain.SlotSpec.Accepts on the server: the position requirement is waived, the
// gender requirement never is — the female-only slots exist to guarantee women on
// the field, so a male All-Rounder filling one would defeat the rule.
const ALLROUNDER_SPELLINGS = ["ALLROUNDER", "ALL-ROUNDER", "ALL ROUNDER", "AR"];

function isAllrounderPosition(position?: string | null): boolean {
  return ALLROUNDER_SPELLINGS.includes((position || "").trim().toUpperCase());
}

/** Whether a player may occupy a slot, position-wise. Gender is checked separately. */
function positionFitsSlot(
  def: SlotDefinition,
  position?: string | null,
): boolean {
  if (isAllrounderPosition(position)) return true;
  return def.allowedPositions.includes(position || "");
}

const SLOT_DEFINITIONS: SlotDefinition[] = [
  // Offense (7)
  {
    slot: "QB_M",
    label: "Male Starting QB",
    unit: "OFFENSE",
    allowedPositions: ["QB"],
    requiredGender: "M",
  },
  // Takes a QB or a receiver, not a QB alone — mirrors femaleStarterPositions
  // in backend/internal/domain/fantasy.go. The rule exists to put three women
  // on offence, and it does not care which of them throws.
  {
    slot: "QB_F",
    label: "Female QB or Receiver",
    unit: "OFFENSE",
    allowedPositions: ["QB", "Receiver", "Center"],
    requiredGender: "F",
  },
  {
    slot: "REC_1",
    label: "Wide Receiver 1",
    unit: "OFFENSE",
    allowedPositions: ["Receiver", "Center"],
  },
  {
    slot: "REC_2",
    label: "Wide Receiver 2",
    unit: "OFFENSE",
    allowedPositions: ["Receiver", "Center"],
  },
  {
    slot: "REC_3",
    label: "Wide Receiver 3",
    unit: "OFFENSE",
    allowedPositions: ["Receiver", "Center"],
  },
  {
    slot: "REC_4",
    label: "Wide Receiver 4",
    unit: "OFFENSE",
    allowedPositions: ["Receiver", "Center"],
  },
  {
    slot: "REC_5",
    label: "Wide Receiver 5",
    unit: "OFFENSE",
    allowedPositions: ["Receiver", "Center"],
  },
  // Defense (7)
  {
    slot: "RUSHER",
    label: "Pass Rusher",
    unit: "DEFENSE",
    allowedPositions: ["Rusher"],
  },
  {
    slot: "DEF_1",
    label: "Defender 1",
    unit: "DEFENSE",
    allowedPositions: ["Defender"],
  },
  {
    slot: "DEF_2",
    label: "Defender 2",
    unit: "DEFENSE",
    allowedPositions: ["Defender"],
  },
  {
    slot: "DEF_3",
    label: "Defender 3",
    unit: "DEFENSE",
    allowedPositions: ["Defender"],
  },
  {
    slot: "DEF_4",
    label: "Defender 4",
    unit: "DEFENSE",
    allowedPositions: ["Defender"],
  },
  {
    slot: "DEF_5",
    label: "Defender 5",
    unit: "DEFENSE",
    allowedPositions: ["Defender"],
  },
  {
    slot: "DEF_6",
    label: "Defender 6",
    unit: "DEFENSE",
    allowedPositions: ["Defender"],
  },
];

const emptySquad = (): Record<FantasySlot, FantasyPlayerListItem | null> => ({
  QB_M: null,
  QB_F: null,
  REC_1: null,
  REC_2: null,
  REC_3: null,
  REC_4: null,
  REC_5: null,
  RUSHER: null,
  DEF_1: null,
  DEF_2: null,
  DEF_3: null,
  DEF_4: null,
  DEF_5: null,
  DEF_6: null,
});

/** "Receiver" / "Receiver or Center" — reads naturally in the modal caption. */
const formatPositions = (positions: string[]): string =>
  positions.length <= 1
    ? positions[0] || ""
    : `${positions.slice(0, -1).join(", ")} or ${positions[positions.length - 1]}`;

const isFemale = (g?: string): boolean =>
  (g || "").toUpperCase().startsWith("F");

const unitOf = (position: string): "offense" | "defense" =>
  position === "Rusher" || position === "Defender" ? "defense" : "offense";

const MARKET_SORT_OPTIONS: {
  key: "selected" | "price_asc" | "price_desc" | "rating" | "points";
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { key: "selected", label: "Most Owned", icon: FireIcon },
  { key: "price_asc", label: "Lowest Price", icon: ArrowTrendingDownIcon },
  { key: "price_desc", label: "Highest Price", icon: ArrowTrendingUpIcon },
  { key: "rating", label: "Top Rated", icon: StarIcon },
  { key: "points", label: "Most Points", icon: BoltIcon },
];

export function FantasySquadBuilder() {
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

  const scheduledGW =
    gameweeks.find((gw) => gw.status === "SCHEDULED") || gameweeks[0];

  // Current Lineup
  const { data: currentLineup, isLoading: lineupLoading } = useQuery({
    queryKey: ["myFantasyLineup", season?.id, scheduledGW?.id],
    queryFn: () =>
      season?.id && scheduledGW?.id
        ? fantasyApi.getMyLineup(season.id, scheduledGW.id)
        : Promise.resolve(null),
    enabled: !!season?.id && !!scheduledGW?.id,
  });

  // The manager's owned squad. A lineup can only name players they own, so
  // this is the primary source for the picker — the market below it is for
  // filling gaps when the nineteen isn't complete.
  const { data: mySquad } = useQuery({
    queryKey: ["fantasySquad", season?.id],
    queryFn: () => fantasySquadApi.getSquad(season!.id),
    enabled: !!season?.id,
  });

  const refreshSquad = (next: Squad) => {
    queryClient.setQueryData(["fantasySquad", season?.id], next);
    queryClient.invalidateQueries({ queryKey: ["fantasyDashboard"] });
    queryClient.invalidateQueries({ queryKey: ["fantasyLineup"] });
  };

  // Every club with a player on the market this season, for the team filter
  // chip in the pickers below. A wide, unfiltered pull rather than a
  // dedicated endpoint — the market list already carries the club on every
  // row, so this reuses it instead of adding a new one.
  const { data: allMarketPlayers } = useQuery({
    queryKey: ["playerMarketAllTeams", season?.id],
    queryFn: () => fantasyApi.listPlayerMarket(season!.id, { limit: 500 }),
    enabled: !!season?.id,
    staleTime: 5 * 60 * 1000,
  });
  const marketTeams = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const p of allMarketPlayers?.data ?? []) {
      if (p.team_id && !byId.has(p.team_id)) {
        byId.set(p.team_id, {
          id: p.team_id,
          name: p.team_short_name || p.team_name || "—",
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [allMarketPlayers]);
  const marketPositions = useMemo(() => {
    const positions = new Set<string>();
    for (const p of allMarketPlayers?.data ?? []) {
      if (p.position) positions.add(p.position);
    }
    return Array.from(positions).sort();
  }, [allMarketPlayers]);

  // Player metadata cache ensuring photos and team info are never dropped across transfers/bench
  const playerMetadataLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        image: string;
        team_name: string;
        team_short_name: string;
        team_logo: string;
      }
    >();
    for (const p of allMarketPlayers?.data ?? []) {
      if (p.player_id) {
        map.set(p.player_id, {
          image: p.player_image || "",
          team_name: p.team_name || "",
          team_short_name: p.team_short_name || "",
          team_logo: p.team_logo || "",
        });
      }
    }
    for (const p of mySquad?.players ?? []) {
      if (p.player_id) {
        const existing = map.get(p.player_id);
        map.set(p.player_id, {
          image: p.image || existing?.image || "",
          team_name: p.club_name || existing?.team_name || "",
          team_short_name: p.club_short_name || existing?.team_short_name || "",
          team_logo: p.club_logo || existing?.team_logo || "",
        });
      }
    }
    for (const p of currentLineup?.picks ?? []) {
      if (p.player_id) {
        const existing = map.get(p.player_id);
        map.set(p.player_id, {
          image: p.player_image || existing?.image || "",
          team_name: p.team_name || existing?.team_name || "",
          team_short_name: p.team_short_name || existing?.team_short_name || "",
          team_logo: p.team_logo || existing?.team_logo || "",
        });
      }
    }
    return map;
  }, [allMarketPlayers, mySquad, currentLineup]);

  // Local squad state: slot -> FantasyPlayerListItem
  const [squad, setSquad] =
    useState<Record<FantasySlot, FantasyPlayerListItem | null>>(emptySquad);

  const [teamName, setTeamName] = useState(() =>
    getDefaultTeamName(user?.name),
  );
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editModalNameInput, setEditModalNameInput] = useState("");
  const [joinTeamNameInput, setJoinTeamNameInput] = useState("");
  const [selectedUnitTab, setSelectedUnitTab] = useState<
    "ALL" | "OFFENSE" | "DEFENSE"
  >("ALL");
  const [activeModalSlot, setActiveModalSlot] = useState<SlotDefinition | null>(
    null,
  );
  const [marketSearch, setMarketSearch] = useState("");
  // Opens on price, not ownership. Ownership only separates players once
  // squads exist — before that every player ties on 0 owned and the list
  // falls through to alphabetical, which buries the players worth picking.
  const [marketSort, setMarketSort] = useState<
    "selected" | "price_asc" | "price_desc" | "rating" | "points"
  >("price_desc");
  // Team filter, shared by the slot and bench pickers — only one is ever open
  // at a time. A slot's position/gender are fixed by the slot itself; team is
  // the one axis a manager still wants to narrow by.
  const [marketTeamFilter, setMarketTeamFilter] = useState("");
  const [marketGenderFilter, setMarketGenderFilter] = useState<"" | "F" | "M">(
    "",
  );
  // Role filter for the bench picker only — a slot already fixes position.
  const [benchPositionFilter, setBenchPositionFilter] = useState("");
  // Player action popover: which slot's player is showing actions
  const [actionSlot, setActionSlot] = useState<FantasySlot | null>(null);
  // Sell confirmation dialog
  const [confirmSell, setConfirmSell] = useState<SquadPlayer | null>(null);
  // When selling from the starting 14: open market after sell completes
  const [pendingTransferOutSlot, setPendingTransferOutSlot] =
    useState<SlotDefinition | null>(null);
  // Market browser for bench signing
  const [showBenchMarket, setShowBenchMarket] = useState(false);
  // Rule violation modal dialog
  const [violationModal, setViolationModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const hydratedGameweekIdRef = useRef<string | null>(null);

  // Pre-populate from the local working draft or saved lineup, once per gameweek.
  useEffect(() => {
    const gameweekId = scheduledGW?.id;
    if (!gameweekId || lineupLoading) return;
    if (hydratedGameweekIdRef.current === gameweekId) return;

    const isGameweekSwitch = hydratedGameweekIdRef.current !== null;
    hydratedGameweekIdRef.current = gameweekId;

    const draftKey = getDraftKey(season?.id, gameweekId, user?.id);
    let restoredFromDraft = false;

    if (draftKey && !isGameweekSwitch) {
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft && draft.squad) {
            const ownedSet = new Set(
              (mySquad?.players ?? []).map((p) => p.player_id),
            );
            const nextSquad = emptySquad();
            let count = 0;
            for (const def of SLOT_DEFINITIONS) {
              const p = draft.squad[def.slot];
              // Player must be owned (if mySquad is loaded)
              if (p && (!mySquad || ownedSet.has(p.player_id))) {
                const meta = playerMetadataLookup.get(p.player_id);
                nextSquad[def.slot] = {
                  ...p,
                  player_image: p.player_image || meta?.image || "",
                  team_name: p.team_name || meta?.team_name || "",
                  team_short_name:
                    p.team_short_name || meta?.team_short_name || "",
                  team_logo: p.team_logo || meta?.team_logo || "",
                };
                count++;
              }
            }
            if (count > 0) {
              setSquad(nextSquad);
              if (draft.teamName) setTeamName(draft.teamName);
              restoredFromDraft = true;
              persistSquad(nextSquad);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (!restoredFromDraft) {
      if (!currentLineup) {
        if (isGameweekSwitch) {
          setTeamName(
            dashboard?.team?.name && dashboard.team.name !== "My Showtime Stars"
              ? dashboard.team.name
              : getDefaultTeamName(user?.name),
          );
          setSquad(emptySquad());
        }
        return;
      }

      const resolvedName =
        currentLineup.team_name &&
        currentLineup.team_name !== "My Showtime Stars"
          ? currentLineup.team_name
          : dashboard?.team?.name && dashboard.team.name !== "My Showtime Stars"
            ? dashboard.team.name
            : getDefaultTeamName(user?.name);
      setTeamName(resolvedName);
      setSquad((prev) => {
        const next = isGameweekSwitch ? emptySquad() : { ...prev };
        const ownedSet = new Set(
          (mySquad?.players ?? []).map((p) => p.player_id),
        );
        currentLineup.picks.forEach((p) => {
          if (mySquad && !ownedSet.has(p.player_id)) return;
          const meta = playerMetadataLookup.get(p.player_id);
          next[p.slot] = {
            player_id: p.player_id,
            player_name: p.player_name || "Unknown Player",
            player_image: p.player_image || meta?.image || "",
            position: p.position || "",
            gender: p.gender || "M",
            team_id: p.team_id || "",
            team_name: p.team_name || meta?.team_name || "",
            team_short_name: p.team_short_name || meta?.team_short_name || "",
            team_logo: p.team_logo || meta?.team_logo || "",
            price: p.purchase_price || 0,
            rating: 5,
            total_points: p.points || 0,
            owned_by: 0,
            selected_by_pct: 0,
            transfers_in: 0,
            transfers_out: 0,
          };
        });
        return next;
      });
    }
  }, [
    currentLineup,
    scheduledGW?.id,
    lineupLoading,
    dashboard?.team?.name,
    user?.name,
    season?.id,
    user?.id,
    mySquad,
    playerMetadataLookup,
  ]);

  // Cleanup: immediately evict any player from the active starting berth who was
  // sold or is no longer owned. Computed from the current `squad` and saved
  // outside setSquad on purpose — React invokes a functional updater twice
  // under StrictMode, which would fire two saves for the same eviction (see
  // commitSquad).
  useEffect(() => {
    if (!mySquad?.players) return;
    const ownedSet = new Set(mySquad.players.map((p) => p.player_id));
    let changed = false;
    const next = { ...squad };
    for (const def of SLOT_DEFINITIONS) {
      if (next[def.slot] && !ownedSet.has(next[def.slot]!.player_id)) {
        next[def.slot] = null;
        changed = true;
      }
    }
    if (changed) {
      setSquad(next);
      persistSquad(next);
    }
  }, [mySquad, squad]);

  // Keep team name in sync with dashboard or user profile if unset/default
  useEffect(() => {
    if (dashboard?.team?.name && dashboard.team.name !== "My Showtime Stars") {
      setTeamName(dashboard.team.name);
    } else if (
      user?.name &&
      (!teamName ||
        teamName === "Showtime Team" ||
        teamName === "My Showtime Stars")
    ) {
      setTeamName(getDefaultTeamName(user.name));
    }
  }, [dashboard?.team?.name, user?.name]);

  // If an entered manager still has legacy "My Showtime Stars", prompt them to name their team
  useEffect(() => {
    if (
      hasJoined &&
      (dashboard?.team?.name === "My Showtime Stars" ||
        currentLineup?.team_name === "My Showtime Stars")
    ) {
      setEditModalNameInput(getDefaultTeamName(user?.name));
      setShowEditNameModal(true);
    }
  }, [hasJoined, dashboard?.team?.name, currentLineup?.team_name, user?.name]);

  // Player Market Query for Active Modal Slot
  const { data: marketData, isLoading: marketLoading } = useQuery({
    queryKey: [
      "playerMarket",
      season?.id,
      activeModalSlot?.allowedPositions,
      activeModalSlot?.requiredGender,
      marketSearch,
      marketSort,
      marketTeamFilter,
      marketGenderFilter,
    ],
    queryFn: () => {
      if (!season?.id || !activeModalSlot)
        return Promise.resolve({
          data: [],
          total: 0,
          total_pages: 0,
          my_rank: 0,
        });
      const resolvedGender =
        activeModalSlot.requiredGender ||
        (marketGenderFilter ? (marketGenderFilter as "M" | "F") : undefined);

      return fantasyApi.listPlayerMarket(season.id, {
        // Every eligible position, not just the first: a receiver slot
        // takes Receivers and Centers, and sending only "Receiver"
        // silently hid every Center from the market. This is fixed by
        // the slot, applied the instant the modal opens — not
        // something the manager sets, since the slot already answers it.
        position: activeModalSlot.allowedPositions.join(","),
        gender: resolvedGender,
        team_id: marketTeamFilter || undefined,
        search: marketSearch,
        sort: marketSort,
        limit: 100,
      });
    },
    enabled: !!season?.id && !!activeModalSlot,
  });

  // Market for bench signings — all positions unless narrowed by the role filter
  const { data: benchMarketData, isLoading: benchMarketLoading } = useQuery({
    queryKey: [
      "benchMarket",
      season?.id,
      marketSearch,
      marketSort,
      marketTeamFilter,
      benchPositionFilter,
      marketGenderFilter,
    ],
    queryFn: () => {
      if (!season?.id)
        return Promise.resolve({
          data: [],
          total: 0,
          total_pages: 0,
          my_rank: 0,
        });
      return fantasyApi.listPlayerMarket(season.id, {
        position: benchPositionFilter || undefined,
        gender: marketGenderFilter
          ? (marketGenderFilter as "M" | "F")
          : undefined,
        team_id: marketTeamFilter || undefined,
        search: marketSearch,
        sort: marketSort,
        limit: 100,
      });
    },
    enabled: !!season?.id && showBenchMarket,
  });

  // Helper to look up a player's real name and slot across starting squad, bench, and market
  const getPlayerFriendlyInfo = (
    id: string,
  ): { name: string; slotLabel?: string } | null => {
    // 1. Check current starting slots
    for (const def of SLOT_DEFINITIONS) {
      const p = squad[def.slot];
      if (p && p.player_id === id) {
        return { name: p.player_name, slotLabel: def.label };
      }
    }
    // 2. Check mySquad owned players
    if (mySquad?.players) {
      const sp = mySquad.players.find((p) => p.player_id === id);
      if (sp) {
        return { name: sp.name };
      }
    }
    // 3. Check current lineup picks
    if (currentLineup?.picks) {
      const cp = currentLineup.picks.find((p) => p.player_id === id);
      if (cp) {
        const slotDef = SLOT_DEFINITIONS.find((d) => d.slot === cp.slot);
        return { name: cp.player_name || "Player", slotLabel: slotDef?.label };
      }
    }
    // 4. Check market players (all market cache, or current filtered page)
    const amp = allMarketPlayers?.data?.find((p) => p.player_id === id);
    if (amp) {
      return { name: amp.player_name };
    }
    const mp = marketData?.data?.find((p) => p.player_id === id);
    if (mp) {
      return { name: mp.player_name };
    }
    const bp = benchMarketData?.data?.find((p) => p.player_id === id);
    if (bp) {
      return { name: bp.player_name };
    }
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
      if (info) {
        if (info.slotLabel) {
          return `${info.name} (${info.slotLabel}) is not eligible to play because the player or their team is inactive. Please replace them.`;
        }
        return `${info.name} is not eligible to play because the player or their team is inactive. Please replace them.`;
      }
      return "One of your selected players is not eligible to play because they or their team is inactive. Please replace them in your lineup.";
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

  // Buying from inside the picker, for a squad that has no one for this slot.
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

  // Selling a player from the squad
  const sellMutation = useMutation({
    mutationFn: (playerId: string) =>
      fantasySquadApi.sellPlayer(season!.id, playerId),
    onSuccess: (next) => {
      refreshSquad(next);
      setConfirmSell(null);
      toast.success("Sold — the money is back in your bank.");

      // If this was a "Transfer Out" from a starting slot, the starter only
      // leaves the slot now that the sale has gone through, then the market
      // opens for a replacement.
      if (pendingTransferOutSlot) {
        const soldSlot = pendingTransferOutSlot.slot;
        commitSquad((prev) => ({ ...prev, [soldSlot]: null }));
        setActiveModalSlot(pendingTransferOutSlot);
        setPendingTransferOutSlot(null);
      }
    },
    onError: (err: unknown) => {
      toast.error(formatErrorMessage(err, "Could not sell this player."));
    },
  });

  // Calculations & Invariant Validations
  const calculations = useMemo(() => {
    let totalSpent = 0;
    let filledCount = 0;
    let offenseFemales = 0;
    let defenseFemales = 0;
    let defenseAllrounders = 0;
    const clubCounts: Record<string, number> = {};
    const chosenPlayerIds = new Set<string>();

    SLOT_DEFINITIONS.forEach((def) => {
      const player = squad[def.slot];
      if (player) {
        totalSpent += player.price;
        filledCount++;
        chosenPlayerIds.add(player.player_id);

        const isFem = (player.gender || "").toUpperCase() === "F";
        if (def.unit === "OFFENSE" && isFem) offenseFemales++;
        if (def.unit === "DEFENSE" && isFem) defenseFemales++;

        if (def.unit === "DEFENSE" && isAllrounderPosition(player.position)) {
          defenseAllrounders++;
        }

        if (player.team_id) {
          clubCounts[player.team_id] = (clubCounts[player.team_id] || 0) + 1;
        }
      }
    });

    // The thresholds are season configuration, so they are read out here
    // rather than written into the copy — a season with different minimums
    // must not be described by hardcoded numbers.
    //
    // The spending ceiling is not the season's starting budget — it's
    // everything currently available: unspent cash plus the market value
    // of every player owned (mirrors mySquad.bank + mySquad.squad_value).
    // A manager who buys low and sells high can field a starting fourteen
    // worth more than the season started with, which the server allows —
    // it never re-checks budget at lineup time, only at purchase (see the
    // comment on ValidateLineup in fantasy.go). Comparing against the
    // fixed season budget here would falsely block publishing a lineup
    // that was paid for entirely out of legitimately earned profit.
    const budget = mySquad
      ? mySquad.bank + mySquad.squad_value
      : season?.budget || 230;
    const minFemaleOffense = season?.min_female_offense || 3;
    const minFemaleDefense = season?.min_female_defense || 3;
    const maxPerClub = season?.max_per_club || 3;

    const budgetValid = totalSpent <= budget;
    const slotsFilled = filledCount === 14;
    const offenseFemalesValid = offenseFemales >= minFemaleOffense;
    const defenseFemalesValid = defenseFemales >= minFemaleDefense;
    const defenseAllroundersValid = defenseAllrounders <= 1;

    const clubLimitValid = !Object.values(clubCounts).some(
      (count) => count > maxPerClub,
    );

    let hasInactiveStartingPlayer = false;
    for (const def of SLOT_DEFINITIONS) {
      const p = squad[def.slot];
      if (!p) continue;

      if (mySquad?.players) {
        const squadMember = mySquad.players.find(
          (sp) => sp.player_id === p.player_id,
        );
        if (
          !squadMember ||
          squadMember.team_active === false ||
          isDeletedPlayer({ status: squadMember.player_status }) ||
          squadMember.is_reserve
        ) {
          hasInactiveStartingPlayer = true;
          break;
        }
      }
    }
    const clubsActiveValid = !hasInactiveStartingPlayer;

    // The two rules the server enforces that nothing here was mirroring. The
    // picker should make both unreachable — it only offers eligible players
    // and clears a player from their old slot on re-pick — but "should" is
    // doing real work in that sentence. A stale client, or a player's
    // position or gender edited between picking and publishing, lands here.
    // Without these the checklist would read all-green while the save was
    // rejected, which is worse than either failing alone.
    //
    // Duplicate *slot* needs no check: `squad` is keyed by slot, so a slot
    // physically cannot hold two players.
    const duplicatePlayerValid = chosenPlayerIds.size === filledCount;

    let ineligibleSlot: string | null = null;
    for (const def of SLOT_DEFINITIONS) {
      const player = squad[def.slot];
      if (!player) continue;
      const positionOK = positionFitsSlot(def, player.position);
      const genderOK =
        !def.requiredGender ||
        (player.gender || "").toUpperCase() === def.requiredGender;
      if (!positionOK || !genderOK) {
        ineligibleSlot = def.label;
        break;
      }
    }
    const slotEligibilityValid = ineligibleSlot === null;

    const isValid =
      slotsFilled &&
      offenseFemalesValid &&
      defenseFemalesValid &&
      clubLimitValid &&
      clubsActiveValid &&
      duplicatePlayerValid &&
      slotEligibilityValid &&
      defenseAllroundersValid;

    return {
      totalSpent,
      remainingBudget: budget - totalSpent,
      filledCount,
      offenseFemales,
      defenseFemales,
      defenseAllrounders,
      defenseAllroundersValid,
      clubCounts,
      chosenPlayerIds,
      budget,
      minFemaleOffense,
      minFemaleDefense,
      maxPerClub,
      budgetValid,
      slotsFilled,
      offenseFemalesValid,
      defenseFemalesValid,
      clubLimitValid,
      clubsActiveValid,
      hasInactiveStartingPlayer,
      duplicatePlayerValid,
      slotEligibilityValid,
      ineligibleSlot,
      isValid,
    };
  }, [squad, season, mySquad]);

  // Every rule standing between this sheet and the scoring run, pass or fail,
  // recomputed on each pick. Shown in full rather than failures-only: while
  // building a squad, knowing which rules you have already satisfied is as
  // useful as knowing which you have not.
  //
  // Derived from the same `calculations` the Publish button is disabled by,
  // so the list can never disagree with the button beside it.
  const publishChecks = useMemo(
    () => [
      {
        ok: calculations.slotsFilled,
        label: "All 14 slots filled",
        detail: `${calculations.filledCount} of 14`,
      },
      {
        ok: calculations.offenseFemalesValid,
        label: `Offence has ${calculations.minFemaleOffense} women`,
        detail: `${calculations.offenseFemales} of ${calculations.minFemaleOffense}`,
      },
      {
        ok: calculations.defenseFemalesValid,
        label: `Defence has ${calculations.minFemaleDefense} women`,
        detail: `${calculations.defenseFemales} of ${calculations.minFemaleDefense}`,
      },
      {
        ok: calculations.defenseAllroundersValid,
        label: "Max 1 All-Rounder in defence",
        detail: calculations.defenseAllroundersValid
          ? `${calculations.defenseAllrounders} of 1`
          : `${calculations.defenseAllrounders} selected (max 1)`,
      },
      {
        ok: calculations.clubLimitValid,
        label: `No more than ${calculations.maxPerClub} from one club`,
        detail: calculations.clubLimitValid ? "OK" : "Exceeded",
      },
      {
        ok: calculations.clubsActiveValid,
        label: "Every starter can start (no inactive or club-reserve players)",
        detail: calculations.clubsActiveValid ? "OK" : "Bench or replace them",
      },
      {
        ok: calculations.duplicatePlayerValid,
        label: "No player in two slots",
        detail: calculations.duplicatePlayerValid
          ? "OK"
          : "Someone is doubled up",
      },
      {
        ok: calculations.slotEligibilityValid,
        label: "Every player suits their slot",
        detail: calculations.slotEligibilityValid
          ? "OK"
          : `${calculations.ineligibleSlot} is mismatched`,
      },
    ],
    [calculations],
  );

  const passedChecks = publishChecks.filter((c) => c.ok).length;

  // Who is actually on the pitch right now, in this editing session — not
  // who the server last had starting. Squad picks and Start promotions only
  // ever touch local `squad` state until Save Lineup is clicked, so this is
  // the only source that agrees with what the slots grid is showing.
  const startingPlayerIds = useMemo(
    () =>
      new Set(
        Object.values(squad)
          .filter((p): p is FantasyPlayerListItem => p !== null)
          .map((p) => p.player_id),
      ),
    [squad],
  );

  // Bench / reserve players: owned, and not currently placed in a slot.
  //
  // This used to filter on `p.starting` — the server's last-saved lineup —
  // so a player picked into the 14 stayed listed on the bench until Save was
  // clicked (a visible "duplicate"), and promoting one via Start left their
  // bench row in place with its Start button still live, since neither
  // reflected the local draft. Keying off `startingPlayerIds` instead means
  // the bench row disappears the moment a player is placed, matching what
  // the slots grid already shows.
  const benchPlayers = useMemo(() => {
    if (!mySquad) return [];
    return mySquad.players.filter((p) => !startingPlayerIds.has(p.player_id));
  }, [mySquad, startingPlayerIds]);

  // Already filtered by position and gender server-side.
  const marketPlayers = useMemo(() => marketData?.data ?? [], [marketData]);

  // Split the picker in two: who the manager already owns and can field right
  // away, and who they would have to buy first. Owned players come first
  // because fielding one costs nothing and is almost always the intent.
  const ownedForSlot = useMemo(() => {
    if (!activeModalSlot || !mySquad) return [];
    return mySquad.players
      .filter((p) => positionFitsSlot(activeModalSlot, p.position))
      .filter(
        (p) =>
          !activeModalSlot.requiredGender ||
          (p.gender || "M")
            .toUpperCase()
            .startsWith(activeModalSlot.requiredGender),
      )
      .filter((p) => {
        if (activeModalSlot.requiredGender) return true;
        if (!marketGenderFilter) return true;
        return (p.gender || "M").toUpperCase().startsWith(marketGenderFilter);
      })
      .filter((p) => !marketTeamFilter || p.club_id === marketTeamFilter)
      .filter(
        (p) =>
          !marketSearch ||
          p.name.toLowerCase().includes(marketSearch.toLowerCase()),
      );
  }, [
    activeModalSlot,
    mySquad,
    marketSearch,
    marketTeamFilter,
    marketGenderFilter,
  ]);

  const ownedIds = useMemo(
    () => new Set((mySquad?.players ?? []).map((p) => p.player_id)),
    [mySquad],
  );

  // Anyone already owned is shown in the section above, so the market half
  // lists only players who would need signing and have a valid market price.
  const buyablePlayers = useMemo(
    () =>
      marketPlayers.filter((p) => !ownedIds.has(p.player_id) && p.price > 0),
    [marketPlayers, ownedIds],
  );

  // Bench market: anyone not already owned with valid market price
  const buyableBenchPlayers = useMemo(
    () =>
      (benchMarketData?.data ?? []).filter(
        (p) => !ownedIds.has(p.player_id) && p.price > 0,
      ),
    [benchMarketData, ownedIds],
  );

  const renameMutation = useMutation({
    mutationFn: async (newName: string) => {
      if (!season?.id) throw new Error("Season not loaded");
      const clean = newName.trim();
      if (clean.length < 3 || clean.length > 40) {
        throw new Error("Team name must be between 3 and 40 characters.");
      }
      return fantasySeasonApi.enterSeason(season.id, clean);
    },
    onSuccess: (updatedTeam) => {
      setTeamName(updatedTeam.name);
      setShowEditNameModal(false);
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
    onSuccess: (createdTeam) => {
      setTeamName(createdTeam.name);
      toast.success("You're in! Welcome to Showtime Fantasy.");
      queryClient.invalidateQueries({ queryKey: ["fantasyDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["myFantasyLineup"] });
    },
    onError: (err: unknown) => {
      toast.error(formatErrorMessage(err, "Failed to join season"));
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({
      picks,
      publish,
    }: {
      picks: { player_id: string; slot: FantasySlot }[];
      publish: boolean;
    }) => {
      if (!season || !scheduledGW)
        throw new Error("No active season or scheduled gameweek");
      return fantasyApi.saveLineup({
        season_id: season.id,
        gameweek_id: scheduledGW.id,
        team_name: teamName.trim() || getDefaultTeamName(user?.name),
        picks,
        publish,
      });
    },
    onSuccess: (res, vars) => {
      // The server is the authority on what was stored, so its response
      // seeds the cache directly rather than being re-fetched.
      queryClient.setQueryData(
        ["myFantasyLineup", season?.id, scheduledGW?.id],
        res,
      );
      queryClient.invalidateQueries({ queryKey: ["fantasyDashboard"] });
      if (vars.publish && res.published) {
        toast.success(
          "Lineup published — it starts earning points this match day.",
        );
        const draftKey = getDraftKey(season?.id, scheduledGW?.id, user?.id);
        if (draftKey) {
          try {
            localStorage.removeItem(draftKey);
          } catch {
            // ignore
          }
        }
      }
    },
    onError: (err: unknown) => {
      // An autosave failure has to be loud: the manager would otherwise
      // carry on picking against a sheet the server never received.
      const formatted = formatErrorMessage(
        err,
        "Couldn't save that pick — check your connection.",
      );
      toast.error(formatted);
      queryClient.invalidateQueries({ queryKey: ["myFantasyLineup"] });
    },
  });

  // Persisting the sheet. Whatever slots are filled are stored, so this is
  // safe to call after every pick — but it never starts scoring on its own.
  // Only `publish` does that, and only the manager sets it.
  const persistSquad = (
    next: Record<FantasySlot, FantasyPlayerListItem | null>,
    opts?: { publish?: boolean },
  ) => {
    if (!season || !scheduledGW) return;
    const picks = SLOT_DEFINITIONS.filter((def) => next[def.slot]).map(
      (def) => ({ player_id: next[def.slot]!.player_id, slot: def.slot }),
    );
    saveMutation.mutate({ picks, publish: opts?.publish ?? false });
  };

  // Whether the sheet on the server is live. Held by the server rather than
  // inferred locally, so a published lineup still reads as published after a
  // reload, and an edit that breaks it reads as unpublished straight away.
  const isPublished = currentLineup?.published ?? false;

  // Applies a change to the sheet and saves it in the same step, so the two
  // can never drift apart — every path that edits the fourteen goes through
  // here rather than calling setSquad directly.
  // The save runs outside the state updater on purpose: React invokes an
  // updater twice under StrictMode, which would fire two saves per pick.
  // Helper to validate whether placing a player into a starting slot violates
  // any lineup or squad rules. Returns an object with valid: boolean, title, and error.
  const validateProposedStartingMove = (
    currentSquad: Record<FantasySlot, FantasyPlayerListItem | null>,
    targetSlot: SlotDefinition,
    candidate:
      | FantasyPlayerListItem
      | SquadPlayer
      | {
          player_id: string;
          name?: string;
          player_name?: string;
          position: string;
          gender: string;
          team_id?: string;
          club_id?: string;
          team_name?: string;
          club_name?: string;
          price?: number;
          purchase_price?: number;
          team_active?: boolean;
          player_status?: string;
        },
    opts?: {
      season?: FantasySeason | null;
      mySquad?: Squad | null;
      isBuying?: boolean;
    },
  ): { valid: boolean; title?: string; error?: string } => {
    const candidateId = candidate.player_id;
    const candidateName =
      "player_name" in candidate && candidate.player_name
        ? candidate.player_name
        : "name" in candidate && candidate.name
          ? candidate.name
          : "This player";
    const candidatePos = candidate.position;
    const candidateGender = candidate.gender || "M";
    const candidateClubId =
      "team_id" in candidate && candidate.team_id
        ? candidate.team_id
        : "club_id" in candidate && candidate.club_id
          ? candidate.club_id
          : "";
    const candidateClubName =
      "team_name" in candidate && candidate.team_name
        ? candidate.team_name
        : "club_name" in candidate && candidate.club_name
          ? candidate.club_name
          : "";
    const candidatePrice =
      "price" in candidate && typeof candidate.price === "number"
        ? candidate.price
        : "purchase_price" in candidate &&
            typeof candidate.purchase_price === "number"
          ? candidate.purchase_price
          : 0;
    const teamActive =
      "team_active" in candidate ? candidate.team_active : true;
    const playerStatus =
      "player_status" in candidate ? candidate.player_status : undefined;
    const isClubReserve =
      "is_reserve" in candidate ? !!candidate.is_reserve : false;

    // 1. Inactive Club or Deleted Player Check
    if (teamActive === false) {
      return {
        valid: false,
        title: "Inactive Club",
        error: `${candidateName}'s club is currently inactive in the league.`,
      };
    }
    if (isDeletedPlayer({ status: playerStatus })) {
      return {
        valid: false,
        title: "Player Unavailable",
        error: `${candidateName} is no longer available in the league.`,
      };
    }
    if (isClubReserve) {
      return {
        valid: false,
        title: "Club Reserve",
        error: `${candidateName} is on their club's reserve list — they can sit on your bench but cannot start.`,
      };
    }

    // 2. Slot Position Compatibility
    if (!positionFitsSlot(targetSlot, candidatePos)) {
      return {
        valid: false,
        title: "Invalid Position",
        error: `${candidateName} plays ${candidatePos}, which does not match slot ${targetSlot.label} (${targetSlot.allowedPositions.join("/")}).`,
      };
    }

    // 3. Slot Gender Requirement
    if (
      targetSlot.requiredGender &&
      !candidateGender.toUpperCase().startsWith(targetSlot.requiredGender)
    ) {
      return {
        valid: false,
        title: "Gender Requirement",
        error: `Slot ${targetSlot.label} requires a ${targetSlot.requiredGender === "F" ? "Female" : "Male"} player.`,
      };
    }

    // 4. Duplicate Player Check (cannot start in two slots)
    const existingSlotEntry = Object.entries(currentSquad).find(
      ([slotKey, p]) =>
        p?.player_id === candidateId && slotKey !== targetSlot.slot,
    );
    if (existingSlotEntry) {
      const existingDef = SLOT_DEFINITIONS.find(
        (def) => def.slot === existingSlotEntry[0],
      );
      return {
        valid: false,
        title: "Player Already Selected",
        error: `${candidateName} is already selected in slot ${existingDef?.label || existingSlotEntry[0]}.`,
      };
    }

    // 5. Defense All-Rounder Restriction: max 1 in defense unit
    if (targetSlot.unit === "DEFENSE" && isAllrounderPosition(candidatePos)) {
      const otherDefAllrounders = SLOT_DEFINITIONS.filter(
        (d) => d.unit === "DEFENSE" && d.slot !== targetSlot.slot,
      ).filter((d) => {
        const p = currentSquad[d.slot];
        return (
          p && p.player_id !== candidateId && isAllrounderPosition(p.position)
        );
      }).length;

      if (otherDefAllrounders >= 1) {
        return {
          valid: false,
          title: "Defense All-Rounder Limit",
          error: "You can only have a maximum of 1 All-Rounder in defence.",
        };
      }
    }

    // 6. Max Players Per Club
    const maxPerClub = opts?.season?.max_per_club || 3;
    if (candidateClubId) {
      let clubCount = 0;
      for (const def of SLOT_DEFINITIONS) {
        if (def.slot === targetSlot.slot) continue;
        const p = currentSquad[def.slot];
        if (!p || p.player_id === candidateId) continue;
        if (p.team_id === candidateClubId) {
          clubCount++;
        }
      }
      if (clubCount + 1 > maxPerClub) {
        return {
          valid: false,
          title: "Club Quota Exceeded",
          error: `You cannot select more than ${maxPerClub} players from ${candidateClubName || "the same club"} in your starting 14.`,
        };
      }
    }

    // 7. Purchase-specific validations
    if (opts?.isBuying) {
      const maxSquadSize = opts?.season?.squad_size || 18;
      if (opts?.mySquad && opts.mySquad.players.length >= maxSquadSize) {
        return {
          valid: false,
          title: "Squad Full",
          error: `Your squad is full (${maxSquadSize} players). Sell a player before signing a new one.`,
        };
      }
      const bank = opts?.mySquad?.bank ?? 0;
      if (candidatePrice > bank) {
        return {
          valid: false,
          title: "Insufficient Budget",
          error: `Signing ${candidateName} costs ₦${candidatePrice.toFixed(1)}m, but your remaining bank budget is ₦${bank.toFixed(1)}m.`,
        };
      }
    }

    // 8. Feasibility of Female Requirements
    const minFemale =
      targetSlot.unit === "OFFENSE"
        ? (opts?.season?.min_female_offense ?? 3)
        : (opts?.season?.min_female_defense ?? 3);

    const unitSlots = SLOT_DEFINITIONS.filter(
      (d) => d.unit === targetSlot.unit,
    );
    let currentFemalesInOtherSlots = 0;
    let emptyOtherSlots = 0;

    for (const def of unitSlots) {
      if (def.slot === targetSlot.slot) continue;
      const p = currentSquad[def.slot];
      if (p) {
        if (p.player_id === candidateId) continue;
        if (isFemale(p.gender)) {
          currentFemalesInOtherSlots++;
        }
      } else {
        emptyOtherSlots++;
      }
    }

    const candidateIsFemale = isFemale(candidateGender);
    const totalPotentialFemales =
      currentFemalesInOtherSlots +
      (candidateIsFemale ? 1 : 0) +
      emptyOtherSlots;

    if (totalPotentialFemales < minFemale) {
      return {
        valid: false,
        title: "Female Quota Violation",
        error: `Placing a male player in ${targetSlot.label} leaves only ${totalPotentialFemales} possible female athletes in ${targetSlot.unit.toLowerCase()}, but at least ${minFemale} are required.`,
      };
    }

    return { valid: true };
  };

  // Applies a change to the sheet and saves it in the same step, so the two
  // can never drift apart — every path that edits the fourteen goes through
  // here rather than calling setSquad directly.
  // Also saves to localStorage working draft for immediate persistence across reloads.
  const commitSquad = (
    update: (
      prev: Record<FantasySlot, FantasyPlayerListItem | null>,
    ) => Record<FantasySlot, FantasyPlayerListItem | null>,
  ) => {
    const next = update(squad);
    setSquad(next);

    const draftKey = getDraftKey(season?.id, scheduledGW?.id, user?.id);
    if (draftKey) {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ squad: next, teamName }),
        );
      } catch (err) {
        console.warn("Failed to write lineup draft to localStorage:", err);
      }
    }

    persistSquad(next);
  };

  const handleSelectPlayer = (player: FantasyPlayerListItem) => {
    if (!activeModalSlot) return;

    // Reject move before placement if any squad rule is violated
    const validation = validateProposedStartingMove(
      squad,
      activeModalSlot,
      player,
      {
        season,
        mySquad,
        isBuying: false,
      },
    );

    if (!validation.valid) {
      setViolationModal({
        title: validation.title || "Selection Blocked",
        message: validation.error || "This move violates squad rules.",
      });
      toast.error(validation.error || "This move violates squad rules.");
      return;
    }

    // Enrich player metadata so images and logos are preserved
    const meta = playerMetadataLookup.get(player.player_id);
    const enrichedPlayer: FantasyPlayerListItem = {
      ...player,
      player_image: player.player_image || meta?.image || "",
      team_name: player.team_name || meta?.team_name || "",
      team_short_name: player.team_short_name || meta?.team_short_name || "",
      team_logo: player.team_logo || meta?.team_logo || "",
    };

    // The pick is saved the moment it is made, and it stays in the slot it
    // was put in — it is not parked on the bench waiting for a later save.
    commitSquad((prev) => ({
      ...prev,
      [activeModalSlot.slot]: enrichedPlayer,
    }));
    setActiveModalSlot(null);
    setMarketTeamFilter("");
    setMarketGenderFilter("");
  };

  // "Move to Bench" — remove from starting slot
  const handleMoveToBench = (slot: FantasySlot) => {
    commitSquad((prev) => ({
      ...prev,
      [slot]: null,
    }));
    setActionSlot(null);
    toast.success("Moved to bench.");
  };

  // Drag-and-drop on the pitch: move a starter into an empty slot, or swap two starters.
  const handleSwapSlots = (from: FantasySlot, to: FantasySlot) => {
    if (from === to) return;
    const a = squad[from];
    const b = squad[to];
    const fromDef = SLOT_DEFINITIONS.find((d) => d.slot === from);
    const toDef = SLOT_DEFINITIONS.find((d) => d.slot === to);
    if (!a || !fromDef || !toDef) return;

    // Validate with both slots lifted out, so nobody is "already selected"
    // in the slot they are leaving.
    const base: Record<FantasySlot, FantasyPlayerListItem | null> = {
      ...squad,
      [from]: null,
      [to]: null,
    };
    const opts = { season, mySquad, isBuying: false };

    let result = validateProposedStartingMove(base, toDef, a, opts);
    if (result.valid && b) {
      result = validateProposedStartingMove(
        { ...base, [to]: a },
        fromDef,
        b,
        opts,
      );
    }

    if (!result.valid) {
      const message = result.error || "This move violates squad rules.";
      setViolationModal({ title: result.title || "Move Blocked", message });
      toast.error(message);
      return;
    }

    commitSquad((prev) => ({ ...prev, [to]: a, [from]: b }));
    setActionSlot(null);
    toast.success(
      b
        ? `Swapped ${a.player_name} and ${b.player_name}.`
        : `${a.player_name} moved to ${toDef.label}.`,
    );
  };

  // "Swap with Reserve" — open the slot's picker (owned players first)
  const handleSwapWithReserve = (slot: FantasySlot) => {
    setActionSlot(null);
    const def = SLOT_DEFINITIONS.find((d) => d.slot === slot);
    if (def) setActiveModalSlot(def);
  };

  // "Transfer Out" — sell the player, then open market for replacement
  const handleTransferOut = (slot: FantasySlot) => {
    setActionSlot(null);
    const player = squad[slot];
    if (!player || !mySquad) return;

    // Find the squad player entry for sell confirmation
    const squadPlayer = mySquad.players.find(
      (p) => p.player_id === player.player_id,
    );
    if (!squadPlayer) {
      toast.error("Could not find this player in your squad.");
      return;
    }

    // The slot is not cleared here: if the manager cancels the sale, the
    // starter must stay where they are. The sell mutation clears it on success.

    // Set the pending transfer out slot so the market opens after sell
    const def = SLOT_DEFINITIONS.find((d) => d.slot === slot);
    if (def) setPendingTransferOutSlot(def);

    setConfirmSell(squadPlayer);
  };

  // "Start" — promote a bench reserve into an open matching slot
  const handleStartReserve = (reservePlayer: SquadPlayer) => {
    // Club reserves and inactive players may sit on the bench but never start.
    if (
      reservePlayer.is_reserve ||
      reservePlayer.team_active === false ||
      isDeletedPlayer({ status: reservePlayer.player_status })
    ) {
      toast.error(`${reservePlayer.name} can sit on the bench but cannot start.`);
      return;
    }

    // Find all empty slots that match position
    const eligibleSlots = SLOT_DEFINITIONS.filter((def) => {
      if (squad[def.slot] !== null) return false;
      return positionFitsSlot(def, reservePlayer.position);
    });

    if (eligibleSlots.length === 0) {
      setViolationModal({
        title: "No Open Slot",
        message: `No empty starting slot accepts a ${reservePlayer.position}. Remove or bench a starter first.`,
      });
      toast.error(
        `No open slot matches ${reservePlayer.position}. Remove a starter first.`,
      );
      return;
    }

    // Find first slot that satisfies all squad & lineup rules
    let validSlot: SlotDefinition | null = null;
    let lastViolation: { title?: string; error?: string } | null = null;

    for (const slotDef of eligibleSlots) {
      const validation = validateProposedStartingMove(
        squad,
        slotDef,
        reservePlayer,
        {
          season,
          mySquad,
          isBuying: false,
        },
      );
      if (validation.valid) {
        validSlot = slotDef;
        break;
      } else {
        lastViolation = validation;
      }
    }

    if (!validSlot) {
      setViolationModal({
        title: lastViolation?.title || "Cannot Start Reserve",
        message:
          lastViolation?.error ||
          `Starting ${reservePlayer.name} violates lineup rules in available open slots.`,
      });
      toast.error(
        lastViolation?.error ||
          "Cannot start player: rule violation in available slots.",
      );
      return;
    }

    // Preserve player image and club details
    const meta = playerMetadataLookup.get(reservePlayer.player_id);
    const enrichedPlayer: FantasyPlayerListItem = {
      player_id: reservePlayer.player_id,
      player_name: reservePlayer.name,
      player_image: reservePlayer.image || meta?.image || "",
      position: reservePlayer.position,
      gender: reservePlayer.gender,
      team_id: reservePlayer.club_id,
      team_name: reservePlayer.club_name || meta?.team_name || "",
      team_short_name:
        reservePlayer.club_short_name || meta?.team_short_name || "",
      team_logo: reservePlayer.club_logo || meta?.team_logo || "",
      price: reservePlayer.purchase_price,
      rating: 0,
      total_points: 0,
      owned_by: 0,
      selected_by_pct: 0,
      transfers_in: 0,
      transfers_out: 0,
    };

    commitSquad((prev) => ({
      ...prev,
      [validSlot!.slot]: enrichedPlayer,
    }));
    toast.success(`${reservePlayer.name} promoted to ${validSlot.label}.`);
  };

  // Builds the pitch's player shape from an owned reserve.
  const reserveToStarter = (r: SquadPlayer): FantasyPlayerListItem => {
    const meta = playerMetadataLookup.get(r.player_id);
    return {
      player_id: r.player_id,
      player_name: r.name,
      player_image: r.image || meta?.image || "",
      position: r.position,
      gender: r.gender,
      team_id: r.club_id,
      team_name: r.club_name || meta?.team_name || "",
      team_short_name: r.club_short_name || meta?.team_short_name || "",
      team_logo: r.club_logo || meta?.team_logo || "",
      price: r.purchase_price,
      rating: 0,
      total_points: 0,
      owned_by: 0,
      selected_by_pct: 0,
      transfers_in: 0,
      transfers_out: 0,
    };
  };

  // Drag a reserve onto a slot: empty = start them there, filled = swap
  // (the displaced starter simply returns to the bench).
  const handleReserveDrop = (playerId: string, slot: FantasySlot) => {
    const reserve = mySquad?.players.find((p) => p.player_id === playerId);
    const toDef = SLOT_DEFINITIONS.find((d) => d.slot === slot);
    if (!reserve || !toDef) return;

    const displaced = squad[slot];
    // Validate with the target slot emptied, so the starter being replaced
    // doesn't count against the club limit, quotas or All-Rounder cap.
    const result = validateProposedStartingMove(
      { ...squad, [slot]: null },
      toDef,
      reserve,
      { season, mySquad, isBuying: false },
    );

    if (!result.valid) {
      const message = result.error || "This move violates squad rules.";
      setViolationModal({ title: result.title || "Move Blocked", message });
      toast.error(message);
      return;
    }

    commitSquad((prev) => ({ ...prev, [slot]: reserveToStarter(reserve) }));
    setActionSlot(null);
    toast.success(
      displaced
        ? `${reserve.name} replaces ${displaced.player_name}.`
        : `${reserve.name} promoted to ${toDef.label}.`,
    );
  };

  const { drag: reserveDrag, startDrag: startReserveDrag } =
    useReserveDrag(handleReserveDrop);

  // Market closed detection
  const marketClosed =
    mySquad && !mySquad.market_open
      ? mySquad.market_closed_reason ||
        "The transfer market is closed while a match day is being played."
      : undefined;

  if (
    authLoading ||
    seasonLoading ||
    gwLoading ||
    lineupLoading ||
    enteredLoading
  ) {
    return <Loader />;
  }

  // Building a squad without having joined would only fail at save time,
  // after picking all 14 players. Say so up front instead.
  if (hasJoined === false) {
    const initialDefault = joinTeamNameInput || getDefaultTeamName(user?.name);
    const trimmedJoin = initialDefault.trim();
    const joinValid = trimmedJoin.length >= 3 && trimmedJoin.length <= 40;

    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl md:rounded-3xl shadow-2xl p-6 md:p-10 max-w-lg w-full">
          <div className="w-14 h-14 rounded-2xl bg-sffl-red/10 dark:bg-sffl-red/20 flex items-center justify-center text-sffl-red mb-5">
            <SparklesIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tight uppercase text-sffl-navy dark:text-white">
            Name Your Fantasy Team
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm leading-relaxed">
            Welcome to Showtime Fantasy! Choose a unique name for your squad to
            enter the season and start drafting your 14 players.
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
                value={joinTeamNameInput || initialDefault}
                onChange={(e) => setJoinTeamNameInput(e.target.value)}
                placeholder="e.g. Lagos Blitz"
                maxLength={40}
              />
            </Field>

            <Button
              type="submit"
              size="lg"
              fullWidth
              variant="primary"
              disabled={!joinValid}
              loading={joinMutation.isPending}
              icon={RocketLaunchIcon}
              iconPosition="right"
            >
              {joinMutation.isPending ? "Entering Season…" : "Confirm Name & Start Building"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (!season || !scheduledGW) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
          <ExclamationCircleIcon className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black uppercase text-sffl-navy dark:text-white mb-2">
          No Gameweek Open for Submissions
        </h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
          Upcoming fixtures are being scheduled. Please check back shortly!
        </p>
      </div>
    );
  }

  // Signing from the picker puts them in the squad, then straight into the
  // slot the manager opened — one action, not two.
  const buyAndSelect = async (p: FantasyPlayerListItem) => {
    if (!activeModalSlot) return;

    // Validate proposed move before spending transfer budget!
    const validation = validateProposedStartingMove(squad, activeModalSlot, p, {
      season,
      mySquad,
      isBuying: true,
    });

    if (!validation.valid) {
      setViolationModal({
        title: validation.title || "Signing Blocked",
        message: validation.error || "Cannot sign and field this player.",
      });
      toast.error(validation.error || "Cannot sign and field this player.");
      return;
    }

    try {
      await buyMutation.mutateAsync(p.player_id);
      handleSelectPlayer(p);
    } catch {
      // The mutation already surfaced the reason.
    }
  };

  // Signing for the bench (no slot assignment)
  const buyForBench = async (playerId: string) => {
    try {
      await buyMutation.mutateAsync(playerId);
      setShowBenchMarket(false);
      setMarketSearch("");
      setMarketTeamFilter("");
      setBenchPositionFilter("");
      setMarketGenderFilter("");
    } catch {
      // The mutation already surfaced the reason.
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <FantasyBackLink to="/fantasy/dashboard" label="Back to Dashboard" />
      {/* Header Showtime Navy Banner */}
      <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-4 sm:p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black px-2.5 py-0.5 rounded bg-sffl-red text-white uppercase tracking-wider">
                Gameweek {scheduledGW.number}
              </span>
              <span className="text-xs text-gray-300 font-medium">
                Lock Deadline: {new Date(scheduledGW.deadline).toLocaleString()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black italic tracking-tighter uppercase mt-2">
              My Team &amp; Transfers
            </h1>
            <p className="text-gray-300 mt-1 text-xs md:text-sm font-medium">
              Manage your starting 14, bench depth, and transfer market signings
              in one place.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-[11px] font-black uppercase text-gray-300 tracking-wider">
                Team:
              </span>
              <span className="min-w-0 wrap-break-word text-base sm:text-2xl font-black italic tracking-tight text-white uppercase drop-shadow-sm">
                {teamName || getDefaultTeamName(user?.name)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={PencilSquareIcon}
                onClick={() => {
                  setEditModalNameInput(
                    teamName || getDefaultTeamName(user?.name),
                  );
                  setShowEditNameModal(true);
                }}
              >
                Edit Name
              </Button>
            </div>
          </div>

          {/* Live/draft state at a glance. The action that changes it
                        lives at the foot of the fourteen, where the lineup it
                        publishes actually is. */}
          <div className="flex items-center gap-2 shrink-0" aria-live="polite">
            {saveMutation.isPending ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/70 text-[11px] font-bold">
                <ArrowPathIcon
                  className="w-3.5 h-3.5 animate-spin"
                  aria-hidden="true"
                />
                Saving…
              </span>
            ) : isPublished ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[11px] font-black uppercase tracking-wider">
                <CheckCircleIcon className="w-3.5 h-3.5" />
                Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-200 text-[11px] font-black uppercase tracking-wider">
                <ClockIcon className="w-3.5 h-3.5" />
                Draft — not scoring
              </span>
            )}
          </div>
        </div>

        {/* Market Closed Alert */}
        {marketClosed && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-400/15 border border-amber-400/30 p-3">
            <LockClosedIcon className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                Market closed
              </p>
              <p className="text-[11px] text-amber-100/90 mt-0.5">
                {marketClosed} You can still rearrange your lineup, but buys and
                sells are paused.
              </p>
            </div>
          </div>
        )}

        {/* Rollover Alert Strip */}
        {currentLineup?.is_rollover && (
          <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 shrink-0 text-amber-300" />
            <span>
              <strong>Lineup Rollover Active:</strong> Loaded from your previous
              match day. You can save updates now, or let it accumulate points
              automatically!
            </span>
          </div>
        )}

        {/* Financial Strip */}
        {mySquad && (
          <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3 sm:p-4 bg-white/10 rounded-xl min-w-0">
              <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
                In the bank
              </span>
              <span className="text-xl sm:text-2xl md:text-3xl break-all font-black text-yellow-400">
                {formatFantasyPrice(mySquad.bank)}
              </span>
              <span className="text-[11px] text-gray-300 block mt-0.5 font-medium">
                Liquid transfer cash
              </span>
            </div>
            <div className="p-3 sm:p-4 bg-white/10 rounded-xl min-w-0">
              <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
                Squad value
              </span>
              <span className="text-xl sm:text-2xl md:text-3xl break-all font-black text-emerald-400">
                {formatFantasyPrice(mySquad.squad_value)}
              </span>
              <span className="text-[11px] text-gray-300 block mt-0.5 font-medium">
                Current market worth
              </span>
            </div>
            <div className="p-3 sm:p-4 bg-white/10 rounded-xl min-w-0">
              <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
                Club value
              </span>
              <span className="text-xl sm:text-2xl md:text-3xl break-all font-black text-white">
                {formatFantasyPrice(mySquad.bank + mySquad.squad_value)}
              </span>
              <span className="text-[11px] text-gray-300 block mt-0.5 font-medium">
                Total club assets
              </span>
            </div>
            <div className="p-3 sm:p-4 bg-white/10 rounded-xl min-w-0">
              <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
                Starting 14
              </span>
              <span className="text-xl sm:text-2xl md:text-3xl break-all font-black text-white">
                {calculations.filledCount}
                <span className="text-sm text-gray-300 font-bold"> / 14</span>
              </span>
              <span className="text-[11px] text-gray-300 block mt-0.5 font-medium">
                Starters selected
              </span>
            </div>
            <div className="p-3 sm:p-4 bg-white/10 rounded-xl min-w-0">
              <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
                Bench / Reserves
              </span>
              <span className="text-xl sm:text-2xl md:text-3xl break-all font-black text-white">
                {benchPlayers.length}
                <span className="text-sm text-gray-300 font-bold">
                  {" "}
                  / {(mySquad.squad_max || 19) - 14}
                </span>
              </span>
              <span className="text-[11px] text-gray-300 block mt-0.5 font-medium">
                Squad depth
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Invariant Validation Strips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Starters */}
        <div
          className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between ${
            calculations.slotsFilled
              ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
          }`}
        >
          <div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 block uppercase font-bold">
              Starters
            </span>
            <span className="font-black text-base md:text-lg">
              {calculations.filledCount} / 14
            </span>
          </div>
          {calculations.slotsFilled ? (
            <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
          ) : (
            <ExclamationCircleIcon className="w-5 h-5 text-amber-500" />
          )}
        </div>

        {/* Offense Females */}
        <div
          className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between ${
            calculations.offenseFemalesValid
              ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
          }`}
        >
          <div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 block uppercase font-bold">
              <span className="inline-flex items-center gap-0.5">
                Offense
                <FemaleIcon
                  className="w-3 h-3"
                  strokeWidth={2.5}
                  aria-label="women"
                />
                (Min 3)
              </span>
            </span>
            <span className="font-black text-base md:text-lg">
              {calculations.offenseFemales} / 3
            </span>
          </div>
          {calculations.offenseFemalesValid ? (
            <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
          ) : (
            <ExclamationCircleIcon className="w-5 h-5 text-red-500" />
          )}
        </div>

        {/* Defense Females */}
        <div
          className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between ${
            calculations.defenseFemalesValid
              ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
          }`}
        >
          <div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 block uppercase font-bold">
              <span className="inline-flex items-center gap-0.5">
                Defense
                <FemaleIcon
                  className="w-3 h-3"
                  strokeWidth={2.5}
                  aria-label="women"
                />
                (Min 3)
              </span>
            </span>
            <span className="font-black text-base md:text-lg">
              {calculations.defenseFemales} / 3
            </span>
          </div>
          {calculations.defenseFemalesValid ? (
            <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
          ) : (
            <ExclamationCircleIcon className="w-5 h-5 text-red-500" />
          )}
        </div>

        {/* Club Limit */}
        <div
          className={`p-3.5 rounded-xl border shadow-sm col-span-2 sm:col-span-1 flex items-center justify-between ${
            calculations.clubLimitValid
              ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
          }`}
        >
          <div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 block uppercase font-bold">
              Max 3 / Club
            </span>
            <span className="font-black text-base md:text-lg">
              {calculations.clubLimitValid ? "Compliant" : "Exceeded"}
            </span>
          </div>
          {calculations.clubLimitValid ? (
            <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
          ) : (
            <ExclamationCircleIcon className="w-5 h-5 text-red-500" />
          )}
        </div>
      </div>

      {/* Inactive Club Warning Banner */}
      {calculations.hasInactiveStartingPlayer && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-between gap-3 text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <ExclamationCircleIcon className="w-5 h-5 shrink-0 text-sffl-red" />
            <span>
              One or more starting players belong to an inactive club. You must
              transfer them out before saving your lineup.
            </span>
          </div>
        </div>
      )}

      {/* Starting 14 Tactical Pitch View */}
      <div>
        <FantasyPitch
          squad={squad}
          mode="builder"
          title="Starting 14 Lineup"
          onSwapSlots={handleSwapSlots}
          selectedUnitTab={selectedUnitTab}
          reserveDragActive={!!reserveDrag}
          dropHighlightSlot={reserveDrag?.over ?? null}
          onUnitTabChange={setSelectedUnitTab}
          actionSlot={actionSlot}
          onSlotClick={(slot, player) => {
            if (player) {
              // 1-A: If clicking an inactive/invalid starter, directly open replacement picker
              if (player.isInvalid) {
                const def = SLOT_DEFINITIONS.find((d) => d.slot === slot);
                if (def) {
                  setActionSlot(null);
                  setActiveModalSlot(def);
                  return;
                }
              }
              setActionSlot(actionSlot === slot ? null : slot);
            } else {
              const def = SLOT_DEFINITIONS.find((d) => d.slot === slot);
              if (def) setActiveModalSlot(def);
            }
          }}
          isSlotInvalid={(slot) => {
            const player = squad[slot];
            if (!player) return false;

            if (mySquad?.players) {
              const squadMember = mySquad.players.find(
                (sp) => sp.player_id === player.player_id,
              );
              if (!squadMember) {
                return { invalid: true, reason: "Not Owned" };
              }
              if (squadMember.team_active === false) {
                return { invalid: true, reason: "Club Inactive" };
              }
              if (isDeletedPlayer({ status: squadMember.player_status })) {
                return { invalid: true, reason: "Unavailable" };
              }
              if (squadMember.is_reserve) {
                return { invalid: true, reason: "Club reserve" };
              }
            }

            return false;
          }}
          isSlotInactive={(slot) => {
            const player = squad[slot];
            if (!player) return false;
            const squadMember = mySquad?.players?.find(
              (sp) => sp.player_id === player.player_id,
            );
            return squadMember?.team_active === false;
          }}
          isSlotDeleted={(slot) => {
            const player = squad[slot];
            if (!player) return false;
            const squadMember = mySquad?.players?.find(
              (sp) => sp.player_id === player.player_id,
            );
            return isDeletedPlayer({ status: squadMember?.player_status });
          }}
        />
      </div>

      {/* Action Dialog Modal for occupied slot */}
      <Modal
        open={!!(actionSlot && squad[actionSlot])}
        onClose={() => setActionSlot(null)}
        title="Manage starter"
        maxWidth="md"
      >
        {actionSlot && squad[actionSlot] && (
          <div className="text-gray-900 dark:text-white -m-4 sm:-m-6">
            {/* Player summary */}
            <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar
                  name={squad[actionSlot]!.player_name}
                  image={squad[actionSlot]!.player_image}
                  gender={squad[actionSlot]!.gender}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                      {actionSlot}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      {
                        SLOT_DEFINITIONS.find((d) => d.slot === actionSlot)
                          ?.label
                      }
                    </span>
                  </div>
                  <h3 className="text-base font-black truncate text-gray-900 dark:text-white mt-0.5">
                    {squad[actionSlot]!.player_name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {squad[actionSlot]!.team_short_name ||
                      squad[actionSlot]!.team_name}{" "}
                    • {formatFantasyPrice(squad[actionSlot]!.price)}
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-4 space-y-2">
              <button
                type="button"
                onClick={() => handleSwapWithReserve(actionSlot)}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition cursor-pointer text-left"
              >
                <div className="p-2.5 rounded-xl bg-sffl-navy/10 dark:bg-white/10 text-sffl-navy dark:text-white">
                  <ArrowsRightLeftIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-black text-gray-900 dark:text-white block">
                    Swap with Reserve
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    Replace with an eligible bench player
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTransferOut(actionSlot)}
                disabled={!!marketClosed}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/40 text-sffl-red">
                  <ArrowUpTrayIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-black text-sffl-red block">
                    Transfer Out
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    {marketClosed
                      ? "Unavailable while the market is closed"
                      : "Sell back to market & sign replacement"}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleMoveToBench(actionSlot)}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition cursor-pointer text-left"
              >
                <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <ArrowUturnDownIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-black text-gray-900 dark:text-white block">
                    Move to Bench
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    Remove from starting 14 without selling
                  </span>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setActionSlot(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────
                PUBLISH PANEL

                Sits at the foot of the fourteen because that is the lineup it
                publishes — and it is where a manager arrives once the last slot
                is filled. Picks are already saved by the time they get here, so
                this is not a save button: it is the deliberate act that puts the
                squad into the scoring run, and the one place the rules blocking
                that are spelled out.
            ────────────────────────────────────────────────────────────────── */}
      <div
        className={`rounded-2xl md:rounded-3xl border shadow-sm overflow-hidden ${
          isPublished
            ? "bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800"
            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
        }`}
      >
        <div className="p-5 md:p-6 flex flex-col lg:flex-row lg:items-center gap-5 justify-between">
          <div className="min-w-0">
            {isPublished ? (
              <>
                <h2 className="text-sm font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircleIcon className="w-4.5 h-4.5" />
                  Lineup published
                </h2>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-200/70 mt-1 max-w-prose">
                  This squad is live and earning points. It stays that way — you
                  only need to publish again if you change it.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                  <RocketLaunchIcon className="w-4.5 h-4.5 text-sffl-red" />
                  Publish your lineup
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-prose">
                  Your picks are saved as you make them, but they don't score
                  until you publish. Publish once and it stays live until you
                  change it.
                </p>
              </>
            )}
          </div>

          <Button
            size="lg"
            variant={isPublished ? "success" : "primary"}
            className="w-full lg:w-auto shrink-0"
            disabled={!calculations.isValid}
            loading={saveMutation.isPending}
            icon={RocketLaunchIcon}
            onClick={() => persistSquad(squad, { publish: true })}
          >
            {isPublished
              ? "Republish changes"
              : `Publish Lineup (${calculations.filledCount}/14)`}
          </Button>
        </div>

        {/* The requirements, live, directly under the button that is
                    gated on them — so a manager can watch each one turn as they
                    pick rather than guessing why Publish is still greyed out. */}
        <div
          className={`border-t px-5 md:px-6 py-4 ${
            isPublished
              ? "border-emerald-200/70 dark:border-emerald-800/70 bg-emerald-100/30 dark:bg-emerald-900/10"
              : "border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30"
          }`}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Publishing requirements
            </span>
            <span
              className={`text-[10px] font-black uppercase tracking-wider tabular-nums ${
                calculations.isValid
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {passedChecks} / {publishChecks.length} met
            </span>
          </div>

          {/* aria-live so the state change is announced, not just seen. */}
          <ul
            className="grid sm:grid-cols-2 gap-x-6 gap-y-2"
            aria-live="polite"
          >
            {publishChecks.map((check) => (
              <li
                key={check.label}
                className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 transition-colors ${
                  check.ok
                    ? "text-gray-600 dark:text-gray-300"
                    : "text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30"
                }`}
              >
                {check.ok ? (
                  <CheckCircleIcon className="w-4 h-4 shrink-0 text-emerald-500" />
                ) : (
                  <ExclamationCircleIcon className="w-4 h-4 shrink-0 text-amber-500" />
                )}
                <span
                  className={`min-w-0 flex-1 ${check.ok ? "" : "font-bold"}`}
                >
                  {check.label}
                </span>
                <span
                  className={`shrink-0 tabular-nums text-[11px] font-black ${
                    check.ok
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {check.detail}
                </span>
                <span className="sr-only">
                  {check.ok ? " — met" : " — not yet met"}
                </span>
              </li>
            ))}
          </ul>

          {/* The server decides what is publishable, not this list. The
                        checks above are a local preview that exists so feedback is
                        instant; they mirror the rules rather than being them. When
                        the two disagree the server is right, so its own words are
                        shown instead of leaving a manager staring at a full set of
                        ticks and a sheet that will not publish. */}
          {calculations.isValid && currentLineup?.blocking_reason && (
            <p className="mt-3 flex items-start gap-2 text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2.5 py-2">
              <ExclamationCircleIcon className="w-4 h-4 shrink-0 text-amber-500 mt-px" />
              <span>{currentLineup.blocking_reason}</span>
            </p>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
                BENCH / RESERVES SECTION
            ────────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-sffl-red" />
              Substitutes & Reserves
              <span className="text-gray-400 font-bold">
                ({benchPlayers.length})
              </span>
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Score nothing until promoted to the starting 14. Drag a reserve
              onto the pitch to start them (hold first on touch).
            </p>
          </div>
          {mySquad &&
            mySquad.squad_size < mySquad.squad_max &&
            !marketClosed && (
              <Button
                size="sm"
                icon={PlusCircleIcon}
                onClick={() => {
                  setShowBenchMarket(true);
                  setMarketSearch("");
                }}
              >
                Add Reserve
              </Button>
            )}
        </div>

        {benchPlayers.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500 dark:text-gray-400">
            No reserves. Your squad only has the starting 14.
            {mySquad &&
              mySquad.squad_size < mySquad.squad_max &&
              !marketClosed && (
                <Button
                  variant="link"
                  size="sm"
                  className="ml-2"
                  icon={ArrowRightIcon}
                  iconPosition="right"
                  onClick={() => {
                    setShowBenchMarket(true);
                    setMarketSearch("");
                  }}
                >
                  Sign bench depth
                </Button>
              )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {benchPlayers.map((p) => {
              const isReserveAllrounder = isAllrounderPosition(p.position);
              const isReserveInactive =
                p.team_active === false ||
                isDeletedPlayer({ status: p.player_status });
              // On the club's reserve list: fine on this bench, can't start.
              const isClubReserve = !isReserveInactive && !!p.is_reserve;
              // Can this reserve be promoted into an open matching slot?
              const hasOpenSlot =
                !isReserveInactive &&
                !isClubReserve &&
                SLOT_DEFINITIONS.some((def) => {
                  if (squad[def.slot] !== null) return false;
                  if (!positionFitsSlot(def, p.position)) return false;
                  if (
                    def.requiredGender &&
                    !p.gender.toUpperCase().startsWith(def.requiredGender)
                  )
                    return false;
                  if (
                    def.unit === "DEFENSE" &&
                    isReserveAllrounder &&
                    calculations.defenseAllrounders >= 1
                  )
                    return false;
                  return true;
                });

              return (
                <div
                  key={p.player_id}
                  onPointerDown={
                    isReserveInactive
                      ? undefined
                      : (e) => startReserveDrag(e, p.player_id)
                  }
                  onDragStart={(e) => e.preventDefault()}
                  onContextMenu={(e) => {
                    if (!isReserveInactive) e.preventDefault();
                  }}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition select-none [-webkit-touch-callout:none] ${
                    isReserveInactive
                      ? "bg-red-50/40 dark:bg-red-950/20 opacity-80"
                      : reserveDrag?.playerId === p.player_id
                        ? "opacity-40"
                        : "cursor-grab"
                  }`}
                >
                  <div
                    className={`relative ${isReserveInactive ? "filter grayscale opacity-60" : ""}`}
                  >
                    <PlayerAvatar
                      name={p.name}
                      image={
                        p.image ||
                        playerMetadataLookup.get(p.player_id)?.image ||
                        undefined
                      }
                      gender={p.gender}
                    />
                    {isReserveInactive && (
                      <span
                        aria-hidden="true"
                        title="Inactive player"
                        className="absolute -top-1 -left-1 z-10 flex items-center justify-center w-4 h-4 rounded-full border-2 border-white shadow bg-red-600 text-white"
                      >
                        <ExclamationTriangleIcon className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`text-sm font-bold wrap-break-word ${
                          isReserveInactive
                            ? "text-gray-500 dark:text-gray-400 line-through"
                            : "text-gray-900 dark:text-white"
                        }`}
                      >
                        {p.name}
                      </h3>
                      {isReserveInactive && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
                          Inactive {p.team_active === false ? "Club" : "Player"}
                        </span>
                      )}
                      {isClubReserve && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                          Club reserve
                        </span>
                      )}
                    </div>
                    {isFemale(p.gender) && !isReserveInactive && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                          {unitOf(p.position)} quota
                        </span>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {p.position} · {formatFantasyPrice(p.purchase_price)}
                      {(p.current_price ?? 0) !== p.purchase_price && (
                        <span
                          className={
                            (p.current_price ?? 0) > p.purchase_price
                              ? " text-emerald-600 dark:text-emerald-400 font-bold"
                              : " text-red-600 dark:text-red-400 font-bold"
                          }
                        >
                          {" "}
                          · now {formatFantasyPrice(p.current_price)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    {isReserveInactive || isClubReserve ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled
                        title={
                          isClubReserve
                            ? "On their club's reserve list — can sit on the bench but not start"
                            : "Cannot start an inactive or deleted player"
                        }
                      >
                        {isClubReserve ? "Bench only" : "Inactive"}
                      </Button>
                    ) : (
                      hasOpenSlot && (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleStartReserve(p)}
                        >
                          Start
                        </Button>
                      )
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={MinusCircleIcon}
                      disabled={!!marketClosed}
                      onClick={() => setConfirmSell(p)}
                    >
                      Sell {formatFantasyPrice(p.sell_price)}
                    </Button>
                    {marketClosed && (
                      <span className="w-full text-[10px] text-gray-500 dark:text-gray-400">
                        Selling is paused while the market is closed.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────
                PLAYER SELECTION MODAL (For starting 14 slots)
            ────────────────────────────────────────────────────────────────── */}
      {activeModalSlot && (
        <Modal
          open
          onClose={() => {
            setActiveModalSlot(null);
            setMarketTeamFilter("");
            setMarketGenderFilter("");
          }}
          title={activeModalSlot.label}
          subtitle={`Selecting for ${activeModalSlot.slot}`}
          maxWidth="2xl"
        >
          {/* Slot rules and funds */}
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
              {formatPositions(activeModalSlot.allowedPositions)}
            </span>
            {activeModalSlot.requiredGender && (
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${
                  activeModalSlot.requiredGender === "F"
                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                    : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                }`}
              >
                {activeModalSlot.requiredGender === "F"
                  ? "Women only"
                  : "Men only"}
              </span>
            )}
            {/* Liquid transfer funds available for signing players */}
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              {formatFantasyPrice(mySquad?.bank ?? 0)} in bank
            </span>
          </div>

            {/* Search Bar & Sort Filters */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 space-y-2.5">
              <div className="flex flex-col min-[400px]:flex-row gap-2">
                <div className="relative flex-1 min-w-0">
                  <Input
                    id="slot-player-search"
                    type="text"
                    icon={MagnifyingGlassIcon}
                    value={marketSearch}
                    onChange={(e) => setMarketSearch(e.target.value)}
                    placeholder="Search by player name..."
                    aria-label="Search by player name"
                  />
                </div>
                <Select
                  id="slot-team-filter"
                  value={marketTeamFilter}
                  onChange={(e) => setMarketTeamFilter(e.target.value)}
                  aria-label="Filter by team"
                  className="w-full min-[400px]:w-auto min-[400px]:max-w-38 shrink-0"
                >
                  <option value="">All teams</option>
                  {marketTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <Select
                  id="slot-gender-filter"
                  value={activeModalSlot.requiredGender || marketGenderFilter}
                  disabled={!!activeModalSlot.requiredGender}
                  onChange={(e) =>
                    setMarketGenderFilter(e.target.value as "" | "F" | "M")
                  }
                  aria-label="Filter by gender"
                  className="w-full min-[400px]:w-auto min-[400px]:max-w-34 shrink-0"
                >
                  {activeModalSlot.requiredGender ? (
                    <option value={activeModalSlot.requiredGender}>
                      {activeModalSlot.requiredGender === "F"
                        ? "Women only"
                        : "Men only"}
                    </option>
                  ) : (
                    <>
                      <option value="">All genders</option>
                      <option value="F">Women</option>
                      <option value="M">Men</option>
                    </>
                  )}
                </Select>
              </div>

              {/* Sort Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0 mr-1">
                  Sort:
                </span>
                {MARKET_SORT_OPTIONS.map((opt) => (
                  <Button
                    key={opt.key}
                    size="sm"
                    variant={marketSort === opt.key ? "navy" : "secondary"}
                    className="shrink-0"
                    icon={opt.icon}
                    aria-pressed={marketSort === opt.key}
                    onClick={() => setMarketSort(opt.key)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Player Market List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {marketLoading ? (
                <Spinner label="Loading players…" className="py-12" />
              ) : ownedForSlot.length === 0 && buyablePlayers.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No athletes found matching the position/gender filter.
                </div>
              ) : (
                <>
                  {/* Your squad first: fielding someone you already own
                                    costs nothing and is nearly always the intent. */}
                  <div className="flex items-center gap-2 pt-1 pb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                      In your squad
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                      {ownedForSlot.length}
                    </span>
                    <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>

                  {ownedForSlot.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 pb-2">
                      Nobody in your squad can play this slot — sign someone
                      below.
                    </p>
                  ) : (
                    ownedForSlot.map((p) => {
                      const isAlreadyPicked = calculations.chosenPlayerIds.has(
                        p.player_id,
                      );
                      const clubExceededForOwned =
                        !isAlreadyPicked &&
                        (calculations.clubCounts[p.club_id] || 0) >=
                          (season?.max_per_club || 3);
                      const defAllrounderExceededForOwned =
                        !isAlreadyPicked &&
                        activeModalSlot?.unit === "DEFENSE" &&
                        isAllrounderPosition(p.position) &&
                        SLOT_DEFINITIONS.filter(
                          (d) =>
                            d.unit === "DEFENSE" &&
                            d.slot !== activeModalSlot.slot,
                        ).some((d) =>
                          isAllrounderPosition(squad[d.slot]?.position),
                        );
                      const meta = playerMetadataLookup.get(p.player_id);
                      const playerImage = p.image || meta?.image || undefined;
                      const clubName = p.club_name || meta?.team_name || "";
                      const clubShortName =
                        p.club_short_name || meta?.team_short_name || "";
                      const clubLogo = p.club_logo || meta?.team_logo || "";

                      return (
                        <div
                          key={p.player_id}
                          className={`px-3 py-2.5 rounded-xl border flex items-center gap-3 transition ${
                            isAlreadyPicked
                              ? "bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 opacity-60"
                              : "bg-white dark:bg-gray-800 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 shadow-sm"
                          }`}
                        >
                          <PlayerAvatar
                            name={p.name}
                            image={playerImage}
                            gender={p.gender}
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                              {p.name}
                            </h4>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {p.position}
                              {p.starting && (
                                <span className="ml-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                                  · already starting
                                </span>
                              )}
                            </p>
                            {clubExceededForOwned && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                                Club limit reached ({season?.max_per_club || 3})
                              </span>
                            )}
                            {defAllrounderExceededForOwned && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                                Max 1 All-Rounder in defence
                              </span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() =>
                              handleSelectPlayer({
                                player_id: p.player_id,
                                player_name: p.name,
                                player_image: playerImage || "",
                                position: p.position,
                                gender: p.gender,
                                team_id: p.club_id,
                                team_name: clubName,
                                team_short_name: clubShortName,
                                team_logo: clubLogo,
                                price: p.purchase_price,
                                rating: 0,
                                total_points: 0,
                                owned_by: 0,
                                selected_by_pct: 0,
                                transfers_in: 0,
                                transfers_out: 0,
                              })
                            }
                            disabled={
                              isAlreadyPicked ||
                              clubExceededForOwned ||
                              defAllrounderExceededForOwned
                            }
                            title={
                              clubExceededForOwned
                                ? `No more than ${season?.max_per_club || 3} players may come from one club`
                                : defAllrounderExceededForOwned
                                  ? "You can only have a maximum of 1 All-Rounder in defence"
                                  : undefined
                            }
                            className="shrink-0"
                          >
                            {isAlreadyPicked ? "Picked" : "Field"}
                          </Button>
                        </div>
                      );
                    })
                  )}

                  {/* Then the rest of the market, for a squad with a
                                    gap at this position. Signing here spends money. */}
                  <div className="flex items-center gap-2 pt-3 pb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                      Available to sign
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                      {mySquad
                        ? `${mySquad.squad_size}/${mySquad.squad_max} squad · ${formatFantasyPrice(mySquad.bank)} to spend`
                        : ""}
                    </span>
                    <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>

                  {buyablePlayers.map((p) => {
                    const isAlreadyPicked = calculations.chosenPlayerIds.has(
                      p.player_id,
                    );
                    const clubCount = calculations.clubCounts[p.team_id] || 0;
                    const clubExceeded =
                      clubCount >= (season?.max_per_club || 3);
                    const defAllrounderExceeded =
                      !isAlreadyPicked &&
                      activeModalSlot?.unit === "DEFENSE" &&
                      isAllrounderPosition(p.position) &&
                      SLOT_DEFINITIONS.filter(
                        (d) =>
                          d.unit === "DEFENSE" &&
                          d.slot !== activeModalSlot.slot,
                      ).some((d) =>
                        isAllrounderPosition(squad[d.slot]?.position),
                      );
                    // Signing spends real money out of the bank — the
                    // lineup no longer has a budget of its own.
                    const affordable = p.price <= (mySquad?.bank ?? 0);
                    const squadFull =
                      !!mySquad && mySquad.squad_size >= mySquad.squad_max;
                    // Signing spends from the bank, so it obeys the
                    // same closed window as the transfer market.
                    const mktClosed =
                      mySquad && !mySquad.market_open
                        ? mySquad.market_closed_reason ||
                          "The transfer market is closed while a match day is being played."
                        : undefined;

                    return (
                      <div
                        key={p.player_id}
                        className={`px-3 py-2.5 rounded-xl border flex items-center gap-3 transition ${
                          isAlreadyPicked
                            ? "bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 opacity-60"
                            : affordable
                              ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-sffl-red/60 shadow-sm"
                              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <PlayerAvatar
                          name={p.player_name}
                          image={p.player_image}
                          gender={p.gender}
                        />

                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {p.player_name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {p.team_logo && (
                              <img
                                src={p.team_logo}
                                alt=""
                                className="w-3.5 h-3.5 object-contain"
                              />
                            )}
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                              {p.team_short_name || p.team_name || "—"}
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">
                              ·
                            </span>
                            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                              {p.position}
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">
                              ·
                            </span>
                            <span
                              className={`text-[11px] ${marketSort === "rating" ? "font-black text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}`}
                            >
                              <StarSolidIcon
                                className="inline w-3 h-3 -mt-0.5 mr-0.5"
                                aria-hidden="true"
                              />
                              {(p.rating ?? 0).toFixed(1)}
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">
                              ·
                            </span>
                            <span
                              className={`text-[11px] ${marketSort === "selected" ? "font-black text-sffl-red dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}
                            >
                              {(p.selected_by_pct ?? 0).toFixed(0)}% owned
                            </span>
                            {p.total_points > 0 && (
                              <>
                                <span className="text-gray-300 dark:text-gray-600">
                                  ·
                                </span>
                                <span
                                  className={`text-[11px] ${marketSort === "points" ? "font-black text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}`}
                                >
                                  {formatStatNumber(Math.round(p.total_points))}{" "}
                                  pts
                                </span>
                              </>
                            )}
                          </div>
                          {clubExceeded && !isAlreadyPicked && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                              Club limit reached ({clubCount}/
                              {season?.max_per_club || 3})
                            </span>
                          )}
                          {defAllrounderExceeded && !isAlreadyPicked && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                              Max 1 All-Rounder in defence
                            </span>
                          )}
                          {!affordable && !isAlreadyPicked && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                              {formatFantasyPrice(
                                p.price - (mySquad?.bank ?? 0),
                              )}{" "}
                              more than you have in the bank
                            </span>
                          )}
                          {/* The other reasons "Sign & field" is off, said on
                              the row rather than in a hover-only tooltip. */}
                          {!isAlreadyPicked &&
                            (mktClosed || p.price <= 0 || squadFull) && (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block mt-0.5">
                                {mktClosed
                                  ? mktClosed
                                  : p.price <= 0
                                    ? "Not on the market this season"
                                    : `Your squad is full at ${mySquad?.squad_max}`}
                              </span>
                            )}
                        </div>

                        <div className="flex flex-col items-end shrink-0">
                          <span
                            className={`text-sm font-black tabular-nums ${
                              affordable
                                ? "text-gray-900 dark:text-white"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {formatFantasyPrice(p.price)}
                          </span>
                          {/* Signing and fielding in one action: a
                                                    manager opening this slot wants the player in
                                                    it, not merely in the squad. */}
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => buyAndSelect(p)}
                            disabled={
                              isAlreadyPicked ||
                              !affordable ||
                              squadFull ||
                              clubExceeded ||
                              defAllrounderExceeded ||
                              !!mktClosed ||
                              buyMutation.isPending ||
                              p.price <= 0
                            }
                            title={
                              mktClosed
                                ? mktClosed
                                : p.price <= 0
                                  ? "This player is not on the market for this season"
                                  : squadFull
                                    ? `Your squad is full at ${mySquad?.squad_max}`
                                    : clubExceeded
                                      ? `No more than ${season?.max_per_club || 3} players may come from one club`
                                      : defAllrounderExceeded
                                        ? "You can only have a maximum of 1 All-Rounder in defence"
                                        : !affordable
                                          ? "Not enough in the bank"
                                          : undefined
                            }
                            className="mt-1"
                            loading={buyMutation.isPending}
                          >
                            {isAlreadyPicked ? "Picked" : "Sign & field"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {buyablePlayers.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 py-2">
                      Everyone available for this slot is already in your squad.
                    </p>
                  )}
                </>
              )}
            </div>
        </Modal>
      )}

      {/* ──────────────────────────────────────────────────────────────────
                BENCH MARKET MODAL (for signing reserve depth)
            ────────────────────────────────────────────────────────────────── */}
      {showBenchMarket && (
        <Modal
          open
          onClose={() => {
            setShowBenchMarket(false);
            setMarketSearch("");
            setMarketTeamFilter("");
            setBenchPositionFilter("");
            setMarketGenderFilter("");
          }}
          title="Add Reserve Player"
          subtitle="Sign for Bench"
          maxWidth="2xl"
        >
            <span className="mb-4 inline-block text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              {formatFantasyPrice(mySquad?.bank ?? 0)} to spend ·{" "}
              {mySquad?.squad_size ?? 0}/{mySquad?.squad_max ?? 19} squad
            </span>

            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 space-y-2.5">
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    id="bench-player-search"
                    type="text"
                    icon={MagnifyingGlassIcon}
                    value={marketSearch}
                    onChange={(e) => setMarketSearch(e.target.value)}
                    placeholder="Search for a player..."
                    aria-label="Search for a player"
                  />
                </div>
              </div>

              {/* Role, Team & Gender Filters */}
              <div className="flex flex-col min-[480px]:flex-row gap-2">
                <Select
                  id="bench-role-filter"
                  value={benchPositionFilter}
                  onChange={(e) => setBenchPositionFilter(e.target.value)}
                  aria-label="Filter by role"
                  className="flex-1"
                >
                  <option value="">All roles</option>
                  {marketPositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </Select>
                <Select
                  id="bench-team-filter"
                  value={marketTeamFilter}
                  onChange={(e) => setMarketTeamFilter(e.target.value)}
                  aria-label="Filter by team"
                  className="flex-1"
                >
                  <option value="">All teams</option>
                  {marketTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <Select
                  id="bench-gender-filter"
                  value={marketGenderFilter}
                  onChange={(e) =>
                    setMarketGenderFilter(e.target.value as "" | "F" | "M")
                  }
                  aria-label="Filter by gender"
                  className="flex-1"
                >
                  <option value="">All genders</option>
                  <option value="F">Women</option>
                  <option value="M">Men</option>
                </Select>
              </div>

              {/* Sort Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0 mr-1">
                  Sort:
                </span>
                {MARKET_SORT_OPTIONS.map((opt) => (
                  <Button
                    key={opt.key}
                    size="sm"
                    variant={marketSort === opt.key ? "navy" : "secondary"}
                    className="shrink-0"
                    icon={opt.icon}
                    aria-pressed={marketSort === opt.key}
                    onClick={() => setMarketSort(opt.key)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {benchMarketLoading ? (
                <Spinner label="Loading players…" className="py-12" />
              ) : buyableBenchPlayers.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No players found.
                </div>
              ) : (
                buyableBenchPlayers.map((p) => {
                  const affordable = p.price <= (mySquad?.bank ?? 0);
                  const squadFull =
                    !!mySquad && mySquad.squad_size >= mySquad.squad_max;

                  return (
                    <div
                      key={p.player_id}
                      className={`px-3 py-2.5 rounded-xl border flex items-center gap-3 transition ${
                        affordable
                          ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-sffl-red/60 shadow-sm"
                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <PlayerAvatar
                        name={p.player_name}
                        image={p.player_image}
                        gender={p.gender}
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {p.player_name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {p.team_logo && (
                            <img
                              src={p.team_logo}
                              alt=""
                              className="w-3.5 h-3.5 object-contain"
                            />
                          )}
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {p.team_short_name || p.team_name || "—"}
                          </span>
                          <span className="text-gray-300 dark:text-gray-600">
                            ·
                          </span>
                          <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                            {p.position}
                          </span>
                          <span className="text-gray-300 dark:text-gray-600">
                            ·
                          </span>
                          <span
                            className={`text-[11px] ${marketSort === "rating" ? "font-black text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}`}
                          >
                            <StarSolidIcon
                              className="inline w-3 h-3 -mt-0.5 mr-0.5"
                              aria-hidden="true"
                            />
                            {(p.rating ?? 0).toFixed(1)}
                          </span>
                          <span className="text-gray-300 dark:text-gray-600">
                            ·
                          </span>
                          <span
                            className={`text-[11px] ${marketSort === "selected" ? "font-black text-sffl-red dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}
                          >
                            {(p.selected_by_pct ?? 0).toFixed(0)}% owned
                          </span>
                          {p.total_points > 0 && (
                            <>
                              <span className="text-gray-300 dark:text-gray-600">
                                ·
                              </span>
                              <span
                                className={`text-[11px] ${marketSort === "points" ? "font-black text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}`}
                              >
                                {formatStatNumber(Math.round(p.total_points))}{" "}
                                pts
                              </span>
                            </>
                          )}
                        </div>
                        {!affordable && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                            {formatFantasyPrice(p.price - (mySquad?.bank ?? 0))}{" "}
                            more than you have
                          </span>
                        )}
                        {affordable && (squadFull || p.price <= 0) && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block mt-0.5">
                            {p.price <= 0
                              ? "Not on the market this season"
                              : `Your squad is full at ${mySquad?.squad_max}`}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span
                          className={`text-sm font-black tabular-nums ${affordable ? "text-gray-900 dark:text-white" : "text-amber-600 dark:text-amber-400"}`}
                        >
                          {formatFantasyPrice(p.price)}
                        </span>
                        <Button
                          size="sm"
                          variant="primary"
                          className="mt-1"
                          onClick={() => buyForBench(p.player_id)}
                          disabled={
                            !affordable ||
                            squadFull ||
                            buyMutation.isPending ||
                            p.price <= 0
                          }
                          loading={buyMutation.isPending}
                        >
                          Sign
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
        </Modal>
      )}

      {/* ──────────────────────────────────────────────────────────────────
                SELL CONFIRMATION MODAL
            ────────────────────────────────────────────────────────────────── */}
      {confirmSell && mySquad && (
        <SellConfirmation
          player={confirmSell}
          squad={mySquad}
          pending={sellMutation.isPending}
          onCancel={() => {
            setConfirmSell(null);
            setPendingTransferOutSlot(null);
          }}
          onConfirm={() => sellMutation.mutate(confirmSell.player_id)}
        />
      )}

      <Modal
        open={!!violationModal}
        onClose={() => setViolationModal(null)}
        title={violationModal?.title || "Selection Blocked"}
        maxWidth="md"
      >
        {violationModal && (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {violationModal.message}
            </p>
            <div className="flex justify-end mt-5">
              <Button size="sm" onClick={() => setViolationModal(null)}>
                OK
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────
                EDIT TEAM NAME MODAL
            ────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showEditNameModal}
        onClose={() => setShowEditNameModal(false)}
        title="Edit Team Name"
        maxWidth="md"
      >
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
            Personalize your fantasy squad name. Team names must be unique
            within the season and appear across all leaderboards and match day
            summaries.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = editModalNameInput.trim();
              if (
                trimmed.length >= 3 &&
                trimmed.length <= 40 &&
                !renameMutation.isPending
              ) {
                renameMutation.mutate(trimmed);
              }
            }}
            className="space-y-4"
          >
            {reserveDrag &&
              (() => {
                const p = mySquad?.players.find(
                  (x) => x.player_id === reserveDrag.playerId,
                );
                if (!p) return null;
                return createPortal(
                  <div
                    aria-hidden="true"
                    className="fixed z-100 pointer-events-none flex flex-col items-center gap-1"
                    style={{
                      left: reserveDrag.x,
                      top: reserveDrag.y,
                      transform: "translate(-50%, -50%) scale(1.15)",
                    }}
                  >
                    <div className="rounded-full ring-2 ring-white/70 shadow-2xl">
                      <PlayerAvatar
                        name={p.name}
                        image={
                          p.image ||
                          playerMetadataLookup.get(p.player_id)?.image ||
                          undefined
                        }
                        gender={p.gender}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-white bg-black/60 rounded px-1.5 py-0.5">
                      {p.name.split(" ").slice(-1)[0]}
                    </span>
                  </div>,
                  document.body,
                );
              })()}

            <Field
              label="Team Name (3–40 characters)"
              htmlFor="edit-team-name-modal-input"
              hint={
                editModalNameInput.trim().length === 0
                  ? "Team names must be unique across the season."
                  : editModalNameInput.trim().length >= 3 &&
                      editModalNameInput.trim().length <= 40
                    ? `${editModalNameInput.trim().length}/40 characters • Must be unique in this season`
                    : "Must be between 3 and 40 characters."
              }
            >
              <Input
                id="edit-team-name-modal-input"
                type="text"
                value={editModalNameInput}
                onChange={(e) => setEditModalNameInput(e.target.value)}
                placeholder="Enter unique team name..."
                maxLength={40}
                autoFocus
              />
            </Field>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowEditNameModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                loading={renameMutation.isPending}
                disabled={
                  editModalNameInput.trim().length < 3 ||
                  editModalNameInput.trim().length > 40
                }
              >
                {renameMutation.isPending ? "Saving…" : "Save Name"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}

// ─── Sell Confirmation Dialog ────────────────────────────────────────────────

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
      onClose={onCancel}
      title={`Sell ${player.name}?`}
      maxWidth="md"
      footer={
        <>
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            disabled={pending}
            onClick={onCancel}
          >
            Keep {player.name.split(" ")[0]}
          </Button>
          <Button
            size="lg"
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
          <div className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
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
                className={`p-2.5 rounded-xl border ${unit === "offense" ? "bg-white dark:bg-gray-800 border-amber-300 dark:border-amber-700" : "bg-amber-100/50 dark:bg-amber-900/20 border-transparent"}`}
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
                className={`p-2.5 rounded-xl border ${unit === "defense" ? "bg-white dark:bg-gray-800 border-amber-300 dark:border-amber-700" : "bg-amber-100/50 dark:bg-amber-900/20 border-transparent"}`}
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

        {/* Selling is never refused, so the consequence has to be stated
                    here — this is the last point at which it can be. */}
        {player.breaks_lineup && (
          <div className="mt-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
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
