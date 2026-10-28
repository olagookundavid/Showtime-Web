import { useQuery } from '@tanstack/react-query';
import { getFaqPage } from '../services';

/** The FAQs an admin has set for one page, e.g. `useFaqPage('game-pass')`.
 *  Pair it with `FaqList` (a plain list) or `FaqCategoryBrowser` (grouped). */
export const useFaqPage = (pageKey: string) =>
    useQuery({
        queryKey: ['faqPage', pageKey],
        queryFn: () => getFaqPage(pageKey),
        // FAQs change rarely; the server also sends a short Cache-Control.
        staleTime: 5 * 60_000,
        retry: 1,
    });
