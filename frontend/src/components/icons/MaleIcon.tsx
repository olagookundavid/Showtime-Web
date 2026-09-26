import type { SVGProps } from 'react';

// Heroicons has no gender symbols, so the male sign (a circle with an arrow
// to the upper right) is drawn in their outline style. Size it with className.
export const MaleIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
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
        <circle cx="9.75" cy="14.25" r="5.25" />
        <path d="M13.5 10.5l6.75-6.75M15 3.75h5.25V9" />
    </svg>
);
