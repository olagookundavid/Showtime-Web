import React, { useState, useEffect, useMemo } from "react";
import {
  adminTransfersApi,
  transfersApi,
  type TransferData,
  type TeamBudgetData,
} from "../../services/api";
import toast from "react-hot-toast";
import { BanknotesIcon, BoltIcon } from "@heroicons/react/24/outline";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ConfirmSummary } from "../../components/ui/ConfirmSummary";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { RowActions } from "../../components/ui/RowActions";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";

const DEFAULT_BUDGET = "15000000";

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error !== "object" || error === null) return fallback;
  const response = (error as { response?: { data?: { error?: unknown } } })
    .response;
  return typeof response?.data?.error === "string"
    ? response.data.error
    : fallback;
};

// Seeding and adjusting budgets both go through the confirm dialog first.
type PendingAction =
  | { kind: "seed" }
  | { kind: "adjust"; budget: TeamBudgetData };

// Transfers flattened to plain values, so the table's built-in search can see player and team names.
interface TransferRow {
  id: string;
  type: string;
  player: string;
  from: string;
  to: string;
  price: number | null;
  status: string;
}

const NO_TRANSFERS: TransferData[] = [];

// Player leads because the first column stays frozen when the table scrolls sideways.
const transferColumns: Column<TransferRow>[] = [
  {
    header: "Player",
    cell: (t) => (
      <span className="font-bold text-gray-900 dark:text-white">
        {t.player}
      </span>
    ),
  },
  {
    header: "Type",
    cell: (t) => (
      <span className="px-2 py-0.5 bg-sffl-navy/10 text-sffl-navy dark:bg-gray-700 dark:text-gray-200 text-xs font-bold rounded">
        {t.type}
      </span>
    ),
  },
  {
    header: "From Team",
    cell: (t) => (
      <span className="text-gray-600 dark:text-gray-300">{t.from}</span>
    ),
  },
  {
    header: "To Team",
    cell: (t) => (
      <span className="text-gray-600 dark:text-gray-300">{t.to}</span>
    ),
  },
  {
    header: "Price / Value",
    cell: (t) => (
      <span className="font-mono font-bold">
        {t.price != null ? `${t.price.toLocaleString()} pts` : "—"}
      </span>
    ),
  },
  {
    header: "Status",
    cell: (t) => <span className="font-bold text-xs">{t.status}</span>,
  },
];

