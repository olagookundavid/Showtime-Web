import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  adminTransfersApi,
  contractsApi,
} from "../../services/api";
import type { TransferWindowData } from "../../types/transfers";
import type { Player } from "../../types/players";
import toast from "react-hot-toast";
import {
  CheckCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  PowerIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ConfirmSummary } from "../../components/ui/ConfirmSummary";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { RowActions } from "../../components/ui/RowActions";
import { Spinner } from "../../components/ui/Spinner";
import { Button, Checkbox, Field, Input, Modal } from "../../components/ui";
import { DashboardPageHeader } from "../../components/dashboard/DashboardPageHeader";
import { usePermissions } from "../../hooks/usePermissions";

const FREE_AGENTS_PER_PAGE = 24;

// Creating, editing, activating and deleting a window all go through the confirm dialog first.
type PendingAction =
  | { kind: "create" }
  | { kind: "update" }
  | { kind: "toggle"; target: TransferWindowData }
  | { kind: "delete"; target: TransferWindowData };

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
  const { canEdit } = usePermissions();
  const canManage = canEdit("transfer_windows");
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
    if (!canManage) {
      toast.error("View-only access: your role can view Transfer Windows but not make changes.");
      setPendingAction(null);
      return;
    }
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
                disabled: !canManage,
                hint: canManage ? undefined : "View-only access to Transfer Windows",
                onSelect: () => setPendingAction({ kind: "toggle", target: w }),
              },
              {
                label: "Delete",
                icon: TrashIcon,
                danger: true,
                disabled: !canManage,
                hint: canManage ? undefined : "View-only access to Transfer Windows",
                onSelect: () => setPendingAction({ kind: "delete", target: w }),
              },
            ]}
          />
        ),
      },
    ],
    [openEditModal, canManage],
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
      <DashboardPageHeader
        title="Transfer Windows"
        subtitle="Configure open/close date windows for league-wide buying and trading."
        actions={
          <Button
            icon={PlusIcon}
            onClick={() => setShowModal(true)}
            disabled={!canManage}
            title={canManage ? undefined : "View-only access to Transfer Windows"}
            className="w-full sm:w-auto shrink-0"
          >
            Create Transfer Window
          </Button>
        }
      />

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
          <Input
            type="text"
            aria-label="Search free agents"
            value={freeAgentSearch}
            onChange={(e) => setFreeAgentSearch(e.target.value)}
            placeholder="Search by name or position…"
            className="w-full sm:w-64"
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
                  <Button
                    variant="secondary"
                    onClick={() => setFreeAgentPage((p) => Math.max(1, p - 1))}
                    disabled={freeAgentPage <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    Page {freeAgentPage} of {freeAgentTotalPages}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setFreeAgentPage((p) =>
                        Math.min(freeAgentTotalPages, p + 1),
                      )
                    }
                    disabled={freeAgentPage >= freeAgentTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal for creating window */}
      {showModal && (
        <Modal
          open
          onClose={() => setShowModal(false)}
          title="Create Transfer Window"
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={requestCreate} disabled={submitting} className="flex-1">
                Create Window
              </Button>
            </>
          }
        >
            <div className="space-y-4">
              <Field label="Window Name" htmlFor="window-name">
                <Input
                  id="window-name"
                  type="text"
                  placeholder="e.g. Mid-Season Transfer Window"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>

              <Field label="Opens At" htmlFor="window-opens">
                <Input
                  id="window-opens"
                  type="datetime-local"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                />
              </Field>

              <Field label="Closes At" htmlFor="window-closes">
                <Input
                  id="window-closes"
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                />
              </Field>
            </div>

        </Modal>
      )}

      {/* Modal for editing window */}
      {editingWindow && (
        <Modal
          open
          onClose={() => setEditingWindow(null)}
          title="Edit Transfer Window"
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditingWindow(null)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={requestUpdate} disabled={submitting} className="flex-1">
                Save Changes
              </Button>
            </>
          }
        >
            <div className="space-y-4">
              <Field label="Window Name" htmlFor="edit-window-name">
                <Input
                  id="edit-window-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </Field>

              <Field label="Opens At" htmlFor="edit-window-opens">
                <Input
                  id="edit-window-opens"
                  type="datetime-local"
                  value={editOpensAt}
                  onChange={(e) => setEditOpensAt(e.target.value)}
                />
              </Field>

              <Field label="Closes At" htmlFor="edit-window-closes">
                <Input
                  id="edit-window-closes"
                  type="datetime-local"
                  value={editClosesAt}
                  onChange={(e) => setEditClosesAt(e.target.value)}
                />
              </Field>

              <Checkbox
                id="editIsActiveCheckbox"
                label="Window Active Schedule"
                className="pt-2"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.target.checked)}
              />
            </div>

        </Modal>
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
