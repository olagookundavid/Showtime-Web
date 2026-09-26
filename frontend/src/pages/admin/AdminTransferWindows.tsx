import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  adminTransfersApi,
  contractsApi,
  type TransferWindowData,
  type Player,
} from "../../services/api";
import toast from "react-hot-toast";
import {
  CheckCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  PowerIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ConfirmSummary } from "../../components/ui/ConfirmSummary";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { RowActions } from "../../components/ui/RowActions";
import { Spinner } from "../../components/ui/Spinner";

const FREE_AGENTS_PER_PAGE = 24;

// Creating, editing, activating and deleting a window all go through the confirm dialog first.
type PendingAction =
  | { kind: "create" }
  | { kind: "update" }
  | { kind: "toggle"; target: TransferWindowData }
  | { kind: "delete"; target: TransferWindowData };

const inputClass =
  "w-full min-h-11 px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-sffl-red focus:border-sffl-red";

const formatDateTime = (value: string) => new Date(value).toLocaleString();

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error !== "object" || error === null || !("response" in error))
    return fallback;
  const response = error.response;
  if (
    typeof response !== "object" ||
    response === null ||
    !("data" in response)
  )
    return fallback;
  const data = response.data;
  if (typeof data !== "object" || data === null || !("error" in data))
    return fallback;
  return typeof data.error === "string" ? data.error : fallback;
};

