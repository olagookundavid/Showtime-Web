import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8089/api/v1';

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

// Global 401 handler: when a LOGGED-IN user's token expires/goes invalid, clear
// it and send them to login. Critically, this must NOT fire for anonymous
// visitors — that was the bug where a brand-new visitor hit the login page on
// load. An anon user legitimately gets 401s from authenticated calls (e.g. the
// session probe /auth/profile on load, or saved-addresses on the store). So we
// only act when a token was actually present (a real session that went bad),
// and we skip the auth endpoints (login/register/reset have their own forms,
// /auth/profile is the anon session probe).
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const url: string = error?.config?.url || '';
        const hadToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('showtime_access_token');
        // The claim endpoints answer 401 for a bad/expired/exhausted team code, which
        // says nothing about the caller's session. A claimant is signed in as
        // player_pending while they finish their claim, so treating that 401 as an
        // expired session would sign them out mid-flow.
        const isAuthEndpoint = /\/auth\/(login|register|forgot-password|reset-password|profile)|\/claim\//.test(url);
        if (status === 401 && hadToken && !isAuthEndpoint) {
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
    featured_media_type: 'image' | 'youtube';
    featured_youtube_url: string;
    author: string;
    category: string;
    published_at: string;
    created_at: string;
    comments_enabled?: boolean;
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

export const getNewsBySlug = async (slug: string): Promise<News | null> => {
    try {
        const response = await api.get<News>(`/news/slug/${encodeURIComponent(slug)}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching news by slug:", error);
        return null;
    }
};

export const getNewsById = async (id: string) => {
    const response = await api.get<News>(`/news/${id}`);
    return response.data;
};

// ─── RELIVE / YouTube Playlist ────────────────────────────────────────────────
export interface ReliveVideo {
    id: string;
    video_id: string;
    title: string;
    thumbnail: string;
    max_thumbnail: string;
    published_at: string;
    link: string;
}

export interface RelivePlaylist {
    title: string;
    playlist_id: string;
    videos: ReliveVideo[];
}

export const getRelivePlaylist = async (playlistId?: string): Promise<RelivePlaylist> => {
    const url = playlistId ? `/relive?playlist_id=${encodeURIComponent(playlistId)}` : '/relive';
    const response = await api.get<{ data: RelivePlaylist }>(url);
    return response.data.data;
};

// ─── Live stream ──────────────────────────────────────────────────────────────
export interface LiveStatus {
    is_live: boolean;
    video_id?: string;
    title?: string;
    /** 'auto' = detected from the channel, 'manual' = an admin override decided it. */
    source: 'auto' | 'manual';
}

export interface AdminLiveStatus extends LiveStatus {
    mode: 'auto' | 'on' | 'off';
    override_video_id: string;
    override_title: string;
    detected_live: boolean;
    detected_video_id?: string;
    detected_title?: string;
    channel_handle: string;
}

export const getLiveStatus = async (): Promise<LiveStatus> => {
    const response = await api.get<LiveStatus>('/live');
    return response.data;
};

export const liveApi = {
    getAdminStatus: async (): Promise<AdminLiveStatus> => {
        const res = await api.get<AdminLiveStatus>('/admin/live');
        return res.data;
    },
    setOverride: async (payload: { mode: 'auto' | 'on' | 'off'; video_id?: string; title?: string }): Promise<AdminLiveStatus> => {
        const res = await api.put<AdminLiveStatus>('/admin/live', payload);
        return res.data;
    },
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
// Every slide is backed by a hidden news article (authored inline, from this
// admin — not the News admin) that opens when the slide is clicked. It's
// "hidden" in the sense that it's excluded from /news and the News admin list;
// see backend news.is_hero_only.
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
    display_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Public (active-only) reads only get news_slug — enough to build the
    // /news/{slug} link. Admin reads also get the full nested `news` object.
    news_slug?: string;
    news?: HeroSlideNews;
}

export interface HeroSlideNewsPayload {
    title: string;
    excerpt?: string;
    content: string;
    featured_media_type?: 'image' | 'youtube';
    featured_youtube_url?: string;
}

export interface CreateHeroSlidePayload {
    image_url: string;
    mobile_image_url?: string;
    display_order?: number;
    is_active?: boolean;
    news: HeroSlideNewsPayload;
}

export interface UpdateHeroSlidePayload {
    image_url?: string;
    mobile_image_url?: string;
    display_order?: number;
    is_active?: boolean;
    news?: HeroSlideNewsPayload; // omit to leave the linked article untouched
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

// ─── Team of the Season + MVPs ─────────────────────────────────────────────────
export interface SeasonGraphic {
    id: string;
    category: 'offense' | 'defense';
    image_url: string;
    mobile_image_url?: string;
}

export interface SeasonMVP {
    id: string;
    player_id: string;
    label: string;
    display_order: number;
    is_active: boolean;
    player_name: string;
    player_image: string;
    player_jersey_number: number;
    player_position: string;
    team_name: string;
    team_logo: string;
}

export interface UpsertSeasonGraphicPayload {
    category: 'offense' | 'defense';
    image_url: string;
    mobile_image_url?: string;
}

export interface CreateSeasonMVPPayload {
    player_id: string;
    label: string;
    display_order?: number;
}

export interface UpdateSeasonMVPPayload {
    label?: string;
    display_order?: number;
    is_active?: boolean;
}

// Public
export const getSeasonGraphics = async (): Promise<SeasonGraphic[]> => {
    const res = await api.get<{ data: SeasonGraphic[] }>('/season/graphics');
    return res.data.data || [];
};

export const getSeasonMVPs = async (): Promise<SeasonMVP[]> => {
    const res = await api.get<{ data: SeasonMVP[] }>('/season/mvps');
    return res.data.data || [];
};

// Admin
export const getAdminSeasonGraphics = async (): Promise<SeasonGraphic[]> => {
    const res = await api.get<{ data: SeasonGraphic[] }>('/admin/season/graphics');
    return res.data.data || [];
};

export const upsertSeasonGraphic = async (payload: UpsertSeasonGraphicPayload): Promise<SeasonGraphic> => {
    const res = await api.put<SeasonGraphic>('/admin/season/graphics', payload);
    return res.data;
};

export const getAdminSeasonMVPs = async (): Promise<SeasonMVP[]> => {
    const res = await api.get<{ data: SeasonMVP[] }>('/admin/season/mvps');
    return res.data.data || [];
};

export const createSeasonMVP = async (payload: CreateSeasonMVPPayload): Promise<SeasonMVP> => {
    const res = await api.post<SeasonMVP>('/admin/season/mvps', payload);
    return res.data;
};

export const updateSeasonMVP = async (id: string, payload: UpdateSeasonMVPPayload) => {
    const res = await api.put(`/admin/season/mvps/${id}`, payload);
    return res.data;
};

export const deleteSeasonMVP = async (id: string) => {
    const res = await api.delete(`/admin/season/mvps/${id}`);
    return res.data;
};

// ─── Match Hub Types ──────────────────────────────────────────────────────────
export interface Competition {
    id: string;
    name: string;
    logo: string;
    status: string;
    format?: string; // LEAGUE | KNOCKOUT
    playoff_competition_id?: string | null;
    tie_breaker_rule?: string;
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
    status?: string;
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
    pbp_locked?: boolean;
}

export interface TeamSheetPlayer {
    player_id: string;
    name: string;
    jersey_number: number;
    position: string;
    gender?: string;
    image: string;
    // Per-match rating (Receiver/Defender/Rusher only). Null/absent for QB and
    // undetermined "-" positions, and for rateable players with no activity.
    rating?: number | null;
    rating_status?: string;
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
    search?: string,
    /** Narrow to one club. Filtered server-side so a club's fixtures aren't
     *  scattered across pages the client would have to fetch to find them. */
    teamId?: string
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
    if (teamId) {
        url += `&team_id=${teamId}`;
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
    gender?: string;
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
    excerpt?: string;
    content: string;
    featured_image?: string;
    featured_media_type?: 'image' | 'youtube';
    featured_youtube_url?: string;
    author?: string;
    category?: string;
    comments_enabled?: boolean;
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
    gender?: string;
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
    /** Distinct from referral_code (attribution only) — this one changes price. */
    discount_code?: string;
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
export const getAdminTeams = async (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    const response = await api.get('/admin/teams', { params });
    return response.data;
};

export const getTeamsByCompetition = async (competitionId: string, status?: string) => {
    const response = await api.get('/admin/teams/by-competition', { params: { competition_id: competitionId, status } });
    if (response.data && response.data.data !== undefined) {
        return { data: Array.isArray(response.data.data) ? response.data.data : [] };
    }
    return { data: Array.isArray(response.data) ? response.data : [] };
};

export const addTeamToCompetition = async (competitionId: string, teamId: string) => {
    const response = await api.post(`/admin/competitions/${competitionId}/teams`, { team_id: teamId });
    return response.data;
};

export const removeTeamFromCompetition = async (competitionId: string, teamId: string) => {
    const response = await api.delete(`/admin/competitions/${competitionId}/teams/${teamId}`);
    return response.data;
};

export const assignRandomJerseyNumbers = async (teamId?: string) => {
    const response = await api.post('/admin/players/assign-jersey-numbers', null, {
        params: teamId ? { team_id: teamId } : undefined,
    });
    return response.data as { message: string; assigned_count: number };
};

export const createTeam = async (payload: { name: string; short_name: string; logo: string; status?: string }) => {
    const response = await api.post('/admin/teams', payload);
    return response.data;
};

export const updateTeam = async (id: string, payload: { name: string; short_name: string; logo: string; status?: string }) => {
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

export const createCompetition = async (payload: { name: string; logo: string; status?: string; format?: string; playoff_competition_id?: string | null; tie_breaker_rule?: string }) => {
    const response = await api.post('/admin/competitions', payload);
    return response.data;
};

export const updateCompetition = async (id: string, payload: { name: string; logo: string; status?: string; format?: string; playoff_competition_id?: string | null; tie_breaker_rule?: string }) => {
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
    incomplete_passes: number;
    uncatchable_passes: number;
    thrown_away_passes: number;
    batted_down_passes: number;
    targets: number;
    passing_yards: number;
    rushing_yards: number;
    receiving_yards: number;
    passing_tds: number;
    rushing_tds: number;
    interceptions_thrown: number;
    receptions: number;
    receiving_tds: number;
    extra_points_tds: number;
    xp_attempts: number;
    xp_good: number;
    xp_fail: number;
    drops: number;
    flag_pulls: number;
    pass_deflections: number;
    interceptions: number;
    defensive_tds: number;
    safety: number;
    safety_conceded: number;
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
    incomplete_passes: number;
    uncatchable_passes: number;
    thrown_away_passes: number;
    batted_down_passes: number;
    targets: number;
    passing_yards: number;
    rushing_yards: number;
    receiving_yards: number;
    passing_tds: number;
    rushing_tds: number;
    interceptions_thrown: number;
    receptions: number;
    receiving_tds: number;
    extra_points_tds: number;
    xp_attempts: number;
    xp_good: number;
    xp_fail: number;
    drops: number;
    flag_pulls: number;
    pass_deflections: number;
    interceptions: number;
    defensive_tds: number;
    safety: number;
    safety_conceded: number;
    qb_sacks: number;
    def_sacks: number;
    defensive_xp_tds: number;
    // Team-only stats
    punts: number;
    first_downs: number;
    turnovers: number;
    penalties: number;
    penalty_yards: number;
    total_plays: number;
    drives: number;
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

export const getPlayerStats = async (compId?: string, eventDay?: string, page = 1, limit = 20, playerId?: string, search?: string, sort?: string, teamId?: string, position?: string): Promise<PaginatedResponse<PlayerStat>> => {
    let url = '/stats/players';
    const params = new URLSearchParams();
    if (compId) params.append('competition_id', compId);
    if (eventDay) params.append('event_day', eventDay);
    if (playerId) params.append('player_id', playerId);
    if (teamId) params.append('team_id', teamId);
    if (search) params.append('search', search);
    if (sort) params.append('sort', sort);
    if (position && position !== 'ALL') params.append('position', position);
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

export const getTeamStats = async (compId?: string, eventDay?: string, page = 1, limit = 20, sort?: string, teamId?: string): Promise<PaginatedResponse<TeamStat>> => {
    let url = '/stats/teams';
    const params = new URLSearchParams();
    if (compId) params.append('competition_id', compId);
    if (eventDay) params.append('event_day', eventDay);
    if (teamId) params.append('team_id', teamId);
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
    tags?: string[];
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
    /** Optional. An invalid code fails the checkout rather than being ignored. */
    discount_code?: string;
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
    discount_code?: string;
    discount_amount: number;
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

// ─── Play-by-Play (Step 1) ────────────────────────────────────────────────────

// Official code strings from the stat sheet (FG = Flag Pull, KO = Throw-Off).
export const PLAY_TYPE_CODES = ['CP', 'INC', 'TDP', 'INT', 'SACK', 'SCR', 'HM', 'TA', 'XP-P', 'RUN', 'QBR', 'SWP', 'REV', 'PAT-R', 'PUNT', 'KO', 'SAF'] as const;
// INC and SAF aren't on the official sheet's Result Codes list but are accepted
// by the backend as practical extensions — see domain.ResultCodes comment.
export const RESULT_CODES = ['1D', '1DG', 'TD', 'XP', 'XPF', 'TO', 'INT', 'OB', 'FG', 'DB', 'IH', 'EH', 'EG', 'INC', 'SAF'] as const;
export const PENALTY_CODES = ['FS', 'OFF', 'ENC', 'DOG', 'OPI', 'DPI', 'FGD', 'HLD', 'RPC', 'IMP', 'SUB', 'IF', 'MOT', 'FAV', 'UF'] as const;

// Player subset hydrated onto a play (name + jersey for display).
export interface PlayPlayer {
    id: string;
    name: string;
    jersey_number: number;
    position: string;
}

export interface GamePlay {
    id: string;
    match_id: string;
    seq: number;
    drive_no: number;
    quarter: number;
    clock?: string;
    offense_team_id?: string;
    down?: number;
    to_go?: number;
    ball_on?: string;
    play_type?: string;
    off_qb_id?: string;
    target_id?: string;
    yards?: number;
    result?: string;
    defender_id?: string;
    rusher_id?: string;
    center_id?: string;
    dropped: boolean;
    batted_down: boolean;
    uncatchable: boolean;
    returned_for_td: boolean;
    penalty?: string;
    penalty_team_id?: string;
    penalty_player_id?: string;
    penalty_yards?: number;
    home_score_after?: number;
    away_score_after?: number;
    notes?: string;
    // Hydrated relations
    offense_team?: Team;
    off_qb?: PlayPlayer;
    target?: PlayPlayer;
    defender?: PlayPlayer;
    rusher?: PlayPlayer;
    center?: PlayPlayer;
    penalty_player?: PlayPlayer;
}

// Mirrors backend dto.PlayRequest — every field optional; match_id is in the URL.
export interface PlayPayload {
    drive_no?: number;
    quarter?: number;
    clock?: string;
    offense_team_id?: string;
    down?: number | null;
    to_go?: number | null;
    ball_on?: string;
    play_type?: string;
    off_qb_id?: string;
    target_id?: string;
    yards?: number | null;
    result?: string;
    defender_id?: string;
    rusher_id?: string;
    center_id?: string;
    dropped?: boolean;
    batted_down?: boolean;
    uncatchable?: boolean;
    returned_for_td?: boolean;
    penalty?: string;
    penalty_team_id?: string;
    penalty_player_id?: string;
    penalty_yards?: number | null;
    home_score_after?: number | null;
    away_score_after?: number | null;
    notes?: string;
    seq?: number;
}

// Public read (used by the match page timeline later).
export const getMatchPlays = async (matchId: string): Promise<GamePlay[]> => {
    const res = await api.get<{ data: GamePlay[] }>(`/matches/${matchId}/plays`);
    return res.data.data || [];
};

// Admin read (same data, admin-gated route so the entry screen can load it).
export const getAdminMatchPlays = async (matchId: string): Promise<GamePlay[]> => {
    const res = await api.get<{ data: GamePlay[] }>(`/admin/matches/${matchId}/plays`);
    return res.data.data || [];
};

export const createPlay = async (matchId: string, payload: PlayPayload): Promise<GamePlay> => {
    const res = await api.post<{ data: GamePlay }>(`/admin/matches/${matchId}/plays`, payload);
    return res.data.data;
};

export const updatePlay = async (matchId: string, playId: string, payload: PlayPayload): Promise<GamePlay> => {
    const res = await api.put<{ data: GamePlay }>(`/admin/matches/${matchId}/plays/${playId}`, payload);
    return res.data.data;
};

export const deletePlay = async (matchId: string, playId: string) => {
    const res = await api.delete(`/admin/matches/${matchId}/plays/${playId}`);
    return res.data;
};

// Re-derive the down/distance/possession/drive of plays after a mid-sequence
// insert. The client computes the new snapshots (same logic as live entry) and
// sends them; the server applies them and recomputes the score.
export interface SituationUpdate {
    id: string;
    drive_no: number;
    down: number | null;
    to_go: number | null;
    offense_team_id?: string;
}

export const rederiveSituations = async (matchId: string, plays: SituationUpdate[]) => {
    const res = await api.post(`/admin/matches/${matchId}/plays/rederive-situations`, { plays });
    return res.data;
};

// Bulk re-derive of stats for every match that HAS a play log. Matches without
// one (e.g. the historical Excel imports) are excluded server-side, and scores /
// standings are never touched — stats only. App Admin only.
export interface BulkRecomputeMatch {
    match_id: string;
    label: string;
    date: string;
    plays: number;
    players: number;
    error?: string;
}

export interface BulkRecomputeResult {
    dry_run: boolean;
    matches_found: number;
    matches_updated: number;
    players_updated: number;
    failed: number;
    matches: BulkRecomputeMatch[];
}

export const recomputeAllStats = async (opts: { competitionId?: string; dryRun?: boolean } = {}): Promise<BulkRecomputeResult> => {
    const params = new URLSearchParams();
    if (opts.competitionId) params.set('competition_id', opts.competitionId);
    if (opts.dryRun) params.set('dry_run', 'true');
    const qs = params.toString();
    const res = await api.post<{ data: BulkRecomputeResult }>(`/admin/stats/recompute-all${qs ? `?${qs}` : ''}`);
    return res.data.data;
};

// Per-match play-by-play lock (admin only; each toggle is captured in the audit log).
export const setPBPLock = async (matchId: string, locked: boolean): Promise<boolean> => {
    const res = await api.post<{ data: { pbp_locked: boolean } }>(
        `/admin/matches/${matchId}/${locked ? 'pbp-lock' : 'pbp-unlock'}`,
    );
    return res.data.data.pbp_locked;
};

// Step 2 — stats derived from the play log vs the currently-stored manual stats.
export interface StatsCompare {
    derived: PlayerStat[];
    current: PlayerStat[];
}

export const getStatsCompare = async (matchId: string): Promise<StatsCompare> => {
    const res = await api.get<StatsCompare>(`/admin/matches/${matchId}/stats-compare`);
    return { derived: res.data.derived || [], current: res.data.current || [] };
};

// Box score for the public match page. Same derivation as the admin compare
// endpoint above, but unauthenticated — that one sits under /admin and is gated
// to admin/referee/stats, so using it here left the stats blank for anyone not
// signed in as staff. `current` only ever comes back empty.
export const getPublicMatchStats = async (matchId: string): Promise<StatsCompare> => {
    const res = await api.get<StatsCompare>(`/matches/${matchId}/stats`);
    return { derived: res.data.derived || [], current: res.data.current || [] };
};

export const commitDerivedStats = async (matchId: string): Promise<{ players: number }> => {
    const res = await api.post<{ players: number }>(`/admin/matches/${matchId}/stats-commit`, {});
    return res.data;
};

// Step 3 — scoring rules + score recompute.
export interface GameRules {
    competition_id: string;
    td_points: number;
    xp_run_points: number;
    xp_pass_points: number;
    safety_points: number;
    def_return_points: number;
    downs_per_series: number;
    yards_to_first_down: number;
    first_down_model: string;
}

export type GameRulesPayload = Omit<GameRules, 'competition_id'>;

export const getGameRules = async (competitionId: string): Promise<GameRules> => {
    const res = await api.get<{ data: GameRules }>(`/admin/competitions/${competitionId}/game-rules`);
    return res.data.data;
};

export const upsertGameRules = async (competitionId: string, payload: GameRulesPayload): Promise<GameRules> => {
    const res = await api.put<{ data: GameRules }>(`/admin/competitions/${competitionId}/game-rules`, payload);
    return res.data.data;
};

export const recomputeScore = async (matchId: string): Promise<{ home_score: number; away_score: number }> => {
    const res = await api.post<{ home_score: number; away_score: number }>(`/admin/matches/${matchId}/recompute-score`, {});
    return res.data;
};

export const commitScore = async (matchId: string): Promise<{ home_score: number; away_score: number }> => {
    const res = await api.post<{ home_score: number; away_score: number }>(`/admin/matches/${matchId}/commit-score`, {});
    return res.data;
};

// ─── Contracts, Transfers, Player Portal & Notifications ───────────────────────

export interface ContractData {
    id: string;
    player_id: string;
    team_id: string;
    status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'REJECTED';
    contract_length: number;
    matches_at_start: number;
    matches_played: number;
    matches_remaining: number;
    player_value: number;
    offered_by?: string;
    offered_at: string;
    accepted_at?: string;
    expired_at?: string;
    terminated_at?: string;
    termination_reason?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    player?: {
        id: string;
        name: string;
        jersey_number: number;
        position: string;
        image: string;
    };
    team?: {
        id: string;
        name: string;
        short_name: string;
        logo: string;
    };
}

export interface IssueContractPayload {
    player_id: string;
    contract_length?: number;
    player_value?: number;
    notes?: string;
}

export interface TransferData {
    id: string;
    type: 'REQUEST' | 'LISTING' | 'DIRECT_SALE';
    status: 'PENDING' | 'REVIEW' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
    player_id: string;
    from_team_id: string;
    to_team_id?: string;
    initiated_by?: string;
    asking_price?: number;
    notes?: string;
    review_notes?: string;
    completed_at?: string;
    from_team_approved: boolean;
    to_team_approved: boolean;
    created_at: string;
    updated_at: string;
    player?: {
        id: string;
        name: string;
        jersey_number: number;
        position: string;
        image: string;
    };
    from_team?: {
        id: string;
        name: string;
        short_name: string;
        logo: string;
    };
    to_team?: {
        id: string;
        name: string;
        short_name: string;
        logo: string;
    };
    bids?: TransferBidData[];
}

export interface TransferBidData {
    id: string;
    transfer_id: string;
    bidder_team_id: string;
    bid_value: number;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    bidder_id?: string;
    created_at: string;
    bidder_team?: {
        id: string;
        name: string;
        short_name: string;
        logo: string;
    };
}

export interface TeamBudgetData {
    id: string;
    team_id: string;
    total_budget: number;
    spent: number;
    remaining: number;
    created_at: string;
    updated_at: string;
    team?: {
        id: string;
        name: string;
        short_name: string;
        logo: string;
    };
}

export interface TransferWindowData {
    id: string;
    name: string;
    opens_at: string;
    closes_at: string;
    is_active: boolean;
    is_open: boolean;
    created_at: string;
    updated_at: string;
}

export interface NotificationData {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    reference_type?: string;
    reference_id?: string;
    is_read: boolean;
    created_at: string;
}

// Contract API
export const contractsApi = {
    issue: async (data: IssueContractPayload): Promise<ContractData> => {
        const res = await api.post<{ data: ContractData }>('/contracts', data);
        return res.data.data;
    },
    getTeamContracts: async (params?: { team_id?: string; status?: string; search?: string; page?: number; limit?: number }): Promise<PaginatedResponse<ContractData>> => {
        const res = await api.get<PaginatedResponse<ContractData>>('/contracts/team', { params });
        return res.data;
    },
    getFreeAgents: async (params?: { search?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Player>> => {
        const res = await api.get<PaginatedResponse<Player>>('/contracts/free-agents', { params });
        return res.data;
    },
    getById: async (id: string): Promise<ContractData> => {
        const res = await api.get<{ data: ContractData }>(`/contracts/${id}`);
        return res.data.data;
    },
    renew: async (id: string, data: { contract_length?: number; player_value?: number }): Promise<ContractData> => {
        const res = await api.post<{ data: ContractData }>(`/contracts/${id}/renew`, data);
        return res.data.data;
    },
    release: async (id: string): Promise<void> => {
        await api.delete(`/contracts/${id}/release`);
    },
    cancelOffer: async (id: string): Promise<void> => {
        await api.post(`/contracts/${id}/cancel`);
    },
};

// Transfer API
export const transfersApi = {
    createRequest: async (data: { player_id: string; to_team_id: string; notes?: string }): Promise<TransferData> => {
        const res = await api.post<{ data: TransferData }>('/transfers/request', data);
        return res.data.data;
    },
    createListing: async (data: { player_id: string; asking_price: number }): Promise<TransferData> => {
        const res = await api.post<{ data: TransferData }>('/transfers/listing', data);
        return res.data.data;
    },
    createDirectSale: async (data: { player_id: string; to_team_id: string; price: number }): Promise<TransferData> => {
        const res = await api.post<{ data: TransferData }>('/transfers/direct-sale', data);
        return res.data.data;
    },
    getMarket: async (params?: { search?: string; page?: number; limit?: number }): Promise<PaginatedResponse<TransferData>> => {
        const res = await api.get<PaginatedResponse<TransferData>>('/transfers/market', { params });
        return res.data;
    },
    getTeamTransfers: async (params?: { type?: string; status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<TransferData>> => {
        const res = await api.get<PaginatedResponse<TransferData>>('/transfers/team', { params });
        return res.data;
    },
    getById: async (id: string): Promise<TransferData> => {
        const res = await api.get<{ data: TransferData }>(`/transfers/${id}`);
        return res.data.data;
    },
    respond: async (id: string, data: { action: 'accept' | 'reject' | 'review'; notes?: string }): Promise<TransferData> => {
        const res = await api.put<{ data: TransferData }>(`/transfers/${id}/respond`, data);
        return res.data.data;
    },
    placeBid: async (id: string, data: { bid_value: number }): Promise<TransferBidData> => {
        const res = await api.post<{ data: TransferBidData }>(`/transfers/${id}/bid`, data);
        return res.data.data;
    },
    respondToBid: async (transferId: string, bidId: string, action: 'accept' | 'reject'): Promise<void> => {
        await api.put(`/transfers/${transferId}/bids/${bidId}/respond`, { action });
    },
    getBudget: async (): Promise<TeamBudgetData> => {
        const res = await api.get<{ data: TeamBudgetData }>('/transfers/budget');
        return res.data.data;
    },
    getWindowStatus: async (): Promise<{ data: TransferWindowData | null; is_open: boolean }> => {
        const res = await api.get<{ data: TransferWindowData | null; is_open: boolean }>('/transfers/window');
        return res.data;
    },
    getPlayerTransfers: async (playerID: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<TransferData>> => {
        const res = await api.get<PaginatedResponse<TransferData>>(`/transfers/player/${playerID}`, { params });
        return res.data;
    },
};

// Player Portal API
export const playerPortalApi = {
    getContracts: async (): Promise<ContractData[]> => {
        const res = await api.get<{ data: ContractData[] }>('/player-portal/contracts');
        return res.data.data || [];
    },
    getContractById: async (id: string): Promise<ContractData> => {
        const res = await api.get<{ data: ContractData }>(`/player-portal/contracts/${id}`);
        return res.data.data;
    },
    respondToContract: async (id: string, action: 'accept' | 'reject', notes?: string): Promise<void> => {
        await api.put(`/player-portal/contracts/${id}/respond`, { action, notes });
    },
    getMyTransfers: async (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<TransferData>> => {
        const res = await api.get<PaginatedResponse<TransferData>>('/player-portal/transfers', { params });
        return res.data;
    },
};

// Notifications API
export const notificationsApi = {
    getAll: async (params?: { unread_only?: boolean; page?: number; limit?: number }): Promise<PaginatedResponse<NotificationData>> => {
        const res = await api.get<PaginatedResponse<NotificationData>>('/notifications', { params });
        return res.data;
    },
    getUnreadCount: async (): Promise<number> => {
        const res = await api.get<{ unread_count: number }>('/notifications/unread-count');
        return res.data.unread_count || 0;
    },
    markAsRead: async (id: string): Promise<void> => {
        await api.put(`/notifications/${id}/read`);
    },
    markAllAsRead: async (): Promise<void> => {
        await api.put('/notifications/read-all');
    },
};

// Admin Transfer/Contract API
export const adminTransfersApi = {
    overrideContract: async (id: string, status: string, reason?: string): Promise<void> => {
        await api.put(`/admin/contracts/${id}/override`, { status, reason });
    },
    forceAcceptContract: async (id: string): Promise<{ message: string }> => {
        const res = await api.post<{ message: string }>(`/admin/contracts/${id}/force-accept`);
        return res.data;
    },
    overrideTransfer: async (id: string, status: string, notes?: string): Promise<void> => {
        await api.put(`/admin/transfers/${id}/override`, { status, notes });
    },
    getWindows: async (): Promise<TransferWindowData[]> => {
        const res = await api.get<{ data: TransferWindowData[] }>('/admin/transfer-windows');
        return res.data.data || [];
    },
    createWindow: async (data: { name: string; opens_at: string; closes_at: string; is_active?: boolean }): Promise<TransferWindowData> => {
        const res = await api.post<{ data: TransferWindowData }>('/admin/transfer-windows', data);
        return res.data.data;
    },
    updateWindow: async (id: string, data: { name?: string; opens_at?: string; closes_at?: string; is_active?: boolean }): Promise<TransferWindowData> => {
        const res = await api.put<{ data: TransferWindowData }>(`/admin/transfer-windows/${id}`, data);
        return res.data.data;
    },
    deleteWindow: async (id: string): Promise<void> => {
        await api.delete(`/admin/transfer-windows/${id}`);
    },
    getAllBudgets: async (): Promise<TeamBudgetData[]> => {
        const res = await api.get<{ data: TeamBudgetData[] }>('/admin/team-budgets');
        return res.data.data || [];
    },
    adjustBudget: async (teamId: string, total_budget: number): Promise<void> => {
        await api.put(`/admin/team-budgets/${teamId}`, { total_budget });
    },
    seedBudgets: async (): Promise<void> => {
        await api.post('/admin/team-budgets/seed');
    },
};

// ─── Player Account Claims ────────────────────────────────────────────────────
// Every player in the database came from the historical import with no email, phone
// or photo, so none of them can be authenticated by contact details. A claimant
// identifies themselves to their team manager, who is the only party able to confirm
// who they are; approval is what mints the account.

export interface ClaimablePlayerData {
    id: string;
    name: string;
    jersey_number?: number;
    position?: string;
}

export interface VerifyClaimCodeData {
    team_id: string;
    team_name: string;
    team_logo?: string;
    players: ClaimablePlayerData[];
}

export interface SubmitClaimPayload {
    code: string;
    email: string;
    password: string;
    phone?: string;
    player_id?: string;
    full_name?: string;
    proposed_jersey_number?: number;
    proposed_position?: string;
}

export interface SubmitClaimData {
    claim_id: string;
    status: string;
    access_token?: string;
    user_id: string;
    user_type: string;
    message: string;
}

export interface MyClaimStatusData {
    has_claim: boolean;
    claim_id?: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    team_name?: string;
    player_name?: string;
    claimed_email?: string;
    claimed_phone?: string;
    claimed_photo?: string;
    email_verified: boolean;
    reject_reason?: string;
    created_at?: string;
}

export interface PlayerClaimData {
    id: string;
    player_id?: string;
    team_id: string;
    team_name?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';

    claimed_email: string;
    claimed_phone?: string;
    claimed_photo?: string;
    email_verified: boolean;

    is_new_player_request: boolean;
    proposed_name?: string;
    proposed_jersey_number?: number;
    proposed_position?: string;

    player_name?: string;
    player_jersey_number?: number;
    player_position?: string;
    player_image?: string;
    past_teams?: string[];
    matches_played: number;

    reject_reason?: string;
    reviewed_by?: string;
    reviewed_at?: string;
    created_at: string;
}

export interface ClaimCodeData {
    id: string;
    team_id: string;
    team_name?: string;
    code: string;
    expires_at?: string;
    max_uses: number;
    uses: number;
    revoked: boolean;
    created_at: string;
}

export const claimApi = {
    // Public — the claim page
    verifyCode: async (code: string): Promise<VerifyClaimCodeData> => {
        const res = await api.post<VerifyClaimCodeData>('/claim/verify-code', { code });
        return res.data;
    },
    submit: async (payload: SubmitClaimPayload): Promise<SubmitClaimData> => {
        const res = await api.post<SubmitClaimData>('/claim/submit', payload);
        return res.data;
    },
    verifyEmail: async (token: string): Promise<void> => {
        await api.post('/claim/verify-email', { token });
    },

    // The claimant's own pending claim
    getMyStatus: async (): Promise<MyClaimStatusData> => {
        const res = await api.get<MyClaimStatusData>('/claim/my-status');
        return res.data;
    },
    setMyPhoto: async (photo: string): Promise<void> => {
        await api.patch('/claim/my-photo', { photo });
    },
    resendVerification: async (): Promise<void> => {
        await api.post('/claim/resend-verification');
    },
};

// Team manager review + code management
export const teamHeadClaimsApi = {
    list: async (params?: { status?: string; search?: string; page?: number; limit?: number }): Promise<PaginatedResponse<PlayerClaimData>> => {
        const res = await api.get<PaginatedResponse<PlayerClaimData>>('/team-head/claims', { params });
        return res.data;
    },
    approve: async (id: string, data?: { name?: string; jersey_number?: number; position?: string }): Promise<void> => {
        await api.post(`/team-head/claims/${id}/approve`, data || {});
    },
    reject: async (id: string, reason: string): Promise<void> => {
        await api.post(`/team-head/claims/${id}/reject`, { reason });
    },
    getCode: async (): Promise<ClaimCodeData | null> => {
        const res = await api.get<ClaimCodeData | { code: null }>('/team-head/claim-codes');
        const data = res.data as ClaimCodeData;
        return data && data.code ? data : null;
    },
    generateCode: async (data?: { expires_in_days?: number; max_uses?: number }): Promise<ClaimCodeData> => {
        const res = await api.post<ClaimCodeData>('/team-head/claim-codes', data || {});
        return res.data;
    },
    revokeCode: async (id: string): Promise<void> => {
        await api.delete(`/team-head/claim-codes/${id}`);
    },
};

export const adminClaimsApi = {
    list: async (params?: { status?: string; search?: string; team_id?: string; page?: number; limit?: number }): Promise<PaginatedResponse<PlayerClaimData>> => {
        const res = await api.get<PaginatedResponse<PlayerClaimData>>('/admin/claims', { params });
        return res.data;
    },
    approve: async (id: string, data?: { name?: string; jersey_number?: number; position?: string }): Promise<void> => {
        await api.post(`/admin/claims/${id}/approve`, data || {});
    },
    reject: async (id: string, reason: string): Promise<void> => {
        await api.post(`/admin/claims/${id}/reject`, { reason });
    },
    revoke: async (id: string): Promise<void> => {
        await api.post(`/admin/claims/${id}/revoke`);
    },
    listCodes: async (): Promise<ClaimCodeData[]> => {
        const res = await api.get<{ data: ClaimCodeData[] }>('/admin/claim-codes');
        return res.data.data || [];
    },
    generateCode: async (team_id: string, data?: { expires_in_days?: number; max_uses?: number }): Promise<ClaimCodeData> => {
        const res = await api.post<ClaimCodeData>('/admin/claim-codes', { team_id, ...(data || {}) });
        return res.data;
    },
    revokeCode: async (id: string): Promise<void> => {
        await api.delete(`/admin/claim-codes/${id}`);
    },
};

export interface AppSettingsData {
    app_font_id: string;
}

// Site-wide display settings. The read is public (every visitor needs the app
// font on boot); only an admin can write, which is what makes the choice apply
// to everyone rather than just the browser that made it.
export const appSettingsApi = {
    get: async (): Promise<AppSettingsData> => {
        const res = await api.get<AppSettingsData>('/app-settings');
        return res.data;
    },
    setFont: async (app_font_id: string): Promise<AppSettingsData> => {
        const res = await api.put<AppSettingsData>('/admin/app-settings/font', { app_font_id });
        return res.data;
    },
};

export interface CommentData {
    id: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    user_full_name: string;
    user_avatar?: string;
    user_role: string;
    content: string;
    parent_id?: string;
    likes_count: number;
    is_liked_by_caller: boolean;
    created_at: string;
    updated_at: string;
    replies: CommentData[];
}

/** One page of a thread. `total` counts top-level comments (what pages are made
 *  of); `total_all` includes replies and is the count shown on the thread. */
export interface CommentPage {
    data: CommentData[];
    total: number;
    total_all: number;
    page: number;
    limit: number;
    total_pages: number;
    has_more: boolean;
}

export const COMMENTS_PAGE_SIZE = 30;

export const commentsApi = {
    getComments: async (
        entityType: string,
        entityId: string,
        page = 1,
        limit = COMMENTS_PAGE_SIZE,
    ): Promise<CommentPage> => {
        const res = await api.get<CommentPage>('/comments', {
            params: { entity_type: entityType, entity_id: entityId, page, limit },
        });
        return {
            ...res.data,
            data: res.data.data || [],
        };
    },
    createComment: async (data: { entity_type: string; entity_id: string; content: string; parent_id?: string }): Promise<CommentData> => {
        const res = await api.post<{ data: CommentData }>('/comments', data);
        return res.data.data;
    },
    deleteComment: async (id: string): Promise<void> => {
        await api.delete(`/comments/${id}`);
    },
    likeComment: async (id: string): Promise<{ liked: boolean; likes_count: number }> => {
        const res = await api.post<{ liked: boolean; likes_count: number }>(`/comments/${id}/like`);
        return res.data;
    },
    updateNewsCommentSettings: async (newsId: string, commentsEnabled: boolean): Promise<void> => {
        await api.put(`/admin/news/${newsId}/comment-settings`, { comments_enabled: commentsEnabled });
    },
};

// ─── Discount codes ───────────────────────────────────────────────────────────

/** Who may redeem a code. Defaults to 'all'. */
export type DiscountAudience = 'all' | 'authenticated' | 'guest';

/** One product or ticket tier a code covers, with its own naira reduction. */
export interface DiscountCodeItem {
    id?: string;
    entity_type: 'product' | 'ticket_tier';
    entity_id: string;
    entity_name?: string;
    entity_price?: number;
    amount_off: number;
}

export interface DiscountCode {
    id: string;
    code: string;
    description: string;
    max_uses?: number | null;
    used_count: number;
    expires_at?: string | null;
    audience: DiscountAudience;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    items: DiscountCodeItem[];
    is_expired: boolean;
    is_exhausted: boolean;
}

export interface SaveDiscountCodePayload {
    code: string;
    description?: string;
    max_uses?: number | null;
    expires_at?: string | null;
    audience?: DiscountAudience;
    is_active?: boolean;
    items: { entity_type: 'product' | 'ticket_tier'; entity_id: string; amount_off: number }[];
}

/** A product or tier selectable in the admin code editor. */
export interface DiscountTarget {
    entity_type: 'product' | 'ticket_tier';
    entity_id: string;
    name: string;
    price: number;
}

export interface DiscountPreview {
    code: string;
    valid: boolean;
    /** Why the code was rejected. Safe to show to the buyer verbatim. */
    message?: string;
    lines: { entity_type: string; entity_id: string; name: string; amount_off: number }[];
    original_amount: number;
    discount_amount: number;
    final_amount: number;
}

export const discountsApi = {
    list: async (): Promise<DiscountCode[]> => {
        const res = await api.get<{ data: DiscountCode[] }>('/admin/discount-codes');
        return res.data.data || [];
    },
    listTargets: async (): Promise<DiscountTarget[]> => {
        const res = await api.get<{ data: DiscountTarget[] }>('/admin/discount-codes/targets');
        return res.data.data || [];
    },
    create: async (payload: SaveDiscountCodePayload): Promise<DiscountCode> => {
        const res = await api.post<{ data: DiscountCode }>('/admin/discount-codes', payload);
        return res.data.data;
    },
    update: async (id: string, payload: SaveDiscountCodePayload): Promise<DiscountCode> => {
        const res = await api.put<{ data: DiscountCode }>(`/admin/discount-codes/${id}`, payload);
        return res.data.data;
    },
    remove: async (id: string): Promise<void> => {
        await api.delete(`/admin/discount-codes/${id}`);
    },

    /**
     * Asks the server what a code would do. The cart is re-priced server-side
     * through the same path checkout uses, so the saving shown is the saving
     * charged. Never applies the code — that happens at checkout.
     */
    preview: async (params: {
        code: string;
        items?: CheckoutItemPayload[];
        tier_id?: string;
        quantity?: number;
    }): Promise<DiscountPreview> => {
        const res = await api.post<DiscountPreview>('/discounts/preview', params);
        return res.data;
    },
};

// ─── Fantasy Module Types & API ──────────────────────────────────────────────

export type FantasySlot =
    | 'QB_M'
    | 'QB_F'
    | 'REC_1'
    | 'REC_2'
    | 'REC_3'
    | 'REC_4'
    | 'REC_5'
    | 'RUSHER'
    | 'DEF_1'
    | 'DEF_2'
    | 'DEF_3'
    | 'DEF_4'
    | 'DEF_5'
    | 'DEF_6';

export interface FantasySeason {
    id: string;
    competition_id: string;
    name: string;
    squad_size: number;
    budget: number;
    min_female_offense: number;
    min_female_defense: number;
    max_per_club: number;
    lock_mins_before: number;
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
    created_at: string;
}

export interface FantasyGameweek {
    id: string;
    season_id: string;
    number: number;
    event_day_id: string;
    deadline: string;
    status: 'SCHEDULED' | 'LOCKED' | 'LIVE' | 'FINALIZED';
}

export interface FantasyPlayerListItem {
    player_id: string;
    player_name: string;
    player_image: string;
    position: string;
    gender: string;
    team_id: string;
    team_name: string;
    team_short_name: string;
    team_logo: string;
    price: number;
    rating: number;
    total_points: number;
    selected_by_pct: number;
}

export interface FantasyLineupPick {
    slot: FantasySlot;
    player_id: string;
    player_name?: string;
    player_image?: string;
    position?: string;
    gender?: string;
    team_id?: string;
    team_name?: string;
    team_short_name?: string;
    team_logo?: string;
    purchase_price: number;
    current_price: number;
    points: number;
}

export interface FantasyLineupResponse {
    id: string;
    team_id: string;
    team_name: string;
    gameweek_id: string;
    total_spent: number;
    remaining_budget: number;
    points: number;
    status: 'DRAFT' | 'LOCKED';
    is_rollover: boolean;
    picks: FantasyLineupPick[];
}

export interface PointsBreakdown {
    version: string;
    passing_yards_pts: number;
    passing_tds_pts: number;
    interceptions_thrown_pts: number;
    qb_sacks_pts: number;
    rushing_yards_pts: number;
    rushing_tds_pts: number;
    receptions_pts: number;
    receiving_yards_pts: number;
    receiving_tds_pts: number;
    drops_pts: number;
    xp_good_pts: number;
    extra_point_tds_pts: number;
    bad_snaps_pts: number;
    offensive_positive: number;
    offensive_negative: number;
    offensive_total: number;
    flag_pulls_pts: number;
    pass_deflections_pts: number;
    interceptions_pts: number;
    def_sacks_pts: number;
    defensive_tds_pts: number;
    defensive_xp_tds_pts: number;
    safety_pts: number;
    safety_conceded_pts: number;
    defensive_total: number;
    net_total: number;
}

export interface PlayerGWBreakdownResponse {
    player_id: string;
    player_name: string;
    match_id: string;
    match_label: string;
    points: number;
    breakdown: PointsBreakdown;
}

export interface FantasyLeague {
    id: string;
    season_id: string;
    name: string;
    type: 'OVERALL' | 'PUBLIC' | 'PRIVATE';
    invite_code?: string;
    // Absent/empty for the system-owned OVERALL league, which has no human owner.
    created_by_user_id?: string;
    entry_fee: number;
    max_members: number;
    member_count: number;
    createdAt?: string;
}

export interface JoinLeagueResponse {
    league_id: string;
    league_name: string;
    paystack_url?: string;
    paystack_ref?: string;
    paystack_access_code?: string;
}

export interface LeaderboardEntry {
    rank: number;
    user_id: string;
    user_name: string;
    team_name: string;
    team_id: string;
    gw_points: number;
    total_points: number;
}

export const fantasyApi = {
    getActiveSeason: async (): Promise<FantasySeason | null> => {
        const res = await api.get<{ data: FantasySeason | null }>('/fantasy/season');
        return res.data.data;
    },
    getGameweeks: async (seasonId: string): Promise<FantasyGameweek[]> => {
        const res = await api.get<{ data: FantasyGameweek[] }>(`/fantasy/season/${seasonId}/gameweeks`);
        return res.data.data || [];
    },
    listPlayerMarket: async (
        seasonId: string,
        params?: {
            /** Comma-separated list of positions, e.g. "Receiver,Center". Filtered server-side. */
            position?: string;
            /** 'M' or 'F'. Omit for any gender. Filtered server-side. */
            gender?: 'M' | 'F';
            team_id?: string;
            search?: string;
            sort?: string;
            page?: number;
            limit?: number;
        }
    ): Promise<{ data: FantasyPlayerListItem[]; total: number; total_pages: number }> => {
        const res = await api.get<{ data: FantasyPlayerListItem[]; total: number; total_pages: number }>(
            `/fantasy/season/${seasonId}/market`,
            { params }
        );
        return res.data;
    },
    getPlayerBreakdown: async (playerId: string, gwId: string): Promise<PlayerGWBreakdownResponse> => {
        const res = await api.get<{ data: PlayerGWBreakdownResponse }>(
            `/fantasy/players/${playerId}/gameweek/${gwId}/breakdown`
        );
        return res.data.data;
    },
    saveLineup: async (payload: {
        season_id: string;
        gameweek_id: string;
        team_name: string;
        picks: { player_id: string; slot: FantasySlot }[];
    }): Promise<FantasyLineupResponse> => {
        const res = await api.post<{ data: FantasyLineupResponse }>('/fantasy/lineups', payload);
        return res.data.data;
    },
    getMyLineup: async (seasonId: string, gameweekId: string): Promise<FantasyLineupResponse | null> => {
        const res = await api.get<{ data: FantasyLineupResponse | null }>('/fantasy/lineups/mine', {
            params: { season_id: seasonId, gameweek_id: gameweekId },
        });
        return res.data.data;
    },
    listPublicLeagues: async (seasonId: string): Promise<FantasyLeague[]> => {
        const res = await api.get<{ data: FantasyLeague[] }>('/fantasy/leagues/public', {
            params: { season_id: seasonId },
        });
        return res.data.data || [];
    },
    listMyLeagues: async (seasonId: string): Promise<FantasyLeague[]> => {
        const res = await api.get<{ data: FantasyLeague[] }>('/fantasy/leagues/mine', {
            params: { season_id: seasonId },
        });
        return res.data.data || [];
    },
    createLeague: async (payload: {
        season_id: string;
        name: string;
        type: 'PUBLIC' | 'PRIVATE';
        entry_fee: number;
        max_members: number;
    }): Promise<FantasyLeague> => {
        const res = await api.post<{ data: FantasyLeague }>('/fantasy/leagues', payload);
        return res.data.data;
    },
    joinLeague: async (seasonId: string, inviteCode: string): Promise<JoinLeagueResponse> => {
        const res = await api.post<JoinLeagueResponse>(
            '/fantasy/leagues/join',
            { invite_code: inviteCode },
            { params: { season_id: seasonId } }
        );
        return res.data;
    },
    verifyLeaguePayment: async (reference: string): Promise<{ message: string }> => {
        const res = await api.post<{ message: string }>('/fantasy/leagues/verify', { reference });
        return res.data;
    },
    getLeaderboard: async (
        leagueId: string,
        params?: { gameweek_id?: string; page?: number; limit?: number }
    ): Promise<{ data: LeaderboardEntry[]; total: number; total_pages: number }> => {
        const res = await api.get<{ data: LeaderboardEntry[]; total: number; total_pages: number }>(
            `/fantasy/leagues/${leagueId}/leaderboard`,
            { params }
        );
        return res.data;
    },
    getOverallLeaderboard: async (
        seasonId: string,
        params?: { gameweek_id?: string; page?: number; limit?: number }
    ): Promise<{ data: LeaderboardEntry[]; total: number; total_pages: number }> => {
        const res = await api.get<{ data: LeaderboardEntry[]; total: number; total_pages: number }>(
            `/fantasy/season/${seasonId}/leaderboard`,
            { params }
        );
        return res.data;
    },

    // Admin
    adminCreateSeason: async (payload: {
        competition_id: string;
        name: string;
        squad_size: number;
        budget: number;
        min_female_offense: number;
        min_female_defense: number;
        max_per_club: number;
        lock_mins_before: number;
    }): Promise<FantasySeason> => {
        const res = await api.post<{ data: FantasySeason }>('/admin/fantasy/seasons', payload);
        return res.data.data;
    },
    adminActivateSeason: async (seasonId: string): Promise<void> => {
        await api.post(`/admin/fantasy/seasons/${seasonId}/activate`);
    },
    adminCreateGameweek: async (
        seasonId: string,
        // Omit `deadline` and the server computes it from the event day's first
        // kickoff minus the season's lock_mins_before. Supply an RFC3339 string
        // to override that.
        payload: { number: number; event_day_id: string; deadline?: string }
    ): Promise<FantasyGameweek> => {
        const res = await api.post<{ data: FantasyGameweek }>(`/admin/fantasy/seasons/${seasonId}/gameweeks`, payload);
        return res.data.data;
    },
    /** Corrects a gameweek's lock deadline after creation. `deadline` is RFC3339. */
    adminUpdateGameweekDeadline: async (gwId: string, deadline: string): Promise<void> => {
        await api.post(`/admin/fantasy/gameweeks/${gwId}/deadline`, { deadline });
    },
    adminInitializePrices: async (seasonId: string): Promise<void> => {
        await api.post(`/admin/fantasy/seasons/${seasonId}/prices/initialize`);
    },
    /** Safe to re-run: re-finalizing recomputes scores rather than double-counting. */
    adminFinalizeGameweek: async (gwId: string): Promise<void> => {
        await api.post(`/admin/fantasy/gameweeks/${gwId}/finalize`);
    },
};

// ─── Fantasy Wallet, Payouts & Admin Finance ─────────────────────────────────

// Every amount below is integer kobo (₦1 = 100 kobo), matching the Paystack
// amounts used on the way in. Divide by 100 to display naira.
export const koboToNaira = (kobo: number) => kobo / 100;

export const formatKobo = (kobo: number) =>
    `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type WalletTransactionType = 'WINNINGS' | 'PAYOUT' | 'PAYOUT_REVERSAL' | 'ADJUSTMENT';

export interface WalletTransaction {
    id: string;
    amount_kobo: number; // signed: credits positive, debits negative
    type: WalletTransactionType;
    league_id?: string;
    league_name?: string;
    description: string;
    created_at: string;
}

export interface BankDetails {
    bank_name: string;
    account_number: string;
    account_name: string;
}

export interface FantasyWallet {
    balance_kobo: number;
    pending_payout_kobo: number;
    lifetime_won_kobo: number;
    lifetime_paid_kobo: number;
    min_payout_kobo: number;
    can_request_payout: boolean;
    last_bank_details?: BankDetails;
    transactions: WalletTransaction[];
}

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'REJECTED' | 'CANCELLED';

export interface PayoutRequest {
    id: string;
    user_id: string;
    user_name?: string;
    user_email?: string;
    amount_kobo: number;
    status: PayoutStatus;
    bank_name: string;
    account_number: string;
    account_name: string;
    user_notes: string;
    admin_notes: string;
    payment_reference?: string;
    processed_at?: string;
    created_at: string;
}

export interface PrizeAward {
    user_id: string;
    team_id: string;
    team_name: string;
    user_name: string;
    rank: number;
    points: number;
    amount_kobo: number;
    shared_with: number; // >1 when the position was tied
    description: string;
}

export interface PrizeTier {
    rank: number;
    percent: number;
    amount_kobo: number;
}

export interface LeagueFinance {
    league_id: string;
    league_name: string;
    type: 'OVERALL' | 'PUBLIC' | 'PRIVATE';
    entry_fee_kobo: number;
    paid_members: number;
    pending_members: number;
    gross_entry_kobo: number;
    platform_cut_kobo: number;
    prize_pool_kobo: number;
    cut_percent: number;
    settled: boolean;
    settled_at?: string;
    prize_structure: PrizeTier[];
    awards: PrizeAward[]; // projected before settlement, actual after
}

export interface AdminFantasyOverview {
    season_id: string;
    season_name: string;
    status: string;
    total_managers: number;
    total_lineups: number;
    total_leagues: number;
    paid_leagues: number;
    gross_entry_kobo: number;
    platform_cut_kobo: number;
    prize_pool_kobo: number;
    cut_percent: number;
    unsettled_leagues: number;
    wallet_liability_kobo: number;
    pending_payout_kobo: number;
    pending_payout_count: number;
    paid_out_kobo: number;
}

export interface AdminManagerRow {
    rank: number;
    user_id: string;
    user_name: string;
    user_email: string;
    team_id: string;
    team_name: string;
    total_points: number;
    lineup_count: number;
    league_count: number;
    wallet_balance_kobo: number;
    created_at: string;
}

export interface AdminLeagueRow {
    league_id: string;
    name: string;
    type: 'OVERALL' | 'PUBLIC' | 'PRIVATE';
    invite_code?: string;
    owner_name?: string;
    entry_fee_kobo: number;
    max_members: number;
    member_count: number;
    paid_members: number;
    pending_members: number;
    gross_entry_kobo: number;
    platform_cut_kobo: number;
    prize_pool_kobo: number;
    settled: boolean;
    settled_at?: string;
    created_at: string;
}

export interface AdminLeagueMemberRow {
    user_id: string;
    user_name: string;
    user_email: string;
    team_id: string;
    team_name: string;
    total_points: number;
    payment_status: 'FREE' | 'PENDING' | 'PAID' | 'FAILED';
    paystack_reference?: string;
    joined_at: string;
}

export interface SettlementResult {
    leagues_settled: number;
    leagues_skipped: number;
    total_awarded_kobo: number;
    platform_cut_kobo: number;
    awards: PrizeAward[];
}

interface Paged<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

export const fantasyWalletApi = {
    getWallet: async (): Promise<FantasyWallet> => {
        const res = await api.get<{ data: FantasyWallet }>('/fantasy/wallet');
        return res.data.data;
    },
    // Throws 409 when the balance is too low; the message is in error.response.data.error.
    requestPayout: async (payload: {
        amount_kobo: number;
        bank_name: string;
        account_number: string;
        account_name: string;
        user_notes?: string;
    }): Promise<PayoutRequest> => {
        const res = await api.post<{ data: PayoutRequest }>('/fantasy/payouts', payload);
        return res.data.data;
    },
    listMyPayouts: async (): Promise<PayoutRequest[]> => {
        const res = await api.get<{ data: PayoutRequest[] }>('/fantasy/payouts');
        return res.data.data || [];
    },
    cancelPayout: async (id: string): Promise<PayoutRequest> => {
        const res = await api.post<{ data: PayoutRequest }>(`/fantasy/payouts/${id}/cancel`);
        return res.data.data;
    },
};

export const fantasyAdminApi = {
    // Returns every season including DRAFT ones. `getActiveSeason` only ever
    // returns an ACTIVE season, so admin screens must use this or they cannot
    // see — let alone activate — a season they just created.
    listSeasons: async (): Promise<FantasySeason[]> => {
        const res = await api.get<{ data: FantasySeason[] }>('/admin/fantasy/seasons');
        return res.data.data || [];
    },
    // Only a DRAFT season with no squads entered can be deleted; the server
    // refuses anything already launched.
    deleteSeason: async (seasonId: string): Promise<void> => {
        await api.delete(`/admin/fantasy/seasons/${seasonId}`);
    },
    getOverview: async (seasonId: string): Promise<AdminFantasyOverview> => {
        const res = await api.get<{ data: AdminFantasyOverview }>(`/admin/fantasy/seasons/${seasonId}/overview`);
        return res.data.data;
    },
    listManagers: async (
        seasonId: string,
        params?: { search?: string; page?: number; limit?: number }
    ): Promise<Paged<AdminManagerRow>> => {
        const res = await api.get<Paged<AdminManagerRow>>(`/admin/fantasy/seasons/${seasonId}/managers`, { params });
        return res.data;
    },
    // Includes PRIVATE leagues, unlike the public browse endpoint.
    listLeagues: async (
        seasonId: string,
        params?: { search?: string; page?: number; limit?: number }
    ): Promise<Paged<AdminLeagueRow>> => {
        const res = await api.get<Paged<AdminLeagueRow>>(`/admin/fantasy/seasons/${seasonId}/leagues`, { params });
        return res.data;
    },
    getLeagueFinance: async (leagueId: string): Promise<LeagueFinance> => {
        const res = await api.get<{ data: LeagueFinance }>(`/admin/fantasy/leagues/${leagueId}/finance`);
        return res.data.data;
    },
    listLeagueMembers: async (leagueId: string): Promise<AdminLeagueMemberRow[]> => {
        const res = await api.get<{ data: AdminLeagueMemberRow[] }>(`/admin/fantasy/leagues/${leagueId}/members`);
        return res.data.data || [];
    },
    setPrizeStructure: async (
        leagueId: string,
        tiers: { rank: number; percent: number }[]
    ): Promise<LeagueFinance> => {
        const res = await api.put<{ data: LeagueFinance }>(`/admin/fantasy/leagues/${leagueId}/prizes`, { tiers });
        return res.data.data;
    },
    // Throws 409 if the league was already settled.
    settleLeague: async (leagueId: string): Promise<SettlementResult> => {
        const res = await api.post<{ data: SettlementResult }>(`/admin/fantasy/leagues/${leagueId}/settle`);
        return res.data.data;
    },
    settleSeason: async (seasonId: string): Promise<SettlementResult> => {
        const res = await api.post<{ data: SettlementResult }>(`/admin/fantasy/seasons/${seasonId}/settle`);
        return res.data.data;
    },
    // Settles every outstanding paid league, then closes the season.
    completeSeason: async (seasonId: string): Promise<SettlementResult> => {
        const res = await api.post<{ data: SettlementResult }>(`/admin/fantasy/seasons/${seasonId}/complete`);
        return res.data.data;
    },
    listPayouts: async (params?: {
        status?: PayoutStatus | '';
        page?: number;
        limit?: number;
    }): Promise<Paged<PayoutRequest>> => {
        const res = await api.get<Paged<PayoutRequest>>('/admin/fantasy/payouts', { params });
        return res.data;
    },
    // payment_reference is required when moving a payout to PAID.
    updatePayoutStatus: async (
        payoutId: string,
        payload: { status: 'PROCESSING' | 'PAID' | 'REJECTED'; admin_notes?: string; payment_reference?: string }
    ): Promise<PayoutRequest> => {
        const res = await api.put<{ data: PayoutRequest }>(`/admin/fantasy/payouts/${payoutId}/status`, payload);
        return res.data.data;
    },
    getUserWallet: async (userId: string): Promise<FantasyWallet> => {
        const res = await api.get<{ data: FantasyWallet }>(`/admin/fantasy/users/${userId}/wallet`);
        return res.data.data;
    },
};

export default api;



