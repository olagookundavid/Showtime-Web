import { useState, type ReactNode } from 'react';
import { CheckIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { Button } from './Button';

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
            <Button
                size="sm"
                variant={copied ? 'success' : 'link'}
                className="shrink-0"
                icon={copied ? CheckIcon : DocumentDuplicateIcon}
                aria-label={copied ? 'Email copied' : 'Copy email'}
                onClick={handleCopy}
            >
                {copied ? 'Copied' : null}
            </Button>
        </div>
    );
};
