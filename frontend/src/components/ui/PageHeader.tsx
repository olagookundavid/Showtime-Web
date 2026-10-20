import { type ReactNode } from 'react';

interface PageHeaderProps {
    /** Small uppercase label above the headline, e.g. "Help Center". */
    eyebrow?: string;
    /** Headline. Pass a <span className="block text-sffl-red"> child for a highlighted line. */
    title: ReactNode;
    subtitle?: ReactNode;
    /** Right-side slot on large screens — a CTA, a logo badge, or omitted. */
    actions?: ReactNode;
    /** Decorative low-opacity background image behind the navy fill. */
    backgroundImage?: string;
    /** `width` scales the image to span the hero's full width (height follows
     * its own aspect ratio; only trimmed symmetrically top/bottom if it still
     * overflows the hero's height) instead of the default `cover`, which
     * crops whichever dimension overflows — including the sides, which can
     * cut a group photo awkwardly narrow. */
    backgroundFit?: 'cover' | 'width';
    /** Extra content inside the hero band, below the title row (e.g. a section nav). */
    children?: ReactNode;
    className?: string;
}

/** The flat navy hero band used across the public site's catalogue-style pages (see Tickets.tsx). */
export const PageHeader = ({ eyebrow, title, subtitle, actions, backgroundImage, backgroundFit = 'cover', children, className = '' }: PageHeaderProps) => {
    return (
        <section className={`relative overflow-hidden bg-sffl-navy text-white ${className}`}>
            {backgroundImage && (
                <div
                    className={`absolute inset-0 bg-center bg-no-repeat opacity-10 ${backgroundFit === 'width' ? 'bg-size-[100%_auto]' : 'bg-cover'}`}
                    style={{ backgroundImage: `url('${backgroundImage}')` }}
                    aria-hidden="true"
                />
            )}
            <div className="relative mx-auto max-w-shell px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
                <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 space-y-5">
                        {eyebrow && (
                            <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-white/80">
                                <span className="h-px w-8 bg-sffl-red" aria-hidden="true" />
                                {eyebrow}
                            </p>
                        )}
                        <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl wrap-break-word">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="max-w-md text-sm text-white/85 sm:text-base">{subtitle}</p>
                        )}
                    </div>
                    {actions}
                </div>
                {children}
            </div>
        </section>
    );
};
