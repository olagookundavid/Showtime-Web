import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  isDeletedPlayer,
  DELETED_TITLE,
} from "../../components/common/DeletedPlayer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  BoltIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  LockClosedIcon,
  LockOpenIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  ShieldCheckIcon,
  StarIcon,
  TrashIcon,
  TrophyIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  getMatches,
  getCompetitions,
  getAdminTeamSheet,
  getAdminMatchPlays,
  createPlay,
  updatePlay,
  deletePlay,
  getStatsCompare,
  getGameRules,
  upsertGameRules,
  recomputeScore,
  commitScore,
  setPBPLock,
  rederiveSituations,
  overrideMatchMVP,
  type SituationUpdate,
  type Match,
  type Competition,
  type TeamSheetPlayer,
  type MatchTeamSheet,
  type GamePlay,
  type PlayPayload,
  type GameRulesPayload,
  type TeamStat,
} from "../../services/api";
import { isReturnTD } from "../../utils/playClassification";
import { StatsTable } from "../../components/stats/StatsTable";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ConfirmSummary } from "../../components/ui/ConfirmSummary";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Spinner } from "../../components/ui/Spinner";
import { FootballIcon } from "../../components/icons/FootballIcon";
import { RunnerIcon } from "../../components/icons/RunnerIcon";
import { useAuth } from "../../contexts/AuthContext";
import { getPlayStatAccruals } from "../../utils/statAccrualDeriver";
import { formatMatchDate, formatMatchTime } from "../../utils/dateUtils";
import { DashboardPageHeader } from "../../components/dashboard/DashboardPageHeader";

// ─── Types ────────────────────────────────────────────────────────────────────

type Side = "home" | "away" | "";
type Kind = "" | "pass" | "run" | "xp" | "special" | "penalty" | "event";
type PassOutcome = "complete" | "incomplete" | "int" | "ta";
type RushOutcome = "sack" | "no_sack" | "bat_down" | "int";
type SackResult = "next_down" | "safety";
type PassDefenderAction = "FG" | "OB";
type PassFinalOutcome = "TD" | "next_down" | "INT" | "TO" | "pick6" | "SAF";
type IncompleteOption = "dropped" | "batted_down" | "uncatchable";
type SnapOutcome = "snap" | "bad_snap";
type BadSnapOutcome = "next_down" | "turnover" | "safety";

type RunStyle = "RUN" | "QBR";
type RunDefenderAction = "FG" | "OB";
type RunPlayOutcome = "TD" | "turnover" | "next_down";

type SpecialType = "KO" | "PUNT";
type ReceiverOutcome = "no_catch" | "catch" | "safety";
type SpecialDefenderAction = "FG" | "OB";
type SpecialPlayOutcome = "TD" | "next_down";

interface Ctx {
  quarter: number;
  driveNo: number;
  offense: Side;
  down: string;
  toGo: string;
  ballOn: string;
  clock: string;
  homeScore: string;
  awayScore: string;
}

interface Wizard {
  kind: Kind;
  // Pass flow
  snapOutcome?: SnapOutcome;
  badSnapOutcome?: BadSnapOutcome;
  rushOutcome?: RushOutcome;
  sackResult?: SackResult;
  passOutcome?: PassOutcome;
  passDefenderAction?: PassDefenderAction;
  passFinalOutcome?: PassFinalOutcome;
  incompleteOption?: IncompleteOption;

  // Run flow
  runStyle?: RunStyle;
  runDefenderAction?: RunDefenderAction;
  runPlayOutcome?: RunPlayOutcome;

  // XP flow
  xpType?: "PAT-R" | "XP-P";
  xpResult?: "XP" | "XPF";
  xpDefenseScored?: boolean;

  // Special flow
  specialType?: SpecialType;
  receiverOutcome?: ReceiverOutcome;
  specialDefenderAction?: SpecialDefenderAction;
  specialPlayOutcome?: SpecialPlayOutcome;

  // Event flow
  eventKind?: "IH" | "EH" | "EG" | "OMW";

  // Player selections & inputs
  qbId: string;
  targetId: string;
  carrierId: string;
  defenderId: string;
  rusherId: string;
  centerId: string;
  yards: string;
  notes: string;

  // Penalty (attached or standalone)
  penaltyOn: boolean;
  penaltyCode: string;
  penaltyTeam: Side;
  penaltyPlayerId: string;
  penaltyYards: string;

  editingId: string | null;
  // When set, the new play is inserted at this seq (shifting later plays down)
  // instead of appended to the end — used to slot in a missed play mid-game.
  insertSeq?: number;
  insertAfterLabel?: string;
}

// A snap precedes the scrimmage plays only. Throw-offs/punts, penalty-only rows
// and game events (end of half, injury…) are never snapped, so the Snap step is
// hidden for them and no center is booked on those rows.
const SNAP_KINDS: Kind[] = ["pass", "run", "xp"];
const isSnapKind = (k: Kind) => k === "" || SNAP_KINDS.includes(k);

const emptyWizard: Wizard = {
  kind: "",
  // 'snap' is the resting state so the highlighted chip always reflects real
  // state — a bad snap is only ever an explicit choice.
  snapOutcome: "snap",
  badSnapOutcome: "next_down",
  qbId: "",
  targetId: "",
  carrierId: "",
  defenderId: "",
  rusherId: "",
  centerId: "",
  yards: "",
  xpDefenseScored: false,
  penaltyOn: false,
  penaltyCode: "",
  penaltyTeam: "",
  penaltyPlayerId: "",
  penaltyYards: "",
  notes: "",
  editingId: null,
};

const PENALTY_LABELS: Record<string, string> = {
  FS: "False Start",
  OFF: "Offside",
  ENC: "Encroachment",
  DOG: "Delay of Game",
  OPI: "Off. Pass Interference",
  DPI: "Def. Pass Interference",
  FGD: "Flag Guarding",
  HLD: "Holding",
  RPC: "Roughing Passer",
  IMP: "Impeding",
  SUB: "Illegal Sub",
  IF: "Illegal Formation",
  MOT: "Illegal Motion",
  FAV: "Flag Violation",
  UF: "Unsportsmanlike",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toIntOrNull = (s: string): number | null => {
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
};

const getApiErrorMessage = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("response" in error))
    return undefined;
  const response = error.response;
  if (
    typeof response !== "object" ||
    response === null ||
    !("data" in response)
  )
    return undefined;
  const data = response.data;
  if (typeof data !== "object" || data === null || !("error" in data))
    return undefined;
  return typeof data.error === "string" ? data.error : undefined;
};

// Not every team has jersey numbers assigned yet, so players are picked by name
// (jersey number shown alongside when present, but never required).
const sortedRoster = (roster: TeamSheetPlayer[]) =>
  [...roster].sort((a, b) => a.name.localeCompare(b.name));

// ─── Player picker: searchable combobox (jersey # or name filtering) ────────────

interface PlayerFieldProps {
  label: string;
  value: string; // player_id
  onChange: (v: string) => void;
  roster: TeamSheetPlayer[];
  favoriteIds?: string[];
}

