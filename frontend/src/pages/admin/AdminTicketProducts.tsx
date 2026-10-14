import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  CalendarDaysIcon,
  CheckIcon,
  PencilSquareIcon,
  PlusIcon,
  TagIcon,
  TicketIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  adminCreateTicketProduct,
  adminDeleteTicketProduct,
  adminListTicketProducts,
  adminSaveGamePassRules,
  adminSaveTicketProductDay,
  adminUpdateTicketProduct,
  getEventDays,
  getGamePassRules,
} from "../../services/api";
import type {
  CreateTicketProductPayload,
  EventDayResponse,
  GamePassRule,
  TicketProductDayResponse,
  TicketProductResponse,
} from "../../types";
import {
  Button,
  Checkbox,
  ConfirmDialog,
  ConfirmSummary,
  DashboardPageHeader,
  DataTable,
  Field,
  IconButton,
  Input,
  Modal,
  RowActions,
  Tabs,
  Textarea,
  formatDayShort,
  naira,
  type Column,
} from "../../components";
import { usePermissions } from "../../hooks";
import { getApiErrorMessage } from "../../utils";

type Tab = "tickets" | "game-pass";

// A stable empty list, so the table isn't handed a fresh array on every render.
const NO_PRODUCTS: TicketProductResponse[] = [];

// ─── Ticket form ──────────────────────────────────────────────────────────────

interface ProductFormModalProps {
  /** The ticket being edited, or null to create one. */
  product: TicketProductResponse | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTicketProductPayload) => void;
}

// Mounted per ticket (keyed by id), so the form starts from that record.
const ProductFormModal = ({ product, pending, onClose, onSubmit }: ProductFormModalProps) => {
  const [name, setName] = useState(product?.name ?? "");
  const [basePrice, setBasePrice] = useState(String(product?.base_price ?? ""));
  const [description, setDescription] = useState(product?.description ?? "");
  const [isHidden, setIsHidden] = useState(Boolean(product?.is_hidden));
  const [accessCode, setAccessCode] = useState(product?.access_code ?? "");
  const [allowGamePass, setAllowGamePass] = useState(product?.allow_game_pass ?? true);
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(String(product?.sort_order ?? 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Ticket name is required");
      return;
    }
    const price = parseInt(basePrice, 10);
    if (isNaN(price) || price < 0) {
      toast.error("A price of 0 (free) or more is required");
      return;
    }
    if (isHidden && !accessCode.trim()) {
      toast.error("A hidden ticket needs an access code");
      return;
    }
    onSubmit({
      name: trimmed,
      base_price: price,
      description: description.trim(),
      is_hidden: isHidden,
      access_code: isHidden ? accessCode.trim().toUpperCase() : "",
      allow_game_pass: allowGamePass,
      is_active: isActive,
      sort_order: parseInt(sortOrder, 10) || 0,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? "Edit Ticket" : "New Ticket"}
      subtitle={
        product
          ? product.name
          : "Create the ticket first, then choose the match days it is sold on."
      }
      maxWidth="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="ticket-product-form" loading={pending}>
            Save Ticket
          </Button>
        </>
      }
    >
      <form id="ticket-product-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={<>Name <span className="text-sffl-red">*</span></>} htmlFor="tp-name">
            <Input
              id="tp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP"
              required
            />
          </Field>
          <Field
            label={<>Price per match day (₦) <span className="text-sffl-red">*</span></>}
            htmlFor="tp-price"
            hint="0 makes it free. A match day can override this later."
          >
            <Input
              id="tp-price"
              type="number"
              min="0"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="5000"
              required
            />
          </Field>
        </div>

        <Field
          label="What is included"
          htmlFor="tp-description"
          hint="One perk per line. Each line is shown with a tick on the ticket card."
        >
          <Textarea
            id="tp-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={"Premium seating\nOne complimentary drink\nPriority parking"}
          />
        </Field>

        <div className="space-y-1">
          <Checkbox
            label="Hidden ticket"
            hint="Only shown to visitors who enter the access code."
            checked={isHidden}
            onChange={(e) => setIsHidden(e.target.checked)}
          />
          {isHidden && (
            <Field label={<>Access code <span className="text-sffl-red">*</span></>} htmlFor="tp-code">
              <Input
                id="tp-code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="e.g. SFFLVIP"
                className="font-mono uppercase"
                required
              />
            </Field>
          )}
          <Checkbox
            label="Can be bought as part of a Game Pass"
            hint="Turn off for tickets that only make sense for one day."
            checked={allowGamePass}
            onChange={(e) => setAllowGamePass(e.target.checked)}
          />
          <Checkbox
            label="On sale"
            hint="Untick to stop selling this ticket without deleting it."
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </div>

        <Field label="Order on the page" htmlFor="tp-sort" hint="Lower numbers come first.">
          <Input
            id="tp-sort"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="sm:w-32"
          />
        </Field>
      </form>
    </Modal>
  );
};

