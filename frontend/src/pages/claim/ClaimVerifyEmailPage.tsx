import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { claimApi } from '../../services/api';

/**
 * Landing page for the confirm-your-email link. Verification is informational: it proves
 * the account is recoverable, not that the claimant is who they say. The team manager is
 * what proves identity, so nothing here gates approval.
 */
export const ClaimVerifyEmailPage: React.FC = () => {
    const [params] = useSearchParams();
    const token = params.get('token') || '';
    const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
    const [message, setMessage] = useState('');
    const attempted = useRef(false);

    useEffect(() => {
        document.title = 'Confirm your email — Showtime';

        // Guard against React's double-invoked effects in development consuming the
        // single-use token twice, which would show a spurious failure.
        if (attempted.current) return;
        attempted.current = true;

        if (!token) {
            setState('failed');
            setMessage('This link is missing its confirmation code.');
            return;
        }

        claimApi
            .verifyEmail(token)
            .then(() => setState('done'))
            .catch((err: any) => {
                setState('failed');
                setMessage(err.response?.data?.error || 'This link is invalid or has expired.');
            });
    }, [token]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <div className="max-w-md text-center">
                {state === 'working' && <div className="text-gray-400">Confirming your email…</div>}

                {state === 'done' && (
                    <>
                        <div className="text-4xl mb-3">✓</div>
                        <h1 className="text-xl font-black text-gray-900 dark:text-white">Email confirmed</h1>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Thanks. Your team manager still needs to approve your claim — you will be
                            notified once they do.
                        </p>
                        <Link
                            to="/claim/status"
                            className="inline-block mt-6 px-5 py-3 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg"
                        >
                            View my claim status
                        </Link>
                    </>
                )}

                {state === 'failed' && (
                    <>
                        <div className="text-4xl mb-3">✕</div>
                        <h1 className="text-xl font-black text-gray-900 dark:text-white">Could not confirm</h1>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{message}</p>
                        <p className="mt-4 text-xs text-gray-400">
                            You can request a fresh link from your claim status page. This does not affect
                            your manager's ability to approve you.
                        </p>
                        <Link
                            to="/claim/status"
                            className="inline-block mt-6 px-5 py-3 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg"
                        >
                            Go to my claim status
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
};

export default ClaimVerifyEmailPage;