export const AdminTransfers: React.FC = () => {
  const [transfers, setTransfers] = useState<TransferData[]>(NO_TRANSFERS);
  const [budgets, setBudgets] = useState<TeamBudgetData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [budgetInput, setBudgetInput] = useState(DEFAULT_BUDGET);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, bRes] = await Promise.all([
        transfersApi.getTeamTransfers({ limit: 200 }),
        adminTransfersApi.getAllBudgets(),
      ]);
      setTransfers(tRes.data || []);
      setBudgets(bRes || []);
    } catch {
      toast.error("Failed to load transfers or budgets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSeedBudgets = async () => {
    try {
      await adminTransfersApi.seedBudgets();
      toast.success("All team budgets seeded to 15,000,000 pts");
      fetchData();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to seed budgets"));
    }
  };

  const handleAdjustBudget = async (
    teamId: string,
    teamName: string,
    value: number,
  ) => {
    try {
      await adminTransfersApi.adjustBudget(teamId, value);
      toast.success(`Budget for ${teamName} updated`);
      fetchData();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to adjust budget"));
    }
  };

  // Runs once the admin confirms. The handlers report their own errors, so the
  // dialog closes afterwards. A bad budget value keeps it open so it can be fixed.
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "adjust") {
      const val = parseInt(budgetInput, 10);
      if (isNaN(val) || val <= 0) {
        toast.error("Invalid budget value");
        return;
      }
      setBusy(true);
      try {
        await handleAdjustBudget(
          pendingAction.budget.team_id,
          pendingAction.budget.team?.name || "Team",
          val,
        );
      } finally {
        setBusy(false);
      }
    } else {
      setBusy(true);
      try {
        await handleSeedBudgets();
      } finally {
        setBusy(false);
      }
    }
    setPendingAction(null);
  };

  const transferRows = useMemo<TransferRow[]>(
    () =>
      transfers.map((t) => ({
        id: t.id,
        type: t.type,
        player: t.player?.name || "—",
        from: t.from_team?.name || "—",
        to: t.to_team?.name || (t.type === "LISTING" ? "Open Market" : "—"),
        price: t.asking_price ?? null,
        status: t.status,
      })),
    [transfers],
  );

  const budgetColumns = useMemo<Column<TeamBudgetData>[]>(
    () => [
      {
        header: "Team",
        cell: (b) => (
          <span className="font-bold text-gray-900 dark:text-white">
            {b.team?.name || "Team"}
          </span>
        ),
      },
      {
        header: "Total Budget",
        cell: (b) => (
          <span className="font-mono font-bold">
            {b.total_budget.toLocaleString()} pts
          </span>
        ),
      },
      {
        header: "Spent",
        cell: (b) => (
          <span className="text-sffl-red font-mono font-bold">
            {b.spent.toLocaleString()} pts
          </span>
        ),
      },
      {
        header: "Remaining",
        cell: (b) => (
          <span className="text-green-600 dark:text-green-400 font-mono font-bold">
            {b.remaining.toLocaleString()} pts
          </span>
        ),
      },
      {
        header: "Actions",
        align: "right",
        cell: (b) => (
          <RowActions
            label={`Actions for ${b.team?.name || "team"}`}
            actions={[
              {
                label: "Adjust budget",
                icon: BanknotesIcon,
                onSelect: () => {
                  setBudgetInput(DEFAULT_BUDGET);
                  setPendingAction({ kind: "adjust", budget: b });
                },
              },
            ]}
          />
        ),
      },
    ],
    [],
  );

  const dialog =
    pendingAction?.kind === "adjust"
      ? {
          title: "Adjust this team's budget?",
          description: undefined,
          confirmLabel: "Save Budget",
          tone: "info" as const,
          icon: BanknotesIcon,
          body: (
            <div className="space-y-3">
              <ConfirmSummary
                rows={[
                  ["Team", pendingAction.budget.team?.name || "Team"],
                  [
                    "Current budget",
                    `${pendingAction.budget.total_budget.toLocaleString()} pts`,
                  ],
                  [
                    "Spent",
                    `${pendingAction.budget.spent.toLocaleString()} pts`,
                  ],
                ]}
              />
              <label className="block">
                <span className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                  New total budget (points)
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full min-h-11 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-mono font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sffl-red"
                />
              </label>
            </div>
          ),
        }
      : {
          title: "Reset all team budgets?",
          description: "Every team's total budget is set to 15,000,000 pts.",
          confirmLabel: "Seed Budgets",
          tone: "warning" as const,
          icon: BoltIcon,
          body: null,
        };

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        title="Transfers"
        subtitle="Oversee all team budgets, active listings, and transfer proposals."
        actions={
          <button
            type="button"
            onClick={() => setPendingAction({ kind: "seed" })}
            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0 px-4 py-2.5 min-h-11 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-xl shadow-md transition-colors"
          >
            <BoltIcon className="w-4 h-4" aria-hidden="true" />
            Seed All Budgets (15M)
          </button>
        }
      />

      {/* Team Budgets Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden space-y-4 p-4 sm:p-6">
        <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wider">
          Team Budget Allowances
        </h2>
        <DataTable
          data={budgets}
          columns={budgetColumns}
          searchable={false}
          paginated={false}
          compact
          loading={loading}
          getRowId={(b) => b.id}
          emptyMessage="No team budgets yet."
        />
      </div>

      {/* Transfers Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden space-y-4 p-4 sm:p-6">
        <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wider">
          All Transfer Activity
        </h2>
        <DataTable
          data={transferRows}
          columns={transferColumns}
          searchPlaceholder="Filter by player or team name..."
          compact
          loading={loading}
          getRowId={(t) => t.id}
          emptyMessage="No transfers found."
        />
      </div>

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

export default AdminTransfers;
