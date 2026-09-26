import type { SVGProps } from 'react';

// Heroicons has no running figure, so this one is drawn in their outline style:
// a head, a forward-leaning body, swinging arms and a stride. Size it with className.
export const RunnerIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
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
        <circle cx="15" cy="4.5" r="1.75" />
        <path d="M13.25 8.25L10.75 13.5" />
        <path d="M13 9l3 2.25 2.25-1.75" />
        <path d="M12.5 9.25L9.25 10.5 7.5 8.75" />
        <path d="M10.75 13.5l3.25 2.25L12.5 20.25" />
        <path d="M10.75 13.5L8.25 16.5 4.75 17.25" />
    </svg>
);
