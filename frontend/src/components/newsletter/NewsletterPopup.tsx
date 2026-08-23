import { useEffect, useRef, useState } from 'react';
import { EnvelopeIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useNewsletterPrompt } from '../../hooks/useNewsletterPrompt';

/** Brevo's hosted form endpoint. Dormant until this is set. */
const BREVO_FORM_URL = import.meta.env.VITE_BREVO_FORM_URL as string | undefined;

const IFRAME_NAME = 'brevo-newsletter-sink';
/** If Brevo never loads the response frame, stop spinning and move on. */
const SUBMIT_TIMEOUT_MS = 8000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NewsletterPopup = () => {
    const { isOpen, dismiss, markSubscribed, close } = useNewsletterPrompt();
    const { user } = useAuth();

    const [email, setEmail] = useState('');
    const [editing, setEditing] = useState(false);
    const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
    const [error, setError] = useState('');
    const submittingRef = useRef(false);

    // Logged-in visitors get their address pre-filled; everyone else types one.
    const accountEmail = user?.email ?? '';
    const usingAccountEmail = !!accountEmail && !editing;
    const submittedEmail = usingAccountEmail ? accountEmail : email;

    const finish = () => {
        submittingRef.current = false;
        markSubscribed();
        setStatus('done');
    };

    useEffect(() => {
        if (status !== 'submitting') return;
        const timer = setTimeout(() => finish(), SUBMIT_TIMEOUT_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    // Auto-close shortly after the thank-you so the card doesn't linger.
    useEffect(() => {
        if (status !== 'done') return;
        const timer = setTimeout(() => close(), 3500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    if (!isOpen || !BREVO_FORM_URL) return null;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        if (!EMAIL_PATTERN.test(submittedEmail.trim())) {
            e.preventDefault();
            setError('Enter a valid email address.');
            return;
        }
        // Deliberately NOT calling preventDefault: the browser posts the form
        // to the hidden iframe below. A real form post isn't subject to CORS,
        // which a fetch() to Brevo would be.
        setError('');
        submittingRef.current = true;
        setStatus('submitting');
    };

    // A fresh iframe fires load once for its blank document; only the load that
    // follows an actual submit means Brevo answered.
    const handleIframeLoad = () => {
        if (!submittingRef.current) return;
        finish();
    };

    return (
        <>
            <iframe
                name={IFRAME_NAME}
                title="Newsletter submission"
                onLoad={handleIframeLoad}
                className="hidden"
            />

            <div className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:p-0 sm:max-w-sm w-full pointer-events-none">
                <div className="pointer-events-auto bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300 mb-14 sm:mb-0">
                    <div className="relative p-6">
                        <button
                            onClick={dismiss}
                            aria-label="Close"
                            className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>

                        {status === 'done' ? (
                            <div className="flex items-start gap-3 pr-6">
                                <CheckCircleIcon className="w-8 h-8 text-green-500 shrink-0" />
                                <div>
                                    <h3 className="font-black italic uppercase tracking-tighter text-lg text-sffl-navy dark:text-white">
                                        You're in
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Check your inbox to confirm your subscription.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-2 pr-6">
                                    <EnvelopeIcon className="w-5 h-5 text-sffl-red" />
                                    <h3 className="font-black italic uppercase tracking-tighter text-lg text-sffl-navy dark:text-white">
                                        Showtime Newsletter
                                    </h3>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                    Match highlights, fixtures and league news — straight to your inbox.
                                </p>

                                <form
                                    action={BREVO_FORM_URL}
                                    method="POST"
                                    target={IFRAME_NAME}
                                    onSubmit={handleSubmit}
                                    className="space-y-3"
                                >
                                    {usingAccountEmail ? (
                                        <div>
                                            <input type="hidden" name="EMAIL" value={accountEmail} />
                                            <p className="text-sm text-gray-900 dark:text-white font-semibold break-all">
                                                {accountEmail}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => { setEditing(true); setEmail(''); }}
                                                className="text-xs text-sffl-red hover:underline mt-1"
                                            >
                                                Use a different email
                                            </button>
                                        </div>
                                    ) : (
                                        <input
                                            type="email"
                                            name="EMAIL"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            autoComplete="email"
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sffl-red/50"
                                        />
                                    )}

                                    {/* Brevo's spam trap: must be present and empty. */}
                                    <input type="text" name="email_address_check" value="" readOnly hidden />
                                    <input type="hidden" name="locale" value="en" />

                                    {error && <p className="text-xs text-red-500">{error}</p>}

                                    <button
                                        type="submit"
                                        disabled={status === 'submitting'}
                                        className="w-full bg-sffl-navy dark:bg-white dark:text-sffl-navy text-white font-black py-3 rounded-xl text-sm uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100"
                                    >
                                        {status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
