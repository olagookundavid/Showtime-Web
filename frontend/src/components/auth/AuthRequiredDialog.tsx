import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { LockClosedIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface AuthRequiredDialogProps {
    open: boolean;
    /** Dismiss without going anywhere. Omit to hide the Go Back option — use
     *  that only where there is nothing behind the dialogue to go back to. */
    onClose?: () => void;
    /** Where to return after signing in. Same-origin path. */
    returnUrl: string;
    /** What they were trying to do, finishing "Log in to …". */
    actionText?: string;
    /** Overrides the heading when a feature needs to name itself. */
    title?: string;
    /** Label for the dismiss button. */
    closeLabel?: string;
}

/**
 * The single "you need an account for this" gate.
 *
 * Used two ways: as a whole-page gate on a protected route, and as a prompt
 * fired from a button on a page a signed-out visitor can otherwise browse.
 * Either way it explains itself and offers a way forward and a way back — a
 * bare redirect to /login leaves people wondering what happened.
 */
export const AuthRequiredDialog: React.FC<AuthRequiredDialogProps> = ({
    open,
    onClose,
    returnUrl,
    actionText = 'use this feature',
    title = 'Sign In Required',
    closeLabel = 'Go Back',
}) => {
    const navigate = useNavigate();

    if (!open) return null;

    // returnUrl travels in both the query string and router state: state survives
    // the hop to the sign-up page and back, the query string survives a reload or
    // a link the user copies out mid-flow.
    const goToAuth = (path: '/login' | '/signup') => {
        onClose?.();
        navigate(`${path}?returnUrl=${encodeURIComponent(returnUrl)}`, {
            state: { returnUrl },
        });
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200" data-dialog
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] overflow-y-auto overscroll-contain p-6 border border-gray-200 dark:border-gray-700 relative my-auto"
                onClick={e => e.stopPropagation()}
            >
                {onClose && (
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                )}

                <div className="flex flex-col items-center text-center space-y-4 pt-2">
                    <div className="w-16 h-16 rounded-2xl bg-sffl-red/10 dark:bg-sffl-red/20 text-sffl-red flex items-center justify-center ring-8 ring-sffl-red/5">
                        <LockClosedIcon className="w-8 h-8" />
                    </div>

                    <div>
                        <h3 className="text-xl font-black text-sffl-navy dark:text-white">{title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            You need to be logged in to {actionText}.
                        </p>
                    </div>

                    <div className="w-full space-y-2 pt-2">
                        <button
                            onClick={() => goToAuth('/login')}
                            className="w-full bg-sffl-red hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-transform active:scale-95 text-sm cursor-pointer"
                        >
                            Go to Login
                        </button>
                        <button
                            onClick={() => goToAuth('/signup')}
                            className="w-full bg-sffl-navy hover:bg-sffl-navy/90 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl text-sm transition-colors cursor-pointer"
                        >
                            Create an Account
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="w-full bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-6 rounded-xl text-sm transition-colors cursor-pointer"
                            >
                                {closeLabel}
                            </button>
                        )}
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 pt-1">
                        We'll bring you straight back here when you're done.
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};
