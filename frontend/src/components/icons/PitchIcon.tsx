import type { SVGProps } from 'react';

// Heroicons has no stadium or playing field, so this one is drawn in their
// outline style: a pitch seen from above, with a halfway line and centre
// circle. Size it with className.
export const PitchIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
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
        <rect x="2.25" y="5.25" width="19.5" height="13.5" rx="1.5" />
        <path d="M12 5.25v13.5" />
        <circle cx="12" cy="12" r="2.25" />
        <path d="M2.25 9.75h2.25v4.5H2.25M21.75 9.75H19.5v4.5h2.25" />
    </svg>
);