export const AdminTransferWindows: React.FC = () => {
  const [windows, setWindows] = useState<TransferWindowData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);

  // Free agents listed underneath the schedule.
  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [freeAgentSearch, setFreeAgentSearch] = useState<string>("");
  const [freeAgentPage, setFreeAgentPage] = useState<number>(1);
  const [freeAgentTotal, setFreeAgentTotal] = useState<number>(0);
  const [freeAgentTotalPages, setFreeAgentTotalPages] = useState<number>(1);
  const [freeAgentsLoading, setFreeAgentsLoading] = useState<boolean>(true);

  // Form state
  const [name, setName] = useState<string>("");
  const [opensAt, setOpensAt] = useState<string>("");
  const [closesAt, setClosesAt] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  // Activate/deactivate and delete share this flag; create and edit use `submitting`.
  const [busy, setBusy] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  // Edit state
  const [editingWindow, setEditingWindow] = useState<TransferWindowData | null>(
    null,
  );
  const [editName, setEditName] = useState<string>("");
  const [editOpensAt, setEditOpensAt] = useState<string>("");
  const [editClosesAt, setEditClosesAt] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  // Stable between renders, so the table columns below can be memoized.
  const openEditModal = useCallback((w: TransferWindowData) => {
    setEditingWindow(w);
    setEditName(w.name);
    const formatLocal = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setEditOpensAt(formatLocal(w.opens_at));
    setEditClosesAt(formatLocal(w.closes_at));
    setEditIsActive(w.is_active);
  }, []);

  // Runs before the confirm dialog opens, so it never asks about a window that can't be saved.
  const requestUpdate = () => {
    if (!editName || !editOpensAt || !editClosesAt) {
      toast.error("Please fill in all fields");
      return;
    }
    setPendingAction({ kind: "update" });
  };

  const handleUpdateWindow = async () => {
    if (!editingWindow) return;

    setSubmitting(true);
    try {
      await adminTransfersApi.updateWindow(editingWindow.id, {
        name: editName,
        opens_at: new Date(editOpensAt).toISOString(),
        closes_at: new Date(editClosesAt).toISOString(),
        is_active: editIsActive,
      });
      toast.success("Transfer window updated successfully");
      setEditingWindow(null);
      fetchWindows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update transfer window"));
    } finally {
      setSubmitting(false);
    }
  };

  const fetchWindows = async () => {
    setLoading(true);
    try {
      const res = await adminTransfersApi.getWindows();
      setWindows(res || []);
    } catch {
      toast.error("Failed to load transfer windows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWindows();
  }, []);

  // Debounced so typing in the search box does not fire a request per keystroke.
  // Inlined rather than lifted out so the effect owns every value it reads.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setFreeAgentsLoading(true);
      try {
        const res = await contractsApi.getFreeAgents({
          search: freeAgentSearch,
          page: freeAgentPage,
          limit: FREE_AGENTS_PER_PAGE,
        });
        // A newer search may have superseded this one mid-flight.
        if (cancelled) return;
        setFreeAgents(res.data || []);
        setFreeAgentTotal(res.total || 0);
        setFreeAgentTotalPages(res.total_pages || 1);
      } catch {
        if (!cancelled) toast.error("Failed to load free agents");
      } finally {
        if (!cancelled) setFreeAgentsLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [freeAgentSearch, freeAgentPage]);

  // A new search term invalidates whatever page the admin was on.
  useEffect(() => {
    setFreeAgentPage(1);
  }, [freeAgentSearch]);

  const requestCreate = () => {
    if (!name || !opensAt || !closesAt) {
      toast.error("Please fill in all fields");
      return;
    }
    setPendingAction({ kind: "create" });
  };

  const handleCreateWindow = async () => {
    setSubmitting(true);
    try {
      await adminTransfersApi.createWindow({
        name,
        opens_at: new Date(opensAt).toISOString(),
        closes_at: new Date(closesAt).toISOString(),
        is_active: true,
      });
      toast.success("Transfer window created successfully");
      setShowModal(false);
      setName("");
      setOpensAt("");
      setClosesAt("");
      fetchWindows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create transfer window"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (w: TransferWindowData) => {
    try {
      await adminTransfersApi.updateWindow(w.id, { is_active: !w.is_active });
      toast.success(`Window ${!w.is_active ? "activated" : "deactivated"}`);
      fetchWindows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update window"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminTransfersApi.deleteWindow(id);
      toast.success("Window deleted");
      fetchWindows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete window"));
    }
  };

  // Runs once the admin confirms. The handlers report their own errors, so the
  // dialog always closes afterwards (a failed create or edit leaves its form open).
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "create") {
      await handleCreateWindow();
    } else if (pendingAction.kind === "update") {
      await handleUpdateWindow();
    } else {
      setBusy(true);
      try {
        if (pendingAction.kind === "toggle")
          await handleToggleActive(pendingAction.target);
        else await handleDelete(pendingAction.target.id);
      } finally {
        setBusy(false);
      }
    }
    setPendingAction(null);
  };

  // Spent windows are hidden: once a window has closed it is a historical record,
  // not a schedule an admin acts on, and leaving them in buried the live one.
  const scheduledWindows = useMemo(() => {
    const now = Date.now();
    return windows.filter((w) => new Date(w.closes_at).getTime() >= now);
  }, [windows]);
  const spentWindowCount = windows.length - scheduledWindows.length;

  const windowColumns = useMemo<Column<TransferWindowData>[]>(
    () => [
      {
        header: "Window Name",
        cell: (w) => (
          <span className="font-bold text-gray-900 dark:text-white">
            {w.name}
          </span>
        ),
      },
      {
        header: "Opens At",
        cell: (w) => (
          <span className="text-gray-600 dark:text-gray-300 font-mono text-xs">
            {formatDateTime(w.opens_at)}
          </span>
        ),
      },
      {
        header: "Closes At",
        cell: (w) => (
          <span className="text-gray-600 dark:text-gray-300 font-mono text-xs">
            {formatDateTime(w.closes_at)}
          </span>
        ),
      },
      {
        header: "Status",
        cell: (w) => (
          <span
            className={`px-2.5 py-1 rounded-md text-xs font-bold ${
              w.is_open
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 animate-pulse"
                : w.is_active
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {w.is_open
              ? "OPEN NOW"
              : w.is_active
                ? "ACTIVE SCHEDULE"
                : "INACTIVE"}
          </span>
        ),
      },
      {
        header: "Actions",
        align: "right",
        cell: (w) => (
          <RowActions
            label={`Actions for ${w.name}`}
            actions={[
              {
                label: "Edit",
                icon: PencilSquareIcon,
                onSelect: () => openEditModal(w),
              },
              {
                label: w.is_active ? "Deactivate" : "Activate",
                icon: PowerIcon,
                onSelect: () => setPendingAction({ kind: "toggle", target: w }),
              },
              {
                label: "Delete",
                icon: TrashIcon,
                danger: true,
                onSelect: () => setPendingAction({ kind: "delete", target: w }),
              },
            ]}
          />
        ),
      },
    ],
    [openEditModal],
  );

  const dialog = (() => {
    switch (pendingAction?.kind) {
      case "create":
        return {
          title: "Create this transfer window?",
          description: undefined,
          confirmLabel: "Create Window",
          tone: "info" as const,
          icon: CheckCircleIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Name", name],
                ["Opens", formatDateTime(opensAt)],
                ["Closes", formatDateTime(closesAt)],
              ]}
            />
          ),
        };
      case "update":
        return {
          title: "Save changes to this window?",
          description: undefined,
          confirmLabel: "Save Changes",
          tone: "info" as const,
          icon: PencilSquareIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Name", editName],
                ["Opens", formatDateTime(editOpensAt)],
                ["Closes", formatDateTime(editClosesAt)],
                ["Active schedule", editIsActive ? "Yes" : "No"],
              ]}
            />
          ),
        };
      case "toggle": {
        const w = pendingAction.target;
        return {
          title: w.is_active
            ? "Deactivate this window?"
            : "Activate this window?",
          description: w.is_active
            ? "It stops counting as an active schedule."
            : "It counts as an active schedule again.",
          confirmLabel: w.is_active ? "Deactivate" : "Activate",
          tone: w.is_active ? ("warning" as const) : ("success" as const),
          icon: PowerIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Window", w.name],
                ["Opens", formatDateTime(w.opens_at)],
                ["Closes", formatDateTime(w.closes_at)],
              ]}
            />
          ),
        };
      }
      case "delete": {
        const w = pendingAction.target;
        return {
          title: "Delete this transfer window?",
          description: "This removes the window record.",
          confirmLabel: "Delete Window",
          tone: "warning" as const,
          icon: TrashIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Window", w.name],
                ["Opens", formatDateTime(w.opens_at)],
                ["Closes", formatDateTime(w.closes_at)],
              ]}
            />
          ),
        };
      }
      default:
        return {
          title: "",
          description: undefined,
          confirmLabel: "",
          tone: "info" as const,
          icon: CheckCircleIcon,
          body: null,
        };
    }
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight wrap-break-word">
            Transfer Window Schedules
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure open/close date windows for league-wide buying and
            trading.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0 px-4 py-2.5 min-h-11 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-xl shadow-md transition-colors"
        >
          <PlusIcon className="w-4 h-4" aria-hidden="true" />
          Create Transfer Window
        </button>
      </div>

      <DataTable
        data={scheduledWindows}
        columns={windowColumns}
        searchable={false}
        paginated={false}
        compact
        loading={loading}
        getRowId={(w) => w.id}
        emptyMessage={
          windows.length === 0
            ? "No transfer windows configured yet."
            : "No current or upcoming transfer windows. Create one to reopen the market."
        }
      />

      {spentWindowCount > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
          {spentWindowCount} closed{" "}
          {spentWindowCount === 1 ? "window is" : "windows are"} hidden from
          this schedule.
        </p>
      )}

      {/* Free agents — players with no active contract, available to any club. */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-sffl-navy dark:text-white uppercase tracking-wider">
              Free Agents{" "}
              {!freeAgentsLoading && (
                <span className="text-gray-400">({freeAgentTotal})</span>
              )}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Players with no active contract. Any club can sign them while a
              window is open.
            </p>
          </div>
          <input
            type="text"
            aria-label="Search free agents"
            value={freeAgentSearch}
            onChange={(e) => setFreeAgentSearch(e.target.value)}
            placeholder="Search by name or position…"
            className="w-full sm:w-64 min-h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {freeAgentsLoading ? (
          <Spinner />
        ) : freeAgents.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-400">
            {freeAgentSearch
              ? "No free agents match that search."
              : "No free agents — every player holds an active contract."}
          </div>
        ) : (
          <>
            <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {freeAgents.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30"
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-sffl-navy/10 text-sffl-navy dark:text-blue-400 flex items-center justify-center font-black text-xs shrink-0">
                      {p.jersey_number || "?"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {p.position || "Unassigned"} • Free Agent
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {freeAgentTotalPages > 1 && (
              <div className="px-4 md:px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Showing {(freeAgentPage - 1) * FREE_AGENTS_PER_PAGE + 1}–
                  {Math.min(
                    freeAgentPage * FREE_AGENTS_PER_PAGE,
                    freeAgentTotal,
                  )}{" "}
                  of {freeAgentTotal}
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFreeAgentPage((p) => Math.max(1, p - 1))}
                    disabled={freeAgentPage <= 1}
                    className="px-3 py-1.5 min-h-11 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    Page {freeAgentPage} of {freeAgentTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFreeAgentPage((p) =>
                        Math.min(freeAgentTotalPages, p + 1),
                      )
                    }
                    disabled={freeAgentPage >= freeAgentTotalPages}
                    className="px-3 py-1.5 min-h-11 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal for creating window */}
      {showModal && (
        <div
          className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden"
          data-dialog
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto shadow-2xl border border-gray-100 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center gap-3 border-b border-gray-100 dark:border-gray-700 p-4 sm:p-6 pb-4 shrink-0">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                Create Transfer Window
              </h3>
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
                  Window Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mid-Season Transfer Window"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Opens At
                </label>
                <input
                  type="datetime-local"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Closes At
                </label>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800/90">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold text-sm rounded-xl transition-colors min-h-11"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={requestCreate}
                disabled={submitting}
                className="flex-1 py-2.5 bg-sffl-red hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 min-h-11 shadow-sm"
              >
                Create Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for editing window */}
      {editingWindow && (
        <div
          className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden"
          data-dialog
          onClick={() => setEditingWindow(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto shadow-2xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center gap-3 border-b border-gray-200 dark:border-gray-700 p-4 sm:p-6 pb-4 shrink-0">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                Edit Transfer Window
              </h3>
              <button
                type="button"
                onClick={() => setEditingWindow(null)}
                aria-label="Close"
                className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Window Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Opens At
                </label>
                <input
                  type="datetime-local"
                  value={editOpensAt}
                  onChange={(e) => setEditOpensAt(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Closes At
                </label>
                <input
                  type="datetime-local"
                  value={editClosesAt}
                  onChange={(e) => setEditClosesAt(e.target.value)}
                  className={inputClass}
                />
              </div>

              <label
                htmlFor="editIsActiveCheckbox"
                className="flex items-center gap-3 min-h-11 pt-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  id="editIsActiveCheckbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-5 h-5 shrink-0 text-sffl-red rounded border-gray-300 focus:ring-sffl-red"
                />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Window Active Schedule
                </span>
              </label>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800/90">
              <button
                type="button"
                onClick={() => setEditingWindow(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold text-sm rounded-xl transition-colors min-h-11"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={requestUpdate}
                disabled={submitting}
                className="flex-1 py-2.5 bg-sffl-red hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 min-h-11 shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outside the form overlays: portal clicks bubble through the React tree,
                so inside one a backdrop click would also close the form. */}
      <ConfirmDialog
        open={pendingAction !== null}
        title={dialog.title}
        description={dialog.description}
        body={dialog.body}
        confirmLabel={dialog.confirmLabel}
        tone={dialog.tone}
        icon={dialog.icon}
        pending={submitting || busy}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};

export default AdminTransferWindows;
