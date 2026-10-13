import { Loader, AllocationsManager, ButtonLink, ConfirmDialog, ConfirmSummary, Button, Checkbox, Field, Input, Modal, DashboardPageHeader } from "../../components";
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  CalendarDaysIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
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
  adminListTicketProducts,
} from "../../services/api";
import type { EventDayResponse, TicketProductDayResponse, TicketProductResponse } from "../../types";
import { useDebounced, usePermissions } from "../../hooks";
import { getApiErrorMessage } from "../../utils";

type EventDayPayload = Parameters<typeof updateEventDay>[1];

type PendingAction =
  | { kind: "createEventDay" }
  | { kind: "toggle"; eventDay: EventDayResponse }
  | { kind: "delete"; eventDay: EventDayResponse }
  | {
      kind: "updateEventDay";
      eventDay: EventDayResponse;
      payload: EventDayPayload;
    };

const FAILURE: Record<PendingAction["kind"], string> = {
  createEventDay: "Failed to create match day",
  toggle: "Failed to update",
  delete: "Failed to delete",
  updateEventDay: "Failed to update match day",
};

const formatDay = (date: string) =>
  new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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
      toast.error("Match day title is required");
      return;
    }
    if (!trimmedDate) {
      toast.error("Match day date is required");
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
      title="Edit Match Day"
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
              When checked, tickets for this match day appear on the public
              ticketing page
            </span>
          </div>
        </label>
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

  // Which tickets are on sale on each match day, for the read-only summary.
  const { data: products } = useQuery({
    queryKey: ["adminTicketProducts"],
    queryFn: adminListTicketProducts,
  });
  const productsByDay = useMemo(() => {
    const map = new Map<string, { product: TicketProductResponse; day: TicketProductDayResponse }[]>();
    for (const product of products ?? []) {
      for (const day of product.days) {
        const list = map.get(day.event_day_id) ?? [];
        list.push({ product, day });
        map.set(day.event_day_id, list);
      }
    }
    return map;
  }, [products]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [manageAllocationsFor, setManageAllocationsFor] = useState<
    string | null
  >(null);

  // Edit modal states
  const [editingEventDay, setEditingEventDay] =
    useState<EventDayResponse | null>(null);

  // Every write waits here for the confirm dialog
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  // Create Event Day form
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newVenue, setNewVenue] = useState("");

  const requestCreateEventDay = () => {
    if (!newTitle.trim() || !newDate) return;
    setPendingAction({ kind: "createEventDay" });
  };

  const confirmPendingAction = async () => {
    const action = pendingAction;
    if (!action) return;
    if (!canManage) {
      toast.error(
        "View-only access: your role can view Match Days but not make changes.",
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
          toast.success("Match day created successfully");
          break;
        case "toggle":
          await updateEventDay(action.eventDay.id, {
            is_active: !action.eventDay.is_active,
          });
          toast.success(
            action.eventDay.is_active
              ? "Match day hidden from public site"
              : "Match day visible on public site",
          );
          break;
        case "delete":
          await deleteEventDay(action.eventDay.id);
          toast.success("Match day deleted");
          break;
        case "updateEventDay":
          await updateEventDay(action.eventDay.id, action.payload);
          setEditingEventDay(null);
          toast.success("Match day updated successfully");
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
      case "toggle": {
        const { eventDay } = pendingAction;
        return {
          title: eventDay.is_active
            ? "Hide this match day?"
            : "Make this match day visible?",
          description: eventDay.is_active
            ? "Tickets for it disappear from the public ticketing page."
            : "Tickets for it appear on the public ticketing page.",
          confirmLabel: eventDay.is_active ? "Hide Match Day" : "Make Visible",
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
          title: "Delete this match day?",
          description:
            "This deletes the match day and removes every ticket from sale on it. It only works if no tickets have been paid for. It cannot be undone.",
          confirmLabel: "Delete Match Day",
          tone: "warning" as const,
          icon: TrashIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Event", eventDay.title],
                ["Date", formatDay(eventDay.date)],
                [
                  "Tickets on sale",
                  String(
                    (productsByDay.get(eventDay.id) ?? []).length,
                  ),
                ],
              ]}
            />
          ),
        };
      }
      case "updateEventDay": {
        const { payload } = pendingAction;
        return {
          title: "Save changes to this match day?",
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
      default:
        return {
          title: "Create this match day?",
          description: undefined,
          confirmLabel: "Create Match Day",
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

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Match Days"
        subtitle="Manage match dates and venues, and each team's ticket allocation. Tickets are set up on the Ticket Products page."
        actions={
          <Button
            icon={showCreateForm ? XMarkIcon : PlusIcon}
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full sm:w-auto"
          >
            {showCreateForm ? "Cancel" : "New Match Day"}
          </Button>
        }
      />

      {/* Create Event Day Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700 animate-in fade-in duration-200">
          <h2 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">
            Create New Match Day
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
            Create Match Day
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search match days by title or date"
          aria-label="Search match days"
          className="w-full sm:max-w-md"
        />
        {data && (
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            {data.total} match day{data.total === 1 ? "" : "s"}
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
            {search ? "No match days match that search" : "No match days yet"}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            {search
              ? "Try a different title or date."
              : "Create your first match day, then put tickets on sale for it"}
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
                      variant={
                        manageAllocationsFor === ed.id ? "primary" : "secondary"
                      }
                      onClick={() => {
                        setManageAllocationsFor(
                          manageAllocationsFor === ed.id ? null : ed.id,
                        );
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

                {/* Tickets on sale for this match day */}
                <div className="p-4 sm:p-5">
                  <h4 className="mb-3 text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    Tickets on sale
                  </h4>
                  {(productsByDay.get(ed.id) ?? []).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(productsByDay.get(ed.id) ?? []).map(({ product, day }) => (
                        <div
                          key={day.id}
                          className="bg-gray-50 dark:bg-gray-700/80 rounded-xl p-4 border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-bold text-sffl-navy dark:text-white block truncate">
                                {product.name}
                              </span>
                              <p className="text-xl font-black text-sffl-red mt-1">
                                {day.price === 0
                                  ? "Free"
                                  : `₦${day.price.toLocaleString()}`}
                              </p>
                            </div>
                            <div className="text-right text-xs text-gray-500 dark:text-gray-400 shrink-0">
                              {day.capacity > 0 ? (
                                <>
                                  <p>
                                    {day.sold_count} / {day.capacity} sold
                                  </p>
                                  <p className="font-bold text-gray-700 dark:text-gray-200">
                                    {Math.max(day.available, 0)} left
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p>{day.sold_count} sold</p>
                                  <p className="font-bold text-gray-700 dark:text-gray-200">
                                    Unlimited
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          {!day.is_active && (
                            <p className="mt-2 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                              Not on sale
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <p className="text-gray-400 dark:text-gray-500 text-sm">
                        No tickets are on sale for this match day yet.
                      </p>
                      <ButtonLink
                        to="/admin/ticket-products"
                        variant="secondary"
                        icon={TicketIcon}
                      >
                        Set up tickets
                      </ButtonLink>
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
