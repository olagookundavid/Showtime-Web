import { Loader, AllocationsManager, ConfirmDialog, ConfirmSummary, Button, Checkbox, Field, IconButton, Input, Modal, DashboardPageHeader } from "../../components";
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  CalendarDaysIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
  LockClosedIcon,
  MapPinIcon,
  PencilSquareIcon,
  PlusIcon,
  TicketIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  listEventDays,
  createEventDay,
  updateEventDay,
  deleteEventDay,
  createTier,
  updateTicketTier,
  deleteTicketTier,
} from "../../services/api";
import type { EventDayResponse, TicketTierResponse } from "../../types";
import { useDebounced, usePermissions } from "../../hooks";
import { getApiErrorMessage } from "../../utils";

type EventDayPayload = Parameters<typeof updateEventDay>[1];
type TierPayload = Parameters<typeof updateTicketTier>[2];

type PendingAction =
  | { kind: "createEventDay" }
  | { kind: "createTier"; eventDay: EventDayResponse }
  | { kind: "toggle"; eventDay: EventDayResponse }
  | { kind: "delete"; eventDay: EventDayResponse }
  | { kind: "deleteTier"; eventDay: EventDayResponse; tier: TicketTierResponse }
  | {
      kind: "updateEventDay";
      eventDay: EventDayResponse;
      payload: EventDayPayload;
    }
  | {
      kind: "updateTier";
      eventDayId: string;
      tier: TicketTierResponse;
      payload: TierPayload;
    };

const FAILURE: Record<PendingAction["kind"], string> = {
  createEventDay: "Failed to create event day",
  createTier: "Failed to create tier",
  toggle: "Failed to update",
  delete: "Failed to delete",
  deleteTier:
    "Failed to delete tier. Ensure no tickets have been sold for this tier.",
  updateEventDay: "Failed to update event day",
  updateTier: "Failed to update ticket tier",
};

const formatDay = (date: string) =>
  new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatCapacity = (capacity?: number) =>
  capacity ? String(capacity) : "Unlimited";

const visibilityLabel = (hidden?: boolean, code?: string) =>
  hidden ? `Hidden (code ${code || "none"})` : "Public";

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

// ─── Edit Event Day Modal ───────────────────────────────────────────────────

interface EditEventDayModalProps {
  eventDay: EventDayResponse;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: EventDayPayload) => void;
}

// Mounted per event day (keyed by id), so the form starts from that record.
const EditEventDayModal = ({
  eventDay,
  pending,
  onClose,
  onSubmit,
}: EditEventDayModalProps) => {
  const [title, setTitle] = useState(eventDay.title || "");
  const [date, setDate] = useState(eventDay.date || "");
  const [venue, setVenue] = useState(eventDay.venue || "");
  const [isActive, setIsActive] = useState(Boolean(eventDay.is_active));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDate = date.trim();
    if (!trimmedTitle) {
      toast.error("Event title is required");
      return;
    }
    if (!trimmedDate) {
      toast.error("Event date is required");
      return;
    }
    onSubmit({
      title: trimmedTitle,
      date: trimmedDate,
      venue: venue.trim() || undefined,
      is_active: isActive,
    });
  };

  return (
    <ModalFrame
      title="Edit Event Day"
      subtitle="Update title, date, venue, or public visibility"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={pending || !title.trim() || !date.trim()}
    >
      <Field
        label={
          <>
            Title <span className="text-sffl-red">*</span>
          </>
        }
        htmlFor="edit-event-title"
      >
        <Input
          id="edit-event-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. SFFL Game Day 5"
          required
        />
      </Field>

      <Field
        label={
          <>
            Date <span className="text-sffl-red">*</span>
          </>
        }
        htmlFor="edit-event-date"
      >
        <Input
          id="edit-event-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </Field>

      <Field label="Venue" htmlFor="edit-event-venue">
        <Input
          id="edit-event-venue"
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="e.g. Showtime Arena"
        />
      </Field>

      <div className="pt-2">
        <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          <Checkbox
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <div className="min-w-0">
            <span className="text-sm font-bold text-gray-900 dark:text-white block">
              Publicly Visible
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              When checked, this event day and its tickets appear on the public
              ticketing page
            </span>
          </div>
        </label>
      </div>
    </ModalFrame>
  );
};

// ─── Edit Ticket Tier Modal ─────────────────────────────────────────────────

interface EditTierModalProps {
  tier: TicketTierResponse;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: TierPayload) => void;
}

