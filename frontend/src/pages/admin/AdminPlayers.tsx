import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ConfirmSummary } from "../../components/ui/ConfirmSummary";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { RowActions } from "../../components/ui/RowActions";
import { ImageUploadField, LightboxImage } from "../../components/ui";
import {
  getPlayers,
  getTeams,
  createPlayer,
  updatePlayer,
  deletePlayer,
  restorePlayer,
  moveToReserve,
  graduatePlayer,
  type Player,
  type Team,
  type CreatePlayerPayload,
} from "../../services/api";
import {
  isDeletedPlayer,
  DeletedPlayerName,
  deletedRowClass,
} from "../../components/common/DeletedPlayer";
import { DashboardPageHeader } from "../../components/dashboard/DashboardPageHeader";

interface FormData {
  name: string;
  jersey_number: string;
  position: string;
  secondary_position: string;
  gender: string;
  team_id: string;
  bio: string;
  image: string;
  email: string;
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
  };
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as ApiError).response;
    return response?.data?.message || response?.data?.error || fallback;
  }
  return fallback;
};

const emptyForm: FormData = {
  name: "",
  jersey_number: "",
  position: "-",
  secondary_position: "",
  gender: "",
  team_id: "",
  bio: "",
  image: "",
  email: "",
};

// Center is rated identically to Receiver (same formula) — see
// backend/internal/domain/player_rating.go RateByPosition.
const POSITIONS = [
  "Defender",
  "Receiver",
  "Center",
  "QB",
  "Rusher",
  "Allrounder",
  "-",
];
// All-Rounder already means "plays anywhere", so it says nothing as a second
// role — it is a main role only, and the server refuses it as a secondary.
const SECONDARY_POSITIONS = POSITIONS.filter(
  (p) => p !== "Allrounder" && p !== "-",
);

// Every write on this page goes through the confirm dialog first.
type PendingAction =
  | { kind: "save" }
  | { kind: "delete"; player: Player }
  | { kind: "restore"; player: Player }
  | { kind: "graduate"; player: Player }
  | { kind: "reserve"; player: Player };

// A stable empty list, so the table isn't handed a fresh array on every render.
const NO_PLAYERS: Player[] = [];

const inputClass =
  "w-full min-h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2";
const filterClass =
  "w-full sm:w-auto max-w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-11 z-50 font-semibold text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

