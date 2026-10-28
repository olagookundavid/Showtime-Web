import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getPlayerById, getPlayerStatById } from "../../services";
import type { Competition, NormalizedPosition, Player } from "../../types";
import { useStatsCompetitionFilter } from "../../hooks";
import { categoriesForPosition } from "../../constants";
import {
  Button,
  Checkbox,
  Field,
  Select,
  SeasonStageTabs,
  PlayerCompareSlot,
  PlayerPickerModal,
  ComparisonTable,
  type ComparisonPlayer,
} from "../../components";
import { normalizePosition } from "../../utils";
import { UsersIcon } from "@heroicons/react/24/outline";

const POSITION_TABS: { id: NormalizedPosition; label: string }[] = [
  { id: "QB", label: "Quarterbacks (QB)" },
  { id: "REC", label: "Receivers / Centers (REC)" },
  { id: "RUSH", label: "Rushers (RUSH)" },
  { id: "DEF", label: "Defenders (DEF)" },
  { id: "ALLROUNDER", label: "All-Rounders (AR)" },
];
const MAX_PLAYERS = 4;
type ComparisonMode = "total" | "perGame";

export const PlayerComparison = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [positionFilter, setPositionFilter] = useState<NormalizedPosition>(
    () => {
      const urlPos = searchParams.get("pos");
      return POSITION_TABS.find((p) => p.id === urlPos)?.id ?? "QB";
    },
  );
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(() => {
    const raw = searchParams.get("players");
    return raw ? raw.split(",").filter(Boolean).slice(0, MAX_PLAYERS) : [];
  });
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(() =>
    searchParams.get("mode") === "perGame" ? "perGame" : "total",
  );
  const [statCategory, setStatCategory] = useState<string>("all");
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);

  const {
    competitions,
    dropdownComps,
    selectedCompetitionId,
    setSelectedCompetitionId,
    selectedDate,
    setSelectedDate,
    statDates,
  } = useStatsCompetitionFilter();

  // Keep the URL in sync so a comparison is shareable/bookmarkable.
  // (Competition/Event Day sync themselves via useStatsCompetitionFilter.)
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("pos", positionFilter);
    if (comparisonMode !== "total") params.set("mode", comparisonMode);
    else params.delete("mode");
    if (selectedPlayerIds.length)
      params.set("players", selectedPlayerIds.join(","));
    else params.delete("players");
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionFilter, comparisonMode, selectedPlayerIds]);

  const handlePositionChange = (pos: NormalizedPosition) => {
    if (pos === positionFilter) return;
    setPositionFilter(pos);
    // Cross-position comparison must be impossible, not just filtered out.
    setSelectedPlayerIds([]);
    // The previous category pick may not exist for the new position (e.g. "Receiving" for a QB).
    setStatCategory("all");
  };

  const handleRemovePlayer = (playerId: string) => {
    setSelectedPlayerIds((ids) => ids.filter((id) => id !== playerId));
  };

  const openPicker = (index: number) => {
    setPickerSlotIndex(index);
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    setPickerSlotIndex(null);
  };

  // Adds to the first open slot, or replaces the slot that opened the picker
  // (an index within the current array means "Replace player" was clicked).
  const handleSelectPlayer = (player: Player) => {
    setSelectedPlayerIds((ids) => {
      if (ids.includes(player.id)) return ids;
      if (pickerSlotIndex !== null && pickerSlotIndex < ids.length) {
        const next = [...ids];
        next[pickerSlotIndex] = player.id;
        return next;
      }
      return ids.length < MAX_PLAYERS ? [...ids, player.id] : ids;
    });
    closePicker();
  };

  const identityResults = useQueries({
    queries: selectedPlayerIds.map((id) => ({
      queryKey: ["comparePlayerIdentity", id],
      queryFn: () => getPlayerById(id),
    })),
  });

  const statResults = useQueries({
    queries: selectedPlayerIds.map((id) => ({
      queryKey: ["comparePlayerStats", id, selectedCompetitionId, selectedDate],
      queryFn: () =>
        getPlayerStatById(
          id,
          selectedCompetitionId || undefined,
          selectedDate || undefined,
        ),
    })),
  });

  const loadingSelections =
    identityResults.some((q) => q.isLoading) ||
    statResults.some((q) => q.isLoading);

  // Stale/shared-URL guard: a selected player whose position no longer matches
  // the active tab is dropped once their identity has loaded.
  const resolvedKey = identityResults.map((q) => q.data?.id ?? "").join(",");
  useEffect(() => {
    if (identityResults.length === 0) return;
    if (identityResults.some((q) => q.isLoading)) return;
    const mismatched = selectedPlayerIds.filter((_, i) => {
      const player = identityResults[i]?.data;
      if (!player) return false;
      const main = normalizePosition(player.position) === positionFilter;
      const sec = player.secondary_position
        ? normalizePosition(player.secondary_position) === positionFilter
        : false;
      return !main && !sec;
    });
    if (mismatched.length > 0) {
      setSelectedPlayerIds((ids) => ids.filter((id) => !mismatched.includes(id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedKey, positionFilter]);

  const comparisonPlayers: ComparisonPlayer[] = selectedPlayerIds
    .map((_id, i): ComparisonPlayer | null => {
      const player = identityResults[i]?.data;
      if (!player) return null;
      return { player, stat: statResults[i]?.data ?? undefined };
    })
    .filter((p): p is ComparisonPlayer => p !== null);

  const activePositionLabel =
    POSITION_TABS.find((p) => p.id === positionFilter)?.label ??
    positionFilter;
  const statCategories = categoriesForPosition(positionFilter);

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header */}
      <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-none shadow-xl">
        <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase">
          Compare Players
        </h1>
        <p className="text-gray-300 mt-0.5 text-xs md:text-lg">
          Compare up to four players who play the same position.
        </p>
      </div>

      {/* Season | Playoffs toggle for the selected competition */}
      <SeasonStageTabs
        competitions={competitions}
        currentId={selectedCompetitionId}
        onChange={setSelectedCompetitionId}
      />

      {/* Position Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 bg-white dark:bg-gray-800 p-3 rounded-none border border-gray-100 dark:border-gray-700 shadow-sm">
        <span className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-400 shrink-0 mr-1">
          Position:
        </span>
        {POSITION_TABS.map((pos) => {
          const isActive = positionFilter === pos.id;
          return (
            <Button
              key={pos.id}
              size="sm"
              variant={isActive ? "navy" : "secondary"}
              className="shrink-0"
              aria-pressed={isActive}
              onClick={() => handlePositionChange(pos.id)}
            >
              {pos.label}
            </Button>
          );
        })}
      </div>

      {/* Slot counter + Clear all */}
      <div className="flex items-center justify-end gap-2 text-xs md:text-sm">
        <span className="font-bold text-gray-500 dark:text-gray-400">
          {selectedPlayerIds.length} / {MAX_PLAYERS} players
        </span>
        {selectedPlayerIds.length > 0 && (
          <>
            <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">
              |
            </span>
            <button
              type="button"
              onClick={() => setSelectedPlayerIds([])}
              className="font-bold text-sffl-red hover:underline cursor-pointer"
            >
              Clear all
            </button>
          </>
        )}
      </div>

      {/* Player Slots */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: MAX_PLAYERS }).map((_, i) => {
          const id = selectedPlayerIds[i];
          const player = id ? identityResults[i]?.data : undefined;
          return (
            <PlayerCompareSlot
              key={id ?? `empty-${i}`}
              index={i}
              player={player}
              shape="square"
              onPick={() => openPicker(i)}
              onRemove={() => id && handleRemovePlayer(id)}
            />
          );
        })}
      </div>

      {/* Stat comparison filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-none border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
          <div>
            <span className="block text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
              Compare
            </span>
            <div className="inline-flex gap-2">
              <Button
                size="sm"
                variant={comparisonMode === "total" ? "navy" : "secondary"}
                aria-pressed={comparisonMode === "total"}
                onClick={() => setComparisonMode("total")}
              >
                Total
              </Button>
              <Button
                size="sm"
                variant={comparisonMode === "perGame" ? "navy" : "secondary"}
                aria-pressed={comparisonMode === "perGame"}
                onClick={() => setComparisonMode("perGame")}
              >
                Per Game
              </Button>
            </div>
          </div>

          <div className="w-full md:w-56">
            <Field label="Competition" htmlFor="compare-competition">
              <Select
                id="compare-competition"
                shape="square"
                value={selectedCompetitionId}
                onChange={(e) => setSelectedCompetitionId(e.target.value)}
              >
                <option value="">All Competitions</option>
                {dropdownComps.map((c: Competition) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div
            className={`w-full md:w-44 transition-opacity duration-300 ${!selectedCompetitionId ? "opacity-40" : "opacity-100"}`}
          >
            <Field label="Event Day" htmlFor="compare-event-day">
              <Select
                id="compare-event-day"
                shape="square"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={!selectedCompetitionId}
              >
                <option value="">All Event Days</option>
                {statDates.map((date: string) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        {comparisonPlayers.length >= 2 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            {statCategories.length > 1 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={statCategory === "all" ? "navy" : "secondary"}
                  aria-pressed={statCategory === "all"}
                  onClick={() => setStatCategory("all")}
                >
                  All Stats
                </Button>
                {statCategories.map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={statCategory === cat ? "navy" : "secondary"}
                    aria-pressed={statCategory === cat}
                    onClick={() => setStatCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            ) : (
              <span aria-hidden="true" />
            )}
            <Checkbox
              label="Only show differences"
              checked={onlyDifferences}
              onChange={(e) => setOnlyDifferences(e.target.checked)}
            />
          </div>
        )}
      </div>

      {/* Comparison table / empty state */}
      {comparisonPlayers.length < 2 ? (
        <div className="bg-gray-100 dark:bg-gray-800 p-8 md:p-16 rounded-none text-center">
          <UsersIcon
            className="w-10 h-10 md:w-14 md:h-14 mx-auto mb-4 text-gray-400"
            aria-hidden="true"
          />
          <p className="text-gray-600 dark:text-gray-300 text-base md:text-lg font-bold">
            Pick at least 2 players to compare
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Use the "Add Player" tiles above to build your comparison.
          </p>
        </div>
      ) : (
        <ComparisonTable
          position={positionFilter}
          players={comparisonPlayers}
          isLoading={loadingSelections}
          mode={comparisonMode}
          statCategory={statCategory}
          onlyDifferences={onlyDifferences}
          shape="square"
        />
      )}

      <PlayerPickerModal
        open={pickerOpen}
        position={positionFilter}
        positionLabel={activePositionLabel}
        title={
          pickerSlotIndex !== null && selectedPlayerIds[pickerSlotIndex]
            ? "Replace Player"
            : "Add Player"
        }
        excludePlayerIds={selectedPlayerIds.filter(
          (_, i) => i !== pickerSlotIndex,
        )}
        onSelect={handleSelectPlayer}
        onClose={closePicker}
        shape="square"
      />
    </div>
  );
};
