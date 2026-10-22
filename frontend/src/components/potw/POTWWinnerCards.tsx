import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  TrophyIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { TrophyIcon as TrophySolidIcon } from "@heroicons/react/24/solid";
import { ButtonLink } from "../ui";
import { TeamLink } from "../domain";
import type { POTWNominee, POTWWinner } from "../../types";
import { formatShare, visibleStatLines } from "./potwUtils";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const initialsOf = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/** Where an award links to: the fan vote's results, or the Team of the Week it was won on. */
const awardHref = (w: POTWWinner) =>
  w.poll_id ? `/potw/${w.poll_id}` : `/totw/${w.totw_id}`;

/** The player's photo, or their initials and shirt number when there isn't one. */
export const PlayerPhoto = ({
  player,
  className = "",
}: {
  player: POTWNominee;
  className?: string;
}) => (
  <div
    className={`relative overflow-hidden bg-linear-to-br from-sffl-navy via-[#0b2d55] to-sffl-red/80 ${className}`}
  >
    {player.image ? (
      <img
        src={player.image}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
    ) : (
      <div
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        {player.jersey_number > 0 && (
          <span className="absolute -right-2 -bottom-6 text-[7rem] leading-none font-black text-white/10 select-none">
            {player.jersey_number}
          </span>
        )}
        <span className="text-4xl sm:text-5xl font-black tracking-tight text-white/90">
          {initialsOf(player.name)}
        </span>
      </div>
    )}
  </div>
);

/** The three stat lines as boxes; renders nothing when there are none worth showing. */
export const StatBoxes = ({
  player,
  onDark = false,
}: {
  player: POTWNominee;
  onDark?: boolean;
}) => {
  const lines = visibleStatLines(player);
  if (lines.length === 0) return null;
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      {lines.map(([label, value]) => (
        <div
          key={label}
          className={`min-w-0 rounded-xl px-1 py-2 ${onDark ? "bg-white/10 border border-white/10" : "bg-gray-50 dark:bg-gray-700/50"}`}
        >
          <dd
            className={`text-lg sm:text-xl font-black truncate ${onDark ? "text-white" : "text-gray-900 dark:text-white"}`}
          >
            {value}
          </dd>
          <dt
            className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wide truncate ${
              onDark ? "text-gray-300" : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {label}
          </dt>
        </div>
      ))}
    </dl>
  );
};

/** Team crest and name, then position, on one line. */
const TeamLine = ({
  player,
  onDark = false,
}: {
  player: POTWNominee;
  onDark?: boolean;
}) => (
  <p
    className={`flex items-center gap-1.5 min-w-0 text-sm ${onDark ? "text-gray-200" : "text-gray-600 dark:text-gray-300"}`}
  >
    {player.team_logo && (
      <img
        src={player.team_logo}
        alt=""
        className="w-5 h-5 shrink-0 rounded-full object-contain bg-white"
      />
    )}
    {player.team_name ? (
      <TeamLink id={player.team_id} className="truncate font-semibold">
        {player.team_name}
      </TeamLink>
    ) : (
      <span className="truncate font-semibold">Free agent</span>
    )}
    {(player.totw_position || player.position) && (
      <>
        <span
          aria-hidden="true"
          className={
            onDark ? "text-gray-400" : "text-gray-300 dark:text-gray-600"
          }
        >
          ·
        </span>
        <span className="shrink-0">
          {player.totw_position || player.position}
        </span>
      </>
    )}
  </p>
);

/** How the award was decided, in plain words. */
const DecidedBy = ({
  winner,
  onDark = false,
}: {
  winner: POTWWinner;
  onDark?: boolean;
}) => {
  const byFans = winner.source === "VOTE";
  const Icon = byFans ? UserGroupIcon : ShieldCheckIcon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-bold ${
        onDark
          ? "text-amber-200"
          : byFans
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-gray-600 dark:text-gray-300"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      {byFans && winner.share_percent != null
        ? `Fans' choice · ${formatShare(winner.share_percent)}% of the vote`
        : "Named by the league office"}
    </span>
  );
};

