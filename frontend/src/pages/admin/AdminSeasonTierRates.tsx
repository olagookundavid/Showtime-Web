import {
  Loader,
  ConfirmDialog,
  ConfirmSummary,
  Button,
  Field,
  IconButton,
  Input,
  Textarea,
  Modal,
  DashboardPageHeader,
} from "../../components";
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  CheckIcon,
  CurrencyDollarIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  listSeasonAdmissionTiers,
  createSeasonAdmissionTier,
  updateSeasonAdmissionTier,
  deleteSeasonAdmissionTier,
} from "../../services/api";
import type { SeasonAdmissionTierResponse } from "../../types";
import { usePermissions } from "../../hooks";
import { getApiErrorMessage } from "../../utils";

type TierPayload = Parameters<typeof updateSeasonAdmissionTier>[1];

type PendingAction =
  | { kind: "toggle"; tier: SeasonAdmissionTierResponse }
  | { kind: "delete"; tier: SeasonAdmissionTierResponse };

const FAILURE: Record<PendingAction["kind"], string> = {
  toggle: "Failed to update tier rate",
  delete: "Failed to delete tier rate",
};

const formatPrice = (price: number) => `₦${price.toLocaleString()}`;

// Same names and per-gameday prices as the ticket tier presets on event days
// (AdminEventDays.tsx) — a season tier's price is the per-gameday rate Game
// Pass bundles multiply, and Checkout matches a season tier to a gameday's
// ticket tier by name, so keeping the presets in step keeps new tiers
// checkout-compatible by default.
const tierPresets = [
  { name: "Free", price: 0, desc: "Complimentary Access" },
  {
    name: "Regular",
    price: 3000,
    desc: "General Admission + Popcorn + Bottled Water",
  },
  {
    name: "VIP",
    price: 30000,
    desc: "Premium Seating + 1 Complimentary Beer, Cocktail or Mocktail + Small Chops & Meal + Priority Parking",
  },
  {
    name: "VIP PLUS",
    price: 50000,
    desc: "Premium Lounge Access + 2 Complimentary Beers or Cocktails + Complimentary Meal & Small Chops + 10% Off All Purchases That Day + Priority Parking",
  },
];

// ─── Shared modal frame ─────────────────────────────────────────────────────

interface ModalFrameProps {
  title: string;
  subtitle: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitDisabled: boolean;
  children: React.ReactNode;
}

const ModalFrame = ({
  title,
  subtitle,
  onClose,
  onSubmit,
  submitDisabled,
  children,
}: ModalFrameProps) => (
  <Modal
    open
    onClose={onClose}
    title={title}
    subtitle={subtitle}
    maxWidth="lg"
    footer={
      <>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="admin-modal-form" disabled={submitDisabled}>
          Save Changes
        </Button>
      </>
    }
  >
    <form id="admin-modal-form" onSubmit={onSubmit} className="space-y-4">
      {children}
    </form>
  </Modal>
);

// ─── Edit Tier Rate Modal ───────────────────────────────────────────────────

interface EditTierRateModalProps {
  tier: SeasonAdmissionTierResponse;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: TierPayload) => void;
}

