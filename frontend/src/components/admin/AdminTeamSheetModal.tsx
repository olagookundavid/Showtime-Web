import { useState, useEffect, useRef, useCallback } from "react";
import { isDeletedPlayer, DELETED_TITLE } from "../domain/DeletedPlayer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  getAdminTeamSheet,
  getPlayers,
  saveTeamSheet,
  createPlayer,
} from "../../services/api";
import type { Match, TeamSheetPlayer } from "../../types/matches";
import type { Player } from "../../types/players";
import { PLAYER_POSITIONS_WITH_UNASSIGNED } from "../../constants";
import { Button, Checkbox, IconButton, Input, Modal, Select, Tabs } from "../ui";
import { Spinner } from "../ui/Spinner";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { usePermissions } from "../../hooks/usePermissions";

interface AdminTeamSheetModalProps {
  match: Match;
  onClose: () => void;
}

interface QuickAddForm {
  name: string;
  position: string;
  jersey_number: string;
}

const emptyQuickAdd: QuickAddForm = {
  name: "",
  position: "",
  jersey_number: "",
};

// Saving, creating a player, and adding an off-roster player all go through the confirm dialog first.
type PendingAction =
  | { kind: "save" }
  | { kind: "create" }
  | { kind: "offRoster"; player: Player };

const playerCount = (n: number) => `${n} player${n !== 1 ? "s" : ""}`;

