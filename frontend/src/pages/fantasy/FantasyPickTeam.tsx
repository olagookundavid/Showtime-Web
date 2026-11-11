import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  isDeletedPlayer,
  FemaleIcon,
  Button,
  Field,
  Input,
  Modal,
  Loader,
  PlayerAvatar,
  FantasyPlayerLink,
  FantasyPitch,
  type PitchSubstitute,
  FantasyStandingRow,
} from "../../components";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  UsersIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  RocketLaunchIcon,
  SparklesIcon,
  ArrowsRightLeftIcon,
  ArrowUturnDownIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  PlayCircleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import {
  fantasyCoreApi,
  fantasySeasonApi,
  fantasySquadApi,
  getPlayerForm,
  formatFantasyPrice,
} from "../../services";
import type {
  FantasySlot,
  FantasyPlayerListItem,
  FantasySeason,
  Squad,
  SquadPlayer,
  PlayerFormGame,
} from "../../types";
import {
  SLOT_DEFINITIONS,
  type SlotDefinition,
  isAllrounderPosition,
  positionFitsSlot,
  emptySquad,
  formatPositions,
  joinNames,
  describePlayer,
  isFemale,
  getDefaultTeamName,
  formatStatNumber,
  formatStatDecimal,
} from "../../utils";
import { useAuth } from "../../contexts";
import { useReserveDrag } from "../../hooks";

const getDraftKey = (seasonId?: string, gwId?: string, userId?: string) => {
  if (!seasonId || !gwId) return null;
  return `showtime_fantasy_draft_${seasonId}_${gwId}_${userId || "anon"}`;
};

/** Everything off the wire is treated as possibly-missing: a brand new season
 *  legitimately has no team, no lineup and no managers yet. */
const num = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

// House style for every fantasy toast: short, dash-free, sentence-capitalized.
// Applied once here so a backend error (lowercase by Go convention, and
// sometimes dash-joined) always reads the way a toast should, without every
// call site having to write it that way itself.
function tidyMessage(msg: string): string {
  const clean = msg
    .replace(/\s+[-–—]\s+/g, ". ")
    .replace(/\.\s+([a-z])/g, (_, c: string) => `. ${c.toUpperCase()}`)
    .trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean;
}

