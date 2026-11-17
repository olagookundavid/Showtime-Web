import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WalletIcon } from "@heroicons/react/24/outline";
import { Checkbox } from "../ui";
import { formatKobo, getWallet } from "../../services";

interface WalletPayOptionProps {
  /** What the buyer would pay, in kobo. */
  totalKobo: number;
  /** True when the buyer chose to pay from their wallet. */
  checked: boolean;
  onChange: (useWallet: boolean) => void;
  /** Called once the balance is known (null while loading or when it can't be read). */
  onBalance?: (balanceKobo: number | null) => void;
}

/**
 * "Pay with wallet" for a checkout. It reads the signed-in buyer's balance, offers
 * the choice only when the wallet covers the total, and otherwise links to a top-up
 * for exactly the shortfall. Render it only for signed-in buyers.
 */
export const WalletPayOption = ({
  totalKobo,
  checked,
  onChange,
  onBalance,
}: WalletPayOptionProps) => {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    getWallet()
      .then((w) => {
        if (!live) return;
        setBalance(w.balance_kobo);
        onBalance?.(w.balance_kobo);
      })
      .catch(() => {
        if (live) onBalance?.(null);
      });
    return () => {
      live = false;
    };
    // onBalance is a notification only; re-reading the wallet when its identity changes would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enough = balance !== null && balance >= totalKobo;

  // If the total grows past the balance while the box is ticked, untick it.
  useEffect(() => {
    if (balance !== null && !enough && checked) onChange(false);
  }, [balance, enough, checked, onChange]);

  if (balance === null || totalKobo <= 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <WalletIcon className="h-4 w-4" />
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
            to={`/account/wallet?topup=${totalKobo - balance}`}
            className="font-bold text-sffl-red hover:underline"
          >
            Top up
          </Link>
        </p>
      )}
    </div>
  );
};
