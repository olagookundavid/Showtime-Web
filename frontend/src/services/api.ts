import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8089/api/v1';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // Remove withCredentials since we are using Bearer tokens now
});

// Interceptor to attach the token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('showtime_access_token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ─── Auth Types ───────────────────────────────────────────────────────────────
export interface AuthUser {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    user_type: string; // 'admin' | 'user' | 'team_head'
    created_at: string;
    updated_at: string;
    access_token?: string;
}

interface AuthApiResponse {
    message: string;
    data: AuthUser;
}

// Auth API functions
export const loginUser = async (email: string, password: string): Promise<AuthUser> => {
    const response = await api.post<AuthApiResponse>('/auth/login', { email, password });
    return response.data.data;
};

export const registerUser = async (fullname: string, email: string, password: string): Promise<void> => {
    await api.post('/auth/register', { fullname, email, password: password });
};

export const logoutUser = async (): Promise<void> => {
    await api.post('/auth/logout');
};

export const getUserProfile = async (): Promise<AuthUser> => {
    const response = await api.get<AuthApiResponse>('/auth/profile');
    return response.data.data;
};

// ─── Generic Paginated Response ───────────────────────────────────────────────
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

// ─── News ─────────────────────────────────────────────────────────────────────
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

export const getNews = async (page = 1, limit = 10) => {
    const response = await api.get<PaginatedResponse<News>>(`/news?page=${page}&limit=${limit}`);
    return response.data;
};

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

// ─── Gallery ──────────────────────────────────────────────────────────────────
export interface Gallery {
    id: string;
    game_week: string;
    date: string;
    players_photo_url: string;
    fans_photo_url: string;
    created_at: string;
}

export const getGallery = async (page = 1, limit = 10) => {
    const response = await api.get<PaginatedResponse<Gallery>>(`/gallery?page=${page}&limit=${limit}`);
    return response.data;
};

// ─── Match Hub Types ──────────────────────────────────────────────────────────
export interface Competition {
    id: string;
    name: string;
    logo: string;
}

export interface Team {
    id: string;
    name: string;
    short_name: string;
    logo: string;
}

export interface Match {
    id: string;
    competition: Competition;
    home_team: Team;
    away_team: Team;
    date: string;
    start_time: string;
    venue: string;
    status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED';
    home_score?: number;
    away_score?: number;
    highlights_url?: string;
    ticket_url?: string;
}

export interface Standing {
    id: string;
    team: Team;
    position: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_diff: number;
    pct: number;
    l5: string;
}

// ─── Match Hub Service ────────────────────────────────────────────────────────
export const getCompetitions = async (): Promise<Competition[]> => {
    const response = await api.get<{ data: Competition[] }>('/matches/competitions');
    return response.data.data;
};

export const getMatches = async (
    competitionId?: string,
    page: number = 1,
    limit: number = 10,
    status?: string
): Promise<PaginatedResponse<Match>> => {
    let url = `/matches?page=${page}&limit=${limit}`;
    if (competitionId) {
        url += `&competition_id=${competitionId}`;
    }
    if (status) {
        url += `&status=${status}`;
    }
    const response = await api.get<PaginatedResponse<Match>>(url);
    return response.data;
};

export const getStandings = async (competitionId: string): Promise<Standing[]> => {
    const response = await api.get<{ data: Standing[] }>(`/matches/standings?competition_id=${competitionId}`);
    return response.data.data;
};

// ─── Teams ────────────────────────────────────────────────────────────────────
export const getTeams = async (): Promise<Team[]> => {
    const response = await api.get<{ data: Team[] }>('/matches/teams');
    return response.data.data;
};

// ─── Players ──────────────────────────────────────────────────────────────────
export interface Player {
    id: string;
    name: string;
    jersey_number: number;
    position: string;
    team: Team;
    bio: string;
    image: string;
    touchdowns: number;
    yards: number;
    interceptions: number;
    tackles: number;
}

