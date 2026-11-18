import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ClipboardDocumentIcon,
  GiftIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  XMarkIcon,
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
  summariseItems,
  todayInLagos,
  type Column,
} from "../../../components";
import {
  adminIssueVoucher,
  adminListVoucherProducts,
  adminListVouchers,
  adminSearchVoucherUsers,
  adminVoidVoucher,
  formatKobo,
} from "../../../services";
import { getApiErrorMessage } from "../../../utils";
import type { AdminVoucher, VoucherStatus, WalletUser } from "../../../types";

const PAGE_SIZE = 20;
const NO_VOUCHERS: AdminVoucher[] = [];
const NO_USERS: WalletUser[] = [];

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
  const [holderName, setHolderName] = useState("");
  const [holderEmail, setHolderEmail] = useState("");
  const [from, setFrom] = useState(todayInLagos());
  const [to, setTo] = useState(todayInLagos());
  const [linked, setLinked] = useState<WalletUser | null>(null);
  const [userSearchText, setUserSearchText] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const userResults = useQuery({
    queryKey: ["adminVoucherUsers", userSearch],
    queryFn: () => adminSearchVoucherUsers(userSearch),
    enabled: userSearch.length >= 3,
  });

  const today = todayInLagos();
  const chosen = products.data?.find((p) => p.id === productId);
  const canIssue = !!chosen && holderName.trim().length > 0 && !!from && to >= from && from >= today;

  const openIssue = () => {
    setProductId(products.data?.find((p) => p.active)?.id ?? "");
    setHolderName("");
    setHolderEmail("");
    setFrom(todayInLagos());
    setTo(todayInLagos());
    setLinked(null);
    setUserSearchText("");
    setUserSearch("");
    setIssueOpen(true);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["adminVouchers"] });

  const issue = useMutation({
    mutationFn: () =>
      adminIssueVoucher({
        product_id: productId,
        holder_name: holderName.trim(),
        holder_email: holderEmail.trim() || undefined,
        holder_user_id: linked?.id,
        valid_from: from,
        valid_to: to,
      }),
    onSuccess: (v) => {
      toast.success(`Voucher ${v.code} issued`);
      refresh();
      setIssueConfirm(false);
      setIssueOpen(false);
    },
    onError: (err) => {
      setIssueConfirm(false);
      toast.error(getApiErrorMessage(err, "We could not issue that voucher."));
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
      { header: "Covers", cell: (v) => summariseItems(v.items) },
      {
        header: "Valid",
        sortable: true,
        sortValue: (v) => v.valid_from,
        cell: (v) => formatVoucherRange(v.valid_from, v.valid_to),
      },
      {
        header: "How",
        cell: (v) => (v.source === "PURCHASED" ? `Bought, ${formatKobo(v.price_kobo)}` : "Given by Showtime"),
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
        emptyMessage="No vouchers match. Issue one, or wait for people to buy them."
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
            <Button icon={GiftIcon} disabled={!products.data?.length} onClick={openIssue}>
              Issue Voucher
            </Button>
          </div>
        }
      />

      <Modal
        open={issueOpen && !issueConfirm}
        onClose={() => !issue.isPending && setIssueOpen(false)}
        title="Issue a voucher"
        subtitle="Give someone a voucher for free. We email it to them if you add an email."
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
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canIssue) setIssueConfirm(true);
          }}
        >
          <Field label="Bundle" htmlFor="issue-product">
            <Select id="issue-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.active ? "" : " (switched off)"}
                </option>
              ))}
            </Select>
          </Field>
          {chosen && <p className="text-sm text-gray-600 dark:text-gray-300">Covers {summariseItems(chosen.items)}.</p>}

          <Field label="Who is it for?" htmlFor="issue-holder" hint="The bar checks this name when the voucher is used.">
            <Input
              id="issue-holder"
              value={holderName}
              maxLength={100}
              onChange={(e) => setHolderName(e.target.value)}
              placeholder="Full name"
            />
          </Field>
          <Field label="Their email (optional)" htmlFor="issue-email" hint="We send the voucher and its QR code here.">
            <Input
              id="issue-email"
              type="email"
              value={holderEmail}
              onChange={(e) => setHolderEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </Field>

          <div className="space-y-2">
            <Field
              label="Link to an account (optional)"
              htmlFor="issue-account"
              hint="The voucher then shows in that person's My Vouchers."
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
            {linked ? (
              <p className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                <span className="min-w-0 break-words">Linked to {linked.name || linked.email}</span>
                <IconButton icon={XMarkIcon} label="Remove the linked account" onClick={() => setLinked(null)} />
              </p>
            ) : (
              userSearch.length >= 3 && (
                <ul className="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700">
                  {(userResults.data ?? NO_USERS).map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="w-full min-h-11 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => {
                          setLinked(u);
                          if (!holderName.trim()) setHolderName(u.name);
                          if (!holderEmail.trim()) setHolderEmail(u.email);
                        }}
                      >
                        <span className="font-bold">{u.name || u.email}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 break-all">{u.email}</span>
                      </button>
                    </li>
                  ))}
                  {!userResults.isLoading && !userResults.data?.length && (
                    <li className="px-3 py-2 text-sm text-gray-500">No accounts match.</li>
                  )}
                </ul>
              )
            )}
          </div>

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
        </form>
      </Modal>

      <ConfirmDialog
        open={issueConfirm && !!chosen}
        title="Issue this voucher?"
        description={holderEmail.trim() ? "It will be emailed to them now." : "No email was added, so share the link yourself."}
        body={
          chosen && (
            <ConfirmSummary
              rows={[
                ["Bundle", chosen.name],
                ["For", holderName.trim()],
                ["Valid", formatVoucherRange(from, to)],
              ]}
            />
          )
        }
        confirmLabel="Issue voucher"
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
