import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  TrophyIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Loader } from "../../components/ui/Loader";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ConfirmSummary } from "../../components/ui/ConfirmSummary";
import { FootballIcon } from "../../components/icons/FootballIcon";
import {
  getAdminCompetitions,
  createCompetition,
  updateCompetition,
  deleteCompetition,
  getCompetitions,
  getTeams,
  getTeamsByCompetition,
  type Team,
} from "../../services/api";
import { ImageUploadField, LightboxImage } from "../../components/ui";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";

interface Competition {
  id: string;
  name: string;
  logo: string;
  status?: string;
  format?: string; // PRESEASON | SEASON | PLAYOFFS | CUP
  season_id?: string | null;
  tie_breaker_rule?: string;
  team_ids?: string[];
}

type ApiError = {
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
  };
};

const isApiError = (value: unknown): value is ApiError =>
  typeof value === "object" && value !== null && "response" in value;

// Every save and delete goes through the confirm dialog first.
type PendingAction =
  | { kind: "save" }
  | { kind: "delete"; competition: Competition };

const NO_COMPETITIONS: Competition[] = [];

const inputClass =
  "w-full min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red";

const pagerButton =
  "inline-flex items-center justify-center gap-1 px-4 py-2 min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-300 transition-all duration-300 hover:scale-[1.02] active:scale-95";

