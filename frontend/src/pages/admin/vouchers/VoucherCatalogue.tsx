import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  EyeIcon,
  EyeSlashIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  Button,
  Checkbox,
  ConfirmDialog,
  ConfirmSummary,
  DataTable,
  Field,
  IconButton,
  Input,
  Modal,
  RowActions,
  Textarea,
  summariseItems,
  type Column,
} from "../../../components";
import {
  adminCreateVoucherProduct,
  adminListVoucherProducts,
  adminUpdateVoucherProduct,
  formatKobo,
} from "../../../services";
import { getApiErrorMessage } from "../../../utils";
import type { VoucherProduct, VoucherProductInput } from "../../../types";

const NO_PRODUCTS: VoucherProduct[] = [];

interface ItemRow {
  key: number;
  name: string;
  qty: string;
}

const nairaToKobo = (text: string): number | null => {
  const clean = text.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const kobo = Math.round(parseFloat(clean) * 100);
  return kobo > 0 ? kobo : null;
};

let nextKey = 1;
const blankItem = (): ItemRow => ({ key: nextKey++, name: "", qty: "1" });

/** The bundles that can be sold (or given) as vouchers. */
export const VoucherCatalogue = () => {
  const queryClient = useQueryClient();
  const products = useQuery({
    queryKey: ["adminVoucherProducts"],
    queryFn: adminListVoucherProducts,
  });

  const [editing, setEditing] = useState<VoucherProduct | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceText, setPriceText] = useState("");
  const [items, setItems] = useState<ItemRow[]>([blankItem()]);
  const [active, setActive] = useState(true);
  const [switchingOff, setSwitchingOff] = useState<VoucherProduct | null>(null);

  const openForm = (p: VoucherProduct | "new") => {
    setEditing(p);
    if (p === "new") {
      setName("");
      setDescription("");
      setPriceText("");
      setItems([blankItem()]);
      setActive(true);
      return;
    }
    setName(p.name);
    setDescription(p.description);
    setPriceText(String(p.price_kobo / 100));
    setItems(p.items.map((i) => ({ key: nextKey++, name: i.name, qty: String(i.qty) })));
    setActive(p.active);
  };

  const priceKobo = nairaToKobo(priceText);
  const cleanItems = items
    .filter((i) => i.name.trim())
    .map((i) => ({ name: i.name.trim(), qty: Number(i.qty) }));
  const itemsOk =
    cleanItems.length > 0 && cleanItems.every((i) => Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 99);
  const canSave = name.trim().length > 0 && priceKobo !== null && itemsOk;

  const input = (): VoucherProductInput => ({
    name: name.trim(),
    description: description.trim(),
    price_kobo: priceKobo ?? 0,
    items: cleanItems,
    active,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["adminVoucherProducts"] });

  const save = useMutation({
    mutationFn: () =>
      editing && editing !== "new"
        ? adminUpdateVoucherProduct(editing.id, input())
        : adminCreateVoucherProduct(input()),
    onSuccess: () => {
      toast.success(editing === "new" ? "Bundle added" : "Bundle saved");
      refresh();
      setEditing(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "We could not save that bundle.")),
  });

  const toggle = useMutation({
    mutationFn: (p: VoucherProduct) =>
      adminUpdateVoucherProduct(p.id, {
        name: p.name,
        description: p.description,
        price_kobo: p.price_kobo,
        items: p.items,
        active: !p.active,
      }),
    onSuccess: (p) => {
      toast.success(p.active ? "Bundle is on sale" : "Bundle switched off");
      refresh();
      setSwitchingOff(null);
    },
    onError: (err) => {
      setSwitchingOff(null);
      toast.error(getApiErrorMessage(err, "We could not change that bundle."));
    },
  });

  const { mutate: putOnSale } = toggle;

  const columns = useMemo<Column<VoucherProduct>[]>(
    () => [
      {
        header: "Bundle",
        sortable: true,
        sortValue: (p) => p.name,
        cell: (p) => (
          <div className="min-w-0">
            <p className="font-bold text-sffl-navy dark:text-white break-words">{p.name}</p>
            {p.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 break-words">{p.description}</p>
            )}
          </div>
        ),
      },
      { header: "Covers", cell: (p) => summariseItems(p.items) },
      {
        header: "Price",
        sortable: true,
        sortValue: (p) => p.price_kobo,
        align: "right",
        cell: (p) => formatKobo(p.price_kobo),
      },
      {
        header: "In the shop",
        cell: (p) => (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-bold ${
              p.active ? "text-emerald-700 dark:text-emerald-300" : "text-gray-500"
            }`}
          >
            {p.active ? (
              <EyeIcon className="w-4 h-4" aria-hidden="true" />
            ) : (
              <EyeSlashIcon className="w-4 h-4" aria-hidden="true" />
            )}
            {p.active ? "On sale" : "Switched off"}
          </span>
        ),
      },
      {
        header: "Actions",
        align: "right",
        cell: (p) => (
          <RowActions
            label={`Actions for ${p.name}`}
            actions={[
              { label: "Edit", icon: PencilSquareIcon, onSelect: () => openForm(p) },
              p.active
                ? {
                    label: "Switch off",
                    icon: EyeSlashIcon,
                    hint: "Stops new sales. Vouchers already sold still work.",
                    onSelect: () => setSwitchingOff(p),
                  }
                : { label: "Put on sale", icon: EyeIcon, onSelect: () => putOnSale(p) },
            ]}
          />
        ),
      },
    ],
    [putOnSale],
  );

  return (
    <>
      <DataTable
        data={products.data ?? NO_PRODUCTS}
        columns={columns}
        loading={products.isLoading}
        getRowId={(p) => p.id}
        searchPlaceholder="Search bundles"
        emptyMessage="No bundles yet. Add one, such as a burger and a drink, to start selling vouchers."
        headerActions={
          <Button icon={PlusIcon} onClick={() => openForm("new")}>
            New Bundle
          </Button>
        }
      />

      <Modal
        open={editing !== null}
        onClose={() => !save.isPending && setEditing(null)}
        title={editing === "new" ? "New voucher bundle" : "Edit voucher bundle"}
        subtitle="Vouchers already sold keep the items and price they were bought with."
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" disabled={save.isPending} onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="bundle-form" loading={save.isPending} disabled={!canSave}>
              Save Bundle
            </Button>
          </>
        }
      >
        <form
          id="bundle-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) save.mutate();
          }}
        >
          <Field label="Name" htmlFor="bundle-name">
            <Input
              id="bundle-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="Burger and drink"
            />
          </Field>
          <Field label="Description (optional)" htmlFor="bundle-desc">
            <Textarea
              id="bundle-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown to people in the shop"
            />
          </Field>
          <Field
            label="Price (₦)"
            htmlFor="bundle-price"
            hint="What a buyer pays from their wallet. Vouchers you give away are free."
          >
            <Input
              id="bundle-price"
              inputMode="decimal"
              autoComplete="off"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              placeholder="4500"
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-gray-800 dark:text-gray-200">
              What it covers
            </legend>
            {items.map((row, index) => (
              <div key={row.key} className="flex items-end gap-2">
                <Field label={index === 0 ? "Item" : undefined} htmlFor={`item-name-${row.key}`} className="flex-1 min-w-0">
                  <Input
                    id={`item-name-${row.key}`}
                    value={row.name}
                    maxLength={100}
                    aria-label={`Item ${index + 1} name`}
                    onChange={(e) =>
                      setItems((prev) => prev.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)))
                    }
                    placeholder="Burger"
                  />
                </Field>
                <Field label={index === 0 ? "Qty" : undefined} htmlFor={`item-qty-${row.key}`} className="w-20 shrink-0">
                  <Input
                    id={`item-qty-${row.key}`}
                    type="number"
                    min={1}
                    max={99}
                    aria-label={`Item ${index + 1} quantity`}
                    value={row.qty}
                    onChange={(e) =>
                      setItems((prev) => prev.map((r) => (r.key === row.key ? { ...r, qty: e.target.value } : r)))
                    }
                  />
                </Field>
                <IconButton
                  icon={TrashIcon}
                  label={`Remove item ${index + 1}`}
                  variant="danger"
                  disabled={items.length === 1}
                  onClick={() => setItems((prev) => prev.filter((r) => r.key !== row.key))}
                />
              </div>
            ))}
            <Button variant="outline" size="sm" icon={PlusIcon} onClick={() => setItems((prev) => [...prev, blankItem()])}>
              Add Item
            </Button>
          </fieldset>

          <Checkbox
            label="On sale in the shop"
            hint="Switch off to stop new sales without affecting vouchers already sold."
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!switchingOff}
        title="Switch this bundle off?"
        description="People will no longer be able to buy it. Vouchers already sold still work."
        body={switchingOff && <ConfirmSummary rows={[["Bundle", switchingOff.name], ["Price", formatKobo(switchingOff.price_kobo)]]} />}
        confirmLabel="Switch off"
        tone="warning"
        icon={EyeSlashIcon}
        pending={toggle.isPending}
        onConfirm={() => switchingOff && toggle.mutate(switchingOff)}
        onCancel={() => setSwitchingOff(null)}
      />
    </>
  );
};
