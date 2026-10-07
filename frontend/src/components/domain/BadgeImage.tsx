import React, { useState } from 'react';
import { TrophyIcon } from '@heroicons/react/24/outline';

// Filenames actually mirrored under frontend/public/badges/ (the official preset
// artwork). Any other "/badges/" path is a custom R2 upload with no local mirror,
// so falling back to it would just be a second guaranteed-404 request.
const LOCAL_MIRROR_FILENAMES = new Set([
    'best-center.png',
    'best-defender.png',
    'best-receiver.png',
    'best-rusher.png',
    'game-mvp.png',
    'player-of-the-week.png',
    'rookie-of-the-season.png',
    'team-of-the-season.png',
    'team-of-the-week.png',
    'tournament-mvp.png',
]);

interface BadgeImageProps {
    icon?: string;
    name?: string;
    className?: string;
}

const isBadgeImageUrl = (icon?: string): boolean => {
    if (!icon) return false;
    const trimmed = icon.trim();
    return (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('/') ||
        trimmed.startsWith('data:')
    );
};

export const BadgeImage: React.FC<BadgeImageProps> = ({
    icon,
    name = 'Badge',
    className = 'w-6 h-6',
}) => {
    // The src that failed to load, so a new badge gets a fresh attempt.
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const isImage = isBadgeImageUrl(icon);

    if (isImage && icon && failedSrc !== icon) {
        return (
            <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
                <img
                    src={icon}
                    alt={name}
                    className="w-full h-full object-contain drop-shadow-xs select-none"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        // If remote CDN fails (e.g. offline/network issue), try local /badges/ mirror
                        // — but only for the official preset artwork that's actually mirrored locally;
                        // custom-uploaded badges have no local copy and would just 404 a second time.
                        if (target.src.includes('/badges/') && !target.src.includes(window.location.origin)) {
                            const filename = target.src.split('/badges/').pop();
                            if (filename && LOCAL_MIRROR_FILENAMES.has(filename)) {
                                target.src = `/badges/${filename}`;
                                return;
                            }
                        }
                        // Nothing left to try: show the trophy fallback below.
                        setFailedSrc(icon);
                    }}
                />
            </div>
        );
    }

    // An admin can set a badge's icon to a short text mark instead of artwork.
    if (icon && !isImage) {
        return (
            <span className={`inline-flex items-center justify-center leading-none select-none shrink-0 ${className}`}>
                {icon}
            </span>
        );
    }

    return (
        <span
            role="img"
            aria-label={name}
            className={`inline-flex items-center justify-center shrink-0 text-amber-500 ${className}`}
        >
            <TrophyIcon className="w-full h-full" aria-hidden="true" />
        </span>
    );
};
