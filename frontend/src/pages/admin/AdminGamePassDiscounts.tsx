import {
  ConfirmDialog,
  ConfirmSummary,
  DataTable,
  type Column,
  RowActions,
  type RowAction,
  DashboardPageHeader,
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
} from "../../components";
import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  EyeIcon,
  EyeSlashIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  listGamePassDiscountBands,
  createGamePassDiscountBand,
  updateGamePassDiscountBand,
  deleteGamePassDiscountBand,
} from "../../services/api";
import type {
  GamePassDiscountBandResponse,
  CreateGamePassDiscountBandPayload,
} from "../../types";
import { usePermissions } from "../../hooks";
import { getApiErrorMessage } from "../../utils";

// A stable empty list, so the table isn't handed a fresh array on every render.
const NO_BANDS: GamePassDiscountBandResponse[] = [];

type PendingAction =
  | { kind: "toggle"; band: GamePassDiscountBandResponse }
  | { kind: "delete"; band: GamePassDiscountBandResponse };

const FAILURE: Record<PendingAction["kind"], string> = {
  toggle: "Failed to update discount band",
  delete: "Failed to delete discount band",
};

const rangeLabel = (band: GamePassDiscountBandResponse) =>
  band.max_gamedays == null
    ? `${band.min_gamedays}+ gamedays`
    : `${band.min_gamedays}–${band.max_gamedays} gamedays`;

// ─── Create / Edit Band Modal ───────────────────────────────────────────────

interface BandFormModalProps {
  initial: GamePassDiscountBandResponse | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateGamePassDiscountBandPayload) => void;
}

// Mounted fresh for "new" or keyed by the band's id, so the form always
// starts from the right state.
const BandFormModal = ({
  initial,
  pending,
  onClose,
  onSubmit,
}: BandFormModalProps) => {
  const [minGamedays, setMinGamedays] = useState(
    String(initial?.min_gamedays ?? ""),
  );
  const [openEnded, setOpenEnded] = useState(initial?.max_gamedays == null);
  const [maxGamedays, setMaxGamedays] = useState(
    initial?.max_gamedays != null ? String(initial.max_gamedays) : "",
  );
  const [discountPercent, setDiscountPercent] = useState(
    String(initial?.discount_percent ?? ""),
  );
  const [displayOrder, setDisplayOrder] = useState(
    initial ? String(initial.display_order) : "",
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const min = parseInt(minGamedays, 10);
    if (isNaN(min) || min < 1) {
      toast.error("Minimum gamedays must be 1 or greater");
      return;
    }
    let max: number | null = null;
    if (!openEnded) {
      max = parseInt(maxGamedays, 10);
      if (isNaN(max) || max < min) {
        toast.error(
          "Maximum gamedays is required and must be at least the minimum",
        );
        return;
      }
    }
    const discount = parseInt(discountPercent, 10);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      toast.error("Discount must be between 0 and 100");
      return;
    }
    const order = parseInt(displayOrder, 10);
    if (isNaN(order) || order < 1) {
      toast.error("Display order must be 1 or greater");
      return;
    }
    onSubmit({
      min_gamedays: min,
      max_gamedays: max,
      discount_percent: discount,
      display_order: order,
      is_active: isActive,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Edit Discount Band" : "New Discount Band"}
      subtitle={initial ? rangeLabel(initial) : undefined}
      maxWidth="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="game-pass-band-form"
            disabled={pending || !minGamedays || !discountPercent || !displayOrder}
          >
            Save Changes
          </Button>
        </>
      }
    >
      <form
        id="game-pass-band-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label={
              <>
                Min Gamedays <span className="text-sffl-red">*</span>
              </>
            }
            htmlFor="band-min-gamedays"
          >
            <Input
              id="band-min-gamedays"
              type="number"
              min="1"
              value={minGamedays}
              onChange={(e) => setMinGamedays(e.target.value)}
              placeholder="2"
              required
            />
          </Field>

          <Field
            label={
              <>
                Discount % <span className="text-sffl-red">*</span>
              </>
            }
            htmlFor="band-discount-percent"
          >
            <Input
              id="band-discount-percent"
              type="number"
              min="0"
              max="100"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="5"
              required
            />
          </Field>
        </div>

        <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          <Checkbox
            checked={openEnded}
            onChange={(e) => setOpenEnded(e.target.checked)}
          />
          <div className="min-w-0">
            <span className="text-sm font-bold text-gray-900 dark:text-white block">
              Open-ended (top band)
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              No maximum — this band applies to every gameday count above the
              minimum
            </span>
          </div>
        </label>

        {!openEnded && (
          <Field
            label={
              <>
                Max Gamedays <span className="text-sffl-red">*</span>
              </>
            }
            htmlFor="band-max-gamedays"
          >
            <Input
              id="band-max-gamedays"
              type="number"
              min={minGamedays || "1"}
              value={maxGamedays}
              onChange={(e) => setMaxGamedays(e.target.value)}
              placeholder="3"
              required
            />
          </Field>
        )}

        <Field
          label={
            <>
              Display Order <span className="text-sffl-red">*</span>
            </>
          }
          htmlFor="band-display-order"
          hint="Controls the order bands are evaluated/shown in"
        >
          <Input
            id="band-display-order"
            type="number"
            min="1"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            placeholder="1"
          />
        </Field>

        <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          <Checkbox
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <div className="min-w-0">
            <span className="text-sm font-bold text-gray-900 dark:text-white block">
              Active
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              When checked, this band is used when pricing Game Pass bundles
            </span>
          </div>
        </label>
      </form>
    </Modal>
  );
};