export function FantasyPickTeam() {
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
    queryFn: fantasyCoreApi.getActiveSeason,
  });

  const { data: gameweeks = [], isLoading: gwLoading } = useQuery({
    queryKey: ["fantasyGameweeks", season?.id],
    queryFn: () =>
      season?.id ? fantasyCoreApi.getGameweeks(season.id) : Promise.resolve([]),
    enabled: !!season?.id,
  });

  const scheduledGW =
    gameweeks.find((gw) => gw.status === "SCHEDULED") || gameweeks[0];

  // Team names lock the moment the season's first gameweek stops being
  // SCHEDULED — one-way, frontend-only (the server has no guard beyond
  // season.status). Gates the sidebar's rename control and the legacy
  // placeholder auto-open effect below.
  const seasonHasStarted = useMemo(
    () => gameweeks.some((gw) => gw.status !== "SCHEDULED"),
    [gameweeks],
  );

  // Current Lineup
  const { data: currentLineup, isLoading: lineupLoading } = useQuery({
    queryKey: ["myFantasyLineup", season?.id, scheduledGW?.id],
    queryFn: () =>
      season?.id && scheduledGW?.id
        ? fantasyCoreApi.getMyLineup(season.id, scheduledGW.id)
        : Promise.resolve(null),
    enabled: !!season?.id && !!scheduledGW?.id,
  });

  // The manager's owned squad. A lineup can only name players they own, so
  // this is the only source the slot picker draws from on this page — buying
  // players to fill gaps happens on Transfers now.
  const { data: mySquad } = useQuery({
    queryKey: ["fantasySquad", season?.id],
    queryFn: () => fantasySquadApi.getSquad(season!.id),
    enabled: !!season?.id,
  });

  // Player metadata cache ensuring photos and team info are never dropped across benching/promotion
  const playerMetadataLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        image: string;
        team_name: string;
        team_short_name: string;
        team_logo: string;
        owned_by: number;
        selected_by_pct: number;
      }
    >();
    for (const p of mySquad?.players ?? []) {
      if (p.player_id) {
        const existing = map.get(p.player_id);
        map.set(p.player_id, {
          image: p.image || existing?.image || "",
          team_name: p.club_name || existing?.team_name || "",
          team_short_name: p.club_short_name || existing?.team_short_name || "",
          team_logo: p.club_logo || existing?.team_logo || "",
          owned_by: p.owned_by ?? existing?.owned_by ?? 0,
          selected_by_pct: p.selected_by_pct ?? existing?.selected_by_pct ?? 0,
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
          owned_by: existing?.owned_by ?? 0,
          selected_by_pct: existing?.selected_by_pct ?? 0,
        });
      }
    }
    return map;
  }, [mySquad, currentLineup]);

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
  // Player action popover: which slot's player is showing actions
  const [actionSlot, setActionSlot] = useState<FantasySlot | null>(null);
  // Whether the Manage Starter panel's "Substitute" dropdown is expanded —
  // reset whenever the panel targets a different slot (or closes).
  const [showSubstituteOptions, setShowSubstituteOptions] = useState(false);
  useEffect(() => {
    setShowSubstituteOptions(false);
  }, [actionSlot]);
  // Which pitch substitute (owned, start-eligible, not yet in a slot) is
  // showing its own details panel — a separate id since a substitute isn't
  // keyed by FantasySlot the way a starter is.
  const [actionSubstituteId, setActionSubstituteId] = useState<string | null>(
    null,
  );
  const actionSubstitutePlayer = useMemo(
    () =>
      mySquad?.players.find((p) => p.player_id === actionSubstituteId) ??
      null,
    [mySquad, actionSubstituteId],
  );
  const actionSlotPlayerId = actionSlot ? squad[actionSlot]?.player_id : undefined;
  const actionPlayerFormId = actionSlotPlayerId ?? actionSubstituteId ?? undefined;
  // Form, points-per-game and the last few matches for whoever the Manage
  // Starter or substitute details panel is open on — season-wide stats the
  // squad slot/bench row itself doesn't carry.
  const { data: actionPlayerForm, isLoading: actionPlayerFormLoading } =
    useQuery({
      queryKey: ["fantasyPlayerForm", actionPlayerFormId, season?.id],
      queryFn: () => getPlayerForm(actionPlayerFormId!, season?.id),
      enabled: !!actionPlayerFormId && !!season?.id,
      staleTime: 30000,
    });
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
          // A draft only wins over the freshly-fetched lineup when it still
          // agrees with it. Buying (and auto-placing) a player from
          // Transfers changes the server's lineup without ever touching
          // this draft, so a draft that no longer matches the server is
          // stale, not more current — fall through to hydrating from the
          // server below instead of restoring it.
          const draftMatchesServer =
            !currentLineup ||
            SLOT_DEFINITIONS.every((def) => {
              const serverPick = currentLineup.picks.find(
                (p) => p.slot === def.slot,
              );
              const draftPlayerId = draft?.squad?.[def.slot]?.player_id ?? null;
              return (serverPick?.player_id ?? null) === draftPlayerId;
            });
          if (draft && draft.squad && draftMatchesServer) {
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
            owned_by: meta?.owned_by ?? 0,
            selected_by_pct: meta?.selected_by_pct ?? 0,
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

  // If an entered manager still has legacy "My Showtime Stars", prompt them to
  // name their team — but never once the season has started and the name is
  // locked.
  useEffect(() => {
    if (seasonHasStarted) return;
    if (
      hasJoined &&
      (dashboard?.team?.name === "My Showtime Stars" ||
        currentLineup?.team_name === "My Showtime Stars")
    ) {
      setEditModalNameInput(getDefaultTeamName(user?.name));
      setShowEditNameModal(true);
    }
  }, [
    seasonHasStarted,
    hasJoined,
    dashboard?.team?.name,
    currentLineup?.team_name,
    user?.name,
  ]);

  // Helper to look up a player's real name and slot across starting squad and
  // owned/lineup picks — everything this page has, now that the market is on
  // a different page.
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
    if (!msg) return tidyMessage(fallback);

    // Pattern 1: "player <UUID> not found or belongs to an inactive team"
    const inactiveMatch = msg.match(
      /player\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+(?:was\s+)?not found or belongs to an inactive team/i,
    );
    if (inactiveMatch) {
      const id = inactiveMatch[1];
      const info = getPlayerFriendlyInfo(id);
      if (info) {
        if (info.slotLabel) {
          return tidyMessage(
            `${info.name} (${info.slotLabel}) is not eligible to play: their team is inactive. Replace them.`,
          );
        }
        return tidyMessage(
          `${info.name} is not eligible to play: their team is inactive. Replace them.`,
        );
      }
      return tidyMessage(
        "One of your selected players is not eligible to play: their team is inactive. Replace them in your lineup.",
      );
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

    return tidyMessage(msg);
  };

  // Calculations & Invariant Validations
  const calculations = useMemo(() => {
    let totalSpent = 0;
    let filledCount = 0;
    let offenseFemales = 0;
    let defenseFemales = 0;
    let defenseAllrounders = 0;
    const clubCounts: Record<string, number> = {};
    const chosenPlayerIds = new Set<string>();
    // Who is behind each count, so a failing check can name the players to
    // change instead of only saying a rule is broken.
    const defenseAllrounderNames: string[] = [];
    const clubPlayerNames: Record<string, string[]> = {};
    const clubLabels: Record<string, string> = {};
    const seenNames: Record<string, string> = {};
    const doubledUpNames: string[] = [];

    SLOT_DEFINITIONS.forEach((def) => {
      const player = squad[def.slot];
      if (player) {
        totalSpent += player.price;
        filledCount++;
        if (
          chosenPlayerIds.has(player.player_id) &&
          !doubledUpNames.includes(player.player_name)
        ) {
          doubledUpNames.push(player.player_name);
        }
        chosenPlayerIds.add(player.player_id);
        seenNames[player.player_id] = player.player_name;

        const isFem = (player.gender || "").toUpperCase() === "F";
        if (def.unit === "OFFENSE" && isFem) offenseFemales++;
        if (def.unit === "DEFENSE" && isFem) defenseFemales++;

        if (def.unit === "DEFENSE" && isAllrounderPosition(player.position)) {
          defenseAllrounders++;
          defenseAllrounderNames.push(player.player_name);
        }

        if (player.team_id) {
          clubCounts[player.team_id] = (clubCounts[player.team_id] || 0) + 1;
          (clubPlayerNames[player.team_id] ??= []).push(player.player_name);
          clubLabels[player.team_id] ||=
            player.team_short_name || player.team_name || "one club";
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
    const overLimitClubs = Object.entries(clubCounts)
      .filter(([, count]) => count > maxPerClub)
      .map(
        ([teamId]) =>
          `${joinNames(clubPlayerNames[teamId] ?? [])} are all from ${clubLabels[teamId]}`,
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

    // Every mismatch, named: "Defender 1 is mismatched" left the manager to
    // work out who was in Defender 1 and what was wrong with them.
    const ineligiblePicks: string[] = [];
    for (const def of SLOT_DEFINITIONS) {
      const player = squad[def.slot];
      if (!player) continue;
      const positionOK = positionFitsSlot(def, player.position);
      const genderOK =
        !def.requiredGender ||
        (player.gender || "").toUpperCase() === def.requiredGender;
      if (!positionOK || !genderOK) {
        ineligiblePicks.push(
          `${describePlayer(player.player_name, player.position)} can't play ${def.label}`,
        );
      }
    }
    const ineligibleSlot = ineligiblePicks[0] ?? null;
    const slotEligibilityValid = ineligiblePicks.length === 0;

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
      ineligiblePicks,
      defenseAllrounderNames,
      overLimitClubs,
      doubledUpNames,
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
        label: calculations.defenseAllroundersValid
          ? "Max 1 All-Rounder in defence"
          : `Max 1 All-Rounder in defence — ${joinNames(calculations.defenseAllrounderNames)} are all All-Rounders`,
        detail: calculations.defenseAllroundersValid
          ? `${calculations.defenseAllrounders} of 1`
          : `${calculations.defenseAllrounders} selected (max 1)`,
      },
      {
        ok: calculations.clubLimitValid,
        label: calculations.clubLimitValid
          ? `No more than ${calculations.maxPerClub} from one club`
          : `No more than ${calculations.maxPerClub} from one club — ${calculations.overLimitClubs.join("; ")}`,
        detail: calculations.clubLimitValid ? "OK" : "Exceeded",
      },
      {
        ok: calculations.clubsActiveValid,
        label: "Every starter can start (no inactive or club-reserve players)",
        detail: calculations.clubsActiveValid ? "OK" : "Bench or replace them",
      },
      {
        ok: calculations.duplicatePlayerValid,
        label: calculations.duplicatePlayerValid
          ? "No player in two slots"
          : `No player in two slots — ${joinNames(calculations.doubledUpNames)} ${calculations.doubledUpNames.length === 1 ? "is" : "are"} in two`,
        detail: calculations.duplicatePlayerValid ? "OK" : "Doubled up",
      },
      {
        ok: calculations.slotEligibilityValid,
        label: calculations.slotEligibilityValid
          ? "Every player suits their slot"
          : calculations.ineligiblePicks.join("; "),
        detail: calculations.slotEligibilityValid ? "OK" : "Wrong slot",
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

  // The bench splits into two genuinely different things: substitutes, who
  // are eligible and just not placed yet, and reserves, who can never start
  // at all (on their club's reserve list, or inactive/deleted) — the old
  // combined list blurred that distinction. Substitutes move onto the pitch
  // card itself; reserves stay in their own list below it.
  const trueSubstitutes = useMemo(
    () =>
      benchPlayers.filter(
        (p) =>
          p.team_active !== false &&
          !isDeletedPlayer({ status: p.player_status }) &&
          !p.is_reserve,
      ),
    [benchPlayers],
  );
  const reservePlayers = useMemo(
    () =>
      benchPlayers.filter(
        (p) =>
          p.team_active === false ||
          isDeletedPlayer({ status: p.player_status }) ||
          !!p.is_reserve,
      ),
    [benchPlayers],
  );

  const pitchSubstitutes = useMemo<PitchSubstitute[]>(
    () =>
      trueSubstitutes.map((p) => ({
        playerId: p.player_id,
        name: p.name,
        image: p.image || playerMetadataLookup.get(p.player_id)?.image || undefined,
        position: p.position,
        gender: p.gender,
      })),
    [trueSubstitutes, playerMetadataLookup],
  );

  // Bench players the Manage Starter panel's "Substitute" dropdown offers
  // for the slot it's open on — position- and gender-eligible, same rule
  // ownedForSlot applies for the full player-selection modal. Squad-rule
  // checks (club limit, All-Rounder cap) run on pick via handleReserveDrop,
  // so this list doesn't duplicate that validation up front.
  const eligibleSubstitutesForSlot = useMemo(() => {
    if (!actionSlot) return [];
    const def = SLOT_DEFINITIONS.find((d) => d.slot === actionSlot);
    if (!def) return [];
    return trueSubstitutes.filter(
      (p) =>
        positionFitsSlot(def, p.position) &&
        (!def.requiredGender ||
          (p.gender || "M").toUpperCase().startsWith(def.requiredGender)),
    );
  }, [actionSlot, trueSubstitutes]);

  // Tapping an on-pitch substitute token opens its own details panel — same
  // as tapping a starter — rather than starting them immediately. Starting
  // happens from a button inside that panel now.
  const handleSubstituteClick = (sub: PitchSubstitute) => {
    setActionSlot(null);
    setActionSubstituteId(sub.playerId);
  };

  // Who the manager already owns and can field in the open slot — the only
  // picker this page offers. Buying to fill a gap happens on Transfers now.
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
      );
  }, [activeModalSlot, mySquad]);

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
      return fantasyCoreApi.saveLineup({
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
          "Lineup published. It starts earning points this match day.",
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
  function persistSquad(
    next: Record<FantasySlot, FantasyPlayerListItem | null>,
    opts?: { publish?: boolean },
  ) {
    if (!season || !scheduledGW) return;
    const picks = SLOT_DEFINITIONS.filter((def) => next[def.slot]).map(
      (def) => ({ player_id: next[def.slot]!.player_id, slot: def.slot }),
    );
    saveMutation.mutate({ picks, publish: opts?.publish ?? false });
  }

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
        error: `${candidateName} is on their club's reserve list. They can sit on your bench but cannot start.`,
      };
    }

    // 2. Slot Position Compatibility
    if (!positionFitsSlot(targetSlot, candidatePos)) {
      return {
        valid: false,
        title: "Invalid Position",
        error: `${describePlayer(candidateName, candidatePos)} can't play ${targetSlot.label}. That slot needs a ${formatPositions(targetSlot.allowedPositions)}.`,
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
        error: `${candidateName} can't play ${targetSlot.label}. That slot needs a ${targetSlot.requiredGender === "F" ? "female" : "male"} player.`,
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
      )
        .map((d) => currentSquad[d.slot])
        .filter(
          (p): p is FantasyPlayerListItem =>
            !!p &&
            p.player_id !== candidateId &&
            isAllrounderPosition(p.position),
        );

      if (otherDefAllrounders.length >= 1) {
        return {
          valid: false,
          title: "Defense All-Rounder Limit",
          error: `${candidateName} is an All-Rounder, and ${joinNames(otherDefAllrounders.map((p) => p.player_name))} already fills your one All-Rounder spot in defence.`,
        };
      }
    }

    // 6. Max Players Per Club
    const maxPerClub = opts?.season?.max_per_club || 3;
    if (candidateClubId) {
      const clubmates: string[] = [];
      for (const def of SLOT_DEFINITIONS) {
        if (def.slot === targetSlot.slot) continue;
        const p = currentSquad[def.slot];
        if (!p || p.player_id === candidateId) continue;
        if (p.team_id === candidateClubId) {
          clubmates.push(p.player_name);
        }
      }
      if (clubmates.length + 1 > maxPerClub) {
        return {
          valid: false,
          title: "Club Quota Exceeded",
          error: `${candidateName} would make ${clubmates.length + 1} from ${candidateClubName || "one club"}. You already start ${joinNames(clubmates)}, and the limit is ${maxPerClub}.`,
        };
      }
    }

    // 7. Purchase-specific validations
    if (opts?.isBuying) {
      // The cap is the whole squad's, starters plus bench. season.squad_size is
      // the starting fourteen, and measuring against it called a 14-player
      // squad "full" with every bench spot still open.
      const squadMax = opts?.mySquad?.squad_max ?? 19;
      const squadSize =
        opts?.mySquad?.squad_size ?? opts?.mySquad?.players.length ?? 0;
      if (opts?.mySquad && squadSize >= squadMax) {
        const displaced = currentSquad[targetSlot.slot];
        return {
          valid: false,
          title: "Squad Full",
          error:
            displaced && displaced.player_id !== candidateId
              ? `Your squad is full (${squadMax} of ${squadMax}). Signing ${candidateName} would move ${displaced.player_name} to the bench, but there is no bench room left. Sell a bench player, or use Transfer Out on ${displaced.player_name} to sell them and sign ${candidateName} in their place.`
              : `Your squad is full (${squadMax} of ${squadMax}). Sell a bench player before signing ${candidateName}.`,
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
        error: `Placing ${candidateName} in ${targetSlot.label} leaves only ${totalPotentialFemales} possible female athletes in ${targetSlot.unit.toLowerCase()}, but at least ${minFemale} are required.`,
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
    // Whoever held the slot is still owned, so they drop to the bench.
    const displaced = squad[activeModalSlot.slot];
    commitSquad((prev) => ({
      ...prev,
      [activeModalSlot.slot]: enrichedPlayer,
    }));
    if (displaced && displaced.player_id !== player.player_id) {
      toast.success(
        `${player.player_name} in, ${displaced.player_name} moved to the bench.`,
      );
    }
    setActiveModalSlot(null);
  };

  // Why a starter cannot start, or null if they can. The pitch badge, the
  // Manage menu and the checklist's list of blocked starters all read this,
  // so they can never disagree about who is blocked. `owned` is false for a
  // pick no longer in the squad: there is nothing to sell, only to bench.
  const starterIssue = (
    slot: FantasySlot,
  ): { reason: string; detail: string; owned: boolean } | null => {
    const player = squad[slot];
    if (!player || !mySquad?.players) return null;
    const squadMember = mySquad.players.find(
      (sp) => sp.player_id === player.player_id,
    );
    if (!squadMember) {
      return {
        reason: "Not Owned",
        detail: "No longer in your squad.",
        owned: false,
      };
    }
    if (squadMember.team_active === false) {
      return {
        reason: "Club Inactive",
        detail: "Their club is inactive, so they cannot start.",
        owned: true,
      };
    }
    if (isDeletedPlayer({ status: squadMember.player_status })) {
      return {
        reason: "Unavailable",
        detail: "No longer in the league, so they cannot start.",
        owned: true,
      };
    }
    if (squadMember.is_reserve) {
      return {
        reason: "Club reserve",
        detail:
          "On their club's reserve list, so they can sit on your bench but cannot start.",
        owned: true,
      };
    }
    return null;
  };

  const blockedStarters = SLOT_DEFINITIONS.flatMap((def) => {
    const issue = starterIssue(def.slot);
    const player = squad[def.slot];
    return issue && player ? [{ def, player, issue }] : [];
  });

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
      owned_by: meta?.owned_by ?? 0,
      selected_by_pct: meta?.selected_by_pct ?? 0,
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
      owned_by: meta?.owned_by ?? 0,
      selected_by_pct: meta?.selected_by_pct ?? 0,
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
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none shadow-2xl p-6 md:p-10 max-w-lg w-full">
          <div className="w-14 h-14 rounded-none bg-sffl-red/10 dark:bg-sffl-red/20 flex items-center justify-center text-sffl-red mb-5">
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
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-none border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
        <div className="w-16 h-16 rounded-none bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
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

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* ────────────────────────────────────────────────────────────────
                    STICKY SIDEBAR — identity, points/rank, finance, leagues
                ──────────────────────────────────────────────────────────────── */}
        <div className="order-2 lg:order-1 lg:col-span-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm divide-y divide-gray-200 dark:divide-gray-700">
            {/* Team identity */}
            <div className="p-5">
              <h2 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Team
              </h2>
              <p className="text-lg font-black italic uppercase tracking-tight text-sffl-navy dark:text-white truncate mt-1">
                {teamName || getDefaultTeamName(user?.name)}
              </p>
              {!seasonHasStarted && (
                <div className="mt-4">
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
              )}
            </div>

            {/* Points & Rankings */}
            <div className="p-5">
              <h2 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                Points & Rankings
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                    Season Total
                  </span>
                  <span className="text-xl font-black text-sffl-navy dark:text-white tabular-nums">
                    {formatStatNumber(num(dashboard?.team?.total_points))}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                    Overall Rank
                  </span>
                  <span className="text-xl font-black text-sffl-navy dark:text-white tabular-nums">
                    {dashboard?.team?.overall_rank
                      ? `#${formatStatNumber(num(dashboard.team.overall_rank))}`
                      : "—"}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                    Gameweek Points
                  </span>
                  <span className="text-xl font-black text-sffl-navy dark:text-white tabular-nums">
                    {formatStatNumber(num(dashboard?.team?.gameweek_points))}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                    Total Players
                  </span>
                  <span className="text-xl font-black text-sffl-navy dark:text-white tabular-nums">
                    {formatStatNumber(num(dashboard?.team?.total_managers))}
                  </span>
                </div>
              </div>
            </div>

            {/* Finance */}
            {mySquad && (
              <div className="p-5">
                <h2 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Finance
                </h2>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                      In the bank
                    </span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatFantasyPrice(mySquad.bank)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                      Squad value
                    </span>
                    <span className="text-sm font-black text-sffl-navy dark:text-white tabular-nums">
                      {formatFantasyPrice(mySquad.squad_value)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                      Club value
                    </span>
                    <span className="text-sm font-black text-sffl-navy dark:text-white tabular-nums">
                      {formatFantasyPrice(mySquad.bank + mySquad.squad_value)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* My Leagues */}
            <div className="p-5">
              <h2 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                My Leagues
              </h2>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                <FantasyStandingRow
                  to={`/fantasy/leaderboard/${season.id}?type=overall`}
                  name="Overall"
                  rank={dashboard?.team?.overall_rank ?? 0}
                  movement={dashboard?.team?.rank_movement}
                  isOverall
                />
                {(dashboard?.leagues ?? [])
                  .filter((l) => l.type !== "OVERALL" && l.league_id)
                  .map((l) => (
                    <FantasyStandingRow
                      key={l.league_id}
                      to={`/fantasy/leaderboard/${l.league_id}`}
                      name={l.name || "Unnamed league"}
                      rank={l.my_rank ?? 0}
                      movement={l.rank_movement}
                      isOverall={false}
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────
                    MAIN COLUMN — gameweek strip, pitch, publish, bench
                ──────────────────────────────────────────────────────────────── */}
        <div className="order-1 lg:order-2 lg:col-span-2 space-y-6 md:space-y-8 min-w-0">
          {/* Slim gameweek strip */}
          <div className="bg-sffl-navy text-white rounded-none shadow-xl p-4 sm:p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0 flex flex-wrap items-center gap-2">
                <span className="text-xs font-black px-2.5 py-0.5 rounded bg-sffl-red text-white uppercase tracking-wider">
                  Gameweek {scheduledGW.number}
                </span>
                <span className="text-xs text-gray-300 font-medium">
                  Lock Deadline: {new Date(scheduledGW.deadline).toLocaleString()}
                </span>
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

          </div>

          {/* Squad-size mini row — the other two tiles from the old
                        Financial Strip; lineup-progress indicators, not finance,
                        so they stay in the main column rather than the sidebar. */}
          {mySquad && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 sm:p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-none min-w-0">
                <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                  Starting 14
                </span>
                <span className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white tabular-nums">
                  {calculations.filledCount}
                  <span className="text-sm text-gray-400 dark:text-gray-500 font-bold">
                    {" "}
                    / 14
                  </span>
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 font-medium">
                  Starters selected
                </span>
              </div>
              <div className="p-3.5 sm:p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-none min-w-0">
                <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                  Bench / Reserves
                </span>
                <span className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white tabular-nums">
                  {benchPlayers.length}
                  <span className="text-sm text-gray-400 dark:text-gray-500 font-bold">
                    {" "}
                    / {(mySquad.squad_max || 19) - 14}
                  </span>
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 font-medium">
                  Squad depth
                </span>
              </div>
            </div>
          )}

          {/* Invariant Validation Strips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Starters */}
            <div
              className={`p-3.5 rounded-none border shadow-sm flex items-center justify-between ${
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
              className={`p-3.5 rounded-none border shadow-sm flex items-center justify-between ${
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
              className={`p-3.5 rounded-none border shadow-sm flex items-center justify-between ${
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
              className={`p-3.5 rounded-none border shadow-sm col-span-2 sm:col-span-1 flex items-center justify-between ${
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
            <div className="p-4 rounded-none bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-between gap-3 text-red-700 dark:text-red-300">
              <div className="flex items-center gap-2.5 text-xs font-bold">
                <ExclamationCircleIcon className="w-5 h-5 shrink-0 text-sffl-red" />
                <span>
                  One or more starting players belong to an inactive club. You must
                  bench or replace them before saving your lineup.
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
              onSwapWithSubstitute={(slot, playerId) =>
                handleReserveDrop(playerId, slot)
              }
              selectedUnitTab={selectedUnitTab}
              reserveDragActive={!!reserveDrag}
              dropHighlightSlot={reserveDrag?.over ?? null}
              onUnitTabChange={setSelectedUnitTab}
              actionSlot={actionSlot}
              onSlotClick={(slot, player) => {
                if (player) {
                  // A blocked starter opens the same Manage menu as anyone else,
                  // so they can be benched or replaced, not only swapped.
                  setActionSubstituteId(null);
                  setActionSlot(actionSlot === slot ? null : slot);
                } else {
                  const def = SLOT_DEFINITIONS.find((d) => d.slot === slot);
                  if (def) setActiveModalSlot(def);
                }
              }}
              isSlotInvalid={(slot) => {
                const issue = starterIssue(slot);
                return issue ? { invalid: true, reason: issue.reason } : false;
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
              substitutes={pitchSubstitutes}
              onSubstituteClick={handleSubstituteClick}
              onSubstitutePointerDown={(e, playerId) =>
                startReserveDrag(e, playerId)
              }
              draggingSubstituteId={reserveDrag?.playerId ?? null}
            />
          </div>

          {/* ──────────────────────────────────────────────────────────────
                        PUBLISH PANEL

                        Sits at the foot of the fourteen because that is the lineup it
                        publishes — and it is where a manager arrives once the last slot
                        is filled. Picks are already saved by the time they get here, so
                        this is not a save button: it is the deliberate act that puts the
                        squad into the scoring run, and the one place the rules blocking
                        that are spelled out.
                    ────────────────────────────────────────────────────────────── */}
          <div
            className={`rounded-none border shadow-sm overflow-hidden ${
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
                    className={`flex items-center gap-2 text-xs rounded-none px-2 py-1.5 transition-colors ${
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

              {blockedStarters.length > 0 && (
                <div className="mt-3 rounded-none border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-200 mb-2">
                    Can't start — bench them
                  </p>
                  <ul className="space-y-2">
                    {blockedStarters.map(({ def, player, issue }) => (
                      <li
                        key={def.slot}
                        className="flex flex-wrap items-center gap-2 text-xs"
                      >
                        <span className="min-w-0 flex-1 text-gray-800 dark:text-gray-100">
                          <strong className="font-black">
                            {player.player_name}
                          </strong>{" "}
                          <span className="text-gray-500 dark:text-gray-400">
                            ({def.label}) · {issue.reason}
                          </span>
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={ArrowUturnDownIcon}
                          onClick={() => handleMoveToBench(def.slot)}
                        >
                          {issue.owned ? "Bench" : "Remove"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* The server decides what is publishable, not this list. The
                            checks above are a local preview that exists so feedback is
                            instant; they mirror the rules rather than being them. When
                            the two disagree the server is right, so its own words are
                            shown instead of leaving a manager staring at a full set of
                            ticks and a sheet that will not publish. */}
              {calculations.isValid && currentLineup?.blocking_reason && (
                <p className="mt-3 flex items-start gap-2 text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 rounded-none px-2.5 py-2">
                  <ExclamationCircleIcon className="w-4 h-4 shrink-0 text-amber-500 mt-px" />
                  <span>{currentLineup.blocking_reason}</span>
                </p>
              )}
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────────
                        RESERVES SECTION — owned players who can never start
                        (club reserve, inactive or deleted). Eligible
                        substitutes live on the pitch card above instead.
                    ────────────────────────────────────────────────────────────── */}
          {reservePlayers.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none shadow-sm overflow-hidden">
              <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-sffl-red" />
                  Reserves
                  <span className="text-gray-400 font-bold">
                    ({reservePlayers.length})
                  </span>
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  On your bench, but can never start — on their club's reserve
                  list, inactive, or deleted.
                </p>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {reservePlayers.map((p) => {
                  const isReserveInactive =
                    p.team_active === false ||
                    isDeletedPlayer({ status: p.player_status });
                  const isClubReserve = !isReserveInactive && !!p.is_reserve;

                  return (
                    <div
                      key={p.player_id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-red-50/40 dark:bg-red-950/20 opacity-80"
                    >
                      <div className="relative filter grayscale opacity-60">
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
                          <h3 className="text-sm font-bold wrap-break-word text-gray-500 dark:text-gray-400 line-through">
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────
                MANAGE STARTER ACTION SHEET
            ──────────────────────────────────────────────────────────────────── */}
      <Modal
        open={!!(actionSlot && squad[actionSlot])}
        onClose={() => setActionSlot(null)}
        title="Manage starter"
        maxWidth="md"
        shape="square"
        position="right"
        closeOnBackdrop={false}
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
                  zoomable
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
                    <FantasyPlayerLink
                      id={squad[actionSlot]!.player_id}
                      title={`View ${squad[actionSlot]!.player_name}'s profile`}
                    >
                      {squad[actionSlot]!.player_name}
                    </FantasyPlayerLink>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-bold text-gray-700 dark:text-gray-200">
                      {squad[actionSlot]!.position || "Position unknown"}
                    </span>{" "}
                    • {squad[actionSlot]!.team_short_name ||
                      squad[actionSlot]!.team_name}{" "}
                    • {formatFantasyPrice(squad[actionSlot]!.price)}
                  </p>
                </div>
              </div>
            </div>

            <PlayerFormStats
              price={squad[actionSlot]!.price}
              loading={actionPlayerFormLoading}
              form={actionPlayerForm?.form}
              pointsPerGame={actionPlayerForm?.points_per_game}
              selectedByPct={actionPlayerForm?.selected_by_pct}
              recentGames={actionPlayerForm?.recent_games}
            />

            {starterIssue(actionSlot) && (
              <div
                role="alert"
                className="mx-4 mt-4 flex items-start gap-2 rounded-none border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-xs text-red-800 dark:text-red-200"
              >
                <ExclamationCircleIcon
                  className="w-4 h-4 shrink-0 mt-px text-sffl-red"
                  aria-hidden="true"
                />
                <span>
                  <strong>Cannot start:</strong>{" "}
                  {starterIssue(actionSlot)!.detail} Move them to the bench or
                  swap someone in.
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="p-4 space-y-2">
              <button
                type="button"
                onClick={() => setShowSubstituteOptions((v) => !v)}
                aria-expanded={showSubstituteOptions}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-none border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition cursor-pointer text-left"
              >
                <div className="p-2.5 rounded-none bg-sffl-navy/10 dark:bg-white/10 text-sffl-navy dark:text-white">
                  <ArrowsRightLeftIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-black text-gray-900 dark:text-white block">
                    Substitute
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    Swap in an eligible bench player
                  </span>
                </div>
                <ChevronDownIcon
                  className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${
                    showSubstituteOptions ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {showSubstituteOptions && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-none divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden max-h-64 overflow-y-auto">
                  {eligibleSubstitutesForSlot.length === 0 ? (
                    <p className="p-3.5 text-xs text-gray-500 dark:text-gray-400 text-center">
                      No eligible bench player for this slot.
                    </p>
                  ) : (
                    eligibleSubstitutesForSlot.map((p) => {
                      const meta = playerMetadataLookup.get(p.player_id);
                      return (
                        <button
                          key={p.player_id}
                          type="button"
                          onClick={() => handleReserveDrop(p.player_id, actionSlot)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition cursor-pointer text-left"
                        >
                          <PlayerAvatar
                            name={p.name}
                            image={p.image || meta?.image || undefined}
                            gender={p.gender}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-bold text-gray-900 dark:text-white block truncate">
                              {p.name}
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                              {p.position} • {formatFantasyPrice(p.purchase_price)}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
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

      {/* ────────────────────────────────────────────────────────────────────
                SUBSTITUTE DETAILS PANEL — tapping a pitch-card substitute
                opens this instead of starting them immediately.
            ──────────────────────────────────────────────────────────────────── */}
      <Modal
        open={!!(actionSubstituteId && actionSubstitutePlayer)}
        onClose={() => setActionSubstituteId(null)}
        title="Substitute details"
        maxWidth="md"
        shape="square"
        position="right"
        closeOnBackdrop={false}
      >
        {actionSubstitutePlayer && (
          <div className="text-gray-900 dark:text-white -m-4 sm:-m-6">
            {/* Player summary */}
            <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar
                  name={actionSubstitutePlayer.name}
                  image={
                    actionSubstitutePlayer.image ||
                    playerMetadataLookup.get(actionSubstitutePlayer.player_id)
                      ?.image ||
                    undefined
                  }
                  gender={actionSubstitutePlayer.gender}
                  size="md"
                  zoomable
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                      SUB
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      {actionSubstitutePlayer.position || "Position unknown"}
                    </span>
                  </div>
                  <h3 className="text-base font-black truncate text-gray-900 dark:text-white mt-0.5">
                    <FantasyPlayerLink
                      id={actionSubstitutePlayer.player_id}
                      title={`View ${actionSubstitutePlayer.name}'s profile`}
                    >
                      {actionSubstitutePlayer.name}
                    </FantasyPlayerLink>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-bold text-gray-700 dark:text-gray-200">
                      {actionSubstitutePlayer.position || "Position unknown"}
                    </span>{" "}
                    • {actionSubstitutePlayer.club_short_name ||
                      actionSubstitutePlayer.club_name}{" "}
                    • {formatFantasyPrice(actionSubstitutePlayer.purchase_price)}
                  </p>
                </div>
              </div>
            </div>

            <PlayerFormStats
              price={actionSubstitutePlayer.purchase_price}
              loading={actionPlayerFormLoading}
              form={actionPlayerForm?.form}
              pointsPerGame={actionPlayerForm?.points_per_game}
              selectedByPct={actionPlayerForm?.selected_by_pct}
              recentGames={actionPlayerForm?.recent_games}
            />

            {/* Action buttons */}
            <div className="p-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setActionSubstituteId(null);
                  handleStartReserve(actionSubstitutePlayer);
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-none border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition cursor-pointer text-left"
              >
                <div className="p-2.5 rounded-none bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                  <PlayCircleIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-black text-gray-900 dark:text-white block">
                    Start
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    Promote into an open matching slot
                  </span>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActionSubstituteId(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ────────────────────────────────────────────────────────────────────
                PLAYER SELECTION MODAL (owned players only — buying lives on
                the Transfers page now)
            ──────────────────────────────────────────────────────────────────── */}
      {activeModalSlot && (
        <Modal
          open
          onClose={() => setActiveModalSlot(null)}
          title={activeModalSlot.label}
          subtitle={`Selecting for ${activeModalSlot.slot}`}
          maxWidth="lg"
          shape="square"
        >
          {/* Slot rules */}
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-none bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
              {formatPositions(activeModalSlot.allowedPositions)}
            </span>
            {activeModalSlot.requiredGender && (
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-none border ${
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
          </div>

          <div className="space-y-2">
            {ownedForSlot.length === 0 ? (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                Nobody in your squad can play this slot.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 pt-1 pb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                    In your squad
                  </span>
                  <span className="text-[10px] font-bold text-gray-400">
                    {ownedForSlot.length}
                  </span>
                  <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>

                {ownedForSlot.map((p) => {
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
                      className={`px-3 py-2.5 rounded-none border flex items-center gap-3 transition ${
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
                            owned_by:
                              playerMetadataLookup.get(p.player_id)
                                ?.owned_by ?? 0,
                            selected_by_pct:
                              playerMetadataLookup.get(p.player_id)
                                ?.selected_by_pct ?? 0,
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
                })}
              </>
            )}
          </div>
        </Modal>
      )}

      <Modal
        open={!!violationModal}
        onClose={() => setViolationModal(null)}
        title={violationModal?.title || "Selection Blocked"}
        maxWidth="md"
        shape="square"
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

      {/* ────────────────────────────────────────────────────────────────────
                EDIT TEAM NAME MODAL
            ──────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showEditNameModal && !seasonHasStarted}
        onClose={() => setShowEditNameModal(false)}
        title="Edit Team Name"
        maxWidth="md"
        shape="square"
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

      {/* Reserve-drag floating ghost — a top-level portal, independent of any
                modal's open state, so it tracks the pointer the whole time a
                drag is in progress. */}
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
    </>
  );
}

interface PlayerFormStatsProps {
  price: number;
  loading: boolean;
  form?: number;
  pointsPerGame?: number;
  selectedByPct?: number;
  recentGames?: PlayerFormGame[];
}

// The season stats + "Last 5 Games" strip shown in both the Manage Starter
// and substitute details panels — identical markup, fed each player's own
// squad price and getPlayerForm() result.
function PlayerFormStats({
  price,
  loading,
  form,
  pointsPerGame,
  selectedByPct,
  recentGames,
}: PlayerFormStatsProps) {
  return (
    <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="p-2.5 rounded-none bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
          <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
            Price
          </span>
          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {formatFantasyPrice(price)}
          </span>
        </div>
        <div className="p-2.5 rounded-none bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
          <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
            Form
          </span>
          <span className="text-sm font-black text-gray-900 dark:text-white mt-0.5 block">
            {loading ? "—" : formatStatDecimal(form ?? 0, 1)}
          </span>
        </div>
        <div className="p-2.5 rounded-none bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
          <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
            Pts / Match
          </span>
          <span className="text-sm font-black text-gray-900 dark:text-white mt-0.5 block">
            {loading ? "—" : formatStatDecimal(pointsPerGame ?? 0, 1)}
          </span>
        </div>
        <div className="p-2.5 rounded-none bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
          <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
            Selected By
          </span>
          <span className="text-sm font-black text-gray-900 dark:text-white mt-0.5 block">
            {loading ? "—" : `${(selectedByPct ?? 0).toFixed(1)}%`}
          </span>
        </div>
      </div>

      <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-4 mb-2">
        Last 5 Games
      </h4>
      {loading ? (
        <p className="flex items-center justify-center gap-2 text-xs text-gray-500 py-3">
          <ArrowPathIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
          Loading recent form…
        </p>
      ) : recentGames && recentGames.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {recentGames.map((g) => (
            <div
              key={g.gameweek_id}
              className="shrink-0 w-16 flex flex-col items-center gap-1 p-2 rounded-none border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
            >
              <span className="text-[9px] font-black uppercase text-gray-400">
                GW{g.gameweek_number}
              </span>
              {g.opponent_logo ? (
                <img
                  src={g.opponent_logo}
                  alt={g.opponent_short_name || g.opponent_name || "Opponent"}
                  className="w-6 h-6 object-contain"
                />
              ) : (
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 truncate max-w-full">
                  {g.opponent_short_name || g.opponent_name || "—"}
                </span>
              )}
              <span
                className={`text-sm font-black ${
                  g.points > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : g.points < 0
                      ? "text-red-500"
                      : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {formatStatDecimal(g.points, 1)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 py-2 text-center">
          No match stats recorded yet this season.
        </p>
      )}
    </div>
  );
}