/** The current holder of the award, for the page's hero. */
export const ReigningWinner = ({
  winner,
  wins,
}: {
  winner: POTWWinner;
  wins: number;
}) => {
  const p = winner.player;
  return (
    <article className="grid grid-cols-1 sm:grid-cols-[minmax(0,13rem)_1fr] lg:grid-cols-[minmax(0,15rem)_1fr] gap-5 sm:gap-6 rounded-2xl bg-white/5 border border-white/15 p-4 sm:p-5">
      <div className="relative">
        <PlayerPhoto
          player={p}
          className="aspect-4/3 sm:aspect-4/5 w-full rounded-xl ring-2 ring-amber-400/80 shadow-2xl"
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-sffl-navy shadow">
          <TrophySolidIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {winner.week_title}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="space-y-1 min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] text-amber-300">
            <TrophyIcon className="w-4 h-4" aria-hidden="true" />
            Reigning Player of the Week
          </p>
          <h2 className="text-3xl sm:text-4xl font-black leading-tight text-white wrap-break-word">
            <Link
              to={`/players/${p.player_id}`}
              className="underline-offset-4 hover:underline"
            >
              {p.name}
            </Link>
          </h2>
          <TeamLine player={p} onDark />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <DecidedBy winner={winner} onDark />
          {p.rating > 0 && (
            <span className="text-xs font-bold text-gray-300">
              Match rating{" "}
              <span className="text-white font-black">
                {p.rating.toFixed(1)}
              </span>
            </span>
          )}
          {wins > 1 && (
            <span className="rounded-full bg-amber-400/15 border border-amber-300/40 px-2 py-0.5 text-[11px] font-black text-amber-200">
              {wins}× winner
            </span>
          )}
        </div>

        <StatBoxes player={p} onDark />

        <p className="text-xs text-gray-400">
          {[winner.competition_name, `Awarded ${formatDate(winner.awarded_at)}`]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <div className="mt-auto flex flex-col sm:flex-row gap-2">
          <ButtonLink
            to={`/players/${p.player_id}`}
            variant="primary"
            tone="dark"
          >
            View profile
          </ButtonLink>
          <ButtonLink
            to={awardHref(winner)}
            variant="outline"
            tone="dark"
            icon={ArrowRightIcon}
            iconPosition="right"
          >
            {winner.poll_id ? "See how fans voted" : "See the Team of the Week"}
          </ButtonLink>
        </div>
      </div>
    </article>
  );
};

/** One past award in the honours list. */
export const WinnerCard = ({
  winner,
  wins,
}: {
  winner: POTWWinner;
  wins: number;
}) => {
  const p = winner.player;
  return (
    <article className="group flex h-full flex-col overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-shadow hover:shadow-lg">
      <div className="relative">
        <PlayerPhoto player={p} className="aspect-4/3 sm:aspect-4/5 w-full" />
        <div
          className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/85 via-black/40 to-transparent"
          aria-hidden="true"
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-sffl-navy shadow">
          <TrophySolidIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {winner.week_title}
        </span>
        {wins > 1 && (
          <span className="absolute right-3 top-3 rounded-full bg-sffl-navy/90 px-2.5 py-1 text-[11px] font-black text-white shadow">
            {wins}× winner
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4 min-w-0">
          <h3 className="text-xl font-black leading-tight text-white wrap-break-word">
            <Link
              to={`/players/${p.player_id}`}
              className="underline-offset-4 hover:underline"
            >
              {p.name}
            </Link>
          </h3>
          <TeamLine player={p} onDark />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DecidedBy winner={winner} />
          {p.rating > 0 && (
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
              Rating{" "}
              <span className="font-black text-gray-900 dark:text-white">
                {p.rating.toFixed(1)}
              </span>
            </span>
          )}
        </div>
        <StatBoxes player={p} />
        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <p className="min-w-0 text-xs text-gray-500 dark:text-gray-400">
            <span className="block truncate">{winner.competition_name}</span>
            <span>{formatDate(winner.awarded_at)}</span>
          </p>
          <Link
            to={awardHref(winner)}
            className="inline-flex shrink-0 items-center gap-1 min-h-11 text-sm font-bold text-sffl-red underline-offset-2 hover:underline"
          >
            {winner.poll_id ? "Results" : "Team of the Week"}
            <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
};
