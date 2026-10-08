import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { BroadcastMatchDay, Competition, Match } from "../../types";
import {
  Loader,
  Button,
  ButtonLink,
  DashboardPageHeader,
  Field,
  Pagination,
  Select,
  Tabs,
  buttonClass,
} from "../../components";
import { useQuery } from "@tanstack/react-query";
import {
  getCompetitions,
  getMatches,
  sortCompetitionsBySeason,
} from "../../services/api";
import { getBroadcastDays } from "../../services/broadcastApi";
import { usePermissions } from "../../hooks";
import { formatMatchDate, lagosToday } from "../../utils";
import {
  VideoCameraIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  MapPinIcon,
  CalendarDaysIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";

type StatusFilter = "ALL" | "LIVE" | "SCHEDULED" | "FINISHED" | "POSTPONED";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "LIVE", label: "Live" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "FINISHED", label: "Finished" },
  { value: "POSTPONED", label: "Postponed" },
];

const PAGE_SIZE = 10;
const NO_COMPETITIONS: Competition[] = [];
const NO_MATCHES: Match[] = [];
const NO_DAYS: BroadcastMatchDay[] = [];

/** Single-match view: pick a competition, then a match within it. */
function MatchPicker() {
  // '' until the producer picks one; the page then shows the default competition.
  const [pickedCompId, setPickedCompId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { canEdit } = usePermissions();

  const { data: compsData, isLoading: loadingComps } = useQuery({
    queryKey: ["adminCompetitions"],
    queryFn: () => getCompetitions(1, 100),
  });
  const competitions = compsData?.data
    ? sortCompetitionsBySeason(compsData.data)
    : NO_COMPETITIONS;

  // A match on air right now decides the default competition, so a producer
  // arriving mid-game lands on it without picking anything.
  const { data: liveData, isLoading: loadingLive } = useQuery({
    queryKey: ["broadcastLiveMatch"],
    queryFn: () => getMatches(undefined, 1, 1, "LIVE"),
  });
  const liveCompId = liveData?.data?.[0]?.competition?.id;
  const defaultCompId =
    liveCompId ||
    competitions.find((c) => c.status !== "inactive")?.id ||
    competitions[0]?.id ||
    "";
  const compId = pickedCompId || defaultCompId;
  const selectedComp = competitions.find((c) => c.id === compId);

  const { data: matchesData, isLoading: loadingMatches } = useQuery({
    queryKey: ["broadcastMatches", { compId, status, page }],
    queryFn: () =>
      getMatches(
        compId,
        page,
        PAGE_SIZE,
        status === "ALL" ? undefined : status,
      ),
    enabled: !!compId,
  });
  const matches = matchesData?.data ?? NO_MATCHES;
  const totalPages = matchesData?.total_pages ?? 0;
  const total = matchesData?.total ?? 0;

  const loading = loadingComps || loadingLive || (!!compId && loadingMatches);

  const handleCompChange = (id: string) => {
    setPickedCompId(id);
    setPage(1);
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatus(value);
    setPage(1);
  };

  const statusLabel = STATUS_TABS.find(
    (t) => t.value === status,
  )?.label.toLowerCase();

  const copyOverlayUrl = (matchId: string) => {
    const url = `${window.location.origin}/broadcast/${matchId}/overlay`;
    navigator.clipboard.writeText(url);
    setCopiedId(matchId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Filters: competition first, then status within it */}
      <div className="space-y-3">
        <Field
          label="Competition"
          htmlFor="broadcast-competition"
          className="w-full sm:w-80"
        >
          <Select
            id="broadcast-competition"
            value={compId}
            onChange={(e) => handleCompChange(e.target.value)}
            disabled={competitions.length === 0}
          >
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status === "inactive" ? " (inactive)" : ""}
                {c.id === liveCompId ? " (live now)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Tabs
          items={STATUS_TABS}
          value={status}
          onChange={handleStatusChange}
          aria-label="Match status"
        />
      </div>

      {/* Match List */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader />
        </div>
      ) : !compId ? (
        <div className="p-8 sm:p-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
          <p className="font-semibold text-gray-700 dark:text-gray-200">
            No competitions yet.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Matches belong to a competition, so one has to exist before you can
            broadcast.
            {!canEdit("competitions") && " Ask an admin to create it."}
          </p>
          {canEdit("competitions") && (
            <ButtonLink to="/admin/competitions" variant="outline">
              Go to Competitions
            </ButtonLink>
          )}
        </div>
      ) : matches.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
          <p className="font-semibold text-gray-700 dark:text-gray-200">
            No {status === "ALL" ? "" : `${statusLabel} `}matches in{" "}
            {selectedComp?.name || "this competition"}.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {status === "ALL"
              ? canEdit("matches")
                ? "Schedule matches for this competition, or pick another one above."
                : "Pick another competition above, or ask an admin to schedule matches for this one."
              : "Try another status, or show every match in this competition."}
          </p>
          {status === "ALL" ? (
            canEdit("matches") && (
              <ButtonLink to="/admin/matches" variant="outline">
                Go to Matches
              </ButtonLink>
            )
          ) : (
            <Button variant="outline" onClick={() => handleStatusChange("ALL")}>
              Show all matches
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} {status === "ALL" ? "" : `${statusLabel} `}
            {total === 1 ? "match" : "matches"} in {selectedComp?.name}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {matches.map((m) => {
              const isLive = m.status?.toUpperCase() === "LIVE";
              const isFinished = m.status?.toUpperCase() === "FINISHED";
              const homeName = m.home_team?.name || "Home Team";
              const awayName = m.away_team?.name || "Away Team";

              return (
                <div
                  key={m.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
                >
                  <div>
                    {/* Status & Competition Header */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {m.competition?.name || "Showtime League"} ·{" "}
                        {new Date(m.date).toLocaleDateString()}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase ${
                          isLive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : isFinished
                              ? "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-700 dark:text-gray-300"
                              : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>

                    {/* Teams & Scores */}
                    <div className="flex items-center justify-between gap-4 my-2">
                      {/* Home Team */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {m.home_team?.logo ? (
                          <img
                            src={m.home_team.logo}
                            alt=""
                            className="w-10 h-10 object-contain rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center font-bold text-gray-400">
                            H
                          </div>
                        )}
                        <span className="font-black text-gray-900 dark:text-white truncate text-base md:text-lg">
                          {homeName}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="text-center px-3 py-1 bg-gray-50 dark:bg-gray-700/60 rounded-lg border border-gray-200 dark:border-gray-600 font-black text-lg md:text-xl text-gray-900 dark:text-white">
                        {m.home_score ?? 0} – {m.away_score ?? 0}
                      </div>

                      {/* Away Team */}
                      <div className="flex items-center justify-end gap-3 flex-1 min-w-0 text-right">
                        <span className="font-black text-gray-900 dark:text-white truncate text-base md:text-lg">
                          {awayName}
                        </span>
                        {m.away_team?.logo ? (
                          <img
                            src={m.away_team.logo}
                            alt=""
                            className="w-10 h-10 object-contain rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center font-bold text-gray-400">
                            A
                          </div>
                        )}
                      </div>
                    </div>

                    {m.venue && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-2">
                        <MapPinIcon
                          className="w-4 h-4 shrink-0"
                          aria-hidden="true"
                        />
                        {m.venue}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-700/60">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={
                        copiedId === m.id
                          ? ClipboardDocumentCheckIcon
                          : ClipboardDocumentIcon
                      }
                      onClick={() => copyOverlayUrl(m.id)}
                      title="Copy transparent vMix overlay browser URL"
                    >
                      {copiedId === m.id ? "Copied vMix URL!" : "Copy vMix URL"}
                    </Button>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/broadcast/${m.id}/overlay`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonClass(
                          "ghost",
                          "md",
                          false,
                          "min-h-11 min-w-11 px-0",
                        )}
                        title="Open transparent overlay in new tab"
                        aria-label="Open transparent overlay in new tab"
                      >
                        <ArrowTopRightOnSquareIcon
                          className="w-4 h-4"
                          aria-hidden="true"
                        />
                      </a>

                      <ButtonLink
                        to={`/admin/broadcast/${m.id}`}
                        icon={VideoCameraIcon}
                      >
                        Launch Studio
                      </ButtonLink>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

type PickerView = 'days' | 'matches';

const VIEW_TABS: { value: PickerView; label: string }[] = [
  { value: 'days', label: 'Match days' },
  { value: 'matches', label: 'Single match' },
];

/** Event-day view: today and upcoming match days, the next one first. */
function DayPicker() {
  const [page, setPage] = useState(1);
  const today = lagosToday();

  const { data, isLoading } = useQuery({
    queryKey: ['broadcastDays', page],
    queryFn: () => getBroadcastDays(page, PAGE_SIZE),
    refetchInterval: 30000,
  });
  const days = data?.data ?? NO_DAYS;
  const totalPages = data?.total_pages ?? 0;

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader />
      </div>
    );
  }
  if (days.length === 0) {
    return (
      <div className="p-8 sm:p-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
        <p className="font-semibold text-gray-700 dark:text-gray-200">No upcoming match days.</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          A day appears here as soon as a match is scheduled for today or later.
        </p>
      </div>
    );
  }

  // Days come back soonest first and never in the past. Flag the first one
  // when it isn't today, so the producer sees what's next.
  const nextDate = days.at(0)?.date;

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {days.map((d) => {
          const isToday = d.date === today;
          const isNext = page === 1 && d.date === nextDate && !isToday;
          const dateLabel = formatMatchDate(d.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          return (
            <li
              key={d.date}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl p-5 shadow-sm flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-gray-500 dark:text-gray-400">
                  <CalendarDaysIcon className="w-4 h-4" aria-hidden="true" />
                  {dateLabel}
                </span>
                {isToday && (
                  <span className="px-2 py-0.5 rounded-full bg-sffl-navy text-white font-bold">Today</span>
                )}
                {isNext && (
                  <span className="px-2 py-0.5 rounded-full bg-sffl-navy text-white font-bold">Next</span>
                )}
                {d.live_match_count > 0 && (
                  <span className="px-2 py-0.5 rounded-full border font-bold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    {d.live_match_count} live
                  </span>
                )}
                {d.on_air_match_id && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sffl-red text-white font-bold">
                    <SignalIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    On air
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-black text-gray-900 dark:text-white text-base md:text-lg break-words">
                  {d.event_title || dateLabel}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {d.match_count} {d.match_count === 1 ? 'match' : 'matches'}
                  {d.event_venue ? ` · ${d.event_venue}` : ''}
                </p>
              </div>
              <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-700/60">
                <ButtonLink to={`/admin/broadcast/day/${d.date}`} icon={VideoCameraIcon}>
                  Open day studio
                </ButtonLink>
              </div>
            </li>
          );
        })}
      </ul>
      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}

export function AdminBroadcastPicker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: PickerView = searchParams.get('view') === 'matches' ? 'matches' : 'days';

  const setView = (next: PickerView) => {
    setSearchParams(next === 'days' ? {} : { view: next }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Broadcast Studio"
        subtitle={
          view === 'days'
            ? 'Stream a whole match day on one set of vMix links, switching matches as they kick off.'
            : 'Pick a competition, then a match, to control graphics for that match alone.'
        }
      />
      <Tabs items={VIEW_TABS} value={view} onChange={setView} aria-label="Broadcast by" />
      {view === 'days' ? <DayPicker /> : <MatchPicker />}
    </div>
  );
}

export default AdminBroadcastPicker;