export const getPlayers = async (teamId?: string): Promise<Player[]> => {
    let url = '/players';
    if (teamId) {
        url += `?team_id=${teamId}`;
    }
    const response = await api.get<{ data: Player[] }>(url);
    return response.data.data;
};

export const getPlayerById = async (id: string): Promise<Player> => {
    const response = await api.get<{ data: Player }>(`/players/${id}`);
    return response.data.data;
};

// ─── Admin Mutation Types ─────────────────────────────────────────────────────

export interface CreateNewsPayload {
    title: string;
    slug: string;
    excerpt?: string;
    content: string;
    featured_image?: string;
    author?: string;
    category?: string;
    published_at?: string;
}

export interface CreateGalleryPayload {
    game_week: string;
    date: string;
    players_photo_url: string;
    fans_photo_url: string;
}

export interface CreateMatchPayload {
    competition_id: string;
    home_team_id: string;
    away_team_id: string;
    date: string;
    start_time: string;
    venue?: string;
    status?: string;
    home_score?: number | null;
    away_score?: number | null;
    highlights_url?: string;
    ticket_url?: string;
}

export interface CreatePlayerPayload {
    name: string;
    jersey_number?: number;
    position?: string;
    team_id: string;
    bio?: string;
    image?: string;
    touchdowns?: number;
    yards?: number;
    interceptions?: number;
    tackles?: number;
}

// ─── News Mutations ───────────────────────────────────────────────────────────
export const createNews = async (payload: CreateNewsPayload) => {
    const response = await api.post('/news', payload);
    return response.data;
};

export const updateNews = async (id: string, payload: Partial<CreateNewsPayload>) => {
    const response = await api.put(`/news/${id}`, payload);
    return response.data;
};

export const deleteNews = async (id: string) => {
    const response = await api.delete(`/news/${id}`);
    return response.data;
};

// ─── Gallery Mutations ────────────────────────────────────────────────────────
export const createGallery = async (payload: CreateGalleryPayload) => {
    const response = await api.post('/gallery', payload);
    return response.data;
};

export const updateGallery = async (id: string, payload: Partial<CreateGalleryPayload>) => {
    const response = await api.put(`/gallery/${id}`, payload);
    return response.data;
};

export const deleteGallery = async (id: string) => {
    const response = await api.delete(`/gallery/${id}`);
    return response.data;
};

// ─── Match Mutations ──────────────────────────────────────────────────────────
export const createMatch = async (payload: CreateMatchPayload) => {
    const response = await api.post('/matches', payload);
    return response.data;
};

export const updateMatch = async (id: string, payload: Partial<CreateMatchPayload>) => {
    const response = await api.put(`/matches/${id}`, payload);
    return response.data;
};

export const deleteMatch = async (id: string) => {
    const response = await api.delete(`/matches/${id}`);
    return response.data;
};

// ─── Player Mutations ─────────────────────────────────────────────────────────
export const createPlayer = async (payload: CreatePlayerPayload) => {
    const response = await api.post('/players', payload);
    return response.data;
};

export const updatePlayer = async (id: string, payload: Partial<CreatePlayerPayload>) => {
    const response = await api.put(`/players/${id}`, payload);
    return response.data;
};

export const deletePlayer = async (id: string) => {
    const response = await api.delete(`/players/${id}`);
    return response.data;
};

// ─── Standing Mutations ───────────────────────────────────────────────────────
export interface CreateStandingPayload {
    competition_id: string;
    team_id: string;
    won?: number;
    drawn?: number;
    lost?: number;
    goals_for?: number;
    goals_against?: number;
    l5?: string;
}

export const createStanding = async (payload: CreateStandingPayload) => {
    const response = await api.post('/matches/standings', payload);
    return response.data;
};

export const updateStanding = async (id: string, payload: Partial<CreateStandingPayload>) => {
    const response = await api.put(`/matches/standings/${id}`, payload);
    return response.data;
};

