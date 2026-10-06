import React, { useState, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTOTWArchive,
  getTOTWById,
  getLatestTOTW,
  getCurrentPOTWPoll,
  type POTWPoll,
  type TOTWListItem,
  type TeamOfTheWeek,
} from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { TeamOfTheWeekModule } from "../../components/totw/TeamOfTheWeekModule";
import { TOTWEditorialStory } from "../../components/totw/TOTWEditorialStory";
import { TOTWStoryModal } from "../../components/totw/TOTWStoryModal";
import { POTWCountdown } from "../../components/potw/POTWCountdown";
import { Button, ButtonLink, Field, Select } from "../../components/ui";
import {
  CalendarDaysIcon,
  TrophyIcon,
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  ShareIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import toast from "react-hot-toast";

export const TeamOfTheWeekPage: React.FC = () => {
  const { id: routeTotwId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = Boolean(
    user && (user.role === "admin" || user.role === "app_admin"),
  );

  const pitchRef = useRef<HTMLDivElement>(null);

  const [selectedCompId, setSelectedCompId] = useState<string>("ALL");
  const [copied, setCopied] = useState<boolean>(false);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState<boolean>(false);

  // Every published edition, unfiltered: the competition filter only offers
  // competitions that actually have a Team of the Week.
  const { data: allEditions = [] } = useQuery<TOTWListItem[]>({
    queryKey: ["totwArchive", undefined],
    queryFn: () => getTOTWArchive(undefined),
  });
  const competitionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of allEditions) {
      if (e.competition_id && !seen.has(e.competition_id)) {
        seen.set(e.competition_id, e.competition_name || "Showtime League");
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [allEditions]);

  // Switching competition shows that competition's latest edition.
  const handleCompetitionChange = (compId: string) => {
    setSelectedCompId(compId);
    if (routeTotwId) navigate("/totw");
  };

  // Fetch archive editions (pass competitionId if specific one selected)
  const effectiveCompId = selectedCompId === "ALL" ? undefined : selectedCompId;
  const { data: archive = [], isLoading: isArchiveLoading } = useQuery<
    TOTWListItem[]
  >({
    queryKey: ["totwArchive", effectiveCompId],
    queryFn: () => getTOTWArchive(effectiveCompId),
  });

  // Determine current active edition ID
  const activeTotwId = useMemo(() => {
    if (routeTotwId) return routeTotwId;
    if (archive.length > 0) return archive[0].id;
    return undefined;
  }, [routeTotwId, archive]);

  // Fetch full active TOTW data (including attached editorial news story)
  const { data: totw, refetch: refetchTOTW } = useQuery<TeamOfTheWeek>({
    queryKey: ["totw", activeTotwId, effectiveCompId],
    queryFn: () =>
      activeTotwId ? getTOTWById(activeTotwId) : getLatestTOTW(effectiveCompId),
    enabled: Boolean(activeTotwId || archive.length > 0),
  });

  // The latest Player of the Week fan vote: a banner invites fans to vote while it
  // is open, and credits the fans once they've picked this edition's winner.
  const { data: potwPoll, refetch: refetchPOTW } = useQuery<POTWPoll | null>({
    queryKey: ["potwPoll", "current", user?.id ?? "guest"],
    queryFn: getCurrentPOTWPoll,
  });
  const potwOpen = potwPoll?.status === "open";
  const potwForThisEdition =
    potwPoll && potwPoll.totw_id === (totw?.id ?? activeTotwId)
      ? potwPoll
      : null;
  const potwFanWinner =
    potwForThisEdition?.status === "closed" &&
    potwForThisEdition.winner_source === "VOTE"
      ? potwForThisEdition.nominees.find((n) => n.is_winner)
      : undefined;

  // Current edition index in archive list
  const currentIndex = useMemo(() => {
    if (!activeTotwId) return -1;
    return archive.findIndex((item) => item.id === activeTotwId);
  }, [activeTotwId, archive]);

  const activeEdition = currentIndex >= 0 ? archive[currentIndex] : null;

  const handleSelectEdition = (totwId: string) => {
    navigate(`/totw/${totwId}`);
    pitchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePrevEdition = () => {
    if (currentIndex < archive.length - 1) {
      const prevItem = archive[currentIndex + 1];
      handleSelectEdition(prevItem.id);
    }
  };

  const handleNextEdition = () => {
    if (currentIndex > 0) {
      const nextItem = archive[currentIndex - 1];
      handleSelectEdition(nextItem.id);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setCopied(false), 2500);
      } catch {
        toast.error("Failed to copy link");
      }
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-8 md:space-y-12 animate-fade-in">
      {/* ── Page Header Banner (Showtime Signature Design System) ─────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl gap-5 md:gap-6 border border-white/10">
        <div className="space-y-2 max-w-2xl min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sffl-red/20 border border-sffl-red/40 text-sffl-red text-xs font-black uppercase tracking-wider">
            <SparklesIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Showtime Official Selections</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white">
            TEAM OF THE WEEK
          </h1>
          <p className="text-gray-300 text-sm md:text-base leading-relaxed">
            Honoring the premier offensive and defensive playmakers across
            official Showtime matchdays. Browse current and historical Starting
            XIV lineups, player box scores, and read in-depth editorial
            breakdowns.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button
            variant="secondary"
            tone="dark"
            icon={copied ? CheckIcon : ShareIcon}
            className="uppercase tracking-wider"
            onClick={handleShare}
          >
            {copied ? "Copied!" : "Share Edition"}
          </Button>
          <ButtonLink
            to="/matches"
            variant="primary"
            icon={TrophyIcon}
            className="uppercase tracking-wider"
          >
            Match Center
          </ButtonLink>
        </div>
      </div>

      {/* ── Active Edition Spotlight & Pitch ──────────────────────────── */}
      <div ref={pitchRef} className="space-y-4">
        {/* Competition filter */}
        {competitionOptions.length > 0 && (
          <Field
            label="Competition"
            htmlFor="totw-competition"
            hint="Show Team of the Week editions from one competition, or all of them."
            className="w-full sm:max-w-sm"
          >
            <Select
              id="totw-competition"
              value={selectedCompId}
              onChange={(e) => handleCompetitionChange(e.target.value)}
            >
              <option value="ALL">All competitions</option>
              {competitionOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {/* Gameweek Stepper Controls */}
        {archive.length > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3.5 md:p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-sffl-red animate-pulse"></span>
              <div className="text-xs md:text-sm font-bold text-gray-900 dark:text-white">
                {activeEdition?.week_title ||
                  totw?.week_title ||
                  "Active Edition"}
                {(activeEdition?.headline || totw?.headline) && (
                  <span className="hidden sm:inline text-gray-500 dark:text-gray-400 font-normal">
                    {" "}
                    — {activeEdition?.headline || totw?.headline}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeftIcon}
                disabled={currentIndex >= archive.length - 1}
                aria-label="Previous week"
                onClick={handlePrevEdition}
              >
                Older
              </Button>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-1">
                {currentIndex >= 0
                  ? `${archive.length - currentIndex} of ${archive.length}`
                  : ""}
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronRightIcon}
                iconPosition="right"
                disabled={currentIndex <= 0}
                aria-label="Next week"
                onClick={handleNextEdition}
              >
                Newer
              </Button>
            </div>
          </div>
        )}

        {/* Player of the Week fan vote */}
        {potwPoll && potwOpen && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl md:rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 md:p-5">
            <div className="min-w-0 space-y-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                <TrophyIcon className="w-4 h-4" aria-hidden="true" />
                Fan vote open · {potwPoll.week_title}
              </p>
              <p className="text-base md:text-lg font-black text-gray-900 dark:text-white">
                Who's your Player of the Week?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {potwPoll.nominees.length} nominees from the Team of the Week.
                Log in and cast your vote before it closes.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 shrink-0">
              <POTWCountdown
                target={potwPoll.closes_at}
                serverTime={potwPoll.server_time}
                label="Closes in"
                onElapsed={() => void refetchPOTW()}
              />
              <ButtonLink
                to="/potw"
                icon={ChevronRightIcon}
                iconPosition="right"
              >
                Vote now
              </ButtonLink>
            </div>
          </div>
        )}
        {potwFanWinner && potwForThisEdition && (
          <Link
            to={`/potw/${potwForThisEdition.id}`}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 min-h-11 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-sffl-red/60"
          >
            <TrophyIcon className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
            <span className="min-w-0">
              Fans voted {potwFanWinner.name} Player of the Week with{" "}
              {potwFanWinner.percent ?? 0}% of{" "}
              {potwForThisEdition.total_votes.toLocaleString()} votes.
            </span>
            <span className="inline-flex items-center gap-1 text-sffl-red font-bold">
              See the full results
              <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
            </span>
          </Link>
        )}

        {/* Team of the Week Pitch Module */}
        <TeamOfTheWeekModule
          totwId={activeTotwId}
          competitionId={effectiveCompId}
          showArchiveLink={false}
          onSelectEdition={handleSelectEdition}
        />
      </div>

      {/* ── Official Gameweek Breakdown (Attached Editorial Story) ─────── */}
      {totw && (
        <TOTWEditorialStory
          totw={totw}
          isAdmin={isAdmin}
          onEditClick={() => setIsStoryModalOpen(true)}
        />
      )}

      {/* ── Inline Editorial Story Editor Modal (Admin Only) ─────────── */}
      {isAdmin && totw && (
        <TOTWStoryModal
          isOpen={isStoryModalOpen}
          onClose={() => setIsStoryModalOpen(false)}
          totwId={totw.id}
          totwWeekTitle={totw.week_title}
          initialStory={totw.news}
          onSaved={async () => {
            await refetchTOTW();
            queryClient.invalidateQueries({ queryKey: ["totw"] });
          }}
        />
      )}

      {/* ── All Editions Archive Section ──────────────────────────────── */}
      <section className="space-y-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black italic tracking-tight text-sffl-navy dark:text-white">
                ALL EDITIONS ARCHIVE
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sffl-red/10 text-sffl-red border border-sffl-red/20">
                {archive.length}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Select any past gameweek to inspect historical Starting XIV
              lineups, player box scores, and MVP ratings.
            </p>
          </div>

        </div>

        {/* Archive Cards Grid */}
        {isArchiveLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-44 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 animate-pulse p-6"
              />
            ))}
          </div>
        ) : archive.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-12 text-center text-gray-500 dark:text-gray-400">
            <TrophyIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
              No Editions Published Yet
            </p>
            <p className="text-sm mt-1">
              Official Team of the Week selections will appear here following
              gamedays.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {archive.map((edition) => {
              const isSelected = edition.id === activeTotwId;
              return (
                <article
                  key={edition.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectEdition(edition.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectEdition(edition.id);
                    }
                  }}
                  className={`group relative flex flex-col justify-between p-4 sm:p-5 md:p-6 rounded-2xl border transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sffl-red ${
                    isSelected
                      ? "bg-linear-to-br from-white to-red-50/40 dark:from-gray-800 dark:to-red-950/20 border-sffl-red ring-2 ring-sffl-red shadow-lg"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-sffl-red/60 hover:shadow-md"
                  }`}
                >
                  <div>
                    {/* Top Meta Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {edition.competition_name || "Showtime League"}
                        </span>
                        {edition.player_of_the_week_id && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                            title="Includes Player of the Week honor"
                          >
                            <StarIcon className="w-3 h-3" aria-hidden="true" />
                            <span>POTW</span>
                          </span>
                        )}
                      </div>
                      {edition.published_at && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          <CalendarDaysIcon className="w-3.5 h-3.5" />
                          {formatDate(edition.published_at)}
                        </span>
                      )}
                    </div>

                    {/* Title & Headline */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="min-w-0 wrap-break-word text-lg sm:text-xl font-black italic tracking-tight text-sffl-navy dark:text-white group-hover:text-sffl-red transition-colors">
                          {edition.week_title}
                        </h3>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-sffl-red text-white shadow-xs">
                            Active View
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200 line-clamp-1">
                        {edition.headline}
                      </p>
                      {edition.sub_headline && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {edition.sub_headline}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      14 Starting Players
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-sffl-red group-hover:translate-x-0.5 transition-transform">
                      <span>{isSelected ? "Viewing" : "Inspect Lineup"}</span>
                      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
export default TeamOfTheWeekPage;
