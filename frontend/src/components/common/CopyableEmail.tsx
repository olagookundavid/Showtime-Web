import { useState } from 'react';

interface CopyableEmailProps {
    email: string;
    label?: string;
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
        <div className={`inline-flex items-center gap-2 group ${className}`}>
            {label && <span className="font-bold">{label}</span>}
            <span className="font-medium text-inherit">{email}</span>
            <button
                onClick={handleCopy}
                className={`transition-all duration-300 p-1.5 rounded-md focus:outline-none flex items-center justify-center
                    ${copied
                        ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                        : 'text-sffl-red hover:bg-sffl-red/10 border-transparent hover:scale-110'
                    }
                `}
                title="Copy email"
                aria-label="Copy email"
            >
                {copied ? (
                    <span className="text-xs font-bold px-1 py-0.5">Copied!</span>
                ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                )}
            </button>
        </div>
    );
};
