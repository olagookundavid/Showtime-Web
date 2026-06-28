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

// Global 401 handler: when the token is expired/invalid, clear it and bounce
// the user to login. Without this, a stale token fails every call silently
// while ProtectedRoute still shows the user as "logged in" (in-memory user
// stays populated), which looks like a broken app. Only redirect for a real
// session — skip the login endpoints themselves so a bad-credentials 401 on
// the login form is handled by the form, not a hard redirect.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const url: string = error?.config?.url || '';
        const isAuthEndpoint = /\/auth\/(login|register|forgot-password|reset-password)/.test(url);
        if (status === 401 && !isAuthEndpoint) {
            localStorage.removeItem('showtime_access_token');
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                window.location.assign('/login');
            }
        }
        return Promise.reject(error);
    }
);

// ─── Auth Types ───────────────────────────────────────────────────────────────
export interface AuthUser {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    user_type: string; // 'admin' | 'user' | 'team_head' | 'ticketer'
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

export interface ResetPasswordPayload {
    email: string;
    otp: string;
    new_password: string;
}

export const forgotPassword = async (email: string): Promise<void> => {
    await api.post('/auth/forgot-password', { email });
};

export const resetPassword = async (payload: ResetPasswordPayload): Promise<void> => {
    await api.post('/auth/reset-password', payload);
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

export const getNews = async (
    page = 1,
    limit = 10,
    search?: string,
    category?: string,
    author?: string
) => {
    let url = `/news?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    if (author) url += `&author=${encodeURIComponent(author)}`;

    const response = await api.get<PaginatedResponse<News>>(url);
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
    competition_id?: string | null;
    game_week: string;
    date: string;
    players_photo_url: string;
    fans_photo_url: string;
    created_at: string;
    competition?: Competition | null;
}

export const getGallery = async (page = 1, limit = 10, competitionId?: string) => {
    let url = `/gallery?page=${page}&limit=${limit}`;
    if (competitionId) {
        url += `&competition_id=${encodeURIComponent(competitionId)}`;
    }
    const response = await api.get<PaginatedResponse<Gallery>>(url);
    return response.data;
};

// ─── Hero Slides ──────────────────────────────────────────────────────────────
export interface HeroSlide {
    id: string;
    image_url: string;
    display_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateHeroSlidePayload {
    image_url: string;
    display_order?: number;
    is_active?: boolean;
}

export interface UpdateHeroSlidePayload {
    image_url?: string;
    display_order?: number;
    is_active?: boolean;
}

// Public: only active slides — what MainHeroCarousel renders.
export const getHeroSlides = async (): Promise<HeroSlide[]> => {
    const response = await api.get<{ data: HeroSlide[] }>('/hero-slides');
    return response.data.data || [];
};

// Admin: list ALL (active + inactive).
export const getAdminHeroSlides = async (): Promise<HeroSlide[]> => {
    const response = await api.get<{ data: HeroSlide[] }>('/admin/hero-slides');
    return response.data.data || [];
};

export const createHeroSlide = async (payload: CreateHeroSlidePayload): Promise<HeroSlide> => {
    const response = await api.post<HeroSlide>('/admin/hero-slides', payload);
    return response.data;
};

export const updateHeroSlide = async (id: string, payload: UpdateHeroSlidePayload) => {
    const response = await api.put(`/admin/hero-slides/${id}`, payload);
    return response.data;
};

export const deleteHeroSlide = async (id: string) => {
    const response = await api.delete(`/admin/hero-slides/${id}`);
    return response.data;
};

// ─── Match Hub Types ──────────────────────────────────────────────────────────
export interface Competition {
    id: string;
    name: string;
    logo: string;
    status: string;
    format?: string; // LEAGUE | KNOCKOUT
    playoff_competition_id?: string | null;
}

// Sort competitions newest-season first. We parse the trailing Roman numeral
// in the name (e.g. "Showtime Bowl Series XIV" → 14) so the order is based on
// the actual season, not the creation timestamp — that way late data fixes
// don't flip XIV above/below XIII at random. Within a season, stages run
// chronologically: regular season → playoff → bowl. Competitions with no
// numeral fall to the bottom.
//
// The matcher only accepts I/V/X/L (cap at 89) — C/D/M aren't realistic
// season numbers for a sports league and accepting them mis-parses names like
// "Community Cup CC" as season 200 (CC = 100 + 100), shoving them to the top.
const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };
const romanToInt = (s: string): number => {
    let result = 0;
    for (let i = 0; i < s.length; i++) {
        const curr = ROMAN_VALUES[s[i]] ?? 0;
        const next = ROMAN_VALUES[s[i + 1]] ?? 0;
        result += next > curr ? -curr : curr;
    }
    return result;
};
const seasonNumberFromName = (name: string): number => {
    const match = name.match(/\b([IVXL]+)\s*$/i);
    return match ? romanToInt(match[1].toUpperCase()) : 0;
};
const stageOrder = (name: string): number => {
    const n = name.toLowerCase();
    if (n.includes('regular')) return 1;
    if (n.includes('playoff')) return 2;
    if (n.includes('bowl')) return 3;
    return 4;
};
export const sortCompetitionsBySeason = <C extends { name: string }>(comps: C[]): C[] => {
    return [...comps].sort((a, b) => {
        const seasonDiff = seasonNumberFromName(b.name) - seasonNumberFromName(a.name);
        if (seasonDiff !== 0) return seasonDiff;
        return stageOrder(a.name) - stageOrder(b.name);
    });
};

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
    round?: string;
    bracket_pos?: number;
    feeds_match_id?: string;
    feeds_slot?: 'HOME' | 'AWAY';
    second_leg_match_id?: string | null;
}

export interface TeamSheetPlayer {
    player_id: string;
    name: string;
    jersey_number: number;
    position: string;
    image: string;
}

export interface MatchTeamSheet {
    home_team: TeamSheetPlayer[];
    away_team: TeamSheetPlayer[];
}

export interface MatchDetail {
    match: Match;
    team_sheet: MatchTeamSheet;
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
export const getCompetitions = async (page: number = 1, limit: number = 100, status?: string): Promise<PaginatedResponse<Competition>> => {
    let url = `/matches/competitions?page=${page}&limit=${limit}`;
    if (status) {
        url += `&status=${status}`;
    }
    const response = await api.get<PaginatedResponse<Competition>>(url);
    return response.data;
};

export const getMatches = async (
    competitionId?: string,
    page: number = 1,
    limit: number = 10,
    status?: string,
    search?: string
): Promise<PaginatedResponse<Match>> => {
    let url = `/matches?page=${page}&limit=${limit}`;
    if (competitionId) {
        url += `&competition_id=${competitionId}`;
    }
    if (status) {
        url += `&status=${status}`;
    }
    if (search) {
        url += `&search=${encodeURIComponent(search)}`;
    }
    const response = await api.get<PaginatedResponse<Match>>(url);
    return response.data;
};

export const getStandings = async (competitionId: string): Promise<Standing[]> => {
    const response = await api.get<{ data: Standing[] }>(`/matches/standings?competition_id=${competitionId}`);
    return response.data.data;
};

export const getMatchDetail = async (id: string): Promise<MatchDetail> => {
    const response = await api.get<{ data: MatchDetail }>(`/matches/${id}`);
    return response.data.data;
};

// ─── Teams ────────────────────────────────────────────────────────────────────
export const getTeams = async (page: number = 1, limit: number = 20): Promise<PaginatedResponse<Team>> => {
    const response = await api.get<PaginatedResponse<Team>>(`/matches/teams?page=${page}&limit=${limit}`);
    return response.data;
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
    email?: string;
}

export const getPlayers = async (teamId?: string, page: number = 1, limit: number = 20, search?: string): Promise<PaginatedResponse<Player>> => {
    let url = `/players?page=${page}&limit=${limit}`;
    if (teamId) {
        url += `&team_id=${teamId}`;
    }
    if (search) {
        url += `&search=${encodeURIComponent(search)}`;
    }
    const response = await api.get<PaginatedResponse<Player>>(url);
    return response.data;
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
}

export interface CreateGalleryPayload {
    competition_id?: string | null;
    game_week: string;
    date: string;
    players_photo_url: string;
    fans_photo_url: string;
}

export interface CreateMatchPayload {
    competition_id: string;
    home_team_id: string; // '' = TBD slot (knockout brackets only)
    away_team_id: string; // '' = TBD slot (knockout brackets only)
    date: string;
    start_time: string;
    venue?: string;
    status?: string;
    home_score?: number | null;
    away_score?: number | null;
    highlights_url?: string;
    ticket_url?: string;
    round?: string;
    bracket_pos?: number | null;
    feeds_match_id?: string | null;
    feeds_slot?: string;
    second_leg_match_id?: string | null;
}

export interface CreatePlayerPayload {
    name: string;
    jersey_number?: number;
    position?: string;
    team_id: string;
    bio?: string;
    image?: string;
    email: string;
}

// ─── News Mutations ───────────────────────────────────────────────────────────
export const createNews = async (payload: CreateNewsPayload) => {
    const response = await api.post('/admin/news', payload);
    return response.data;
};

export const updateNews = async (id: string, payload: Partial<CreateNewsPayload>) => {
    const response = await api.put(`/admin/news/${id}`, payload);
    return response.data;
};

export const deleteNews = async (id: string) => {
    const response = await api.delete(`/admin/news/${id}`);
    return response.data;
};

// ─── Gallery Mutations ────────────────────────────────────────────────────────
export const createGallery = async (payload: CreateGalleryPayload) => {
    const response = await api.post('/admin/gallery', payload);
    return response.data;
};

export const updateGallery = async (id: string, payload: Partial<CreateGalleryPayload>) => {
    const response = await api.put(`/admin/gallery/${id}`, payload);
    return response.data;
};

export const deleteGallery = async (id: string) => {
    const response = await api.delete(`/admin/gallery/${id}`);
    return response.data;
};

// ─── Match Mutations ──────────────────────────────────────────────────────────
export const createMatch = async (payload: CreateMatchPayload) => {
    const response = await api.post('/admin/matches', payload);
    return response.data;
};

export const updateMatch = async (id: string, payload: Partial<CreateMatchPayload>) => {
    const response = await api.put(`/admin/matches/${id}`, payload);
    return response.data;
};

export const deleteMatch = async (id: string) => {
    const response = await api.delete(`/admin/matches/${id}`);
    return response.data;
};

// ─── Team Sheet Mutations ─────────────────────────────────────────────────────
export const saveTeamSheet = async (matchId: string, payload: { team_id: string; player_ids: string[] }) => {
    const response = await api.post(`/admin/matches/${matchId}/team-sheets`, payload);
    return response.data;
};

export const getAdminTeamSheet = async (matchId: string): Promise<MatchTeamSheet> => {
    const response = await api.get<{ data: MatchTeamSheet }>(`/admin/matches/${matchId}/team-sheets`);
    return response.data.data;
};

// ─── Bulk historical-data CSV import ──────────────────────────────────────────
export interface ImportMatchPlayerRow {
    side: 'home' | 'away';
    player_name: string;
    jersey_number?: number;
    position?: string;
    passing_attempts?: number;
    rushing_attempts?: number;
    completed_passes?: number;
    passing_tds?: number;
    rushing_tds?: number;
    interceptions_thrown?: number;
    receptions?: number;
    receiving_tds?: number;
    extra_points_tds?: number;
    drops?: number;
    flag_pulls?: number;
    pass_deflections?: number;
    interceptions?: number;
    defensive_tds?: number;
    safety?: number;
    qb_sacks?: number;
    def_sacks?: number;
    defensive_xp_tds?: number;
}

export interface ImportMatchResult {
    players_created: number;
    players_matched: number;
    sheet_rows: number;
    stat_rows: number;
    created_players?: Array<{
        id: string;
        name: string;
        team_id: string;
        jersey_number: number;
        position: string;
    }>;
}

export const importMatchCsv = async (matchId: string, rows: ImportMatchPlayerRow[]): Promise<ImportMatchResult> => {
    const res = await api.post<{ message: string; data: ImportMatchResult }>(
        `/admin/matches/${matchId}/import`,
        { rows },
    );
    return res.data.data;
};

// ─── Player Mutations ─────────────────────────────────────────────────────────
export const createPlayer = async (payload: CreatePlayerPayload) => {
    const response = await api.post('/admin/players', payload);
    return response.data;
};

export const updatePlayer = async (id: string, payload: Partial<CreatePlayerPayload>) => {
    const response = await api.put(`/admin/players/${id}`, payload);
    return response.data;
};

export const deletePlayer = async (id: string) => {
    const response = await api.delete(`/admin/players/${id}`);
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
    const response = await api.post('/admin/matches/standings', payload);
    return response.data;
};

export const updateStanding = async (id: string, payload: Partial<CreateStandingPayload>) => {
    const response = await api.put(`/admin/matches/standings/${id}`, payload);
    return response.data;
};

export const deleteStanding = async (id: string) => {
    const response = await api.delete(`/admin/matches/standings/${id}`);
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
    is_hidden: boolean;
    access_code?: string;
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
    name?: string;
    phone?: string;

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
    referral_code?: string;
    created_at: string;
}

export interface PurchaseTicketPayload {
    event_day_id: string;
    tier_id: string;
    email: string;
    name: string;
    phone: string;
    quantity: number;
    referral_code?: string;
}


// Event Day endpoints
export const getEventDays = async (code?: string): Promise<EventDayResponse[]> => {
    const url = code ? `/event-days?code=${encodeURIComponent(code)}` : '/event-days';
    const response = await api.get<{ data: EventDayResponse[] }>(url);
    return response.data.data || [];
};

export const getEventDayByDate = async (date: string, code?: string): Promise<EventDayResponse> => {
    const url = code ? `/event-days/by-date/${date}?code=${encodeURIComponent(code)}` : `/event-days/by-date/${date}`;
    const response = await api.get<EventDayResponse>(url);
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

export interface GiftTicketPayload {
    event_day_id: string;
    tier_id: string;
    email: string;
    name: string;
    phone?: string;
    quantity: number;
}

// App Admin: issue a complimentary ticket (no payment, sends confirmation email)
export const giftTicket = async (payload: GiftTicketPayload): Promise<TicketResponse> => {
    const response = await api.post<TicketResponse>('/admin/administrator/gift-ticket', payload);
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
    const response = await api.post(`/admin/tickets/${id}/checkin`, { checked_in_by: checkedInBy });
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
    const response = await api.get<TicketResponse>(`/admin/tickets/lookup/${code}`);
    return response.data;
};

export const searchTicketsByEmail = async (email: string): Promise<TicketResponse[]> => {
    const response = await api.get<{ data: TicketResponse[] }>(`/admin/tickets/search?email=${encodeURIComponent(email)}`);
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

export const createTier = async (eventDayId: string, payload: { name: string; price: number; capacity?: number; description?: string; is_hidden?: boolean; access_code?: string; }): Promise<TicketTierResponse> => {
    const response = await api.post<TicketTierResponse>(`/admin/event-days/${eventDayId}/tiers`, payload);
    return response.data;
};

export const deleteTicketTier = async (eventDayId: string, tierId: string) => {
    const response = await api.delete(`/admin/event-days/${eventDayId}/tiers/${tierId}`);
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
export const getAdminCompetitions = async (page: number = 1, limit: number = 100, search?: string): Promise<PaginatedResponse<Competition>> => {
    let url = `/admin/competitions?page=${page}&limit=${limit}`;
    if (search) {
        url += `&search=${encodeURIComponent(search)}`;
    }
    const response = await api.get<PaginatedResponse<Competition>>(url);
    return response.data;
};

export const createCompetition = async (payload: { name: string; logo: string; status?: string; format?: string; playoff_competition_id?: string | null }) => {
    const response = await api.post('/admin/competitions', payload);
    return response.data;
};

export const updateCompetition = async (id: string, payload: { name: string; logo: string; status?: string; format?: string; playoff_competition_id?: string | null }) => {
    const response = await api.put(`/admin/competitions/${id}`, payload);
    return response.data;
};

export const deleteCompetition = async (id: string) => {
    const response = await api.delete(`/admin/competitions/${id}`);
    return response.data;
};

// One first-round slot of a knockout bracket: a matchup or a bye.
// Adjacent slots pair up: winners of slots 1 & 2 meet next round, 3 & 4 meet, etc.
export interface BracketEntryPayload {
    bye: boolean;
    team_id?: string;
    home_team_id?: string;
    away_team_id?: string;
}

export const generateBracket = async (
    competitionId: string,
    payload: { entries: BracketEntryPayload[]; date: string; time?: string; venue?: string },
) => {
    const response = await api.post(`/admin/competitions/${competitionId}/bracket`, payload);
    return response.data;
};

export const resetBracket = async (competitionId: string) => {
    const response = await api.delete(`/admin/competitions/${competitionId}/bracket`);
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

// ─── Team Allocations ─────────────────────────────────────────────────────────

export interface TeamTicketAllocation {
    id: string;
    event_day_id: string;
    team_id: string;
    allocated_count: number;
    issued_count: number;
    team_name?: string;
    event_title?: string;
    team?: Team;
}

export const adminGetAllocations = async (eventDayId: string): Promise<TeamTicketAllocation[]> => {
    const response = await api.get<{ data: TeamTicketAllocation[] }>(`/admin/allocations/event-day/${eventDayId}`);
    return response.data.data || [];
};

export const adminCreateOrUpdateAllocation = async (payload: { event_day_id: string; team_id: string; allocated_count: number }) => {
    const response = await api.post('/admin/allocations', payload);
    return response.data;
};

export const adminDeleteAllocation = async (id: string) => {
    const response = await api.delete(`/admin/allocations/${id}`);
    return response.data;
};

export const getTeamAllocations = async (): Promise<TeamTicketAllocation[]> => {
    const response = await api.get<{ data: TeamTicketAllocation[] }>('/team-head/allocations');
    return response.data.data || [];
};

export const issueTeamTicket = async (payload: { event_day_id: string; name: string; email: string }): Promise<TicketResponse> => {
    const response = await api.post<TicketResponse>('/team-head/allocations/issue', payload);
    return response.data;
};

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface PlayerStat {
    player_id: string;
    player_name: string;
    player_image: string;
    player_jersey_number: number;
    player_position: string;
    team_id: string;
    team_name: string;
    team_short_name: string;
    team_logo: string;
    apps: number;
    passing_attempts: number;
    rushing_attempts: number;
    completed_passes: number;
    passing_tds: number;
    rushing_tds: number;
    interceptions_thrown: number;
    receptions: number;
    receiving_tds: number;
    extra_points_tds: number;
    drops: number;
    flag_pulls: number;
    pass_deflections: number;
    interceptions: number;
    defensive_tds: number;
    safety: number;
    qb_sacks: number;
    def_sacks: number;
    defensive_xp_tds: number;
}

export interface TeamStat {
    team_id: string;
    team_name: string;
    team_short_name: string;
    team_logo: string;
    passing_attempts: number;
    rushing_attempts: number;
    completed_passes: number;
    passing_tds: number;
    rushing_tds: number;
    interceptions_thrown: number;
    receptions: number;
    receiving_tds: number;
    extra_points_tds: number;
    drops: number;
    flag_pulls: number;
    pass_deflections: number;
    interceptions: number;
    defensive_tds: number;
    safety: number;
    qb_sacks: number;
    def_sacks: number;
    defensive_xp_tds: number;
}

export interface UpsertPlayerStatPayload {
    player_id: string;
    team_id: string;
    match_id: string;
    competition_id: string;
    match_date: string;
    passing_attempts: number;
    rushing_attempts: number;
    completed_passes: number;
    passing_tds: number;
    rushing_tds: number;
    interceptions_thrown: number;
    receptions: number;
    receiving_tds: number;
    extra_points_tds: number;
    drops: number;
    flag_pulls: number;
    pass_deflections: number;
    interceptions: number;
    defensive_tds: number;
    safety: number;
    qb_sacks: number;
    def_sacks: number;
    defensive_xp_tds: number;
}

export const getPlayerStats = async (compId?: string, eventDay?: string, page = 1, limit = 20, playerId?: string, search?: string, sort?: string): Promise<PaginatedResponse<PlayerStat>> => {
    let url = '/stats/players';
    const params = new URLSearchParams();
    if (compId) params.append('competition_id', compId);
    if (eventDay) params.append('event_day', eventDay);
    if (playerId) params.append('player_id', playerId);
    if (search) params.append('search', search);
    if (sort) params.append('sort', sort);
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (params.toString()) url += `?${params.toString()}`;
    const response = await api.get(url);
    return response.data;
};

export const getPlayerStatById = async (id: string, compId?: string, matchDate?: string, matchId?: string): Promise<PlayerStat | null> => {
    let url = `/stats/players/${id}`;
    const params = new URLSearchParams();
    if (compId) params.append('competition_id', compId);
    if (matchDate) params.append('match_date', matchDate);
    if (matchId) params.append('match_id', matchId);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await api.get(url);
    return response.data.data;
};

export const getTeamStats = async (compId?: string, eventDay?: string, page = 1, limit = 20, sort?: string): Promise<PaginatedResponse<TeamStat>> => {
    let url = '/stats/teams';
    const params = new URLSearchParams();
    if (compId) params.append('competition_id', compId);
    if (eventDay) params.append('event_day', eventDay);
    if (sort) params.append('sort', sort);
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (params.toString()) url += `?${params.toString()}`;
    const response = await api.get(url);
    return response.data;
};

export const upsertPlayerStat = async (payload: UpsertPlayerStatPayload) => {
    const response = await api.post('/admin/stats/players', payload);
    return response.data;
};

export const getStatDates = async (compId?: string): Promise<string[]> => {
    let url = '/stats/dates';
    if (compId) url += `?competition_id=${compId}`;
    const response = await api.get(url);
    return response.data.data || [];
};

// ─── Team of the Week (TOTW) ────────────────────────────────────────────────
export interface TOTWEntry {
    id: string;
    competition_id: string;
    event_day_id?: string;
    event_day_date: string;
    player_id: string;
    position_group: 'QB' | 'WR' | 'DEF';
    created_at: string;
    player?: Player;
}

export const getTOTW = async (compId: string, eventDay: string): Promise<TOTWEntry[]> => {
    const response = await api.get(`/totw?competition_id=${compId}&event_day=${eventDay}`);
    return response.data.data || [];
};

export const getLatestTOTW = async (compId?: string): Promise<{ data: TOTWEntry[]; date: string }> => {
    let url = '/totw/latest';
    if (compId) url += `?competition_id=${compId}`;
    const response = await api.get(url);
    return response.data;
};

export const createTOTWEntry = async (payload: {
    competition_id: string;
    event_day_id?: string;
    event_day_date: string;
    player_id: string;
    position_group: string;
}) => {
    const response = await api.post('/admin/totw', payload);
    return response.data;
};

export const deleteTOTWEntry = async (id: string) => {
    await api.delete(`/admin/totw/${id}`);
};

// ─── Match-Day TOTW Helpers ──────────────────────────────────────────────────
// Returns unique match dates (YYYY-MM-DD) for a competition, sourced from
// actual matches (not stats) to ensure data integrity for TOTW selection.
export const getMatchDays = async (competitionId: string): Promise<string[]> => {
    const response = await api.get(`/matches/days?competition_id=${competitionId}`);
    return response.data.data || [];
};

// Returns players who were on official team sheets on a specific match day.
// This constrains TOTW selection to only players who actually played.
export const getEligiblePlayersForMatchDay = async (
    competitionId: string,
    date: string
): Promise<Player[]> => {
    const response = await api.get(
        `/matches/eligible-players?competition_id=${competitionId}&date=${date}`
    );
    return response.data.data || [];
};

// ─── Inventory Management ─────────────────────────────────────────────────────

export interface InventoryProduct {
    id: string;
    name: string;
    sku: string;
    description: string;
    price: number;
    quantity: number;
    threshold: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface InventorySale {
    id: string;
    product_id: string;
    product_name: string;
    seller_id: string;
    seller_name: string;
    quantity_sold: number;
    unit_price: number;
    total_amount: number;
    payment_method: string;
    notes: string;
    sold_at: string;
}

export interface SalesReportResponse {
    period: string; // daily, weekly, monthly
    from_date: string;
    to_date: string;
    total_revenue: number;
    total_units: number;
    by_product: {
        product_id: string;
        product_name: string;
        units_sold: number;
        revenue: number;
    }[];
    by_seller: {
        seller_id: string;
        seller_name: string;
        units_sold: number;
        revenue: number;
    }[];
    by_payment_method: {
        payment_method: string;
        revenue: number;
    }[];
}

export interface PaymentMethod {
    id: string;
    name: string;
    is_active: boolean;
}

// ─── Admin Inventory Api ──────────────────────────────────────────────────────
export const getAdminProducts = async (page = 1, limit = 20, search?: string, activeOnly?: boolean) => {
    let url = `/admin/inventory/products?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (activeOnly) url += `&active_only=true`;
    const response = await api.get<{ message: string; data: InventoryProduct[]; total: number; page: number; limit: number; total_pages: number }>(url);
    return response.data;
};

export const getAdminLowStockAlerts = async () => {
    const response = await api.get<GenericApiResponse<InventoryProduct[]>>(`/admin/inventory/low-stock`);
    return response.data.data;
};

export const createAdminProduct = async (payload: { name: string; description: string; price: number; quantity: number; threshold: number }) => {
    const response = await api.post<GenericApiResponse<InventoryProduct>>(`/admin/inventory/products`, payload);
    return response.data;
};

export const updateAdminProduct = async (id: string, payload: Partial<{ name: string; description: string; price: number; quantity: number; threshold: number; is_active: boolean }>) => {
    const response = await api.put<GenericApiResponse<InventoryProduct>>(`/admin/inventory/products/${id}`, payload);
    return response.data;
};

export const deleteAdminProduct = async (id: string) => {
    const response = await api.delete(`/admin/inventory/products/${id}`);
    return response.data;
};

export const getAdminSales = async (page = 1, limit = 20, productId?: string, sellerId?: string, fromDate?: string, toDate?: string) => {
    let url = `/admin/inventory/sales?page=${page}&limit=${limit}`;
    if (productId) url += `&product_id=${productId}`;
    if (sellerId) url += `&seller_id=${sellerId}`;
    if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
    if (toDate) url += `&to_date=${encodeURIComponent(toDate)}`;
    const response = await api.get<{ message: string; data: InventorySale[]; total: number; page: number; limit: number; total_pages: number }>(url);
    return response.data;
};

export const getAdminSalesReport = async (period: 'daily' | 'weekly' | 'monthly' | 'custom', fromDate?: string, toDate?: string) => {
    let url = `/admin/inventory/reports?period=${period}`;
    if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
    if (toDate) url += `&to_date=${encodeURIComponent(toDate)}`;
    const response = await api.get<GenericApiResponse<SalesReportResponse>>(url);
    return response.data.data;
};

export const getAdminPaymentMethods = async (activeOnly = false) => {
    let url = `/admin/inventory/payment-methods`;
    if (activeOnly) url += `?active_only=true`;
    const response = await api.get<GenericApiResponse<PaymentMethod[]>>(url);
    return response.data.data;
};

export const createAdminPaymentMethod = async (name: string) => {
    const response = await api.post<GenericApiResponse<PaymentMethod>>(`/admin/inventory/payment-methods`, { name });
    return response.data;
};

export const toggleAdminPaymentMethod = async (id: string, isActive: boolean) => {
    const response = await api.patch<GenericApiResponse<null>>(`/admin/inventory/payment-methods/${id}/toggle`, { is_active: isActive });
    return response.data;
};

// ─── Seller Portal Api ────────────────────────────────────────────────────────
export const sellerGetProducts = async (page = 1, limit = 50, search?: string) => {
    let url = `/seller/products?page=${page}&limit=${limit}&active_only=true`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const response = await api.get<{ message: string; data: InventoryProduct[]; total: number; page: number; limit: number; total_pages: number }>(url);
    return response.data;
};

export const sellerLogSale = async (payload: { product_id: string; quantity_sold: number; payment_method: string; notes: string }) => {
    const response = await api.post<GenericApiResponse<InventorySale>>(`/seller/sales`, payload);
    return response.data;
};

export const sellerGetSales = async (page = 1, limit = 20, fromDate?: string, toDate?: string) => {
    let url = `/seller/sales?page=${page}&limit=${limit}`;
    if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
    if (toDate) url += `&to_date=${encodeURIComponent(toDate)}`;
    const response = await api.get<{ message: string; data: InventorySale[]; total: number; page: number; limit: number; total_pages: number }>(url);
    return response.data;
};

export const sellerGetPaymentMethods = async () => {
    const response = await api.get<GenericApiResponse<PaymentMethod[]>>(`/seller/payment-methods?active_only=true`);
    return response.data.data;
};

// ─── Store / E-commerce Interfaces & APIs ─────────────────────────────────────
export interface ProductImage {
    id: string;
    image_url: string;
    is_primary: boolean;
    display_order: number;
}

export interface ProductOptionValue {
    value: string;
    price?: number; // only present when the parent option drives price
}

export interface ProductOption {
    name: string;
    drives_price: boolean;
    values: ProductOptionValue[];
}

export interface ProductVariant {
    id: string;
    option1_value?: string;
    option2_value?: string;
    option3_value?: string;
    sku: string;
    quantity: number;
    price: number;      // derived server-side from the pricing option
    image_url?: string; // optional pin to a product image
}

export interface StoreProduct {
    id: string;
    name: string;
    sku: string;
    description: string;
    price: number;
    quantity: number;
    threshold: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    images: ProductImage[];
    options: ProductOption[];
    variants: ProductVariant[];
    rating_avg: number;
    rating_count: number;
    created_by_name?: string;
}

export interface ProductReview {
    id: string;
    product_id: string;
    user_id: string;
    user_name: string;
    verified_purchase: boolean;
    rating: number;
    title?: string;
    body?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateProductReviewPayload {
    rating: number;
    title?: string;
    body?: string;
}

export type ReviewSort = 'newest' | 'highest' | 'lowest';

export interface CheckoutItemPayload {
    product_id: string;
    variant_id?: string;
    quantity: number;
}

export interface CheckoutPayload {
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    shipping_country: string;
    shipping_state: string;
    shipping_city: string;
    shipping_address: string;
    shipping_postal_code: string;
    items: CheckoutItemPayload[];
}

export interface CheckoutResponseData {
    order_reference: string;
    paystack_url: string;
    paystack_ref: string;
    paystack_access_code: string;
}

export interface OrderItem {
    id: string;
    product_id: string;
    product_name: string;
    variant_id?: string;
    variant_label?: string; // snapshot like "Size: M, Color: Navy"
    quantity: number;
    unit_price: number;
    total_price: number;
}

export interface Order {
    id: string;
    order_reference: string;
    user_id?: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    shipping_country: string;
    shipping_state: string;
    shipping_city: string;
    shipping_address: string;
    shipping_postal_code: string;
    total_amount: number;
    payment_status: 'pending' | 'paid' | 'failed';
    fulfillment_status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
    paystack_reference?: string;
    created_at: string;
    updated_at: string;
    items: OrderItem[];
}

export interface SavedAddress {
    id: string;
    recipient_name: string;
    phone: string;
    country: string;
    state: string;
    city: string;
    street_address: string;
    postal_code: string;
}

export const getStoreProducts = async (): Promise<StoreProduct[]> => {
    const response = await api.get<{ data: StoreProduct[] }>('/store/products');
    return response.data.data || [];
};

export const getStoreProduct = async (id: string): Promise<StoreProduct> => {
    const response = await api.get<{ data: StoreProduct }>(`/store/products/${id}`);
    return response.data.data;
};

export const initializeCheckout = async (payload: CheckoutPayload): Promise<CheckoutResponseData> => {
    const response = await api.post<{ data: CheckoutResponseData }>('/store/checkout', payload);
    return response.data.data;
};

export const verifyStorePayment = async (reference: string): Promise<Order> => {
    const response = await api.post<{ data: Order }>('/store/verify', { reference });
    return response.data.data;
};

export const getOrderByReference = async (reference: string): Promise<Order> => {
    const response = await api.get<{ data: Order }>(`/store/orders/by-ref/${reference}`);
    return response.data.data;
};

export const getSavedAddresses = async (): Promise<SavedAddress[]> => {
    const response = await api.get<{ data: SavedAddress[] }>('/store/addresses');
    return response.data.data || [];
};

export const saveSavedAddress = async (payload: Omit<SavedAddress, 'id'>): Promise<SavedAddress> => {
    const response = await api.post<{ data: SavedAddress }>('/store/addresses', payload);
    return response.data.data;
};

export const getCustomerOrders = async (page = 1, limit = 20): Promise<PaginatedResponse<Order>> => {
    const response = await api.get<PaginatedResponse<Order>>(`/store/orders?page=${page}&limit=${limit}`);
    return response.data;
};

// Admin E-commerce Storefront APIs
export const getAdminStoreProducts = async (): Promise<StoreProduct[]> => {
    const response = await api.get<{ data: StoreProduct[] }>('/admin/store/products');
    return response.data.data || [];
};

type AdminStoreProductPayload = Omit<StoreProduct, 'id' | 'sku' | 'created_at' | 'updated_at' | 'images' | 'variants' | 'options' | 'rating_avg' | 'rating_count' | 'created_by_name'> & {
    sku?: string;
    options: ProductOption[];
};

export const createAdminStoreProduct = async (payload: AdminStoreProductPayload): Promise<StoreProduct> => {
    const response = await api.post<{ data: StoreProduct }>('/admin/store/products', payload);
    return response.data.data;
};

export const updateAdminStoreProduct = async (id: string, payload: AdminStoreProductPayload): Promise<any> => {
    const response = await api.put(`/admin/store/products/${id}`, payload);
    return response.data;
};

export const deleteAdminStoreProduct = async (id: string): Promise<any> => {
    const response = await api.delete(`/admin/store/products/${id}`);
    return response.data;
};

export const getAdminOrders = async (page = 1, limit = 20, paymentStatus?: string, fulfillmentStatus?: string): Promise<{ data: Order[]; total: number; page: number; limit: number; total_pages: number }> => {
    let url = `/admin/store/orders?page=${page}&limit=${limit}`;
    if (paymentStatus) url += `&payment_status=${paymentStatus}`;
    if (fulfillmentStatus) url += `&fulfillment_status=${fulfillmentStatus}`;
    const response = await api.get<{ data: Order[]; total: number; page: number; limit: number; total_pages: number }>(url);
    return response.data;
};

export const getAdminOrder = async (id: string): Promise<Order> => {
    const response = await api.get<{ data: Order }>(`/admin/store/orders/${id}`);
    return response.data.data;
};

export const updateOrderFulfillment = async (id: string, fulfillmentStatus: string): Promise<Order> => {
    const response = await api.patch<{ data: Order }>(`/admin/store/orders/${id}/fulfillment`, { fulfillment_status: fulfillmentStatus });
    return response.data.data;
};

export const verifyAdminStoreOrder = async (id: string): Promise<Order> => {
    const response = await api.post<{ data: Order }>(`/admin/store/orders/${id}/verify`);
    return response.data.data;
};

export const cancelAdminStoreOrder = async (id: string): Promise<Order> => {
    const response = await api.post<{ data: Order }>(`/admin/store/orders/${id}/cancel`);
    return response.data.data;
};

// Variant rows sent up are pure combination + stock + optional image pin —
// price is derived server-side from the product's pricing option.
export type AdminVariantPayload = {
    option1_value?: string;
    option2_value?: string;
    option3_value?: string;
    sku?: string;
    quantity: number;
    image_url?: string;
};

export const saveAdminProductVariants = async (productId: string, variants: AdminVariantPayload[]): Promise<any> => {
    const response = await api.post(`/admin/store/products/${productId}/variants`, variants);
    return response.data;
};

export const saveAdminProductImages = async (productId: string, images: Omit<ProductImage, 'id'>[]): Promise<any> => {
    const response = await api.post(`/admin/store/products/${productId}/images`, images);
    return response.data;
};

// ─── Product Reviews ──────────────────────────────────────────────────────

export const getProductReviews = async (productId: string, page = 1, limit = 10, sort: ReviewSort = 'newest'): Promise<{ data: ProductReview[]; total: number; page: number; limit: number; total_pages: number }> => {
    const response = await api.get<{ data: ProductReview[]; total: number; page: number; limit: number; total_pages: number }>(
        `/store/products/${productId}/reviews?page=${page}&limit=${limit}&sort=${sort}`
    );
    return response.data;
};

export const createProductReview = async (productId: string, payload: CreateProductReviewPayload): Promise<ProductReview> => {
    const response = await api.post<{ data: ProductReview }>(`/store/products/${productId}/reviews`, payload);
    return response.data.data;
};

export const getMyProductReview = async (productId: string): Promise<ProductReview | null> => {
    const response = await api.get<{ data: ProductReview | null }>(`/store/products/${productId}/reviews/mine`);
    return response.data.data;
};

export const deleteAdminProductReview = async (id: string): Promise<any> => {
    const response = await api.delete(`/admin/store/reviews/${id}`);
    return response.data;
};

// ─── Ticket Referrals ────────────────────────────────────────────────────────

export interface CreateReferralPayload {
    name: string;
    email?: string;
}

export interface ReferralResponse {
    id: string;
    code: string;
    name: string;
    email?: string;
    created_at: string;
}

export interface ReferralStatsResponse {
    id: string;
    code: string;
    name: string;
    email?: string;
    tickets_sold: number;
    total_revenue: number;
    created_at: string;
}

export const createReferralCode = async (payload: CreateReferralPayload): Promise<ReferralResponse> => {
    const response = await api.post<ReferralResponse>('/tickets/referrals', payload);
    return response.data;
};

export const lookupReferrals = async (name: string): Promise<ReferralResponse[]> => {
    const response = await api.get<ReferralResponse[]>(`/tickets/referrals/lookup?name=${encodeURIComponent(name)}`);
    return response.data;
};

export const adminListReferrals = async (page = 1, limit = 10, search?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.append('search', search);
    const response = await api.get<PaginatedResponse<ReferralStatsResponse>>(`/admin/tickets/referrals?${params}`);
    return response.data;
};

export default api;