// Mounted per tier (keyed by id), so the form starts from that record.
const EditTierRateModal = ({
  tier,
  pending,
  onClose,
  onSubmit,
}: EditTierRateModalProps) => {
  const [name, setName] = useState(tier.name || "");
  const [price, setPrice] = useState(String(tier.price ?? ""));
  const [displayOrder, setDisplayOrder] = useState(
    String(tier.display_order ?? 0),
  );
  const [description, setDescription] = useState(tier.description || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Tier name is required");
      return;
    }
    const numPrice = parseInt(price, 10);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error("Valid price (0 or greater) is required");
      return;
    }
    const numOrder = parseInt(displayOrder, 10);
    if (isNaN(numOrder) || numOrder < 1) {
      toast.error("Display order must be 1 or greater");
      return;
    }
    onSubmit({
      name: trimmedName,
      price: numPrice,
      description: description.trim(),
      display_order: numOrder,
    });
  };

  return (
    <ModalFrame
      title="Edit Tier Rate"
      subtitle={tier.name}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={pending || !name.trim() || !price || !displayOrder}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label={
            <>
              Name <span className="text-sffl-red">*</span>
            </>
          }
          htmlFor="edit-tier-rate-name"
        >
          <Input
            id="edit-tier-rate-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Regular"
            required
          />
        </Field>

        <Field
          label={
            <>
              Price (₦) <span className="text-sffl-red">*</span>
            </>
          }
          htmlFor="edit-tier-rate-price"
        >
          <Input
            id="edit-tier-rate-price"
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="2000"
            required
          />
        </Field>
      </div>

      <Field
        label={
          <>
            Display Order <span className="text-sffl-red">*</span>
          </>
        }
        htmlFor="edit-tier-rate-order"
        hint="Controls the order tiers appear in on the Game Pass picker"
      >
        <Input
          id="edit-tier-rate-order"
          type="number"
          min="1"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
        />
      </Field>

      <Field label="Description" htmlFor="edit-tier-rate-description">
        <Textarea
          id="edit-tier-rate-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. General admission, all gamedays"
          rows={3}
        />
      </Field>
    </ModalFrame>
  );
};

