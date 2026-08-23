import { useEffect, useRef, useState } from 'react';
import { 
    EnvelopeIcon, 
    XMarkIcon, 
    CheckCircleIcon, 
    UserIcon, 
    ArrowRightIcon 
} from '@heroicons/react/24/outline';
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
            setError('Please enter your first name.');
            return;
        }
        if (!EMAIL_PATTERN.test(submittedEmail.trim())) {
            e.preventDefault();
            setError('Please enter a valid email address.');
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

            {/* Sits top-right above page chrome (z-[70]) */}
            <div className="fixed inset-x-0 top-0 z-[70] p-3 sm:p-5 flex justify-end pointer-events-none">
                <div className="w-full max-w-sm sm:max-w-md pointer-events-auto bg-white dark:bg-[#0B111E] rounded-2xl shadow-[0_20px_50px_-10px_rgba(0,31,63,0.18)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border border-neutral-200/90 dark:border-neutral-800 overflow-hidden animate-newsletter-in transition-all">
                    {/* Editorial SFFL Red Accent Header Stripe */}
                    <div className="h-1 w-full bg-gradient-to-r from-sffl-red via-red-500 to-sffl-navy" />

                    <div className="p-5 sm:p-6">
                        {status === 'done' ? (
                            <div className="py-2">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950/50 border border-green-200/60 dark:border-green-800/60">
                                        <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                                        <span className="text-[10px] font-black tracking-[0.18em] uppercase text-green-700 dark:text-green-400">
                                            Pass Issued
                                        </span>
                                    </div>
                                    <button
                                        onClick={close}
                                        aria-label="Close"
                                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-full transition-colors"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                <h3 className="font-serif text-xl font-bold tracking-tight text-sffl-navy dark:text-white leading-tight">
                                    You're on the list.
                                </h3>
                                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
                                    Check your inbox to confirm your subscription and unlock exclusive matchday access.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Top Badge & Close button */}
                                <div className="flex items-center justify-between gap-3 mb-2.5">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200/60 dark:border-red-800/60">
                                        <span className="h-1.5 w-1.5 rounded-full bg-sffl-red animate-pulse" />
                                        <span className="text-[10px] font-black tracking-[0.18em] uppercase text-sffl-red dark:text-red-400">
                                            The Insider Dispatch
                                        </span>
                                    </div>
                                    <button
                                        onClick={dismiss}
                                        aria-label="Close"
                                        className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 rounded-full transition-all active:scale-95 cursor-pointer"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Editorial Headline & Subtitle */}
                                <div className="mb-4">
                                    <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-sffl-navy dark:text-white leading-snug">
                                        Get the matchday edge.
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                                        Fixtures, exclusive highlights & sideline culture — straight to your inbox.
                                    </p>
                                </div>

                                <form
                                    action={BREVO_FORM_URL}
                                    method="POST"
                                    target={IFRAME_NAME}
                                    onSubmit={handleSubmit}
                                    className="space-y-3"
                                >
                                    {usingAccountDetails ? (
                                        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-sffl-red dark:text-red-400">
                                                        Member Access
                                                    </span>
                                                </div>
                                                <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate mt-0.5">
                                                    {accountFirstName} <span className="text-neutral-400 dark:text-neutral-500 font-normal">({accountEmail})</span>
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditing(true);
                                                    setEmail('');
                                                    setFirstName('');
                                                }}
                                                className="text-[11px] font-bold text-sffl-red hover:text-red-700 dark:hover:text-red-400 hover:underline shrink-0 cursor-pointer"
                                            >
                                                Change
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                                                    <UserIcon className="w-4 h-4" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="FIRSTNAME"
                                                    value={firstName}
                                                    onChange={e => setFirstName(e.target.value)}
                                                    placeholder="First name"
                                                    autoComplete="given-name"
                                                    maxLength={200}
                                                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-700 text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:bg-white dark:focus:bg-neutral-900 focus:border-sffl-navy dark:focus:border-white focus:ring-2 focus:ring-sffl-navy/5 dark:focus:ring-white/5 transition-all"
                                                />
                                            </div>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                                                    <EnvelopeIcon className="w-4 h-4" />
                                                </div>
                                                <input
                                                    type="email"
                                                    name="EMAIL"
                                                    value={email}
                                                    onChange={e => setEmail(e.target.value)}
                                                    placeholder="you@example.com"
                                                    autoComplete="email"
                                                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-700 text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:bg-white dark:focus:bg-neutral-900 focus:border-sffl-navy dark:focus:border-white focus:ring-2 focus:ring-sffl-navy/5 dark:focus:ring-white/5 transition-all"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Brevo's spam trap: must be present and empty. */}
                                    <input type="text" name="email_address_check" value="" readOnly hidden />
                                    <input type="hidden" name="locale" value="en" />

                                    {error && (
                                        <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 px-2.5 py-1 rounded-lg">
                                            {error}
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={status === 'submitting'}
                                        className="group w-full flex items-center justify-center gap-2 bg-sffl-navy hover:bg-[#002B59] dark:bg-white dark:text-sffl-navy dark:hover:bg-neutral-100 text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-[0.18em] shadow-sm active:scale-[0.98] transition-all disabled:opacity-60 disabled:active:scale-100 cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        {status === 'submitting' ? (
                                            <>
                                                <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                <span>Subscribing…</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Get Insider Access</span>
                                                <ArrowRightIcon className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                                            </>
                                        )}
                                    </button>

                                    <p className="text-[10px] text-center text-neutral-400 dark:text-neutral-500 font-medium">
                                        Matchday dispatches only. No spam, 1-click unsubscribe.
                                    </p>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
