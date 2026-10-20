import type { SVGProps } from 'react';

// Heroicons has no handshake, so this one is drawn in their outline style:
// two forearms meeting in a clasp. Size it with className.
export const HandshakeIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
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
        <path d="M1.5 11.25 5.25 7.5h3l1.5 1.13" />
        <path d="M22.5 11.25 18.75 7.5H15l-4.72 3.94a1.5 1.5 0 0 0 1.97 2.26l2.25-1.7" />
        <path d="m18.75 12.75-4.97 4.97a1.5 1.5 0 0 1-2.12 0L5.25 11.25" />
        <path d="m9.19 15.19 1.31 1.31M7.31 13.31l1.32 1.32" />
    </svg>
);
