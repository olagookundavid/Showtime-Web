import { useState } from 'react';
import { FemaleIcon } from '../icons/FemaleIcon';
import { MaleIcon } from '../icons/MaleIcon';
import { ImageLightbox } from '../ui';

interface Props {
    name: string;
    image?: string | null;
    /** 'F' shows the women's tint on the gender pip. Omit to hide the pip. */
    gender?: string | null;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    /** Tap the photo to open it full size, as player photos do elsewhere on the site. */
    zoomable?: boolean;
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
export function PlayerAvatar({ name, image, gender, size = 'md', className = '', zoomable = false }: Props) {
    const [failed, setFailed] = useState(false);
    const [zoomed, setZoomed] = useState(false);
    const showImage = !!image && !failed;
    const female = (gender || '').toUpperCase().startsWith('F');

    const photo = showImage ? (
        <img
            src={image as string}
            alt=""
            onError={() => setFailed(true)}
            className={`${SIZES[size]} rounded-xl object-cover bg-gray-100 dark:bg-gray-700`}
        />
    ) : null;

    return (
        <span className={`relative inline-flex shrink-0 ${className}`}>
            {photo && zoomable ? (
                <button
                    type="button"
                    aria-label={`View ${name}'s photo`}
                    title="View photo"
                    onClick={(e) => {
                        // Inside a clickable card or row, open the photo only.
                        e.stopPropagation();
                        setZoomed(true);
                    }}
                    className="rounded-xl cursor-zoom-in transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-sffl-red"
                >
                    {photo}
                </button>
            ) : photo ? (
                photo
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
                    role="img"
                    aria-label={female ? 'Woman' : 'Man'}
                    className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white ring-2 ring-white dark:ring-gray-800 ${
                        female ? 'bg-amber-600' : 'bg-sffl-navy'
                    }`}
                >
                    {female ? (
                        <FemaleIcon className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                        <MaleIcon className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />
                    )}
                </span>
            )}
            {zoomable && showImage && (
                <ImageLightbox src={image as string} alt={name} isOpen={zoomed} onClose={() => setZoomed(false)} />
            )}
        </span>
    );
}
