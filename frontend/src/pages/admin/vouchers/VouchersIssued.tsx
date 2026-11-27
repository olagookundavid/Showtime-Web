import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ClipboardDocumentIcon,
  GiftIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PlusIcon,
  TrashIcon,
  UserPlusIcon,
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
  Select,
  VoucherStateBadge,
  formatVoucherRange,
  summariseVoucher,
  todayInLagos,
  type Column,
} from "../../../components";
import {
  adminIssueVouchers,
  adminListVoucherProducts,
  adminListVouchers,
  adminSearchVoucherUsers,
  adminVoidVoucher,
  formatKobo,
} from "../../../services";
import { useIdempotencyKey } from "../../../hooks";
import { getApiErrorMessage } from "../../../utils";
import type { AdminVoucher, VoucherProduct, VoucherStatus, WalletUser } from "../../../types";

const PAGE_SIZE = 20;
const NO_VOUCHERS: AdminVoucher[] = [];
const NO_USERS: WalletUser[] = [];

/** The most people one "give this voucher" can reach: the server's limit. */
const MAX_RECIPIENTS = 50;

/** One person in the list of people a voucher is being given to. */
interface Recipient {
  key: number;
  name: string;
  email: string;
  /** Set when the person was picked from the accounts, which links the voucher to them. */
  userId?: string;
}

let nextRecipientKey = 1;
const blankRecipient = (): Recipient => ({ key: nextRecipientKey++, name: "", email: "" });

const emailLooksRight = (email: string) => email.trim() === "" || /^\S+@\S+\.\S+$/.test(email.trim());

/** What a product is worth, in a few words, for the picker and the summary. */
const productSummary = (p: VoucherProduct) =>
  p.kind === "VALUE"
    ? `${formatKobo(p.price_kobo)} to spend. ${p.description}`
    : `Covers ${summariseVoucher(p)}. Worth ${formatKobo(p.price_kobo)}.`;

const voucherLink = (code: string) => `${window.location.origin}/vouchers/${code}`;

