import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  PlusIcon,
  ShoppingCartIcon,
  TicketIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  ConfirmSummary,
  DataTable,
  Field,
  Input,
  Modal,
  VoucherItemsList,
  VoucherStateBadge,
  formatVoucherRange,
  todayInLagos,
  type Column,
} from "../../components";
import {
  formatKobo,
  getWallet,
  isInsufficientBalance,
  listMyVouchers,
  listVoucherProducts,
  purchaseVoucher,
} from "../../services";
import { getApiErrorMessage } from "../../utils";
import { useAuth } from "../../contexts";
import type { Voucher, VoucherProduct } from "../../types";

const NO_VOUCHERS: Voucher[] = [];

export const Vouchers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [buying, setBuying] = useState<VoucherProduct | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [holderName, setHolderName] = useState("");
  const [holderEmail, setHolderEmail] = useState("");
  const [from, setFrom] = useState(todayInLagos());
  const [to, setTo] = useState(todayInLagos());

  const products = useQuery({ queryKey: ["voucherProducts"], queryFn: listVoucherProducts });
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet });
  const mine = useQuery({ queryKey: ["myVouchers"], queryFn: listMyVouchers });

  const today = todayInLagos();
  const balance = wallet.data?.balance_kobo ?? 0;
  const shortfall = buying ? Math.max(0, buying.price_kobo - balance) : 0;
  const datesOk = !!from && !!to && from >= today && to >= from;
  const canReview =
    !!buying && holderName.trim().length > 0 && datesOk && shortfall === 0 && wallet.isSuccess;

  const openBuy = (product: VoucherProduct) => {
    setBuying(product);
    setHolderName(user?.name ?? "");
    setHolderEmail("");
    setFrom(todayInLagos());
    setTo(todayInLagos());
  };

  const purchase = useMutation({
    mutationFn: () =>
      purchaseVoucher({
        product_id: buying!.id,
        holder_name: holderName.trim(),
        holder_email: holderEmail.trim() || undefined,
        valid_from: from,
        valid_to: to,
      }),
    onSuccess: (voucher) => {
      toast.success("Voucher bought");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["myVouchers"] });
      setConfirming(false);
      setBuying(null);
      navigate(`/vouchers/${voucher.code}`);
    },
    onError: (err) => {
      setConfirming(false);
      if (isInsufficientBalance(err)) queryClient.invalidateQueries({ queryKey: ["wallet"] });
      toast.error(getApiErrorMessage(err, "We could not buy that voucher."));
    },
  });

  const columns = useMemo<Column<Voucher>[]>(
    () => [
      {
        header: "Voucher",
        sortable: true,
        sortValue: (v) => v.name,
        cell: (v) => (
          <Link
            to={`/vouchers/${v.code}`}
            className="font-bold text-sffl-red hover:underline break-words"
          >
            {v.name}
          </Link>
        ),
      },
      { header: "For", sortable: true, sortValue: (v) => v.holder_name, cell: (v) => v.holder_name },
      {
        header: "Valid",
        sortable: true,
        sortValue: (v) => v.valid_from,
        cell: (v) => formatVoucherRange(v.valid_from, v.valid_to),
      },
      { header: "Status", cell: (v) => <VoucherStateBadge state={v.state} /> },
    ],
    [],
  );

  return (
    <div className="space-y-6 animate-fadeIn max-w-3xl mx-auto pb-mobile-nav-2x">
      <div className="pb-4 border-b dark:border-gray-800">
        <Link
          to="/account"
          className="inline-flex items-center gap-1.5 min-h-11 text-xs font-bold text-sffl-red hover:underline"
        >
          <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
          My Profile
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white uppercase leading-none">
          Vouchers
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
          Buy a voucher for yourself or a friend, then show its QR code at the bar on the day.
        </p>
      </div>

      <section
        aria-label="Wallet balance"
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="inline-flex items-center gap-2 text-sm font-bold text-sffl-navy dark:text-white">
          <WalletIcon className="w-5 h-5 text-sffl-red" aria-hidden="true" />
          Wallet balance: {wallet.data ? formatKobo(balance) : "—"}
        </p>
        <ButtonLink to="/account/wallet" variant="outline" icon={PlusIcon}>
          Add Money
        </ButtonLink>
      </section>

      <section aria-labelledby="voucher-shop" className="space-y-3">
        <h2 id="voucher-shop" className="text-lg font-black text-sffl-navy dark:text-white">
          Buy a voucher
        </h2>
        {products.isLoading ? (
          <p className="text-sm text-gray-500">Loading vouchers…</p>
        ) : products.isError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            We could not load the vouchers.{" "}
            <Button variant="link" onClick={() => products.refetch()}>
              Try again
            </Button>
          </p>
        ) : products.data && products.data.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.data.map((p) => (
              <article
                key={p.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-5 flex flex-col gap-3 min-w-0"
              >
                <div className="min-w-0">
                  <h3 className="text-base font-black text-sffl-navy dark:text-white break-words">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 break-words">
                      {p.description}
                    </p>
                  )}
                </div>
                <VoucherItemsList items={p.items} />
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <p className="text-xl font-black text-sffl-navy dark:text-white">
                    {formatKobo(p.price_kobo)}
                  </p>
                  <Button icon={ShoppingCartIcon} onClick={() => openBuy(p)}>
                    Buy
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No vouchers are on sale right now. Check back soon.
          </p>
        )}
      </section>

      <section aria-labelledby="my-vouchers" className="space-y-3">
        <h2 id="my-vouchers" className="text-lg font-black text-sffl-navy dark:text-white">
          My vouchers
        </h2>
        <DataTable
          data={mine.data ?? NO_VOUCHERS}
          columns={columns}
          loading={mine.isLoading}
          searchable={false}
          compact
          getRowId={(v) => v.id}
          emptyMessage="You have no vouchers yet. Buy one above and it will show up here."
        />
      </section>

      <Modal
        open={!!buying && !confirming}
        onClose={() => !purchase.isPending && setBuying(null)}
        title={buying ? `Buy ${buying.name}` : "Buy a voucher"}
        subtitle="The voucher is for one person and can be used once, on the dates you choose."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBuying(null)}>
              Cancel
            </Button>
            <Button type="submit" form="voucher-form" disabled={!canReview}>
              Review
            </Button>
          </>
        }
      >
        {buying && (
          <form
            id="voucher-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canReview) setConfirming(true);
            }}
          >
            <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-4">
              <VoucherItemsList items={buying.items} />
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
                Price {formatKobo(buying.price_kobo)}. Your wallet has {formatKobo(balance)}.
              </p>
            </div>

            {shortfall > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Your wallet is {formatKobo(shortfall)} short for this voucher.
                </p>
                <ButtonLink to={`/account/wallet?topup=${shortfall}`} icon={PlusIcon} size="sm">
                  Add {formatKobo(shortfall)} to my wallet
                </ButtonLink>
              </div>
            )}

            <Field
              label="Who is it for?"
              htmlFor="voucher-holder"
              hint="The bar may ask for this name when the voucher is used."
            >
              <Input
                id="voucher-holder"
                value={holderName}
                maxLength={100}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="Full name"
              />
            </Field>
            <Field
              label="Their email (optional)"
              htmlFor="voucher-email"
              hint="We email the voucher to you, and to them if you add this."
            >
              <Input
                id="voucher-email"
                type="email"
                value={holderEmail}
                onChange={(e) => setHolderEmail(e.target.value)}
                placeholder="friend@example.com"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First day" htmlFor="voucher-from">
                <Input
                  id="voucher-from"
                  type="date"
                  min={today}
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    if (to < e.target.value) setTo(e.target.value);
                  }}
                />
              </Field>
              <Field
                label="Last day"
                htmlFor="voucher-to"
                error={!!from && !!to && to < from ? "The last day cannot be before the first." : undefined}
              >
                <Input
                  id="voucher-to"
                  type="date"
                  min={from || today}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={confirming && !!buying}
        title="Buy this voucher?"
        description={`${buying ? formatKobo(buying.price_kobo) : ""} will be taken from your wallet.`}
        body={
          buying && (
            <ConfirmSummary
              rows={[
                ["Voucher", buying.name],
                ["For", holderName.trim()],
                ["Valid", formatVoucherRange(from, to)],
                ["Price", formatKobo(buying.price_kobo)],
              ]}
            />
          )
        }
        confirmLabel="Buy voucher"
        tone="info"
        icon={TicketIcon}
        pending={purchase.isPending}
        onConfirm={() => purchase.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
};
