import type { SVGProps } from 'react';

// Heroicons has no American football, so this one is drawn in their outline
// style: a diagonal ball with a seam and three laces. Size it with className.
export const FootballIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
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
        <path d="M4.2 19.8C3.3 15.5 4.8 10.7 7.75 7.75C10.7 4.8 15.5 3.3 19.8 4.2C20.7 8.5 19.2 13.3 16.25 16.25C13.3 19.2 8.5 20.7 4.2 19.8Z" />
        <path d="M9.5 14.5l5-5" />
        <path d="M9.5 12.5l2 2M11 11l2 2M12.5 9.5l2 2" />
    </svg>
);
