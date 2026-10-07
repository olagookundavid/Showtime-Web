// Legacy: slides created before `destination_url` existed link to a hidden
// news article (authored inline, from this admin — not the News admin)
// instead. It's "hidden" in the sense that it's excluded from /news and the
// News admin list; see backend news.is_hero_only. Kept read-only so those
// old slides keep rendering/linking correctly.
export interface HeroSlideNews {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    content: string;
    category: string;
    featured_media_type: 'image' | 'youtube';
    featured_youtube_url: string;
}

export interface HeroSlide {
    id: string;
    image_url: string;
    mobile_image_url?: string;
    // Where the slide links to — an internal path (e.g. "/stats",
    // "/news/some-slug") or a full external URL. Empty/absent means
    // non-clickable.
    destination_url?: string;
    display_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Legacy fallback for slides created before destination_url existed.
    news_slug?: string;
    news?: HeroSlideNews;
}

export interface CreateHeroSlidePayload {
    image_url: string;
    mobile_image_url?: string;
    destination_url?: string;
    display_order?: number;
    is_active?: boolean;
}

export interface UpdateHeroSlidePayload {
    image_url?: string;
    mobile_image_url?: string;
    destination_url?: string;
    display_order?: number;
    is_active?: boolean;
}
