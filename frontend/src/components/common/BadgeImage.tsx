import React from 'react';

interface BadgeImageProps {
    icon?: string;
    name?: string;
    className?: string;
    fallbackEmoji?: string;
}

export const isBadgeImageUrl = (icon?: string): boolean => {
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
    fallbackEmoji = '🏆',
}) => {
    const isImage = isBadgeImageUrl(icon);

    if (isImage && icon) {
        return (
            <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
                <img
                    src={icon}
                    alt={name}
                    className="w-full h-full object-contain drop-shadow-xs select-none"
                    loading="lazy"
                    onError={(e) => {
                        // Fallback to emoji if image fails to load
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                            const fallback = document.createElement('span');
                            fallback.innerText = fallbackEmoji;
                            fallback.className = 'leading-none select-none';
                            parent.appendChild(fallback);
                        }
                    }}
                />
            </div>
        );
    }

    return (
        <span className={`inline-flex items-center justify-center leading-none select-none shrink-0 ${className}`}>
            {icon || fallbackEmoji}
        </span>
    );
};
