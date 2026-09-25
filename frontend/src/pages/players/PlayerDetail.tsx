import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import {
  getPlayerById,
  getPlayerStatById,
  getCompetitions,
  getStatDates,
  sortCompetitionsBySeason,
  dropdownCompetitionsFor,
  type PlayerBadge,
} from "../../services/api";
import { Loader } from "../../components/ui/Loader";
import { Spinner } from "../../components/ui";
import { useSearchParams } from "react-router-dom";
import { SeasonStageTabs } from "../../components/common/SeasonStageTabs";
import { getStatsForPosition } from "../../utils/positionStatsMatrix";
import { BackButton } from "../../components/common/BackButton";
import {
  XMarkIcon,
  ListBulletIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { BadgeImage } from "../../components/common/BadgeImage";
import { formatStatNumber } from "../../utils/formatters";

const StatCard = ({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) => {
  return (
    <div className="text-center p-4 md:p-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
      <div className="text-2xl md:text-4xl font-black text-sffl-navy dark:text-white mb-1 md:mb-2">
        {formatStatNumber(value)}
      </div>
      <div className="text-[10px] md:text-sm text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest">
        {label}
      </div>
    </div>
  );
};

export const PlayerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedBadge, setSelectedBadge] = useState<PlayerBadge | null>(null);
  const [statViewMode, setStatViewMode] = useState<"list" | "grid">("list");
  const [selectedStatCategory, setSelectedStatCategory] =
    useState<string>("ALL");

  const compId = searchParams.get("comp") || "";
  const matchDate = searchParams.get("date") || "";
  const matchId = searchParams.get("match") || undefined;
  const teamParam = searchParams.get("team") || "";

  const backLink = teamParam ? `/players?team=${teamParam}` : "/players";

  const {
    data: player,
    isLoading: loadingPlayer,
    isError: error,
  } = useQuery({
    queryKey: ["publicPlayer", id],
    queryFn: () => getPlayerById(id!),
    enabled: !!id,
  });

  const playerBadges: PlayerBadge[] = useMemo(() => {
    if (player?.badges && player.badges.length > 0) {
      return player.badges;
    }
    if ((player?.mvp_count ?? 0) > 0) {
      return [
        {
          id: "career-mvp",
          player_id: player?.id || "",
          badge_id: "mvp",
          code: "mvp",
          name: "Match MVP",
          description:
            "Awarded to the most valuable player of an official match.",
          icon: "🏆",
          category: "Individual Honor",
          color_scheme: "gold",
          count: player?.mvp_count || 1,
          last_awarded_at: new Date().toISOString(),
        },
      ];
    }
    return [];
  }, [player]);

  const totalAwardsCount = useMemo(() => {
    return playerBadges.reduce((sum, b) => sum + (b.count || 1), 0);
  }, [playerBadges]);

  const positionStats = useMemo(() => {
    if (!player) return [];
    return getStatsForPosition(player.position, player.secondary_position);
  }, [player]);

  const statCategories = useMemo(() => {
    const set = new Set<string>();
    positionStats.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [positionStats]);

  const displayedStats = useMemo(() => {
    if (selectedStatCategory === "ALL") return positionStats;
    return positionStats.filter((s) => s.category === selectedStatCategory);
  }, [positionStats, selectedStatCategory]);

  // ── Filters Data ─────────────────────────────────────────────────────────
  const { data: competitionsData } = useQuery({
    queryKey: ["publicCompetitions"],
    queryFn: () => getCompetitions(1, 100),
  });
  const competitions = sortCompetitionsBySeason(
    (competitionsData?.data || []).filter((c) => c.status !== "inactive"),
  );
  const selectedComp = competitions.find((c) => c.id === compId);
  const dropdownComps = dropdownCompetitionsFor(competitions, selectedComp);

  const handleCompChange = (newCompId: string) => {
    const params = new URLSearchParams(searchParams);
    if (newCompId) params.set("comp", newCompId);
    else params.delete("comp");
    params.delete("date");
    params.delete("match");
    setSearchParams(params, { replace: true });
  };

  const { data: datesData } = useQuery({
    queryKey: ["statDates", compId],
    queryFn: () => getStatDates(compId),
    enabled: !!compId,
  });
  const statDates = datesData || [];

  // Picking a competition now leaves the date filter empty (= "Full Season"),
  // so the player's view defaults to season totals rather than the most
  // recent match day. A URL-provided ?date= is still honored.

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["playerStats", id, compId, matchDate, matchId],
    queryFn: () =>
      getPlayerStatById(
        id!,
        compId || undefined,
        matchDate || undefined,
        matchId,
      ),
    enabled: !!id,
  });

  // Only the initial player fetch blocks the whole page. Stats reload in place
  // (see the section below) so changing the competition/match-day filters never
  // tears down the header — just the stats area spins.
  if (loadingPlayer) return <Loader />;

  if (error || !player) {
    return (
      <div className="text-center py-20">
        <h1 className="text-4xl font-black text-sffl-navy dark:text-white mb-4">
          Player Not Found
        </h1>
        <BackButton fallback={backLink}>Back to Players</BackButton>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Back Button */}
      <div className="px-2">
        <BackButton fallback={backLink} />
      </div>

      {/* Player Header */}
      <div className="bg-linear-to-r from-sffl-navy to-sffl-red rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
          {/* Player Image */}
          <div className="relative group">
            {player.image ? (
              <img
                src={player.image}
                alt={player.name}
                className="w-full h-72 md:h-96 object-cover rounded-xl shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="w-full h-72 md:h-96 bg-gray-200 dark:bg-gray-700/50 rounded-xl flex items-center justify-center">
                <div className="text-9xl font-black text-gray-300 dark:text-gray-600">
                  #{player.jersey_number}
                </div>
              </div>
            )}
            <div className="absolute top-3 right-3 md:top-4 md:right-4 bg-white dark:bg-gray-900 text-sffl-navy dark:text-white font-black px-4 py-2 md:px-6 md:py-3 rounded-full shadow-2xl text-lg md:text-2xl border-2 border-sffl-red/30">
              #{player.jersey_number}
            </div>
          </div>

          {/* Player Info */}
          <div className="text-white flex flex-col justify-center gap-1 md:gap-4">
            <h1 className="text-3xl md:text-6xl font-black uppercase tracking-tighter leading-none">
              {player.name}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-lg md:text-2xl font-black text-sffl-red italic">
                {player.position}
              </div>
              {player.secondary_position && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wide bg-amber-500/20 text-amber-200 border border-amber-500/40">
                  ⭐ Sec: {player.secondary_position}
                </span>
              )}
              {player.gender && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase border ${
                    player.gender === "F"
                      ? "bg-pink-500/20 text-pink-200 border-pink-500/40"
                      : "bg-blue-500/20 text-blue-200 border-blue-500/40"
                  }`}
                >
                  {player.gender === "F"
                    ? "Female (F)"
                    : player.gender === "M"
                      ? "Male (M)"
                      : player.gender}
                </span>
              )}
              {/* Career Tier Badge */}
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border flex items-center gap-1 shadow-sm ${
                  player.tier === "Superstar"
                    ? "bg-amber-400/30 text-amber-200 border-amber-400/60"
                    : player.tier === "Star"
                      ? "bg-emerald-400/30 text-emerald-200 border-emerald-400/60"
                      : player.tier === "Starter"
                        ? "bg-blue-400/30 text-blue-200 border-blue-400/60"
                        : "bg-white/10 text-gray-200 border-white/20"
                }`}
              >
                {player.tier === "Superstar" && "👑"}
                {player.tier === "Star" && "⭐"}
                {player.tier === "Starter" && "🛡️"}
                {(!player.tier || player.tier === "Prospect") && "🌱"}
                <span>{player.tier || "Prospect"} Tier</span>
              </span>
              {/* Badges & Honors Quick Highlights */}
              {playerBadges.map((b) => (
                <button
                  key={b.id || b.badge_id || b.code}
                  type="button"
                  onClick={() => setSelectedBadge(b)}
                  className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 cursor-pointer ${
                    b.color_scheme === "gold"
                      ? "bg-amber-400/25 text-amber-200 border-amber-400/50 hover:bg-amber-400/40"
                      : b.color_scheme === "red"
                        ? "bg-red-500/25 text-red-200 border-red-500/50 hover:bg-red-500/40"
                        : b.color_scheme === "blue"
                          ? "bg-blue-500/25 text-blue-200 border-blue-500/50 hover:bg-blue-500/40"
                          : "bg-emerald-500/25 text-emerald-200 border-emerald-500/50 hover:bg-emerald-500/40"
                  }`}
                  title={`Click to view ${b.name} details`}
                >
                  <BadgeImage
                    icon={b.icon}
                    name={b.name}
                    className="w-4 h-4 text-xs"
                  />
                  <span>{b.name}</span>
                  <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">
                    ×{b.count}
                  </span>
                </button>
              ))}
            </div>
            {player.team?.id ? (
              <Link
                to={`/teams/${player.team.id}`}
                className="text-sm md:text-xl font-bold text-gray-100 hover:text-sffl-red transition-colors"
              >
                {player.team.name}
              </Link>
            ) : (
              <div className="text-sm md:text-xl font-bold text-gray-100">
                Free Agent
              </div>
            )}
            {player.bio && (
              <div className="mt-4 p-4 bg-black/20 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                <p className="text-xs md:text-lg text-gray-100 leading-relaxed italic">
                  {player.bio}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Achievements & Career Honors Showcase (grows dynamically as badges accumulate) */}
      {playerBadges.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center text-xl shadow-md shrink-0">
                🏆
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <span>Career Honors & Achievements</span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Official individual accolades, Team of the Week selections,
                  and league honors
                </p>
              </div>
            </div>

            {/* Summary Pill Chips */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600">
                {playerBadges.length}{" "}
                {playerBadges.length === 1 ? "Badge" : "Badges"}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1 shadow-xs">
                <span>⭐</span>
                <span>
                  {totalAwardsCount} Total{" "}
                  {totalAwardsCount === 1 ? "Win" : "Wins"}
                </span>
              </span>
            </div>
          </div>

          {/* Trophy Cards Grid (Dynamically grows row by row as badges expand) */}
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 md:gap-4">
              {playerBadges.map((badge) => {
                const scheme = badge.color_scheme || "gold";
                const isGold = scheme === "gold";
                const isRed = scheme === "red";
                const isBlue = scheme === "blue";

                return (
                  <button
                    key={badge.id || badge.badge_id || badge.code}
                    type="button"
                    onClick={() => setSelectedBadge(badge)}
                    className={`group relative text-left p-4 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer flex flex-col justify-between ${
                      isGold
                        ? "bg-linear-to-br from-amber-50/70 via-white to-amber-50/30 dark:from-amber-950/20 dark:via-gray-800 dark:to-gray-800 border-amber-300/80 dark:border-amber-700/60 hover:border-amber-400"
                        : isRed
                          ? "bg-linear-to-br from-red-50/70 via-white to-red-50/30 dark:from-red-950/20 dark:via-gray-800 dark:to-gray-800 border-red-300/80 dark:border-red-700/60 hover:border-red-400"
                          : isBlue
                            ? "bg-linear-to-br from-blue-50/70 via-white to-blue-50/30 dark:from-blue-950/20 dark:via-gray-800 dark:to-gray-800 border-blue-300/80 dark:border-blue-700/60 hover:border-blue-400"
                            : "bg-linear-to-br from-emerald-50/70 via-white to-emerald-50/30 dark:from-emerald-950/20 dark:via-gray-800 dark:to-gray-800 border-emerald-300/8₀ dark:border-emerald-7₀/6₀ hover:border-emerald-4₀"
                    }`}
                  >
                    <div>
                      {/* Top Row: Icon & Win Count */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-xs border shrink-0 ${
                            isGold
                              ? "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700"
                              : isRed
                                ? "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700"
                                : isBlue
                                  ? "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700"
                                  : "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700"
                          }`}
                        >
                          <BadgeImage
                            icon={badge.icon}
                            name={badge.name}
                            className="w-8 h-8 text-2xl"
                          />
                        </div>

                        {/* Win Counter Badge */}
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-black shadow-xs flex items-center gap-1 border ${
                            isGold
                              ? "bg-amber-400/20 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-600"
                              : isRed
                                ? "bg-red-500/20 text-red-800 dark:text-red-200 border-red-300 dark:border-red-600"
                                : isBlue
                                  ? "bg-blue-500/20 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-600"
                                  : "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-600"
                          }`}
                        >
                          <span>×{badge.count}</span>
                          <span className="text-[10px] uppercase font-bold opacity-80">
                            {badge.count === 1 ? "Won" : "Won"}
                          </span>
                        </span>
                      </div>

                      {/* Badge Title & Category */}
                      <h3 className="text-base font-black text-sffl-navy dark:text-white leading-snug group-hover:text-sffl-red transition-colors">
                        {badge.name}
                      </h3>
                      {badge.category && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block mt-0.5">
                          {badge.category}
                        </span>
                      )}

                      {/* Description */}
                      {badge.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mt-1.5 leading-relaxed">
                          {badge.description}
                        </p>
                      )}
                    </div>

                    {/* Card Footer: View Details hint */}
                    <div className="mt-4 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400">
                      <span>
                        {badge.count > 1
                          ? `${badge.count} awards recorded`
                          : "Single award"}
                      </span>
                      <span className="text-sffl-red font-black text-xs flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        History →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stats Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Stats Filters */}
        <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">
              Performance Stats
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-2 sm:w-45">
                <div className="flex flex-col gap-1 min-w-40">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                    Competition
                  </label>
                  <select
                    value={compId}
                    onChange={(e) => handleCompChange(e.target.value)}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-sffl-red transition-all"
                  >
                    <option value="">All Competitions</option>
                    {dropdownComps.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className={`flex flex-col gap-1 min-w-35 transition-opacity duration-300 ${!compId ? "opacity-40" : "opacity-100"}`}
              >
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                  Match Day
                </label>
                <select
                  value={matchDate}
                  onChange={(e) => {
                    const params = new URLSearchParams(searchParams);
                    if (e.target.value) params.set("date", e.target.value);
                    else params.delete("date");
                    params.delete("match");
                    setSearchParams(params, { replace: true });
                  }}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-sffl-red transition-all disabled:cursor-not-allowed"
                  disabled={!compId}
                >
                  <option value="">Full Season</option>
                  {statDates.map((date) => (
                    <option key={date} value={date.substring(0, 10)}>
                      {new Date(date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 pt-4">
          <SeasonStageTabs
            competitions={competitions}
            currentId={compId}
            onChange={handleCompChange}
          />
        </div>

        {loadingStats ? (
          <Spinner label="Loading stats…" className="py-16" />
        ) : stats ? (
          <div className="p-4 md:p-8">
            {/* Subheader: Active Scope + View Switcher */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700/60 pb-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-sffl-red animate-pulse" />
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  {matchDate
                    ? `Viewing Match: ${matchDate}`
                    : compId
                      ? `Viewing Season: ${competitions.find((c) => c.id === compId)?.name}`
                      : "Viewing All-Time Stats"}
                </span>
              </div>

              {/* View Switcher: List vs Grid */}
              <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-600 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setStatViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    statViewMode === "list"
                      ? "bg-white dark:bg-gray-800 text-sffl-navy dark:text-white shadow-xs"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <ListBulletIcon className="w-4 h-4" />
                  <span>List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatViewMode("grid")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    statViewMode === "grid"
                      ? "bg-white dark:bg-gray-800 text-sffl-navy dark:text-white shadow-xs"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <Squares2X2Icon className="w-4 h-4" />
                  <span>Grid</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            {statCategories.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-4 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSelectedStatCategory("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                    selectedStatCategory === "ALL"
                      ? "bg-sffl-navy text-white dark:bg-sffl-red shadow-xs"
                      : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/60 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                  }`}
                >
                  All Stats ({positionStats.length})
                </button>
                {statCategories.map((cat) => {
                  const count = positionStats.filter(
                    (s) => s.category === cat,
                  ).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedStatCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                        selectedStatCategory === cat
                          ? "bg-sffl-navy text-white dark:bg-sffl-red shadow-xs"
                          : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/60 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Stats Display: List or Grid */}
            {statViewMode === "list" ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {displayedStats.map((statDef) => {
                    const val = stats[statDef.key as keyof typeof stats] ?? 0;
                    return (
                      <div
                        key={statDef.key}
                        className="p-3.5 sm:p-4 md:px-6 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-xs sm:text-sm md:text-base text-gray-900 dark:text-white truncate block">
                            {statDef.label}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-400 block">
                            {statDef.category}
                          </span>
                        </div>
                        <div className="text-xl sm:text-2xl md:text-3xl font-black text-sffl-navy dark:text-white tabular-nums tracking-tight shrink-0">
                          {formatStatNumber(val)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                {displayedStats.map((statDef) => (
                  <StatCard
                    key={statDef.key}
                    label={statDef.shortLabel}
                    value={stats[statDef.key as keyof typeof stats] ?? 0}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center opacity-60">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-lg font-bold text-gray-500">
              {matchDate
                ? `No statistics recorded yet for ${matchDate}.`
                : "No statistics recorded yet for this selection."}
            </p>
          </div>
        )}
      </div>

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedBadge(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-2 flex items-center justify-center">
                <BadgeImage
                  icon={selectedBadge.icon}
                  name={selectedBadge.name}
                  className="w-16 h-16 text-5xl"
                />
              </div>
              <h3 className="text-2xl font-black text-sffl-navy dark:text-white">
                {selectedBadge.name}
              </h3>
              {selectedBadge.category && (
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mt-1">
                  {selectedBadge.category}
                </span>
              )}
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 max-w-sm mx-auto leading-relaxed">
                {selectedBadge.description}
              </p>
              <div className="mt-4 px-4 py-1.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-black inline-flex items-center gap-1.5">
                <span>⭐</span>
                <span>
                  Awarded {formatStatNumber(selectedBadge.count)}{" "}
                  {selectedBadge.count === 1 ? "time" : "times"} to this player
                </span>
              </div>
            </div>

            {/* Award History Breakdown */}
            {selectedBadge.awards && selectedBadge.awards.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2.5">
                  Award History & Occurrences
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedBadge.awards.map((award, i) => (
                    <div
                      key={award.id || i}
                      className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 dark:text-white truncate">
                          {award.reason || `${selectedBadge.name} Honor`}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {award.competition_name ||
                            award.season ||
                            "Official League"}
                        </div>
                      </div>
                      {award.created_at && (
                        <span className="text-[10px] font-bold text-gray-400 shrink-0">
                          {new Date(award.created_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
