import React, { useEffect, useRef, useState } from 'react';
import { TagIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { discountsApi, type CheckoutItemPayload, type DiscountPreview } from '../../services/api';

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
    const [code, setCode] = useState('');
    const [applied, setApplied] = useState<DiscountPreview | null>(null);
    const [error, setError] = useState('');
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
        setError('');
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
        } catch (err: any) {
            setApplied(null);
            setError(err.response?.data?.error || 'Could not check that code right now');
            onChangeRef.current(null);
        } finally {
            setChecking(false);
        }
    };

    const remove = () => {
        setApplied(null);
        setCode('');
        setError('');
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
                    setError(preview?.message || 'That code no longer applies to your order');
                    onChangeRef.current(null);
                }
            } catch {
                if (cancelled) return;
                setApplied(null);
                setError('That code no longer applies to your order');
                onChangeRef.current(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [signature, applied]);

    if (applied) {
        return (
            <div className="rounded-xl border border-green-200 dark:border-green-800/60 bg-green-50 dark:bg-green-900/20 p-3.5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                        <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="font-bold text-sm text-green-800 dark:text-green-300 truncate">
                                {applied.code} applied
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-400 font-semibold">
                                You save ₦{applied.discount_amount.toLocaleString()}
                            </p>
                            {applied.lines.length > 1 && (
                                <ul className="mt-1.5 space-y-0.5">
                                    {applied.lines.map(line => (
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
                    <button
                        type="button"
                        onClick={remove}
                        disabled={disabled}
                        className="text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200 p-1 rounded-lg flex-shrink-0 disabled:opacity-50"
                        title="Remove code"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
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
                <input
                    type="text"
                    value={code}
                    onChange={e => {
                        setCode(e.target.value);
                        if (error) setError('');
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            // Standalone control inside a checkout form — Enter
                            // must apply the code, not submit the order.
                            e.preventDefault();
                            apply();
                        }
                    }}
                    placeholder="Enter code"
                    autoCapitalize="characters"
                    disabled={disabled || checking}
                    className="flex-1 min-w-0 px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-sffl-red transition-colors disabled:opacity-60"
                />
                <button
                    type="button"
                    onClick={apply}
                    disabled={disabled || checking || !code.trim()}
                    className="px-4 py-2.5 bg-sffl-navy dark:bg-gray-600 hover:bg-sffl-navy/90 dark:hover:bg-gray-500 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    {checking ? 'Checking...' : 'Apply'}
                </button>
            </div>
            {error && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
};
