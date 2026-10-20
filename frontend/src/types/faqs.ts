export interface FaqItem {
    id: string;
    category_id: string | null;
    question: string;
    /** Plain text or sanitized rich-text HTML; render it with `RichContent`. */
    answer: string;
    display_order: number;
    is_active: boolean;
}

export interface FaqCategory {
    id: string;
    /** Stable handle, e.g. for `?category=<slug>`. Set once, never edited. */
    slug: string;
    title: string;
    /** Name of an icon in `FAQ_ICONS`, or empty for none. */
    icon: string;
    display_order: number;
    faqs: FaqItem[];
}

/** Everything one page shows: grouped questions plus any that belong to no category. */
export interface FaqPage {
    key: string;
    name: string;
    path: string;
    description: string;
    categories: FaqCategory[];
    faqs: FaqItem[];
}

/** A page as listed in the admin, with how much it holds. */
export interface FaqPageSummary {
    key: string;
    name: string;
    path: string;
    description: string;
    category_count: number;
    item_count: number;
}

export interface CreateFaqPagePayload {
    key: string;
    name: string;
    path?: string;
    description?: string;
}

export interface UpdateFaqPagePayload {
    name: string;
    path?: string;
    description?: string;
}

export interface FaqCategoryPayload {
    title: string;
    icon?: string;
}

export interface FaqItemPayload {
    category_id: string | null;
    question: string;
    answer: string;
    is_active: boolean;
}

export type FaqReorderKind = 'category' | 'item';