export const deleteStanding = async (id: string) => {
    const response = await api.delete(`/matches/standings/${id}`);
    return response.data;
};

// ─── Event Days & Tickets ─────────────────────────────────────────────────────
export interface TicketTierResponse {
    id: string;
    event_day_id: string;
    name: string;
    price: number;
    capacity: number;
    sold_count: number;
    available: number;
    description: string;
}

export interface EventDayMatch {
    id: string;
    home_team: string;
    away_team: string;
    start_time: string;
    status: string;
    venue: string;
}

export interface EventDayResponse {
    id: string;
    title: string;
    date: string;
    venue: string;
    is_active: boolean;
    tiers: TicketTierResponse[];
    matches: EventDayMatch[];
    created_at: string;
}

export interface TicketResponse {
    id: string;
    event_day_id: string;
    tier_id: string;
    email: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    status: string;
    paystack_reference?: string;
    ticket_code?: string;
    checked_in_at?: string;
    checked_in_by?: string;
    authorization_url?: string;
    tier_name?: string;
    event_title?: string;
    event_date?: string;
    event_venue?: string;
    created_at: string;
}

export interface PurchaseTicketPayload {
    event_day_id: string;
    tier_id: string;
    email: string;
    quantity: number;
}

// Event Day endpoints
export const getEventDays = async (): Promise<EventDayResponse[]> => {
    const response = await api.get<{ data: EventDayResponse[] }>('/event-days');
    return response.data.data || [];
};

export const getEventDayByDate = async (date: string): Promise<EventDayResponse> => {
    const response = await api.get<EventDayResponse>(`/event-days/by-date/${date}`);
    return response.data;
};

export const getEventDayById = async (id: string): Promise<EventDayResponse> => {
    const response = await api.get<EventDayResponse>(`/event-days/${id}`);
    return response.data;
};

// Ticket endpoints
export const purchaseTicket = async (payload: PurchaseTicketPayload): Promise<TicketResponse> => {
    const response = await api.post<TicketResponse>('/tickets/purchase', payload);
    return response.data;
};

export const getTicketByReference = async (reference: string): Promise<TicketResponse> => {
    const response = await api.get<TicketResponse>(`/tickets/${reference}`);
    return response.data;
};

export const adminListTickets = async (page = 1, limit = 10, eventDayId?: string, status?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (eventDayId) params.append('event_day_id', eventDayId);
    if (status) params.append('status', status);
    const response = await api.get<PaginatedResponse<TicketResponse>>(`/admin/tickets?${params}`);
    return response.data;
};

export const checkinTicket = async (id: string, checkedInBy: string) => {
    const response = await api.post(`/tickets/${id}/checkin`, { checked_in_by: checkedInBy });
    return response.data;
};

export const verifyTicket = async (reference: string): Promise<TicketResponse> => {
    const response = await api.post<TicketResponse>(`/tickets/verify/${reference}`);
    return response.data;
};

export const adminCheckinTicket = async (id: string, checkedInBy: string) => {
    const response = await api.post(`/admin/tickets/${id}/admin-checkin`, { checked_in_by: checkedInBy });
    return response.data;
};

export const lookupTicketByCode = async (code: string): Promise<TicketResponse> => {
    const response = await api.get<TicketResponse>(`/tickets/lookup/${code}`);
    return response.data;
};

export const searchTicketsByEmail = async (email: string): Promise<TicketResponse[]> => {
    const response = await api.get<{ data: TicketResponse[] }>(`/tickets/search?email=${encodeURIComponent(email)}`);
    return response.data.data || [];
};

// Admin Event Day endpoints
export const getAllEventDays = async (): Promise<EventDayResponse[]> => {
    const response = await api.get<{ data: EventDayResponse[] }>('/admin/event-days/all');
    return response.data.data || [];
};

