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
  DEFAULT_PRICE_VOUCHER_DESCRIPTION,
  MAX_PRICE_VOUCHER_KOBO,
  nairaTextToKobo,
  summariseVoucher,
  type Column,
} from "../../../components";
import {
  adminCreateVoucherProduct,
  adminListVoucherProducts,
  adminUpdateVoucherProduct,
  formatKobo,
} from "../../../services";
import { getApiErrorMessage } from "../../../utils";
import type { VoucherKind, VoucherProduct, VoucherProductInput } from "../../../types";

const NO_PRODUCTS: VoucherProduct[] = [];

interface ItemRow {
  key: number;
  name: string;
  qty: string;
}

let nextKey = 1;
const blankItem = (): ItemRow => ({ key: nextKey++, name: "", qty: "1" });

/**
 * The bundles that can be sold (or given) as vouchers, and the price vouchers kept
 * here to give away: a named amount of money that can be reused for many people.
 */
export const VoucherCatalogue = () => {
  const queryClient = useQueryClient();
  const products = useQuery({
    queryKey: ["adminVoucherProducts"],
    queryFn: adminListVoucherProducts,
  });

  const [editing, setEditing] = useState<VoucherProduct | "new" | null>(null);
  const [kind, setKind] = useState<VoucherKind>("BUNDLE");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceText, setPriceText] = useState("");
  const [items, setItems] = useState<ItemRow[]>([blankItem()]);
  const [active, setActive] = useState(true);
  const [switchingOff, setSwitchingOff] = useState<VoucherProduct | null>(null);

  const openForm = (p: VoucherProduct | "new") => {
    setEditing(p);
    if (p === "new") {
      setKind("BUNDLE");
      setName("");
      setDescription("");
      setPriceText("");
      setItems([blankItem()]);
      setActive(true);
      return;
    }
    setKind(p.kind);
    setName(p.name);
    setDescription(p.description);
    setPriceText(String(p.price_kobo / 100));
    setItems(p.items.map((i) => ({ key: nextKey++, name: i.name, qty: String(i.qty) })));
    setActive(p.active);
  };

  const isPrice = kind === "VALUE";

  // Ticking "price voucher" pre-fills the description (still editable); unticking
  // takes the pre-filled text back out so a bundle's description starts clean.
  const changeKind = (price: boolean) => {
    setKind(price ? "VALUE" : "BUNDLE");
    if (price && description.trim() === "") setDescription(DEFAULT_PRICE_VOUCHER_DESCRIPTION);
    if (!price && description.trim() === DEFAULT_PRICE_VOUCHER_DESCRIPTION) setDescription("");
  };

  const priceKobo = nairaTextToKobo(priceText);
  const cleanItems = items
    .filter((i) => i.name.trim())
    .map((i) => ({ name: i.name.trim(), qty: Number(i.qty) }));
  const itemsOk =
    cleanItems.length > 0 && cleanItems.every((i) => Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 99);
  const amountOk = priceKobo !== null && (!isPrice || priceKobo <= MAX_PRICE_VOUCHER_KOBO);
  const canSave = name.trim().length > 0 && amountOk && (isPrice || itemsOk);

  const input = (): VoucherProductInput => ({
    kind,
    name: name.trim(),
    description: description.trim(),
    price_kobo: priceKobo ?? 0,
    items: isPrice ? [] : cleanItems,
    active,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["adminVoucherProducts"] });

  const save = useMutation({
    mutationFn: () =>
      editing && editing !== "new"
        ? adminUpdateVoucherProduct(editing.id, input())
        : adminCreateVoucherProduct(input()),
    onSuccess: () => {
      toast.success(editing === "new" ? (isPrice ? "Price voucher added" : "Bundle added") : "Saved");
      refresh();
      setEditing(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "We could not save that bundle.")),
  });

  const toggle = useMutation({
    mutationFn: (p: VoucherProduct) =>
      adminUpdateVoucherProduct(p.id, {
        kind: p.kind,
        name: p.name,
        description: p.description,
        price_kobo: p.price_kobo,
        items: p.items,
        active: !p.active,
      }),
    onSuccess: (p) => {
      toast.success(p.kind === "VALUE" ? (p.active ? "Price voucher is back in use" : "Price voucher retired") : p.active ? "Bundle is on sale" : "Bundle switched off");
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
      { header: "Covers", cell: (p) => summariseVoucher(p) },
      {
        header: "Price",
        sortable: true,
        sortValue: (p) => p.price_kobo,
        align: "right",
        cell: (p) => formatKobo(p.price_kobo),
      },
      {
        header: "In the shop",
        cell: (p) =>
          p.kind === "VALUE" ? (
            <span
              className={`text-xs font-bold ${p.active ? "text-sky-700 dark:text-sky-300" : "text-gray-500"}`}
            >
              {p.active ? "Gift only" : "Retired"}
            </span>
          ) : (
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
                    label: p.kind === "VALUE" ? "Retire" : "Switch off",
                    icon: EyeSlashIcon,
                    hint:
                      p.kind === "VALUE"
                        ? "Stops it being offered when you give vouchers. Ones already given still work."
                        : "Stops new sales. Vouchers already sold still work.",
                    onSelect: () => setSwitchingOff(p),
                  }
                : {
                    label: p.kind === "VALUE" ? "Use again" : "Put on sale",
                    icon: EyeIcon,
                    onSelect: () => putOnSale(p),
                  },
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
        searchPlaceholder="Search bundles and price vouchers"
        emptyMessage="Nothing here yet. Add a bundle, such as a burger and a drink, or a price voucher, such as a thank you worth a set amount."
        headerActions={
          <Button icon={PlusIcon} onClick={() => openForm("new")}>
            New Bundle
          </Button>
        }
      />

      <Modal
        open={editing !== null}
        onClose={() => !save.isPending && setEditing(null)}
        title={
          editing === "new"
            ? isPrice ? "New price voucher" : "New voucher bundle"
            : isPrice ? "Edit price voucher" : "Edit voucher bundle"
        }
        subtitle={
          isPrice
            ? "Vouchers already given keep the amount they were given with."
            : "Vouchers already sold keep the items and price they were bought with."
        }
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" disabled={save.isPending} onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="bundle-form" loading={save.isPending} disabled={!canSave}>
              {isPrice ? "Save Price Voucher" : "Save Bundle"}
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
          <Checkbox
            label="This is a price voucher"
            hint={
              editing === "new"
                ? "A set amount to spend, not a list of items. The bar takes it off the bill. You give these away; they are never sold in the shop."
                : "A voucher's type can't be changed once it is saved."
            }
            checked={isPrice}
            disabled={editing !== "new"}
            onChange={(e) => changeKind(e.target.checked)}
          />

          <Field label="Name" htmlFor="bundle-name">
            <Input
              id="bundle-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder={isPrice ? "Thank you voucher" : "Burger and drink"}
            />
          </Field>
          <Field
            label={isPrice ? "What it can be used for" : "Description (optional)"}
            htmlFor="bundle-desc"
          >
            <Textarea
              id="bundle-desc"
              rows={2}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isPrice ? undefined : "Shown to people in the shop"}
            />
          </Field>
          <Field
            label={isPrice ? "Amount (₦)" : "Price (₦)"}
            htmlFor="bundle-price"
            hint={
              isPrice
                ? "What the bar takes off the bill. The most is ₦1,000,000."
                : "What a buyer pays from their wallet. Vouchers you give away are free."
            }
            error={
              isPrice && priceText.trim() !== "" && !amountOk
                ? "Enter an amount between ₦1 and ₦1,000,000."
                : undefined
            }
          >
            <Input
              id="bundle-price"
              inputMode="decimal"
              autoComplete="off"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              placeholder={isPrice ? "10000" : "4500"}
            />
          </Field>

          {!isPrice && (
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
          )}

          <Checkbox
            label={isPrice ? "In use" : "On sale in the shop"}
            hint={
              isPrice
                ? "Switch off to retire it. Vouchers already given keep working."
                : "Switch off to stop new sales without affecting vouchers already sold."
            }
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!switchingOff}
        title={switchingOff?.kind === "VALUE" ? "Retire this price voucher?" : "Switch this bundle off?"}
        description={
          switchingOff?.kind === "VALUE"
            ? "You won't be offered it when you give vouchers. Ones already given still work."
            : "People will no longer be able to buy it. Vouchers already sold still work."
        }
        body={switchingOff && <ConfirmSummary rows={[["Bundle", switchingOff.name], ["Price", formatKobo(switchingOff.price_kobo)]]} />}
        confirmLabel={switchingOff?.kind === "VALUE" ? "Retire" : "Switch off"}
        tone="warning"
        icon={EyeSlashIcon}
        pending={toggle.isPending}
        onConfirm={() => switchingOff && toggle.mutate(switchingOff)}
        onCancel={() => setSwitchingOff(null)}
      />
    </>
  );
};
