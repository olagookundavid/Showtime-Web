import type { SVGProps } from 'react';

// Heroicons has no gender symbols, so the female sign (a circle over a cross)
// is drawn in their outline style. Size it with className.
export const FemaleIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
    >
        <circle cx="12" cy="8.5" r="5.25" />
        <path d="M12 13.75v7.5M8.75 18h6.5" />
    </svg>
);