export const AdminPlayers = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [rosterStatus, setRosterStatus] = useState<"main" | "reserve" | "all">(
    "all",
  );

  // Filters
  const [filterTeam, setFilterTeam] = useState("");

  const { data: allPlayersData, isLoading: loadingPlayers } = useQuery({
    queryKey: [
      "adminPlayers",
      { page, limit, search: searchTerm, team: filterTeam, rosterStatus },
    ],
    queryFn: () =>
      getPlayers(
        filterTeam || undefined,
        page,
        limit,
        searchTerm,
        rosterStatus,
      ),
  });

  const { data: teamsData, isLoading: loadingTeams } = useQuery({
    queryKey: ["adminTeamsList"], // distinct from paginated adminTeams
    queryFn: () => getTeams(1, 100),
  });

  const allPlayers: Player[] = allPlayersData?.data ?? NO_PLAYERS;
  const totalPages = allPlayersData?.total_pages || 1;
  const teams: Team[] = (teamsData?.data || []).filter(
    (t: Team) => t.status !== "inactive",
  );
  const loading = loadingPlayers || loadingTeams;
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  // Delete, restore and the two squad moves share this flag; saving has its own.
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  const handleFilterChange = (teamId: string) => {
    setFilterTeam(teamId);
    setPage(1);
  };

  const closeForm = useCallback(() => {
    setShowModal(false);
    setPendingAction(null);
  }, []);

  const openCreate = () => {
    setPendingAction(null);
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  // Stable between renders, so the table columns below can be memoized.
  const openEdit = useCallback((p: Player) => {
    setPendingAction(null);
    setEditingId(p.id);
    setForm({
      name: p.name,
      jersey_number: p.jersey_number?.toString() || "",
      position: p.position || "-",
      secondary_position: p.secondary_position || "",
      gender: p.gender || "",
      team_id: p.team?.id || "",
      bio: p.bio || "",
      image: p.image || "",
      email: p.email || "",
    });
    setShowModal(true);
  }, []);

  // Runs before the confirm dialog opens, so it never asks about a player that can't be saved.
  const validateForm = () => {
    if (!form.name.trim()) {
      toast.error("Player name is required");
      return false;
    }
    if (!form.jersey_number || form.jersey_number.trim() === "") {
      toast.error("Jersey number is required");
      return false;
    }
    const jerseyNum = parseInt(form.jersey_number, 10);
    if (isNaN(jerseyNum) || jerseyNum < 1 || jerseyNum > 99) {
      toast.error("Please enter a valid jersey number (1 to 99)");
      return false;
    }
    if (!editingId && !form.team_id) {
      toast.error("Team selection is required");
      return false;
    }
    if (form.secondary_position && form.secondary_position === form.position) {
      toast.error("Secondary position cannot be the same as primary position");
      return false;
    }
    return true;
  };

  const requestSave = () => {
    if (validateForm()) setPendingAction({ kind: "save" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: CreatePlayerPayload = {
        name: form.name.trim(),
        jersey_number: parseInt(form.jersey_number, 10),
        position:
          form.position && form.position.trim() ? form.position.trim() : "-",
        secondary_position: form.secondary_position || undefined,
        gender: form.gender,
        team_id: form.team_id,
        bio: form.bio,
        image: form.image,
        email: form.email,
      };
      if (editingId) {
        await updatePlayer(editingId, payload);
        toast.success("Player updated successfully");
      } else {
        await createPlayer(payload);
        toast.success("Player created successfully");
      }
      queryClient.invalidateQueries({ queryKey: ["adminPlayers"] });
      queryClient.invalidateQueries({ queryKey: ["adminTeams"] });
      queryClient.invalidateQueries({ queryKey: ["adminTeamsList"] });
      setShowModal(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to save player"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePlayer(id);
      queryClient.invalidateQueries({ queryKey: ["adminPlayers"] });
      toast.success(
        "Player deleted. Their stats and history are kept, and they can be restored.",
      );
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to delete player"));
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restorePlayer(id);
      queryClient.invalidateQueries({ queryKey: ["adminPlayers"] });
      toast.success("Player restored");
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to restore player"));
    }
  };

  const handleGraduate = async (p: Player) => {
    if (!p.team?.id) return;
    try {
      await graduatePlayer(p.id, p.team.id);
      toast.success(`${p.name} graduated to main squad`);
      queryClient.invalidateQueries({ queryKey: ["adminPlayers"] });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to graduate player"));
    }
  };

  const handleMoveToReserve = async (p: Player) => {
    if (!p.team?.id) return;
    try {
      await moveToReserve(p.id, p.team.id);
      toast.success(`${p.name} moved to reserves`);
      queryClient.invalidateQueries({ queryKey: ["adminPlayers"] });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to move player to reserves"));
    }
  };

  // Runs once the admin confirms. The handlers report their own errors, so the
  // dialog always closes afterwards (a failed save leaves the form open).
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "save") {
      await handleSave();
    } else {
      setBusy(true);
      try {
        if (pendingAction.kind === "delete")
          await handleDelete(pendingAction.player.id);
        else if (pendingAction.kind === "restore")
          await handleRestore(pendingAction.player.id);
        else if (pendingAction.kind === "graduate")
          await handleGraduate(pendingAction.player);
        else await handleMoveToReserve(pendingAction.player);
      } finally {
        setBusy(false);
      }
    }
    setPendingAction(null);
  };

  const set = (field: keyof FormData, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  // Player leads because the first column stays frozen when the table scrolls sideways.
  const columns = useMemo<Column<Player>[]>(
    () => [
      {
        header: "Player",
        sortable: true,
        sortValue: (p) => p.name,
        cell: (p) => {
          const deleted = isDeletedPlayer(p);
          return (
            <div
              className={`flex items-center gap-3 ${deletedRowClass(deleted)}`}
            >
              {p.image ? (
                <LightboxImage
                  src={p.image}
                  alt={p.name}
                  thumbnailClassName="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-sffl-navy/10 dark:bg-sffl-navy/50 border border-sffl-navy/20 dark:border-gray-700 flex items-center justify-center text-xs font-black text-sffl-navy dark:text-gray-200 shrink-0">
                  #{p.jersey_number || "?"}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                {deleted ? (
                  <DeletedPlayerName
                    name={p.name}
                    deleted
                    showLabel
                    className="font-semibold text-sm"
                  />
                ) : (
                  <span className="font-semibold text-sm text-gray-900 dark:text-white wrap-break-word">
                    {p.name}
                  </span>
                )}
                {p.email && (
                  <span className="text-xs text-gray-400 truncate max-w-45">
                    {p.email}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        header: "#",
        accessor: "jersey_number",
        sortable: true,
        className: "px-4 py-3 w-16",
        cell: (p) => (
          <span
            className={`font-bold text-sm dark:text-gray-300 ${deletedRowClass(isDeletedPlayer(p))}`}
          >
            {p.jersey_number || "—"}
          </span>
        ),
      },
      {
        header: "Position",
        accessor: "position",
        sortable: true,
        cell: (p) => (
          <div className="flex flex-col gap-1 items-start">
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded-md text-xs font-bold dark:text-gray-300">
              {p.position}
            </span>
            {p.secondary_position && (
              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded text-[10px] font-extrabold whitespace-nowrap">
                Sec: {p.secondary_position}
              </span>
            )}
          </div>
        ),
      },
      {
        header: "Gender",
        sortable: true,
        sortValue: (p) => p.gender || "",
        cell: (p) => (
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold ${
              p.gender === "F"
                ? "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
                : p.gender === "M"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {p.gender === "F"
              ? "Female (F)"
              : p.gender === "M"
                ? "Male (M)"
                : "—"}
          </span>
        ),
      },
      {
        header: "Team",
        sortable: true,
        sortValue: (p) => p.team?.name || "",
        cell: (p) => (
          <span className="text-sm dark:text-gray-300">
            {p.team?.name || "—"}
          </span>
        ),
      },
      {
        header: "Squad",
        sortable: true,
        sortValue: (p) => (p.is_reserve ? "Reserve" : "Main"),
        cell: (p) =>
          p.is_reserve ? (
            <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Reserve
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Main
            </span>
          ),
      },
      {
        header: "Actions",
        align: "right",
        cell: (p) => {
          const deleted = isDeletedPlayer(p);
          const onTeam = !!p.team?.id && !deleted;
          return (
            <RowActions
              label={`Actions for ${p.name}`}
              actions={[
                ...(onTeam
                  ? [
                      p.is_reserve
                        ? {
                            label: "Graduate to main squad",
                            icon: ArrowUpCircleIcon,
                            onSelect: () =>
                              setPendingAction({ kind: "graduate", player: p }),
                          }
                        : {
                            label: "Move to reserves",
                            icon: ArrowDownCircleIcon,
                            onSelect: () =>
                              setPendingAction({ kind: "reserve", player: p }),
                          },
                    ]
                  : []),
                { label: "Edit", icon: PencilSquareIcon, onSelect: () => openEdit(p) },
                deleted
                  ? {
                      label: "Restore to roster",
                      icon: ArrowUturnLeftIcon,
                      onSelect: () =>
                        setPendingAction({ kind: "restore", player: p }),
                    }
                  : {
                      label: "Delete",
                      icon: TrashIcon,
                      danger: true,
                      onSelect: () =>
                        setPendingAction({ kind: "delete", player: p }),
                    },
              ]}
            />
          );
        },
      },
    ],
    [openEdit],
  );

  const playerRows = (p: Player): [string, string | undefined][] => [
    ["Player", p.name],
    ["Jersey", p.jersey_number ? `#${p.jersey_number}` : undefined],
    ["Team", p.team?.name],
  ];

  let dialog: {
    title: string;
    description?: string;
    confirmLabel: string;
    tone: "success" | "info" | "warning";
    icon: React.ComponentType<{ className?: string }>;
    body: React.ReactNode;
  } | null = null;
  switch (pendingAction?.kind) {
    case "save":
      dialog = {
        title: editingId
          ? "Save changes to this player?"
          : "Create this player?",
        confirmLabel: editingId ? "Save Changes" : "Create Player",
        tone: "info",
        icon: editingId ? PencilSquareIcon : CheckCircleIcon,
        body: (
          <ConfirmSummary
            rows={[
              ["Name", form.name.trim()],
              [
                "Jersey",
                form.jersey_number ? `#${form.jersey_number}` : undefined,
              ],
              [
                "Role",
                form.secondary_position
                  ? `${form.position} (Sec: ${form.secondary_position})`
                  : form.position,
              ],
              [
                "Team",
                teams.find((t) => t.id === form.team_id)?.name ||
                  (editingId ? "Unassigned / Free Agent" : undefined),
              ],
            ]}
          />
        ),
      };
      break;
    case "delete":
      dialog = {
        title: "Delete this player?",
        // It genuinely is reversible now — saying otherwise made admins avoid a
        // safe action, or delete believing the history was going with it.
        description:
          "They come off the active roster and stop appearing in the fantasy market and new team sheets. Their stats and match history are kept, they stay searchable, and you can restore them at any time.",
        confirmLabel: "Delete Player",
        tone: "warning",
        icon: TrashIcon,
        body: <ConfirmSummary rows={playerRows(pendingAction.player)} />,
      };
      break;
    case "restore":
      dialog = {
        title: "Restore this player?",
        description: "They go back on the active roster.",
        confirmLabel: "Restore Player",
        tone: "success",
        icon: ArrowUturnLeftIcon,
        body: <ConfirmSummary rows={playerRows(pendingAction.player)} />,
      };
      break;
    case "graduate":
      dialog = {
        title: "Promote to the main squad?",
        description: "They move from the reserves to the main squad.",
        confirmLabel: "Graduate",
        tone: "success",
        icon: ArrowUpCircleIcon,
        body: <ConfirmSummary rows={playerRows(pendingAction.player)} />,
      };
      break;
    case "reserve":
      dialog = {
        title: "Move to the reserve squad?",
        description: "They move from the main squad to the reserves.",
        confirmLabel: "Move to Reserve",
        tone: "info",
        icon: ArrowDownCircleIcon,
        body: <ConfirmSummary rows={playerRows(pendingAction.player)} />,
      };
      break;
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Players"
        subtitle="Manage player profiles, positions and team assignments."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 min-h-11 whitespace-nowrap"
          >
            <PlusIcon className="w-4 h-4" aria-hidden="true" />
            Add Player
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <select
          aria-label="Team"
          value={filterTeam}
          onChange={(e) => handleFilterChange(e.target.value)}
          className={filterClass}
        >
          <option value="" className="truncate">
            All Teams
          </option>
          <option value="FREE_AGENT" className="truncate">
            Free Agents (no active contract)
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id} className="truncate">
              {t.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Squad"
          value={rosterStatus}
          onChange={(e) => {
            setRosterStatus(e.target.value as "main" | "reserve" | "all");
            setPage(1);
          }}
          className={filterClass}
        >
          <option value="all">All Squads</option>
          <option value="main">Main Squad Only</option>
          <option value="reserve">Reserves Only</option>
        </select>
        <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 min-h-11">
          <label
            htmlFor="limitSelectInput"
            className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Limit:
          </label>
          <select
            id="limitSelectInput"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="bg-transparent font-bold text-sm text-gray-900 dark:text-white focus:outline-none cursor-pointer min-h-11"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={800}>800</option>
            <option value={1000}>1000</option>
          </select>
        </div>
      </div>

      <DataTable
        data={allPlayers}
        columns={columns}
        searchable={true}
        searchPlaceholder="Search players..."
        itemsPerPage={limit}
        serverPage={page}
        totalServerPages={totalPages}
        onPageChange={setPage}
        onSearchSubmit={(term) => {
          setSearchTerm(term);
          setPage(1);
        }}
        loading={loading}
        getRowId={(p) => p.id}
        emptyMessage="No players found."
      />

      {/* Create/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden"
          data-dialog
          onClick={closeForm}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">
                {editingId ? "Edit Player" : "Add Player"}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close"
                className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    className={inputClass}
                    placeholder="Player name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Jersey Number *
                  </label>
                  <input
                    type="number"
                    value={form.jersey_number}
                    onChange={(e) => set("jersey_number", e.target.value)}
                    className={inputClass}
                    min="1"
                    max="99"
                    placeholder="e.g. 10"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Primary Role
                  </label>
                  <select
                    value={form.position || "-"}
                    onChange={(e) => {
                      const newPos = e.target.value;
                      set("position", newPos);
                      if (form.secondary_position === newPos) {
                        set("secondary_position", "");
                      }
                    }}
                    className={`${inputClass} z-50`}
                  >
                    <option value="-" className="truncate">
                      - (No Role / Unassigned)
                    </option>
                    {POSITIONS.filter((p) => p !== "-").map((p) => (
                      <option key={p} value={p} className="truncate">
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Secondary Role{" "}
                    <span className="text-xs font-normal text-gray-400">
                      (Optional)
                    </span>
                  </label>
                  <select
                    value={form.secondary_position}
                    onChange={(e) => set("secondary_position", e.target.value)}
                    className={`${inputClass} z-50`}
                  >
                    <option value="" className="truncate">
                      None (No Secondary Role)
                    </option>
                    {SECONDARY_POSITIONS.filter((p) => p !== form.position).map(
                      (p) => (
                        <option key={p} value={p} className="truncate">
                          {p}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => set("gender", e.target.value)}
                    className={`${inputClass} z-50`}
                  >
                    <option value="">Select...</option>
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Team *
                  </label>
                  <select
                    value={form.team_id}
                    onChange={(e) => set("team_id", e.target.value)}
                    className={`${inputClass} z-50 font-semibold text-sm`}
                  >
                    <option value="" className="truncate">
                      {editingId ? "Unassigned / Free Agent" : "Select..."}
                    </option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id} className="truncate">
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Email{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className={inputClass}
                  placeholder="player@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Bio
                </label>
                <textarea
                  value={form.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"
                  placeholder="Player bio..."
                />
              </div>
              <div>
                <ImageUploadField
                  label="Player Image"
                  value={form.image}
                  onChange={(url) => set("image", url)}
                  folder="players"
                  helperText="Upload a profile photo.  "
                  isCommitted={saving}
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-gray-700 text-sm dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 min-h-11"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={requestSave}
                disabled={saving}
                className="px-4 py-2 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 min-h-11 disabled:opacity-50"
              >
                {editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outside the form overlay: portal clicks bubble through the React tree,
                so inside it a backdrop click would also close the form. */}
      <ConfirmDialog
        open={dialog !== null}
        title={dialog?.title ?? ""}
        description={dialog?.description}
        body={dialog?.body}
        confirmLabel={dialog?.confirmLabel ?? ""}
        tone={dialog?.tone}
        icon={dialog?.icon}
        pending={saving || busy}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};
