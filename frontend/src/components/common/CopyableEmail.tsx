import { useState, type ReactNode } from 'react';
import { CheckIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

interface CopyableEmailProps {
    email: string;
    /** Text or an icon shown before the address. */
    label?: ReactNode;
    className?: string; // Optional wrapper styles
}

export const CopyableEmail = ({ email, label, className = '' }: CopyableEmailProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(email);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 max-w-full min-w-0 ${className}`}>
            {label && <span className="inline-flex items-center font-bold shrink-0">{label}</span>}
            <span className="font-medium text-inherit min-w-0 break-all">{email}</span>
            <button
                type="button"
                onClick={handleCopy}
                className={`inline-flex items-center justify-center gap-1 min-h-11 min-w-11 px-2 rounded-md shrink-0 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sffl-red
                    ${copied
                        ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                        : 'text-sffl-red hover:bg-sffl-red/10'
                    }
                `}
                aria-label={copied ? 'Email copied' : 'Copy email'}
            >
                {copied ? (
                    <>
                        <CheckIcon className="w-4 h-4" aria-hidden="true" />
                        <span className="text-xs font-bold">Copied</span>
                    </>
                ) : (
                    <DocumentDuplicateIcon className="w-5 h-5" aria-hidden="true" />
                )}
            </button>
        </div>
    );
};
