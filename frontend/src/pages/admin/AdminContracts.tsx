import React, { useState, useEffect, useMemo } from "react";
import { isAxiosError } from "axios";
import {
  adminTransfersApi,
  contractsApi,
  type ContractData,
} from "../../services/api";
import toast from "react-hot-toast";
import {
  CheckBadgeIcon,
  XCircleIcon,
  ClockIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ConfirmSummary } from "../../components/ui/ConfirmSummary";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { RowActions } from "../../components/ui/RowActions";
import { Field, Input, Select } from "../../components/ui";
import { DashboardPageHeader } from "../../components/dashboard/DashboardPageHeader";

// Status options for the admin override actions
const OVERRIDE_STATUSES = [
  {
    value: "EXPIRED",
    label: "Mark Expired",
    title: "Mark this contract as expired?",
    confirmLabel: "Mark Expired",
    icon: ClockIcon,
    danger: false,
  },
  {
    value: "TERMINATED",
    label: "Terminate",
    title: "Terminate this contract?",
    confirmLabel: "Terminate Contract",
    icon: XCircleIcon,
    danger: true,
  },
  {
    value: "REJECTED",
    label: "Reject",
    title: "Reject this contract?",
    confirmLabel: "Reject Contract",
    icon: NoSymbolIcon,
    danger: true,
  },
  {
    value: "CANCELLED",
    label: "Cancel",
    title: "Cancel this contract?",
    confirmLabel: "Cancel Contract",
    icon: NoSymbolIcon,
    danger: true,
  },
];

// Force-accepting and every status override go through the confirm dialog first.
type PendingAction =
  | { kind: "forceAccept"; contract: ContractData }
  | { kind: "override"; contract: ContractData; status: string };

const statusBadgeClass = (status: string): string => {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "PENDING":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "EXPIRED":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "TERMINATED":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  }
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    const data: unknown = error.response?.data;
    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
    ) {
      return data.error;
    }
  }
  return fallback;
};

