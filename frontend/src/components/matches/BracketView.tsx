/* eslint-disable react-refresh/only-export-components */
import { useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  QuestionMarkCircleIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import { FootballIcon } from "../icons/FootballIcon";
import { useQuery } from "@tanstack/react-query";
import { getMatches } from "../../services";
import type { Match, BracketColumn } from "../../types";
import { Spinner } from "../ui";
import type { Shape } from "../ui/buttonStyles";
import { TeamLink } from "../domain";
import { formatMatchTime } from "../../utils";

/**
 * Knockout bracket for a KNOCKOUT-format competition.
 *
 * Columns are ordered by each match's STAGE tag (Wildcard → Quarter-Finals →
 * Semi-Finals → Bowl) — the admin tags every playoff match with its stage, so
 * the bracket arranges itself without needing advancement wiring. This also
 * lets a single stage hold several matches (e.g. two-legged semifinals).
 * Where no stage tags exist (older / wizard brackets), we fall back to the
 * feeds_match_id pointer depth.
 */

interface BracketViewProps {
  competitionId: string;
  /** Compact mode: vertical round-by-round list (used in the MatchHub sidebar). */
  compact?: boolean;
  viewAllLink?: string;
  /**
   * Cup competition: one bracket from Round 1 to the Final. The three Swiss
   * rounds come first, each card showing the record its teams carried into
   * that round, then the knockout tree. Every slot exists from the start, so
   * rounds not yet filled show their date with "TBD" teams.
   */
  cup?: boolean;
  /** `square` for sharp corners (the Standings page uses this). */
  shape?: Shape;
}

// A cup's rounds in playing order, with their column titles.
const CUP_ROUNDS = [
  { round: "ROUND_1", title: "Round 1" },
  { round: "ROUND_2", title: "Round 2" },
  { round: "ROUND_3", title: "Round 3" },
  { round: "QUARTERFINAL", title: "Quarterfinals" },
  { round: "SEMIFINAL", title: "Semifinals" },
  { round: "FINAL", title: "Final" },
] as const;
const CUP_SWISS_ROUNDS: readonly string[] = ["ROUND_1", "ROUND_2", "ROUND_3"];

type WinLoss = { w: number; l: number };

// A record sits in an outlined chip so it doesn't read as a score; the
// legend above the bracket uses the same chip to explain it.
const RECORD_CHIP =
  "shrink-0 px-1 rounded border border-gray-200 dark:border-gray-600 text-[10px] font-bold tabular-nums text-gray-400 dark:text-gray-500";

const RecordLegend = () => (
  <p className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
    <span className={RECORD_CHIP} aria-hidden="true">
      1-0
    </span>
    Wins-losses going into the round, not a score
  </p>
);

// hasRecords reports whether any of these cards shows a record: a Round 2
// or 3 match with a team in it.
const hasRecords = (matches: Match[]) =>
  matches.some(
    (m) =>
      (m.round === "ROUND_2" || m.round === "ROUND_3") &&
      (m.home_team?.id || m.away_team?.id),
  );

// Friendly column titles per stage rank.
const STAGE_TITLES = ["Wildcards", "Playoffs 1", "Playoffs 2", "Bowl"];
// The Cup's QUARTERFINAL / SEMIFINAL / FINAL rank 0 / 2 / 3; it has no rank 1.
const CUP_STAGE_TITLES = ["Quarterfinals", "Playoffs 1", "Semifinals", "Final"];
const UNKNOWN_RANK = 99;

// Rank a round/stage label robustly — recognises the manual stage values, the
// wizard's "Playoff 1/2" labels, and common synonyms. Order of checks matters:
// "Quarter-Final"/"Semi-Final" contain "final", so they must be tested before
// the bowl/final check.
export const stageRank = (round?: string): number => {
  const r = (round || "").toLowerCase();
  if (!r) return UNKNOWN_RANK;
  if (r.includes("wild") || r.includes("quarter")) return 0;
  if (r.includes("playoff 1") || r.includes("playoffs 1")) return 1;
  if (r.includes("semi") || r.includes("playoff 2") || r.includes("playoffs 2"))
    return 2;
  if (r.includes("bowl") || r.includes("final")) return 3;
  return UNKNOWN_RANK;
};

export const isBowlStage = (round?: string): boolean => stageRank(round) === 3;

export const winnerSide = (m: Match): "HOME" | "AWAY" | null => {
  const isBye =
    stageRank(m.round) === 0 &&
    ((m.home_team?.id && !m.away_team?.id) ||
      (!m.home_team?.id && m.away_team?.id));
  if (isBye) {
    return m.home_team?.id ? "HOME" : "AWAY";
  }
  if (m.status !== "FINISHED" || m.home_score == null || m.away_score == null)
    return null;
  if (m.home_score > m.away_score) return "HOME";
  if (m.away_score > m.home_score) return "AWAY";
  return null;
};

export const buildBracketColumns = (
  matches: Match[],
  { cup = false }: { cup?: boolean } = {},
): BracketColumn[] => {
  const stageTitles = cup ? CUP_STAGE_TITLES : STAGE_TITLES;
  if (matches.length === 0) return [];

  const sortCol = (col: Match[]) =>
    col.sort(
      (a, b) =>
        (a.bracket_pos ?? 999) - (b.bracket_pos ?? 999) ||
        a.date.localeCompare(b.date),
    );

  // Primary path: order by stage tag when any match carries a recognised one.
  const anyStaged = matches.some((m) => stageRank(m.round) !== UNKNOWN_RANK);
  if (anyStaged) {
    const groups = new Map<number, Match[]>();
    matches.forEach((m) => {
      const rank = stageRank(m.round);
      if (!groups.has(rank)) groups.set(rank, []);
      groups.get(rank)!.push(m);
    });
    return [...groups.keys()]
      .sort((a, b) => a - b)
      .map((rank) => ({
        title: rank === UNKNOWN_RANK ? "Other" : stageTitles[rank],
        matches: sortCol(groups.get(rank)!),
      }));
  }

  // Fallback: derive columns from feeds_match_id pointer depth (hops to final).
  const byId = new Map(matches.map((m) => [m.id, m]));
  const depthCache = new Map<string, number>();
  const depthOf = (m: Match, seen: Set<string>): number => {
    const cached = depthCache.get(m.id);
    if (cached !== undefined) return cached;
    let d = 0;
    if (m.feeds_match_id && byId.has(m.feeds_match_id) && !seen.has(m.id)) {
      seen.add(m.id);
      d = 1 + depthOf(byId.get(m.feeds_match_id)!, seen);
    }
    depthCache.set(m.id, d);
    return d;
  };
  const maxDepth = Math.max(...matches.map((m) => depthOf(m, new Set())));
  const cols: Match[][] = Array.from({ length: maxDepth + 1 }, () => []);
  matches.forEach((m) => {
    cols[maxDepth - depthOf(m, new Set())].push(m);
  });

  return cols
    .filter((col) => col.length > 0)
    .map((col, i, arr) => {
      sortCol(col);
      const labels = [...new Set(col.map((m) => m.round).filter(Boolean))];
      const title =
        labels.length === 1
          ? labels[0]!
          : i === arr.length - 1
            ? "Final"
            : `Round ${i + 1}`;
      return { title, matches: col };
    });
};

// buildCupColumns lays a cup out by its round tags: Swiss rounds by kickoff,
// knockout rounds top to bottom by bracket_pos.
export const buildCupColumns = (matches: Match[]): BracketColumn[] =>
  CUP_ROUNDS.map(({ round, title }) => ({
    title,
    matches: matches
      .filter((m) => m.round === round)
      .sort((a, b) =>
        CUP_SWISS_ROUNDS.includes(round)
          ? a.date.localeCompare(b.date) || (a.start_time || "").localeCompare(b.start_time || "")
          : (a.bracket_pos ?? 999) - (b.bracket_pos ?? 999),
      ),
  })).filter((col) => col.matches.length > 0);

// cupRecordsBefore gives each team's Swiss win-loss record going into each
// round: recordsBefore.get("ROUND_2")?.get(teamId). Rounds 2 and 3 pair teams
// with the same record, so this is what each of their cards shows.
export const cupRecordsBefore = (matches: Match[]) => {
  const before = new Map<string, Map<string, WinLoss>>();
  const running = new Map<string, WinLoss>();
  const bump = (id: string | undefined, won: boolean) => {
    if (!id) return;
    const r = running.get(id) ?? { w: 0, l: 0 };
    running.set(id, won ? { ...r, w: r.w + 1 } : { ...r, l: r.l + 1 });
  };
  for (const round of CUP_SWISS_ROUNDS) {
    before.set(round, new Map([...running].map(([id, r]) => [id, { ...r }])));
    for (const m of matches) {
      if (m.round !== round) continue;
      const side = winnerSide(m);
      if (!side) continue;
      bump(m.home_team?.id, side === "HOME");
      bump(m.away_team?.id, side === "AWAY");
    }
  }
  return before;
};

const TeamRow = ({
  m,
  side,
  secondLeg,
  record,
}: {
  m: Match;
  side: "HOME" | "AWAY";
  secondLeg?: Match;
  /** The team's record going into this match, e.g. "1-0" (cup Swiss rounds). */
  record?: string;
}) => {
  const team = side === "HOME" ? m.home_team : m.away_team;
  const isBye =
    stageRank(m.round) === 0 &&
    ((m.home_team?.id && !m.away_team?.id) ||
      (!m.home_team?.id && m.away_team?.id));
  const isTbd = !team?.id && !isBye;

  // Determine scores if secondLeg exists
  let scoreL1: number | string = "";
  let scoreL2: number | string = "";
  let scoreAgg: number | string = "";

  if (secondLeg) {
    // L1 Score
    if (m.status === "FINISHED" || m.status === "LIVE") {
      scoreL1 = side === "HOME" ? (m.home_score ?? 0) : (m.away_score ?? 0);
    } else {
      scoreL1 = "-";
    }

    // L2 Score
    if (secondLeg.status === "FINISHED" || secondLeg.status === "LIVE") {
      const isHomeInL2 = secondLeg.home_team?.id === team?.id;
      scoreL2 = isHomeInL2
        ? (secondLeg.home_score ?? 0)
        : (secondLeg.away_score ?? 0);
    } else {
      scoreL2 = "-";
    }

    // AGG Score
    const numL1 = typeof scoreL1 === "number" ? scoreL1 : 0;
    const numL2 = typeof scoreL2 === "number" ? scoreL2 : 0;
    if (scoreL1 !== "-" || scoreL2 !== "-") {
      scoreAgg = numL1 + numL2;
    } else {
      scoreAgg = "-";
    }
  } else {
    scoreL1 = side === "HOME" ? (m.home_score ?? "") : (m.away_score ?? "");
  }

  // Determine aggregate winner highlight
  let isWinner = false;
  let finished = false;

  if (secondLeg) {
    const bothFinished =
      m.status === "FINISHED" && secondLeg.status === "FINISHED";
    if (bothFinished) {
      finished = true;

      // Calculate total aggregate scores for home team (m.home_team) and away team (m.away_team)
      const homeL1 = m.home_score ?? 0;
      const awayL1 = m.away_score ?? 0;

      const homeL2 =
        secondLeg.home_team?.id === m.home_team?.id
          ? (secondLeg.home_score ?? 0)
          : (secondLeg.away_score ?? 0);
      const awayL2 =
        secondLeg.home_team?.id === m.away_team?.id
          ? (secondLeg.home_score ?? 0)
          : (secondLeg.away_score ?? 0);

      const aggHome = homeL1 + homeL2;
      const aggAway = awayL1 + awayL2;

      if (side === "HOME") {
        isWinner = aggHome > aggAway;
      } else {
        isWinner = aggAway > aggHome;
      }
    }
  } else {
    const winner = winnerSide(m);
    finished = winner !== null;
    isWinner = winner === side;
  }

  const content = (
    <div
      className={`flex items-center gap-2 px-3 py-2 ${finished && !isWinner ? "opacity-50" : ""}`}
    >
      {team?.logo ? (
        <img
          src={team.logo}
          alt={team.name}
          className="w-6 h-6 object-contain shrink-0"
        />
      ) : (
        <div className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-black text-gray-500 dark:text-gray-400 shrink-0">
          {isTbd ? (
            <QuestionMarkCircleIcon
              className="w-5 h-5"
              aria-label="Team to be decided"
            />
          ) : isBye && !team?.id
              ? "BYE"
              : (team.short_name || team.name.substring(0, 2))
                  .toUpperCase()
                  .substring(0, 3)}
        </div>
      )}
      <span
        className={`text-xs flex-1 ${secondLeg ? "leading-tight" : "truncate"} ${isTbd ? "text-gray-400 dark:text-gray-500 italic font-semibold" : isWinner ? "font-black text-sffl-navy dark:text-white" : "font-bold text-gray-700 dark:text-gray-300"}`}
      >
        {isTbd
          ? "TBD"
          : isBye && !team?.id
            ? "BYE"
            : (team.short_name || team.name).toUpperCase()}
      </span>
      {record && !isTbd && (
        <span className={RECORD_CHIP} title="Wins-losses going into this round">
          {record}
        </span>
      )}
      {secondLeg ? (
        <div className="flex gap-4 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
          <span className="w-6 text-center">{scoreL1}</span>
          <span className="w-6 text-center">{scoreL2}</span>
          <span
            className={`w-8 text-center font-black ${isWinner ? "text-sffl-red" : "text-gray-700 dark:text-gray-300"}`}
          >
            {scoreAgg}
          </span>
        </div>
      ) : (
        <span
          className={`text-sm tabular-nums ${isWinner ? "font-black text-sffl-red" : "font-bold text-gray-500 dark:text-gray-400"}`}
        >
          {m.status === "FINISHED" || m.status === "LIVE" ? scoreL1 : ""}
        </span>
      )}
    </div>
  );

  if (isTbd || (isBye && !team?.id)) {
    return content;
  }

  return (
    <Link
      to={`/teams/${team.id}`}
      className="block hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
    >
      {content}
    </Link>
  );
};

// championOf finds the decided winner of the bracket: the team that won the
// Bowl (the final). Prefers the match tagged with the Bowl stage; falls back to
// the lone match that advances nowhere. Undefined until the final is FINISHED.
export const championOf = (
  matches: Match[],
): Match["home_team"] | undefined => {
  const bowls = matches.filter((m) => isBowlStage(m.round));
  let final: Match | undefined;
  if (bowls.length === 1) {
    final = bowls[0];
  } else if (bowls.length === 0) {
    const noFeed = matches.filter((m) => !m.feeds_match_id);
    if (noFeed.length === 1) final = noFeed[0];
  }
  if (!final) return undefined;
  const side = winnerSide(final);
  if (!side) return undefined;
  return side === "HOME" ? final.home_team : final.away_team;
};

/** Gold champion card shown to the right of the Bowl (or Cup Final) once it has been won. */
export const ChampionCard = ({
  team,
  compact = false,
  cup = false,
  shape = "round",
}: {
  team: NonNullable<Match["home_team"]>;
  compact?: boolean;
  cup?: boolean;
  shape?: Shape;
}) => {
  const trophy = cup
    ? { src: "/images/branding/showtime-community-cup-shield.webp", alt: "Showtime Cup shield" }
    : { src: "/images/branding/showtime-bowl-trophy.webp", alt: "Showtime Bowl trophy" };
  if (compact) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-linear-to-r from-amber-300 via-yellow-400 to-amber-500 text-amber-950">
        <img
          src={trophy.src}
          alt={trophy.alt}
          decoding="async"
          className="h-7 w-auto object-contain drop-shadow"
        />
        {team.logo ? (
          <img
            src={team.logo}
            alt={team.name}
            loading="lazy"
            decoding="async"
            className="w-9 h-9 object-contain drop-shadow"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-amber-950/10 flex items-center justify-center text-[10px] font-black">
            {(team.short_name || team.name.substring(0, 3)).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-widest opacity-70">
            Champion
          </div>
          <TeamLink id={team.id} className="block font-black text-sm uppercase truncate">
            {team.name}
          </TeamLink>
        </div>
      </div>
    );
  }
  const pillRadius = shape === "square" ? "rounded-none" : "rounded-lg";
  const radius = shape === "square" ? "rounded-none" : "rounded-xl";
  return (
    <div className="flex flex-col w-56 md:w-64">
      <div className={`text-center text-[10px] md:text-xs font-black uppercase tracking-widest mb-3 py-1.5 ${pillRadius} bg-linear-to-r from-amber-300 via-yellow-400 to-amber-500 text-amber-950 shadow-md`}>
        Champion
      </div>
      <div className={`flex flex-col justify-center items-center flex-1 gap-3 ${radius} border-2 border-amber-400/70 bg-linear-to-b from-amber-50 via-yellow-50 to-amber-100 dark:from-amber-900/30 dark:via-yellow-900/20 dark:to-amber-900/10 shadow-lg p-6 text-center`}>
        <img
          src={trophy.src}
          alt={trophy.alt}
          className="h-20 md:h-24 w-auto object-contain drop-shadow-md animate-bounce"
        />
        {team.logo ? (
          <img
            src={team.logo}
            alt={team.name}
            className="w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-lg"
          />
        ) : (
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-amber-200 dark:bg-amber-800/50 flex items-center justify-center text-2xl font-black text-amber-900 dark:text-amber-200">
            {(team.short_name || team.name.substring(0, 3)).toUpperCase()}
          </div>
        )}
        <TeamLink
          id={team.id}
          className="block font-black text-base md:text-lg uppercase tracking-tight text-amber-900 dark:text-amber-200 leading-tight"
        >
          {team.name}
        </TeamLink>
        <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
          <TrophyIcon className="w-4 h-4" aria-hidden="true" />
          Winner
          <TrophyIcon className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};

export const MatchCard = ({
  m,
  secondLeg,
  isFinal,
  records,
  showTime = false,
  shape = "round",
}: {
  m: Match;
  secondLeg?: Match;
  isFinal: boolean;
  /** Records going into this match by team ID; shown beside each team. */
  records?: Map<string, WinLoss>;
  /** Show the kickoff time beside the date (cup days have several games). */
  showTime?: boolean;
  shape?: Shape;
}) => {
  const recordOf = (id?: string) => {
    const r = id ? records?.get(id) : undefined;
    return r ? `${r.w}-${r.l}` : undefined;
  };
  const radius = shape === "square" ? "rounded-none" : "rounded-xl";
  return (
  <div
    className={`bg-white dark:bg-gray-800 ${radius} border shadow-sm overflow-hidden w-full ${isFinal ? "border-sffl-red/40 ring-1 ring-sffl-red/20" : "border-gray-100 dark:border-gray-700"}`}
  >
    <Link
      to={`/matches/${m.id}`}
      className="flex items-center justify-between gap-2 px-3 py-1.5 min-h-11 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {new Date(m.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
        {showTime && m.start_time && ` · ${formatMatchTime(m.start_time, m.date)}`}
      </span>
      {secondLeg ? (
        <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
          <span className="w-6 text-center">L1</span>
          <span className="w-6 text-center">L2</span>
          <span className="w-8 text-center text-sffl-red">AGG</span>
        </div>
      ) : (
        <span
          className={`text-[9px] font-black uppercase tracking-widest ${m.status === "LIVE" ? "text-red-500 animate-pulse" : m.status === "FINISHED" ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"}`}
        >
          {m.status === "FINISHED" ? "FT" : m.status}
        </span>
      )}
    </Link>
    <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
      <TeamRow m={m} side="HOME" secondLeg={secondLeg} record={recordOf(m.home_team?.id)} />
      <TeamRow m={m} side="AWAY" secondLeg={secondLeg} record={recordOf(m.away_team?.id)} />
    </div>
  </div>
  );
};

export const BracketView = ({
  competitionId,
  compact = false,
  viewAllLink,
  cup = false,
  shape = "round",
}: BracketViewProps) => {
  const cardRadius = shape === "square" ? "rounded-none" : "rounded-xl";
  const pillRadius = shape === "square" ? "rounded-none" : "rounded-lg";
  const { data, isLoading } = useQuery({
    queryKey: ["bracketMatches", competitionId],
    queryFn: () => getMatches(competitionId, 1, 100),
    enabled: !!competitionId,
  });

  const allMatches = useMemo(() => data?.data || [], [data]);
  const finalTitle = cup ? "Final" : "Bowl";

  // Build a lookup: leg1.id -> leg2 match object
  const secondLegMap = useMemo(() => {
    const map = new Map<string, Match>();
    const allMatchesById = new Map(allMatches.map((m) => [m.id, m]));
    for (const m of allMatches) {
      if (m.second_leg_match_id) {
        const leg2 = allMatchesById.get(m.second_leg_match_id);
        if (leg2) map.set(m.id, leg2);
      }
    }
    return map;
  }, [allMatches]);

  // Keep track of which matches are marked as leg 2 of some tie
  const secondLegIds = useMemo(() => {
    return new Set(
      allMatches.flatMap((m) =>
        m.second_leg_match_id ? [m.second_leg_match_id] : [],
      ),
    );
  }, [allMatches]);

  // Filter out Leg 2 matches from the bracket display list since they're rendered inline on the Leg 1 card
  const filteredMatches = useMemo(() => {
    return allMatches.filter((m) => !secondLegIds.has(m.id));
  }, [allMatches, secondLegIds]);

  const columns = useMemo(
    () => (cup ? buildCupColumns(filteredMatches) : buildBracketColumns(filteredMatches)),
    [filteredMatches, cup],
  );
  const recordsBefore = useMemo(
    () => (cup ? cupRecordsBefore(filteredMatches) : undefined),
    [filteredMatches, cup],
  );
  // Rounds 2 and 3 show the records teams carried in; Round 1 starts level.
  const recordsFor = (m: Match) =>
    m.round && m.round !== "ROUND_1" ? recordsBefore?.get(m.round) : undefined;
  const champion = useMemo(
    () => championOf(filteredMatches),
    [filteredMatches],
  );

  // In compact mode (mini standing widget for Playoffs), show the last match first (Bowl first, then earlier rounds)
  // and sort matches within each stage latest first.
  const compactColumns = useMemo(() => {
    if (!compact) return columns;
    // A cup has 22 slots; the sidebar shows the round being played (the
    // latest with teams in it) and the one after, in playing order.
    if (cup) {
      let current = 0;
      columns.forEach((col, i) => {
        if (col.matches.some((m) => m.home_team?.id || m.away_team?.id)) current = i;
      });
      return columns.slice(current, current + 2);
    }
    return [...columns].reverse().map((col) => ({
      ...col,
      matches: [...col.matches].sort((a, b) => {
        const dateComp = b.date.localeCompare(a.date);
        if (dateComp !== 0) return dateComp;
        return (b.bracket_pos ?? 0) - (a.bracket_pos ?? 0);
      }),
    }));
  }, [columns, compact, cup]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && columns.length > 0) {
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          const el = scrollContainerRef.current;
          el.scrollLeft = el.scrollWidth;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, columns.length]);

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 ${cardRadius} shadow-sm`}>
        <Spinner label="Loading bracket…" className="py-12" />
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className={`bg-gray-100 dark:bg-gray-800 p-8 ${cardRadius} text-center`}>
        <FootballIcon
          className="w-10 h-10 mx-auto mb-3 text-gray-400"
          aria-hidden="true"
        />
        <p className="text-gray-500 font-semibold">
          The bracket hasn't been set yet.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 ${cardRadius} shadow-sm overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 bg-sffl-navy text-white">
          <h3 className="text-sm font-black uppercase tracking-wider">
            {cup ? "Cup Bracket" : "Playoff Bracket"}
          </h3>
          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="inline-flex items-center gap-1 min-h-11 text-[11px] font-black uppercase tracking-wider text-sffl-red hover:underline"
            >
              Full Bracket
              <ArrowRightIcon className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
        {champion && <ChampionCard team={champion} compact cup={cup} shape={shape} />}
        <div className="p-3 space-y-4">
          {cup && hasRecords(compactColumns.flatMap((c) => c.matches)) && (
            <div className="px-1">
              <RecordLegend />
            </div>
          )}
          {compactColumns.map((col) => (
            <div key={col.title}>
              <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 px-1 mb-2">
                {col.title === finalTitle && (
                  <TrophyIcon className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {col.title === "Bowl"
                  ? "Bowl — Final"
                  : col.title.startsWith("Playoffs")
                    ? "Playoffs"
                    : col.title}
              </div>
              <div className="space-y-2">
                {col.matches.map((m) => (
                  <MatchCard
                    key={m.id}
                    m={m}
                    secondLeg={secondLegMap.get(m.id)}
                    isFinal={isBowlStage(m.round) || col.title === finalTitle}
                    records={recordsFor(m)}
                    showTime={cup}
                    shape={shape}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="md:hidden flex items-center gap-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1">
        Swipe to follow the road to the {finalTitle}
        <ArrowRightIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      </div>
      {cup && hasRecords(filteredMatches) && (
        <div className="mb-3 px-1">
          <RecordLegend />
        </div>
      )}
      <div ref={scrollContainerRef} className="overflow-x-auto pb-4 -mx-2 px-2">
        <div className="flex gap-4 md:gap-8 min-w-max items-stretch">
          {columns.map((col, i) => {
            const isLast = i === columns.length - 1;
            // Two-legged cards carry three extra score columns (L1/L2/AGG),
            // so widen the column when any match in it is two-legged — gives
            // the team name room to display in full instead of ellipsizing.
            const hasTwoLeg = col.matches.some((m) => secondLegMap.has(m.id));
            const colWidth = hasTwoLeg ? "w-72 md:w-80" : "w-56 md:w-64";
            return (
              <div key={col.title} className={`flex flex-col ${colWidth}`}>
                <div
                  className={`flex items-center justify-center gap-1.5 text-[10px] md:text-xs font-black uppercase tracking-widest mb-3 py-1.5 ${pillRadius} ${isLast ? "bg-sffl-red text-white" : "bg-sffl-navy text-white"}`}
                >
                  {isLast && (
                    <TrophyIcon className="w-4 h-4" aria-hidden="true" />
                  )}
                  {isLast
                    ? col.title
                    : col.title.startsWith("Playoffs")
                      ? "Playoffs"
                      : col.title}
                </div>
                {/* justify-around spreads matches so later rounds sit between their feeders */}
                <div className="flex flex-col justify-around flex-1 gap-3">
                  {col.matches.map((m) => (
                    <MatchCard
                      key={m.id}
                      m={m}
                      secondLeg={secondLegMap.get(m.id)}
                      isFinal={isLast}
                      records={recordsFor(m)}
                      showTime={cup}
                      shape={shape}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {champion && <ChampionCard team={champion} cup={cup} shape={shape} />}
        </div>
      </div>
    </div>
  );
};
