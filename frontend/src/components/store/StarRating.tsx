import { useState } from 'react';

type Props = {
    value: number;            // 0–5, supports fractional for display (e.g. 4.3)
    onChange?: (v: number) => void; // when present, renders interactive (integer steps only)
    size?: 'sm' | 'md' | 'lg';
    className?: string;
};

const sizeClass: Record<NonNullable<Props['size']>, string> = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
};

const Star = ({ fill, sizeCls, gradId }: { fill: number; sizeCls: string; gradId?: string }) => {
    // `fill` is 0..1 — partial fills render with an inline linearGradient.
    const partial = fill > 0 && fill < 1 && gradId;
    return (
        <svg viewBox="0 0 24 24" className={`${sizeCls} flex-shrink-0`} aria-hidden="true">
            {partial && (
                <defs>
                    <linearGradient id={gradId}>
                        <stop offset={`${fill * 100}%`} stopColor="#f59e0b" />
                        <stop offset={`${fill * 100}%`} stopColor="#d1d5db" stopOpacity="1" />
                    </linearGradient>
                </defs>
            )}
            <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
                fill={partial ? `url(#${gradId})` : fill >= 1 ? '#f59e0b' : '#d1d5db'}
            />
        </svg>
    );
};

// A star row used for both summary display (read-only, supports fractional
// values like 4.3) and the interactive review form (integer steps with hover
// preview).
export const StarRating = ({ value, onChange, size = 'md', className = '' }: Props) => {
    const [hover, setHover] = useState<number | null>(null);
    const sizeCls = sizeClass[size];
    const display = hover ?? value;
    const interactive = !!onChange;
    const idBase = `star-grad-${Math.random().toString(36).slice(2, 9)}`;

    return (
        <div
            className={`inline-flex items-center gap-0.5 ${className}`}
            role={interactive ? 'radiogroup' : 'img'}
            aria-label={interactive ? 'Rating' : `${value} out of 5 stars`}
        >
            {[1, 2, 3, 4, 5].map(i => {
                const fill = Math.max(0, Math.min(1, display - (i - 1)));
                if (!interactive) {
                    return <Star key={i} fill={fill} sizeCls={sizeCls} gradId={`${idBase}-${i}`} />;
                }
                return (
                    <button
                        key={i}
                        type="button"
                        role="radio"
                        aria-checked={value === i}
                        aria-label={`${i} ${i === 1 ? 'star' : 'stars'}`}
                        onClick={() => onChange?.(i)}
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                        className="leading-none p-0 bg-transparent border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sffl-red/40 rounded"
                    >
                        <Star fill={fill >= 0.5 ? 1 : 0} sizeCls={sizeCls} />
                    </button>
                );
            })}
        </div>
    );
};