/** Every voucher, bought or given, with a way to give one away and to cancel one. */
export const VouchersIssued = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<VoucherStatus | "">("");

  const list = useQuery({
    queryKey: ["adminVouchers", page, search, status],
    queryFn: () => adminListVouchers({ page, limit: PAGE_SIZE, search, status: status || undefined }),
    placeholderData: keepPreviousData,
  });
  const products = useQuery({ queryKey: ["adminVoucherProducts"], queryFn: adminListVoucherProducts });

  // --- issuing ---
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueConfirm, setIssueConfirm] = useState(false);
  const [productId, setProductId] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [from, setFrom] = useState(todayInLagos());
  const [to, setTo] = useState(todayInLagos());
  const [userSearchText, setUserSearchText] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const userResults = useQuery({
    queryKey: ["adminVoucherUsers", userSearch],
    queryFn: () => adminSearchVoucherUsers(userSearch),
    enabled: userSearch.length >= 3,
  });

  const today = todayInLagos();
  const chosen = products.data?.find((p) => p.id === productId);
  const bundles = products.data?.filter((p) => p.kind !== "VALUE") ?? [];
  const priceVouchers = products.data?.filter((p) => p.kind === "VALUE") ?? [];
  const everyoneOk =
    recipients.length > 0 &&
    recipients.length <= MAX_RECIPIENTS &&
    recipients.every((r) => r.name.trim().length > 0 && emailLooksRight(r.email));
  const canIssue = !!chosen && everyoneOk && !!from && to >= from && from >= today;
  // Each person is emailed at the address typed in, and at their account's email when linked.
  const emailed = recipients.filter((r) => r.email.trim() || r.userId).length;

  const updateRecipient = (key: number, patch: Partial<Recipient>) =>
    setRecipients((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Picking an account adds a person with its name and email filled in; both stay editable.
  const addAccount = (u: WalletUser) =>
    setRecipients((prev) =>
      prev.some((r) => r.userId === u.id)
        ? prev
        : [...prev, { key: nextRecipientKey++, name: u.name || u.email, email: u.email, userId: u.id }],
    );

  const openIssue = () => {
    const usable = products.data?.filter((p) => p.active) ?? [];
    setProductId((usable.find((p) => p.kind !== "VALUE") ?? usable[0] ?? products.data?.[0])?.id ?? "");
    setRecipients([blankRecipient()]);
    setFrom(todayInLagos());
    setTo(todayInLagos());
    setUserSearchText("");
    setUserSearch("");
    attempt.settle(); // a new form is a new attempt, never a replay of an earlier one
    setIssueOpen(true);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["adminVouchers"] });

  // A retry after a lost answer reuses the key, so the vouchers are issued once.
  const attempt = useIdempotencyKey();
  const issue = useMutation({
    mutationFn: () =>
      adminIssueVouchers(
        {
          product_id: productId,
          recipients: recipients.map((r) => ({
            holder_name: r.name.trim(),
            holder_email: r.email.trim() || undefined,
            holder_user_id: r.userId,
          })),
          valid_from: from,
          valid_to: to,
        },
        attempt.current(),
      ),
    onSuccess: (made) => {
      attempt.settle();
      toast.success(made.length === 1 ? `Voucher ${made[0].code} issued` : `${made.length} vouchers issued`);
      refresh();
      setIssueConfirm(false);
      setIssueOpen(false);
    },
    onError: (err) => {
      attempt.settle(err);
      setIssueConfirm(false);
      toast.error(getApiErrorMessage(err, "We could not issue those vouchers."));
    },
  });

  // --- cancelling ---
  const [voiding, setVoiding] = useState<AdminVoucher | null>(null);
  const [refund, setRefund] = useState(true);

  const voidIt = useMutation({
    mutationFn: (v: AdminVoucher) => adminVoidVoucher(v.id, v.source === "PURCHASED" && refund),
    onSuccess: () => {
      toast.success("Voucher cancelled");
      refresh();
      setVoiding(null);
    },
    onError: (err) => {
      setVoiding(null);
      toast.error(getApiErrorMessage(err, "We could not cancel that voucher."));
    },
  });

  const columns = useMemo<Column<AdminVoucher>[]>(
    () => [
      {
        header: "Voucher",
        sortable: true,
        sortValue: (v) => v.name,
        cell: (v) => (
          <div className="min-w-0">
            <p className="font-bold text-sffl-navy dark:text-white break-words">{v.name}</p>
            <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{v.code}</p>
          </div>
        ),
      },
      {
        header: "For",
        sortable: true,
        sortValue: (v) => v.holder_name,
        cell: (v) => (
          <div className="min-w-0">
            <p className="font-semibold break-words">{v.holder_name}</p>
            {v.holder_email && <p className="text-xs text-gray-500 dark:text-gray-400 break-all">{v.holder_email}</p>}
          </div>
        ),
      },
      { header: "Covers", cell: (v) => summariseVoucher(v) },
      {
        header: "Valid",
        sortable: true,
        sortValue: (v) => v.valid_from,
        cell: (v) => formatVoucherRange(v.valid_from, v.valid_to),
      },
      {
        header: "How",
        cell: (v) => {
          if (v.source === "PURCHASED") return `Bought, ${formatKobo(v.price_kobo)}`;
          // A given bundle still shows what it is worth; a price voucher's amount is in "Covers".
          return v.kind === "VALUE" ? "Given by Showtime" : `Given by Showtime, worth ${formatKobo(v.price_kobo)}`;
        },
      },
      { header: "Status", cell: (v) => <VoucherStateBadge state={v.state} /> },
      {
        header: "Actions",
        align: "right",
        cell: (v) => {
          const unused = v.status === "ISSUED";
          return (
            <RowActions
              label={`Actions for voucher ${v.code}`}
              actions={[
                {
                  label: "Copy voucher link",
                  icon: ClipboardDocumentIcon,
                  hint: "Send it on WhatsApp or SMS",
                  onSelect: () => {
                    navigator.clipboard
                      .writeText(voucherLink(v.code))
                      .then(() => toast.success("Link copied"))
                      .catch(() => toast.error("Could not copy the link"));
                  },
                },
                {
                  label: "Cancel voucher",
                  icon: NoSymbolIcon,
                  danger: true,
                  disabled: !unused,
                  hint: unused ? undefined : "Only an unused voucher can be cancelled",
                  onSelect: () => {
                    setRefund(true);
                    setVoiding(v);
                  },
                },
              ]}
            />
          );
        },
      },
    ],
    [setRefund, setVoiding],
  );

  const data = list.data;

  return (
    <>
      <DataTable
        data={data?.data ?? NO_VOUCHERS}
        columns={columns}
        loading={list.isLoading}
        getRowId={(v) => v.id}
        searchPlaceholder="Search by code, name or email"
        serverPage={page}
        totalServerPages={Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))}
        onPageChange={setPage}
        itemsPerPage={PAGE_SIZE}
        onSearchSubmit={(term) => {
          setSearch(term);
          setPage(1);
        }}
        emptyMessage="No vouchers match. Give one, or wait for people to buy them."
        headerActions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
            <Field label="Status" htmlFor="voucher-status">
              <Select
                id="voucher-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as VoucherStatus | "");
                  setPage(1);
                }}
              >
                <option value="">All</option>
                <option value="ISSUED">Unused</option>
                <option value="REDEEMED">Used</option>
                <option value="VOID">Cancelled</option>
              </Select>
            </Field>
            <Button icon={GiftIcon} disabled={products.isLoading} onClick={openIssue}>
              Give Voucher
            </Button>
          </div>
        }
      />

      <Modal
        open={issueOpen && !issueConfirm}
        onClose={() => !issue.isPending && setIssueOpen(false)}
        title="Give a voucher"
        subtitle="Give a bundle or a price voucher to one person or many. Each person gets a voucher of their own, and we email it to them if we have an email."
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="issue-form" disabled={!canIssue}>
              Review
            </Button>
          </>
        }
      >
        <form
          id="issue-form"
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (canIssue) setIssueConfirm(true);
          }}
        >
          <Field label="Voucher" htmlFor="issue-product" hint="Set up bundles and price vouchers on the Bundles tab.">
            <Select id="issue-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {bundles.length > 0 && (
                <optgroup label="Bundles">
                  {bundles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.active ? "" : " (switched off)"}
                    </option>
                  ))}
                </optgroup>
              )}
              {priceVouchers.length > 0 && (
                <optgroup label="Price vouchers">
                  {priceVouchers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.active ? "" : " (retired)"}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </Field>
          {chosen && <p className="text-sm text-gray-600 dark:text-gray-300 break-words">{productSummary(chosen)}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First day" htmlFor="issue-from">
              <Input
                id="issue-from"
                type="date"
                min={today}
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  if (to < e.target.value) setTo(e.target.value);
                }}
              />
            </Field>
            <Field label="Last day" htmlFor="issue-to">
              <Input id="issue-to" type="date" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>

          <section aria-labelledby="issue-people" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 id="issue-people" className="text-sm font-bold text-gray-800 dark:text-gray-200">
                Who is it for? ({recipients.length})
              </h3>
              <Button
                variant="outline"
                size="sm"
                icon={PlusIcon}
                disabled={recipients.length >= MAX_RECIPIENTS}
                onClick={() => setRecipients((prev) => [...prev, blankRecipient()])}
              >
                Add Someone
              </Button>
            </div>

            <ul className="space-y-3">
              {recipients.map((r, index) => (
                <li
                  key={r.key}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <Field
                      label={r.userId ? "Name (linked to an account)" : "Name"}
                      htmlFor={`issue-name-${r.key}`}
                      hint={index === 0 ? "The bar checks this name when the voucher is used." : undefined}
                      className="flex-1 min-w-0"
                    >
                      <Input
                        id={`issue-name-${r.key}`}
                        value={r.name}
                        maxLength={100}
                        onChange={(e) => updateRecipient(r.key, { name: e.target.value })}
                        placeholder="Full name"
                      />
                    </Field>
                    <IconButton
                      icon={TrashIcon}
                      label={`Remove person ${index + 1}`}
                      variant="danger"
                      disabled={recipients.length === 1}
                      onClick={() => setRecipients((prev) => prev.filter((x) => x.key !== r.key))}
                    />
                  </div>
                  <Field
                    label="Email (optional)"
                    htmlFor={`issue-email-${r.key}`}
                    hint={
                      r.userId
                        ? "Filled in from their account. You can change it; we also email their account."
                        : "We send the voucher and its QR code here."
                    }
                    error={emailLooksRight(r.email) ? undefined : "That email address does not look right."}
                  >
                    <Input
                      id={`issue-email-${r.key}`}
                      type="email"
                      value={r.email}
                      invalid={!emailLooksRight(r.email)}
                      onChange={(e) => updateRecipient(r.key, { email: e.target.value })}
                      placeholder="name@example.com"
                    />
                  </Field>
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <Field
                label="Add people from their accounts"
                htmlFor="issue-account"
                hint="Search, then tap each person to add them. Their voucher then shows in their My Vouchers."
              >
                <div className="flex gap-2">
                  <Input
                    id="issue-account"
                    icon={MagnifyingGlassIcon}
                    value={userSearchText}
                    onChange={(e) => setUserSearchText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setUserSearch(userSearchText.trim());
                      }
                    }}
                    placeholder="Name or email, at least 3 letters"
                  />
                  <Button
                    variant="outline"
                    disabled={userSearchText.trim().length < 3}
                    onClick={() => setUserSearch(userSearchText.trim())}
                  >
                    Search
                  </Button>
                </div>
              </Field>
              {userSearch.length >= 3 && (
                <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700">
                  {(userResults.data ?? NO_USERS).map((u) => {
                    const added = recipients.some((r) => r.userId === u.id);
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          disabled={added || recipients.length >= MAX_RECIPIENTS}
                          className="flex w-full min-h-11 items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={() => addAccount(u)}
                        >
                          <span className="min-w-0">
                            <span className="block font-bold break-words">{u.name || u.email}</span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400 break-all">{u.email}</span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-sffl-red">
                            {added ? (
                              "Added"
                            ) : (
                              <>
                                <UserPlusIcon className="w-4 h-4" aria-hidden="true" />
                                Add
                              </>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {!userResults.isLoading && !userResults.data?.length && (
                    <li className="px-3 py-2 text-sm text-gray-500">No accounts match.</li>
                  )}
                </ul>
              )}
            </div>
          </section>
        </form>
      </Modal>

      <ConfirmDialog
        open={issueConfirm && !!chosen}
        title={recipients.length === 1 ? "Give this voucher?" : `Give ${recipients.length} vouchers?`}
        description={
          emailed === 0
            ? "No emails were added, so share the links yourself."
            : emailed === recipients.length
              ? "Each person will be emailed now."
              : `${emailed} of ${recipients.length} will be emailed now. Share the other links yourself.`
        }
        body={
          chosen && (
            <ConfirmSummary
              rows={[
                [chosen.kind === "VALUE" ? "Price voucher" : "Bundle", chosen.name],
                [chosen.kind === "VALUE" ? "Amount" : "Worth", formatKobo(chosen.price_kobo)],
                ["For", recipients.map((r) => r.name.trim()).join(", ")],
                ["Valid", formatVoucherRange(from, to)],
              ]}
            />
          )
        }
        confirmLabel={recipients.length === 1 ? "Give voucher" : `Give ${recipients.length} vouchers`}
        tone="info"
        icon={GiftIcon}
        pending={issue.isPending}
        onConfirm={() => issue.mutate()}
        onCancel={() => setIssueConfirm(false)}
      />

      <ConfirmDialog
        open={!!voiding}
        title="Cancel this voucher?"
        description="It can no longer be used. This cannot be undone."
        body={
          voiding && (
            <div className="space-y-3">
              <ConfirmSummary
                rows={[
                  ["Voucher", `${voiding.name} (${voiding.code})`],
                  ["For", voiding.holder_name],
                  ["Valid", formatVoucherRange(voiding.valid_from, voiding.valid_to)],
                ]}
              />
              {voiding.source === "PURCHASED" ? (
                <Checkbox
                  label={`Refund ${formatKobo(voiding.price_kobo)} to the buyer's wallet`}
                  checked={refund}
                  onChange={(e) => setRefund(e.target.checked)}
                />
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Nobody paid for this voucher, so there is nothing to refund.
                </p>
              )}
            </div>
          )
        }
        confirmLabel="Cancel voucher"
        tone="danger"
        icon={NoSymbolIcon}
        pending={voidIt.isPending}
        onConfirm={() => voiding && voidIt.mutate(voiding)}
        onCancel={() => setVoiding(null)}
      />
    </>
  );
};
