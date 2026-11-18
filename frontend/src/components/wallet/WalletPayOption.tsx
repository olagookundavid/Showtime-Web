import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { WalletIcon } from "@heroicons/react/24/outline";
import { Checkbox } from "../ui";
import { formatKobo, getWallet } from "../../services";

/** The react-query key every page uses for the signed-in user's wallet. */
export const WALLET_QUERY_KEY = ["wallet"] as const;

interface WalletPayOptionProps {
  /** What the buyer would pay, in kobo. */
  totalKobo: number;
  /** True when the buyer chose to pay from their wallet. */
  checked: boolean;
  onChange: (useWallet: boolean) => void;
}

/**
 * "Pay with wallet" for a checkout. It reads the signed-in buyer's balance, offers
 * the choice only when the wallet covers the total, and otherwise links to a top-up
 * for the shortfall that brings the buyer back here afterwards. Render it only for
 * signed-in buyers.
 *
 * The balance comes from the shared wallet query, read fresh each time this shows,
 * so it is right after a payment anywhere else. After paying (or being told the
 * wallet is short), invalidate WALLET_QUERY_KEY to refresh it.
 */
export const WalletPayOption = ({
  totalKobo,
  checked,
  onChange,
}: WalletPayOptionProps) => {
  const location = useLocation();
  const wallet = useQuery({
    queryKey: WALLET_QUERY_KEY,
    queryFn: getWallet,
    staleTime: 0,
  });
  const balance = wallet.data?.balance_kobo ?? null;
  const enough = balance !== null && balance >= totalKobo;

  // If the total grows past the balance while the box is ticked, untick it.
  useEffect(() => {
    if (balance !== null && !enough && checked) onChange(false);
  }, [balance, enough, checked, onChange]);

  if (!wallet.data || balance === null || totalKobo <= 0) return null;

  // A top-up has a minimum, so a small shortfall is rounded up to it.
  const topupKobo = Math.max(totalKobo - balance, wallet.data.min_topup_kobo);
  const back = encodeURIComponent(location.pathname + location.search);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <WalletIcon className="h-4 w-4" aria-hidden="true" />
        Wallet balance {formatKobo(balance)}
      </div>
      {enough ? (
        <Checkbox
          label={`Pay ${formatKobo(totalKobo)} from my wallet`}
          hint="No card needed."
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      ) : (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Your wallet is short by {formatKobo(totalKobo - balance)}.{" "}
          <Link
            to={`/account/wallet?topup=${topupKobo}&return=${back}`}
            className="font-bold text-sffl-red hover:underline"
          >
            Top up
          </Link>
        </p>
      )}
    </div>
  );
};
