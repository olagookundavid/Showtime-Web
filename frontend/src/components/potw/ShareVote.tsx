import { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckIcon, LinkIcon, ShareIcon } from '@heroicons/react/24/outline';

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

    const btn =
        'inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 mr-1">Share the vote:</span>
            {canNativeShare && (
                <button type="button" onClick={nativeShare} className={btn}>
                    <ShareIcon className="w-4 h-4" aria-hidden="true" />
                    Share
                </button>
            )}
            <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer" className={btn}>
                WhatsApp
            </a>
            <a href={`https://twitter.com/intent/tweet?text=${encoded}`} target="_blank" rel="noopener noreferrer" className={btn}>
                Post on X
            </a>
            <button type="button" onClick={copy} className={btn}>
                {copied ? <CheckIcon className="w-4 h-4" aria-hidden="true" /> : <LinkIcon className="w-4 h-4" aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy link'}
            </button>
        </div>
    );
};
