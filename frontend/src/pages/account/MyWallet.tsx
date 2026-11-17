import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  PlusIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";
import { Button, Field, Input, LedgerTable, Modal, WALLET_QUERY_KEY } from "../../components";
import { formatKobo, getWallet, startWalletTopup } from "../../services";
import { getApiErrorMessage, rememberWalletReturn } from "../../utils";
import { useIdempotencyKey } from "../../hooks";
import { useAuth } from "../../contexts";

const PRESETS_KOBO = [100_000, 200_000, 500_000, 1_000_000];

/** "1500" or "1,500.50" typed in naira -> kobo, or null when it isn't an amount. */
const nairaToKobo = (text: string): number | null => {
  const clean = text.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
};

export const MyWallet = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [searchParams] = useSearchParams();

  // ?topup=<kobo> opens the top-up form with that amount filled in, so a page that
  // finds the balance short (a voucher purchase) can send people straight here.
  const requested = Number(searchParams.get("topup"));
  // ?return=<path> is where the person was (a checkout) before topping up. It is
  // kept for the confirm page, which offers the way back. Same-site paths only.
  const back = searchParams.get("return") ?? "";
  useEffect(() => {
    rememberWalletReturn(back || null);
  }, [back]);
  const [topupOpen, setTopupOpen] = useState(requested > 0);
  const [amountText, setAmountText] = useState(
    requested > 0 ? String(requested / 100) : "",
  );

  const wallet = useQuery({
    queryKey: WALLET_QUERY_KEY,
    queryFn: getWallet,
    enabled: isAuthenticated,
    staleTime: 0,
  });

  const amountKobo = nairaToKobo(amountText);
  const limits = wallet.data;

  const amountError = useMemo(() => {
    if (!amountText.trim()) return undefined;
    if (amountKobo === null) return "Enter an amount in naira, like 2500.";
    if (!limits) return undefined;
    if (amountKobo < limits.min_topup_kobo)
      return `The smallest top-up is ${formatKobo(limits.min_topup_kobo)}.`;
    if (amountKobo > limits.max_topup_kobo)
      return `The largest top-up is ${formatKobo(limits.max_topup_kobo)}.`;
    if (amountKobo + limits.balance_kobo > limits.max_balance_kobo)
      return `Your wallet can hold up to ${formatKobo(limits.max_balance_kobo)}.`;
    return undefined;
  }, [amountText, amountKobo, limits]);

  // One key per top-up attempt: pressing Pay twice starts one Paystack payment.
  const attempt = useIdempotencyKey();
  const topup = useMutation({
    mutationFn: (kobo: number) => startWalletTopup(kobo, attempt.current()),
    // Paystack takes over from here and sends the person back to /wallet/confirm.
    onSuccess: (init) => {
      attempt.settle();
      window.location.href = init.authorization_url;
    },
    onError: (err) => {
      attempt.settle(err);
      toast.error(getApiErrorMessage(err, "We could not start that payment."));
    },
  });

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const canPay = amountKobo !== null && !amountError && !!limits;

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
          My Wallet
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
          Add money with your card or bank, then spend it inside Showtime.
        </p>
      </div>

      <section
        aria-labelledby="wallet-balance"
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <h2
            id="wallet-balance"
            className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-gray-500"
          >
            <WalletIcon className="w-4 h-4 text-sffl-red" aria-hidden="true" />
            Balance
          </h2>
          <p className="text-4xl font-black text-sffl-navy dark:text-white mt-1 break-words">
            {wallet.data ? formatKobo(wallet.data.balance_kobo) : "—"}
          </p>
        </div>
        <Button
          icon={PlusIcon}
          size="lg"
          disabled={!wallet.data}
          onClick={() => setTopupOpen(true)}
        >
          Add Money
        </Button>
      </section>

      <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
        <InformationCircleIcon
          className="w-4 h-4 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        Wallet money can be spent inside Showtime. It cannot be withdrawn or sent
        to someone else.
      </p>

      {wallet.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          We could not load your wallet.{" "}
          <Button variant="link" onClick={() => wallet.refetch()}>
            Try again
          </Button>
        </p>
      )}

      <section aria-labelledby="wallet-history" className="space-y-3">
        <h2
          id="wallet-history"
          className="text-lg font-black text-sffl-navy dark:text-white"
        >
          History
        </h2>
        <LedgerTable
          entries={wallet.data?.transactions}
          loading={wallet.isLoading}
        />
      </section>

      <Modal
        open={topupOpen}
        onClose={() => !topup.isPending && setTopupOpen(false)}
        title="Add money to your wallet"
        subtitle="You will pay securely on Paystack, then come back here."
        maxWidth="md"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={topup.isPending}
              onClick={() => setTopupOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="topup-form"
              loading={topup.isPending}
              disabled={!canPay}
            >
              {canPay ? `Pay ${formatKobo(amountKobo!)}` : "Pay"}
            </Button>
          </>
        }
      >
        <form
          id="topup-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canPay && !topup.isPending) topup.mutate(amountKobo!);
          }}
        >
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-label="Quick amounts"
          >
            {PRESETS_KOBO.map((kobo) => (
              <Button
                key={kobo}
                variant={amountKobo === kobo ? "primary" : "outline"}
                onClick={() => setAmountText(String(kobo / 100))}
              >
                {formatKobo(kobo).replace(/\.00$/, "")}
              </Button>
            ))}
          </div>
          <Field
            label="Or enter an amount (₦)"
            htmlFor="topup-amount"
            error={amountError}
            hint={
              limits
                ? `Between ${formatKobo(limits.min_topup_kobo).replace(/\.00$/, "")} and ${formatKobo(limits.max_topup_kobo).replace(/\.00$/, "")}.`
                : undefined
            }
          >
            <Input
              id="topup-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="2500"
              value={amountText}
              invalid={!!amountError}
              onChange={(e) => setAmountText(e.target.value)}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
};
