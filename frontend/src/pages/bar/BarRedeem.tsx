import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowPathIcon,
  CameraIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  Button,
  ConfirmDialog,
  ConfirmSummary,
  Field,
  Input,
  QrScanner,
  VoucherContents,
  VoucherStateBadge,
  formatVoucherRange,
  summariseVoucher,
} from "../../components";
import { barLookupVoucher, barRedeemVoucher } from "../../services";
import { getApiErrorMessage } from "../../utils";
import type { Voucher } from "../../types";

type Outcome = "ready" | "redeemed" | "refused";

interface Shown {
  voucher: Voucher;
  outcome: Outcome;
}

/** The bar screen: scan or type a voucher code, check who it is for, and redeem it. */
export const BarRedeem = () => {
  const [scanning, setScanning] = useState(false);
  const [codeText, setCodeText] = useState("");
  const [shown, setShown] = useState<Shown | null>(null);
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();

  const lookup = useMutation({
    mutationFn: (code: string) => barLookupVoucher(code),
    onSuccess: (voucher) => {
      setShown({ voucher, outcome: voucher.redeemable ? "ready" : "refused" });
      setCodeText("");
    },
    onError: (err) => {
      setShown(null);
      toast.error(getApiErrorMessage(err, "We could not find that voucher."));
    },
  });

  const redeem = useMutation({
    mutationFn: (code: string) => barRedeemVoucher(code),
    onSuccess: (result) => {
      setConfirming(false);
      setShown({ voucher: result.voucher, outcome: result.redeemed ? "redeemed" : "refused" });
      if (result.redeemed) {
        toast.success("Voucher redeemed");
        // The admin voucher lists are cached; make them show this redemption.
        queryClient.invalidateQueries({ queryKey: ["adminVouchers"] });
        queryClient.invalidateQueries({ queryKey: ["adminVoucherRedemptions"] });
        queryClient.invalidateQueries({ queryKey: ["myVouchers"] });
      }
    },
    onError: (err) => {
      setConfirming(false);
      toast.error(getApiErrorMessage(err, "We could not redeem that voucher."));
    },
  });

  const reset = () => {
    setShown(null);
    setScanning(false);
    setCodeText("");
  };

  const v = shown?.voucher;

  return (
    <div className="space-y-6 animate-fadeIn max-w-lg mx-auto pb-mobile-nav-2x">
      <div className="pb-4 border-b dark:border-gray-800">
        <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white uppercase leading-none">
          Redeem Voucher
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
          Scan the QR code, or type the code, then check the name before you hand anything over.
        </p>
      </div>

      {!v && (
        <section aria-label="Find a voucher" className="space-y-4">
          {scanning ? (
            <div className="space-y-3">
              <QrScanner
                onScan={(text) => {
                  setScanning(false);
                  lookup.mutate(text);
                }}
                onError={(message) => {
                  setScanning(false);
                  toast.error(message);
                }}
              />
              <Button
                variant="secondary"
                icon={XMarkIcon}
                fullWidth
                onClick={() => setScanning(false)}
              >
                Stop Scanning
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              icon={CameraIcon}
              fullWidth
              loading={lookup.isPending}
              onClick={() => setScanning(true)}
            >
              Scan QR Code
            </Button>
          )}

          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (codeText.trim()) lookup.mutate(codeText.trim());
            }}
          >
            <Field
              label="Or type the code"
              htmlFor="bar-code"
              hint="It starts with VCH- and is printed under the QR code."
            >
              <Input
                id="bar-code"
                icon={QrCodeIcon}
                value={codeText}
                onChange={(e) => setCodeText(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="VCH-XXXXXXXXXX"
              />
            </Field>
            <Button
              type="submit"
              variant="outline"
              icon={MagnifyingGlassIcon}
              fullWidth
              loading={lookup.isPending}
              disabled={!codeText.trim()}
            >
              Look Up
            </Button>
          </form>
        </section>
      )}

      {v && shown && (
        <section
          aria-label="Voucher details"
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden"
        >
          <div
            className={`p-5 space-y-2 ${
              shown.outcome === "redeemed"
                ? "bg-emerald-700 text-white"
                : shown.outcome === "ready"
                  ? "bg-sffl-navy text-white"
                  : "bg-red-700 text-white"
            }`}
          >
            <VoucherStateBadge state={v.state} />
            <p className="text-sm font-semibold">
              {shown.outcome === "redeemed"
                ? v.kind === "VALUE"
                  ? "Redeemed. Take the amount below off the bill."
                  : "Redeemed. Hand over the items below."
                : shown.outcome === "ready"
                  ? "Valid today. Check the name, then redeem."
                  : v.state_message}
            </p>
          </div>

          <div className="p-5 space-y-5">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                This voucher is for
              </p>
              <p className="text-3xl font-black text-sffl-navy dark:text-white break-words">
                {v.holder_name}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                {v.kind === "VALUE" ? `${v.name}, worth` : `${v.name} covers`}
              </p>
              <VoucherContents voucher={v} />
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Valid {formatVoucherRange(v.valid_from, v.valid_to)}
            </p>
            <p className="font-mono text-sm font-bold tracking-widest text-gray-500 break-all">
              {v.code}
            </p>

            {shown.outcome === "ready" && (
              <Button
                size="lg"
                icon={CheckCircleIcon}
                variant="success"
                fullWidth
                onClick={() => setConfirming(true)}
              >
                Redeem Voucher
              </Button>
            )}
            <Button
              variant={shown.outcome === "ready" ? "secondary" : "primary"}
              icon={ArrowPathIcon}
              fullWidth
              onClick={reset}
            >
              {shown.outcome === "ready" ? "Cancel" : "Next Voucher"}
            </Button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirming && !!v}
        title="Redeem this voucher?"
        description="A voucher can only be used once. Make sure the person in front of you is the one named."
        body={
          v && (
            <ConfirmSummary
              rows={[
                ["For", v.holder_name],
                [v.kind === "VALUE" ? "Take off the bill" : "Items", summariseVoucher(v)],
                ["Code", v.code],
              ]}
            />
          )
        }
        confirmLabel="Redeem"
        tone="success"
        icon={CheckCircleIcon}
        pending={redeem.isPending}
        onConfirm={() => v && redeem.mutate(v.code)}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
};
