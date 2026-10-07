import React, { useEffect, useRef, useState } from "react";
import {
  TagIcon,
  XMarkIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { discountsApi } from "../../services/api";
import type { CheckoutItemPayload } from "../../types/store";
import type { DiscountPreview } from "../../types/discounts";
import { Button, IconButton, Input } from "../ui";

interface DiscountCodeInputProps {
  /** Storefront cart to price the code against. */
  items?: CheckoutItemPayload[];
  /** Ticket purchase to price the code against. */
  tierId?: string;
  quantity?: number;
  /**
   * Fires whenever the applied code changes — with the preview when one is
   * successfully applied, or null when it is removed or becomes invalid. The
   * parent uses this to show the reduced total and to send the code onward.
   */
  onChange: (preview: DiscountPreview | null) => void;
  disabled?: boolean;
}

export const DiscountCodeInput: React.FC<DiscountCodeInputProps> = ({
  items,
  tierId,
  quantity,
  onChange,
  disabled = false,
}) => {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<DiscountPreview | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  // The cart signature. When it changes, an already-applied code has to be
  // re-priced: adding or removing items changes what the code is worth, and a
  // stale saving on screen is a saving the buyer won't actually get.
  const signature = JSON.stringify({ items, tierId, quantity });
  const lastSignature = useRef(signature);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const runPreview = async (raw: string): Promise<DiscountPreview | null> => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return discountsApi.preview({
      code: trimmed,
      items,
      tier_id: tierId,
      quantity,
    });
  };

  const apply = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setChecking(true);
    setError("");
    try {
      const preview = await runPreview(trimmed);
      if (preview && preview.valid) {
        setApplied(preview);
        onChangeRef.current(preview);
      } else {
        setApplied(null);
        setError(preview?.message || "This code isn't valid");
        onChangeRef.current(null);
      }
    } catch (err: unknown) {
      setApplied(null);
      const responseError =
        typeof err === "object" && err !== null && "response" in err
          ? err.response
          : null;
      const responseData =
        typeof responseError === "object" &&
        responseError !== null &&
        "data" in responseError
          ? responseError.data
          : null;
      const message =
        typeof responseData === "object" &&
        responseData !== null &&
        "error" in responseData &&
        typeof responseData.error === "string"
          ? responseData.error
          : "Could not check that code right now";
      setError(message);
      onChangeRef.current(null);
    } finally {
      setChecking(false);
    }
  };

  const remove = () => {
    setApplied(null);
    setCode("");
    setError("");
    onChangeRef.current(null);
  };

  // Re-price an applied code whenever the cart changes underneath it.
  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    if (!applied) return;

    let cancelled = false;
    (async () => {
      try {
        const preview = await runPreview(applied.code);
        if (cancelled) return;
        if (preview && preview.valid) {
          setApplied(preview);
          onChangeRef.current(preview);
        } else {
          setApplied(null);
          setError(
            preview?.message || "That code no longer applies to your order",
          );
          onChangeRef.current(null);
        }
      } catch {
        if (cancelled) return;
        setApplied(null);
        setError("That code no longer applies to your order");
        onChangeRef.current(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signature, applied]);

  if (applied) {
    return (
      <div className="border border-green-200 dark:border-green-800/60 bg-green-50 dark:bg-green-900/20 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-bold text-sm text-green-800 dark:text-green-300 truncate">
                {applied.code} applied
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 font-semibold">
                You save ₦{applied.discount_amount.toLocaleString()}
              </p>
              {applied.lines.length > 1 && (
                <ul className="mt-1.5 space-y-0.5">
                  {applied.lines.map((line) => (
                    <li
                      key={`${line.entity_type}:${line.entity_id}`}
                      className="text-[11px] text-green-700/80 dark:text-green-400/80 flex justify-between gap-3"
                    >
                      <span className="truncate">{line.name}</span>
                      <span className="font-bold whitespace-nowrap">
                        −₦{line.amount_off.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <IconButton
            variant="ghost"
            icon={XMarkIcon}
            label="Remove code"
            className="-m-2 shrink-0"
            disabled={disabled}
            onClick={remove}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
        <TagIcon className="w-4 h-4" />
        Discount code
      </label>
      <div className="flex gap-2">
        <Input
          type="text"
          aria-label="Discount code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Standalone control inside a checkout form — Enter
              // must apply the code, not submit the order.
              e.preventDefault();
              apply();
            }
          }}
          placeholder="Enter code"
          autoCapitalize="characters"
          disabled={disabled || checking}
          shape="square"
          className="flex-1"
        />
        <Button
          variant="navy"
          shape="square"
          className="whitespace-nowrap"
          loading={checking}
          disabled={disabled || !code.trim()}
          onClick={apply}
        >
          {checking ? "Checking" : "Apply"}
        </Button>
      </div>
      {error && (
        <p className="text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};