// Mounted per tier (keyed by id), so the form starts from that record.
const EditTierModal = ({
  tier,
  pending,
  onClose,
  onSubmit,
}: EditTierModalProps) => {
  const [name, setName] = useState(tier.name || "");
  const [price, setPrice] = useState(String(tier.price ?? ""));
  const [capacity, setCapacity] = useState(String(tier.capacity ?? "0"));
  const [description, setDescription] = useState(tier.description || "");
  const [isHidden, setIsHidden] = useState(Boolean(tier.is_hidden));
  const [accessCode, setAccessCode] = useState(tier.access_code || "");

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

    const numCapacity = capacity ? parseInt(capacity, 10) : 0;
    if (isNaN(numCapacity) || numCapacity < 0) {
      toast.error("Capacity must be 0 (unlimited) or greater");
      return;
    }

    if (numCapacity > 0 && numCapacity < tier.sold_count) {
      toast.error(
        `Capacity cannot be less than tickets already sold (${tier.sold_count})`,
      );
      return;
    }

    if (isHidden && !accessCode.trim()) {
      toast.error("Access code is required for hidden tiers");
      return;
    }

    onSubmit({
      name: trimmedName,
      price: numPrice,
      capacity: numCapacity,
      description: description.trim() || undefined,
      is_hidden: isHidden,
      access_code: isHidden ? accessCode.trim().toUpperCase() : "",
    });
  };

  return (
    <ModalFrame
      title="Edit Ticket Tier"
      subtitle={`${tier.name} · ${tier.sold_count} sold`}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={pending || !name.trim() || !price}
    >
      {tier.sold_count > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-3 rounded-xl text-xs flex items-start gap-2">
          <InformationCircleIcon
            className="w-4 h-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            <strong>{tier.sold_count}</strong> ticket(s) already sold. Price
            modifications will apply to future sales only.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label={
            <>
              Tier Name <span className="text-sffl-red">*</span>
            </>
          }
          htmlFor="edit-tier-name"
        >
          <Input
            id="edit-tier-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. VIP"
            required
          />
        </Field>

        <Field
          label={
            <>
              Price (₦) <span className="text-sffl-red">*</span>
            </>
          }
          htmlFor="edit-tier-price"
        >
          <Input
            id="edit-tier-price"
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="5000"
            required
          />
        </Field>
      </div>

      <Field
        label="Capacity (0 = Unlimited)"
        htmlFor="edit-tier-capacity"
        hint={
          tier.sold_count > 0 ? `Min allowed: ${tier.sold_count}` : undefined
        }
      >
        <Input
          id="edit-tier-capacity"
          type="number"
          min={tier.sold_count > 0 ? tier.sold_count : 0}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="0 for unlimited"
        />
      </Field>

      <Field label="Description" htmlFor="edit-tier-description">
        <Input
          id="edit-tier-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. VIP seating + refreshments"
        />
      </Field>

      <div className="pt-2 space-y-3">
        <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          <Checkbox
            checked={isHidden}
            onChange={(e) => setIsHidden(e.target.checked)}
          />
          <div className="min-w-0">
            <span className="text-sm font-bold text-gray-900 dark:text-white block">
              Hidden Tier (Requires Access Code)
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Tier is only visible on public site when visitors provide the
              access code
            </span>
          </div>
        </label>

        {isHidden && (
          <div className="animate-in fade-in duration-150">
            <Field
              label={
                <>
                  Access Code <span className="text-sffl-red">*</span>
                </>
              }
              htmlFor="edit-tier-access-code"
            >
              <Input
                id="edit-tier-access-code"
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="e.g. SFFLVIP"
                required={isHidden}
                className="font-mono uppercase"
              />
            </Field>
          </div>
        )}
      </div>
    </ModalFrame>
  );
};

