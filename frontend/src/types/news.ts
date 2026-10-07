export interface News {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    featured_image: string;
    featured_media_type: 'image' | 'youtube';
    featured_youtube_url: string;
    author: string;
    category: string;
    published_at: string;
    created_at: string;
    comments_enabled?: boolean;
}

export interface CreateNewsPayload {
    title: string;
    excerpt?: string;
    content: string;
    featured_image?: string;
    featured_media_type?: 'image' | 'youtube';
    featured_youtube_url?: string;
    author?: string;
    category?: string;
    comments_enabled?: boolean;
}
