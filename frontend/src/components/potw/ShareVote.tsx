import { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckIcon, LinkIcon, ShareIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import { buttonClass } from '../ui/buttonStyles';

interface ShareVoteProps {
    /** Absolute link to share. */
    url: string;
    /** The message that goes with the link. */
    text: string;
}

/**
 * Share the vote: the phone's share sheet where available, plus WhatsApp, X and
 * copy-link buttons, so fans can bring friends in to vote.
 */
export const ShareVote = ({ url, text }: ShareVoteProps) => {
    const [copied, setCopied] = useState(false);
    const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const encoded = encodeURIComponent(`${text} ${url}`);

    const nativeShare = async () => {
        try {
            await navigator.share({ title: 'Player of the Week', text, url });
        } catch {
            // The user closed the share sheet; nothing to report.
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success('Link copied');
            window.setTimeout(() => setCopied(false), 2500);
        } catch {
            toast.error('Could not copy the link');
        }
    };

    const linkClass = buttonClass('secondary', 'md', false, '');

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 mr-1">Share the vote:</span>
            {canNativeShare && (
                <Button variant="secondary" icon={ShareIcon} onClick={nativeShare}>
                    Share
                </Button>
            )}
            <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
                WhatsApp
            </a>
            <a href={`https://twitter.com/intent/tweet?text=${encoded}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
                Post on X
            </a>
            <Button variant="secondary" icon={copied ? CheckIcon : LinkIcon} onClick={copy}>
                {copied ? 'Copied' : 'Copy link'}
            </Button>
        </div>
    );
};