export const AdminEventDays = () => {
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();
  const canManage = canEdit("event_days");

  // This list grows by a match day forever, so it is paged and searched on
  // the server rather than fetched whole and filtered here.
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["adminEventDaysList", search, page],
    queryFn: () => listEventDays({ search, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  const eventDays: EventDayResponse[] = data?.data ?? [];
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [addTierFor, setAddTierFor] = useState<string | null>(null);
  const [manageAllocationsFor, setManageAllocationsFor] = useState<
    string | null
  >(null);

  // Edit modal states
  const [editingEventDay, setEditingEventDay] =
    useState<EventDayResponse | null>(null);
  const [editingTier, setEditingTier] = useState<{
    eventDayId: string;
    tier: TicketTierResponse;
  } | null>(null);

  // Every write waits here for the confirm dialog
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  // Create Event Day form
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newVenue, setNewVenue] = useState("");

  // Create Tier form
  const [tierName, setTierName] = useState("");
  const [tierPrice, setTierPrice] = useState("");
  const [tierCapacity, setTierCapacity] = useState("");
  const [tierDesc, setTierDesc] = useState("");
  const [isHidden, setIsHidden] = useState(false);
  const [accessCode, setAccessCode] = useState("");

  const resetTierForm = () => {
    setTierName("");
    setTierPrice("");
    setTierCapacity("");
    setTierDesc("");
    setIsHidden(false);
    setAccessCode("");
  };

  const requestCreateEventDay = () => {
    if (!newTitle.trim() || !newDate) return;
    setPendingAction({ kind: "createEventDay" });
  };

  const requestCreateTier = (eventDay: EventDayResponse) => {
    if (!tierName.trim() || !tierPrice) return;
    const price = parseInt(tierPrice, 10);
    if (isNaN(price) || price < 0) {
      toast.error("Valid price (0 or greater) is required");
      return;
    }
    if (
      tierCapacity &&
      (isNaN(parseInt(tierCapacity, 10)) || parseInt(tierCapacity, 10) < 0)
    ) {
      toast.error("Capacity must be 0 (unlimited) or greater");
      return;
    }
    if (isHidden && !accessCode.trim()) {
      toast.error("Access code is required for hidden tiers");
      return;
    }
    setPendingAction({ kind: "createTier", eventDay });
  };

  const confirmPendingAction = async () => {
    const action = pendingAction;
    if (!action) return;
    if (!canManage) {
      toast.error(
        "View-only access: your role can view Event Days but not make changes.",
      );
      setPendingAction(null);
      return;
    }
    setBusy(true);
    try {
      switch (action.kind) {
        case "createEventDay":
          await createEventDay({
            title: newTitle.trim(),
            date: newDate,
            venue: newVenue.trim() || undefined,
          });
          setNewTitle("");
          setNewDate("");
          setNewVenue("");
          setShowCreateForm(false);
          toast.success("Event day created successfully");
          break;
        case "createTier":
          await createTier(action.eventDay.id, {
            name: tierName.trim(),
            price: parseInt(tierPrice, 10),
            capacity: tierCapacity ? parseInt(tierCapacity, 10) : undefined,
            description: tierDesc || undefined,
            is_hidden: isHidden,
            access_code: isHidden ? accessCode.trim().toUpperCase() : undefined,
          });
          resetTierForm();
          setAddTierFor(null);
          toast.success("Tier created successfully");
          break;
        case "toggle":
          await updateEventDay(action.eventDay.id, {
            is_active: !action.eventDay.is_active,
          });
          toast.success(
            action.eventDay.is_active
              ? "Event day hidden from public site"
              : "Event day visible on public site",
          );
          break;
        case "delete":
          await deleteEventDay(action.eventDay.id);
          toast.success("Event day deleted");
          break;
        case "deleteTier":
          await deleteTicketTier(action.eventDay.id, action.tier.id);
          toast.success("Tier deleted");
          break;
        case "updateEventDay":
          await updateEventDay(action.eventDay.id, action.payload);
          setEditingEventDay(null);
          toast.success("Event day updated successfully");
          break;
        case "updateTier":
          await updateTicketTier(
            action.eventDayId,
            action.tier.id,
            action.payload,
          );
          setEditingTier(null);
          toast.success("Ticket tier updated successfully");
          break;
      }
      queryClient.invalidateQueries({ queryKey: ["adminEventDaysList"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, FAILURE[action.kind]));
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  };

  const dialog = (() => {
    switch (pendingAction?.kind) {
      case "createTier": {
        const { eventDay } = pendingAction;
        return {
          title: "Add this ticket tier?",
          description: undefined,
          confirmLabel: "Add Tier",
          tone: "info" as const,
          icon: TicketIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Event", eventDay.title],
                ["Tier", tierName.trim()],
                [
                  "Price",
                  `₦${(parseInt(tierPrice, 10) || 0).toLocaleString()}`,
                ],
                ["Capacity", formatCapacity(parseInt(tierCapacity, 10) || 0)],
                [
                  "Visibility",
                  visibilityLabel(isHidden, accessCode.trim().toUpperCase()),
                ],
              ]}
            />
          ),
        };
      }
      case "toggle": {
        const { eventDay } = pendingAction;
        return {
          title: eventDay.is_active
            ? "Hide this event day?"
            : "Make this event day visible?",
          description: eventDay.is_active
            ? "It and its tickets disappear from the public ticketing page."
            : "It and its tickets appear on the public ticketing page.",
          confirmLabel: eventDay.is_active ? "Hide Event Day" : "Make Visible",
          tone: "info" as const,
          icon: eventDay.is_active ? EyeSlashIcon : EyeIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Event", eventDay.title],
                ["Date", formatDay(eventDay.date)],
              ]}
            />
          ),
        };
      }
      case "delete": {
        const { eventDay } = pendingAction;
        return {
          title: "Delete this event day?",
          description:
            "This deletes the event day and all its tiers. It cannot be undone.",
          confirmLabel: "Delete Event Day",
          tone: "warning" as const,
          icon: TrashIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Event", eventDay.title],
                ["Date", formatDay(eventDay.date)],
                ["Tiers", String(eventDay.tiers?.length ?? 0)],
              ]}
            />
          ),
        };
      }
      case "deleteTier": {
        const { eventDay, tier } = pendingAction;
        return {
          title: "Delete this ticket tier?",
          description: "This only works if no tickets have been sold for it.",
          confirmLabel: "Delete Tier",
          tone: "warning" as const,
          icon: TrashIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Event", eventDay.title],
                ["Tier", tier.name],
                ["Sold", String(tier.sold_count)],
              ]}
            />
          ),
        };
      }
      case "updateEventDay": {
        const { payload } = pendingAction;
        return {
          title: "Save changes to this event day?",
          description: undefined,
          confirmLabel: "Save Changes",
          tone: "info" as const,
          icon: PencilSquareIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Title", payload.title],
                ["Date", payload.date ? formatDay(payload.date) : undefined],
                ["Venue", payload.venue],
                ["Visibility", payload.is_active ? "Public" : "Hidden"],
              ]}
            />
          ),
        };
      }
      case "updateTier": {
        const { payload } = pendingAction;
        return {
          title: "Save changes to this tier?",
          description: undefined,
          confirmLabel: "Save Changes",
          tone: "info" as const,
          icon: PencilSquareIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Tier", payload.name],
                ["Price", `₦${(payload.price ?? 0).toLocaleString()}`],
                ["Capacity", formatCapacity(payload.capacity)],
                [
                  "Visibility",
                  visibilityLabel(payload.is_hidden, payload.access_code),
                ],
              ]}
            />
          ),
        };
      }
      default:
        return {
          title: "Create this event day?",
          description: undefined,
          confirmLabel: "Create Event Day",
          tone: "info" as const,
          icon: CalendarDaysIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Title", newTitle.trim()],
                ["Date", newDate ? formatDay(newDate) : undefined],
                ["Venue", newVenue.trim()],
              ]}
            />
          ),
        };
    }
  })();

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

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Event Days"
        subtitle="Manage event dates, venues, ticket tiers, and allocations."
        actions={
          <Button
            icon={showCreateForm ? XMarkIcon : PlusIcon}
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full sm:w-auto"
          >
            {showCreateForm ? "Cancel" : "New Event Day"}
          </Button>
        }
      />

      {/* Create Event Day Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700 animate-in fade-in duration-200">
          <h2 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">
            Create New Event Day
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Title *" htmlFor="new-event-title">
              <Input
                id="new-event-title"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. SFFL Game Day 5"
              />
            </Field>
            <Field label="Date *" htmlFor="new-event-date">
              <Input
                id="new-event-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </Field>
            <Field label="Venue" htmlFor="new-event-venue">
              <Input
                id="new-event-venue"
                type="text"
                value={newVenue}
                onChange={(e) => setNewVenue(e.target.value)}
                placeholder="e.g. Showtime Arena"
              />
            </Field>
          </div>
          <Button
            variant="navy"
            icon={CheckIcon}
            onClick={requestCreateEventDay}
            disabled={busy || !newTitle.trim() || !newDate}
            className="mt-4 w-full sm:w-auto"
          >
            Create Event Day
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search event days by title or date"
          aria-label="Search event days"
          className="w-full sm:max-w-md"
        />
        {data && (
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            {data.total} event day{data.total === 1 ? "" : "s"}
            {search ? ` matching "${search}"` : ""}
          </p>
        )}
      </div>

      {/* Event Days List */}
      {loading ? (
        <Loader />
      ) : eventDays.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 sm:p-12 text-center shadow-lg border border-gray-100 dark:border-gray-700">
          <CalendarDaysIcon
            className="w-14 h-14 mx-auto mb-4 text-gray-300 dark:text-gray-600"
            aria-hidden="true"
          />
          <p className="text-gray-500 dark:text-gray-400 text-lg font-semibold">
            {search ? "No event days match that search" : "No event days yet"}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            {search
              ? "Try a different title or date."
              : "Create your first event day to start selling tickets"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {eventDays.map((ed) => {
            const isPast = new Date(ed.date + "T23:59:59") < new Date();
            return (
              <div
                key={ed.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border ${isPast ? "border-gray-300 dark:border-gray-600" : "border-gray-100 dark:border-gray-700"}`}
              >
                {/* Header */}
                <div className="bg-sffl-navy text-white p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <h3 className="text-lg md:text-xl font-black truncate min-w-0 max-w-full">
                        {ed.title}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ed.is_active ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"}`}
                      >
                        {ed.is_active ? "Visible" : "Hidden"}
                      </span>
                      {isPast && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-500/30 text-gray-300 border border-gray-500/30">
                          Past
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 mt-1.5">
                      <p className="text-[11px] md:text-sm text-gray-300 font-medium flex items-center gap-1.5">
                        <CalendarDaysIcon
                          className="w-4 h-4 shrink-0 opacity-70"
                          aria-hidden="true"
                        />
                        {formatDay(ed.date)}
                      </p>
                      {ed.venue && (
                        <p className="text-[11px] md:text-sm text-gray-300 font-medium flex items-center gap-1.5 min-w-0">
                          <MapPinIcon
                            className="w-4 h-4 shrink-0 opacity-70"
                            aria-hidden="true"
                          />
                          <span className="truncate">{ed.venue}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="secondary"
                      icon={PencilSquareIcon}
                      onClick={() => setEditingEventDay(ed)}
                    >
                      Edit
                    </Button>

                    <Button
                      variant={ed.is_active ? "success" : "secondary"}
                      icon={ed.is_active ? EyeIcon : EyeSlashIcon}
                      onClick={() =>
                        setPendingAction({ kind: "toggle", eventDay: ed })
                      }
                      title={
                        ed.is_active
                          ? "Visible on Public Site"
                          : "Hidden from Public Site"
                      }
                    >
                      {ed.is_active ? "Visible" : "Hidden"}
                    </Button>

                    <Button
                      variant={addTierFor === ed.id ? "primary" : "secondary"}
                      icon={addTierFor === ed.id ? XMarkIcon : PlusIcon}
                      onClick={() => {
                        setAddTierFor(addTierFor === ed.id ? null : ed.id);
                        setManageAllocationsFor(null);
                      }}
                    >
                      {addTierFor === ed.id ? "Cancel tier" : "Add tier"}
                    </Button>

                    <Button
                      variant={
                        manageAllocationsFor === ed.id ? "primary" : "secondary"
                      }
                      onClick={() => {
                        setManageAllocationsFor(
                          manageAllocationsFor === ed.id ? null : ed.id,
                        );
                        setAddTierFor(null);
                      }}
                    >
                      Allocations
                    </Button>

                    {isPast && (
                      <Button
                        variant="danger"
                        icon={TrashIcon}
                        onClick={() =>
                          setPendingAction({ kind: "delete", eventDay: ed })
                        }
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tiers */}
                <div className="p-4 sm:p-5">
                  {ed.tiers && ed.tiers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {ed.tiers.map((tier: TicketTierResponse) => (
                        <div
                          key={tier.id}
                          className="bg-gray-50 dark:bg-gray-700/80 rounded-xl p-4 border border-gray-200 dark:border-gray-600 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <span className="font-bold text-sffl-navy dark:text-white block truncate">
                                  {tier.name}
                                </span>
                                <p className="text-xl font-black text-sffl-red mt-1">
                                  ₦{tier.price.toLocaleString()}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                                  {tier.capacity > 0 ? (
                                    <>
                                      <p>
                                        {tier.sold_count} / {tier.capacity} sold
                                      </p>
                                      <p className="font-bold text-gray-700 dark:text-gray-200">
                                        {tier.available} left
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p>{tier.sold_count} sold</p>
                                      <p className="font-bold text-gray-700 dark:text-gray-200">
                                        Unlimited
                                      </p>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <IconButton
                                    icon={PencilSquareIcon}
                                    label={`Edit tier ${tier.name}`}
                                    onClick={() =>
                                      setEditingTier({
                                        eventDayId: ed.id,
                                        tier,
                                      })
                                    }
                                  />
                                  <IconButton
                                    icon={TrashIcon}
                                    variant="danger"
                                    label={`Delete tier ${tier.name}`}
                                    onClick={() =>
                                      setPendingAction({
                                        kind: "deleteTier",
                                        eventDay: ed,
                                        tier,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            </div>

                            {tier.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                                {tier.description}
                              </p>
                            )}
                          </div>

                          {tier.is_hidden && (
                            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600/60">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                <LockClosedIcon
                                  className="w-3 h-3"
                                  aria-hidden="true"
                                />
                                Code: {tier.access_code || "None"}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
                      No tiers yet — add one to start selling tickets
                    </p>
                  )}

                  {/* Add Tier Form (inline) */}
                  {addTierFor === ed.id && (
                    <div className="mt-4 p-4 sm:p-5 bg-gray-50 dark:bg-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-600 animate-in fade-in duration-200">
                      <h4 className="font-bold text-sffl-navy dark:text-white mb-3 wrap-break-word">
                        Add Ticket Tier to {ed.title}
                      </h4>

                      {/* Quick presets */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {tierPresets.map((p) => (
                          <Button
                            key={p.name}
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setTierName(p.name);
                              setTierPrice(String(p.price));
                              setTierDesc(p.desc);
                            }}
                            className="rounded-full"
                          >
                            {p.name} (₦{p.price.toLocaleString()})
                          </Button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <Input
                          type="text"
                          value={tierName}
                          onChange={(e) => setTierName(e.target.value)}
                          placeholder="Tier name *"
                          aria-label="Tier name"
                        />
                        <Input
                          type="number"
                          value={tierPrice}
                          onChange={(e) => setTierPrice(e.target.value)}
                          placeholder="Price (₦) *"
                          aria-label="Price"
                        />
                        <Input
                          type="number"
                          value={tierCapacity}
                          onChange={(e) => setTierCapacity(e.target.value)}
                          placeholder="Capacity (0=unlimited)"
                          aria-label="Capacity"
                        />
                        <Input
                          type="text"
                          value={tierDesc}
                          onChange={(e) => setTierDesc(e.target.value)}
                          placeholder="Description"
                          aria-label="Description"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mt-3">
                        <Checkbox
                          label="Hidden Tier? (Requires Code)"
                          checked={isHidden}
                          onChange={(e) => setIsHidden(e.target.checked)}
                        />
                        {isHidden && (
                          <Input
                            type="text"
                            value={accessCode}
                            onChange={(e) =>
                              setAccessCode(e.target.value.toUpperCase())
                            }
                            placeholder="Access Code (e.g. SFFLFREE)"
                            aria-label="Access code"
                            className="sm:w-64 font-mono uppercase"
                          />
                        )}
                      </div>
                      <div className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setAddTierFor(null);
                            resetTierForm();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="navy"
                          icon={CheckIcon}
                          onClick={() => requestCreateTier(ed)}
                          disabled={busy || !tierName.trim() || !tierPrice}
                        >
                          Add Tier
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Allocations Manager */}
                  {manageAllocationsFor === ed.id && (
                    <div className="mt-4 animate-in fade-in duration-200">
                      <AllocationsManager
                        eventDayId={ed.id}
                        eventDayTitle={ed.title}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && data.total_pages > 1 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Page {data.page || page} of {data.total_pages} · {data.total} total
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
              disabled={page >= data.total_pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Edit Event Day Modal */}
      {editingEventDay && (
        <EditEventDayModal
          key={editingEventDay.id}
          eventDay={editingEventDay}
          pending={busy}
          onClose={() => setEditingEventDay(null)}
          onSubmit={(payload) =>
            setPendingAction({
              kind: "updateEventDay",
              eventDay: editingEventDay,
              payload,
            })
          }
        />
      )}

      {/* Edit Ticket Tier Modal */}
      {editingTier && (
        <EditTierModal
          key={editingTier.tier.id}
          tier={editingTier.tier}
          pending={busy}
          onClose={() => setEditingTier(null)}
          onSubmit={(payload) =>
            setPendingAction({
              kind: "updateTier",
              eventDayId: editingTier.eventDayId,
              tier: editingTier.tier,
              payload,
            })
          }
        />
      )}

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