const PlayerField = ({
  label,
  value,
  onChange,
  roster,
  favoriteIds = [],
}: PlayerFieldProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedPlayer = roster.find((p) => p.player_id === value);

  // Resolve up to 3 favorites from roster
  const favoritePlayers = useMemo(() => {
    if (!favoriteIds || favoriteIds.length === 0) return [];
    return favoriteIds
      .map((id) => roster.find((p) => p.player_id === id))
      .filter((p): p is TeamSheetPlayer => Boolean(p))
      .slice(0, 3);
  }, [favoriteIds, roster]);

  // Smart dual search: numbers (jersey #) vs letters (name / position)
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return sortedRoster(roster);

    const cleanQuery = q.startsWith("#") ? q.slice(1) : q;
    const isNumeric = /^\d+$/.test(cleanQuery);

    if (isNumeric) {
      // Jersey number search: exact number matches first, then prefix matches
      return [...roster]
        .filter((p) => {
          if (p.jersey_number == null) return false;
          const jStr = String(p.jersey_number);
          return (
            jStr === cleanQuery ||
            jStr.startsWith(cleanQuery) ||
            jStr.includes(cleanQuery)
          );
        })
        .sort((a, b) => {
          const aStr = String(a.jersey_number || "");
          const bStr = String(b.jersey_number || "");
          if (aStr === cleanQuery && bStr !== cleanQuery) return -1;
          if (bStr === cleanQuery && aStr !== cleanQuery) return 1;
          if (aStr.startsWith(cleanQuery) && !bStr.startsWith(cleanQuery))
            return -1;
          if (bStr.startsWith(cleanQuery) && !aStr.startsWith(cleanQuery))
            return 1;
          return (a.jersey_number || 0) - (b.jersey_number || 0);
        });
    } else {
      // Text / Name search
      const qLower = q.toLowerCase();
      return [...roster]
        .filter((p) => {
          const nameMatch = p.name.toLowerCase().includes(qLower);
          const posMatch = p.position
            ? p.position.toLowerCase().includes(qLower)
            : false;
          return nameMatch || posMatch;
        })
        .sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(qLower);
          const bStarts = b.name.toLowerCase().startsWith(qLower);
          if (aStarts && !bStarts) return -1;
          if (bStarts && !aStarts) return 1;
          return a.name.localeCompare(b.name);
        });
    }
  }, [roster, query]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
          {label}
        </label>
        {selectedPlayer && (
          <span className="text-[11px] font-semibold text-sffl-red">
            #{selectedPlayer.jersey_number} {selectedPlayer.name}
          </span>
        )}
      </div>

      {/* Quick Favorites Pill Bar (up to 3) */}
      {favoritePlayers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
            <StarIcon className="w-3.5 h-3.5" aria-hidden="true" />
            Quick:
          </span>
          {favoritePlayers.map((p) => (
            <button
              key={p.player_id}
              type="button"
              onClick={() => {
                onChange(p.player_id);
                setQuery("");
                setIsOpen(false);
              }}
              className={`text-xs font-bold px-3 py-1 min-h-11 rounded-md border transition-all ${
                value === p.player_id
                  ? "bg-sffl-red text-white border-sffl-red shadow-sm"
                  : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600"
              }`}
            >
              {p.jersey_number ? `#${p.jersey_number} ` : ""}
              {p.name.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          placeholder={
            selectedPlayer
              ? `${selectedPlayer.name}${selectedPlayer.jersey_number ? ` (#${selectedPlayer.jersey_number})` : ""}`
              : "Type jersey # or name…"
          }
          value={
            isOpen
              ? query
              : selectedPlayer
                ? `${selectedPlayer.name}${selectedPlayer.jersey_number ? ` (#${selectedPlayer.jersey_number})` : ""}`
                : ""
          }
          onFocus={() => {
            setIsOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="w-full min-h-11 border border-gray-300 rounded-lg pl-3 pr-11 py-2 text-sm font-semibold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-sffl-red focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
            }}
            aria-label="Clear selection"
            className="absolute right-0 top-0 h-full min-w-11 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <XMarkIcon className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          <button
            type="button"
            onMouseDown={() => {
              onChange("");
              setIsOpen(false);
              setQuery("");
            }}
            className="w-full px-3 py-2 min-h-11 text-left text-xs font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            — Clear selection —
          </button>

          {/* If no active search query and favorites exist, show favorites section first */}
          {!query.trim() && favoritePlayers.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 bg-amber-50/60 dark:bg-amber-950/30 text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                <span className="inline-flex items-center gap-1">
                  <StarIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  Recent Favorites ({favoritePlayers.length})
                </span>
              </div>
              {favoritePlayers.map((p) => (
                <button
                  key={`fav-${p.player_id}`}
                  type="button"
                  onMouseDown={() => {
                    onChange(p.player_id);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  title={isDeletedPlayer(p) ? DELETED_TITLE : undefined}
                  className={`w-full px-3 py-2 min-h-11 text-left text-sm font-semibold hover:bg-sffl-red/10 dark:hover:bg-sffl-red/20 ${p.player_id === value ? "bg-sffl-red/10 text-sffl-red font-bold" : "text-gray-900 dark:text-white"} ${isDeletedPlayer(p) ? "opacity-60" : ""}`}
                >
                  {p.jersey_number ? (
                    <span className="inline-block w-8 text-sffl-red font-bold">
                      #{p.jersey_number}
                    </span>
                  ) : null}
                  <span
                    className={
                      isDeletedPlayer(p) ? "line-through decoration-1" : ""
                    }
                  >
                    {p.name}
                  </span>
                  {p.position ? (
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      ({p.position})
                    </span>
                  ) : null}
                  {isDeletedPlayer(p) && (
                    <span className="ml-2 text-[9px] font-black uppercase text-gray-400">
                      deleted
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div>
            {!query.trim() && favoritePlayers.length > 0 && (
              <div className="px-3 py-1 bg-gray-50 dark:bg-gray-700/50 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                All Players
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">
                No matching player
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.player_id}
                  type="button"
                  onMouseDown={() => {
                    onChange(p.player_id);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  title={isDeletedPlayer(p) ? DELETED_TITLE : undefined}
                  className={`w-full px-3 py-2 min-h-11 text-left text-sm font-semibold hover:bg-sffl-red/10 dark:hover:bg-sffl-red/20 ${p.player_id === value ? "bg-sffl-red/10 text-sffl-red font-bold" : "text-gray-900 dark:text-white"} ${isDeletedPlayer(p) ? "opacity-60" : ""}`}
                >
                  {p.jersey_number ? (
                    <span className="inline-block w-8 text-sffl-red font-bold">
                      #{p.jersey_number}
                    </span>
                  ) : null}
                  <span
                    className={
                      isDeletedPlayer(p) ? "line-through decoration-1" : ""
                    }
                  >
                    {p.name}
                  </span>
                  {p.position ? (
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      ({p.position})
                    </span>
                  ) : null}
                  {isDeletedPlayer(p) && (
                    <span className="ml-2 text-[9px] font-black uppercase text-gray-400">
                      deleted
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Game Situation Auto-Advancer ─────────────────────────────────────────────

const flipSide = (side: Side): Side =>
  side === "home" ? "away" : side === "away" ? "home" : "";

const sideOfTeam = (
  teamId: string | undefined,
  homeId?: string,
  awayId?: string,
): Side =>
  teamId && teamId === homeId
    ? "home"
    : teamId && teamId === awayId
      ? "away"
      : "";

// A play's stored pre-play snapshot expressed as a situation Ctx.
const playToCtx = (p: GamePlay, homeId?: string, awayId?: string): Ctx => ({
  quarter: p.quarter ?? 1,
  driveNo: p.drive_no ?? 1,
  offense: sideOfTeam(p.offense_team_id, homeId, awayId),
  down: p.down != null ? String(p.down) : "1",
  toGo: p.to_go != null ? String(p.to_go) : "10",
  ballOn: p.ball_on ?? "",
  clock: p.clock ?? "",
  homeScore: p.home_score_after != null ? String(p.home_score_after) : "0",
  awayScore: p.away_score_after != null ? String(p.away_score_after) : "0",
});

// Just the fields calculateNextSituation reads, from a stored play.
const playToAdvancePayload = (p: GamePlay): PlayPayload => ({
  yards: p.yards ?? undefined,
  result: p.result ?? undefined,
  returned_for_td: p.returned_for_td,
  play_type: p.play_type ?? undefined,
});

// A proposed situation change for one play, for the re-derive preview.
interface RederiveChange {
  play: GamePlay;
  oldCtx: Ctx;
  newCtx: Ctx;
}

// toGo can be 'Goal' (first-and-goal) which has no integer value → null.
const toGoToInt = (toGo: string): number | null => {
  const n = parseInt(toGo, 10);
  return isNaN(n) ? null : n;
};

const calculateNextSituation = (
  currentCtx: Ctx,
  payload: PlayPayload,
  downsPerSeries: number,
): Ctx => {
  const nextCtx = { ...currentCtx };
  const curDown = parseInt(currentCtx.down.replace(/[^0-9]/g, ""), 10) || 1;
  const curToGo = parseInt(currentCtx.toGo, 10) || 10;
  const isGoalSeries =
    currentCtx.down.includes("&G") || currentCtx.toGo.toLowerCase() === "goal";
  const yards = payload.yards ?? 0;
  const res = payload.result || "";
  const isTD = res === "TD" || payload.returned_for_td;
  const isXP = res === "XP" || res === "XPF";
  const isINT = res === "INT" || payload.play_type === "INT";
  const isTO = res === "TO";
  const isSAF = res === "SAF";
  const isFirstDown =
    res === "1D" || res === "1DG" || (yards > 0 && yards >= curToGo);

  // A new drive starting elsewhere (possession change, or a kickoff/PAT
  // return) makes the old numeric spot meaningless — and worse, still
  // labeled with the wrong team's prefix. Clear it rather than guess; the
  // admin types the real spot for the next play. Only a continuing drive
  // (same team, same down sequence) extrapolates from the old spot.
  const clearBallOn = () => {
    nextCtx.ballOn = "";
  };
  const advanceBallOn = () => {
    if (!currentCtx.ballOn) return;
    const parts = currentCtx.ballOn.trim().split(/\s+/);
    if (parts.length === 2) {
      const num = parseInt(parts[1], 10);
      if (!isNaN(num)) nextCtx.ballOn = `${parts[0]} ${num + yards}`;
    } else if (parts.length === 1) {
      const num = parseInt(parts[0], 10);
      if (!isNaN(num)) nextCtx.ballOn = `${num + yards}`;
    }
  };

  // Touchdown: the scoring team stays "on offense" for the extra-point try
  // that follows as a separate logged play.
  if (isTD) {
    if (payload.returned_for_td) {
      nextCtx.offense = flipSide(currentCtx.offense);
      nextCtx.driveNo = currentCtx.driveNo + 1;
    }
    nextCtx.down = "1";
    nextCtx.toGo = "10";
    clearBallOn();
    return nextCtx;
  }

  // Extra point (good or failed) is always followed by a kickoff/throw-off
  // to the other team — this is the actual possession change a scored
  // touchdown sets up, not the TD play itself.
  if (isXP || payload.play_type === "KO") {
    nextCtx.offense = flipSide(currentCtx.offense);
    nextCtx.driveNo = currentCtx.driveNo + 1;
    nextCtx.down = "1";
    nextCtx.toGo = "10";
    clearBallOn();
    return nextCtx;
  }

  if (isINT || isTO || isSAF) {
    nextCtx.offense = flipSide(currentCtx.offense);
    nextCtx.driveNo = currentCtx.driveNo + 1;
    nextCtx.down = "1";
    nextCtx.toGo = "10";
    clearBallOn();
    return nextCtx;
  }

  if (isFirstDown) {
    if (res === "1DG") {
      nextCtx.down = "1&G";
      nextCtx.toGo = "Goal";
    } else {
      nextCtx.down = "1";
      nextCtx.toGo = "10";
    }
    advanceBallOn();
    return nextCtx;
  }

  // Turnover on downs — driven by the competition's actual configured
  // downs-per-series (defaults to 4 only if the rule hasn't been set).
  if (curDown >= downsPerSeries) {
    nextCtx.offense = flipSide(currentCtx.offense);
    nextCtx.driveNo = currentCtx.driveNo + 1;
    nextCtx.down = "1";
    nextCtx.toGo = "10";
    clearBallOn();
    return nextCtx;
  }

  const nextNum = curDown + 1;
  nextCtx.down = isGoalSeries ? `${nextNum}&G` : String(nextNum);
  nextCtx.toGo = isGoalSeries ? "Goal" : String(Math.max(1, curToGo - yards));
  advanceBallOn();
  return nextCtx;
};

// A card that "lights up" as the admin reaches that step in the flow.
const Section = ({
  active,
  title,
  children,
}: {
  active: boolean;
  title: string;
  children: React.ReactNode;
}) => (
  <div
    className={`rounded-xl border p-4 transition-all ${active ? "border-sffl-red bg-sffl-red/5 dark:bg-sffl-red/10 shadow-sm" : "border-gray-200 dark:border-gray-700 opacity-60"}`}
  >
    <div className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-gray-200 mb-3">
      {title}
    </div>
    {children}
  </div>
);

// Every play-by-play write goes through the confirm dialog first.
type PbpAction =
  | { kind: "save"; payload: PlayPayload }
  | { kind: "delete"; play: GamePlay }
  | { kind: "lock"; lock: boolean };

// One cell of the re-derive preview: an unchanged value stays plain, a changed one shows old and new.
const ChangeCell = ({ from, to }: { from: string; to: string }) =>
  from === to ? (
    <span className="text-gray-500">{from}</span>
  ) : (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="text-gray-400 line-through">{from}</span>
      <ArrowRightIcon
        className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400"
        aria-hidden="true"
      />
      <span className="text-purple-600 dark:text-purple-400 font-bold">
        {to}
      </span>
    </span>
  );

const chip = (selected: boolean) =>
  `px-3 py-2 min-h-11 rounded-lg text-sm font-bold border transition-all ${
    selected
      ? "bg-sffl-red text-white border-sffl-red"
      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-sffl-red"
  }`;

// ─── Main ─────────────────────────────────────────────────────────────────────

export const AdminPlayByPlay = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Only admins may unlock/lock a match; referees/stats can log plays once open.
  const canToggleLock = user?.role === "admin" || user?.role === "app_admin";
  const [matchId, setMatchId] = useState("");
  const [selectedCompId, setSelectedCompId] = useState("");
  const [lockBusy, setLockBusy] = useState(false);
  const [ctx, setCtx] = useState<Ctx>({
    quarter: 1,
    driveNo: 1,
    offense: "",
    down: "1",
    toGo: "10",
    ballOn: "",
    clock: "",
    homeScore: "0",
    awayScore: "0",
  });
  const [w, setW] = useState<Wizard>(emptyWizard);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingAction, setPendingAction] = useState<PbpAction | null>(null);

  const [visibleCount, setVisibleCount] = useState(10);

  const { data: compData } = useQuery({
    queryKey: ["pbpCompetitions"],
    queryFn: () => getCompetitions(1, 100),
  });
  const competitions: Competition[] = (compData?.data || []).filter(
    (c) => c.status !== "inactive",
  );

  // Fetched by status rather than one plain "page 1" call: the backend sorts
  // the unfiltered list by date DESC, so any competition with upcoming
  // fixtures buries every already-played match below a full page of future
  // SCHEDULED ones and this dropdown would come up empty. Querying FINISHED
  // and LIVE directly guarantees they're actually fetched regardless of how
  // many SCHEDULED matches exist; SCHEDULED is fetched too (ascending, so
  // the nearest dates lead) to catch today's not-yet-kicked-off games.
  // The backend returns `data: null` (not `[]`) when a status filter has no
  // rows, so every leg is defaulted before spreading — otherwise a
  // competition with zero LIVE matches (the common case) throws on `[...null]`
  // and silently empties the whole dropdown.
  const { data: matchesData } = useQuery({
    queryKey: ["pbpMatches", selectedCompId],
    queryFn: async () => {
      const [finished, live, scheduled] = await Promise.all([
        getMatches(selectedCompId || undefined, 1, 100, "FINISHED"),
        getMatches(selectedCompId || undefined, 1, 50, "LIVE"),
        getMatches(selectedCompId || undefined, 1, 50, "SCHEDULED"),
      ]);
      return {
        data: [
          ...(finished.data || []),
          ...(live.data || []),
          ...(scheduled.data || []),
        ],
      };
    },
  });
  // Latest matches first — makes the most likely picks (today's/this week's
  // games) sit at the top instead of scattered through whatever order the
  // API returned.
  const matches: Match[] = useMemo(() => {
    const rawMatches = matchesData?.data || [];

    // Get today's YYYY-MM-DD in local time to accurately filter out future matches
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayDateOnly = `${year}-${month}-${day}`;

    // Only show matches that have been played (FINISHED / LIVE) or are scheduled for today or earlier
    const playableMatches = rawMatches.filter((m) => {
      if (m.status === "FINISHED" || m.status === "LIVE") return true;
      if (!m.date) return false;
      const matchDateOnly = m.date.includes("T")
        ? m.date.split("T")[0]
        : m.date.substring(0, 10);
      return matchDateOnly <= todayDateOnly;
    });

    return playableMatches.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [matchesData]);

  const visibleMatches: Match[] = useMemo(() => {
    const sliced = matches.slice(0, visibleCount);
    // If current match is outside the top slice, keep it included so selection doesn't break
    if (matchId && !sliced.some((m) => m.id === matchId)) {
      const currentMatch = matches.find((m) => m.id === matchId);
      if (currentMatch) {
        sliced.push(currentMatch);
        sliced.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
      }
    }
    return sliced;
  }, [matches, visibleCount, matchId]);

  interface MatchGroup {
    header: string;
    matches: Match[];
  }

  const groupedMatches: MatchGroup[] = useMemo(() => {
    const groupsMap = new Map<string, Match[]>();
    for (const m of visibleMatches) {
      const formattedDate = formatMatchDate(m.date, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const roundLabel = m.round ? m.round.trim() : "";
      const compLabel = m.competition?.name ? `(${m.competition.name})` : "";

      let headerKey = "";
      if (roundLabel) {
        headerKey = `${roundLabel} · ${formattedDate} ${compLabel}`.trim();
      } else {
        headerKey = `Game Day · ${formattedDate} ${compLabel}`.trim();
      }

      if (!groupsMap.has(headerKey)) {
        groupsMap.set(headerKey, []);
      }
      groupsMap.get(headerKey)!.push(m);
    }

    const result: MatchGroup[] = [];
    groupsMap.forEach((matchesInGroup, header) => {
      result.push({ header, matches: matchesInGroup });
    });
    return result;
  }, [visibleMatches]);

  const match = matches.find((m) => m.id === matchId);
  // Play-by-play is locked per match by default; treat unknown as locked.
  const locked = !!matchId && match?.pbp_locked !== false;

  // A match picked under one competition means nothing once the filter
  // switches to another, so drop the selection rather than leave a stale
  // match (and its wizard state) pointed at a game no longer in the list.
  useEffect(() => {
    setMatchId("");
    setW(emptyWizard);
  }, [selectedCompId]);

  const requestLockToggle = () => {
    if (!matchId || lockBusy) return;
    setPendingAction({ kind: "lock", lock: !locked });
  };

  const toggleLock = async (lock: boolean) => {
    setLockBusy(true);
    try {
      const nowLocked = await setPBPLock(matchId, lock);
      toast.success(
        nowLocked
          ? "Play-by-play locked for this match"
          : "Play-by-play unlocked — you can edit plays",
      );
      await queryClient.invalidateQueries({ queryKey: ["pbpMatches"] });
    } catch (e: unknown) {
      const error = e as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || "Failed to change the lock");
    } finally {
      setLockBusy(false);
    }
  };

  const { data: teamSheet } = useQuery({
    queryKey: ["pbpTeamSheet", matchId],
    queryFn: () => getAdminTeamSheet(matchId),
    enabled: !!matchId,
  });

  const { data: plays = [], isLoading: playsLoading } = useQuery({
    queryKey: ["pbpPlays", matchId],
    queryFn: () => getAdminMatchPlays(matchId),
    enabled: !!matchId,
  });

  // Needed by the auto-advancer below so "downs per series" reflects the
  // competition's actual configured rule instead of assuming 4.
  const competitionId = match?.competition?.id || "";
  const { data: activeRules } = useQuery({
    queryKey: ["pbpRules", competitionId],
    queryFn: () => getGameRules(competitionId),
    enabled: !!competitionId,
  });
  const downsPerSeries = activeRules?.downs_per_series || 4;

  const homeRoster = teamSheet?.home_team || [];
  const awayRoster = teamSheet?.away_team || [];
  const hasRosters = homeRoster.length > 0 && awayRoster.length > 0;

  const offenseRoster =
    ctx.offense === "home"
      ? homeRoster
      : ctx.offense === "away"
        ? awayRoster
        : [];
  const defenseRoster =
    ctx.offense === "home"
      ? awayRoster
      : ctx.offense === "away"
        ? homeRoster
        : [];
  const penaltyRoster =
    w.penaltyTeam === "home"
      ? homeRoster
      : w.penaltyTeam === "away"
        ? awayRoster
        : [];
  // An injury can be to any player on either team, so its picker spans both sheets.
  const bothRoster = [...homeRoster, ...awayRoster];

  // Seed the context bar from the last logged play (no rules engine yet — just a
  // sensible starting point the admin can overtype). Depends on the `plays`
  // array itself (not just its length) so a Recompute — which rewrites the
  // score on existing plays without changing how many there are — still
  // refreshes the Home/Away score boxes here.
  useEffect(() => {
    if (w.editingId) return;
    if (plays.length === 0) return;
    const last = plays[plays.length - 1];
    const offense: Side =
      last.offense_team_id === match?.home_team?.id
        ? "home"
        : last.offense_team_id === match?.away_team?.id
          ? "away"
          : "";
    setCtx((c) => ({
      ...c,
      quarter: last.quarter ?? c.quarter,
      driveNo: last.drive_no ?? c.driveNo,
      offense,
      down: last.down != null ? String(last.down) : c.down,
      toGo: last.to_go != null ? String(last.to_go) : c.toGo,
      ballOn: last.ball_on ?? "",
      homeScore:
        last.home_score_after != null
          ? String(last.home_score_after)
          : c.homeScore,
      awayScore:
        last.away_score_after != null
          ? String(last.away_score_after)
          : c.awayScore,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plays, matchId]);

  const [recentPlayers, setRecentPlayers] = useState<Record<string, string[]>>(
    {},
  );
  const syncedOffenseRef = useRef<string>("");

  const offenseTeamId =
    ctx.offense === "home"
      ? match?.home_team?.id
      : ctx.offense === "away"
        ? match?.away_team?.id
        : undefined;
  const defenseTeamId =
    ctx.offense === "home"
      ? match?.away_team?.id
      : ctx.offense === "away"
        ? match?.home_team?.id
        : undefined;
  const penaltyTeamId =
    w.penaltyTeam === "home"
      ? match?.home_team?.id
      : w.penaltyTeam === "away"
        ? match?.away_team?.id
        : offenseTeamId;

  // Seed recent/favorite players from the existing match plays
  useEffect(() => {
    if (!plays || plays.length === 0 || !match) return;
    const initialRecents: Record<string, string[]> = {};
    const addRecent = (roleKey: string, playerId?: string) => {
      if (!playerId) return;
      const list = initialRecents[roleKey] || [];
      if (!list.includes(playerId)) {
        list.push(playerId);
        initialRecents[roleKey] = list.slice(0, 3);
      }
    };

    const reversedPlays = [...plays].sort(
      (a, b) => (b.seq ?? 0) - (a.seq ?? 0),
    );
    for (const p of reversedPlays) {
      const offTeamId = p.offense_team_id;
      const defTeamId =
        offTeamId === match.home_team?.id
          ? match.away_team?.id
          : match.home_team?.id;

      if (offTeamId) {
        if (p.center_id) addRecent(`${offTeamId}_center`, p.center_id);
        if (p.off_qb_id) addRecent(`${offTeamId}_qb`, p.off_qb_id);
        if (p.target_id) {
          addRecent(`${offTeamId}_target`, p.target_id);
          addRecent(`${offTeamId}_carrier`, p.target_id);
        }
      }
      if (defTeamId) {
        if (p.rusher_id) addRecent(`${defTeamId}_rusher`, p.rusher_id);
        if (p.defender_id) addRecent(`${defTeamId}_defender`, p.defender_id);
      }
    }

    setRecentPlayers((prev) => ({ ...initialRecents, ...prev }));
  }, [plays, match]);

  const getFavorites = (teamId: string | undefined, role: string): string[] => {
    if (!teamId) return [];
    return recentPlayers[`${teamId}_${role}`] || [];
  };

  const handlePlayerSelect = (
    wizardField: keyof Wizard,
    teamId: string | undefined,
    role: string,
    playerId: string,
  ) => {
    setField(wizardField, playerId);
    if (playerId && teamId) {
      setRecentPlayers((prev) => {
        const roleKey = `${teamId}_${role}`;
        const existing = prev[roleKey] || [];
        const filtered = existing.filter((id) => id !== playerId);
        return {
          ...prev,
          [roleKey]: [playerId, ...filtered].slice(0, 3),
        };
      });
    }
  };

  // Sticky Center & QB for current offense
  const stickyCenter =
    (offenseTeamId && recentPlayers[`${offenseTeamId}_center`]?.[0]) || "";
  const stickyQb =
    (offenseTeamId && recentPlayers[`${offenseTeamId}_qb`]?.[0]) || "";

  const resetWizard = () => {
    setW({
      ...emptyWizard,
      centerId: stickyCenter,
      qbId: stickyQb,
    });
  };

  // Keep sticky Center/QB synced when offense changes
  useEffect(() => {
    if (!offenseTeamId) return;
    if (syncedOffenseRef.current !== offenseTeamId) {
      syncedOffenseRef.current = offenseTeamId;
      const teamCenter = recentPlayers[`${offenseTeamId}_center`]?.[0] || "";
      const teamQb = recentPlayers[`${offenseTeamId}_qb`]?.[0] || "";
      setW((prev) => {
        if (prev.editingId) return prev;
        return {
          ...prev,
          centerId: teamCenter || prev.centerId,
          qbId: teamQb || prev.qbId,
        };
      });
    }
  }, [offenseTeamId, recentPlayers]);

  const setField = <K extends keyof Wizard>(k: K, v: Wizard[K]) =>
    setW((prev) => ({ ...prev, [k]: v }));

  // A bad snap is a complete play on its own — it needs no "what happened"
  // kind, so everything downstream keys off this rather than `w.kind`.
  const isBadSnap = w.snapOutcome === "bad_snap" && isSnapKind(w.kind);

  // Build the API payload from the wizard + context.
  const buildPayload = (): { payload: PlayPayload | null; error?: string } => {
    const base: PlayPayload = {
      quarter: ctx.quarter,
      drive_no: ctx.driveNo,
      offense_team_id: offenseTeamId,
      down: toIntOrNull(ctx.down),
      to_go: toIntOrNull(ctx.toGo),
      ball_on: ctx.ballOn || undefined,
      clock: ctx.clock || undefined,
      home_score_after: toIntOrNull(ctx.homeScore),
      away_score_after: toIntOrNull(ctx.awayScore),
      notes: w.notes || undefined,
      // Mid-sequence insert: place at this seq (backend shifts later plays down).
      ...(w.insertSeq != null && !w.editingId ? { seq: w.insertSeq } : {}),
    };

    if (isBadSnap) {
      if (ctx.offense === "")
        return { payload: null, error: "Pick which team has the ball first." };
      if (!w.centerId) return { payload: null, error: "Select the Center." };
      base.center_id = w.centerId;
      base.play_type = "BADSNAP";
      const outcome = w.badSnapOutcome || "next_down";
      if (outcome === "turnover") {
        base.result = "TO";
      } else if (outcome === "safety") {
        base.result = "SAF";
        base.defender_id = w.defenderId || undefined;
      } else {
        base.result = "DB";
      }
      // Falls through to the shared penalty block below — a bad snap can
      // still carry a flag, same as every other play.
    } else {
      // Only scrimmage plays are snapped; never book a center on a
      // throw-off, punt, penalty-only row or game event.
      if (w.centerId && isSnapKind(w.kind)) {
        base.center_id = w.centerId;
      }
      switch (w.kind) {
        case "pass": {
          if (ctx.offense === "")
            return {
              payload: null,
              error: "Pick which team has the ball first.",
            };
          base.off_qb_id = w.qbId || undefined;
          if (!base.off_qb_id)
            return { payload: null, error: "Select the QB." };
          if (!w.centerId)
            return { payload: null, error: "Select the Center." };

          if (!w.rushOutcome)
            return {
              payload: null,
              error: "Select what happened on the Rush.",
            };

          if (w.rushOutcome === "sack") {
            if (!w.sackResult)
              return {
                payload: null,
                error: "Select Sack result (Next Down or Safety).",
              };
            base.play_type = "SACK";
            base.rusher_id = w.rusherId || undefined;
            base.yards = toIntOrNull(w.yards);
            base.result = w.sackResult === "safety" ? "SAF" : "FG";
          } else if (w.rushOutcome === "bat_down") {
            base.play_type = "INC";
            base.result = "INC";
            base.rusher_id = w.rusherId || undefined;
            base.batted_down = true;
          } else if (w.rushOutcome === "int") {
            base.play_type = "INT";
            base.result = "INT";
            base.rusher_id = w.rusherId || undefined;
            base.target_id = w.targetId || undefined;
          } else if (w.rushOutcome === "no_sack") {
            base.rusher_id = w.rusherId || undefined;
            if (!w.passOutcome)
              return {
                payload: null,
                error: "Select Pass outcome (Complete or Incomplete).",
              };

            if (w.passOutcome === "complete") {
              if (!w.targetId)
                return { payload: null, error: "Select Target receiver." };
              base.target_id = w.targetId;
              base.yards = toIntOrNull(w.yards);
              base.defender_id = w.defenderId || undefined;

              if (!w.passFinalOutcome)
                return { payload: null, error: "Select Final Outcome." };

              // A completed pass can only end as a catch that stands: a
              // touchdown, a tackle short of the sticks (next down / turnover
              // on downs), or a safety. Interceptions are NOT completions —
              // they're recorded via the "Intercepted" pass outcome instead,
              // so they credit the defence (and never a reception here).
              switch (w.passFinalOutcome) {
                case "TD":
                  base.play_type = "TDP";
                  base.result = "TD";
                  break;
                case "next_down":
                  base.play_type = "CP";
                  base.result = w.passDefenderAction === "OB" ? "OB" : "FG";
                  break;
                case "TO":
                  base.play_type = "CP";
                  base.result = "TO";
                  break;
                case "SAF":
                  base.play_type = "CP";
                  base.result = "SAF";
                  break;
              }
            } else if (w.passOutcome === "incomplete") {
              base.play_type = "INC";
              base.target_id = w.targetId || undefined;

              if (w.incompleteOption === "dropped") {
                base.dropped = true;
              } else if (w.incompleteOption === "batted_down") {
                base.batted_down = true;
                base.defender_id = w.defenderId || undefined;
              } else if (w.incompleteOption === "uncatchable") {
                base.uncatchable = true;
              }

              // The incompletion still ends a down: either the offence
              // keeps the ball (next down) or gives it up (turnover on
              // downs). The stat booking is identical either way.
              if (!w.passFinalOutcome)
                return {
                  payload: null,
                  error:
                    "Select Play Outcome (Next Down or Turnover on downs).",
                };
              base.result = w.passFinalOutcome === "TO" ? "TO" : "INC";
            } else if (w.passOutcome === "int") {
              base.play_type = "INT";
              base.result = "INT";
              base.target_id = w.targetId || undefined;
              base.defender_id = w.defenderId || undefined;
              if (w.passFinalOutcome === "pick6") base.returned_for_td = true;
            } else if (w.passOutcome === "ta") {
              base.play_type = "TA";
              if (!w.passFinalOutcome)
                return {
                  payload: null,
                  error:
                    "Select Play Outcome (Next Down or Turnover on downs).",
                };
              base.result = w.passFinalOutcome === "TO" ? "TO" : "INC";
            }
          }
          break;
        }
        case "run": {
          if (ctx.offense === "")
            return {
              payload: null,
              error: "Pick which team has the ball first.",
            };
          base.play_type = "RUN";
          base.off_qb_id = w.carrierId || undefined;
          if (!base.off_qb_id)
            return { payload: null, error: "Select the carrier." };
          base.yards = toIntOrNull(w.yards);
          base.defender_id = w.defenderId || undefined;

          if (!w.runPlayOutcome)
            return { payload: null, error: "Select Play Outcome." };

          if (w.runPlayOutcome === "TD") {
            base.result = "TD";
          } else if (w.runPlayOutcome === "turnover") {
            base.result = "TO";
          } else if (w.runPlayOutcome === "next_down") {
            base.result = w.runDefenderAction === "OB" ? "OB" : "FG";
          }
          break;
        }
        case "xp": {
          if (ctx.offense === "")
            return {
              payload: null,
              error: "Pick which team is trying the extra point.",
            };
          if (!w.xpType)
            return { payload: null, error: "Run or pass extra point?" };
          base.play_type = w.xpType;
          base.result = w.xpResult || "XP";
          if (w.xpType === "XP-P") {
            base.off_qb_id = w.qbId || undefined;
            base.target_id = w.targetId || undefined;
          } else {
            base.off_qb_id = w.carrierId || undefined;
          }
          if (w.xpResult === "XPF" && w.xpDefenseScored) {
            if (!w.defenderId)
              return {
                payload: null,
                error: "Select the defender who scored.",
              };
            base.defender_id = w.defenderId;
            base.returned_for_td = true;
          }
          break;
        }
        case "special": {
          if (!w.specialType)
            return { payload: null, error: "Throw-off or punt?" };
          base.play_type = w.specialType;
          if (w.receiverOutcome === "no_catch") {
            base.result = "DB";
          } else if (w.receiverOutcome === "safety") {
            base.result = "SAF";
            base.target_id = w.targetId || undefined;
            base.defender_id = w.defenderId || undefined;
          } else if (w.receiverOutcome === "catch") {
            base.target_id = w.targetId || undefined;
            base.defender_id = w.defenderId || undefined;
            base.result =
              w.specialPlayOutcome === "TD"
                ? "TD"
                : w.specialDefenderAction === "OB"
                  ? "OB"
                  : "FG";
            // The returner (target) is on the RECEIVING team, which is the
            // opposite of offense_team_id (the kicking/punting team, per
            // ctx.offense at the moment this play is logged). Flagging it
            // "returned for TD" routes scoring through the same
            // defense-scores branch already used for pick-six returns, so
            // the receiving team is credited instead of the kicking team.
            if (w.specialPlayOutcome === "TD") base.returned_for_td = true;
          } else {
            base.result = "DB";
          }
          break;
        }
        case "penalty": {
          if (w.penaltyTeam === "")
            return {
              payload: null,
              error: "Which team committed the penalty?",
            };
          if (!w.penaltyCode)
            return { payload: null, error: "Pick the penalty." };
          base.result = "DB";
          base.penalty = w.penaltyCode;
          base.penalty_team_id =
            w.penaltyTeam === "home"
              ? match?.home_team?.id
              : match?.away_team?.id;
          base.penalty_player_id = w.penaltyPlayerId || undefined;
          base.penalty_yards = toIntOrNull(w.penaltyYards);
          return { payload: base };
        }
        case "event": {
          if (!w.eventKind)
            return { payload: null, error: "Pick the game event." };
          base.result = w.eventKind;
          // An injury names the affected player (stored in off_qb_id — an
          // event row has no play_type, so no stat/score engine reads it).
          if (w.eventKind === "IH") {
            if (!w.qbId)
              return { payload: null, error: "Select the injured player." };
            base.off_qb_id = w.qbId;
          }
          return { payload: base };
        }
        default:
          return { payload: null, error: "Pick what happened." };
      }
    }

    // Optional penalty attached to a play above.
    if (w.penaltyCode) {
      base.penalty = w.penaltyCode;
      base.penalty_team_id =
        w.penaltyTeam === "home"
          ? match?.home_team?.id
          : w.penaltyTeam === "away"
            ? match?.away_team?.id
            : undefined;
      base.penalty_player_id = w.penaltyPlayerId || undefined;
      base.penalty_yards = toIntOrNull(w.penaltyYards);
    }

    return { payload: base };
  };

  // The backend rebuilds the score AND writes the player/team stats on every
  // play mutation now (PlayService.syncDerived) — stats are live, there's no
  // commit step — so there's nothing to trigger from here, only stale views to
  // refetch. Team sheets are included because player ratings are computed from
  // the stats that just changed. The standalone "Recompute score" button still
  // exists for what a play mutation doesn't cover, e.g. editing point values.
  const syncScoreAndStats = async () => {
    await queryClient.invalidateQueries({ queryKey: ["pbpPlays", matchId] });
    queryClient.invalidateQueries({ queryKey: ["pbpCompare", matchId] });
    queryClient.invalidateQueries({ queryKey: ["pbpTeamSheet", matchId] });
    queryClient.invalidateQueries({ queryKey: ["adminMatchDetail", matchId] });
    queryClient.invalidateQueries({
      queryKey: ["publicMatchStatsCompare", matchId],
    });
  };

  // Runs before the confirm dialog opens, so it never asks about a play that can't be saved.
  const requestSave = () => {
    if (locked) {
      toast.error(
        "Play-by-play is locked. Ask an admin to unlock this match first.",
      );
      return;
    }
    const { payload, error } = buildPayload();
    if (error || !payload) {
      toast.error(error || "Incomplete play");
      return;
    }
    setPendingAction({ kind: "save", payload });
  };

  const handleSave = async (payload: PlayPayload) => {
    setSaving(true);
    try {
      if (w.editingId) {
        await updatePlay(matchId, w.editingId, payload);
        toast.success("Play updated");
      } else if (w.insertSeq != null) {
        await createPlay(matchId, payload);
        toast.success("Play inserted");
        // Don't auto-advance the situation on an insert — the context bar
        // reflects the insertion point, not the (unchanged) end of the log.
      } else {
        await createPlay(matchId, payload);
        toast.success("Play added");
        // Auto-advance down, distance, ball-on for the next play
        setCtx((c) => calculateNextSituation(c, payload, downsPerSeries));
      }
      await syncScoreAndStats();
      resetWizard();
    } catch (e: unknown) {
      const error = e as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || "Failed to save play");
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (play: GamePlay) => {
    if (locked) {
      toast.error(
        "Play-by-play is locked. Ask an admin to unlock this match first.",
      );
      return;
    }
    setPendingAction({ kind: "delete", play });
  };

  const handleDelete = async (playId: string) => {
    setDeleting(true);
    try {
      await deletePlay(matchId, playId);
      toast.success("Play deleted");
      await syncScoreAndStats();
    } catch {
      toast.error("Failed to delete play");
    } finally {
      setDeleting(false);
    }
  };

  // Runs once the admin confirms. The handlers report their own errors, so the
  // dialog always closes afterwards.
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "save") await handleSave(pendingAction.payload);
    else if (pendingAction.kind === "delete")
      await handleDelete(pendingAction.play.id);
    else await toggleLock(pendingAction.lock);
    setPendingAction(null);
  };

  // Begin inserting a missed play immediately AFTER play `p`. The new play takes
  // p.seq + 1 and the backend shifts everything after it down, so it lands in the
  // right spot instead of at the end. The situation bar is seeded from `p` as an
  // editable starting point.
  const startInsertAfter = (p: GamePlay) => {
    if (locked) {
      toast.error(
        "Play-by-play is locked. Ask an admin to unlock this match first.",
      );
      return;
    }
    const offense: Side =
      p.offense_team_id === match?.home_team?.id
        ? "home"
        : p.offense_team_id === match?.away_team?.id
          ? "away"
          : "";
    setCtx((c) => ({
      ...c,
      quarter: p.quarter ?? c.quarter,
      driveNo: p.drive_no ?? c.driveNo,
      offense,
      down: p.down != null ? String(p.down) : c.down,
      toGo: p.to_go != null ? String(p.to_go) : c.toGo,
      ballOn: p.ball_on ?? "",
      clock: p.clock ?? "",
      homeScore:
        p.home_score_after != null ? String(p.home_score_after) : c.homeScore,
      awayScore:
        p.away_score_after != null ? String(p.away_score_after) : c.awayScore,
    }));
    setW({
      ...emptyWizard,
      insertSeq: (p.seq ?? 0) + 1,
      insertAfterLabel: `#${p.seq}`,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // "Re-derive from here": treat `anchor`'s snapshot as trusted and recompute the
  // down/distance/possession/drive of every following play with the same
  // auto-advancer used during live entry. Builds a preview; nothing is written
  // until the admin confirms. Quarter, ball-on and clock are left untouched.
  const [rederive, setRederive] = useState<{
    anchor: GamePlay;
    changes: RederiveChange[];
  } | null>(null);
  const [rederiveBusy, setRederiveBusy] = useState(false);

  const startRederive = (anchor: GamePlay) => {
    if (locked) {
      toast.error(
        "Play-by-play is locked. Ask an admin to unlock this match first.",
      );
      return;
    }
    const homeId = match?.home_team?.id;
    const awayId = match?.away_team?.id;
    const ordered = [...plays].sort((a, b) => a.seq - b.seq);
    const idx = ordered.findIndex((p) => p.id === anchor.id);
    if (idx === -1) return;
    let prevCtx = playToCtx(anchor, homeId, awayId);
    let prevPlay = anchor;
    const changes: RederiveChange[] = [];
    for (let i = idx + 1; i < ordered.length; i++) {
      const cur = ordered[i];
      const newCtx = calculateNextSituation(
        prevCtx,
        playToAdvancePayload(prevPlay),
        downsPerSeries,
      );
      const oldCtx = playToCtx(cur, homeId, awayId);
      if (
        oldCtx.down !== newCtx.down ||
        oldCtx.toGo !== newCtx.toGo ||
        oldCtx.offense !== newCtx.offense ||
        oldCtx.driveNo !== newCtx.driveNo
      ) {
        changes.push({ play: cur, oldCtx, newCtx });
      }
      prevCtx = newCtx;
      prevPlay = cur;
    }
    if (changes.length === 0) {
      toast.success(
        "Situations already consistent from here — nothing to change.",
      );
      return;
    }
    setRederive({ anchor, changes });
  };

  const confirmRederive = async () => {
    if (!rederive) return;
    const homeId = match?.home_team?.id;
    const awayId = match?.away_team?.id;
    setRederiveBusy(true);
    try {
      const updates: SituationUpdate[] = rederive.changes.map((ch) => ({
        id: ch.play.id,
        drive_no: ch.newCtx.driveNo,
        down: toGoToInt(ch.newCtx.down),
        to_go: toGoToInt(ch.newCtx.toGo),
        offense_team_id:
          ch.newCtx.offense === "home"
            ? homeId
            : ch.newCtx.offense === "away"
              ? awayId
              : undefined,
      }));
      await rederiveSituations(matchId, updates);
      toast.success(
        `Re-derived ${updates.length} play${updates.length === 1 ? "" : "s"}`,
      );
      setRederive(null);
      await syncScoreAndStats();
    } catch (e: unknown) {
      const errorMessage =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: unknown } } }).response?.data
              ?.error
          : undefined;
      toast.error(
        typeof errorMessage === "string"
          ? errorMessage
          : "Failed to re-derive situations",
      );
    } finally {
      setRederiveBusy(false);
    }
  };

  // Load an existing play back into the context + wizard for editing.
  const startEdit = (p: GamePlay) => {
    const offense: Side =
      p.offense_team_id === match?.home_team?.id
        ? "home"
        : p.offense_team_id === match?.away_team?.id
          ? "away"
          : "";
    setCtx((c) => ({
      ...c,
      quarter: p.quarter ?? 1,
      driveNo: p.drive_no ?? 1,
      offense,
      down: p.down != null ? String(p.down) : "",
      toGo: p.to_go != null ? String(p.to_go) : "",
      ballOn: p.ball_on ?? "",
      clock: p.clock ?? "",
      homeScore:
        p.home_score_after != null ? String(p.home_score_after) : c.homeScore,
      awayScore:
        p.away_score_after != null ? String(p.away_score_after) : c.awayScore,
    }));
    // Best-effort reverse mapping into the wizard from the stored codes.
    const pt = p.play_type || "";
    const res = p.result || "";
    const nw: Wizard = {
      ...emptyWizard,
      editingId: p.id,
      notes: p.notes || "",
    };

    if (["CP", "INC", "TDP", "INT", "TA", "SACK"].includes(pt)) {
      nw.kind = "pass";
      nw.qbId = p.off_qb?.id || "";
      nw.targetId = p.target?.id || "";
      nw.defenderId = p.defender?.id || "";
      nw.rusherId = p.rusher?.id || "";
      nw.centerId = p.center?.id || "";
      nw.snapOutcome = "snap";
      nw.yards = p.yards != null ? String(p.yards) : "";

      if (pt === "SACK") {
        nw.rushOutcome = "sack";
        nw.sackResult = res === "SAF" ? "safety" : "next_down";
      } else if (pt === "INC" && p.batted_down && !p.target) {
        nw.rushOutcome = "bat_down";
      } else if (pt === "INT" && !p.target) {
        nw.rushOutcome = "int";
      } else if (pt === "INT") {
        // Interception with a target = the "Intercepted" pass outcome.
        nw.rushOutcome = "no_sack";
        nw.passOutcome = "int";
        nw.passFinalOutcome = p.returned_for_td ? "pick6" : "INT";
      } else if (pt === "TA") {
        nw.rushOutcome = "no_sack";
        nw.passOutcome = "ta";
        nw.passFinalOutcome = res === "TO" ? "TO" : "next_down";
      } else {
        nw.rushOutcome = "no_sack";
        if (pt === "INC") {
          nw.passOutcome = "incomplete";
          if (p.dropped) nw.incompleteOption = "dropped";
          else if (p.batted_down) nw.incompleteOption = "batted_down";
          else if (p.uncatchable) nw.incompleteOption = "uncatchable";
          nw.passFinalOutcome = res === "TO" ? "TO" : "next_down";
        } else {
          nw.passOutcome = "complete";
          nw.passDefenderAction = res === "OB" ? "OB" : "FG";
          if (pt === "TDP" || res === "TD") nw.passFinalOutcome = "TD";
          else if (res === "TO") nw.passFinalOutcome = "TO";
          else if (res === "SAF") nw.passFinalOutcome = "SAF";
          else nw.passFinalOutcome = "next_down";
        }
      }
    } else if (pt === "BADSNAP") {
      nw.kind = "pass";
      nw.qbId = p.off_qb?.id || "";
      nw.snapOutcome = "bad_snap";
      nw.centerId = p.center?.id || "";
      if (res === "TO") {
        nw.badSnapOutcome = "turnover";
      } else if (res === "SAF") {
        nw.badSnapOutcome = "safety";
        nw.defenderId = p.defender?.id || "";
      } else {
        nw.badSnapOutcome = "next_down";
      }
    } else if (["RUN", "QBR"].includes(pt)) {
      nw.kind = "run";
      nw.runStyle = pt === "QBR" ? "QBR" : "RUN";
      nw.carrierId = p.off_qb?.id || "";
      nw.defenderId = p.defender?.id || "";
      nw.yards = p.yards != null ? String(p.yards) : "";
      nw.runDefenderAction = res === "OB" ? "OB" : "FG";
      if (res === "TD") nw.runPlayOutcome = "TD";
      else if (res === "TO") nw.runPlayOutcome = "turnover";
      else nw.runPlayOutcome = "next_down";
    } else if (pt === "XP-P" || pt === "PAT-R") {
      nw.kind = "xp";
      nw.xpType = pt;
      nw.xpResult = res === "XPF" ? "XPF" : "XP";
      nw.qbId = p.off_qb?.id || "";
      nw.targetId = p.target?.id || "";
      nw.carrierId = p.off_qb?.id || "";
      nw.defenderId = p.defender?.id || "";
      nw.xpDefenseScored = Boolean(p.returned_for_td);
    } else if (pt === "KO" || pt === "PUNT") {
      nw.kind = "special";
      nw.specialType = pt as SpecialType;
      if (res === "SAF") {
        nw.receiverOutcome = "safety";
        nw.targetId = p.target?.id || "";
        nw.defenderId = p.defender?.id || "";
      } else if (p.target) {
        nw.receiverOutcome = "catch";
        nw.targetId = p.target.id;
        nw.defenderId = p.defender?.id || "";
        nw.specialDefenderAction = res === "OB" ? "OB" : "FG";
        nw.specialPlayOutcome = res === "TD" ? "TD" : "next_down";
      } else {
        nw.receiverOutcome = "no_catch";
      }
    } else if (p.penalty && !pt) {
      nw.kind = "penalty";
      nw.penaltyCode = p.penalty;
      nw.penaltyTeam =
        p.penalty_team_id === match?.home_team?.id
          ? "home"
          : p.penalty_team_id === match?.away_team?.id
            ? "away"
            : "";
      nw.penaltyPlayerId = p.penalty_player?.id || "";
      nw.penaltyYards = p.penalty_yards != null ? String(p.penalty_yards) : "";
    } else if (["IH", "EH", "EG"].includes(res)) {
      nw.kind = "event";
      nw.eventKind = res as Wizard["eventKind"];
      if (res === "IH") nw.qbId = p.off_qb?.id || "";
    }

    if (p.penalty && pt) {
      nw.penaltyOn = true;
      nw.penaltyCode = p.penalty;
      nw.penaltyTeam =
        p.penalty_team_id === match?.home_team?.id
          ? "home"
          : p.penalty_team_id === match?.away_team?.id
            ? "away"
            : "";
      nw.penaltyPlayerId = p.penalty_player?.id || "";
      nw.penaltyYards = p.penalty_yards != null ? String(p.penalty_yards) : "";
    }

    setW(nw);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const teamName = (side: Side) =>
    side === "home"
      ? match?.home_team?.short_name || match?.home_team?.name
      : side === "away"
        ? match?.away_team?.short_name || match?.away_team?.name
        : "";

  const matchLabel = `${match?.home_team?.short_name || match?.home_team?.name || "Home"} vs ${match?.away_team?.short_name || match?.away_team?.name || "Away"}`;

  // The one confirm dialog for saving, deleting and locking.
  const pbpDialog = (() => {
    switch (pendingAction?.kind) {
      case "save": {
        const p = pendingAction.payload;
        const mode = w.editingId
          ? "update"
          : w.insertSeq != null
            ? "insert"
            : "add";
        return {
          title:
            mode === "update"
              ? "Update this play?"
              : mode === "insert"
                ? "Insert this play?"
                : "Add this play?",
          description:
            mode === "insert"
              ? `It goes right after ${w.insertAfterLabel}, and the plays after it shift down.`
              : undefined,
          confirmLabel:
            mode === "update"
              ? "Update Play"
              : mode === "insert"
                ? "Insert Play"
                : "Add Play",
          tone: "info" as const,
          icon:
            mode === "update"
              ? PencilSquareIcon
              : mode === "insert"
                ? PlusIcon
                : CheckCircleIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Match", matchLabel],
                [
                  "Half",
                  `H${p.quarter ?? ""}${p.drive_no != null ? ` · Drive ${p.drive_no}` : ""}`,
                ],
                [
                  "Down",
                  p.down != null ? `${p.down}&${p.to_go ?? ""}` : undefined,
                ],
                [
                  "Play",
                  [p.play_type, p.result].filter(Boolean).join(" · ") ||
                    (p.penalty ? `Penalty ${p.penalty}` : undefined),
                ],
                [
                  "Score after",
                  `${p.home_score_after ?? "—"} – ${p.away_score_after ?? "—"}`,
                ],
              ]}
            />
          ),
        };
      }
      case "delete": {
        const p = pendingAction.play;
        return {
          title: "Delete this play?",
          description: "The match score and stats are recalculated without it.",
          confirmLabel: "Delete Play",
          tone: "warning" as const,
          icon: TrashIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Match", matchLabel],
                ["Play", `#${p.seq}`],
                [
                  "Half",
                  `H${p.quarter}${p.down ? ` · ${p.down}&${p.to_go ?? ""}` : ""}`,
                ],
                [
                  "Type",
                  [p.play_type, p.result].filter(Boolean).join(" · ") ||
                    undefined,
                ],
              ]}
            />
          ),
        };
      }
      case "lock":
        return pendingAction.lock
          ? {
              title: "Lock play-by-play for this match?",
              description:
                "Adding, editing and deleting plays is disabled until an admin unlocks it.",
              confirmLabel: "Lock",
              tone: "info" as const,
              icon: LockClosedIcon,
              body: <ConfirmSummary rows={[["Match", matchLabel]]} />,
            }
          : {
              title: "Unlock play-by-play for this match?",
              description:
                "Plays can be added, edited and deleted until it is locked again.",
              confirmLabel: "Unlock",
              tone: "warning" as const,
              icon: LockOpenIcon,
              body: <ConfirmSummary rows={[["Match", matchLabel]]} />,
            };
      default:
        return {
          title: "",
          description: undefined,
          confirmLabel: "",
          tone: "info" as const,
          icon: CheckCircleIcon,
          body: null,
        };
    }
  })();

  // Old and new situation for each play the re-derive would change.
  const rederiveColumns = useMemo<Column<RederiveChange>[]>(() => {
    const sideLabel = (s: Side) =>
      s === "home"
        ? match?.home_team?.short_name || "Home"
        : s === "away"
          ? match?.away_team?.short_name || "Away"
          : "—";
    return [
      {
        header: "Play",
        cell: (ch) => (
          <span className="font-bold text-gray-700 dark:text-gray-200">
            #{ch.play.seq}{" "}
            <span className="text-gray-400 font-mono">
              {ch.play.play_type || ch.play.result || "—"}
            </span>
          </span>
        ),
      },
      {
        header: "Down & Dist",
        cell: (ch) => (
          <ChangeCell
            from={`${ch.oldCtx.down}&${ch.oldCtx.toGo}`}
            to={`${ch.newCtx.down}&${ch.newCtx.toGo}`}
          />
        ),
      },
      {
        header: "Possession",
        cell: (ch) => (
          <ChangeCell
            from={sideLabel(ch.oldCtx.offense)}
            to={sideLabel(ch.newCtx.offense)}
          />
        ),
      },
      {
        header: "Drive",
        cell: (ch) => (
          <ChangeCell
            from={String(ch.oldCtx.driveNo)}
            to={String(ch.newCtx.driveNo)}
          />
        ),
      },
    ];
  }, [match]);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Play by Play"
        subtitle="Log each play by picking players from the team sheet."
      />
      {/* Competition + match picker */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
            Competition
          </label>
          <select
            value={selectedCompId}
            onChange={(e) => setSelectedCompId(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 min-h-11 text-sm font-semibold dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red focus:outline-none"
          >
            <option value="">All competitions</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
            Select Match
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing {Math.min(visibleMatches.length, matches.length)} of{" "}
            {matches.length} latest matches
          </span>
        </div>
        <select
          value={matchId}
          onChange={(e) => {
            setMatchId(e.target.value);
            resetWizard();
          }}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 min-h-11 text-sm font-semibold dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red focus:outline-none"
        >
          <option value="">Select a match…</option>
          {groupedMatches.map((group) => (
            <optgroup key={group.header} label={group.header}>
              {group.matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.home_team?.name} vs {m.away_team?.name}{" "}
                  {formatMatchTime(m.start_time) !== "TBD"
                    ? `· ${formatMatchTime(m.start_time)}`
                    : ""}{" "}
                  {m.status === "LIVE"
                    ? "· LIVE"
                    : m.status === "FINISHED"
                      ? "· FINISHED"
                      : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {visibleCount < matches.length && (
          <div className="flex flex-wrap items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() =>
                setVisibleCount((prev) => Math.min(matches.length, prev + 10))
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-11 bg-sffl-navy/10 hover:bg-sffl-navy/20 dark:bg-gray-700 dark:hover:bg-gray-600 text-sffl-navy dark:text-white font-bold text-xs rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" aria-hidden="true" />
              Load 10 More Matches
            </button>
            <button
              type="button"
              onClick={() => setVisibleCount(matches.length)}
              className="px-3 py-1.5 min-h-11 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/60 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-lg transition-colors"
            >
              Show All ({matches.length})
            </button>
          </div>
        )}
      </div>
      {matchId && (
        <div
          className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 ${
            locked
              ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
              : "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
          }`}
        >
          <div className="text-sm min-w-0">
            <div
              className={`inline-flex items-center gap-1.5 font-black ${locked ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}`}
            >
              {locked ? (
                <LockClosedIcon className="w-5 h-5" aria-hidden="true" />
              ) : (
                <LockOpenIcon className="w-5 h-5" aria-hidden="true" />
              )}
              {locked ? "Play-by-play is LOCKED" : "Play-by-play is UNLOCKED"}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {locked
                ? "Adding, editing and deleting plays is disabled until an admin unlocks this match."
                : "Plays can be added, edited and deleted. Lock the match again when you're done."}
            </div>
          </div>
          {canToggleLock ? (
            <button
              type="button"
              onClick={requestLockToggle}
              disabled={lockBusy}
              className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-11 rounded-lg font-bold text-white disabled:opacity-50 ${locked ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              {lockBusy && (
                <ArrowPathIcon
                  className="w-4 h-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {locked ? "Unlock" : "Lock"}
            </button>
          ) : (
            <span className="shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Admin only
            </span>
          )}
        </div>
      )}
      {matchId && !hasRosters && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
          <b>Set the team sheets first.</b> Both teams need their rosters saved
          on this match before you can log plays. Do that on the <b>Matches</b>{" "}
          screen (Team Sheets), then come back.
        </div>
      )}
      {matchId && hasRosters && (
        <>
          {/* Context bar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-gray-200 mb-3">
              Game situation{" "}
              {w.editingId && (
                <span className="text-amber-500">· editing play</span>
              )}
              {w.insertSeq != null && (
                <span className="text-green-600">
                  · inserting a missed play after {w.insertAfterLabel} (Clear to
                  cancel)
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                  Half
                </span>
                <input
                  type="number"
                  value={ctx.quarter}
                  onChange={(e) =>
                    setCtx({ ...ctx, quarter: parseInt(e.target.value) || 1 })
                  }
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 min-h-11 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                  Drive
                </span>
                <input
                  type="number"
                  value={ctx.driveNo}
                  onChange={(e) =>
                    setCtx({ ...ctx, driveNo: parseInt(e.target.value) || 1 })
                  }
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 min-h-11 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                  Ball with
                </span>
                <select
                  value={ctx.offense}
                  onChange={(e) =>
                    setCtx({ ...ctx, offense: e.target.value as Side })
                  }
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 min-h-11 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">—</option>
                  <option value="home">
                    {match?.home_team?.short_name ||
                      match?.home_team?.name ||
                      "Home"}
                  </option>
                  <option value="away">
                    {match?.away_team?.short_name ||
                      match?.away_team?.name ||
                      "Away"}
                  </option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                  Down
                </span>
                <select
                  value={ctx.down}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes("&G")) {
                      setCtx({ ...ctx, down: val, toGo: "Goal" });
                    } else {
                      const wasGoal =
                        ctx.down.includes("&G") || ctx.toGo === "Goal";
                      setCtx({
                        ...ctx,
                        down: val,
                        toGo: wasGoal ? "10" : ctx.toGo,
                      });
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 min-h-11 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="1&G">1&G</option>
                  <option value="2&G">2&G</option>
                  <option value="3&G">3&G</option>
                  <option value="4&G">4&G</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                  To go
                </span>
                <input
                  type="number"
                  value={ctx.toGo}
                  onChange={(e) => setCtx({ ...ctx, toGo: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 min-h-11 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 max-w-xs">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                  {match?.home_team?.short_name || "Home"} score
                </span>
                <input
                  type="number"
                  value={ctx.homeScore}
                  onChange={(e) =>
                    setCtx({ ...ctx, homeScore: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 min-h-11 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                  {match?.away_team?.short_name || "Away"} score
                </span>
                <input
                  type="number"
                  value={ctx.awayScore}
                  onChange={(e) =>
                    setCtx({ ...ctx, awayScore: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 min-h-11 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </label>
            </div>
          </div>

          {/* Step 1 — The Snap. Scrimmage plays only; throw-offs, punts,
                        penalty-only rows and game events aren't snapped. */}
          {isSnapKind(w.kind) && (
            <Section active title="The Snap">
              <div className="space-y-3">
                <PlayerField
                  label={`Center (${teamName(ctx.offense)})`}
                  value={w.centerId}
                  onChange={(v) => setField("centerId", v)}
                  roster={offenseRoster}
                />
                <div>
                  <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                    Snap Outcome
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["snap", "Snap"],
                        ["bad_snap", "Bad Snap"],
                      ] as [SnapOutcome, string][]
                    ).map(([so, label]) => (
                      <button
                        key={so}
                        className={chip(w.snapOutcome === so)}
                        onClick={() => setField("snapOutcome", so)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {isBadSnap && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/60 space-y-3">
                    <div>
                      <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">
                        Bad Snap Outcome
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ["next_down", "Next Down"],
                            ["turnover", "Turnover on Downs"],
                            ["safety", "Safety (2 pts)"],
                          ] as [BadSnapOutcome, string][]
                        ).map(([bso, label]) => (
                          <button
                            key={bso}
                            type="button"
                            className={chip((w.badSnapOutcome || "next_down") === bso)}
                            onClick={() => setField("badSnapOutcome", bso)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(w.badSnapOutcome || "next_down") === "next_down" && (
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Play ends as a dead ball — down advances to next down; Center is charged with a Bad Snap.
                      </p>
                    )}
                    {w.badSnapOutcome === "turnover" && (
                      <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                        Turnover on downs — ball turns over to {teamName(ctx.offense === "home" ? "away" : "home")}.
                      </p>
                    )}
                    {w.badSnapOutcome === "safety" && (
                      <div className="space-y-3 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                            Safety (+2 pts)
                          </span>
                          <span className="text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                            +2 pts → {teamName(ctx.offense === "home" ? "away" : "home")}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          Bad snap into the endzone — 2 points awarded to {teamName(ctx.offense === "home" ? "away" : "home")} (defending team).
                        </div>
                        <PlayerField
                          label={`Tackler / Defender (Optional, ${teamName(ctx.offense === "home" ? "away" : "home")})`}
                          value={w.defenderId}
                          onChange={(v) => handlePlayerSelect("defenderId", defenseTeamId, "defender", v)}
                          roster={defenseRoster}
                          favoriteIds={getFavorites(defenseTeamId, "defender")}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Step 2 — What happened? A bad snap ends the play at the snap,
                        so there is nothing further to describe. */}
          {!isBadSnap && (
            <Section active title="What happened?">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["pass", "Pass"],
                    ["run", "Run"],
                    ["xp", "Extra Point"],
                    ["special", "Special (KO/Punt)"],
                    ["penalty", "Penalty only"],
                    ["event", "Game event"],
                  ] as [Kind, string][]
                ).map(([k, label]) => (
                  <button
                    key={k}
                    className={chip(w.kind === k)}
                    onClick={() =>
                      setW({
                        ...emptyWizard,
                        editingId: w.editingId,
                        centerId: w.centerId || stickyCenter,
                        qbId: w.qbId || stickyQb,
                        snapOutcome: w.snapOutcome,
                        kind: k,
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/60">
                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  <BoltIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  Quick Play Presets
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setW({
                        ...emptyWizard,
                        editingId: w.editingId,
                        centerId: w.centerId || stickyCenter,
                        qbId: w.qbId || stickyQb,
                        snapOutcome: w.snapOutcome,
                        kind: "pass",
                        rushOutcome: "no_sack",
                        passOutcome: "incomplete",
                        incompleteOption: "uncatchable",
                        passFinalOutcome: "next_down",
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1 min-h-11 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors"
                  >
                    <FootballIcon className="w-4 h-4" aria-hidden="true" />
                    Incomplete Pass
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setW({
                        ...emptyWizard,
                        editingId: w.editingId,
                        centerId: w.centerId || stickyCenter,
                        qbId: w.qbId || stickyQb,
                        snapOutcome: w.snapOutcome,
                        kind: "pass",
                        rushOutcome: "no_sack",
                        passOutcome: "complete",
                        passDefenderAction: "FG",
                        passFinalOutcome: "next_down",
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1 min-h-11 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors"
                  >
                    <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />
                    Complete Pass
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setW({
                        ...emptyWizard,
                        editingId: w.editingId,
                        centerId: w.centerId || stickyCenter,
                        qbId: w.qbId || stickyQb,
                        snapOutcome: w.snapOutcome,
                        kind: "run",
                        runDefenderAction: "FG",
                        runPlayOutcome: "next_down",
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1 min-h-11 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors"
                  >
                    <RunnerIcon className="w-4 h-4" aria-hidden="true" />
                    Run
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setW({
                        ...emptyWizard,
                        editingId: w.editingId,
                        centerId: w.centerId || stickyCenter,
                        snapOutcome: w.snapOutcome,
                        kind: "event",
                        eventKind: "EH",
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1 min-h-11 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 rounded-md text-xs font-bold text-amber-800 dark:text-amber-200 transition-colors"
                  >
                    <ClockIcon className="w-4 h-4" aria-hidden="true" />
                    End of Half
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setW({
                        ...emptyWizard,
                        editingId: w.editingId,
                        centerId: w.centerId || stickyCenter,
                        snapOutcome: w.snapOutcome,
                        kind: "event",
                        eventKind: "EG",
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1 min-h-11 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 rounded-md text-xs font-bold text-blue-800 dark:text-blue-200 transition-colors"
                  >
                    <FlagIcon className="w-4 h-4" aria-hidden="true" />
                    End of Game
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setW({
                        ...emptyWizard,
                        editingId: w.editingId,
                        centerId: w.centerId || stickyCenter,
                        snapOutcome: w.snapOutcome,
                        kind: "event",
                        eventKind: "OMW",
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1 min-h-11 bg-rose-100 dark:bg-rose-900/40 hover:bg-rose-200 rounded-md text-xs font-bold text-rose-800 dark:text-rose-200 transition-colors"
                  >
                    <ExclamationTriangleIcon
                      className="w-4 h-4"
                      aria-hidden="true"
                    />
                    1-Minute Warning
                  </button>
                </div>
              </div>
            </Section>
          )}

          {/* PASS flow */}
          {w.kind === "pass" && !isBadSnap && (
            <Section active title="The pass">
              <div className="space-y-4">
                <PlayerField
                  label={`QB (${teamName(ctx.offense)})`}
                  value={w.qbId}
                  onChange={(v) =>
                    handlePlayerSelect("qbId", offenseTeamId, "qb", v)
                  }
                  roster={offenseRoster}
                  favoriteIds={getFavorites(offenseTeamId, "qb")}
                />

                {/* Section: Rush */}
                <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 space-y-3">
                  <div className="text-xs font-bold text-sffl-navy dark:text-gray-200 uppercase tracking-wider">
                    Rush
                  </div>
                  <PlayerField
                    label={`Rusher (${teamName(ctx.offense === "home" ? "away" : ctx.offense === "away" ? "home" : "")})`}
                    value={w.rusherId}
                    onChange={(v) =>
                      handlePlayerSelect("rusherId", defenseTeamId, "rusher", v)
                    }
                    roster={defenseRoster}
                    favoriteIds={getFavorites(defenseTeamId, "rusher")}
                  />
                  <div>
                    <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                      Rush Outcome
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["sack", "Sack"],
                          ["no_sack", "No Sack"],
                          ["bat_down", "Bat Down"],
                          ["int", "Interception"],
                        ] as [RushOutcome, string][]
                      ).map(([ro, label]) => (
                        <button
                          key={ro}
                          className={chip(w.rushOutcome === ro)}
                          onClick={() => setField("rushOutcome", ro)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {w.rushOutcome === "sack" && (
                    <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <label className="block">
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                          Yards lost
                        </span>
                        <input
                          type="number"
                          value={w.yards}
                          onChange={(e) => setField("yards", e.target.value)}
                          placeholder="e.g. -6"
                          className="ml-2 w-24 border rounded-lg px-2 py-1.5 min-h-11 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                      </label>
                      <div>
                        <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                          Sack Result (Play Ends)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(
                            [
                              ["next_down", "Next Down"],
                              ["safety", "Safety"],
                            ] as [SackResult, string][]
                          ).map(([sr, label]) => (
                            <button
                              key={sr}
                              className={chip(w.sackResult === sr)}
                              onClick={() => setField("sackResult", sr)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {w.rushOutcome === "bat_down" && (
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Play ends as an incomplete pass batted down by the rusher.
                    </p>
                  )}

                  {w.rushOutcome === "int" && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                        Play ends as an interception credited to the rusher.
                      </p>
                      <PlayerField
                        label={`Target Receiver (${teamName(ctx.offense)})`}
                        value={w.targetId}
                        onChange={(v) =>
                          handlePlayerSelect(
                            "targetId",
                            offenseTeamId,
                            "target",
                            v,
                          )
                        }
                        roster={offenseRoster}
                        favoriteIds={getFavorites(offenseTeamId, "target")}
                      />
                    </div>
                  )}
                </div>

                {/* Continue pass flow only if No Sack */}
                {w.rushOutcome === "no_sack" && (
                  <>
                    <div>
                      <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                        Pass Outcome
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ["complete", "Complete"],
                            ["incomplete", "Incomplete"],
                            ["int", "Intercepted"],
                            ["ta", "Throw Away"],
                          ] as [PassOutcome, string][]
                        ).map(([o, label]) => (
                          <button
                            key={o}
                            className={chip(w.passOutcome === o)}
                            onClick={() => setField("passOutcome", o)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {w.passOutcome === "complete" && (
                      <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <PlayerField
                          label={`Target (${teamName(ctx.offense)})`}
                          value={w.targetId}
                          onChange={(v) =>
                            handlePlayerSelect(
                              "targetId",
                              offenseTeamId,
                              "target",
                              v,
                            )
                          }
                          roster={offenseRoster}
                          favoriteIds={getFavorites(offenseTeamId, "target")}
                        />
                        <label className="block">
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                            Yards gained
                          </span>
                          <input
                            type="number"
                            value={w.yards}
                            onChange={(e) => setField("yards", e.target.value)}
                            className="ml-2 w-24 border rounded-lg px-2 py-1.5 min-h-11 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </label>
                        <div>
                          <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                            Defender Action
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                ["FG", "Flag pull"],
                                ["OB", "Out of bounds"],
                              ] as [PassDefenderAction, string][]
                            ).map(([da, label]) => (
                              <button
                                key={da}
                                className={chip(w.passDefenderAction === da)}
                                onClick={() =>
                                  setField("passDefenderAction", da)
                                }
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <PlayerField
                          label={`Coverage Defender (${teamName(ctx.offense === "home" ? "away" : ctx.offense === "away" ? "home" : "")})`}
                          value={w.defenderId}
                          onChange={(v) =>
                            handlePlayerSelect(
                              "defenderId",
                              defenseTeamId,
                              "defender",
                              v,
                            )
                          }
                          roster={defenseRoster}
                          favoriteIds={getFavorites(defenseTeamId, "defender")}
                        />
                        <div>
                          <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                            Final Outcome
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                ["TD", "Touchdown"],
                                ["next_down", "Next Down"],
                                ["TO", "Turnover on downs"],
                                ["SAF", "Safety"],
                              ] as [PassFinalOutcome, string][]
                            ).map(([fo, label]) => (
                              <button
                                key={fo}
                                className={chip(w.passFinalOutcome === fo)}
                                onClick={() => setField("passFinalOutcome", fo)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            Was it picked off? Use the <b>Intercepted</b> pass
                            outcome above instead.
                          </p>
                        </div>
                      </div>
                    )}

                    {w.passOutcome === "incomplete" && (
                      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <PlayerField
                          label={`Target (${teamName(ctx.offense)})`}
                          value={w.targetId}
                          onChange={(v) =>
                            handlePlayerSelect(
                              "targetId",
                              offenseTeamId,
                              "target",
                              v,
                            )
                          }
                          roster={offenseRoster}
                          favoriteIds={getFavorites(offenseTeamId, "target")}
                        />
                        <div>
                          <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                            Incomplete Reason
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                ["dropped", "Dropped"],
                                ["batted_down", "Batted Down"],
                                ["uncatchable", "Uncatchable"],
                              ] as [IncompleteOption, string][]
                            ).map(([inc, label]) => (
                              <button
                                key={inc}
                                className={chip(w.incompleteOption === inc)}
                                onClick={() =>
                                  setField("incompleteOption", inc)
                                }
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {w.incompleteOption === "batted_down" && (
                          <PlayerField
                            label={`Coverage Defender (${teamName(ctx.offense === "home" ? "away" : ctx.offense === "away" ? "home" : "")})`}
                            value={w.defenderId}
                            onChange={(v) =>
                              handlePlayerSelect(
                                "defenderId",
                                defenseTeamId,
                                "defender",
                                v,
                              )
                            }
                            roster={defenseRoster}
                            favoriteIds={getFavorites(
                              defenseTeamId,
                              "defender",
                            )}
                          />
                        )}
                        <div>
                          <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                            Play Outcome
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                ["next_down", "Next Down"],
                                ["TO", "Turnover on downs"],
                              ] as [PassFinalOutcome, string][]
                            ).map(([fo, label]) => (
                              <button
                                key={fo}
                                className={chip(w.passFinalOutcome === fo)}
                                onClick={() => setField("passFinalOutcome", fo)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {w.passOutcome === "int" && (
                      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <PlayerField
                          label={`Target Receiver (${teamName(ctx.offense)})`}
                          value={w.targetId}
                          onChange={(v) =>
                            handlePlayerSelect(
                              "targetId",
                              offenseTeamId,
                              "target",
                              v,
                            )
                          }
                          roster={offenseRoster}
                          favoriteIds={getFavorites(offenseTeamId, "target")}
                        />
                        <PlayerField
                          label={`Interceptor / Defender (${teamName(ctx.offense === "home" ? "away" : ctx.offense === "away" ? "home" : "")})`}
                          value={w.defenderId}
                          onChange={(v) =>
                            handlePlayerSelect(
                              "defenderId",
                              defenseTeamId,
                              "defender",
                              v,
                            )
                          }
                          roster={defenseRoster}
                          favoriteIds={getFavorites(defenseTeamId, "defender")}
                        />
                        <div>
                          <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                            Final Outcome
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                ["INT", "Interception"],
                                ["pick6", "Pick 6 (Returned for TD)"],
                              ] as [PassFinalOutcome, string][]
                            ).map(([fo, label]) => (
                              <button
                                key={fo}
                                className={chip(w.passFinalOutcome === fo)}
                                onClick={() => setField("passFinalOutcome", fo)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {w.passOutcome === "ta" && (
                      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          Pass thrown away to stop the clock or avoid loss —
                          recorded as an incomplete pass (TA).
                        </p>
                        <div>
                          <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                            Play Outcome
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                ["next_down", "Next Down"],
                                ["TO", "Turnover on downs"],
                              ] as [PassFinalOutcome, string][]
                            ).map(([fo, label]) => (
                              <button
                                key={fo}
                                className={chip(w.passFinalOutcome === fo)}
                                onClick={() => setField("passFinalOutcome", fo)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Section>
          )}

          {/* RUN flow */}
          {w.kind === "run" && (
            <Section active title="The run">
              <div className="space-y-4">
                <PlayerField
                  label={`Carrier (${teamName(ctx.offense)})`}
                  value={w.carrierId}
                  onChange={(v) =>
                    handlePlayerSelect("carrierId", offenseTeamId, "carrier", v)
                  }
                  roster={offenseRoster}
                  favoriteIds={getFavorites(offenseTeamId, "carrier")}
                />
                <label className="block">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    Yards
                  </span>
                  <input
                    type="number"
                    value={w.yards}
                    onChange={(e) => setField("yards", e.target.value)}
                    className="ml-2 w-24 border rounded-lg px-2 py-1.5 min-h-11 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </label>
                <div>
                  <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                    Defender Action
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["FG", "Flag pull"],
                        ["OB", "Out of bounds"],
                      ] as [RunDefenderAction, string][]
                    ).map(([da, label]) => (
                      <button
                        key={da}
                        className={chip(w.runDefenderAction === da)}
                        onClick={() => setField("runDefenderAction", da)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <PlayerField
                  label={`Coverage Defender (${teamName(ctx.offense === "home" ? "away" : ctx.offense === "away" ? "home" : "")})`}
                  value={w.defenderId}
                  onChange={(v) =>
                    handlePlayerSelect(
                      "defenderId",
                      defenseTeamId,
                      "defender",
                      v,
                    )
                  }
                  roster={defenseRoster}
                  favoriteIds={getFavorites(defenseTeamId, "defender")}
                />
                <div>
                  <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                    Play Outcome
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["TD", "Touchdown"],
                        ["turnover", "Turnover on downs"],
                        ["next_down", "Next Down"],
                      ] as [RunPlayOutcome, string][]
                    ).map(([po, label]) => (
                      <button
                        key={po}
                        className={chip(w.runPlayOutcome === po)}
                        onClick={() => setField("runPlayOutcome", po)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* EXTRA POINT flow */}
          {w.kind === "xp" && (
            <Section active title="Extra point">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    className={chip(w.xpType === "PAT-R")}
                    onClick={() => setField("xpType", "PAT-R")}
                  >
                    Run (PAT-R)
                  </button>
                  <button
                    className={chip(w.xpType === "XP-P")}
                    onClick={() => setField("xpType", "XP-P")}
                  >
                    Pass (XP-P)
                  </button>
                </div>
                {w.xpType === "XP-P" && (
                  <>
                    <PlayerField
                      label="QB"
                      value={w.qbId}
                      onChange={(v) =>
                        handlePlayerSelect("qbId", offenseTeamId, "qb", v)
                      }
                      roster={offenseRoster}
                      favoriteIds={getFavorites(offenseTeamId, "qb")}
                    />
                    <PlayerField
                      label="Target"
                      value={w.targetId}
                      onChange={(v) =>
                        handlePlayerSelect(
                          "targetId",
                          offenseTeamId,
                          "target",
                          v,
                        )
                      }
                      roster={offenseRoster}
                      favoriteIds={getFavorites(offenseTeamId, "target")}
                    />
                  </>
                )}
                {w.xpType === "PAT-R" && (
                  <PlayerField
                    label="Carrier"
                    value={w.carrierId}
                    onChange={(v) =>
                      handlePlayerSelect(
                        "carrierId",
                        offenseTeamId,
                        "carrier",
                        v,
                      )
                    }
                    roster={offenseRoster}
                    favoriteIds={getFavorites(offenseTeamId, "carrier")}
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    className={chip(w.xpResult === "XP")}
                    onClick={() => {
                      setField("xpResult", "XP");
                      setField("xpDefenseScored", false);
                    }}
                  >
                    Good
                  </button>
                  <button
                    className={chip(w.xpResult === "XPF")}
                    onClick={() => setField("xpResult", "XPF")}
                  >
                    Failed
                  </button>
                </div>

                {w.xpResult === "XPF" && (
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        Did Defense Score? (1 pt M / 2 pts F)
                      </span>
                      <button
                        type="button"
                        className={chip(Boolean(w.xpDefenseScored))}
                        onClick={() => {
                          const nextVal = !w.xpDefenseScored;
                          setField("xpDefenseScored", nextVal);
                          if (!nextVal) setField("defenderId", "");
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {w.xpDefenseScored ? (
                            <CheckIcon className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <PlusIcon className="w-4 h-4" aria-hidden="true" />
                          )}
                          Defense Scored
                        </span>
                      </button>
                    </div>

                    {w.xpDefenseScored && (
                      <div className="space-y-2.5 bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-200 dark:border-gray-600">
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          Points awarded to{" "}
                          <strong className="text-sffl-navy dark:text-white">
                            {teamName(ctx.offense === "home" ? "away" : "home")}
                          </strong>{" "}
                          (defending team):{" "}
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            1 pt for male, 2 pts for female
                          </span>
                        </div>
                        <PlayerField
                          label={`Scoring Defender (${teamName(ctx.offense === "home" ? "away" : "home")})`}
                          value={w.defenderId}
                          onChange={(v) =>
                            handlePlayerSelect(
                              "defenderId",
                              defenseTeamId,
                              "defender",
                              v,
                            )
                          }
                          roster={defenseRoster}
                          favoriteIds={getFavorites(defenseTeamId, "defender")}
                        />
                        {w.defenderId &&
                          (() => {
                            const defPlayer = defenseRoster.find(
                              (p) => p.player_id === w.defenderId,
                            );
                            if (!defPlayer) return null;
                            const isFemale =
                              defPlayer.gender?.toUpperCase() === "F";
                            return (
                              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                                <span>
                                  Awarding to{" "}
                                  {teamName(
                                    ctx.offense === "home" ? "away" : "home",
                                  )}
                                  :
                                </span>
                                <span>
                                  +{isFemale ? 2 : 1} pt ({defPlayer.name} ·{" "}
                                  {isFemale ? "Female" : "Male"})
                                </span>
                              </div>
                            );
                          })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* SPECIAL flow (KO/Punt) */}
          {w.kind === "special" && (
            <Section active title="Special teams">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["KO", "Throw-off (KO)"],
                      ["PUNT", "Punt"],
                    ] as [SpecialType, string][]
                  ).map(([st, label]) => (
                    <button
                      key={st}
                      className={chip(w.specialType === st)}
                      onClick={() => setField("specialType", st)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Always-visible Penalty box for Special Teams */}
                <div className="rounded-xl border border-amber-200 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-900/10 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    <FlagIcon className="w-4 h-4" aria-hidden="true" />
                    Penalty on this play
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={chip(w.penaltyTeam === "home")}
                      onClick={() =>
                        setField(
                          "penaltyTeam",
                          w.penaltyTeam === "home" ? "" : "home",
                        )
                      }
                    >
                      {match?.home_team?.short_name || "Home"}
                    </button>
                    <button
                      className={chip(w.penaltyTeam === "away")}
                      onClick={() =>
                        setField(
                          "penaltyTeam",
                          w.penaltyTeam === "away" ? "" : "away",
                        )
                      }
                    >
                      {match?.away_team?.short_name || "Away"}
                    </button>
                  </div>
                  <select
                    value={w.penaltyCode}
                    onChange={(e) => setField("penaltyCode", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 min-h-11 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">No penalty / Select penalty…</option>
                    {Object.entries(PENALTY_LABELS).map(([code, label]) => (
                      <option key={code} value={code}>
                        {code} — {label}
                      </option>
                    ))}
                  </select>
                  {w.penaltyCode && (
                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end gap-3">
                      <PlayerField
                        label="Penalty Player (optional)"
                        value={w.penaltyPlayerId}
                        onChange={(v) =>
                          handlePlayerSelect(
                            "penaltyPlayerId",
                            penaltyTeamId,
                            "penalty",
                            v,
                          )
                        }
                        roster={penaltyRoster}
                        favoriteIds={getFavorites(penaltyTeamId, "penalty")}
                      />
                      <label className="block">
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                          Yards
                        </span>
                        <input
                          type="number"
                          value={w.penaltyYards}
                          onChange={(e) =>
                            setField("penaltyYards", e.target.value)
                          }
                          className="ml-2 w-20 border rounded-lg px-2 py-1.5 min-h-11 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                    Receiver Outcome
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["no_catch", "No Catch (Play ends)"],
                        ["catch", "Catch"],
                        ["safety", "Safety (2 pts)"],
                      ] as [ReceiverOutcome, string][]
                    ).map(([ro, label]) => (
                      <button
                        key={ro}
                        className={chip(w.receiverOutcome === ro)}
                        onClick={() => setField("receiverOutcome", ro)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {w.receiverOutcome === "safety" && (
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                        Safety on Special Teams (+2 pts)
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                        +2 pts{" "}
                        <ArrowRightIcon
                          className="w-3.5 h-3.5"
                          aria-hidden="true"
                        />{" "}
                        {teamName(ctx.offense)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      The receiving team (
                      {teamName(ctx.offense === "home" ? "away" : "home")}) was
                      tackled or conceded a safety in their own endzone. 2
                      points awarded to the kicking/punting team (
                      <strong className="text-sffl-navy dark:text-white">
                        {teamName(ctx.offense)}
                      </strong>
                      ).
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <PlayerField
                        label={`Returner Conceding (${teamName(ctx.offense === "home" ? "away" : "home")})`}
                        value={w.targetId}
                        onChange={(v) =>
                          handlePlayerSelect(
                            "targetId",
                            defenseTeamId,
                            "target",
                            v,
                          )
                        }
                        roster={defenseRoster}
                        favoriteIds={getFavorites(defenseTeamId, "target")}
                      />
                      <PlayerField
                        label={`Coverage Tackler (${teamName(ctx.offense)})`}
                        value={w.defenderId}
                        onChange={(v) =>
                          handlePlayerSelect(
                            "defenderId",
                            offenseTeamId,
                            "defender",
                            v,
                          )
                        }
                        roster={offenseRoster}
                        favoriteIds={getFavorites(offenseTeamId, "defender")}
                      />
                    </div>
                  </div>
                )}

                {w.receiverOutcome === "catch" && (
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <PlayerField
                      label={`Who caught it? (${teamName(ctx.offense === "home" ? "away" : ctx.offense === "away" ? "home" : "")})`}
                      value={w.targetId}
                      onChange={(v) =>
                        handlePlayerSelect(
                          "targetId",
                          defenseTeamId,
                          "target",
                          v,
                        )
                      }
                      roster={defenseRoster}
                      favoriteIds={getFavorites(defenseTeamId, "target")}
                    />
                    <div>
                      <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                        Defender Action
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ["FG", "Flag pull"],
                            ["OB", "Out of bounds"],
                          ] as [SpecialDefenderAction, string][]
                        ).map(([da, label]) => (
                          <button
                            key={da}
                            className={chip(w.specialDefenderAction === da)}
                            onClick={() =>
                              setField("specialDefenderAction", da)
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <PlayerField
                      label={`Coverage Defender (${teamName(ctx.offense)})`}
                      value={w.defenderId}
                      onChange={(v) =>
                        handlePlayerSelect(
                          "defenderId",
                          offenseTeamId,
                          "defender",
                          v,
                        )
                      }
                      roster={offenseRoster}
                      favoriteIds={getFavorites(offenseTeamId, "defender")}
                    />
                    <div>
                      <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                        Play Outcome
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ["TD", "Touchdown"],
                            ["next_down", "Next Down"],
                          ] as [SpecialPlayOutcome, string][]
                        ).map(([po, label]) => (
                          <button
                            key={po}
                            className={chip(w.specialPlayOutcome === po)}
                            onClick={() => setField("specialPlayOutcome", po)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* PENALTY-ONLY flow */}
          {w.kind === "penalty" && (
            <Section active title="Penalty">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    className={chip(w.penaltyTeam === "home")}
                    onClick={() => setField("penaltyTeam", "home")}
                  >
                    {match?.home_team?.short_name || "Home"}
                  </button>
                  <button
                    className={chip(w.penaltyTeam === "away")}
                    onClick={() => setField("penaltyTeam", "away")}
                  >
                    {match?.away_team?.short_name || "Away"}
                  </button>
                </div>
                <select
                  value={w.penaltyCode}
                  onChange={(e) => setField("penaltyCode", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 min-h-11 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Select penalty…</option>
                  {Object.entries(PENALTY_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {code} — {label}
                    </option>
                  ))}
                </select>
                <PlayerField
                  label="Player (optional)"
                  value={w.penaltyPlayerId}
                  onChange={(v) =>
                    handlePlayerSelect(
                      "penaltyPlayerId",
                      penaltyTeamId,
                      "penalty",
                      v,
                    )
                  }
                  roster={penaltyRoster}
                  favoriteIds={getFavorites(penaltyTeamId, "penalty")}
                />
                <label className="block">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    Penalty yards
                  </span>
                  <input
                    type="number"
                    value={w.penaltyYards}
                    onChange={(e) => setField("penaltyYards", e.target.value)}
                    className="ml-2 w-24 border rounded-lg px-2 py-1.5 min-h-11 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </label>
              </div>
            </Section>
          )}

          {/* GAME EVENT flow */}
          {w.kind === "event" && (
            <Section active title="Game event">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["IH", "Injury"],
                      ["EH", "End of half"],
                      ["EG", "End of game"],
                      ["OMW", "One Minute Warning"],
                    ] as [Wizard["eventKind"], string][]
                  ).map(([e, label]) => (
                    <button
                      key={e}
                      className={chip(w.eventKind === e)}
                      onClick={() => setField("eventKind", e)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {w.eventKind === "IH" && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <PlayerField
                      label="Injured player (either team)"
                      value={w.qbId}
                      onChange={(v) => setField("qbId", v)}
                      roster={bothRoster}
                    />
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Always-visible Penalty box for Pass, Run, XP — and for a bad
                        snap, which can carry a flag like any other play. */}
          {(isBadSnap ||
            (w.kind &&
              w.kind !== "penalty" &&
              w.kind !== "event" &&
              w.kind !== "special")) && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-900/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                <FlagIcon className="w-4 h-4" aria-hidden="true" />
                Penalty on this play (Optional)
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={chip(w.penaltyTeam === "home")}
                  onClick={() =>
                    setField(
                      "penaltyTeam",
                      w.penaltyTeam === "home" ? "" : "home",
                    )
                  }
                >
                  {match?.home_team?.short_name || "Home"}
                </button>
                <button
                  className={chip(w.penaltyTeam === "away")}
                  onClick={() =>
                    setField(
                      "penaltyTeam",
                      w.penaltyTeam === "away" ? "" : "away",
                    )
                  }
                >
                  {match?.away_team?.short_name || "Away"}
                </button>
              </div>
              <select
                value={w.penaltyCode}
                onChange={(e) => setField("penaltyCode", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-11 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">No penalty / Select penalty…</option>
                {Object.entries(PENALTY_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {code} — {label}
                  </option>
                ))}
              </select>
              {w.penaltyCode && (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end gap-3">
                  <PlayerField
                    label="Penalty Player (optional)"
                    value={w.penaltyPlayerId}
                    onChange={(v) =>
                      handlePlayerSelect(
                        "penaltyPlayerId",
                        penaltyTeamId,
                        "penalty",
                        v,
                      )
                    }
                    roster={penaltyRoster}
                    favoriteIds={getFavorites(penaltyTeamId, "penalty")}
                  />
                  <label className="block">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                      Yards
                    </span>
                    <input
                      type="number"
                      value={w.penaltyYards}
                      onChange={(e) => setField("penaltyYards", e.target.value)}
                      className="ml-2 w-20 border rounded-lg px-2 py-1.5 min-h-11 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Notes + Save. A bad snap has no `kind` — it is submittable
                        straight off the Snap step. */}
          {(w.kind || isBadSnap) && (
            <div className="space-y-3">
              <input
                value={w.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Notes (optional)"
                className="w-full border rounded-lg px-3 py-2 min-h-11 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={requestSave}
                  disabled={saving || locked}
                  title={locked ? "Unlock this match to edit plays" : undefined}
                  className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 min-h-11 bg-sffl-red text-white font-bold rounded-lg disabled:opacity-50"
                >
                  {locked && (
                    <LockClosedIcon className="w-4 h-4" aria-hidden="true" />
                  )}
                  {locked ? "Locked" : w.editingId ? "Update play" : "Add play"}
                </button>
                <button
                  type="button"
                  onClick={resetWizard}
                  className="px-4 py-2.5 min-h-11 border rounded-lg font-bold text-gray-600 dark:text-gray-300 dark:border-gray-600"
                >
                  {w.editingId ? "Cancel edit" : "Clear"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — scoring engine tools */}
          <ScoreTools
            matchId={matchId}
            competitionId={match?.competition?.id || ""}
            match={match}
            plays={plays}
            teamSheet={teamSheet}
          />

          {/* Logged plays */}
          <div>
            <h2 className="text-lg font-black text-sffl-navy dark:text-white mb-2">
              Logged plays ({plays.length})
            </h2>
            {playsLoading ? (
              <Spinner />
            ) : plays.length === 0 ? (
              <p className="text-sm text-gray-500">
                No plays yet — log the first one above.
              </p>
            ) : (
              <div className="space-y-1.5">
                {plays.map((p) => (
                  <PlayRow
                    key={p.id}
                    play={p}
                    onEdit={() => startEdit(p)}
                    onDelete={() => requestDelete(p)}
                    onInsertAfter={() => startInsertAfter(p)}
                    onRederive={() => startRederive(p)}
                    homeTeamName={
                      match?.home_team?.short_name || match?.home_team?.name
                    }
                    awayTeamName={
                      match?.away_team?.short_name || match?.away_team?.name
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Step 2 — derived-vs-manual stats compare & Full Stat Audit Log */}
          <StatsCompare matchId={matchId} match={match} plays={plays} />
        </>
      )}
      {/* Saving, deleting and locking all confirm first. */}
      <ConfirmDialog
        open={pendingAction !== null}
        title={pbpDialog.title}
        description={pbpDialog.description}
        body={pbpDialog.body}
        confirmLabel={pbpDialog.confirmLabel}
        tone={pbpDialog.tone}
        icon={pbpDialog.icon}
        pending={saving || deleting || lockBusy}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
      {/* Re-derive situations — preview & confirm */}
      <ConfirmDialog
        open={rederive !== null}
        title={
          rederive ? `Re-derive situations after #${rederive.anchor.seq}?` : ""
        }
        description={
          rederive
            ? `Recomputes down, distance, possession and drive for the ${rederive.changes.length} play${rederive.changes.length === 1 ? "" : "s"} below, using #${rederive.anchor.seq}'s situation as the starting point. Quarter, ball spot and clock are left as entered. This overwrites those fields, including any manual corrections.`
            : undefined
        }
        body={
          rederive && (
            <DataTable
              data={rederive.changes}
              columns={rederiveColumns}
              searchable={false}
              paginated={false}
              compact
              getRowId={(ch) => ch.play.id}
            />
          )
        }
        confirmLabel={
          rederive
            ? `Apply ${rederive.changes.length} change${rederive.changes.length === 1 ? "" : "s"}`
            : ""
        }
        tone="warning"
        icon={ArrowPathIcon}
        maxWidth="2xl"
        pending={rederiveBusy}
        onConfirm={confirmRederive}
        onCancel={() => setRederive(null)}
      />{" "}
    </div>
  );
};

// ─── Read-only summary row for a logged play ──────────────────────────────────

const PlayRow = ({
  play,
  onEdit,
  onDelete,
  onInsertAfter,
  homeTeamName,
  awayTeamName,
}: {
  play: GamePlay;
  onEdit: () => void;
  onDelete: () => void;
  onInsertAfter: () => void;
  onRederive?: () => void;
  homeTeamName?: string;
  awayTeamName?: string;
}) => {
  const [showAudit, setShowAudit] = useState(false);
  const who = (p?: { name: string; jersey_number: number }) =>
    p ? (p.jersey_number ? `#${p.jersey_number} ${p.name}` : p.name) : "";
  const bits: ReactNode[] = [];
  if (play.off_qb) bits.push(who(play.off_qb));
  if (play.target) {
    if (isReturnTD(play)) {
      bits.push(
        <span className="inline-flex items-center gap-1 align-middle font-bold text-emerald-600 dark:text-emerald-400">
          <ArrowRightIcon className="w-3.5 h-3.5" aria-hidden="true" />
          Return TD: {who(play.target)}
        </span>,
      );
    } else {
      bits.push(
        <span className="inline-flex items-center gap-1 align-middle">
          <ArrowRightIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {who(play.target)}
        </span>,
      );
    }
  }
  if (play.yards != null)
    bits.push(`${play.yards >= 0 ? "+" : ""}${play.yards} yd`);
  if (play.batted_down) bits.push("batted down");
  if (play.rusher) bits.push(`(rush ${who(play.rusher)})`);
  if (play.defender) bits.push(`(def ${who(play.defender)})`);
  if (play.play_type === "BADSNAP")
    bits.push(
      `BAD SNAP${play.result === "SAF" ? " (SAFETY)" : play.result === "TO" ? " (TURNOVER)" : ""}`,
    );
  else if (play.center) bits.push(`(snap ${who(play.center)})`);
  if (play.penalty)
    bits.push(
      <span className="inline-flex items-center gap-1 align-middle">
        <FlagIcon className="w-3.5 h-3.5" aria-hidden="true" />
        {play.penalty}
        {play.penalty_player ? " " + who(play.penalty_player) : ""}
      </span>,
    );

  const accruals = getPlayStatAccruals(play, homeTeamName, awayTeamName);
  const actionClass =
    "inline-flex items-center gap-1 min-h-11 px-3 rounded-lg text-xs font-bold transition-colors";

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all">
      <div className="flex flex-col gap-1 px-3 py-1 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 py-1 lg:flex-1">
          <span className="text-[11px] font-black text-gray-400 shrink-0">
            #{play.seq}
          </span>
          <span className="text-[11px] font-bold text-sffl-navy dark:text-gray-300 shrink-0">
            H{play.quarter}
            {play.down ? ` · ${play.down}&${play.to_go ?? ""}` : ""}
          </span>
          <span className="text-xs font-mono font-bold bg-sffl-navy/10 dark:bg-white/10 rounded px-1.5 py-0.5 shrink-0">
            {play.play_type || play.result || "—"}
          </span>
          <span className="min-w-0 flex-1 basis-40 text-sm text-gray-700 dark:text-gray-200 wrap-break-word">
            {bits.map((b, i) => (
              <span key={i} className="mr-1.5">
                {b}
              </span>
            ))}
            {play.result && play.play_type ? (
              <span className="text-gray-400">· {play.result}</span>
            ) : null}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 lg:shrink-0">
          {play.home_score_after != null && play.away_score_after != null && (
            <span className="px-2 text-xs font-black text-sffl-navy dark:text-gray-300">
              {play.home_score_after}-{play.away_score_after}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowAudit((s) => !s)}
            aria-expanded={showAudit}
            className={`${actionClass} ${showAudit ? "bg-amber-500 text-white shadow-xs" : "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"}`}
            title="Audit exact stat accruals credited for this play"
          >
            <MagnifyingGlassIcon className="w-4 h-4" aria-hidden="true" />
            Audit ({accruals.length})
          </button>
          <button
            type="button"
            onClick={onInsertAfter}
            title="Insert a missed play right after this one"
            className={`${actionClass} text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30`}
          >
            Insert after
          </button>
          <button
            type="button"
            onClick={onEdit}
            className={`${actionClass} text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={`${actionClass} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30`}
          >
            Delete
          </button>
        </div>
      </div>
      {showAudit && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/80 border-t border-gray-200 dark:border-gray-700/80 space-y-2">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <BoltIcon className="w-3.5 h-3.5" aria-hidden="true" />
            Exact Stat Accruals Booked on Play #{play.seq}
          </div>
          {accruals.length === 0 ? (
            <p className="text-xs text-gray-500 italic">
              No individual player or team stats accrued for this play event.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accruals.map((a, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border shadow-2xs ${
                    a.color === "emerald"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      : a.color === "blue"
                        ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                        : a.color === "amber"
                          ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                          : a.color === "rose"
                            ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                            : a.color === "purple"
                              ? "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                              : a.color === "indigo"
                                ? "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                                : "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                  }`}
                >
                  <span className="font-extrabold">{a.entityName}:</span>
                  <span>{a.statKey}</span>
                  <span className="font-black underline">{a.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Step 3: scoring engine — recompute score + edit rules ────────────────────

// Touchdown & extra-point values are gender-based (set in code from the league
// scoring sheet — see docs/play-by-play-scoring-and-stats-rules.md), so they are
// NOT edited here. Only Safety and the down settings remain adjustable.
const RULE_FIELDS: { key: keyof GameRulesPayload; label: string }[] = [
  { key: "safety_points", label: "Safety" },
  { key: "downs_per_series", label: "Downs / series" },
  { key: "yards_to_first_down", label: "Yards to 1st down" },
];

interface ScoreToolsProps {
  matchId: string;
  competitionId: string;
  match?: Match;
  plays?: GamePlay[];
  teamSheet?: MatchTeamSheet | null;
}

const ScoreTools = ({
  matchId,
  competitionId,
  match,
  plays = [],
  teamSheet,
}: ScoreToolsProps) => {
  const { user } = useAuth();
  const isAppAdmin = user?.role === "app_admin";
  const queryClient = useQueryClient();
  const [recomputing, setRecomputing] = useState(false);
  const [editingRules, setEditingRules] = useState(false);
  const [rulesForm, setRulesForm] = useState<GameRulesPayload | null>(null);
  const [savingRules, setSavingRules] = useState(false);
  const [committingScore, setCommittingScore] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "recompute" | "commit" | "rules" | "mvp-override" | "mvp-reset" | null
  >(null);

  const [selectedMVP, setSelectedMVP] = useState<string>(match?.mvp_player_id || "");
  const [savingMVP, setSavingMVP] = useState(false);

  useEffect(() => {
    setSelectedMVP(match?.mvp_player_id || "");
  }, [match?.mvp_player_id]);

  const allSheetPlayers = useMemo(() => {
    return [...(teamSheet?.home_team || []), ...(teamSheet?.away_team || [])];
  }, [teamSheet]);

  const currentMVPPlayer = useMemo(() => {
    if (!match?.mvp_player_id) return null;
    return allSheetPlayers.find((p) => p.player_id === match.mvp_player_id) || null;
  }, [match?.mvp_player_id, allSheetPlayers]);

  const selectedMVPPlayer = useMemo(() => {
    if (!selectedMVP) return null;
    return allSheetPlayers.find((p) => p.player_id === selectedMVP) || null;
  }, [selectedMVP, allSheetPlayers]);

  // Clicking "Apply" is a no-op if it would leave (mvp_player_id, mvp_overridden)
  // exactly as they are now — e.g. the select already shows the auto-calculated
  // pick. It is NOT a no-op just because the selected player matches the current
  // mvp_player_id: locking in the platform's own pick as an official override is
  // a real state change (mvp_overridden false -> true) that must stay clickable.
  const mvpApplyWouldOverride = selectedMVP !== "";
  const mvpApplyIsNoOp =
    (selectedMVP || null) === (match?.mvp_player_id || null) &&
    mvpApplyWouldOverride === !!match?.mvp_overridden;

  const handleOverrideMVP = async (newPlayerId: string | null) => {
    setSavingMVP(true);
    try {
      const isOverride = newPlayerId !== null && newPlayerId !== "";
      await overrideMatchMVP(matchId, isOverride ? newPlayerId : null, isOverride);
      toast.success(
        isOverride
          ? "Official Match MVP override applied successfully!"
          : "Match MVP reset to auto-calculated."
      );
      await queryClient.invalidateQueries({ queryKey: ["pbpMatches"] });
      await queryClient.invalidateQueries({ queryKey: ["adminMatches"] });
      await queryClient.invalidateQueries({
        queryKey: ["adminMatchDetail", matchId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["publicMatchStatsCompare", matchId],
      });
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || "Failed to update match MVP");
    } finally {
      setSavingMVP(false);
    }
  };

  // Compute PBP derived score from the last play snapshot in log
  const lastPlayWithScore = [...plays]
    .reverse()
    .find((p) => p.home_score_after != null && p.away_score_after != null);
  const pbpHome = lastPlayWithScore?.home_score_after ?? 0;
  const pbpAway = lastPlayWithScore?.away_score_after ?? 0;

  const storedHome = match?.home_score ?? 0;
  const storedAway = match?.away_score ?? 0;
  const scoresMatch = pbpHome === storedHome && pbpAway === storedAway;

  const { data: rules } = useQuery({
    queryKey: ["pbpRules", competitionId],
    queryFn: () => getGameRules(competitionId),
    enabled: !!competitionId && editingRules,
  });

  useEffect(() => {
    if (rules && !rulesForm) {
      const { competition_id, ...rest } = rules;
      void competition_id;
      setRulesForm(rest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);

  const recompute = async () => {
    setRecomputing(true);
    try {
      const res = await recomputeScore(matchId);
      toast.success(
        `Play-by-Play running score refreshed: ${res.home_score}–${res.away_score}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["pbpPlays", matchId] });
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || "Failed to refresh score");
    } finally {
      setRecomputing(false);
    }
  };

  const requestCommit = () => {
    if (!isAppAdmin) {
      toast.error("Only App Admin can commit scores to the main match record");
      return;
    }
    setPendingAction("commit");
  };

  const handleCommitScore = async () => {
    setCommittingScore(true);
    try {
      const res = await commitScore(matchId);
      toast.success(
        `Official score updated to ${res.home_score}–${res.away_score} and standings refreshed!`,
      );
      await queryClient.invalidateQueries({ queryKey: ["pbpPlays", matchId] });
      await queryClient.invalidateQueries({
        queryKey: ["adminMatchDetail", matchId],
      });
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || "Failed to commit score");
    } finally {
      setCommittingScore(false);
    }
  };

  const saveRules = async () => {
    if (!rulesForm || !competitionId) return;
    setSavingRules(true);
    try {
      await upsertGameRules(competitionId, rulesForm);
      toast.success("Scoring rules saved");
      queryClient.invalidateQueries({ queryKey: ["pbpRules", competitionId] });
      setEditingRules(false);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || "Failed to save rules");
    } finally {
      setSavingRules(false);
    }
  };

  // Runs once the admin confirms. The handlers report their own errors, so the
  // dialog always closes afterwards.
  const confirmPendingAction = async () => {
    if (pendingAction === "recompute") await recompute();
    else if (pendingAction === "commit") await handleCommitScore();
    else if (pendingAction === "rules") await saveRules();
    else if (pendingAction === "mvp-reset") await handleOverrideMVP(null);
    else if (pendingAction === "mvp-override")
      await handleOverrideMVP(selectedMVP || null);
    setPendingAction(null);
  };

  const homeLabel =
    match?.home_team?.short_name || match?.home_team?.name || "Home";
  const awayLabel =
    match?.away_team?.short_name || match?.away_team?.name || "Away";
  const scoreDialog =
    pendingAction === "commit"
      ? {
          title: "Commit the play-by-play score?",
          description:
            "This overwrites the official match record and updates standings.",
          confirmLabel: "Commit Score",
          tone: "warning" as const,
          icon: CheckCircleIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Match", `${homeLabel} vs ${awayLabel}`],
                ["Official score now", `${storedHome} – ${storedAway}`],
                ["New official score", `${pbpHome} – ${pbpAway}`],
              ]}
            />
          ),
        }
      : pendingAction === "rules"
        ? {
            title: "Save scoring rules?",
            description: "Applies to the whole competition.",
            confirmLabel: "Save Rules",
            tone: "info" as const,
            icon: PencilSquareIcon,
            body: rulesForm && (
              <ConfirmSummary
                rows={RULE_FIELDS.map(
                  (f) =>
                    [f.label, String(rulesForm[f.key])] as [string, string],
                )}
              />
            ),
          }
        : pendingAction === "mvp-override"
          ? {
              title: "Apply MVP override?",
              description:
                "This locks in the selected player as the official Match MVP, taking precedence over the rating algorithm across all future play edits and score recalculations.",
              confirmLabel: "Apply Override",
              tone: "warning" as const,
              icon: StarIcon,
              body: (
                <ConfirmSummary
                  rows={[
                    ["Match", `${homeLabel} vs ${awayLabel}`],
                    [
                      "New Official MVP",
                      selectedMVPPlayer
                        ? `#${selectedMVPPlayer.jersey_number} ${selectedMVPPlayer.name}`
                        : "Auto-Calculated by Platform",
                    ],
                  ]}
                />
              ),
            }
          : pendingAction === "mvp-reset"
            ? {
                title: "Reset MVP to auto-calculated?",
                description:
                  "Clears the admin override so the platform's rating algorithm decides the Match MVP again.",
                confirmLabel: "Reset MVP",
                tone: "warning" as const,
                icon: ArrowPathIcon,
                body: (
                  <ConfirmSummary
                    rows={[
                      ["Match", `${homeLabel} vs ${awayLabel}`],
                      [
                        "Current Official MVP",
                        currentMVPPlayer
                          ? `#${currentMVPPlayer.jersey_number} ${currentMVPPlayer.name}`
                          : "Not assigned",
                      ],
                    ]}
                  />
                ),
              }
            : {
                title: "Refresh the play-by-play score?",
                description:
                  "Recalculates the running score stored on every logged play. The official match record is not changed.",
                confirmLabel: "Refresh Score",
                tone: "info" as const,
                icon: ArrowPathIcon,
                body: null,
              };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-sffl-navy dark:text-white flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Score Comparison & Commit</span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${scoresMatch ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"}`}
            >
              {scoresMatch ? (
                <>
                  <CheckCircleIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  Scores Match
                </>
              ) : (
                <>
                  <ExclamationTriangleIcon
                    className="w-3.5 h-3.5"
                    aria-hidden="true"
                  />
                  Discrepancy
                </>
              )}
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Logging plays computes a running score preview. Nothing touches the
            live match table or standings until an App Admin commits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditingRules((o) => !o)}
            aria-expanded={editingRules}
            className="px-3 py-2 min-h-11 border rounded-lg font-bold text-xs text-sffl-navy dark:text-gray-200 dark:border-gray-600"
          >
            Scoring rules
          </button>
          <button
            type="button"
            onClick={() => setPendingAction("recompute")}
            disabled={recomputing}
            className="px-3 py-2 min-h-11 bg-gray-100 dark:bg-gray-700 font-bold rounded-lg text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-200 disabled:opacity-50"
          >
            Refresh PBP score
          </button>
        </div>
      </div>

      {/* Side-by-Side Comparison Box */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2">
        {/* Official Stored Match Score */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
          <div className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-400 tracking-wider">
            Official Stored Score (Matches Table)
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
              {match?.home_team?.short_name || match?.home_team?.name || "Home"}{" "}
              vs{" "}
              {match?.away_team?.short_name || match?.away_team?.name || "Away"}
            </span>
            <span className="text-xl font-black font-mono text-sffl-navy dark:text-white">
              {storedHome} – {storedAway}
            </span>
          </div>
        </div>

        {/* Derived Play-by-Play Score */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-sffl-red tracking-wider">
              Play-by-Play Derived Score (Preview)
            </span>
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              {plays.length} logged play{plays.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <button
              type="button"
              onClick={requestCommit}
              disabled={!isAppAdmin || committingScore}
              title={
                !isAppAdmin
                  ? "Commit restricted to App Admin"
                  : "Commit PBP score to official match record"
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-11 bg-sffl-navy text-white font-bold rounded-lg text-xs hover:bg-sffl-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Commit PBP Score
              <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="text-xl font-black font-mono text-sffl-navy dark:text-white">
              {pbpHome} – {pbpAway}
            </span>
          </div>
        </div>
      </div>

      {/* Official Match MVP & Override Section */}
      <div className="p-3.5 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <TrophyIcon className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-gray-200">
                  Official Match MVP
                </span>
                {match?.mvp_overridden ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    <StarIcon className="w-3 h-3" aria-hidden="true" />
                    Admin Override Active
                  </span>
                ) : match?.mvp_player_id ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    <BoltIcon className="w-3 h-3" aria-hidden="true" />
                    Auto-Calculated
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                    Not Assigned
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5 truncate">
                {currentMVPPlayer ? (
                  <span>
                    #{currentMVPPlayer.jersey_number} {currentMVPPlayer.name} ({currentMVPPlayer.position})
                    {currentMVPPlayer.rating != null && (
                      <span className="text-gray-500 dark:text-gray-400 font-normal"> · Rating {currentMVPPlayer.rating.toFixed(1)}</span>
                    )}
                  </span>
                ) : match?.mvp_player_id ? (
                  <span>Assigned Player ({match.mvp_player_id.slice(0, 8)}...)</span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 font-normal">
                    No MVP selected yet. The system will auto-calculate when plays are logged, or you can override below.
                  </span>
                )}
              </p>
            </div>
          </div>
          {(match?.mvp_overridden || match?.mvp_player_id) && isAppAdmin && (
            <button
              type="button"
              onClick={() => setPendingAction("mvp-reset")}
              disabled={savingMVP}
              className="text-xs text-sffl-red hover:underline font-bold px-2 py-1 min-h-8 disabled:opacity-50"
            >
              Reset to Auto-Calculated
            </button>
          )}
        </div>

        {isAppAdmin && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
            <select
              value={selectedMVP}
              onChange={(e) => setSelectedMVP(e.target.value)}
              className="flex-1 min-h-11 px-3 py-2 text-xs font-bold bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:border-sffl-red focus:ring-sffl-red"
            >
              <option value="">Auto-Calculated by Platform (Default)</option>
              {teamSheet?.home_team && teamSheet.home_team.length > 0 && (
                <optgroup label={`${homeLabel} Roster`}>
                  {teamSheet.home_team.map((p) => (
                    <option key={p.player_id} value={p.player_id}>
                      #{p.jersey_number} {p.name} ({p.position}) {p.rating ? `· Rating ${p.rating.toFixed(1)}` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {teamSheet?.away_team && teamSheet.away_team.length > 0 && (
                <optgroup label={`${awayLabel} Roster`}>
                  {teamSheet.away_team.map((p) => (
                    <option key={p.player_id} value={p.player_id}>
                      #{p.jersey_number} {p.name} ({p.position}) {p.rating ? `· Rating ${p.rating.toFixed(1)}` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              type="button"
              onClick={() => setPendingAction("mvp-override")}
              disabled={savingMVP || mvpApplyIsNoOp}
              className="px-4 py-2 min-h-11 bg-sffl-red hover:bg-[#A52323] text-white font-bold rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors shadow-sm inline-flex items-center justify-center gap-1.5"
            >
              {savingMVP ? (
                <>
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                "Apply MVP Override"
              )}
            </button>
          </div>
        )}
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Admin overrides take precedence over the rating algorithm and remain permanently locked across play modifications and score recalculations.
        </p>
      </div>

      {editingRules && (
        <div className="pt-2">
          {!rulesForm ? (
            <Spinner size="sm" className="py-4" />
          ) : (
            <>
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 font-semibold">
                Touchdown &amp; extra-point points are <b>gender-based</b>{" "}
                (fixed in code from the league scoring sheet) and aren't set
                here. Only Safety and the down settings below are adjustable.
                Applies to the whole competition.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {RULE_FIELDS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                      {f.label}
                    </span>
                    <input
                      type="number"
                      value={rulesForm[f.key]}
                      onChange={(e) =>
                        setRulesForm({
                          ...rulesForm,
                          [f.key]: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full min-h-11 border rounded-lg px-2 py-1.5 text-sm font-bold dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPendingAction("rules")}
                disabled={savingRules}
                className="mt-3 px-5 py-2 min-h-11 bg-sffl-red text-white font-bold rounded-lg text-sm disabled:opacity-50"
              >
                Save rules
              </button>
            </>
          )}
        </div>
      )}

      {/* Refreshing the score, committing it, saving rules, and the MVP override actions all confirm first. */}
      <ConfirmDialog
        open={pendingAction !== null}
        title={scoreDialog.title}
        description={scoreDialog.description}
        body={scoreDialog.body}
        confirmLabel={scoreDialog.confirmLabel}
        tone={scoreDialog.tone}
        icon={scoreDialog.icon}
        pending={recomputing || committingScore || savingRules || savingMVP}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};
// Admin-only, per-match view of the stats this match's play log produces,
// rendered in the exact StatsTable layout so it mirrors the public stats page.
// These are the live committed numbers (stats write on every play now), plus the
// per-play stat-accrual audit log for checking how each number was arrived at.
const StatsCompare = ({
  matchId,
  match,
  plays = [],
}: {
  matchId: string;
  match?: Match;
  plays?: GamePlay[];
}) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"players" | "teams" | "audit">(
    "players",
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("");

  const homeTeamName =
    match?.home_team?.short_name || match?.home_team?.name || "Home";
  const awayTeamName =
    match?.away_team?.short_name || match?.away_team?.name || "Away";

  const { data, isFetching } = useQuery({
    queryKey: ["pbpCompare", matchId],
    queryFn: () => getStatsCompare(matchId),
    enabled: open,
  });

  const derived = useMemo(() => data?.derived || [], [data?.derived]);

  // Extract unique teams involved in this match from derived player stats
  const teamsList = useMemo(() => {
    const map: Record<string, { id: string; name: string; shortName: string }> =
      {};
    derived.forEach((p) => {
      if (p.team_id && !map[p.team_id]) {
        map[p.team_id] = {
          id: p.team_id,
          name: p.team_name || "Team",
          shortName: p.team_short_name || p.team_name || "Team",
        };
      }
    });
    return Object.values(map);
  }, [derived]);

  // Derived team stats aggregated from derived player stats
  const derivedTeamStats: TeamStat[] = useMemo(() => {
    const map: Record<string, TeamStat> = {};
    derived.forEach((p) => {
      if (!p.team_id) return;
      if (!map[p.team_id]) {
        map[p.team_id] = {
          team_id: p.team_id,
          team_name: p.team_name || "",
          team_short_name: p.team_short_name || "",
          team_logo: p.team_logo || "",
          passing_attempts: 0,
          rushing_attempts: 0,
          completed_passes: 0,
          passing_tds: 0,
          rushing_tds: 0,
          interceptions_thrown: 0,
          receptions: 0,
          receiving_tds: 0,
          extra_points_tds: 0,
          drops: 0,
          flag_pulls: 0,
          pass_deflections: 0,
          interceptions: 0,
          defensive_tds: 0,
          safety: 0,
          qb_sacks: 0,
          def_sacks: 0,
          defensive_xp_tds: 0,
          incomplete_passes: 0,
          uncatchable_passes: 0,
          thrown_away_passes: 0,
          batted_down_passes: 0,
          targets: 0,
          passing_yards: 0,
          rushing_yards: 0,
          receiving_yards: 0,
          xp_attempts: 0,
          xp_good: 0,
          xp_fail: 0,
          safety_conceded: 0,
          punts: 0,
          first_downs: 0,
          turnovers: 0,
          penalties: 0,
          penalty_yards: 0,
          total_plays: 0,
          drives: 0,
        };
      }
      const t = map[p.team_id];
      t.passing_attempts += p.passing_attempts || 0;
      t.rushing_attempts += p.rushing_attempts || 0;
      t.completed_passes += p.completed_passes || 0;
      t.incomplete_passes += p.incomplete_passes || 0;
      t.uncatchable_passes += p.uncatchable_passes || 0;
      t.thrown_away_passes += p.thrown_away_passes || 0;
      t.batted_down_passes += p.batted_down_passes || 0;
      t.targets += p.targets || 0;
      t.passing_yards += p.passing_yards || 0;
      t.rushing_yards += p.rushing_yards || 0;
      t.receiving_yards += p.receiving_yards || 0;
      t.passing_tds += p.passing_tds || 0;
      t.rushing_tds += p.rushing_tds || 0;
      t.interceptions_thrown += p.interceptions_thrown || 0;
      t.receptions += p.receptions || 0;
      t.receiving_tds += p.receiving_tds || 0;
      t.extra_points_tds += p.extra_points_tds || 0;
      t.xp_attempts += p.xp_attempts || 0;
      t.xp_good += p.xp_good || 0;
      t.xp_fail += p.xp_fail || 0;
      t.drops += p.drops || 0;
      t.flag_pulls += p.flag_pulls || 0;
      t.pass_deflections += p.pass_deflections || 0;
      t.interceptions += p.interceptions || 0;
      t.defensive_tds += p.defensive_tds || 0;
      t.safety += p.safety || 0;
      t.safety_conceded += p.safety_conceded || 0;
      t.qb_sacks += p.qb_sacks || 0;
      t.def_sacks += p.def_sacks || 0;
      t.defensive_xp_tds += p.defensive_xp_tds || 0;
    });
    return Object.values(map);
  }, [derived]);

  // Filter player stats by team selection
  const filteredPlayerStats = useMemo(() => {
    if (selectedTeamId === "all") return derived;
    return derived.filter((p) => p.team_id === selectedTeamId);
  }, [derived, selectedTeamId]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-sffl-navy dark:text-white">
            Play-by-Play Stats{" "}
            <span className="text-[10px] font-black uppercase tracking-wider text-green-600 align-middle">
              live
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The player/team box scores this match's plays produce — written live
            as you log. Or inspect the complete line-by-line stat accrual log
            for every play.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="px-4 py-2 min-h-11 border rounded-lg font-bold text-sm text-sffl-navy dark:text-gray-200 dark:border-gray-600"
        >
          {open ? "Hide" : "Show stats"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          {isFetching ? (
            <Spinner label="Computing stats" />
          ) : derived.length === 0 && plays.length === 0 ? (
            <p className="text-sm text-gray-500">
              No player stats derived yet — log some plays with players first.
            </p>
          ) : (
            <>
              {/* Tabs & Team Filter Bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
                {/* Player vs Team vs Audit Tabs */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab("players")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-lg font-bold text-xs transition-colors ${activeTab === "players" ? "bg-sffl-navy text-white shadow-sm" : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100"}`}
                  >
                    <UserIcon className="w-4 h-4" aria-hidden="true" />
                    Player Stats ({derived.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("teams")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-lg font-bold text-xs transition-colors ${activeTab === "teams" ? "bg-sffl-navy text-white shadow-sm" : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100"}`}
                  >
                    <ShieldCheckIcon className="w-4 h-4" aria-hidden="true" />
                    Team Stats ({derivedTeamStats.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("audit")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-lg font-bold text-xs transition-colors ${activeTab === "audit" ? "bg-amber-500 text-white shadow-sm" : "bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"}`}
                  >
                    <MagnifyingGlassIcon
                      className="w-4 h-4"
                      aria-hidden="true"
                    />
                    Full Stat Audit Log ({plays.length})
                  </button>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Order By Dropdown */}
                  {activeTab !== "audit" && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-gray-400">
                        Order By:
                      </span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-2.5 py-1 min-h-11 text-xs font-bold border border-gray-200 dark:border-gray-600 cursor-pointer"
                      >
                        <option value="">Default (A to Z)</option>
                        <option value="passing_yards">Pass Yards (YDS)</option>
                        <option value="passing_tds">
                          Pass Touchdowns (TDs)
                        </option>
                        <option value="completed_passes">
                          Completions (COMP)
                        </option>
                        <option value="rushing_yards">Rush Yards (YDS)</option>
                        <option value="rushing_tds">
                          Rush Touchdowns (TDs)
                        </option>
                        <option value="receiving_yards">
                          Receiving Yards (YDS)
                        </option>
                        <option value="receiving_tds">
                          Receiving Touchdowns (TDs)
                        </option>
                        <option value="receptions">Receptions (Rec)</option>
                        <option value="targets">Targets (Tgt)</option>
                        <option value="flag_pulls">Flag Pulls (Tackles)</option>
                        <option value="interceptions">
                          Interceptions (Def)
                        </option>
                        <option value="pass_deflections">
                          Pass Deflections
                        </option>
                        <option value="qb_sacks">Sacks Taken (QB)</option>
                        <option value="def_sacks">Defensive Sacks</option>
                      </select>
                    </div>
                  )}

                  {/* Team Filter Pills (Player Stats view only) */}
                  {activeTab === "players" && teamsList.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-gray-400 mr-1">
                        Filter Team:
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedTeamId("all")}
                        className={`px-3 py-1 min-h-11 rounded-md text-xs font-bold transition-colors ${selectedTeamId === "all" ? "bg-sffl-red text-white" : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100"}`}
                      >
                        All Teams
                      </button>
                      {teamsList.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTeamId(t.id)}
                          className={`px-3 py-1 min-h-11 rounded-md text-xs font-bold transition-colors ${selectedTeamId === t.id ? "bg-sffl-red text-white" : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100"}`}
                        >
                          {t.shortName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Render Active View */}
              {activeTab === "players" ? (
                <StatsTable
                  type="players"
                  playerStats={filteredPlayerStats}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                />
              ) : activeTab === "teams" ? (
                <StatsTable
                  type="teams"
                  teamStats={derivedTeamStats}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                />
              ) : (
                <FullStatAuditLog
                  plays={plays}
                  homeTeamName={homeTeamName}
                  awayTeamName={awayTeamName}
                />
              )}

              {activeTab !== "audit" && (
                <p className="mt-4 flex items-start gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400">
                  <CheckCircleIcon
                    className="w-4 h-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    These are the live stats. Every play you log writes straight
                    to the main stats table — no commit step.
                  </span>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const FullStatAuditLog = ({
  plays,
  homeTeamName,
  awayTeamName,
}: {
  plays: GamePlay[];
  homeTeamName?: string;
  awayTeamName?: string;
}) => {
  const [quarterFilter, setQuarterFilter] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPlays = useMemo(() => {
    return plays.filter((p) => {
      if (quarterFilter !== "all" && p.quarter !== quarterFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const accruals = getPlayStatAccruals(p, homeTeamName, awayTeamName);
      const playText =
        `${p.play_type} ${p.result} ${p.off_qb?.name || ""} ${p.target?.name || ""} ${p.defender?.name || ""} ${p.rusher?.name || ""}`.toLowerCase();
      const accrualText = accruals
        .map((a) => `${a.entityName} ${a.statKey}`)
        .join(" ")
        .toLowerCase();
      return playText.includes(q) || accrualText.includes(q);
    });
  }, [plays, quarterFilter, searchQuery, homeTeamName, awayTeamName]);

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between gap-3 flex-wrap bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-500">
            Filter Half:
          </span>
          <button
            onClick={() => setQuarterFilter("all")}
            className={`px-3 py-1 min-h-11 rounded-md text-xs font-bold transition-colors ${quarterFilter === "all" ? "bg-sffl-navy text-white" : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"}`}
          >
            All
          </button>
          {[1, 2].map((q) => (
            <button
              key={q}
              onClick={() => setQuarterFilter(q)}
              className={`px-3 py-1 min-h-11 rounded-md text-xs font-bold transition-colors ${quarterFilter === q ? "bg-sffl-navy text-white" : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"}`}
            >
              {q}H
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search player, stat, or play type…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 min-h-11 text-xs font-semibold dark:bg-gray-700 dark:text-white w-full sm:w-64"
        />
      </div>

      <div className="space-y-2 max-h-150 overflow-y-auto pr-1">
        {filteredPlays.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            No plays logged yet or matching the current filters.
          </p>
        ) : (
          filteredPlays.map((p) => {
            const accruals = getPlayStatAccruals(p, homeTeamName, awayTeamName);
            return (
              <div
                key={p.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700/80 pb-2 flex-wrap">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-black text-gray-400">
                      Play #{p.seq}
                    </span>
                    <span className="font-bold text-sffl-navy dark:text-gray-200">
                      H{p.quarter}
                      {p.down ? ` · ${p.down}&${p.to_go ?? ""}` : ""}
                    </span>
                    <span className="font-mono font-black px-2 py-0.5 rounded bg-sffl-navy/10 dark:bg-white/10 text-sffl-navy dark:text-white">
                      {p.play_type || p.result}
                    </span>
                    {p.result && (
                      <span className="font-bold text-gray-500">
                        [{p.result}]
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-black text-sffl-navy dark:text-gray-300">
                    Score: {p.home_score_after ?? 0}–{p.away_score_after ?? 0}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {accruals.length === 0 ? (
                    <span className="text-xs text-gray-400 italic">
                      No player/team stats accrued.
                    </span>
                  ) : (
                    accruals.map((a, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border shadow-2xs ${
                          a.color === "emerald"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : a.color === "blue"
                              ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              : a.color === "amber"
                                ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                : a.color === "rose"
                                  ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                                  : a.color === "purple"
                                    ? "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                    : a.color === "indigo"
                                      ? "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                                      : "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                        }`}
                      >
                        <span className="font-extrabold">{a.entityName}:</span>
                        <span>{a.statKey}</span>
                        <span className="font-black underline">{a.value}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