// ─── Match days a ticket is sold on ───────────────────────────────────────────

interface DayDraft {
  onSale: boolean;
  /** Blank uses the ticket's own price. */
  price: string;
  /** Blank or 0 is unlimited. */
  capacity: string;
}

interface ProductDaysModalProps {
  product: TicketProductResponse;
  eventDays: EventDayResponse[];
  onClose: () => void;
  onSaved: () => void;
}

const draftFor = (day: TicketProductDayResponse | undefined): DayDraft => ({
  onSale: !!day?.is_active,
  price: day?.price_override != null ? String(day.price_override) : "",
  capacity: day && day.capacity > 0 ? String(day.capacity) : "",
});

const ProductDaysModal = ({ product, eventDays, onClose, onSaved }: ProductDaysModalProps) => {
  const existing = useMemo(
    () => new Map(product.days.map((d) => [d.event_day_id, d])),
    [product.days],
  );
  const [drafts, setDrafts] = useState<Record<string, DayDraft>>(() =>
    Object.fromEntries(eventDays.map((ed) => [ed.id, draftFor(existing.get(ed.id))])),
  );
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkCapacity, setBulkCapacity] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (id: string, patch: Partial<DayDraft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const allOn = eventDays.length > 0 && eventDays.every((ed) => drafts[ed.id]?.onSale);

  const applyToChecked = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const ed of eventDays) {
        if (!next[ed.id]?.onSale) continue;
        next[ed.id] = {
          ...next[ed.id],
          price: bulkPrice.trim() !== "" ? bulkPrice.trim() : next[ed.id].price,
          capacity: bulkCapacity.trim() !== "" ? bulkCapacity.trim() : next[ed.id].capacity,
        };
      }
      return next;
    });
  };

  const save = async () => {
    // Validate every row before sending any, so a typo doesn't half-save.
    for (const ed of eventDays) {
      const d = drafts[ed.id];
      if (!d?.onSale) continue;
      if (d.price.trim() !== "" && (isNaN(parseInt(d.price, 10)) || parseInt(d.price, 10) < 0)) {
        toast.error(`${ed.title}: price must be 0 or more`);
        return;
      }
      if (d.capacity.trim() !== "" && (isNaN(parseInt(d.capacity, 10)) || parseInt(d.capacity, 10) < 0)) {
        toast.error(`${ed.title}: capacity must be 0 (unlimited) or more`);
        return;
      }
    }

    // Only rows that changed are sent.
    const changed = eventDays.filter((ed) => {
      const before = draftFor(existing.get(ed.id));
      const now = drafts[ed.id];
      return now.onSale !== before.onSale || (now.onSale && (now.price !== before.price || now.capacity !== before.capacity));
    });
    if (changed.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      for (const ed of changed) {
        const d = drafts[ed.id];
        await adminSaveTicketProductDay(product.id, {
          event_day_id: ed.id,
          price_override: d.price.trim() === "" ? null : parseInt(d.price, 10),
          capacity: d.capacity.trim() === "" ? 0 : parseInt(d.capacity, 10),
          // Unticking keeps the row (and its sales) and just stops selling.
          is_active: d.onSale,
        });
      }
      toast.success("Match days saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save match days"));
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Match days for ${product.name}`}
      subtitle="Tick the match days this ticket is sold on, and set a price and number of seats for each."
      maxWidth="3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button icon={CheckIcon} onClick={save} loading={saving}>
            Save Match Days
          </Button>
        </>
      }
    >
      {eventDays.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          There are no upcoming match days yet. Create one on the Match Days page first.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 bg-gray-50 p-3 dark:bg-gray-700/50">
            <Checkbox
              label="All match days"
              checked={allOn}
              onChange={(e) =>
                setDrafts((prev) =>
                  Object.fromEntries(
                    eventDays.map((ed) => [ed.id, { ...prev[ed.id], onSale: e.target.checked }]),
                  ),
                )
              }
            />
            <Field label="Price for all ticked (₦)" htmlFor="bulk-price" className="w-40">
              <Input
                id="bulk-price"
                type="number"
                min="0"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                placeholder={String(product.base_price)}
              />
            </Field>
            <Field label="Seats for all ticked" htmlFor="bulk-cap" className="w-40">
              <Input
                id="bulk-cap"
                type="number"
                min="0"
                value={bulkCapacity}
                onChange={(e) => setBulkCapacity(e.target.value)}
                placeholder="Unlimited"
              />
            </Field>
            <Button variant="secondary" onClick={applyToChecked}>
              Apply
            </Button>
          </div>

          <ul className="divide-y divide-gray-200 border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {eventDays.map((ed) => {
              const d = drafts[ed.id] ?? draftFor(undefined);
              const day = existing.get(ed.id);
              return (
                <li key={ed.id} className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:items-center">
                  <div className="min-w-0">
                    <Checkbox
                      label={ed.title}
                      hint={
                        <>
                          {formatDayShort(ed.date)}
                          {day ? ` · ${day.sold_count} sold` : ""}
                        </>
                      }
                      checked={d.onSale}
                      onChange={(e) => update(ed.id, { onSale: e.target.checked })}
                    />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    value={d.price}
                    onChange={(e) => update(ed.id, { price: e.target.value })}
                    placeholder={`${naira(product.base_price)}`}
                    aria-label={`Price for ${ed.title}`}
                    disabled={!d.onSale}
                  />
                  <Input
                    type="number"
                    min={day?.sold_count ?? 0}
                    value={d.capacity}
                    onChange={(e) => update(ed.id, { capacity: e.target.value })}
                    placeholder="Unlimited"
                    aria-label={`Seats for ${ed.title}`}
                    disabled={!d.onSale}
                  />
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Leave the price blank to use the ticket&apos;s own price ({naira(product.base_price)}). Leave seats blank
            for no limit. Unticking a match day stops selling it but keeps the tickets already sold.
          </p>
        </div>
      )}
    </Modal>
  );
};

// ─── Game Pass discount ladder ────────────────────────────────────────────────

interface RuleDraft {
  key: number;
  minDays: string;
  percentOff: string;
  isActive: boolean;
}

const GamePassRulesEditor = ({ canManage }: { canManage: boolean }) => {
  const queryClient = useQueryClient();
  const { data: rules, isLoading } = useQuery({
    queryKey: ["gamePassRules"],
    queryFn: getGamePassRules,
  });

  // Edited rows. Null until the first edit, so the form always starts from the
  // saved ladder without copying server state into component state in an effect.
  const [edited, setEdited] = useState<RuleDraft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [nextKey, setNextKey] = useState(1000);

  const saved: RuleDraft[] = useMemo(
    () =>
      (rules ?? []).map((r, i) => ({
        key: i,
        minDays: String(r.min_days),
        percentOff: String(r.percent_off),
        isActive: r.is_active,
      })),
    [rules],
  );
  const drafts = edited ?? saved;

  const change = (key: number, patch: Partial<RuleDraft>) =>
    setEdited(drafts.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRule = () => {
    const highest = Math.max(1, ...drafts.map((r) => parseInt(r.minDays, 10) || 0));
    setEdited([...drafts, { key: nextKey, minDays: String(highest + 1), percentOff: "0", isActive: true }]);
    setNextKey(nextKey + 1);
  };

  const save = async () => {
    const payload: GamePassRule[] = [];
    const seen = new Set<number>();
    for (const r of drafts) {
      const days = parseInt(r.minDays, 10);
      const percent = parseFloat(r.percentOff);
      if (isNaN(days) || days < 2) {
        toast.error("Each rule needs 2 or more match days");
        return;
      }
      if (isNaN(percent) || percent < 0 || percent > 100) {
        toast.error("A discount must be between 0 and 100 percent");
        return;
      }
      if (seen.has(days)) {
        toast.error(`There are two rules for ${days} match days`);
        return;
      }
      seen.add(days);
      payload.push({ min_days: days, percent_off: percent, is_active: r.isActive });
    }
    setSaving(true);
    try {
      await adminSaveGamePassRules(payload);
      setEdited(null);
      await queryClient.invalidateQueries({ queryKey: ["gamePassRules"] });
      toast.success("Game Pass discounts saved");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save Game Pass discounts"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 border border-gray-100 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-800">
      <div>
        <h2 className="text-lg font-bold text-sffl-navy dark:text-white">Game Pass discounts</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Take a percentage off a Game Pass based on how many match days it covers. A pass with more days than a rule
          gets the biggest rule it reaches. At 0% a pass simply costs the sum of its days.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : drafts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No discounts yet. Add one to reward bigger passes.</p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((r) => (
            <li key={r.key} className="flex flex-wrap items-end gap-3 bg-gray-50 p-3 dark:bg-gray-700/50">
              <Field label="From (match days)" htmlFor={`rule-days-${r.key}`} className="w-36">
                <Input
                  id={`rule-days-${r.key}`}
                  type="number"
                  min="2"
                  value={r.minDays}
                  onChange={(e) => change(r.key, { minDays: e.target.value })}
                  disabled={!canManage}
                />
              </Field>
              <Field label="Percent off" htmlFor={`rule-pct-${r.key}`} className="w-36">
                <Input
                  id={`rule-pct-${r.key}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={r.percentOff}
                  onChange={(e) => change(r.key, { percentOff: e.target.value })}
                  disabled={!canManage}
                />
              </Field>
              <Checkbox
                label="Active"
                checked={r.isActive}
                onChange={(e) => change(r.key, { isActive: e.target.checked })}
                disabled={!canManage}
              />
              <IconButton
                icon={TrashIcon}
                variant="danger"
                label={`Remove the ${r.minDays} day rule`}
                onClick={() => setEdited(drafts.filter((x) => x.key !== r.key))}
                disabled={!canManage}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" icon={PlusIcon} onClick={addRule} disabled={!canManage}>
          Add rule
        </Button>
        <Button icon={CheckIcon} onClick={save} loading={saving} disabled={!canManage || edited === null}>
          Save discounts
        </Button>
      </div>
    </section>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

type PendingAction = { kind: "delete"; product: TicketProductResponse };

export const AdminTicketProducts = () => {
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();
  const canManage = canEdit("tickets");

  const [tab, setTab] = useState<Tab>("tickets");
  const [formFor, setFormFor] = useState<TicketProductResponse | "new" | null>(null);
  const [daysFor, setDaysFor] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["adminTicketProducts"],
    queryFn: adminListTicketProducts,
  });
  // Upcoming match days only: a ticket can't be put on sale for a day that has gone.
  const { data: eventDaysData } = useQuery({
    queryKey: ["ticketProductEventDays"],
    queryFn: getEventDays,
  });

  const products = productsData ?? NO_PRODUCTS;
  const eventDays = useMemo(() => eventDaysData ?? [], [eventDaysData]);
  // Kept by id so the days modal always reads the latest saved copy.
  const daysProduct = daysFor ? products.find((p) => p.id === daysFor) ?? null : null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["adminTicketProducts"] });

  const saveProduct = async (payload: CreateTicketProductPayload) => {
    if (!canManage) {
      toast.error("View-only access: your role can view tickets but not make changes.");
      return;
    }
    setBusy(true);
    try {
      if (formFor && formFor !== "new") {
        await adminUpdateTicketProduct(formFor.id, payload);
        toast.success("Ticket updated");
      } else {
        const created = await adminCreateTicketProduct(payload);
        toast.success("Ticket created. Now choose the match days it is sold on.");
        setDaysFor(created.id);
      }
      setFormFor(null);
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save ticket"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingAction) return;
    setBusy(true);
    try {
      await adminDeleteTicketProduct(pendingAction.product.id);
      toast.success("Ticket deleted");
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to delete ticket"));
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  };

  const columns = useMemo<Column<TicketProductResponse>[]>(
    () => [
      {
        header: "Ticket",
        cell: (p) => (
          <span className="font-bold text-sffl-navy dark:text-white">
            {p.name}
            {!p.is_active && (
              <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-600 dark:bg-gray-600 dark:text-gray-200">
                Off sale
              </span>
            )}
          </span>
        ),
      },
      {
        header: "Price",
        align: "right",
        cell: (p) => (p.base_price === 0 ? "Free" : naira(p.base_price)),
      },
      {
        header: "Visibility",
        cell: (p) =>
          p.is_hidden ? (
            <span className="font-mono text-xs">Hidden · {p.access_code || "no code"}</span>
          ) : (
            "Public"
          ),
      },
      { header: "Game Pass", align: "center", cell: (p) => (p.allow_game_pass ? "Yes" : "No") },
      {
        header: "Match days on sale",
        align: "center",
        cell: (p) => p.days.filter((d) => d.is_active).length,
      },
      {
        header: "Sold",
        align: "center",
        cell: (p) => p.days.reduce((sum, d) => sum + d.sold_count, 0),
      },
      {
        header: "Actions",
        align: "right",
        cell: (p) => (
          <RowActions
            label={`Actions for ${p.name}`}
            actions={[
              {
                label: "Match days & seats",
                icon: CalendarDaysIcon,
                onSelect: () => setDaysFor(p.id),
              },
              {
                label: "Edit ticket",
                icon: PencilSquareIcon,
                disabled: !canManage,
                hint: canManage ? undefined : "View-only access",
                onSelect: () => setFormFor(p),
              },
              {
                label: "Delete",
                icon: TrashIcon,
                danger: true,
                disabled: !canManage,
                hint: canManage ? "Only works if nothing has been sold" : "View-only access",
                onSelect: () => setPendingAction({ kind: "delete", product: p }),
              },
            ]}
          />
        ),
      },
    ],
    [canManage],
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Ticket Products"
        subtitle="Set up the tickets you sell (5K, VIP, VVIP), the match days each is sold on, and the Game Pass discount."
        actions={
          <Button
            icon={PlusIcon}
            onClick={() => setFormFor("new")}
            disabled={!canManage}
            className="w-full sm:w-auto"
          >
            New Ticket
          </Button>
        }
      />

      <Tabs
        aria-label="Ticket setup"
        items={[
          { value: "tickets", label: "Tickets", icon: TicketIcon },
          { value: "game-pass", label: "Game Pass discounts", icon: TagIcon },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "tickets" ? (
        <DataTable
          data={products}
          columns={columns}
          loading={isLoading}
          getRowId={(p) => p.id}
          paginated={false}
          searchable={false}
          emptyMessage="No tickets yet. Create one with New Ticket, then choose the match days it is sold on."
        />
      ) : (
        <GamePassRulesEditor canManage={canManage} />
      )}

      {formFor && (
        <ProductFormModal
          key={formFor === "new" ? "new" : formFor.id}
          product={formFor === "new" ? null : formFor}
          pending={busy}
          onClose={() => setFormFor(null)}
          onSubmit={saveProduct}
        />
      )}

      {daysProduct && (
        <ProductDaysModal
          key={daysProduct.id}
          product={daysProduct}
          eventDays={eventDays}
          onClose={() => setDaysFor(null)}
          onSaved={refresh}
        />
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title="Delete this ticket?"
        description="It is removed from sale and from every match day. This only works if no tickets have been paid for. It cannot be undone."
        confirmLabel="Delete Ticket"
        tone="danger"
        icon={TrashIcon}
        pending={busy}
        body={
          pendingAction && (
            <ConfirmSummary
              rows={[
                ["Ticket", pendingAction.product.name],
                ["Match days", String(pendingAction.product.days.length)],
              ]}
            />
          )
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};