const AdminCompetitions = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const limit = 12;

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["adminCompetitionsData", { page, limit, search }],
    queryFn: () => getAdminCompetitions(page, limit, search),
  });

  const competitions: Competition[] = data?.data ?? NO_COMPETITIONS;
  const totalPages = data?.total_pages || 1;
  const apiError = isApiError(queryError) ? queryError : undefined;
  const error =
    apiError?.response?.data?.message ||
    apiError?.response?.data?.error ||
    (queryError ? "Failed to fetch competitions." : "");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Competition | null>(null);
  const [form, setForm] = useState<{
    name: string;
    logo: string;
    status: string;
    format: string;
    season_id: string;
    tie_breaker_rule: string;
    team_ids: string[];
  }>({
    name: "",
    logo: "",
    status: "active",
    format: "SEASON",
    season_id: "",
    tie_breaker_rule: "PCT_PD_PF_PA_NAME",
    team_ids: [],
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [teamFilter, setTeamFilter] = useState("");

  const { data: allCompsData } = useQuery({
    queryKey: ["allCompetitionsLinkable"],
    queryFn: () => getCompetitions(1, 100),
  });
  const seasonComps = (allCompsData?.data || []).filter(
    (c) => c.format === "SEASON",
  );

  const { data: allTeamsData } = useQuery({
    queryKey: ["adminTeamsAll"],
    queryFn: () => getTeams(1, 100),
  });
  const allTeams: Team[] = (
    Array.isArray(allTeamsData?.data)
      ? allTeamsData.data
      : Array.isArray(allTeamsData)
        ? allTeamsData
        : []
  ).filter((t) => t.status !== "inactive");

  const filteredTeams = allTeams.filter(
    (t) =>
      t.name.toLowerCase().includes(teamFilter.toLowerCase()) ||
      t.short_name.toLowerCase().includes(teamFilter.toLowerCase()),
  );

  const openCreate = () => {
    setEditing(null);
    setTeamFilter("");
    setForm({
      name: "",
      logo: "",
      status: "active",
      format: "SEASON",
      season_id: "",
      tie_breaker_rule: "PCT_PD_PF_PA_NAME",
      team_ids: [],
    });
    setShowModal(true);
  };

  const openEdit = async (c: Competition) => {
    setEditing(c);
    setTeamFilter("");
    setForm({
      name: c.name,
      logo: c.logo,
      status: c.status || "active",
      format: c.format || "SEASON",
      season_id: c.season_id || "",
      tie_breaker_rule: c.tie_breaker_rule || "PCT_PD_PF_PA_NAME",
      team_ids: [],
    });
    setShowModal(true);

    try {
      const teamsRes = await getTeamsByCompetition(c.id);
      const teamsList: Team[] = Array.isArray(teamsRes?.data)
        ? teamsRes.data
        : Array.isArray(teamsRes)
          ? teamsRes
          : [];
      setForm((f) => ({ ...f, team_ids: teamsList.map((t) => t.id) }));
    } catch (err) {
      console.error("Failed to load enrolled teams for competition", err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        season_id: form.format !== "SEASON" ? form.season_id || null : null,
      };
      if (editing) {
        await updateCompetition(editing.id, payload);
      } else {
        await createCompetition(payload);
      }
      toast.success(
        editing
          ? "Competition updated successfully"
          : "Competition created successfully",
      );
      queryClient.invalidateQueries({ queryKey: ["adminCompetitionsData"] });
      queryClient.invalidateQueries({ queryKey: ["competitionTeams"] });
      queryClient.invalidateQueries({ queryKey: ["publicCompetitions"] });
      setShowModal(false);
    } catch (err: unknown) {
      const apiError = isApiError(err) ? err : undefined;
      toast.error(
        apiError?.response?.data?.message ||
          apiError?.response?.data?.error ||
          "Failed to save competition.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteCompetition(id);
      queryClient.invalidateQueries({ queryKey: ["adminCompetitionsData"] });
      toast.success("Competition deleted successfully");
    } catch (err: unknown) {
      const apiError = isApiError(err) ? err : undefined;
      toast.error(
        apiError?.response?.data?.message ||
          apiError?.response?.data?.error ||
          "Failed to delete competition.",
      );
    } finally {
      setDeleting(false);
    }
  };

  // Runs once the admin confirms. The handlers report their own errors, so the
  // dialog always closes afterwards (a failed save leaves the form open).
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "save") await handleSave();
    else await handleDelete(pendingAction.competition.id);
    setPendingAction(null);
  };

  const searchNow = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const dialog =
    pendingAction?.kind === "delete"
      ? {
          title: "Delete this competition?",
          description: "This may affect related matches and standings.",
          confirmLabel: "Delete Competition",
          tone: "warning" as const,
          icon: TrashIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Name", pendingAction.competition.name],
                ["Format", pendingAction.competition.format || "SEASON"],
                ["Status", pendingAction.competition.status],
              ]}
            />
          ),
        }
      : {
          title: editing
            ? "Save changes to this competition?"
            : "Create this competition?",
          description: undefined,
          confirmLabel: editing ? "Save Changes" : "Create Competition",
          tone: "info" as const,
          icon: editing ? PencilSquareIcon : CheckCircleIcon,
          body:
            pendingAction?.kind === "save" ? (
              <ConfirmSummary
                rows={[
                  ["Name", form.name],
                  ["Status", form.status],
                  ["Format", form.format],
                  ["Enrolled teams", String(form.team_ids.length)],
                ]}
              />
            ) : null,
        };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Competitions"
        subtitle="Create competitions and choose which teams are enrolled in each."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 min-h-11 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
          >
            <PlusIcon className="w-4 h-4" aria-hidden="true" />
            Add Competition
          </button>
        }
      />

      {/* Search bar */}
      <div className="flex gap-2 w-full md:w-auto">
        <div className="relative flex-1 min-w-0 md:flex-none md:w-96">
          <input
            type="text"
            aria-label="Search competitions"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") searchNow();
            }}
            placeholder="Search competitions by name..."
            className="w-full min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg pl-9 pr-11 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red transition-all"
          />
          <MagnifyingGlassIcon
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            aria-hidden="true"
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
              className="absolute right-0 top-0 h-full min-w-11 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
            >
              <XMarkIcon className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={searchNow}
          className="shrink-0 px-4 py-2 min-h-11 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSearchInput("");
              setPage(1);
            }}
            title="Clear Filters"
            aria-label="Clear filters"
            className="shrink-0 p-2 min-h-11 min-w-11 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-lg transition-all duration-300 hover:scale-[1.02] active:scale-95 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center"
          >
            <XMarkIcon className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800/30">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {loading ? (
          <Loader />
        ) : competitions.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 wrap-break-word">
            {search
              ? `No competitions matching "${search}".`
              : "No competitions found."}
          </div>
        ) : (
          competitions.map((comp) => (
            <div
              key={comp.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-lg min-w-0"
            >
              <div className="p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1 basis-48">
                    {comp.logo ? (
                      <LightboxImage
                        src={comp.logo}
                        alt={comp.name}
                        thumbnailClassName="w-14 h-14 rounded-lg object-contain bg-gray-50 dark:bg-gray-700/50 p-1 shadow-sm border border-gray-100 dark:border-gray-700"
                      />
                    ) : (
                      <div className="shrink-0 w-14 h-14 rounded-lg bg-sffl-navy/10 flex items-center justify-center text-sffl-navy dark:text-white">
                        <TrophyIcon className="w-7 h-7" aria-hidden="true" />
                      </div>
                    )}
                    <h3 className="min-w-0 text-lg font-bold text-gray-900 dark:text-white wrap-break-word">
                      {comp.name}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {comp.format && comp.format !== "SEASON" && (
                      <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-sffl-navy/10 text-sffl-navy dark:bg-gray-700 dark:text-gray-200">
                        {comp.format}
                      </span>
                    )}
                    {comp.status && (
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          comp.status === "active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : comp.status === "inactive"
                              ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                              : comp.status === "completed"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}
                      >
                        {comp.status === "completed" && (
                          <TrophyIcon className="w-3 h-3" aria-hidden="true" />
                        )}
                        {comp.status}
                      </span>
                    )}
                  </div>
                </div>
                {comp.season_id && (
                  <div className="mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700/50 max-w-full w-fit">
                    <span className="inline-flex items-center gap-1">
                      <LinkIcon className="w-3.5 h-3.5" aria-hidden="true" />
                      Season:
                    </span>
                    <span className="min-w-0 wrap-break-word font-semibold text-sffl-navy dark:text-gray-200">
                      {(allCompsData?.data || []).find(
                        (c) => c.id === comp.season_id,
                      )?.name || "Linked Season"}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <Link
                    to={`/admin/competitions/${comp.id}/teams`}
                    className="flex-1 min-w-24 text-center text-xs font-bold bg-green-50 text-green-700 hover:text-green-900 dark:bg-green-900/30 dark:text-green-400 py-2 min-h-11 rounded-lg shadow-sm hover:shadow-md hover:bg-green-100 dark:hover:bg-green-900/50 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center"
                  >
                    Teams
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEdit(comp)}
                    className="flex-1 min-w-24 text-xs font-bold bg-blue-50 text-blue-600 hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 py-2 min-h-11 rounded-lg shadow-sm hover:shadow-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingAction({ kind: "delete", competition: comp })
                    }
                    className="flex-1 min-w-24 text-xs font-bold bg-red-50 text-red-600 hover:text-red-800 dark:bg-red-900/30 dark:text-red-400 py-2 min-h-11 rounded-lg shadow-sm hover:shadow-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className={pagerButton}
        >
          <ChevronLeftIcon className="w-4 h-4" aria-hidden="true" />
          Prev
        </button>
        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className={pagerButton}
        >
          Next
          <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden"
          data-dialog
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">
                {editing ? "Edit Competition" : "New Competition"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="e.g. SFFL Season 3"
                />
              </div>
              <div>
                <ImageUploadField
                  label="Competition Logo"
                  value={form.logo}
                  onChange={(url) => setForm((f) => ({ ...f, logo: url }))}
                  folder="competitions"
                  helperText="Upload a competition logo.  "
                  isCommitted={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Status *
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value }))
                  }
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Format *
                </label>
                <select
                  value={form.format}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, format: e.target.value }))
                  }
                  className={inputClass}
                >
                  <option value="SEASON">
                    Season (regular season with standings)
                  </option>
                  <option value="PRESEASON">
                    Preseason (tune-up scrimmages & matches)
                  </option>
                  <option value="PLAYOFFS">Playoffs (knockout bracket)</option>
                  <option value="CUP">
                    Cup (tournament / cup competition)
                  </option>
                </select>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  {form.format === "PLAYOFFS"
                    ? "Knockout competitions show a bracket instead of standings. Winners advance automatically."
                    : "Regular, preseason, and cup competitions track standings and team performances."}
                </p>
              </div>

              {form.format === "SEASON" ? (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Standings Tie-Breaker Rule *
                  </label>
                  <select
                    value={form.tie_breaker_rule}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        tie_breaker_rule: e.target.value,
                      }))
                    }
                    className={`${inputClass} text-xs sm:text-sm font-medium`}
                  >
                    <option value="PCT_PD_PF_PA_NAME">
                      Rule 1: Win %, then Point Diff, then Points For, then
                      Points Against, then Name (A-Z)
                    </option>
                    <option value="H2H_PCT_PD_PF_PA_NAME">
                      Rule 2: Head-to-Head, then Win %, then Point Diff, then
                      Points For, then Points Against, then Name (A-Z)
                    </option>
                  </select>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    Determines how teams are ranked and broken when tied on
                    points/percentage in standings.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Parent Season
                  </label>
                  <select
                    value={form.season_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, season_id: e.target.value }))
                    }
                    className={`${inputClass} text-xs sm:text-sm`}
                  >
                    <option value="">
                      -- No Parent Season (Independent) --
                    </option>
                    {seasonComps
                      .filter((sc) => !editing || sc.id !== editing.id)
                      .map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    Attach this {form.format.toLowerCase()} competition to a
                    regular season.
                  </p>
                </div>
              )}

              {/* ── Enrolled Teams Multi-Select Section ── */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                    Enrolled Teams{" "}
                    <span className="text-xs text-sffl-red font-semibold">
                      ({form.team_ids.length} selected)
                    </span>
                  </label>
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          team_ids: allTeams.map((t) => t.id),
                        }))
                      }
                      className="min-h-11 px-2 font-bold text-sffl-red hover:underline"
                    >
                      Select All
                    </button>
                    <span
                      className="w-px h-4 bg-gray-300 dark:bg-gray-600"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, team_ids: [] }))}
                      className="min-h-11 px-2 font-bold text-gray-500 hover:underline dark:text-gray-400"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  aria-label="Search teams"
                  placeholder="Search teams by name..."
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="w-full min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red"
                />
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 divide-y divide-gray-100 dark:divide-gray-700/50 space-y-1 bg-gray-50/50 dark:bg-gray-900/30">
                  {filteredTeams.length === 0 ? (
                    <p className="text-xs text-gray-400 italic p-2 text-center">
                      No teams match your search.
                    </p>
                  ) : (
                    filteredTeams.map((team) => {
                      const isSelected = form.team_ids.includes(team.id);
                      return (
                        <label
                          key={team.id}
                          className={`flex items-center justify-between min-h-11 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-red-50/80 dark:bg-red-950/20" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setForm((f) => ({
                                  ...f,
                                  team_ids: checked
                                    ? [...f.team_ids, team.id]
                                    : f.team_ids.filter((id) => id !== team.id),
                                }));
                              }}
                              className="w-4 h-4 shrink-0 text-sffl-red rounded border-gray-300 focus:ring-sffl-red"
                            />
                            {team.logo ? (
                              <img
                                src={team.logo}
                                alt=""
                                className="w-6 h-6 shrink-0 object-contain"
                              />
                            ) : (
                              <div className="w-6 h-6 shrink-0 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-[10px] font-bold text-gray-500">
                                {team.short_name?.slice(0, 2)}
                              </div>
                            )}
                            <span className="min-w-0 wrap-break-word text-xs font-bold text-gray-800 dark:text-gray-200">
                              {team.name}{" "}
                              <span className="text-gray-400 font-normal">
                                ({team.short_name})
                              </span>
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {editing && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <Link
                    to={`/admin/competitions/${editing.id}/teams`}
                    onClick={() => setShowModal(false)}
                    className="w-full flex flex-wrap items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-bold text-xs rounded-lg border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/50 transition-all min-h-11"
                  >
                    <FootballIcon
                      className="w-4 h-4 shrink-0"
                      aria-hidden="true"
                    />
                    Manage Enrolled Teams Standalone Page
                    <ArrowRightIcon
                      className="w-4 h-4 shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 min-h-11 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setPendingAction({ kind: "save" })}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 min-h-11 bg-sffl-red text-white font-bold text-sm rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outside the form overlay: portal clicks bubble through the React tree,
                so inside it a backdrop click would also close the form. */}
      <ConfirmDialog
        open={pendingAction !== null}
        title={dialog.title}
        description={dialog.description}
        body={dialog.body}
        confirmLabel={dialog.confirmLabel}
        tone={dialog.tone}
        icon={dialog.icon}
        pending={saving || deleting}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};

export default AdminCompetitions;
