import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LockClosedIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface AuthPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    returnUrl: string;
    actionText?: string;
}

export const AuthPromptModal: React.FC<AuthPromptModalProps> = ({
    isOpen,
    onClose,
    returnUrl,
    actionText = 'join the discussion',
}) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    // returnUrl travels in both the query string and router state: state survives
    // the hop to the sign-up page and back, the query string survives a reload or
    // a link the user copies out mid-flow.
    const goToAuth = (path: '/login' | '/signup') => {
        onClose();
        navigate(`${path}?returnUrl=${encodeURIComponent(returnUrl)}`, {
            state: { returnUrl },
        });
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700 overflow-hidden relative"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    <XMarkIcon className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center space-y-4 pt-2">
                    <div className="w-16 h-16 rounded-2xl bg-sffl-red/10 dark:bg-sffl-red/20 text-sffl-red flex items-center justify-center ring-8 ring-sffl-red/5">
                        <LockClosedIcon className="w-8 h-8" />
                    </div>

                    <div>
                        <h3 className="text-xl font-black text-sffl-navy dark:text-white">
                            Sign In Required
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Please log in to {actionText} and share your thoughts.
                        </p>
                    </div>

                    <div className="w-full space-y-2 pt-2">
                        <button
                            onClick={() => goToAuth('/login')}
                            className="w-full bg-sffl-red hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-transform active:scale-95 text-sm"
                        >
                            Log In
                        </button>
                        <button
                            onClick={() => goToAuth('/signup')}
                            className="w-full bg-sffl-navy hover:bg-sffl-navy/90 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl text-sm transition-colors"
                        >
                            Create an Account
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-6 rounded-xl text-sm transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 pt-1">
                        We'll bring you straight back here when you're done.
                    </p>
                </div>
            </div>
        </div>
    );
};
