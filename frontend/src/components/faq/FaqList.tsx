import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { RichContent } from '../richtext';
import type { FaqItem } from '../../types';

interface FaqListProps {
    faqs: Pick<FaqItem, 'id' | 'question' | 'answer'>[];
    /** Layout only (width, margins). The look lives here. */
    className?: string;
}

/**
 * The FAQ accordion: one row per question, opening to its answer. Every page
 * that shows FAQs renders this, so ten questions look exactly like three.
 * Feed it `useFaqPage(key).data.faqs`, or one category's `faqs`.
 */
export const FaqList = ({ faqs, className = '' }: FaqListProps) => {
    if (faqs.length === 0) return null;
    return (
        <div className={`divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-700 dark:border-gray-700 ${className}`}>
            {faqs.map((faq) => (
                <details key={faq.id} className="group">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-bold text-sffl-navy [&::-webkit-details-marker]:hidden dark:text-white">
                        {faq.question}
                        <ChevronDownIcon
                            className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                            aria-hidden="true"
                        />
                    </summary>
                    <RichContent html={faq.answer} variant="compact" className="pb-4 text-gray-600 dark:text-gray-300" />
                </details>
            ))}
        </div>
    );
};
