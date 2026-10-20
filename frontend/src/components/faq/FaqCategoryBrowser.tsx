import { navLinkClass } from '../ui';
import { FAQ_ICONS } from './faqIcons';
import { FaqList } from './FaqList';
import type { FaqCategory } from '../../types';

interface FaqCategoryBrowserProps {
    categories: FaqCategory[];
    /** Slug of the open category. Unknown or missing falls back to the first. */
    activeSlug?: string | null;
    onSelect: (slug: string) => void;
}

/**
 * The FAQ page's layout: category tabs down the side (across the top on
 * phones) and the open category's questions beside them. It holds no state;
 * the page decides where the active slug lives (e.g. a `?category=` param).
 */
export const FaqCategoryBrowser = ({ categories, activeSlug, onSelect }: FaqCategoryBrowserProps) => {
    if (categories.length === 0) return null;
    const active = categories.find((c) => c.slug === activeSlug) ?? categories[0];

    return (
        <div className="lg:grid lg:grid-cols-[290px_1fr] lg:gap-10 lg:items-start">
            <div
                role="tablist"
                aria-label="FAQ categories"
                className="flex flex-wrap gap-x-6 gap-y-3 border-b border-gray-200 pb-4 text-xs font-bold uppercase tracking-wide lg:flex-col lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6 dark:border-gray-700"
            >
                {categories.map((category) => {
                    const isActive = category.id === active.id;
                    const Icon = FAQ_ICONS[category.icon];
                    return (
                        <button
                            key={category.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={`${navLinkClass(isActive, 'text-sffl-navy dark:text-white')} gap-2`}
                            onClick={() => onSelect(category.slug)}
                        >
                            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                            {category.title}
                        </button>
                    );
                })}
            </div>

            <div role="tabpanel" className="mt-6 min-w-0 lg:mt-0">
                <h2 className="mb-4 text-2xl font-black tracking-tight text-sffl-navy sm:text-3xl dark:text-white">
                    {active.title}
                </h2>
                <FaqList faqs={active.faqs} />
            </div>
        </div>
    );
};
