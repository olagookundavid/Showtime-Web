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
    const [firstName, setFirstName] = useState('');
    const [editing, setEditing] = useState(false);
    const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
    const [error, setError] = useState('');
    const submittingRef = useRef(false);

    // Logged-in visitors get their details pre-filled; everyone else types them.
    // Brevo's FIRSTNAME field wants a given name, and the account stores a full
    // name, so take the leading word.
    const accountEmail = user?.email ?? '';
    const accountFirstName = (user?.name ?? '').trim().split(/\s+/)[0] ?? '';
    const usingAccountDetails = !!accountEmail && !editing;
    const submittedEmail = usingAccountDetails ? accountEmail : email;
    const submittedFirstName = usingAccountDetails ? accountFirstName : firstName;

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
        if (!submittedFirstName.trim()) {
            e.preventDefault();
            setError('Enter your first name.');
            return;
        }
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

            {/* Sits above the sticky navbar (z-50) so it reads as an overlay
                rather than part of the page chrome. */}
            <div className="fixed inset-x-0 top-0 z-[70] p-3 sm:p-6 flex justify-end pointer-events-none">
                <div className="w-full max-w-md pointer-events-auto bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-newsletter-in">
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
                                    {usingAccountDetails ? (
                                        <div>
                                            <input type="hidden" name="FIRSTNAME" value={accountFirstName} />
                                            <input type="hidden" name="EMAIL" value={accountEmail} />
                                            <p className="text-sm text-gray-900 dark:text-white font-semibold break-all">
                                                {accountFirstName} · {accountEmail}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditing(true);
                                                    setEmail('');
                                                    setFirstName('');
                                                }}
                                                className="text-xs text-sffl-red hover:underline mt-1"
                                            >
                                                Use different details
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                name="FIRSTNAME"
                                                value={firstName}
                                                onChange={e => setFirstName(e.target.value)}
                                                placeholder="First name"
                                                autoComplete="given-name"
                                                maxLength={200}
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sffl-red/50"
                                            />
                                            <input
                                                type="email"
                                                name="EMAIL"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                placeholder="you@example.com"
                                                autoComplete="email"
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sffl-red/50"
                                            />
                                        </>
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