export const AdminTeamSheetModal = ({
  match,
  onClose,
}: AdminTeamSheetModalProps) => {
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();
  const [activeTab, setActiveTab] = useState<"home" | "away">("home");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Quick-add inline form
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAdd, setQuickAdd] = useState<QuickAddForm>(emptyQuickAdd);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  // Off-roster players we've added in this session — used to display chip names
  // for players whose global team is not the active team (historical entry).
  const [extraPlayers, setExtraPlayers] = useState<Record<string, Player>>({});

  // ── Existing team sheet ──────────────────────────────────────────────────
  const { data: teamSheet, isLoading: loadingSheet } = useQuery({
    queryKey: ["adminTeamSheet", match.id],
    queryFn: () => getAdminTeamSheet(match.id),
  });

  const [teamSheetSelections, setTeamSheetSelections] = useState<{
    source: typeof teamSheet;
    home: string[];
    away: string[];
  } | null>(null);
  const selectedHomePlayers =
    teamSheetSelections !== null && teamSheetSelections.source === teamSheet
      ? teamSheetSelections.home
      : (teamSheet?.home_team.map((p) => p.player_id) ?? []);
  const selectedAwayPlayers =
    teamSheetSelections !== null && teamSheetSelections.source === teamSheet
      ? teamSheetSelections.away
      : (teamSheet?.away_team.map((p) => p.player_id) ?? []);
  const setSelectedHomePlayers = useCallback(
    (update: string[] | ((prev: string[]) => string[])) => {
      setTeamSheetSelections((current) => {
        const home =
          current !== null && current.source === teamSheet
            ? current.home
            : (teamSheet?.home_team.map((p) => p.player_id) ?? []);
        const away =
          current !== null && current.source === teamSheet
            ? current.away
            : (teamSheet?.away_team.map((p) => p.player_id) ?? []);
        return {
          source: teamSheet,
          home: typeof update === "function" ? update(home) : update,
          away,
        };
      });
    },
    [teamSheet],
  );
  const setSelectedAwayPlayers = useCallback(
    (update: string[] | ((prev: string[]) => string[])) => {
      setTeamSheetSelections((current) => {
        const home =
          current !== null && current.source === teamSheet
            ? current.home
            : (teamSheet?.home_team.map((p) => p.player_id) ?? []);
        const away =
          current !== null && current.source === teamSheet
            ? current.away
            : (teamSheet?.away_team.map((p) => p.player_id) ?? []);
        return {
          source: teamSheet,
          home,
          away: typeof update === "function" ? update(away) : update,
        };
      });
    },
    [teamSheet],
  );

  // ── Search across ALL players ───────────────────────────────────────────
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["playerSearch", searchQuery],
    queryFn: () => getPlayers(undefined, 1, 15, searchQuery),
    enabled: searchQuery.trim().length >= 2,
  });
  const foundPlayers = searchResults?.data || [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── Roster state helpers ─────────────────────────────────────────────────
  const activeTeamId =
    activeTab === "home" ? match.home_team?.id : match.away_team?.id;
  const activeTeamName =
    activeTab === "home" ? match.home_team?.name : match.away_team?.name;
  const activeSelected =
    activeTab === "home" ? selectedHomePlayers : selectedAwayPlayers;

  // Players currently on the active team (for the bottom checklist — main 25-man squad only)
  const { data: activeTeamPlayersData } = useQuery({
    queryKey: ["players", activeTeamId, "main"],
    queryFn: () => getPlayers(activeTeamId, 1, 200, undefined, "main"),
    enabled: !!activeTeamId,
  });
  const activeTeamPlayers: Player[] = (
    activeTeamPlayersData?.data || []
  ).filter((p) => !p.is_reserve);

  const addToSelected = useCallback(
    (id: string) => {
      if (activeTab === "home") {
        setSelectedHomePlayers((prev) =>
          prev.includes(id) ? prev : [...prev, id],
        );
      } else {
        setSelectedAwayPlayers((prev) =>
          prev.includes(id) ? prev : [...prev, id],
        );
      }
    },
    [activeTab, setSelectedHomePlayers, setSelectedAwayPlayers],
  );

  const togglePlayer = (id: string) => {
    if (activeTab === "home") {
      setSelectedHomePlayers((prev) =>
        prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
      );
    } else {
      setSelectedAwayPlayers((prev) =>
        prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
      );
    }
  };

  // ── Create player mutation ───────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (form: QuickAddForm) => {
      // createPlayer hits the Players feature (routes.go: playersGroup), a
      // narrower role set than Matches — e.g. broadcast can manage matches
      // but has no Players access, so this needs its own check.
      if (!canEdit("players"))
        throw new Error(
          "View-only access: your role can view Matches but not add players.",
        );
      const res = await createPlayer({
        name: form.name.trim(),
        position: form.position,
        jersey_number: form.jersey_number
          ? parseInt(form.jersey_number)
          : undefined,
        team_id: activeTeamId!,
        email: "",
      });
      return res;
    },
    onSuccess: (res) => {
      const newId = res.id;
      toast.success(`Player created and added to roster`);
      queryClient.invalidateQueries({ queryKey: ["players", activeTeamId] });
      addToSelected(newId);
      setShowQuickAdd(false);
      setQuickAdd(emptyQuickAdd);
      setSearchQuery("");
    },
    onError: (err: unknown) => {
      const error = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      toast.error(
        error.response?.data?.error ||
          error.message ||
          "Failed to create player",
      );
    },
  });

  // Validation runs before the confirm dialog opens, so it never asks about a player that can't be created.
  const requestCreate = () => {
    if (!quickAdd.name.trim()) return toast.error("Name is required");
    if (!quickAdd.position) return toast.error("Position is required");
    setPendingAction({ kind: "create" });
  };

  // ── Confirm add for an off-roster player ─────────────────────────────────
  // Historical entry: we keep the player's current team record intact and only
  // record that they played on the active team in THIS match (via match_team_sheets.team_id).
  const confirmAddOffRosterPlayer = (player: Player) => {
    setExtraPlayers((prev) => ({ ...prev, [player.id]: player }));
    addToSelected(player.id);
    setPendingAction(null);
    setSearchQuery("");
    setShowDropdown(false);
    toast.success(`${player.name} added to this match's sheet`);
  };

  // ── Handle search result click ───────────────────────────────────────────
  const handleSelectFromSearch = (player: Player) => {
    setShowDropdown(false);
    // Already on the right team — just add
    if (player.team?.id === activeTeamId) {
      addToSelected(player.id);
      setSearchQuery("");
      return;
    }
    // Different team — confirm so the admin knows what they're doing
    setPendingAction({ kind: "offRoster", player });
  };

  // ── Save BOTH team sheets in one shot ───────────────────────────────────
  const saveBothMutation = useMutation({
    mutationFn: async () => {
      if (!canEdit("matches"))
        throw new Error(
          "View-only access: your role can view Matches but not make changes.",
        );
      const homeTeamId = match.home_team?.id;
      const awayTeamId = match.away_team?.id;
      if (!homeTeamId || !awayTeamId) throw new Error("Team IDs not found");
      await Promise.all([
        saveTeamSheet(match.id, {
          team_id: homeTeamId,
          player_ids: selectedHomePlayers,
        }),
        saveTeamSheet(match.id, {
          team_id: awayTeamId,
          player_ids: selectedAwayPlayers,
        }),
      ]);
    },
    onSuccess: () => {
      toast.success("Both team sheets saved!");
      queryClient.invalidateQueries({ queryKey: ["adminTeamSheet", match.id] });
    },
    onError: (err: unknown) => {
      const error = err as {
        response?: { data?: { error?: string; message?: string } };
        message?: string;
      };
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          "Failed to save",
      );
    },
  });

  // Runs once the admin confirms. The mutations report their own errors, so
  // the dialog closes when the request settles either way.
  const closeDialog = () => setPendingAction(null);
  const confirmPendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "offRoster")
      confirmAddOffRosterPlayer(pendingAction.player);
    else if (pendingAction.kind === "create")
      createMutation.mutate(quickAdd, { onSettled: closeDialog });
    else saveBothMutation.mutate(undefined, { onSettled: closeDialog });
  };

  const selectedCount = activeSelected.length;

  const dialog =
    pendingAction?.kind === "save"
      ? {
          title: "Save both team sheets?",
          description: "This replaces the saved sheets for this match.",
          confirmLabel: "Save Sheets",
          icon: ClipboardDocumentListIcon,
          pending: saveBothMutation.isPending,
        }
      : pendingAction?.kind === "create"
        ? {
            title: "Create this player?",
            description: `Creates a new player on ${activeTeamName || "this team"} and adds them to this match's sheet.`,
            confirmLabel: "Create Player",
            icon: UserPlusIcon,
            pending: createMutation.isPending,
          }
        : {
            title: "Add off-roster player?",
            description: undefined,
            confirmLabel: "Add to This Match",
            icon: UserPlusIcon,
            pending: false,
          };

  const summaryClass =
    "grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3";
  const dialogBody =
    pendingAction?.kind === "save" ? (
      <dl className={summaryClass}>
        <dt className="text-gray-500 dark:text-gray-400">
          {match.home_team?.name || "Home"}
        </dt>
        <dd className="font-bold dark:text-white">
          {playerCount(selectedHomePlayers.length)}
        </dd>
        <dt className="text-gray-500 dark:text-gray-400">
          {match.away_team?.name || "Away"}
        </dt>
        <dd className="font-bold dark:text-white">
          {playerCount(selectedAwayPlayers.length)}
        </dd>
      </dl>
    ) : pendingAction?.kind === "create" ? (
      <dl className={summaryClass}>
        <dt className="text-gray-500 dark:text-gray-400">Name</dt>
        <dd className="min-w-0 wrap-break-word font-bold dark:text-white">
          {quickAdd.name.trim()}
        </dd>
        <dt className="text-gray-500 dark:text-gray-400">Position</dt>
        <dd className="dark:text-white">
          {quickAdd.position === "-"
            ? "No Role / Unassigned"
            : quickAdd.position}
        </dd>
        <dt className="text-gray-500 dark:text-gray-400">Jersey</dt>
        <dd className="dark:text-white">
          {quickAdd.jersey_number ? `#${quickAdd.jersey_number}` : "—"}
        </dd>
      </dl>
    ) : pendingAction?.kind === "offRoster" ? (
      <div className="space-y-2">
        <p>
          <strong className="text-gray-900 dark:text-white">
            {pendingAction.player.name}
          </strong>{" "}
          is currently rostered on{" "}
          <strong className="text-sffl-red">
            {pendingAction.player.team?.name || "another team"}
          </strong>
          .
        </p>
        <p>
          They'll be recorded as playing for{" "}
          <strong className="text-gray-900 dark:text-white">
            {activeTeamName}
          </strong>{" "}
          in this match only. Their current roster stays intact.
        </p>
      </div>
    ) : null;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Team Sheet"
        subtitle={`${match.home_team?.short_name} vs ${match.away_team?.short_name} · ${match.date?.split("T")[0]}`}
        maxWidth="2xl"
        footer={
          <>
            <div className="flex gap-4 sm:flex-col sm:gap-0.5 sm:mr-auto self-center text-xs text-gray-500 dark:text-gray-400 font-semibold">
              <div>Home: {playerCount(selectedHomePlayers.length)}</div>
              <div>Away: {playerCount(selectedAwayPlayers.length)}</div>
            </div>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              loading={saveBothMutation.isPending}
              disabled={loadingSheet}
              onClick={() => setPendingAction({ kind: "save" })}
            >
              Save Both Sheets
            </Button>
          </>
        }
      >
            {/* Tabs */}
            <Tabs
              aria-label="Team"
              className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 sm:mb-6"
              items={[
                { value: "home", label: match.home_team?.name },
                { value: "away", label: match.away_team?.name },
              ]}
              value={activeTab}
              onChange={(tab) => {
                setActiveTab(tab);
                setSearchQuery("");
                setShowQuickAdd(false);
                setShowDropdown(false);
              }}
            />

            <div className="space-y-5">
              {loadingSheet ? (
                <Spinner />
              ) : (
                <>
                  {(activeTab === "home"
                    ? teamSheet?.home_team
                    : teamSheet?.away_team
                  )?.some((p) => p.is_starter) && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2 font-medium">
                      <ShieldCheckIcon
                        className="w-4 h-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        This team has an active manager lineup. Starters and
                        field positions are safely preserved when roster players
                        are added or removed.
                      </span>
                    </div>
                  )}

                  {/* ── Search / Add Player ── */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                      Add Player to Roster
                    </label>
                    <div ref={searchRef} className="relative">
                      <Input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowDropdown(true);
                          setShowQuickAdd(false);
                        }}
                        onFocus={() =>
                          searchQuery.length >= 2 && setShowDropdown(true)
                        }
                        placeholder="Search by player name…"
                        aria-label="Search players to add"
                      />

                      {/* Search Dropdown */}
                      {showDropdown && searchQuery.trim().length >= 2 && (
                        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                          {searching ? (
                            <div className="p-3 flex items-center justify-center gap-1.5 text-xs text-gray-500">
                              <ArrowPathIcon
                                className="w-4 h-4 animate-spin"
                                aria-hidden="true"
                              />
                              Searching
                            </div>
                          ) : foundPlayers.length > 0 ? (
                            <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-52 overflow-y-auto">
                              {foundPlayers.map((p) => (
                                <li key={p.id}>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectFromSearch(p)}
                                    disabled={isDeletedPlayer(p)}
                                    title={
                                      isDeletedPlayer(p)
                                        ? DELETED_TITLE
                                        : undefined
                                    }
                                    className={`w-full text-left px-4 py-2.5 transition-colors ${
                                      isDeletedPlayer(p)
                                        ? "opacity-50 cursor-not-allowed"
                                        : "hover:bg-gray-50 dark:hover:bg-gray-700/60"
                                    }`}
                                  >
                                    <div className="font-semibold text-sm text-gray-900 dark:text-white flex justify-between items-center gap-2">
                                      <span
                                        className={`min-w-0 truncate ${isDeletedPlayer(p) ? "line-through decoration-1" : ""}`}
                                      >
                                        {p.name}{" "}
                                        <span className="text-gray-400 font-normal">
                                          #{p.jersey_number}
                                        </span>
                                      </span>
                                      <span
                                        className={`shrink-0 max-w-[45%] truncate text-xs px-2 py-0.5 rounded-full font-bold ${p.team?.id === activeTeamId ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"}`}
                                      >
                                        {p.team?.name || "No Team"}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {p.position}
                                    </div>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="p-4 text-center">
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 wrap-break-word">
                                No player found for "{searchQuery}"
                              </p>
                              <Button
                                variant="link"
                                size="sm"
                                icon={PlusIcon}
                                onClick={() => {
                                  setShowQuickAdd(true);
                                  setShowDropdown(false);
                                  setQuickAdd({
                                    ...emptyQuickAdd,
                                    name: searchQuery,
                                  });
                                }}
                              >
                                Create new player
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick-add form */}
                    {showQuickAdd && (
                      <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/40 space-y-3">
                        <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                          New Player — Quick Add
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Input
                            type="text"
                            aria-label="New player full name"
                            value={quickAdd.name}
                            onChange={(e) =>
                              setQuickAdd((f) => ({
                                ...f,
                                name: e.target.value,
                              }))
                            }
                            placeholder="Full name *"
                            className="sm:col-span-3"
                          />
                          <Select
                            aria-label="New player position"
                            value={quickAdd.position}
                            onChange={(e) =>
                              setQuickAdd((f) => ({
                                ...f,
                                position: e.target.value,
                              }))
                            }
                            className="sm:col-span-2"
                          >
                            <option value="">Position *</option>
                            {PLAYER_POSITIONS_WITH_UNASSIGNED.map((pos) => (
                              <option key={pos} value={pos}>
                                {pos === "-" ? "- (No Role / Unassigned)" : pos}
                              </option>
                            ))}
                          </Select>
                          <Input
                            type="number"
                            aria-label="New player jersey number"
                            value={quickAdd.jersey_number}
                            onChange={(e) =>
                              setQuickAdd((f) => ({
                                ...f,
                                jersey_number: e.target.value,
                              }))
                            }
                            placeholder="# Jersey"
                          />
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setShowQuickAdd(false);
                              setSearchQuery("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={createMutation.isPending}
                            loading={createMutation.isPending}
                            onClick={requestCreate}
                          >
                            Create & Add
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Currently selected chips ── */}
                  {activeSelected.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                        On Sheet ({selectedCount})
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {activeSelected.map((pid) => {
                          const p =
                            activeTeamPlayers.find((pl) => pl.id === pid) ||
                            extraPlayers[pid] ||
                            ((teamSheet?.home_team.find(
                              (p) => p.player_id === pid,
                            ) ||
                              teamSheet?.away_team.find(
                                (p) => p.player_id === pid,
                              )) as TeamSheetPlayer | undefined);
                          const name =
                            p && "name" in p && typeof p.name === "string"
                              ? p.name
                              : pid.slice(0, 8);
                          return (
                            <span
                              key={pid}
                              className="inline-flex items-center min-h-11 pl-3 bg-sffl-navy/10 dark:bg-sffl-navy/30 text-sffl-navy dark:text-white text-xs font-bold rounded-full"
                            >
                              {name}
                              <IconButton
                                variant="ghost"
                                icon={XMarkIcon}
                                label={`Remove ${name}`}
                                onClick={() => togglePlayer(pid)}
                              />
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Team roster checklist ── */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                      {activeTeamName} Roster
                    </label>
                    {activeTeamPlayers.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No players registered for this team yet.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {activeTeamPlayers.map((player) => (
                          <label
                            key={player.id}
                            title={
                              isDeletedPlayer(player)
                                ? DELETED_TITLE
                                : undefined
                            }
                            className={`flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors ${
                              isDeletedPlayer(player)
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer"
                            }`}
                          >
                            <Checkbox
                              checked={activeSelected.includes(player.id)}
                              onChange={() => togglePlayer(player.id)}
                              disabled={isDeletedPlayer(player)}
                            />
                            <div
                              className={`flex-1 min-w-0 wrap-break-word font-semibold text-sm ${
                                isDeletedPlayer(player)
                                  ? "text-gray-400 dark:text-gray-500 line-through decoration-1"
                                  : "text-gray-800 dark:text-gray-200"
                              }`}
                            >
                              {player.name}
                            </div>
                            <span className="shrink-0 text-xs text-gray-400 font-semibold">
                              #{player.jersey_number} · {player.position}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

      </Modal>

      {/* Outside the overlay: portal clicks bubble through the React tree, so
                inside it a backdrop click would also close the whole team sheet. */}
      <ConfirmDialog
        open={pendingAction !== null}
        title={dialog.title}
        description={dialog.description}
        body={dialogBody}
        confirmLabel={dialog.confirmLabel}
        tone="info"
        icon={dialog.icon}
        pending={dialog.pending}
        onConfirm={confirmPendingAction}
        onCancel={closeDialog}
      />
    </>
  );
};
