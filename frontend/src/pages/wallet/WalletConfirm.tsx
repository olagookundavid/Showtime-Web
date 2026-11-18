import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { ButtonLink, Loader, WALLET_QUERY_KEY } from "../../components";
import { formatKobo, verifyWalletTopup } from "../../services";
import { getApiErrorMessage, readWalletReturn } from "../../utils";
import type { TopupResult } from "../../types";

// A bank transfer can take minutes to settle, so while Paystack still says the
// payment is open we ask again, for up to three minutes.
const POLL_MS = 5_000;
const POLL_FOR_MS = 3 * 60_000;

type Stage = "verifying" | "paid" | "pending" | "failed";

/**
 * Where Paystack sends someone after they pay to top up their wallet. The server
 * checks the reference with Paystack itself, so a refresh, a double visit or the
 * webhook arriving at the same moment can never credit the wallet twice.
 */
export const WalletConfirm = () => {
  const [searchParams] = useSearchParams();
  // Paystack sends both; either may be the one present.
  const reference = searchParams.get("reference") || searchParams.get("trxref");

  const queryClient = useQueryClient();
  // Where the person was (a checkout) before topping up, offered once paid.
  const [returnTo] = useState(readWalletReturn);
  const [stage, setStage] = useState<Stage>(reference ? "verifying" : "failed");
  const [result, setResult] = useState<TopupResult | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Safe to run twice (StrictMode does in development): verifying is idempotent,
    // and the first run's cleanup stops it from updating the page.
    if (!reference) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const giveUpAt = Date.now() + POLL_FOR_MS;

    const check = async () => {
      try {
        const r = await verifyWalletTopup(reference);
        if (cancelled) return;
        setResult(r);
        if (r.status === "PAID") {
          setStage("paid");
          queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
        } else if (r.status === "FAILED") {
          setStage("failed");
        } else if (Date.now() < giveUpAt) {
          timer = setTimeout(check, POLL_MS);
        } else {
          setStage("pending");
        }
      } catch (err) {
        if (cancelled) return;
        setStage("failed");
        setMessage(getApiErrorMessage(err, "We could not confirm that payment."));
      }
    };
    check();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reference, queryClient]);

  if (stage === "verifying") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader />
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Confirming your payment…
        </p>
      </div>
    );
  }

  const ok = stage === "paid";
  const Icon = ok
    ? CheckCircleIcon
    : stage === "pending"
      ? ClockIcon
      : ExclamationTriangleIcon;

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-8 md:p-12 pb-mobile-nav-2x">
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
          ok
            ? "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            : "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
        }`}
      >
        <Icon className="w-10 h-10" aria-hidden="true" />
      </div>

      <h1 className="text-2xl font-black uppercase text-sffl-navy dark:text-white mb-2">
        {ok
          ? "Wallet topped up"
          : stage === "pending"
            ? "Still waiting for your bank"
            : "Payment not confirmed"}
      </h1>
      <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
        {ok && result
          ? `${formatKobo(result.amount_kobo)} is now in your wallet. Your balance is ${formatKobo(result.balance_kobo)}.`
          : stage === "pending"
            ? "Your bank has not confirmed the payment yet. Your wallet will be topped up as soon as it does. You can leave this page."
            : message ||
              "If you completed the payment, it may still be settling. Reopen this link in a moment, or contact us with your reference."}
      </p>

      {reference && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
          Reference: <span className="font-mono">{reference}</span>
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {ok && returnTo && (
          <ButtonLink to={returnTo} icon={ArrowRightIcon} iconPosition="right">
            Back to where you were
          </ButtonLink>
        )}
        <ButtonLink
          to="/account/wallet"
          variant={ok && returnTo ? "secondary" : "primary"}
          icon={ok && returnTo ? undefined : ArrowRightIcon}
          iconPosition="right"
        >
          Back to My Wallet
        </ButtonLink>
      </div>
    </div>
  );
};
