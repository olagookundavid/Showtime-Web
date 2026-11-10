import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPlayers, getTeams } from "../../services";
import { normalizePosition } from "../../utils";
import type { NormalizedPosition, Player } from "../../types";
import { Modal, Input, Select, Spinner } from "../ui";
import type { Shape } from "../ui/buttonStyles";
import { PlayerAvatar } from "../fantasy";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

interface PlayerPickerModalProps {
  open: boolean;
  /** Locks the result list to this position — there is no position chip row, unlike admin pickers. */
  position: NormalizedPosition;
  positionLabel: string;
  excludePlayerIds: string[];
  onSelect: (player: Player) => void;
  onClose: () => void;
  /** "Add Player" when filling an empty slot, "Replace Player" when swapping a filled one. */
  title?: string;
  /** `square` for sharp corners (the comparison page uses this). */
  shape?: Shape;
}

/** Search-and-pick list for one comparison slot, adapted from the admin TOTW player picker. */
export const PlayerPickerModal = ({
  open,
  position,
  positionLabel,
  excludePlayerIds,
  onSelect,
  onClose,
  title = "Add Player",
  shape = "round",
}: PlayerPickerModalProps) => {
  const radius = shape === "square" ? "rounded-none" : "rounded-xl";
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["comparePlayerPicker", search, teamFilter],
    queryFn: () =>
      getPlayers(teamFilter || undefined, 1, 200, search || undefined),
    enabled: open,
  });

  const { data: teamsData } = useQuery({
    queryKey: ["publicTeamsLookup"],
    queryFn: () => getTeams(1, 100),
    enabled: open,
  });
  const teams = (teamsData?.data ?? []).filter((t) => t.status !== "inactive");

  const filtered = useMemo(() => {
    const players = data?.data ?? [];
    return players.filter((p) => {
      const main = normalizePosition(p.position) === position;
      const sec = p.secondary_position
        ? normalizePosition(p.secondary_position) === position
        : false;
      return main || sec;
    });
  }, [data, position]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={positionLabel}
      maxWidth="lg"
      shape={shape}
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            icon={MagnifyingGlassIcon}
            placeholder="Search by name..."
            aria-label="Search players"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            shape={shape}
            className="flex-1 min-w-0"
          />
          <Select
            aria-label="Filter by team"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            shape={shape}
            className="sm:w-44 shrink-0"
          >
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="max-h-96 overflow-y-auto -mx-2 px-2 space-y-1">
          {isLoading ? (
            <Spinner label="Loading players…" className="py-8" />
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
              No {positionLabel.toLowerCase()} found.
            </p>
          ) : (
            filtered.map((player) => {
              const alreadyPicked = excludePlayerIds.includes(player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  disabled={alreadyPicked}
                  onClick={() => onSelect(player)}
                  className={`flex w-full items-center gap-3 ${radius} p-2.5 text-left transition-colors min-h-11 ${
                    alreadyPicked
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  }`}
                >
                  <PlayerAvatar
                    name={player.name}
                    image={player.image}
                    size="sm"
                    shape={shape}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-sffl-navy dark:text-white truncate">
                      {player.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      #{player.jersey_number || "?"}
                      {player.team?.name ? ` · ${player.team.name}` : ""}
                    </p>
                  </div>
                  {alreadyPicked && (
                    <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Already added
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