export const createEventDay = async (payload: { title: string; date: string; venue?: string; is_active?: boolean }): Promise<EventDayResponse> => {
    const response = await api.post<EventDayResponse>('/admin/event-days', payload);
    return response.data;
};

export const updateEventDay = async (id: string, payload: { title?: string; venue?: string; is_active?: boolean }) => {
    const response = await api.put(`/admin/event-days/${id}`, payload);
    return response.data;
};

export const deleteEventDay = async (id: string) => {
    const response = await api.delete(`/admin/event-days/${id}`);
    return response.data;
};

export const createTier = async (eventDayId: string, payload: { name: string; price: number; capacity?: number; description?: string }): Promise<TicketTierResponse> => {
    const response = await api.post<TicketTierResponse>(`/admin/event-days/${eventDayId}/tiers`, payload);
    return response.data;
};

// -------- ADMIN USER MANAGEMENT API -------- //
export const getAdminUsers = async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await api.get('/admin/users', { params });
    return response.data;
};

export const updateUserRole = async (userId: string, role: string) => {
    const response = await api.put(`/admin/users/${userId}/role`, { role });
    return response.data;
};

export const updateUserInfo = async (userId: string, payload: { fullname: string; phone: string }) => {
    const response = await api.put(`/admin/users/${userId}`, payload);
    return response.data;
};

// -------- ADMIN TEAM MANAGEMENT API -------- //
export const getAdminTeams = async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await api.get('/admin/teams', { params });
    return response.data;
};

export const getTeamsByCompetition = async (competitionId: string) => {
    const response = await api.get('/admin/teams/by-competition', { params: { competition_id: competitionId } });
    return response.data;
};

export const createTeam = async (payload: { name: string; short_name: string; logo: string }) => {
    const response = await api.post('/admin/teams', payload);
    return response.data;
};

export const updateTeam = async (id: string, payload: { name: string; short_name: string; logo: string }) => {
    const response = await api.put(`/admin/teams/${id}`, payload);
    return response.data;
};

export const deleteTeam = async (id: string) => {
    const response = await api.delete(`/admin/teams/${id}`);
    return response.data;
};

export const getTeamManagers = async (teamId: string) => {
    const response = await api.get(`/admin/teams/${teamId}/managers`);
    return response.data;
};

export const assignTeamManager = async (teamId: string, userId: string) => {
    const response = await api.post(`/admin/teams/${teamId}/manager`, { user_id: userId });
    return response.data;
};

export const removeTeamManager = async (teamId: string, userId: string) => {
    const response = await api.delete(`/admin/teams/${teamId}/manager/${userId}`);
    return response.data;
};

// -------- ADMIN COMPETITION MANAGEMENT API -------- //
export const getAdminCompetitions = async () => {
    const response = await api.get('/admin/competitions');
    return response.data;
};

export const createCompetition = async (payload: { name: string; logo: string }) => {
    const response = await api.post('/admin/competitions', payload);
    return response.data;
};

export const updateCompetition = async (id: string, payload: { name: string; logo: string }) => {
    const response = await api.put(`/admin/competitions/${id}`, payload);
    return response.data;
};

export const deleteCompetition = async (id: string) => {
    const response = await api.delete(`/admin/competitions/${id}`);
    return response.data;
};

export interface GenericApiResponse<T> {
    message: string;
    data: T;
}

export interface SalesByTier {
    tier_name: string;
    total_amount: number;
    quantity: number;
}

export interface AdminAnalyticsResponse {
    total_revenue: number;
    total_tickets_sold: number;
    total_users: number;
    recent_sales: TicketResponse[];
    users_by_role: Record<string, number>;
    sales_by_tier: SalesByTier[];
}

export const getAdminAnalytics = async (): Promise<GenericApiResponse<AdminAnalyticsResponse>> => {
    const response = await api.get<GenericApiResponse<AdminAnalyticsResponse>>('/admin/analytics');
    return response.data;
};

export default api;