export const AdminSeasonTierRates = () => {
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();
  const canManage = canEdit("season_admission_tiers");

  const { data, isLoading: loading } = useQuery({
    queryKey: ["adminSeasonTierRates"],
    queryFn: listSeasonAdmissionTiers,
  });

  const tiers = [...(data ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  );

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTier, setEditingTier] =
    useState<SeasonAdmissionTierResponse | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newOrder, setNewOrder] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const resetCreateForm = () => {
    setNewName("");
    setNewPrice("");
    setNewOrder("");
    setNewDescription("");
  };

  const guardWrite = () => {
    if (!canManage) {
      toast.error(
        "View-only access: your role can view tier rates but not make changes.",
      );
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!guardWrite()) return;
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast.error("Tier name is required");
      return;
    }
    const numPrice = parseInt(newPrice, 10);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error("Valid price (0 or greater) is required");
      return;
    }
    const numOrder = parseInt(newOrder, 10);
    if (isNaN(numOrder) || numOrder < 1) {
      toast.error("Display order must be 1 or greater");
      return;
    }
    setSaving(true);
    try {
      await createSeasonAdmissionTier({
        name: trimmedName,
        price: numPrice,
        description: newDescription.trim() || undefined,
        display_order: numOrder,
      });
      resetCreateForm();
      setShowCreateForm(false);
      toast.success("Tier rate created");
      queryClient.invalidateQueries({ queryKey: ["adminSeasonTierRates"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to create tier rate"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (
    tier: SeasonAdmissionTierResponse,
    payload: TierPayload,
  ) => {
    if (!guardWrite()) return;
    setSaving(true);
    try {
      await updateSeasonAdmissionTier(tier.id, payload);
      setEditingTier(null);
      toast.success("Tier rate updated");
      queryClient.invalidateQueries({ queryKey: ["adminSeasonTierRates"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update tier rate"));
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
          await updateSeasonAdmissionTier(action.tier.id, {
            is_active: !action.tier.is_active,
          });
          toast.success(
            action.tier.is_active
              ? "Tier rate deactivated"
              : "Tier rate activated",
          );
          break;
        case "delete":
          await deleteSeasonAdmissionTier(action.tier.id);
          toast.success("Tier rate deleted");
          break;
      }
      queryClient.invalidateQueries({ queryKey: ["adminSeasonTierRates"] });
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
        const { tier } = pendingAction;
        return {
          title: tier.is_active
            ? "Deactivate this tier rate?"
            : "Activate this tier rate?",
          description: tier.is_active
            ? "It stops appearing as a Game Pass option until reactivated."
            : "It becomes available as a Game Pass option.",
          confirmLabel: tier.is_active ? "Deactivate" : "Activate",
          tone: tier.is_active ? ("warning" as const) : ("info" as const),
          icon: tier.is_active ? EyeSlashIcon : EyeIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Name", tier.name],
                ["Price", formatPrice(tier.price)],
              ]}
            />
          ),
        };
      }
      case "delete": {
        const { tier } = pendingAction;
        return {
          title: "Delete this tier rate?",
          description: "This cannot be undone.",
          confirmLabel: "Delete Tier Rate",
          tone: "danger" as const,
          icon: TrashIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Name", tier.name],
                ["Price", formatPrice(tier.price)],
              ]}
            />
          ),
        };
      }
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Season Tier Rates"
        subtitle="Set season-wide admission tier prices used by Game Pass bundle pricing."
        actions={
          <Button
            icon={showCreateForm ? XMarkIcon : PlusIcon}
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full sm:w-auto"
          >
            {showCreateForm ? "Cancel" : "New Tier Rate"}
          </Button>
        }
      />

      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700 animate-in fade-in duration-200">
          <h2 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">
            New Tier Rate
          </h2>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2 mb-3">
            {tierPresets.map((p) => (
              <Button
                key={p.name}
                variant="secondary"
                size="sm"
                onClick={() => {
                  setNewName(p.name);
                  setNewPrice(String(p.price));
                  setNewDescription(p.desc);
                }}
                className="rounded-full"
              >
                {p.name} (₦{p.price.toLocaleString()})
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Name *" htmlFor="new-tier-rate-name">
              <Input
                id="new-tier-rate-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Regular"
              />
            </Field>
            <Field label="Price (₦) *" htmlFor="new-tier-rate-price">
              <Input
                id="new-tier-rate-price"
                type="number"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="2000"
              />
            </Field>
            <Field label="Display Order *" htmlFor="new-tier-rate-order">
              <Input
                id="new-tier-rate-order"
                type="number"
                min="1"
                value={newOrder}
                onChange={(e) => setNewOrder(e.target.value)}
                placeholder="1"
              />
            </Field>
          </div>
          <Field
            label="Description"
            htmlFor="new-tier-rate-description"
            className="mt-4"
          >
            <Textarea
              id="new-tier-rate-description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g. General admission, all gamedays"
              rows={3}
            />
          </Field>
          <Button
            variant="navy"
            icon={CheckIcon}
            onClick={handleCreate}
            loading={saving}
            disabled={saving || !newName.trim() || !newPrice || !newOrder}
            className="mt-4 w-full sm:w-auto"
          >
            Create Tier Rate
          </Button>
        </div>
      )}

      {loading ? (
        <Loader />
      ) : tiers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 sm:p-12 text-center shadow-lg border border-gray-100 dark:border-gray-700">
          <CurrencyDollarIcon
            className="w-14 h-14 mx-auto mb-4 text-gray-300 dark:text-gray-600"
            aria-hidden="true"
          />
          <p className="text-gray-500 dark:text-gray-400 text-lg font-semibold">
            No tier rates yet
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            Create a tier rate to price Game Pass bundles for the season.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700"
            >
              <div className="p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <h3 className="text-lg font-black text-sffl-navy dark:text-white truncate min-w-0 max-w-full">
                      {tier.name}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        tier.is_active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                      }`}
                    >
                      {tier.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                      Order: {tier.display_order}
                    </span>
                  </div>
                  <p className="text-xl font-black text-sffl-red mt-1.5">
                    {formatPrice(tier.price)}
                  </p>
                  {tier.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {tier.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="secondary"
                    icon={PencilSquareIcon}
                    onClick={() => setEditingTier(tier)}
                    className="flex-1 sm:flex-initial"
                  >
                    Edit
                  </Button>
                  <Button
                    variant={tier.is_active ? "outline" : "success"}
                    icon={tier.is_active ? EyeSlashIcon : EyeIcon}
                    onClick={() => setPendingAction({ kind: "toggle", tier })}
                    className="flex-1 sm:flex-initial"
                  >
                    {tier.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <IconButton
                    icon={TrashIcon}
                    label="Delete tier rate"
                    variant="danger"
                    onClick={() => setPendingAction({ kind: "delete", tier })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingTier && (
        <EditTierRateModal
          tier={editingTier}
          pending={saving}
          onClose={() => setEditingTier(null)}
          onSubmit={(payload) => handleUpdate(editingTier, payload)}
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
