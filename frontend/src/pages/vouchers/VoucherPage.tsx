import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeftIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import {
  Button,
  VoucherContents,
  VoucherStateBadge,
  formatVoucherRange,
} from "../../components";
import { getVoucherByCode } from "../../services";
import { useAuth } from "../../contexts";

/**
 * One voucher, with the QR code to show at the bar. It opens for anyone holding the
 * code (the emailed link), so people without an account can use it too.
 */
export const VoucherPage = () => {
  const { code = "" } = useParams<{ code: string }>();
  const { isAuthenticated } = useAuth();
  const voucher = useQuery({
    queryKey: ["voucher", code],
    queryFn: () => getVoucherByCode(code),
    enabled: !!code,
    retry: false,
  });

  const v = voucher.data;
  const usable = v?.redeemable ?? false;

  return (
    <div className="space-y-6 animate-fadeIn max-w-lg mx-auto pb-mobile-nav-2x">
      {isAuthenticated && (
        <Link
          to="/vouchers"
          className="inline-flex items-center gap-1.5 min-h-11 text-xs font-bold text-sffl-red hover:underline"
        >
          <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
          All vouchers
        </Link>
      )}

      {voucher.isLoading && <p className="text-sm text-gray-500">Loading your voucher…</p>}

      {voucher.isError && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 space-y-3">
          <h1 className="text-xl font-black text-sffl-navy dark:text-white">
            We could not find that voucher
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Check the link or code and try again.
          </p>
          <Button variant="outline" onClick={() => voucher.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {v && (
        <article className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <header className="bg-sffl-navy text-white p-5 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-300">
              Showtime voucher
            </p>
            <h1 className="text-2xl font-black break-words">{v.name}</h1>
            <VoucherStateBadge state={v.state} />
          </header>

          <div className="p-5 space-y-5">
            {/* White square with a quiet zone so scanners read it in dark mode too. */}
            <div
              className={`mx-auto w-fit rounded-2xl bg-white p-4 border border-gray-200 ${
                usable ? "" : "opacity-40"
              }`}
            >
              <QRCodeSVG value={v.code} size={208} level="M" title={`QR code for ${v.code}`} />
            </div>
            <p className="text-center font-mono text-xl font-extrabold tracking-widest text-sffl-navy dark:text-white break-all">
              {v.code}
            </p>

            {!usable && (
              <p className="rounded-xl bg-gray-100 dark:bg-gray-900/50 p-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-200">
                {v.state_message}
              </p>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <dt className="text-xs font-bold uppercase tracking-widest text-gray-500">For</dt>
                <dd className="text-base font-bold text-sffl-navy dark:text-white break-words">
                  {v.holder_name}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-bold uppercase tracking-widest text-gray-500">Valid</dt>
                <dd className="text-base font-bold text-sffl-navy dark:text-white">
                  {formatVoucherRange(v.valid_from, v.valid_to)}
                </dd>
              </div>
            </dl>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                {v.kind === "VALUE" ? "This voucher is worth" : "This voucher covers"}
              </h2>
              <VoucherContents voucher={v} />
            </div>

            <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <InformationCircleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              Show this at the bar on a valid day. It works once, and only for {v.holder_name}, so
              the bar may ask who you are.
            </p>
          </div>
        </article>
      )}
    </div>
  );
};