export const AdminContracts: React.FC = () => {
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // The action sheet for one contract, then the confirm step for the action picked.
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const res = await contractsApi.getTeamContracts({
        status: statusFilter || undefined,
        search: search || undefined,
        page,
        limit,
      });
      setContracts(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch {
      toast.error("Failed to load contracts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [page, limit, statusFilter, search]);

  const handleOverride = async (contractId: string, newStatus: string) => {
    try {
      await adminTransfersApi.overrideContract(
        contractId,
        newStatus,
        reason.trim() || undefined,
      );
      toast.success(`Contract status updated to ${newStatus}`);
      fetchContracts();
    } catch (err: unknown) {
      toast.error(
        getApiErrorMessage(err, "Failed to override contract status"),
      );
    }
  };

  const handleForceAccept = async (contractId: string) => {
    try {
      const result = await adminTransfersApi.forceAcceptContract(contractId);
      toast.success(result.message || "Contract force-accepted successfully");
      fetchContracts();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to force-accept contract"));
    }
  };

  // Runs once the admin confirms. The handlers report their own errors, so the
  // dialog always closes afterwards.
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    setBusy(true);
    try {
      if (pendingAction.kind === "forceAccept")
        await handleForceAccept(pendingAction.contract.id);
      else
        await handleOverride(pendingAction.contract.id, pendingAction.status);
    } finally {
      setBusy(false);
    }
    setPendingAction(null);
  };

  const columns = useMemo<Column<ContractData>[]>(
    () => [
      {
        header: "Player",
        cell: (c) => (
          <span className="font-bold text-gray-900 dark:text-white">
            {c.player?.name || "Unknown Player"}
          </span>
        ),
      },
      {
        header: "Team",
        cell: (c) => (
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            {c.team?.name || "Unassigned"}
          </span>
        ),
      },
      {
        header: "Status",
        cell: (c) => (
          <span
            className={`px-2.5 py-1 rounded-md text-xs font-bold ${statusBadgeClass(c.status)}`}
          >
            {c.status}
          </span>
        ),
      },
      {
        header: "Played / Total",
        cell: (c) => (
          <span className="font-mono">
            {c.matches_played} / {c.contract_length}
          </span>
        ),
      },
      {
        header: "Value",
        cell: (c) => (
          <span className="font-bold">
            {c.player_value.toLocaleString()} pts
          </span>
        ),
      },
      {
        header: "Offered At",
        cell: (c) => (
          <span className="text-xs text-gray-400">
            {new Date(c.offered_at).toLocaleDateString()}
          </span>
        ),
      },
      {
        header: "Notes",
        cell: (c) => (
          <span
            className="block wrap-break-word md:max-w-48 md:truncate text-xs text-gray-500 dark:text-gray-400"
            title={c.notes || c.termination_reason || ""}
          >
            {c.termination_reason ? (
              <span className="text-red-500 font-semibold">
                {c.termination_reason}
              </span>
            ) : (
              c.notes || "—"
            )}
          </span>
        ),
      },
      {
        header: "Actions",
        align: "right",
        cell: (c) => {
          // Clears the reason from any earlier override before the dialog opens.
          const pick = (action: PendingAction) => {
            setReason("");
            setPendingAction(action);
          };
          return (
            <RowActions
              label={`Actions for ${c.player?.name || "this contract"}`}
              actions={[
                ...(c.status === "PENDING"
                  ? [
                      {
                        label: "Force Accept",
                        icon: CheckBadgeIcon,
                        hint: "Activate without player approval",
                        onSelect: () => pick({ kind: "forceAccept", contract: c }),
                      },
                    ]
                  : []),
                ...OVERRIDE_STATUSES.filter((s) => s.value !== c.status).map((s) => ({
                  label: s.label,
                  icon: s.icon,
                  danger: s.danger,
                  onSelect: () => pick({ kind: "override", contract: c, status: s.value }),
                })),
              ]}
            />
          );
        },
      },
    ],
    [],
  );

  const pendingStatus =
    pendingAction?.kind === "override"
      ? OVERRIDE_STATUSES.find((s) => s.value === pendingAction.status)
      : undefined;

  const dialog =
    pendingAction?.kind === "override" && pendingStatus
      ? {
          title: pendingStatus.title,
          description: undefined,
          confirmLabel: pendingStatus.confirmLabel,
          tone: "warning" as const,
          icon: pendingStatus.icon,
          body: (
            <div className="space-y-3">
              <ConfirmSummary
                rows={[
                  [
                    "Player",
                    pendingAction.contract.player?.name || "Unknown Player",
                  ],
                  ["Team", pendingAction.contract.team?.name || "Unassigned"],
                  ["Now", pendingAction.contract.status],
                  ["Change to", pendingAction.status],
                ]}
              />
              <Field label="Reason (optional)" htmlFor="contract-override-reason">
                <Input
                  id="contract-override-reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is the status changing?"
                />
              </Field>
            </div>
          ),
        }
      : {
          title: "Force-accept this contract?",
          description:
            "This immediately activates the contract and assigns the player to the team, even if they have not claimed their account. It is recorded in the audit log with your admin name.",
          confirmLabel: "Force Accept",
          tone: "warning" as const,
          icon: CheckBadgeIcon,
          body:
            pendingAction?.kind === "forceAccept" ? (
              <ConfirmSummary
                rows={[
                  [
                    "Player",
                    pendingAction.contract.player?.name || "Unknown Player",
                  ],
                  ["Team", pendingAction.contract.team?.name || "Unassigned"],
                ]}
              />
            ) : null,
        };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Contracts"
        subtitle="Global audit, filtering, and status management for all player contracts."
      />

      <DataTable
        data={contracts}
        columns={columns}
        searchPlaceholder="Search player or team..."
        itemsPerPage={limit}
        serverPage={page}
        totalServerPages={totalPages}
        onPageChange={setPage}
        onSearchSubmit={(term) => {
          setSearch(term);
          setPage(1);
        }}
        loading={loading}
        getRowId={(c) => c.id}
        emptyMessage="No contract records match your filter criteria."
        headerActions={
          <>
            <Select
              aria-label="Contract status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-44"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="TERMINATED">TERMINATED</option>
              <option value="CANCELLED">CANCELLED</option>
            </Select>
            <Select
              aria-label="Contracts per page"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="w-full sm:w-40"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </Select>
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
              {total.toLocaleString()} total contract{total === 1 ? "" : "s"}
            </span>
          </>
        }
      />

      <ConfirmDialog
        open={pendingAction !== null}
        title={dialog.title}
        description={dialog.description}
        body={dialog.body}
        confirmLabel={dialog.confirmLabel}
        tone={dialog.tone}
        icon={dialog.icon}
        pending={busy}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};

export default AdminContracts;
