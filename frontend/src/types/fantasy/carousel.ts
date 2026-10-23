// The carousel at the top of the Fantasy page: news articles an editor chose
// to feature, in the order they set. The article supplies everything a slide
// shows, so editing the article updates its slide.

export interface FantasyCarouselArticle {
    id: string;
    slug: string;
    title: string;
    /** The excerpt, or the start of the article's text when it has none. */
    summary: string;
    featured_image: string;
    featured_media_type: 'image' | 'youtube';
    featured_youtube_url: string;
    category: string;
    published_at: string;
}

export interface FantasyCarouselSlide {
    id: string;
    display_order: number;
    is_active: boolean;
    created_at: string;
    article: FantasyCarouselArticle;
}

export interface UpdateFantasyCarouselSlidePayload {
    display_order?: number;
    is_active?: boolean;
}
