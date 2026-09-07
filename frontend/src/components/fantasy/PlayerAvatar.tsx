import { useState } from 'react';

interface Props {
    name: string;
    image?: string | null;
    /** 'F' shows the women's tint on the gender pip. Omit to hide the pip. */
    gender?: string | null;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const SIZES = {
    sm: 'w-9 h-9 text-[10px]',
    md: 'w-11 h-11 text-xs',
    lg: 'w-14 h-14 text-sm',
} as const;

/** First letters of the first two words — "Uche Kalu (KNK)" becomes "UK". */
function initials(name: string): string {
    return (name || '?')
        .replace(/\(.*?\)/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || '')
        .join('')
        .toUpperCase();
}

/**
 * A player's face, with initials when there isn't one.
 *
 * Every previous version pointed a missing image at /placeholder-player.png,
 * which does not exist — so the browser fell back to rendering the alt text,
 * and a name spilled out of a 48px box on every player without a photo. Initials
 * are drawn rather than fetched, so there is nothing left to 404. onError covers
 * the other half: a URL that exists but fails to load.
 */
export function PlayerAvatar({ name, image, gender, size = 'md', className = '' }: Props) {
    const [failed, setFailed] = useState(false);
    const showImage = !!image && !failed;
    const female = (gender || '').toUpperCase().startsWith('F');

    return (
        <span className={`relative inline-flex shrink-0 ${className}`}>
            {showImage ? (
                <img
                    src={image as string}
                    alt=""
                    onError={() => setFailed(true)}
                    className={`${SIZES[size]} rounded-xl object-cover bg-gray-100 dark:bg-gray-700`}
                />
            ) : (
                <span
                    aria-hidden
                    className={`${SIZES[size]} rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-black text-gray-400 dark:text-gray-500 select-none`}
                >
                    {initials(name)}
                </span>
            )}
            {gender != null && gender !== '' && (
                <span
                    title={female ? 'Woman' : 'Man'}
                    className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white ring-2 ring-white dark:ring-gray-800 ${
                        female ? 'bg-amber-600' : 'bg-sffl-navy'
                    }`}
                >
                    {female ? '♀' : '♂'}
                </span>
            )}
        </span>
    );
}
