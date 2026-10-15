import type { ReactNode } from 'react';

/** The storefront's red-rule-plus-tracked-label motif, for a section heading inside a dashboard page. */
export const SectionKicker = ({ children }: { children: ReactNode }) => (
    <div className="mb-1 flex items-center gap-2">
        <span aria-hidden="true" className="h-px w-8 bg-sffl-red" />
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-sffl-red">{children}</span>
    </div>
);
