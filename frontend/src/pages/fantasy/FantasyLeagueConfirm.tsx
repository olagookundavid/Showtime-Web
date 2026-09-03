import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { fantasyApi } from '../../services/api';
import { Loader } from '../../components/ui/Loader';

/**
 * Where Paystack returns a manager after paying a league entry fee.
 *
 * Without this the payment loop never closed: the membership was created as
 * PENDING, the payer was sent to Paystack, and nothing ever promoted them to
 * PAID. The webhook cannot be relied on for that — it can't reach a local
 * machine at all — so the returning browser confirms the reference itself.
 * Verification is idempotent and re-checks with Paystack, so a refresh, a
 * double fire, or a webhook that also lands are all harmless.
 */
export function FantasyLeagueConfirm() {
    const [searchParams] = useSearchParams();
    // Paystack sends both; either may be the one present.
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    const queryClient = useQueryClient();
    const firedRef = useRef(false);
    const [state, setState] = useState<'verifying' | 'paid' | 'failed'>(
        reference ? 'verifying' : 'failed'
    );
    const [message, setMessage] = useState<string>('');

    useEffect(() => {
        if (!reference || firedRef.current) return;
        firedRef.current = true;

        fantasyApi
            .verifyLeaguePayment(reference)
            .then(() => {
                setState('paid');
                // The league now counts the manager as PAID everywhere.
                queryClient.invalidateQueries({ queryKey: ['myFantasyLeagues'] });
                queryClient.invalidateQueries({ queryKey: ['publicFantasyLeagues'] });
                queryClient.invalidateQueries({ queryKey: ['fantasyDashboard'] });
            })
            .catch((err: any) => {
                setState('failed');
                setMessage(err?.response?.data?.error || 'We could not confirm that payment.');
            });
    }, [reference, queryClient]);

    if (state === 'verifying') {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader />
                <p className="text-sm text-gray-600 dark:text-gray-300">Confirming your payment…</p>
            </div>
        );
    }

    const ok = state === 'paid';

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
            <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                    ok
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                }`}
            >
                {ok ? (
                    <CheckCircleIcon className="w-10 h-10" />
                ) : (
                    <ExclamationTriangleIcon className="w-10 h-10" />
                )}
            </div>

            <h1 className="text-2xl font-black uppercase text-sffl-navy dark:text-white mb-2">
                {ok ? "You're in" : 'Payment not confirmed'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
                {ok
                    ? 'Your entry fee has been received and your place in the league is confirmed. Good luck.'
                    : message ||
                      'If you completed the payment, it may still be settling — reopen this link in a moment, or contact us with your reference.'}
            </p>

            {reference && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                    Reference: <span className="font-mono">{reference}</span>
                </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                    to="/fantasy/leagues"
                    className="px-6 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-sm shadow-md transition-all active:scale-95 inline-flex items-center gap-1.5"
                >
                    My Leagues <ArrowRightIcon className="w-4 h-4" />
                </Link>
                <Link
                    to="/fantasy/dashboard"
                    className="px-6 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-sm transition"
                >
                    Dashboard
                </Link>
            </div>
        </div>
    );
}
