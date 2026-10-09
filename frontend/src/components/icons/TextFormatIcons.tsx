import type { SVGProps } from 'react';

// Rich-text toolbar glyphs Heroicons doesn't have (it ships bold, italic,
// underline, strikethrough, lists, H1–H3 and links, but no quote, sub/superscript,
// centre alignment, text colour, highlighter, H4 or clear-formatting). Drawn in
// the Heroicons outline style. Size them with className.

const Outline = ({ className, children, ...props }: SVGProps<SVGSVGElement>) => (
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
        {children}
    </svg>
);

/** Two opening quotation marks: a block quote. */
export const QuoteIcon = (props: SVGProps<SVGSVGElement>) => (
    <Outline {...props}>
        <path d="M9.75 7.5c-2.5.75-4.5 2.9-4.5 5.75v3.5h4.5v-4.5h-3" />
        <path d="M18.75 7.5c-2.5.75-4.5 2.9-4.5 5.75v3.5h4.5v-4.5h-3" />
    </Outline>
);

/** An x with a small 2 below the baseline. */
export const SubscriptIcon = (props: SVGProps<SVGSVGElement>) => (
    <Outline {...props}>
        <path d="M4.5 6l8.25 10.5M12.75 6L4.5 16.5" />
        <path d="M15.75 15.25c.25-.9 1-1.5 1.9-1.5 1 0 1.85.75 1.85 1.7 0 .8-.5 1.3-1.25 1.9l-2.5 2.15h3.75" />
    </Outline>
);

/** An x with a small 2 above the cap height. */
export const SuperscriptIcon = (props: SVGProps<SVGSVGElement>) => (
    <Outline {...props}>
        <path d="M4.5 8.25l8.25 10.5M12.75 8.25L4.5 18.75" />
        <path d="M15.75 5.5c.25-.9 1-1.5 1.9-1.5 1 0 1.85.75 1.85 1.7 0 .8-.5 1.3-1.25 1.9l-2.5 2.15h3.75" />
    </Outline>
);

/** Lines centred on a common axis. */
export const AlignCenterIcon = (props: SVGProps<SVGSVGElement>) => (
    <Outline {...props}>
        <path d="M3.75 6.75h16.5M7.5 12h9M3.75 17.25h16.5" />
    </Outline>
);

/** A capital A over a colour bar: text colour. */
export const TextColorIcon = (props: SVGProps<SVGSVGElement>) => (
    <Outline {...props}>
        <path d="M7.5 15L12 3.75 16.5 15M9.1 11.25h5.8" />
        <path d="M4.5 19.5h15" strokeWidth={2.5} />
    </Outline>
);

/** A highlighter pen marking a line. */
export const HighlighterIcon = (props: SVGProps<SVGSVGElement>) => (
    <Outline {...props}>
        <path d="M14.25 4.5l5.25 5.25-6.75 6.75H9.75l-.75-.75v-3l6-6z" />
        <path d="M9 15.75l-2.25 2.25h-3l2.25-2.25" />
        <path d="M3.75 20.25h16.5" />
    </Outline>
);

/** A T with a diagonal strike: remove formatting. */
export const ClearFormattingIcon = (props: SVGProps<SVGSVGElement>) => (
    <Outline {...props}>
        <path d="M6 5.25h12M12 5.25V18.75" />
        <path d="M4.5 4.5l15 15" />
    </Outline>
);

/** H4, matching Heroicons' H1–H3. */
export const H4Icon = (props: SVGProps<SVGSVGElement>) => (
    <Outline {...props}>
        <path d="M2.25 5.25v13.5M11.25 5.25v13.5M2.25 12h9" />
        <path d="M19.5 18.75V9.75L14.25 15.75h7.5" />
    </Outline>
);
