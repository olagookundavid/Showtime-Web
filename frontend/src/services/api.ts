import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8089/api/v1';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export interface News {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    featured_image: string;
    author: string;
    category: string;
    published_at: string;
    created_at: string;
}

export interface Gallery {
    id: string;
    game_week: string;
    date: string;
    players_photo_url: string;
    fans_photo_url: string;
    created_at: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

// News Service
export const getNews = async (page = 1, limit = 10) => {
    const response = await api.get<PaginatedResponse<News>>(`/news?page=${page}&limit=${limit}`);
    return response.data;
};

// Hack: Fetch all (or many) and filter by slug since backend doesn't support getBySlug yet.
// TODO: Implement getBySlug in backend for better performance.
export const getNewsBySlug = async (slug: string) => {
    try {
        const response = await api.get<PaginatedResponse<News>>(`/news?page=1&limit=100`);
        const article = response.data.data.find((n) => n.slug === slug);
        return article || null;
    } catch (error) {
        console.error("Error fetching news by slug:", error);
        return null;
    }
};

export const getNewsById = async (id: string) => {
    const response = await api.get<News>(`/news/${id}`);
    return response.data;
};

// Gallery Service
export const getGallery = async (page = 1, limit = 10) => {
    const response = await api.get<PaginatedResponse<Gallery>>(`/gallery?page=${page}&limit=${limit}`);
    return response.data;
};

export default api;