// Defined at module level so it keeps its identity between renders.
const BandActions = ({
  band,
  onEdit,
  onToggle,
  onDelete,
}: {
  band: GamePassDiscountBandResponse;
  onEdit: (band: GamePassDiscountBandResponse) => void;
  onToggle: (band: GamePassDiscountBandResponse) => void;
  onDelete: (band: GamePassDiscountBandResponse) => void;
}) => {
  const actions: RowAction[] = [
    {
      label: "Edit",
      icon: PencilSquareIcon,
      onSelect: () => onEdit(band),
    },
    {
      label: band.is_active ? "Deactivate" : "Activate",
      icon: band.is_active ? EyeSlashIcon : EyeIcon,
      onSelect: () => onToggle(band),
    },
    {
      label: "Delete",
      icon: TrashIcon,
      danger: true,
      onSelect: () => onDelete(band),
    },
  ];

  return (
    <RowActions label={`Actions for ${rangeLabel(band)}`} actions={actions} />
  );
};

export const AdminGamePassDiscounts = () => {
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();
  const canManage = canEdit("game_pass_discounts");

  const { data, isLoading: loading } = useQuery({
    queryKey: ["adminGamePassDiscountBands"],
    queryFn: listGamePassDiscountBands,
  });

  const bands = useMemo(
    () => [...(data ?? NO_BANDS)].sort((a, b) => a.display_order - b.display_order),
    [data],
  );

  const [creating, setCreating] = useState(false);
  const [editingBand, setEditingBand] =
    useState<GamePassDiscountBandResponse | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const guardWrite = () => {
    if (!canManage) {
      toast.error(
        "View-only access: your role can view discount bands but not make changes.",
      );
      return false;
    }
    return true;
  };

  const handleCreate = async (payload: CreateGamePassDiscountBandPayload) => {
    if (!guardWrite()) return;
    setSaving(true);
    try {
      await createGamePassDiscountBand(payload);
      setCreating(false);
      toast.success("Discount band created");
      queryClient.invalidateQueries({ queryKey: ["adminGamePassDiscountBands"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to create discount band"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (
    band: GamePassDiscountBandResponse,
    payload: CreateGamePassDiscountBandPayload,
  ) => {
    if (!guardWrite()) return;
    setSaving(true);
    try {
      await updateGamePassDiscountBand(band.id, payload);
      setEditingBand(null);
      toast.success("Discount band updated");
      queryClient.invalidateQueries({ queryKey: ["adminGamePassDiscountBands"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update discount band"));
    } finally {
      setSaving(false);
    }
  };

  const confirmPendingAction = async () => {
    const action = pendingAction;
    if (!action) return;
    if (!guardWrite()) {
      setPendingAction(null);
      return;
    }
    setBusy(true);
    try {
      switch (action.kind) {
        case "toggle":
          await updateGamePassDiscountBand(action.band.id, {
            is_active: !action.band.is_active,
          });
          toast.success(
            action.band.is_active
              ? "Discount band deactivated"
              : "Discount band activated",
          );
          break;
        case "delete":
          await deleteGamePassDiscountBand(action.band.id);
          toast.success("Discount band deleted");
          break;
      }
      queryClient.invalidateQueries({ queryKey: ["adminGamePassDiscountBands"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, FAILURE[action.kind]));
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  };

  const dialog = (() => {
    switch (pendingAction?.kind) {
      case "toggle": {
        const { band } = pendingAction;
        return {
          title: band.is_active
            ? "Deactivate this discount band?"
            : "Activate this discount band?",
          description: band.is_active
            ? "It stops being applied to Game Pass bundle pricing until reactivated."
            : "It becomes available for Game Pass bundle pricing.",
          confirmLabel: band.is_active ? "Deactivate" : "Activate",
          tone: band.is_active ? ("warning" as const) : ("info" as const),
          icon: band.is_active ? EyeSlashIcon : EyeIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Range", rangeLabel(band)],
                ["Discount", `${band.discount_percent}%`],
              ]}
            />
          ),
        };
      }
      case "delete": {
        const { band } = pendingAction;
        return {
          title: "Delete this discount band?",
          description: "This cannot be undone.",
          confirmLabel: "Delete Band",
          tone: "danger" as const,
          icon: TrashIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Range", rangeLabel(band)],
                ["Discount", `${band.discount_percent}%`],
              ]}
            />
          ),
        };
      }
      default:
        return null;
    }
  })();

  const columns = useMemo<Column<GamePassDiscountBandResponse>[]>(
    () => [
      {
        header: "Gameday Range",
        cell: (band) => (
          <span className="font-bold text-sffl-navy dark:text-white">
            {rangeLabel(band)}
          </span>
        ),
      },
      {
        header: "Discount",
        align: "center",
        cell: (band) => `${band.discount_percent}%`,
      },
      { header: "Order", align: "center", cell: (band) => band.display_order },
      {
        header: "Status",
        align: "center",
        cell: (band) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-bold ${
              band.is_active
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}
          >
            {band.is_active ? "Active" : "Inactive"}
          </span>
        ),
      },
      {
        header: "Actions",
        align: "right",
        cell: (band) => (
          <BandActions
            band={band}
            onEdit={setEditingBand}
            onToggle={(b) => setPendingAction({ kind: "toggle", band: b })}
            onDelete={(b) => setPendingAction({ kind: "delete", band: b })}
          />
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Game Pass Discounts"
        subtitle="Configure the bundle discount bands used to price Game Pass purchases."
        actions={
          <Button
            icon={PlusIcon}
            onClick={() => setCreating(true)}
            className="w-full sm:w-auto"
          >
            New Discount Band
          </Button>
        }
      />

      <DataTable
        data={bands}
        columns={columns}
        searchable={false}
        paginated={false}
        loading={loading}
        getRowId={(band) => band.id}
        emptyMessage="No discount bands yet"
      />

      {creating && (
        <BandFormModal
          initial={null}
          pending={saving}
          onClose={() => setCreating(false)}
          onSubmit={handleCreate}
        />
      )}

      {editingBand && (
        <BandFormModal
          key={editingBand.id}
          initial={editingBand}
          pending={saving}
          onClose={() => setEditingBand(null)}
          onSubmit={(payload) => handleUpdate(editingBand, payload)}
        />
      )}

      {dialog && (
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
      )}
    </div>
  );
};
