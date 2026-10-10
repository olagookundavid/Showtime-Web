import axios from "axios";
import { API_URL, COMMENTS_PAGE_SIZE } from "../constants";
import type {
  AuthUser,
  ResetPasswordPayload,
  PaginatedResponse,
  GenericApiResponse,
  Paged,
  News,
  CreateNewsPayload,
  RelivePlaylist,
  LiveStatus,
  AdminLiveStatus,
  Gallery,
  CreateGalleryPayload,
  HeroSlide,
  CreateHeroSlidePayload,
  UpdateHeroSlidePayload,
  SeasonGraphic,
  SeasonMVP,
  UpsertSeasonGraphicPayload,
  CreateSeasonMVPPayload,
  UpdateSeasonMVPPayload,
  Player,
  RosterSummary,
  CreatePlayerPayload,
  Badge,
  PlayerBadgeAward,
  PlayerBadge,
  CreateBadgePayload,
  UpdateBadgePayload,
  AwardBadgePayload,
  GamePlay,
  PlayPayload,
  SituationUpdate,
  BulkRecomputeResult,
  TicketTierResponse,
  EventDayResponse,
  TicketResponse,
  PurchaseTicketPayload,
  GiftTicketPayload,
  TeamTicketAllocation,
  CreateReferralPayload,
  ReferralResponse,
  ReferralStatsResponse,
  AdminAnalyticsResponse,
  PlayerStat,
  TeamStat,
  UpsertPlayerStatPayload,
  StatsCompare,
  InventoryProduct,
  InventorySale,
  SalesReportResponse,
  PaymentMethod,
  ProductImage,
  ProductOption,
  StoreProduct,
  ProductReview,
  CreateProductReviewPayload,
  ReviewSort,
  CheckoutItemPayload,
  CheckoutPayload,
  CheckoutResponseData,
  Order,
  SavedAddress,
  AdminVariantPayload,
  DiscountCode,
  SaveDiscountCodePayload,
  DiscountTarget,
  DiscountPreview,
  ContractData,
  IssueContractPayload,
  TransferData,
  TransferBidData,
  TeamBudgetData,
  TransferWindowData,
  NotificationData,
  VerifyClaimCodeData,
  SubmitClaimPayload,
  SubmitClaimData,
  MyClaimStatusData,
  ClaimKind,
  PlayerClaimData,
  ClaimCodeData,
  AppSettingsData,
  CommentData,
  CommentPage,
  TeamOfTheWeek,
  TOTWListItem,
  SaveTOTWPayload,
  POTWPoll,
  POTWPollSummary,
  SavePOTWPollPayload,
  TeamManager,
  ManagerCandidate,
  FantasySlot,
  FantasySeason,
  FantasyGameweek,
  FantasyPlayerListItem,
  MarketSort,
  FantasyLineupResponse,
  FantasyTeamLineupDetailResponse,
  ScheduledMatchDay,
  GameweekReportResponse,
  PlayerGWBreakdownResponse,
  PlayerPriceHistoryResponse,
  FantasyWallet,
  PayoutStatus,
  PayoutRequest,
  LeagueFinance,
  MoneyOwed,
  FantasyLeague,
  JoinLeagueResponse,
  Leaderboard,
  LeaderboardEntry,
  LeagueJoinPreview,
  DashboardTeam,
  FantasyDashboard,
  Squad,
  SquadReadiness,
  AdminFantasyOverview,
  AdminManagerRow,
  AdminLeagueRow,
  AdminLeagueMemberRow,
  SettlementResult,
  AdminPlayerPriceRow,
  Competition,
  CupState,
  Team,
  Match,
  MatchTeamSheet,
  MatchDetail,
  Standing,
  CreateMatchPayload,
  SaveTeamSheetPayload,
  ImportMatchPlayerRow,
  ImportMatchResult,
  CreateStandingPayload,
  BracketEntryPayload,
  GameRules,
  GameRulesPayload,
  SeasonAdmissionTierResponse,
  CreateSeasonAdmissionTierPayload,
  UpdateSeasonAdmissionTierPayload,
  GamePassDiscountBandResponse,
  CreateGamePassDiscountBandPayload,
  UpdateGamePassDiscountBandPayload,
  GamePassCheckoutPayload,
  GamePassOrderResponse,
} from "../types";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // Remove withCredentials since we are using Bearer tokens now
});

// Interceptor to attach the token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("showtime_access_token");
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
    const url: string = error?.config?.url || "";
    const hadToken =
      typeof localStorage !== "undefined" &&
      !!localStorage.getItem("showtime_access_token");
    // The claim endpoints answer 401 for a bad/expired/exhausted team code, which
    // says nothing about the caller's session. A claimant is signed in as
    // player_pending while they finish their claim, so treating that 401 as an
    // expired session would sign them out mid-flow.
    const isAuthEndpoint =
      /\/auth\/(login|register|forgot-password|reset-password|profile)|\/claim\//.test(
        url,
      );
    if (status === 401 && hadToken && !isAuthEndpoint) {
      localStorage.removeItem("showtime_access_token");
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);

// ─── Auth Types ───────────────────────────────────────────────────────────────
interface AuthApiResponse {
  message: string;
  data: AuthUser;
}

// Auth API functions
export const loginUser = async (
  email: string,
  password: string,
): Promise<AuthUser> => {
  const response = await api.post<AuthApiResponse>("/auth/login", {
    email,
    password,
  });
  return response.data.data;
};

export const registerUser = async (
  fullname: string,
  email: string,
  password: string,
): Promise<void> => {
  await api.post("/auth/register", { fullname, email, password: password });
};

export const logoutUser = async (): Promise<void> => {
  await api.post("/auth/logout");
};

export const getUserProfile = async (): Promise<AuthUser> => {
  const response = await api.get<AuthApiResponse>("/auth/profile");
  return response.data.data;
};

/** Emails the logged-in user a 6-digit code to verify their address. */
export const sendEmailVerificationCode = async (): Promise<void> => {
  await api.post("/auth/verify-email/send");
};

/** Confirms the emailed code; the account is then verified. */
export const confirmEmailVerification = async (code: string): Promise<void> => {
  await api.post("/auth/verify-email/confirm", { code });
};

export const updateOwnProfile = async (
  fullName: string,
  phone: string,
): Promise<void> => {
  await api.put("/auth/profile", { fullname: fullName, phone });
};

export const forgotPassword = async (email: string): Promise<void> => {
  await api.post("/auth/forgot-password", { email });
};

export const resetPassword = async (
  payload: ResetPasswordPayload,
): Promise<void> => {
  await api.post("/auth/reset-password", payload);
};

// ─── News ─────────────────────────────────────────────────────────────────────
export const getNews = async (
  page = 1,
  limit = 10,
  search?: string,
  category?: string,
  author?: string,
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
    const response = await api.get<News>(
      `/news/slug/${encodeURIComponent(slug)}`,
    );
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
export const getRelivePlaylist = async (
  playlistId?: string,
): Promise<RelivePlaylist> => {
  const url = playlistId
    ? `/relive?playlist_id=${encodeURIComponent(playlistId)}`
    : "/relive";
  const response = await api.get<{ data: RelivePlaylist }>(url);
  return response.data.data;
};

// ─── Live stream ──────────────────────────────────────────────────────────────
export const getLiveStatus = async (): Promise<LiveStatus> => {
  const response = await api.get<LiveStatus>("/live");
  return response.data;
};

export const liveApi = {
  getAdminStatus: async (): Promise<AdminLiveStatus> => {
    const res = await api.get<AdminLiveStatus>("/admin/live");
    return res.data;
  },
  setOverride: async (payload: {
    mode: "auto" | "on" | "off" | "video";
    video_id?: string;
    title?: string;
  }): Promise<AdminLiveStatus> => {
    const res = await api.put<AdminLiveStatus>("/admin/live", payload);
    return res.data;
  },
};

// ─── Gallery ──────────────────────────────────────────────────────────────────
export const getGallery = async (
  page = 1,
  limit = 10,
  competitionId?: string,
) => {
  let url = `/gallery?page=${page}&limit=${limit}`;
  if (competitionId) {
    url += `&competition_id=${encodeURIComponent(competitionId)}`;
  }
  const response = await api.get<PaginatedResponse<Gallery>>(url);
  return response.data;
};

// ─── Hero Slides ──────────────────────────────────────────────────────────────
// Legacy: slides created before `destination_url` existed link to a hidden
// news article (authored inline, from this admin — not the News admin)
// instead. It's "hidden" in the sense that it's excluded from /news and the
// News admin list; see backend news.is_hero_only. Kept read-only so those
// old slides keep rendering/linking correctly.
// Public: only active slides — what MainHeroCarousel renders.
export const getHeroSlides = async (): Promise<HeroSlide[]> => {
  const response = await api.get<{ data: HeroSlide[] }>("/hero-slides");
  return response.data.data || [];
};

// Admin: list ALL (active + inactive).
export const getAdminHeroSlides = async (): Promise<HeroSlide[]> => {
  const response = await api.get<{ data: HeroSlide[] }>("/admin/hero-slides");
  return response.data.data || [];
};

export const createHeroSlide = async (
  payload: CreateHeroSlidePayload,
): Promise<HeroSlide> => {
  const response = await api.post<HeroSlide>("/admin/hero-slides", payload);
  return response.data;
};

export const updateHeroSlide = async (
  id: string,
  payload: UpdateHeroSlidePayload,
) => {
  const response = await api.put(`/admin/hero-slides/${id}`, payload);
  return response.data;
};

export const deleteHeroSlide = async (id: string) => {
  const response = await api.delete(`/admin/hero-slides/${id}`);
  return response.data;
};

// ─── Team of the Season + MVPs ─────────────────────────────────────────────────
// Public
export const getSeasonGraphics = async (): Promise<SeasonGraphic[]> => {
  const res = await api.get<{ data: SeasonGraphic[] }>("/season/graphics", {
    params: { limit: 200 },
  });
  return res.data.data || [];
};

export const getSeasonMVPs = async (): Promise<SeasonMVP[]> => {
  const res = await api.get<{ data: SeasonMVP[] }>("/season/mvps", {
    params: { limit: 200 },
  });
  return res.data.data || [];
};

// Admin
export const getAdminSeasonGraphics = async (): Promise<SeasonGraphic[]> => {
  const res = await api.get<{ data: SeasonGraphic[] }>(
    "/admin/season/graphics",
    { params: { limit: 200 } },
  );
  return res.data.data || [];
};

export const upsertSeasonGraphic = async (
  payload: UpsertSeasonGraphicPayload,
): Promise<SeasonGraphic> => {
  const res = await api.put<SeasonGraphic>("/admin/season/graphics", payload);
  return res.data;
};

export const getAdminSeasonMVPs = async (): Promise<SeasonMVP[]> => {
  const res = await api.get<{ data: SeasonMVP[] }>("/admin/season/mvps", {
    params: { limit: 200 },
  });
  return res.data.data || [];
};

export const createSeasonMVP = async (
  payload: CreateSeasonMVPPayload,
): Promise<SeasonMVP> => {
  const res = await api.post<SeasonMVP>("/admin/season/mvps", payload);
  return res.data;
};

export const updateSeasonMVP = async (
  id: string,
  payload: UpdateSeasonMVPPayload,
) => {
  const res = await api.put(`/admin/season/mvps/${id}`, payload);
  return res.data;
};

export const deleteSeasonMVP = async (id: string) => {
  const res = await api.delete(`/admin/season/mvps/${id}`);
  return res.data;
};

// ─── Match Hub Types ──────────────────────────────────────────────────────────
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
// Preseason → Season → Playoffs → Cup. The `format` field is authoritative
// now that it carries all four stages; the name-substring check only covers
// rows that somehow have no format.
const stageOrder = (c: { name: string; format?: string }): number => {
  switch (c.format) {
    case "PRESEASON":
      return 0;
    case "SEASON":
      return 1;
    case "PLAYOFFS":
      return 2;
    case "CUP":
      return 3;
  }
  const n = c.name.toLowerCase();
  if (n.includes("regular")) return 1;
  if (n.includes("playoff")) return 2;
  if (n.includes("bowl")) return 3;
  return 4;
};
export const sortCompetitionsBySeason = <
  C extends { name: string; format?: string },
>(
  comps: C[],
): C[] => {
  return [...comps].sort((a, b) => {
    const seasonDiff =
      seasonNumberFromName(b.name) - seasonNumberFromName(a.name);
    if (seasonDiff !== 0) return seasonDiff;
    return stageOrder(a) - stageOrder(b);
  });
};

// The competition-picker dropdown on public pages lists only competitions of
// the same format as whatever's currently selected (default: SEASON) — e.g.
// viewing a Cup shows other Cups across seasons, viewing a Season shows other
// Seasons. Always keeps the current selection in the list even if it'd
// otherwise be filtered out.
export const dropdownCompetitionsFor = (
  competitions: Competition[],
  selected?: Competition,
): Competition[] => {
  const targetFormat = selected?.format || "SEASON";
  const list = competitions.filter(
    (c) => (c.format || "SEASON") === targetFormat,
  );
  if (selected && !list.some((c) => c.id === selected.id)) list.push(selected);
  return list;
};

// ─── Match Hub Service ────────────────────────────────────────────────────────
export const getCompetitions = async (
  page: number = 1,
  limit: number = 100,
  status?: string,
): Promise<PaginatedResponse<Competition>> => {
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
  teamId?: string,
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

export const getStandings = async (
  competitionId: string,
): Promise<Standing[]> => {
  const response = await api.get<{ data: Standing[] }>(
    `/matches/standings?competition_id=${competitionId}&limit=200`,
  );
  return response.data.data;
};

export const getMatchDetail = async (id: string): Promise<MatchDetail> => {
  const response = await api.get<{ data: MatchDetail }>(`/matches/${id}`);
  return response.data.data;
};

// ─── Teams ────────────────────────────────────────────────────────────────────
export const getTeams = async (
  page: number = 1,
  limit: number = 20,
): Promise<PaginatedResponse<Team>> => {
  const response = await api.get<PaginatedResponse<Team>>(
    `/matches/teams?page=${page}&limit=${limit}`,
  );
  return response.data;
};

// ─── Players ──────────────────────────────────────────────────────────────────
export const getTeamRosterSummary = async (
  teamId?: string,
): Promise<RosterSummary> => {
  const url = teamId
    ? `/team-head/roster-summary?team_id=${teamId}`
    : `/team-head/roster-summary`;
  const response = await api.get<RosterSummary>(url);
  return response.data;
};

export const moveToReserve = async (
  playerId: string,
  teamId?: string,
): Promise<{ message: string }> => {
  const url = teamId
    ? `/admin/teams/${teamId}/players/${playerId}/move-to-reserve`
    : `/team-head/players/${playerId}/move-to-reserve`;
  const response = await api.post<{ message: string }>(url);
  return response.data;
};

export const graduatePlayer = async (
  playerId: string,
  teamId?: string,
): Promise<{ message: string }> => {
  const url = teamId
    ? `/admin/teams/${teamId}/players/${playerId}/graduate`
    : `/team-head/players/${playerId}/graduate`;
  const response = await api.post<{ message: string }>(url);
  return response.data;
};

export const getPlayers = async (
  teamId?: string,
  page: number = 1,
  limit: number = 20,
  search?: string,
  rosterStatus?: "main" | "reserve" | "all",
): Promise<PaginatedResponse<Player>> => {
  let url = `/players?page=${page}&limit=${limit}`;
  if (teamId) {
    url += `&team_id=${teamId}`;
  }
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  if (rosterStatus) {
    url += `&roster_status=${rosterStatus}`;
  }
  const response = await api.get<PaginatedResponse<Player>>(url);
  return response.data;
};

export const getPlayerById = async (id: string): Promise<Player> => {
  const response = await api.get<{ data: Player }>(`/players/${id}`);
  return response.data.data;
};

// ─── Admin Mutation Types ─────────────────────────────────────────────────────

// ─── News Mutations ───────────────────────────────────────────────────────────
export const createNews = async (payload: CreateNewsPayload) => {
  const response = await api.post("/admin/news", payload);
  return response.data;
};

export const updateNews = async (
  id: string,
  payload: Partial<CreateNewsPayload>,
) => {
  const response = await api.put(`/admin/news/${id}`, payload);
  return response.data;
};

export const deleteNews = async (id: string) => {
  const response = await api.delete(`/admin/news/${id}`);
  return response.data;
};

// ─── Gallery Mutations ────────────────────────────────────────────────────────
export const createGallery = async (payload: CreateGalleryPayload) => {
  const response = await api.post("/admin/gallery", payload);
  return response.data;
};

export const updateGallery = async (
  id: string,
  payload: Partial<CreateGalleryPayload>,
) => {
  const response = await api.put(`/admin/gallery/${id}`, payload);
  return response.data;
};

export const deleteGallery = async (id: string) => {
  const response = await api.delete(`/admin/gallery/${id}`);
  return response.data;
};

// ─── Match Mutations ──────────────────────────────────────────────────────────
export const createMatch = async (payload: CreateMatchPayload) => {
  const response = await api.post("/admin/matches", payload);
  return response.data;
};

export const updateMatch = async (
  id: string,
  payload: Partial<CreateMatchPayload>,
) => {
  const response = await api.put(`/admin/matches/${id}`, payload);
  return response.data;
};

export const deleteMatch = async (id: string) => {
  const response = await api.delete(`/admin/matches/${id}`);
  return response.data;
};

// ─── Team Sheet Mutations ─────────────────────────────────────────────────────
export const saveTeamSheet = async (
  matchId: string,
  payload: SaveTeamSheetPayload,
) => {
  const response = await api.post(
    `/admin/matches/${matchId}/team-sheets`,
    payload,
  );
  return response.data;
};

export const getAdminTeamSheet = async (
  matchId: string,
): Promise<MatchTeamSheet> => {
  const response = await api.get<{ data: MatchTeamSheet }>(
    `/admin/matches/${matchId}/team-sheets`,
  );
  return response.data.data;
};

export const getTeamHeadTeamSheet = async (
  matchId: string,
): Promise<MatchTeamSheet> => {
  const response = await api.get<{ data: MatchTeamSheet }>(
    `/team-head/matches/${matchId}/team-sheet`,
  );
  return response.data.data;
};

export const saveTeamHeadTeamSheet = async (
  matchId: string,
  payload: SaveTeamSheetPayload,
) => {
  const response = await api.post(
    `/team-head/matches/${matchId}/team-sheet`,
    payload,
  );
  return response.data;
};

// ─── Bulk historical-data CSV import ──────────────────────────────────────────
export const importMatchCsv = async (
  matchId: string,
  rows: ImportMatchPlayerRow[],
): Promise<ImportMatchResult> => {
  const res = await api.post<{ message: string; data: ImportMatchResult }>(
    `/admin/matches/${matchId}/import`,
    { rows },
  );
  return res.data.data;
};

// ─── Player Mutations ─────────────────────────────────────────────────────────
export const createPlayer = async (payload: CreatePlayerPayload) => {
  const response = await api.post("/admin/players", payload);
  return response.data;
};

export const updatePlayer = async (
  id: string,
  payload: Partial<CreatePlayerPayload>,
) => {
  const response = await api.put(`/admin/players/${id}`, payload);
  return response.data;
};

export const deletePlayer = async (id: string) => {
  const response = await api.delete(`/admin/players/${id}`);
  return response.data;
};

// Reverses deletePlayer. Deleting sets status to inactive rather than removing
// the row, so nothing has to be recreated.
export const restorePlayer = async (id: string) => {
  const response = await api.post(`/admin/players/${id}/restore`);
  return response.data;
};

// ─── Standing Mutations ───────────────────────────────────────────────────────
export const createStanding = async (payload: CreateStandingPayload) => {
  const response = await api.post("/admin/matches/standings", payload);
  return response.data;
};

export const updateStanding = async (
  id: string,
  payload: Partial<CreateStandingPayload>,
) => {
  const response = await api.put(`/admin/matches/standings/${id}`, payload);
  return response.data;
};

export const deleteStanding = async (id: string) => {
  const response = await api.delete(`/admin/matches/standings/${id}`);
  return response.data;
};

// ─── Event Days & Tickets ─────────────────────────────────────────────────────
// Event Day endpoints
export const getEventDays = async (
  code?: string,
): Promise<EventDayResponse[]> => {
  const url = code
    ? `/event-days?code=${encodeURIComponent(code)}`
    : "/event-days";
  const response = await api.get<{ data: EventDayResponse[] }>(url);
  return response.data.data || [];
};

export const getEventDayByDate = async (
  date: string,
  code?: string,
): Promise<EventDayResponse> => {
  const url = code
    ? `/event-days/by-date/${date}?code=${encodeURIComponent(code)}`
    : `/event-days/by-date/${date}`;
  const response = await api.get<EventDayResponse>(url);
  return response.data;
};

export const getEventDayById = async (
  id: string,
): Promise<EventDayResponse> => {
  const response = await api.get<EventDayResponse>(`/event-days/${id}`);
  return response.data;
};

// Ticket endpoints
export const purchaseTicket = async (
  payload: PurchaseTicketPayload,
): Promise<TicketResponse> => {
  const response = await api.post<TicketResponse>("/tickets/purchase", payload);
  return response.data;
};

// App Admin: issue a complimentary ticket (no payment, sends confirmation email)
export const giftTicket = async (
  payload: GiftTicketPayload,
): Promise<TicketResponse> => {
  const response = await api.post<TicketResponse>(
    "/admin/administrator/gift-ticket",
    payload,
  );
  return response.data;
};

export const getTicketByReference = async (
  reference: string,
): Promise<TicketResponse> => {
  const response = await api.get<TicketResponse>(`/tickets/${reference}`);
  return response.data;
};

export const adminListTickets = async (
  page = 1,
  limit = 10,
  eventDayId?: string,
  status?: string,
) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (eventDayId) params.append("event_day_id", eventDayId);
  if (status) params.append("status", status);
  const response = await api.get<PaginatedResponse<TicketResponse>>(
    `/admin/tickets?${params}`,
  );
  return response.data;
};

export const checkinTicket = async (id: string, checkedInBy: string) => {
  const response = await api.post(`/admin/tickets/${id}/checkin`, {
    checked_in_by: checkedInBy,
  });
  return response.data;
};

export const verifyTicket = async (
  reference: string,
): Promise<TicketResponse> => {
  const response = await api.post<TicketResponse>(
    `/tickets/verify/${reference}`,
  );
  return response.data;
};

export const adminCheckinTicket = async (id: string, checkedInBy: string) => {
  const response = await api.post(`/admin/tickets/${id}/admin-checkin`, {
    checked_in_by: checkedInBy,
  });
  return response.data;
};

export const lookupTicketByCode = async (
  code: string,
): Promise<TicketResponse> => {
  const response = await api.get<TicketResponse>(
    `/admin/tickets/lookup/${code}`,
  );
  return response.data;
};

export const searchTicketsByEmail = async (
  email: string,
): Promise<TicketResponse[]> => {
  const response = await api.get<{ data: TicketResponse[] }>(
    `/admin/tickets/search?email=${encodeURIComponent(email)}&limit=200`,
  );
  return response.data.data || [];
};

// Admin Event Day endpoints
export const getAllEventDays = async (): Promise<EventDayResponse[]> => {
  const response = await api.get<{ data: EventDayResponse[] }>(
    "/admin/event-days/all",
    {
      params: { limit: 200 },
    },
  );
  return response.data.data || [];
};

/** Paged and server-searched, for the admin screen that manages event days.
 *  `getAllEventDays` stays for the pickers that want the recent ones. */
export const listEventDays = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<Paged<EventDayResponse>> => {
  const response = await api.get<Paged<EventDayResponse>>(
    "/admin/event-days/all",
    {
      params: { ...params, search: params?.search || undefined },
    },
  );
  return { ...response.data, data: response.data.data ?? [] };
};

export const createEventDay = async (payload: {
  title: string;
  date: string;
  venue?: string;
  is_active?: boolean;
}): Promise<EventDayResponse> => {
  const response = await api.post<EventDayResponse>(
    "/admin/event-days",
    payload,
  );
  return response.data;
};

export const updateEventDay = async (
  id: string,
  payload: {
    title?: string;
    date?: string;
    venue?: string;
    is_active?: boolean;
  },
) => {
  const response = await api.put(`/admin/event-days/${id}`, payload);
  return response.data;
};

export const deleteEventDay = async (id: string) => {
  const response = await api.delete(`/admin/event-days/${id}`);
  return response.data;
};

export const createTier = async (
  eventDayId: string,
  payload: {
    name: string;
    price: number;
    capacity?: number;
    description?: string;
    is_hidden?: boolean;
    access_code?: string;
  },
): Promise<TicketTierResponse> => {
  const response = await api.post<TicketTierResponse>(
    `/admin/event-days/${eventDayId}/tiers`,
    payload,
  );
  return response.data;
};

export const updateTicketTier = async (
  eventDayId: string,
  tierId: string,
  payload: {
    name?: string;
    price?: number;
    capacity?: number;
    description?: string;
    is_hidden?: boolean;
    access_code?: string;
  },
): Promise<TicketTierResponse> => {
  const response = await api.put<TicketTierResponse>(
    `/admin/event-days/${eventDayId}/tiers/${tierId}`,
    payload,
  );
  return response.data;
};

export const deleteTicketTier = async (eventDayId: string, tierId: string) => {
  const response = await api.delete(
    `/admin/event-days/${eventDayId}/tiers/${tierId}`,
  );
  return response.data;
};

// -------- ADMIN SEASON ADMISSION TIERS API -------- //
export const listSeasonAdmissionTiers = async (): Promise<
  SeasonAdmissionTierResponse[]
> => {
  const response = await api.get<{ data: SeasonAdmissionTierResponse[] }>(
    "/admin/season-admission-tiers",
  );
  return response.data.data || [];
};

export const createSeasonAdmissionTier = async (
  payload: CreateSeasonAdmissionTierPayload,
): Promise<SeasonAdmissionTierResponse> => {
  const response = await api.post<SeasonAdmissionTierResponse>(
    "/admin/season-admission-tiers",
    payload,
  );
  return response.data;
};

export const updateSeasonAdmissionTier = async (
  id: string,
  payload: UpdateSeasonAdmissionTierPayload,
): Promise<SeasonAdmissionTierResponse> => {
  const response = await api.put<SeasonAdmissionTierResponse>(
    `/admin/season-admission-tiers/${id}`,
    payload,
  );
  return response.data;
};

export const deleteSeasonAdmissionTier = async (id: string) => {
  const response = await api.delete(`/admin/season-admission-tiers/${id}`);
  return response.data;
};

// -------- ADMIN GAME PASS DISCOUNT BANDS API -------- //
export const listGamePassDiscountBands = async (): Promise<
  GamePassDiscountBandResponse[]
> => {
  const response = await api.get<{ data: GamePassDiscountBandResponse[] }>(
    "/admin/game-pass/discount-bands",
  );
  return response.data.data || [];
};

export const createGamePassDiscountBand = async (
  payload: CreateGamePassDiscountBandPayload,
): Promise<GamePassDiscountBandResponse> => {
  const response = await api.post<GamePassDiscountBandResponse>(
    "/admin/game-pass/discount-bands",
    payload,
  );
  return response.data;
};

export const updateGamePassDiscountBand = async (
  id: string,
  payload: UpdateGamePassDiscountBandPayload,
): Promise<GamePassDiscountBandResponse> => {
  const response = await api.put<GamePassDiscountBandResponse>(
    `/admin/game-pass/discount-bands/${id}`,
    payload,
  );
  return response.data;
};

export const deleteGamePassDiscountBand = async (id: string) => {
  const response = await api.delete(`/admin/game-pass/discount-bands/${id}`);
  return response.data;
};

// -------- PUBLIC GAME PASS PRICING API -------- //
export const getActiveSeasonAdmissionTiers = async (): Promise<
  SeasonAdmissionTierResponse[]
> => {
  const response = await api.get<{ data: SeasonAdmissionTierResponse[] }>(
    "/season-admission-tiers",
  );
  return response.data.data || [];
};

export const getActiveGamePassDiscountBands = async (): Promise<
  GamePassDiscountBandResponse[]
> => {
  const response = await api.get<{ data: GamePassDiscountBandResponse[] }>(
    "/game-pass/discount-bands",
  );
  return response.data.data || [];
};

// -------- GAME PASS CHECKOUT API -------- //
export const checkoutGamePass = async (
  payload: GamePassCheckoutPayload,
): Promise<GamePassOrderResponse> => {
  // Unwrapped on the wire (bare 201 body) — same shape as purchaseTicket.
  const response = await api.post<GamePassOrderResponse>(
    "/game-pass/checkout",
    payload,
  );
  return response.data;
};

export const verifyGamePassPayment = async (
  reference: string,
): Promise<GamePassOrderResponse> => {
  const response = await api.post<{ data: GamePassOrderResponse }>(
    `/game-pass/verify/${reference}`,
  );
  return response.data.data;
};

export const getGamePassOrderByReference = async (
  reference: string,
): Promise<GamePassOrderResponse> => {
  const response = await api.get<{ data: GamePassOrderResponse }>(
    `/game-pass/orders/by-ref/${reference}`,
  );
  return response.data.data;
};

// -------- ADMIN GAME PASS ORDERS API -------- //
export const adminListGamePassOrders = async (
  page = 1,
  limit = 10,
  status?: string,
  email?: string,
): Promise<PaginatedResponse<GamePassOrderResponse>> => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status) params.append("status", status);
  if (email) params.append("email", email);
  const response = await api.get<PaginatedResponse<GamePassOrderResponse>>(
    `/admin/game-pass/orders?${params}`,
  );
  return response.data;
};

export const adminGetGamePassOrder = async (
  id: string,
): Promise<GamePassOrderResponse> => {
  const response = await api.get<{ data: GamePassOrderResponse }>(
    `/admin/game-pass/orders/${id}`,
  );
  return response.data.data;
};

// -------- ADMIN USER MANAGEMENT API -------- //
export const getAdminUsers = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}) => {
  const response = await api.get("/admin/users", { params });
  return response.data;
};

export const updateUserRole = async (userId: string, role: string) => {
  const response = await api.put(`/admin/users/${userId}/role`, { role });
  return response.data;
};

export const updateUserInfo = async (
  userId: string,
  payload: { fullname: string; phone: string },
) => {
  const response = await api.put(`/admin/users/${userId}`, payload);
  return response.data;
};

// -------- ADMIN TEAM MANAGEMENT API -------- //
// Every team, inactive ones included (the public list hides them).
export const getAdminTeams = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<PaginatedResponse<Team>> => {
  const response = await api.get<PaginatedResponse<Team>>("/admin/teams", {
    params,
  });
  return response.data;
};

export const getTeamsByCompetition = async (
  competitionId: string,
  status?: string,
) => {
  const response = await api.get("/admin/teams/by-competition", {
    params: { competition_id: competitionId, status },
  });
  if (response.data && response.data.data !== undefined) {
    return {
      data: Array.isArray(response.data.data) ? response.data.data : [],
    };
  }
  return { data: Array.isArray(response.data) ? response.data : [] };
};

export const addTeamToCompetition = async (
  competitionId: string,
  teamId: string,
) => {
  const response = await api.post(
    `/admin/competitions/${competitionId}/teams`,
    { team_id: teamId },
  );
  return response.data;
};

export const removeTeamFromCompetition = async (
  competitionId: string,
  teamId: string,
) => {
  const response = await api.delete(
    `/admin/competitions/${competitionId}/teams/${teamId}`,
  );
  return response.data;
};

export const assignRandomJerseyNumbers = async (teamId?: string) => {
  const response = await api.post(
    "/admin/players/assign-jersey-numbers",
    null,
    {
      params: teamId ? { team_id: teamId } : undefined,
    },
  );
  return response.data as { message: string; assigned_count: number };
};

export const createTeam = async (payload: {
  name: string;
  short_name: string;
  logo: string;
  status?: string;
}) => {
  const response = await api.post("/admin/teams", payload);
  return response.data;
};

export const updateTeam = async (
  id: string,
  payload: { name: string; short_name: string; logo: string; status?: string },
) => {
  const response = await api.put(`/admin/teams/${id}`, payload);
  return response.data;
};

export const deleteTeam = async (id: string) => {
  const response = await api.delete(`/admin/teams/${id}`);
  return response.data;
};

export const getTeamManagers = async (
  teamId: string,
): Promise<TeamManager[]> => {
  const response = await api.get<{ data: TeamManager[] | null }>(
    `/admin/teams/${teamId}/managers`,
  );
  return response.data.data || [];
};

// Every team_head user, with whichever team they currently manage (if any) —
// powers the "Assign Team Head" dropdown so it can show ALL team_head users
// (not just unassigned ones) and explain why a name is greyed out.
export const getManagerCandidates = async (): Promise<ManagerCandidate[]> => {
  const response = await api.get<{ data: ManagerCandidate[] }>(
    "/admin/teams/manager-candidates",
  );
  return response.data.data || [];
};

export const assignTeamManager = async (teamId: string, userId: string) => {
  const response = await api.post(`/admin/teams/${teamId}/manager`, {
    user_id: userId,
  });
  return response.data;
};

export const removeTeamManager = async (teamId: string, userId: string) => {
  const response = await api.delete(`/admin/teams/${teamId}/manager/${userId}`);
  return response.data;
};

// -------- ADMIN COMPETITION MANAGEMENT API -------- //
export const getAdminCompetitions = async (
  page: number = 1,
  limit: number = 100,
  search?: string,
): Promise<PaginatedResponse<Competition>> => {
  let url = `/admin/competitions?page=${page}&limit=${limit}`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  const response = await api.get<PaginatedResponse<Competition>>(url);
  return response.data;
};

export const createCompetition = async (payload: {
  name: string;
  logo: string;
  status?: string;
  format?: string;
  season_id?: string | null;
  tie_breaker_rule?: string;
}) => {
  const response = await api.post("/admin/competitions", payload);
  return response.data;
};

export const updateCompetition = async (
  id: string,
  payload: {
    name: string;
    logo: string;
    status?: string;
    format?: string;
    season_id?: string | null;
    tie_breaker_rule?: string;
  },
) => {
  const response = await api.put(`/admin/competitions/${id}`, payload);
  return response.data;
};

export const deleteCompetition = async (id: string) => {
  const response = await api.delete(`/admin/competitions/${id}`);
  return response.data;
};

// One first-round slot of a knockout bracket: a matchup or a bye.
// Adjacent slots pair up: winners of slots 1 & 2 meet next round, 3 & 4 meet, etc.
export const generateBracket = async (
  competitionId: string,
  payload: {
    entries: BracketEntryPayload[];
    date: string;
    time?: string;
    venue?: string;
  },
) => {
  const response = await api.post(
    `/admin/competitions/${competitionId}/bracket`,
    payload,
  );
  return response.data;
};

export const resetBracket = async (competitionId: string) => {
  const response = await api.delete(
    `/admin/competitions/${competitionId}/bracket`,
  );
  return response.data;
};

// ─── Cup Tournament ───────────────────────────────────────────────────────────

export const getCupState = async (competitionId: string): Promise<CupState> => {
  const response = await api.get<CupState>(
    `/admin/competitions/${competitionId}/cup/state`,
  );
  return response.data;
};

export const initializeCup = async (
  competitionId: string,
  schedule?: { date: string; time?: string; venue?: string },
) => {
  const response = await api.post(
    `/admin/competitions/${competitionId}/cup/initialize`,
    schedule,
  );
  return response.data;
};

export const advanceCupRound = async (
  competitionId: string,
  schedule?: { date: string; time?: string; venue?: string },
) => {
  const response = await api.post(
    `/admin/competitions/${competitionId}/cup/advance`,
    schedule,
  );
  return response.data;
};

export const getAdminAnalytics = async (): Promise<
  GenericApiResponse<AdminAnalyticsResponse>
> => {
  const response =
    await api.get<GenericApiResponse<AdminAnalyticsResponse>>(
      "/admin/analytics",
    );
  return response.data;
};

// ─── Team Allocations ─────────────────────────────────────────────────────────

export const adminGetAllocations = async (
  eventDayId: string,
): Promise<TeamTicketAllocation[]> => {
  const response = await api.get<{ data: TeamTicketAllocation[] }>(
    `/admin/allocations/event-day/${eventDayId}`,
  );
  return response.data.data || [];
};

export const adminCreateOrUpdateAllocation = async (payload: {
  event_day_id: string;
  team_id: string;
  allocated_count: number;
}) => {
  const response = await api.post("/admin/allocations", payload);
  return response.data;
};

export const adminDeleteAllocation = async (id: string) => {
  const response = await api.delete(`/admin/allocations/${id}`);
  return response.data;
};

export const getTeamAllocations = async (): Promise<TeamTicketAllocation[]> => {
  const response = await api.get<{ data: TeamTicketAllocation[] }>(
    "/team-head/allocations",
  );
  return response.data.data || [];
};

export const issueTeamTicket = async (payload: {
  event_day_id: string;
  name: string;
  email: string;
}): Promise<TicketResponse> => {
  const response = await api.post<TicketResponse>(
    "/team-head/allocations/issue",
    payload,
  );
  return response.data;
};

// ─── Stats ───────────────────────────────────────────────────────────────────
export const getPlayerStats = async (
  compId?: string,
  eventDay?: string,
  page = 1,
  limit = 20,
  playerId?: string,
  search?: string,
  sort?: string,
  teamId?: string,
  position?: string,
): Promise<PaginatedResponse<PlayerStat>> => {
  let url = "/stats/players";
  const params = new URLSearchParams();
  if (compId) params.append("competition_id", compId);
  if (eventDay) params.append("event_day", eventDay);
  if (playerId) params.append("player_id", playerId);
  if (teamId) params.append("team_id", teamId);
  if (search) params.append("search", search);
  if (sort) params.append("sort", sort);
  if (position && position !== "ALL") params.append("position", position);
  params.append("page", page.toString());
  params.append("limit", limit.toString());
  if (params.toString()) url += `?${params.toString()}`;
  const response = await api.get(url);
  return response.data;
};

export const getPlayerStatById = async (
  id: string,
  compId?: string,
  matchDate?: string,
  matchId?: string,
): Promise<PlayerStat | null> => {
  let url = `/stats/players/${id}`;
  const params = new URLSearchParams();
  if (compId) params.append("competition_id", compId);
  if (matchDate) params.append("match_date", matchDate);
  if (matchId) params.append("match_id", matchId);
  if (params.toString()) url += `?${params.toString()}`;

  const response = await api.get(url);
  return response.data.data;
};

export const getTeamStats = async (
  compId?: string,
  eventDay?: string,
  page = 1,
  limit = 20,
  sort?: string,
  teamId?: string,
): Promise<PaginatedResponse<TeamStat>> => {
  let url = "/stats/teams";
  const params = new URLSearchParams();
  if (compId) params.append("competition_id", compId);
  if (eventDay) params.append("event_day", eventDay);
  if (teamId) params.append("team_id", teamId);
  if (sort) params.append("sort", sort);
  params.append("page", page.toString());
  params.append("limit", limit.toString());
  if (params.toString()) url += `?${params.toString()}`;
  const response = await api.get(url);
  return response.data;
};

export const upsertPlayerStat = async (payload: UpsertPlayerStatPayload) => {
  const response = await api.post("/admin/stats/players", payload);
  return response.data;
};

export const getStatDates = async (compId?: string): Promise<string[]> => {
  let url = "/stats/dates?limit=200";
  if (compId) url += `&competition_id=${compId}`;
  const response = await api.get(url);
  return response.data.data || [];
};

// ─── Inventory Management ─────────────────────────────────────────────────────

// ─── Admin Inventory Api ──────────────────────────────────────────────────────
export const getAdminProducts = async (
  page = 1,
  limit = 20,
  search?: string,
  activeOnly?: boolean,
) => {
  let url = `/admin/inventory/products?page=${page}&limit=${limit}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (activeOnly) url += `&active_only=true`;
  const response = await api.get<{
    message: string;
    data: InventoryProduct[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(url);
  return response.data;
};

export const getAdminLowStockAlerts = async () => {
  const response = await api.get<GenericApiResponse<InventoryProduct[]>>(
    `/admin/inventory/low-stock`,
  );
  return response.data.data;
};

export const createAdminProduct = async (payload: {
  name: string;
  description: string;
  price: number;
  quantity: number;
  threshold: number;
}) => {
  const response = await api.post<GenericApiResponse<InventoryProduct>>(
    `/admin/inventory/products`,
    payload,
  );
  return response.data;
};

export const updateAdminProduct = async (
  id: string,
  payload: Partial<{
    name: string;
    description: string;
    price: number;
    quantity: number;
    threshold: number;
    is_active: boolean;
  }>,
) => {
  const response = await api.put<GenericApiResponse<InventoryProduct>>(
    `/admin/inventory/products/${id}`,
    payload,
  );
  return response.data;
};

export const deleteAdminProduct = async (id: string) => {
  const response = await api.delete(`/admin/inventory/products/${id}`);
  return response.data;
};

export const getAdminSales = async (
  page = 1,
  limit = 20,
  productId?: string,
  sellerId?: string,
  fromDate?: string,
  toDate?: string,
) => {
  let url = `/admin/inventory/sales?page=${page}&limit=${limit}`;
  if (productId) url += `&product_id=${productId}`;
  if (sellerId) url += `&seller_id=${sellerId}`;
  if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
  if (toDate) url += `&to_date=${encodeURIComponent(toDate)}`;
  const response = await api.get<{
    message: string;
    data: InventorySale[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(url);
  return response.data;
};

export const getAdminSalesReport = async (
  period: "daily" | "weekly" | "monthly" | "custom",
  fromDate?: string,
  toDate?: string,
) => {
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
  const response = await api.post<GenericApiResponse<PaymentMethod>>(
    `/admin/inventory/payment-methods`,
    { name },
  );
  return response.data;
};

export const toggleAdminPaymentMethod = async (
  id: string,
  isActive: boolean,
) => {
  const response = await api.patch<GenericApiResponse<null>>(
    `/admin/inventory/payment-methods/${id}/toggle`,
    { is_active: isActive },
  );
  return response.data;
};

// ─── Seller Portal Api ────────────────────────────────────────────────────────
export const sellerGetProducts = async (
  page = 1,
  limit = 50,
  search?: string,
) => {
  let url = `/seller/products?page=${page}&limit=${limit}&active_only=true`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  const response = await api.get<{
    message: string;
    data: InventoryProduct[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(url);
  return response.data;
};

export const sellerLogSale = async (payload: {
  product_id: string;
  quantity_sold: number;
  payment_method: string;
  notes: string;
}) => {
  const response = await api.post<GenericApiResponse<InventorySale>>(
    `/seller/sales`,
    payload,
  );
  return response.data;
};

export const sellerGetSales = async (
  page = 1,
  limit = 20,
  fromDate?: string,
  toDate?: string,
) => {
  let url = `/seller/sales?page=${page}&limit=${limit}`;
  if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
  if (toDate) url += `&to_date=${encodeURIComponent(toDate)}`;
  const response = await api.get<{
    message: string;
    data: InventorySale[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(url);
  return response.data;
};

export const sellerGetPaymentMethods = async () => {
  const response = await api.get<GenericApiResponse<PaymentMethod[]>>(
    `/seller/payment-methods?active_only=true`,
  );
  return response.data.data;
};

// ─── Store / E-commerce Interfaces & APIs ─────────────────────────────────────
export const getStoreProducts = async (): Promise<StoreProduct[]> => {
  const response = await api.get<{ data: StoreProduct[] }>("/store/products");
  return response.data.data || [];
};

export const getStoreProduct = async (id: string): Promise<StoreProduct> => {
  const response = await api.get<{ data: StoreProduct }>(
    `/store/products/${id}`,
  );
  return response.data.data;
};

export const initializeCheckout = async (
  payload: CheckoutPayload,
): Promise<CheckoutResponseData> => {
  const response = await api.post<{ data: CheckoutResponseData }>(
    "/store/checkout",
    payload,
  );
  return response.data.data;
};

export const verifyStorePayment = async (reference: string): Promise<Order> => {
  const response = await api.post<{ data: Order }>("/store/verify", {
    reference,
  });
  return response.data.data;
};

export const getOrderByReference = async (
  reference: string,
): Promise<Order> => {
  const response = await api.get<{ data: Order }>(
    `/store/orders/by-ref/${reference}`,
  );
  return response.data.data;
};

export const getSavedAddresses = async (): Promise<SavedAddress[]> => {
  const response = await api.get<{ data: SavedAddress[] }>("/store/addresses");
  return response.data.data || [];
};

export const saveSavedAddress = async (
  payload: Omit<SavedAddress, "id">,
): Promise<SavedAddress> => {
  const response = await api.post<{ data: SavedAddress }>(
    "/store/addresses",
    payload,
  );
  return response.data.data;
};

export const getCustomerOrders = async (
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<Order>> => {
  const response = await api.get<PaginatedResponse<Order>>(
    `/store/orders?page=${page}&limit=${limit}`,
  );
  return response.data;
};

// Admin E-commerce Storefront APIs
export const getAdminStoreProducts = async (): Promise<StoreProduct[]> => {
  const response = await api.get<{ data: StoreProduct[] }>(
    "/admin/store/products",
  );
  return response.data.data || [];
};

type AdminStoreProductPayload = Omit<
  StoreProduct,
  | "id"
  | "sku"
  | "created_at"
  | "updated_at"
  | "images"
  | "variants"
  | "options"
  | "rating_avg"
  | "rating_count"
  | "created_by_name"
> & {
  sku?: string;
  options: ProductOption[];
};

export const createAdminStoreProduct = async (
  payload: AdminStoreProductPayload,
): Promise<StoreProduct> => {
  const response = await api.post<{ data: StoreProduct }>(
    "/admin/store/products",
    payload,
  );
  return response.data.data;
};

export const updateAdminStoreProduct = async (
  id: string,
  payload: AdminStoreProductPayload,
): Promise<unknown> => {
  const response = await api.put(`/admin/store/products/${id}`, payload);
  return response.data;
};

export const deleteAdminStoreProduct = async (id: string): Promise<unknown> => {
  const response = await api.delete(`/admin/store/products/${id}`);
  return response.data;
};

export const getAdminOrders = async (
  page = 1,
  limit = 20,
  paymentStatus?: string,
  fulfillmentStatus?: string,
): Promise<{
  data: Order[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}> => {
  let url = `/admin/store/orders?page=${page}&limit=${limit}`;
  if (paymentStatus) url += `&payment_status=${paymentStatus}`;
  if (fulfillmentStatus) url += `&fulfillment_status=${fulfillmentStatus}`;
  const response = await api.get<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(url);
  return response.data;
};

export const getAdminOrder = async (id: string): Promise<Order> => {
  const response = await api.get<{ data: Order }>(`/admin/store/orders/${id}`);
  return response.data.data;
};

export const updateOrderFulfillment = async (
  id: string,
  fulfillmentStatus: string,
): Promise<Order> => {
  const response = await api.patch<{ data: Order }>(
    `/admin/store/orders/${id}/fulfillment`,
    { fulfillment_status: fulfillmentStatus },
  );
  return response.data.data;
};

export const verifyAdminStoreOrder = async (id: string): Promise<Order> => {
  const response = await api.post<{ data: Order }>(
    `/admin/store/orders/${id}/verify`,
  );
  return response.data.data;
};

export const cancelAdminStoreOrder = async (id: string): Promise<Order> => {
  const response = await api.post<{ data: Order }>(
    `/admin/store/orders/${id}/cancel`,
  );
  return response.data.data;
};

export const saveAdminProductVariants = async (
  productId: string,
  variants: AdminVariantPayload[],
): Promise<unknown> => {
  const response = await api.post(
    `/admin/store/products/${productId}/variants`,
    variants,
  );
  return response.data;
};

export const saveAdminProductImages = async (
  productId: string,
  images: Omit<ProductImage, "id">[],
): Promise<unknown> => {
  const response = await api.post(
    `/admin/store/products/${productId}/images`,
    images,
  );
  return response.data;
};

// ─── Product Reviews ──────────────────────────────────────────────────────

export const getProductReviews = async (
  productId: string,
  page = 1,
  limit = 10,
  sort: ReviewSort = "newest",
): Promise<{
  data: ProductReview[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}> => {
  const response = await api.get<{
    data: ProductReview[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(
    `/store/products/${productId}/reviews?page=${page}&limit=${limit}&sort=${sort}`,
  );
  return response.data;
};

export const createProductReview = async (
  productId: string,
  payload: CreateProductReviewPayload,
): Promise<ProductReview> => {
  const response = await api.post<{ data: ProductReview }>(
    `/store/products/${productId}/reviews`,
    payload,
  );
  return response.data.data;
};

export const getMyProductReview = async (
  productId: string,
): Promise<ProductReview | null> => {
  const response = await api.get<{ data: ProductReview | null }>(
    `/store/products/${productId}/reviews/mine`,
  );
  return response.data.data;
};

export const deleteAdminProductReview = async (id: string): Promise<unknown> => {
  const response = await api.delete(`/admin/store/reviews/${id}`);
  return response.data;
};

// ─── Ticket Referrals ────────────────────────────────────────────────────────

export const createReferralCode = async (
  payload: CreateReferralPayload,
): Promise<ReferralResponse> => {
  const response = await api.post<ReferralResponse>(
    "/tickets/referrals",
    payload,
  );
  return response.data;
};

export const lookupReferrals = async (
  name: string,
): Promise<ReferralResponse[]> => {
  const response = await api.get<ReferralResponse[]>(
    `/tickets/referrals/lookup?name=${encodeURIComponent(name)}`,
  );
  return response.data;
};

export const adminListReferrals = async (
  page = 1,
  limit = 10,
  search?: string,
) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) params.append("search", search);
  const response = await api.get<PaginatedResponse<ReferralStatsResponse>>(
    `/admin/tickets/referrals?${params}`,
  );
  return response.data;
};

// ─── Play-by-Play (Step 1) ────────────────────────────────────────────────────

// Public read (used by the match page timeline later).
export const getMatchPlays = async (matchId: string): Promise<GamePlay[]> => {
  const res = await api.get<{ data: GamePlay[] }>(`/matches/${matchId}/plays`);
  return res.data.data || [];
};

// Admin read (same data, admin-gated route so the entry screen can load it).
export const getAdminMatchPlays = async (
  matchId: string,
): Promise<GamePlay[]> => {
  const res = await api.get<{ data: GamePlay[] }>(
    `/admin/matches/${matchId}/plays`,
  );
  return res.data.data || [];
};

export const createPlay = async (
  matchId: string,
  payload: PlayPayload,
): Promise<GamePlay> => {
  const res = await api.post<{ data: GamePlay }>(
    `/admin/matches/${matchId}/plays`,
    payload,
  );
  return res.data.data;
};

export const updatePlay = async (
  matchId: string,
  playId: string,
  payload: PlayPayload,
): Promise<GamePlay> => {
  const res = await api.put<{ data: GamePlay }>(
    `/admin/matches/${matchId}/plays/${playId}`,
    payload,
  );
  return res.data.data;
};

export const deletePlay = async (matchId: string, playId: string) => {
  const res = await api.delete(`/admin/matches/${matchId}/plays/${playId}`);
  return res.data;
};

// Re-derive the down/distance/possession/drive of plays after a mid-sequence
// insert. The client computes the new snapshots (same logic as live entry) and
// sends them; the server applies them and recomputes the score.
export const rederiveSituations = async (
  matchId: string,
  plays: SituationUpdate[],
) => {
  const res = await api.post(
    `/admin/matches/${matchId}/plays/rederive-situations`,
    { plays },
  );
  return res.data;
};

// Bulk re-derive of stats for every match that HAS a play log. Matches without
// one (e.g. the historical Excel imports) are excluded server-side, and scores /
// standings are never touched — stats only. App Admin only.
export const recomputeAllStats = async (
  opts: { competitionId?: string; dryRun?: boolean } = {},
): Promise<BulkRecomputeResult> => {
  const params = new URLSearchParams();
  if (opts.competitionId) params.set("competition_id", opts.competitionId);
  if (opts.dryRun) params.set("dry_run", "true");
  const qs = params.toString();
  const res = await api.post<{ data: BulkRecomputeResult }>(
    `/admin/stats/recompute-all${qs ? `?${qs}` : ""}`,
  );
  return res.data.data;
};

// Per-match play-by-play lock (admin only; each toggle is captured in the audit log).
export const setPBPLock = async (
  matchId: string,
  locked: boolean,
): Promise<boolean> => {
  const res = await api.post<{ data: { pbp_locked: boolean } }>(
    `/admin/matches/${matchId}/${locked ? "pbp-lock" : "pbp-unlock"}`,
  );
  return res.data.data.pbp_locked;
};

// Step 2 — stats derived from the play log vs the currently-stored manual stats.
export const getStatsCompare = async (
  matchId: string,
): Promise<StatsCompare> => {
  const res = await api.get<StatsCompare>(
    `/admin/matches/${matchId}/stats-compare`,
  );
  return { derived: res.data.derived || [], current: res.data.current || [] };
};

// Box score for the public match page. Same derivation as the admin compare
// endpoint above, but unauthenticated — that one sits under /admin and is gated
// to admin/referee/stats, so using it here left the stats blank for anyone not
// signed in as staff. `current` only ever comes back empty.
export const getPublicMatchStats = async (
  matchId: string,
): Promise<StatsCompare> => {
  const res = await api.get<StatsCompare>(`/matches/${matchId}/stats`);
  return { derived: res.data.derived || [], current: res.data.current || [] };
};

export const commitDerivedStats = async (
  matchId: string,
): Promise<{ players: number }> => {
  const res = await api.post<{ players: number }>(
    `/admin/matches/${matchId}/stats-commit`,
    {},
  );
  return res.data;
};

export const overrideMatchMVP = async (
  matchId: string,
  playerId: string | null,
  override?: boolean,
): Promise<{ message: string }> => {
  const res = await api.put<{ message: string }>(
    `/admin/matches/${matchId}/mvp`,
    {
      player_id: playerId,
      override,
    },
  );
  return res.data;
};

// Step 3 — scoring rules + score recompute.
export const getGameRules = async (
  competitionId: string,
): Promise<GameRules> => {
  const res = await api.get<{ data: GameRules }>(
    `/admin/competitions/${competitionId}/game-rules`,
  );
  return res.data.data;
};

export const upsertGameRules = async (
  competitionId: string,
  payload: GameRulesPayload,
): Promise<GameRules> => {
  const res = await api.put<{ data: GameRules }>(
    `/admin/competitions/${competitionId}/game-rules`,
    payload,
  );
  return res.data.data;
};

export const recomputeScore = async (
  matchId: string,
): Promise<{ home_score: number; away_score: number }> => {
  const res = await api.post<{ home_score: number; away_score: number }>(
    `/admin/matches/${matchId}/recompute-score`,
    {},
  );
  return res.data;
};

export const commitScore = async (
  matchId: string,
): Promise<{ home_score: number; away_score: number }> => {
  const res = await api.post<{ home_score: number; away_score: number }>(
    `/admin/matches/${matchId}/commit-score`,
    {},
  );
  return res.data;
};

// ─── Contracts, Transfers, Player Portal & Notifications ───────────────────────
// Contract API
export const contractsApi = {
  issue: async (data: IssueContractPayload): Promise<ContractData> => {
    const res = await api.post<{ data: ContractData }>("/contracts", data);
    return res.data.data;
  },
  getTeamContracts: async (params?: {
    team_id?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<ContractData>> => {
    const res = await api.get<PaginatedResponse<ContractData>>(
      "/contracts/team",
      { params },
    );
    return res.data;
  },
  getFreeAgents: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Player>> => {
    const res = await api.get<PaginatedResponse<Player>>(
      "/contracts/free-agents",
      { params },
    );
    return res.data;
  },
  getById: async (id: string): Promise<ContractData> => {
    const res = await api.get<{ data: ContractData }>(`/contracts/${id}`);
    return res.data.data;
  },
  renew: async (
    id: string,
    data: { contract_length?: number; player_value?: number },
  ): Promise<ContractData> => {
    const res = await api.post<{ data: ContractData }>(
      `/contracts/${id}/renew`,
      data,
    );
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
  createRequest: async (data: {
    player_id: string;
    to_team_id: string;
    notes?: string;
  }): Promise<TransferData> => {
    const res = await api.post<{ data: TransferData }>(
      "/transfers/request",
      data,
    );
    return res.data.data;
  },
  createListing: async (data: {
    player_id: string;
    asking_price: number;
  }): Promise<TransferData> => {
    const res = await api.post<{ data: TransferData }>(
      "/transfers/listing",
      data,
    );
    return res.data.data;
  },
  createDirectSale: async (data: {
    player_id: string;
    to_team_id: string;
    price: number;
  }): Promise<TransferData> => {
    const res = await api.post<{ data: TransferData }>(
      "/transfers/direct-sale",
      data,
    );
    return res.data.data;
  },
  getMarket: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<TransferData>> => {
    const res = await api.get<PaginatedResponse<TransferData>>(
      "/transfers/market",
      { params },
    );
    return res.data;
  },
  getTeamTransfers: async (params?: {
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<TransferData>> => {
    const res = await api.get<PaginatedResponse<TransferData>>(
      "/transfers/team",
      { params },
    );
    return res.data;
  },
  getById: async (id: string): Promise<TransferData> => {
    const res = await api.get<{ data: TransferData }>(`/transfers/${id}`);
    return res.data.data;
  },
  respond: async (
    id: string,
    data: { action: "accept" | "reject" | "review"; notes?: string },
  ): Promise<TransferData> => {
    const res = await api.put<{ data: TransferData }>(
      `/transfers/${id}/respond`,
      data,
    );
    return res.data.data;
  },
  placeBid: async (
    id: string,
    data: { bid_value: number },
  ): Promise<TransferBidData> => {
    const res = await api.post<{ data: TransferBidData }>(
      `/transfers/${id}/bid`,
      data,
    );
    return res.data.data;
  },
  respondToBid: async (
    transferId: string,
    bidId: string,
    action: "accept" | "reject",
  ): Promise<void> => {
    await api.put(`/transfers/${transferId}/bids/${bidId}/respond`, { action });
  },
  getBudget: async (): Promise<TeamBudgetData> => {
    const res = await api.get<{ data: TeamBudgetData }>("/transfers/budget");
    return res.data.data;
  },
  getWindowStatus: async (): Promise<{
    data: TransferWindowData | null;
    is_open: boolean;
  }> => {
    const res = await api.get<{
      data: TransferWindowData | null;
      is_open: boolean;
    }>("/transfers/window");
    return res.data;
  },
  getPlayerTransfers: async (
    playerID: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<TransferData>> => {
    const res = await api.get<PaginatedResponse<TransferData>>(
      `/transfers/player/${playerID}`,
      { params },
    );
    return res.data;
  },
};

// Player Portal API
export const playerPortalApi = {
  getContracts: async (): Promise<ContractData[]> => {
    const res = await api.get<{ data: ContractData[] }>(
      "/player-portal/contracts",
    );
    return res.data.data || [];
  },
  getContractById: async (id: string): Promise<ContractData> => {
    const res = await api.get<{ data: ContractData }>(
      `/player-portal/contracts/${id}`,
    );
    return res.data.data;
  },
  respondToContract: async (
    id: string,
    action: "accept" | "reject",
    notes?: string,
  ): Promise<void> => {
    await api.put(`/player-portal/contracts/${id}/respond`, { action, notes });
  },
  getMyTransfers: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<TransferData>> => {
    const res = await api.get<PaginatedResponse<TransferData>>(
      "/player-portal/transfers",
      { params },
    );
    return res.data;
  },
};

// Notifications API
export const notificationsApi = {
  getAll: async (params?: {
    unread_only?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<NotificationData>> => {
    const res = await api.get<PaginatedResponse<NotificationData>>(
      "/notifications",
      { params },
    );
    return res.data;
  },
  getUnreadCount: async (): Promise<number> => {
    const res = await api.get<{ unread_count: number }>(
      "/notifications/unread-count",
    );
    return res.data.unread_count || 0;
  },
  markAsRead: async (id: string): Promise<void> => {
    await api.put(`/notifications/${id}/read`);
  },
  markAllAsRead: async (): Promise<void> => {
    await api.put("/notifications/read-all");
  },
};

// Admin Transfer/Contract API
export const adminTransfersApi = {
  overrideContract: async (
    id: string,
    status: string,
    reason?: string,
  ): Promise<void> => {
    await api.put(`/admin/contracts/${id}/override`, { status, reason });
  },
  forceAcceptContract: async (id: string): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>(
      `/admin/contracts/${id}/force-accept`,
    );
    return res.data;
  },
  overrideTransfer: async (
    id: string,
    status: string,
    notes?: string,
  ): Promise<void> => {
    await api.put(`/admin/transfers/${id}/override`, { status, notes });
  },
  getWindows: async (): Promise<TransferWindowData[]> => {
    const res = await api.get<{ data: TransferWindowData[] }>(
      "/admin/transfer-windows",
    );
    return res.data.data || [];
  },
  createWindow: async (data: {
    name: string;
    opens_at: string;
    closes_at: string;
    is_active?: boolean;
  }): Promise<TransferWindowData> => {
    const res = await api.post<{ data: TransferWindowData }>(
      "/admin/transfer-windows",
      data,
    );
    return res.data.data;
  },
  updateWindow: async (
    id: string,
    data: {
      name?: string;
      opens_at?: string;
      closes_at?: string;
      is_active?: boolean;
    },
  ): Promise<TransferWindowData> => {
    const res = await api.put<{ data: TransferWindowData }>(
      `/admin/transfer-windows/${id}`,
      data,
    );
    return res.data.data;
  },
  deleteWindow: async (id: string): Promise<void> => {
    await api.delete(`/admin/transfer-windows/${id}`);
  },
  getAllBudgets: async (): Promise<TeamBudgetData[]> => {
    const res = await api.get<{ data: TeamBudgetData[] }>(
      "/admin/team-budgets",
    );
    return res.data.data || [];
  },
  adjustBudget: async (teamId: string, total_budget: number): Promise<void> => {
    await api.put(`/admin/team-budgets/${teamId}`, { total_budget });
  },
  seedBudgets: async (): Promise<void> => {
    await api.post("/admin/team-budgets/seed");
  },
};

// ─── Player Account Claims ────────────────────────────────────────────────────
// Every player in the database came from the historical import with no email, phone
// or photo, so none of them can be authenticated by contact details. A claimant
// identifies themselves to their team manager, who is the only party able to confirm
// who they are; approval is what mints the account.

export const claimApi = {
  // Public — the claim page
  verifyCode: async (code: string): Promise<VerifyClaimCodeData> => {
    const res = await api.post<VerifyClaimCodeData>("/claim/verify-code", {
      code,
    });
    return res.data;
  },
  submit: async (payload: SubmitClaimPayload): Promise<SubmitClaimData> => {
    const res = await api.post<SubmitClaimData>("/claim/submit", payload);
    return res.data;
  },
  verifyEmail: async (token: string): Promise<void> => {
    await api.post("/claim/verify-email", { token });
  },

  // The claimant's own pending claim
  getMyStatus: async (): Promise<MyClaimStatusData> => {
    const res = await api.get<MyClaimStatusData>("/claim/my-status");
    return res.data;
  },
  setMyPhoto: async (photo: string): Promise<void> => {
    await api.patch("/claim/my-photo", { photo });
  },
  resendVerification: async (): Promise<void> => {
    await api.post("/claim/resend-verification");
  },
};

// Team manager review + code management
export const teamHeadClaimsApi = {
  list: async (params?: {
    status?: string;
    search?: string;
    kind?: ClaimKind;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PlayerClaimData>> => {
    const res = await api.get<PaginatedResponse<PlayerClaimData>>(
      "/team-head/claims",
      { params },
    );
    return res.data;
  },
  // What is genuinely the manager's to act on — excludes new-player requests they
  // have already endorsed, which now sit with the league office.
  pendingCount: async (): Promise<number> => {
    const res = await api.get<{ pending: number }>(
      "/team-head/claims/pending-count",
    );
    return res.data.pending || 0;
  },
  endorse: async (
    id: string,
    endorse: boolean,
    note?: string,
  ): Promise<void> => {
    await api.post(`/team-head/claims/${id}/endorse`, {
      endorse,
      note: note || "",
    });
  },
  approve: async (
    id: string,
    data?: { name?: string; jersey_number?: number; position?: string },
  ): Promise<void> => {
    await api.post(`/team-head/claims/${id}/approve`, data || {});
  },
  reject: async (id: string, reason: string): Promise<void> => {
    await api.post(`/team-head/claims/${id}/reject`, { reason });
  },
  getCode: async (): Promise<ClaimCodeData | null> => {
    const res = await api.get<ClaimCodeData | { code: null }>(
      "/team-head/claim-codes",
    );
    const data = res.data as ClaimCodeData;
    return data && data.code ? data : null;
  },
  generateCode: async (data?: {
    expires_in_days?: number;
    max_uses?: number;
  }): Promise<ClaimCodeData> => {
    const res = await api.post<ClaimCodeData>(
      "/team-head/claim-codes",
      data || {},
    );
    return res.data;
  },
  revokeCode: async (id: string): Promise<void> => {
    await api.delete(`/team-head/claim-codes/${id}`);
  },
};

export const adminClaimsApi = {
  list: async (params?: {
    status?: string;
    search?: string;
    team_id?: string;
    kind?: ClaimKind;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PlayerClaimData>> => {
    const res = await api.get<PaginatedResponse<PlayerClaimData>>(
      "/admin/claims",
      { params },
    );
    return res.data;
  },
  approve: async (
    id: string,
    data?: { name?: string; jersey_number?: number; position?: string },
  ): Promise<void> => {
    await api.post(`/admin/claims/${id}/approve`, data || {});
  },
  reject: async (id: string, reason: string): Promise<void> => {
    await api.post(`/admin/claims/${id}/reject`, { reason });
  },
  revoke: async (id: string): Promise<void> => {
    await api.post(`/admin/claims/${id}/revoke`);
  },
  listCodes: async (): Promise<ClaimCodeData[]> => {
    const res = await api.get<{ data: ClaimCodeData[] }>("/admin/claim-codes");
    return res.data.data || [];
  },
  generateCode: async (
    team_id: string,
    data?: { expires_in_days?: number; max_uses?: number },
  ): Promise<ClaimCodeData> => {
    const res = await api.post<ClaimCodeData>("/admin/claim-codes", {
      team_id,
      ...(data || {}),
    });
    return res.data;
  },
  revokeCode: async (id: string): Promise<void> => {
    await api.delete(`/admin/claim-codes/${id}`);
  },
};

// Site-wide display settings. The read is public (every visitor needs the app
// font on boot); only an admin can write, which is what makes the choice apply
// to everyone rather than just the browser that made it.
export const appSettingsApi = {
  get: async (): Promise<AppSettingsData> => {
    const res = await api.get<AppSettingsData>("/app-settings");
    return res.data;
  },
  setFont: async (app_font_id: string): Promise<AppSettingsData> => {
    const res = await api.put<AppSettingsData>("/admin/app-settings/font", {
      app_font_id,
    });
    return res.data;
  },
};

export const commentsApi = {
  getComments: async (
    entityType: string,
    entityId: string,
    page = 1,
    limit = COMMENTS_PAGE_SIZE,
  ): Promise<CommentPage> => {
    const res = await api.get<CommentPage>("/comments", {
      params: { entity_type: entityType, entity_id: entityId, page, limit },
    });
    return {
      ...res.data,
      data: res.data.data || [],
    };
  },
  createComment: async (data: {
    entity_type: string;
    entity_id: string;
    content: string;
    parent_id?: string;
  }): Promise<CommentData> => {
    const res = await api.post<{ data: CommentData }>("/comments", data);
    return res.data.data;
  },
  deleteComment: async (id: string): Promise<void> => {
    await api.delete(`/comments/${id}`);
  },
  likeComment: async (
    id: string,
  ): Promise<{ liked: boolean; likes_count: number }> => {
    const res = await api.post<{ liked: boolean; likes_count: number }>(
      `/comments/${id}/like`,
    );
    return res.data;
  },
  updateNewsCommentSettings: async (
    newsId: string,
    commentsEnabled: boolean,
  ): Promise<void> => {
    await api.put(`/admin/news/${newsId}/comment-settings`, {
      comments_enabled: commentsEnabled,
    });
  },
};

// ─── Discount codes ───────────────────────────────────────────────────────────

export const discountsApi = {
  list: async (): Promise<DiscountCode[]> => {
    const res = await api.get<{ data: DiscountCode[] }>(
      "/admin/discount-codes",
    );
    return res.data.data || [];
  },
  listTargets: async (search?: string): Promise<DiscountTarget[]> => {
    // Filtered on the server: a catalogue outgrows any page, so searching
    // the loaded page would quietly hide anything past it.
    const res = await api.get<{ data: DiscountTarget[] }>(
      "/admin/discount-codes/targets",
      {
        params: { search: search || undefined, limit: 50 },
      },
    );
    return res.data.data || [];
  },
  create: async (payload: SaveDiscountCodePayload): Promise<DiscountCode> => {
    const res = await api.post<{ data: DiscountCode }>(
      "/admin/discount-codes",
      payload,
    );
    return res.data.data;
  },
  update: async (
    id: string,
    payload: SaveDiscountCodePayload,
  ): Promise<DiscountCode> => {
    const res = await api.put<{ data: DiscountCode }>(
      `/admin/discount-codes/${id}`,
      payload,
    );
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
    const res = await api.post<DiscountPreview>("/discounts/preview", params);
    return res.data;
  },
};

// ─── Fantasy Module Types & API ──────────────────────────────────────────────

interface RawLeaderboard {
  data: LeaderboardEntry[] | null;
  total: number;
  total_pages: number;
  my_rank?: number;
  my_entry?: LeaderboardEntry | null;
}

export const fantasyApi = {
  getActiveSeason: async (): Promise<FantasySeason | null> => {
    const res = await api.get<{ data: FantasySeason | null }>(
      "/fantasy/season",
    );
    return res.data.data;
  },
  getGameweeks: async (seasonId: string): Promise<FantasyGameweek[]> => {
    const res = await api.get<{ data: FantasyGameweek[] }>(
      `/fantasy/season/${seasonId}/gameweeks`,
    );
    return res.data.data || [];
  },
  listPlayerMarket: async (
    seasonId: string,
    params?: {
      /** Comma-separated list of positions, e.g. "Receiver,Center". Filtered server-side. */
      position?: string;
      /** 'M' or 'F'. Omit for any gender. Filtered server-side. */
      gender?: "M" | "F";
      team_id?: string;
      search?: string;
      sort?: MarketSort;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    data: FantasyPlayerListItem[];
    total: number;
    total_pages: number;
  }> => {
    const res = await api.get<{
      data: FantasyPlayerListItem[];
      total: number;
      total_pages: number;
    }>(`/fantasy/season/${seasonId}/market`, { params });
    return res.data;
  },
  /** Clubs and positions present in the season's market, for the filter chips. */
  getMarketFilters: async (
    seasonId: string,
  ): Promise<{
    teams: {
      id: string;
      name: string;
      short_name: string;
      logo: string;
    }[];
    positions: string[];
  }> => {
    const res = await api.get<{
      data: {
        teams: {
          id: string;
          name: string;
          short_name: string;
          logo: string;
        }[];
        positions: string[];
      };
    }>(`/fantasy/season/${seasonId}/market/filters`);
    return res.data.data;
  },
  getPlayerBreakdown: async (
    playerId: string,
    gwId: string,
  ): Promise<PlayerGWBreakdownResponse> => {
    const res = await api.get<{ data: PlayerGWBreakdownResponse }>(
      `/fantasy/players/${playerId}/gameweek/${gwId}/breakdown`,
    );
    return res.data.data;
  },
  getPlayerPriceHistory: async (
    playerId: string,
    seasonId?: string,
  ): Promise<PlayerPriceHistoryResponse> => {
    const res = await api.get<{ data: PlayerPriceHistoryResponse }>(
      `/fantasy/players/${playerId}/price-history`,
      { params: seasonId ? { season_id: seasonId } : undefined },
    );
    return res.data.data;
  },
  saveLineup: async (payload: {
    season_id: string;
    gameweek_id: string;
    team_name: string;
    picks: { player_id: string; slot: FantasySlot }[];
    /** Send true only for the manager's explicit "Publish Lineup" action. */
    publish?: boolean;
  }): Promise<FantasyLineupResponse> => {
    const res = await api.post<{ data: FantasyLineupResponse }>(
      "/fantasy/lineups",
      payload,
    );
    return res.data.data;
  },
  getMyLineup: async (
    seasonId: string,
    gameweekId: string,
  ): Promise<FantasyLineupResponse | null> => {
    const res = await api.get<{ data: FantasyLineupResponse | null }>(
      "/fantasy/lineups/mine",
      {
        params: { season_id: seasonId, gameweek_id: gameweekId },
      },
    );
    return res.data.data;
  },
  getTeamLineup: async (
    teamId: string,
    gameweekId: string,
  ): Promise<FantasyTeamLineupDetailResponse> => {
    const res = await api.get<{ data: FantasyTeamLineupDetailResponse }>(
      `/fantasy/teams/${teamId}/gameweeks/${gameweekId}`,
    );
    return res.data.data;
  },
  getGameweekReport: async (
    seasonId: string,
    gameweekId: string,
  ): Promise<GameweekReportResponse> => {
    const res = await api.get<{ data: GameweekReportResponse }>(
      `/fantasy/seasons/${seasonId}/gameweeks/${gameweekId}/report`,
    );
    return res.data.data;
  },
  // Paged on the server — the public browse list grows with every league
  // anyone creates, so it is never fetched whole.
  listPublicLeagues: async (
    seasonId: string,
    params?: { page?: number; limit?: number },
  ): Promise<Paged<FantasyLeague>> => {
    const res = await api.get<Paged<FantasyLeague>>("/fantasy/leagues/public", {
      params: { season_id: seasonId, ...params },
    });
    return { ...res.data, data: res.data.data ?? [] };
  },
  listMyLeagues: async (seasonId: string): Promise<FantasyLeague[]> => {
    // Feeds the dashboard tiles and the leaderboard's league filter, both of
    // which need every league the manager is in, so it asks for the cap.
    const res = await api.get<{ data: FantasyLeague[] }>(
      "/fantasy/leagues/mine",
      {
        params: { season_id: seasonId, limit: 200 },
      },
    );
    return res.data.data || [];
  },
  createLeague: async (payload: {
    season_id: string;
    name: string;
    type: "PUBLIC" | "PRIVATE";
    entry_fee: number;
    max_members: number;
    // How the creator wants the pool divided. Omitted, the season default
    // (50/30/20) applies.
    prize_structure?: { rank: number; percent: number }[];
  }): Promise<FantasyLeague> => {
    const res = await api.post<{ data: FantasyLeague }>(
      "/fantasy/leagues",
      payload,
    );
    return res.data.data;
  },
  // A PUBLIC league is joined straight from the browse list by id; a PRIVATE
  // one needs its invite code. Pass whichever you have.
  joinLeague: async (
    seasonId: string,
    by: { invite_code?: string; league_id?: string },
  ): Promise<JoinLeagueResponse> => {
    // The handler wraps the payload as { message, data }, so the join
    // details are a level down. Returning the envelope left paystack_url
    // undefined, and a paid join silently reported success instead of
    // sending the manager to checkout.
    const res = await api.post<{ message: string; data: JoinLeagueResponse }>(
      "/fantasy/leagues/join",
      by,
      { params: { season_id: seasonId } },
    );
    return res.data.data;
  },
  // Leaving drops the manager out of the league's table. A free league can be
  // rejoined; a paid one cannot — the entry fee stays in the prize pool.
  leaveLeague: async (leagueId: string): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>(
      `/fantasy/leagues/${leagueId}/leave`,
    );
    return res.data;
  },
  verifyLeaguePayment: async (
    reference: string,
  ): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>("/fantasy/leagues/verify", {
      reference,
    });
    return res.data;
  },
  getLeaderboard: async (
    leagueId: string,
    params?: { gameweek_id?: string; page?: number; limit?: number },
  ): Promise<Leaderboard> => {
    const res = await api.get<RawLeaderboard>(
      `/fantasy/leagues/${leagueId}/leaderboard`,
      { params },
    );
    // An empty list must reach the UI as [], never null — callers read
    // .length and .map on it directly.
    return {
      ...res.data,
      data: res.data.data ?? [],
      my_rank: res.data.my_rank ?? 0,
      my_entry: res.data.my_entry ?? null,
    };
  },
  getOverallLeaderboard: async (
    seasonId: string,
    params?: { gameweek_id?: string; page?: number; limit?: number },
  ): Promise<Leaderboard> => {
    const res = await api.get<RawLeaderboard>(
      `/fantasy/season/${seasonId}/leaderboard`,
      { params },
    );
    return {
      ...res.data,
      data: res.data.data ?? [],
      my_rank: res.data.my_rank ?? 0,
      my_entry: res.data.my_entry ?? null,
    };
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
    const res = await api.post<{ data: FantasySeason }>(
      "/admin/fantasy/seasons",
      payload,
    );
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
    payload: {
      number: number;
      event_day_id?: string;
      match_date?: string;
      deadline?: string;
    },
  ): Promise<FantasyGameweek> => {
    const res = await api.post<{ data: FantasyGameweek }>(
      `/admin/fantasy/seasons/${seasonId}/gameweeks`,
      payload,
    );
    return res.data.data;
  },
  adminGetScheduledMatchDays: async (
    seasonId: string,
  ): Promise<ScheduledMatchDay[]> => {
    const res = await api.get<{ data: ScheduledMatchDay[] }>(
      `/admin/fantasy/seasons/${seasonId}/match-days`,
    );
    return res.data.data;
  },
  adminAutoScheduleGameweeks: async (
    seasonId: string,
  ): Promise<FantasyGameweek[]> => {
    const res = await api.post<{ data: FantasyGameweek[] }>(
      `/admin/fantasy/seasons/${seasonId}/gameweeks/auto-schedule`,
    );
    return res.data.data;
  },
  /** Corrects a gameweek's lock deadline after creation. `deadline` is RFC3339. */
  adminUpdateGameweekDeadline: async (
    gwId: string,
    deadline: string,
  ): Promise<void> => {
    await api.post(`/admin/fantasy/gameweeks/${gwId}/deadline`, { deadline });
  },
  adminInitializePrices: async (seasonId: string): Promise<void> => {
    await api.post(`/admin/fantasy/seasons/${seasonId}/prices/initialize`);
  },
  /** Safe to re-run: re-finalizing recomputes scores rather than double-counting. */
  adminFinalizeGameweek: async (gwId: string): Promise<void> => {
    await api.post(`/admin/fantasy/gameweeks/${gwId}/finalize`);
  },
  adminDeleteGameweek: async (gwId: string): Promise<void> => {
    await api.delete(`/admin/fantasy/gameweeks/${gwId}`);
  },
};

// ─── Fantasy Wallet, Payouts & Admin Finance ─────────────────────────────────

// Every amount below is integer kobo (₦1 = 100 kobo), matching the Paystack
// amounts used on the way in. Divide by 100 to display naira.
export const koboToNaira = (kobo: number) => kobo / 100;

export const formatKobo = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Season entry & dashboard ────────────────────────────────────────────────

export const fantasySeasonApi = {
  // Works before entry too: an un-entered visitor gets the season and
  // standings, which is what the "join this season" screen renders.
  getDashboard: async (seasonId?: string): Promise<FantasyDashboard | null> => {
    const res = await api.get<{ data: FantasyDashboard | null }>(
      "/fantasy/dashboard",
      {
        params: seasonId ? { season_id: seasonId } : undefined,
      },
    );
    return res.data.data;
  },
  // The deliberate opt-in. Nothing is created for a manager until this runs.
  enterSeason: async (
    seasonId: string,
    teamName: string,
  ): Promise<DashboardTeam> => {
    const res = await api.post<{ data: DashboardTeam }>(
      `/fantasy/seasons/${seasonId}/enter`,
      {
        team_name: teamName,
      },
    );
    return res.data.data;
  },
};

/** Fantasy prices are in fantasy millions — the unit the pricing model works in.
 *  Defined once so the label cannot drift between screens. */
export const formatFantasyPrice = (v: number | null | undefined): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return `₦${n.toFixed(1)}m`;
};

// ─── Squad & trading ─────────────────────────────────────────────────────────

const normaliseSquad = (s: Squad): Squad => ({
  ...s,
  players: s?.players ?? [],
  readiness: {
    ...s?.readiness,
    requirements: s?.readiness?.requirements ?? [],
  } as SquadReadiness,
});

export const fantasySquadApi = {
  getSquad: async (seasonId: string): Promise<Squad> => {
    const res = await api.get<{ data: Squad }>("/fantasy/squad", {
      params: { season_id: seasonId },
    });
    return normaliseSquad(res.data.data);
  },
  // Buy and sell both return the whole squad, so the dashboard reflects the
  // new balance without a second round trip.
  buyPlayer: async (seasonId: string, playerId: string): Promise<Squad> => {
    const res = await api.post<{ data: Squad }>(
      "/fantasy/squad/buy",
      { player_id: playerId },
      { params: { season_id: seasonId } },
    );
    return normaliseSquad(res.data.data);
  },
  sellPlayer: async (seasonId: string, playerId: string): Promise<Squad> => {
    const res = await api.post<{ data: Squad }>(
      "/fantasy/squad/sell",
      { player_id: playerId },
      { params: { season_id: seasonId } },
    );
    return normaliseSquad(res.data.data);
  },
};

export const fantasyLeagueApi = {
  // The terms of a league — cost, field size, prize split, refund policy —
  // read before any join or payment is set in motion.
  getJoinPreview: async (leagueId: string): Promise<LeagueJoinPreview> => {
    const res = await api.get<{ data: LeagueJoinPreview }>(
      `/fantasy/leagues/${leagueId}/preview`,
    );
    return res.data.data;
  },
  // A private league is never listed, so its invite code is the only handle a
  // prospective member has. Same terms, resolved by code.
  getJoinPreviewByCode: async (code: string): Promise<LeagueJoinPreview> => {
    const res = await api.get<{ data: LeagueJoinPreview }>(
      "/fantasy/leagues/preview",
      {
        params: { code },
      },
    );
    return res.data.data;
  },
  // The platform's share of entry fees, for the league creation form. Only
  // the creator is shown this — it is what comes off the top before they
  // price an entry fee.
  getPlatformCutPercent: async (): Promise<number> => {
    const res = await api.get<{ data: { cut_percent: number } }>(
      "/fantasy/platform-cut",
    );
    return res.data.data.cut_percent;
  },
};

export const fantasyWalletApi = {
  getWallet: async (): Promise<FantasyWallet> => {
    const res = await api.get<{ data: FantasyWallet }>("/fantasy/wallet");
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
    const res = await api.post<{ data: PayoutRequest }>(
      "/fantasy/payouts",
      payload,
    );
    return res.data.data;
  },
  listMyPayouts: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<Paged<PayoutRequest>> => {
    const res = await api.get<Paged<PayoutRequest>>("/fantasy/payouts", {
      params,
    });
    return { ...res.data, data: res.data.data ?? [] };
  },
  cancelPayout: async (id: string): Promise<PayoutRequest> => {
    const res = await api.post<{ data: PayoutRequest }>(
      `/fantasy/payouts/${id}/cancel`,
    );
    return res.data.data;
  },
};

export const fantasyAdminApi = {
  // Returns every season including DRAFT ones. `getActiveSeason` only ever
  // returns an ACTIVE season, so admin screens must use this or they cannot
  // see — let alone activate — a season they just created.
  listSeasons: async (): Promise<FantasySeason[]> => {
    const res = await api.get<{ data: FantasySeason[] }>(
      "/admin/fantasy/seasons",
      {
        params: { limit: 200 },
      },
    );
    return res.data.data || [];
  },
  listPlayerPrices: async (
    seasonId: string,
    params?: {
      search?: string;
      position?: string;
      team_id?: string;
      override_status?: "all" | "overridden" | "calculated";
      page?: number;
      limit?: number;
    },
  ): Promise<Paged<AdminPlayerPriceRow>> => {
    const res = await api.get<Paged<AdminPlayerPriceRow>>(
      `/admin/fantasy/seasons/${seasonId}/prices`,
      { params },
    );
    return res.data;
  },
  overridePlayerPrice: async (
    seasonId: string,
    playerId: string,
    payload: { price?: number; reset?: boolean },
  ): Promise<AdminPlayerPriceRow> => {
    const res = await api.put<{ data: AdminPlayerPriceRow }>(
      `/admin/fantasy/seasons/${seasonId}/prices/${playerId}`,
      payload,
    );
    return res.data.data;
  },
  // Only a DRAFT season with no squads entered can be deleted; the server
  // refuses anything already launched.
  deleteSeason: async (seasonId: string): Promise<void> => {
    await api.delete(`/admin/fantasy/seasons/${seasonId}`);
  },
  getOverview: async (seasonId: string): Promise<AdminFantasyOverview> => {
    const res = await api.get<{ data: AdminFantasyOverview }>(
      `/admin/fantasy/seasons/${seasonId}/overview`,
    );
    return res.data.data;
  },
  listManagers: async (
    seasonId: string,
    params?: { search?: string; page?: number; limit?: number },
  ): Promise<Paged<AdminManagerRow>> => {
    const res = await api.get<Paged<AdminManagerRow>>(
      `/admin/fantasy/seasons/${seasonId}/managers`,
      { params },
    );
    return res.data;
  },
  // Includes PRIVATE leagues, unlike the public browse endpoint.
  listLeagues: async (
    seasonId: string,
    params?: { search?: string; page?: number; limit?: number },
  ): Promise<Paged<AdminLeagueRow>> => {
    const res = await api.get<Paged<AdminLeagueRow>>(
      `/admin/fantasy/seasons/${seasonId}/leagues`,
      { params },
    );
    return res.data;
  },
  getLeagueFinance: async (leagueId: string): Promise<LeagueFinance> => {
    const res = await api.get<{ data: LeagueFinance }>(
      `/admin/fantasy/leagues/${leagueId}/finance`,
    );
    // An unfunded league projects no awards, and a Go nil slice arrives as
    // `null`. The page reduces and maps over both of these lists, so they
    // are normalised here rather than guarded at every use.
    const finance = res.data.data;
    return {
      ...finance,
      awards: finance?.awards ?? [],
      prize_structure: finance?.prize_structure ?? [],
    };
  },
  listLeagueMembers: async (
    leagueId: string,
    params?: { page?: number; limit?: number },
  ): Promise<Paged<AdminLeagueMemberRow>> => {
    const res = await api.get<Paged<AdminLeagueMemberRow>>(
      `/admin/fantasy/leagues/${leagueId}/members`,
      { params },
    );
    return { ...res.data, data: res.data.data ?? [] };
  },
  setPrizeStructure: async (
    leagueId: string,
    tiers: { rank: number; percent: number }[],
  ): Promise<LeagueFinance> => {
    const res = await api.put<{ data: LeagueFinance }>(
      `/admin/fantasy/leagues/${leagueId}/prizes`,
      { tiers },
    );
    return res.data.data;
  },
  // Throws 409 if the league was already settled.
  settleLeague: async (leagueId: string): Promise<SettlementResult> => {
    const res = await api.post<{ data: SettlementResult }>(
      `/admin/fantasy/leagues/${leagueId}/settle`,
    );
    return res.data.data;
  },
  settleSeason: async (seasonId: string): Promise<SettlementResult> => {
    const res = await api.post<{ data: SettlementResult }>(
      `/admin/fantasy/seasons/${seasonId}/settle`,
    );
    return res.data.data;
  },
  // Settles every outstanding paid league, then closes the season.
  completeSeason: async (seasonId: string): Promise<SettlementResult> => {
    const res = await api.post<{ data: SettlementResult }>(
      `/admin/fantasy/seasons/${seasonId}/complete`,
    );
    return res.data.data;
  },
  // Everyone the platform currently owes prize money to, and the account it
  // would be sent to. Settling a league credits wallets; this is what those
  // credits add up to before any transfer is made.
  getMoneyOwed: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<MoneyOwed> => {
    const res = await api.get<{ data: MoneyOwed }>("/admin/fantasy/owed", {
      params,
    });
    return { ...res.data.data, rows: res.data.data?.rows ?? [] };
  },
  listPayouts: async (params?: {
    status?: PayoutStatus | "";
    page?: number;
    limit?: number;
  }): Promise<Paged<PayoutRequest>> => {
    const res = await api.get<Paged<PayoutRequest>>("/admin/fantasy/payouts", {
      params,
    });
    return res.data;
  },
  // payment_reference is required when moving a payout to PAID.
  updatePayoutStatus: async (
    payoutId: string,
    payload: {
      status: "PROCESSING" | "PAID" | "REJECTED";
      admin_notes?: string;
      payment_reference?: string;
    },
  ): Promise<PayoutRequest> => {
    const res = await api.put<{ data: PayoutRequest }>(
      `/admin/fantasy/payouts/${payoutId}/status`,
      payload,
    );
    return res.data.data;
  },
  getUserWallet: async (userId: string): Promise<FantasyWallet> => {
    const res = await api.get<{ data: FantasyWallet }>(
      `/admin/fantasy/users/${userId}/wallet`,
    );
    return res.data.data;
  },
};

// ─── Badges & Honors ──────────────────────────────────────────────────────────
export const getBadges = async (): Promise<Badge[]> => {
  const res = await api.get<{ data: Badge[] }>("/badges");
  return res.data.data;
};

export const getPlayerBadges = async (
  playerId: string,
): Promise<PlayerBadge[]> => {
  const res = await api.get<{ data: PlayerBadge[] }>(
    `/badges/players/${playerId}`,
  );
  return res.data.data;
};

// Admin Badge APIs
export const getAdminBadges = async (): Promise<Badge[]> => {
  const res = await api.get<{ data: Badge[] }>("/admin/badges");
  return res.data.data;
};

export const createAdminBadge = async (
  payload: CreateBadgePayload,
): Promise<Badge> => {
  const res = await api.post<{ data: Badge }>("/admin/badges", payload);
  return res.data.data;
};

export const updateAdminBadge = async (
  id: string,
  payload: UpdateBadgePayload,
): Promise<Badge> => {
  const res = await api.put<{ data: Badge }>(`/admin/badges/${id}`, payload);
  return res.data.data;
};

export const deleteAdminBadge = async (id: string): Promise<void> => {
  await api.delete(`/admin/badges/${id}`);
};

export const awardAdminBadge = async (
  payload: AwardBadgePayload,
): Promise<PlayerBadge> => {
  const res = await api.post<{ data: PlayerBadge }>(
    "/admin/badges/award",
    payload,
  );
  return res.data.data;
};

export const deleteAdminBadgeAward = async (id: string): Promise<void> => {
  await api.delete(`/admin/badges/awards/${id}`);
};

export const backfillMVPBadges = async (): Promise<{
  message: string;
  updated_players: number;
}> => {
  const res = await api.post<{ message: string; updated_players: number }>(
    "/admin/badges/backfill-mvps",
  );
  return res.data;
};

export const getAdminBadgeAwards = async (params?: {
  badge_id?: string;
  player_id?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: PlayerBadgeAward[]; total: number }> => {
  const res = await api.get<{ data: PlayerBadgeAward[]; total: number }>(
    "/admin/badges/awards",
    { params },
  );
  return res.data;
};

// ─── Team of the Week (TOTW) ──────────────────────────────────────────────────
export const getLatestTOTW = async (
  competitionId?: string,
): Promise<TeamOfTheWeek> => {
  const res = await api.get<{ data: TeamOfTheWeek }>("/totw/latest", {
    params: competitionId ? { competition_id: competitionId } : undefined,
  });
  return res.data.data;
};

export const getTOTWById = async (id: string): Promise<TeamOfTheWeek> => {
  const res = await api.get<{ data: TeamOfTheWeek }>(`/totw/${id}`);
  return res.data.data;
};

export const getTOTWArchive = async (
  competitionId?: string,
): Promise<TOTWListItem[]> => {
  const res = await api.get<{ data: TOTWListItem[] }>("/totw/archive", {
    params: competitionId ? { competition_id: competitionId } : undefined,
  });
  return res.data.data;
};

// Admin TOTW APIs
export const getAdminTOTWs = async (
  competitionId?: string,
): Promise<TOTWListItem[]> => {
  const res = await api.get<{ data: TOTWListItem[] }>("/admin/totw", {
    params: competitionId ? { competition_id: competitionId } : undefined,
  });
  return res.data.data;
};

export const getAdminTOTWById = async (id: string): Promise<TeamOfTheWeek> => {
  const res = await api.get<{ data: TeamOfTheWeek }>(`/admin/totw/${id}`);
  return res.data.data;
};

export const createAdminTOTW = async (
  payload: SaveTOTWPayload,
): Promise<TeamOfTheWeek> => {
  const res = await api.post<{ data: TeamOfTheWeek }>("/admin/totw", payload);
  return res.data.data;
};

export const updateAdminTOTW = async (
  id: string,
  payload: SaveTOTWPayload,
): Promise<TeamOfTheWeek> => {
  const res = await api.put<{ data: TeamOfTheWeek }>(
    `/admin/totw/${id}`,
    payload,
  );
  return res.data.data;
};

export const deleteAdminTOTW = async (id: string): Promise<void> => {
  await api.delete(`/admin/totw/${id}`);
};

export const publishAdminTOTW = async (
  id: string,
  is_published: boolean,
): Promise<TeamOfTheWeek> => {
  const res = await api.patch<{ data: TeamOfTheWeek }>(
    `/admin/totw/${id}/publish`,
    { is_published },
  );
  return res.data.data;
};

// ── Player of the Week fan vote ─────────────────────────────────────────────

/** The newest open or closed vote; null when there has never been one. */
export const getCurrentPOTWPoll = async (): Promise<POTWPoll | null> => {
  try {
    const res = await api.get<{ data: POTWPoll }>("/potw/current");
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
};

export const getPOTWPoll = async (pollId: string): Promise<POTWPoll> => {
  const res = await api.get<{ data: POTWPoll }>(`/potw/${pollId}`);
  return res.data.data;
};

export const getPOTWPolls = async (): Promise<POTWPollSummary[]> => {
  const res = await api.get<{ data: POTWPollSummary[] }>("/potw");
  return res.data.data || [];
};

export const voteForPOTW = async (
  pollId: string,
  playerId: string,
): Promise<POTWPoll> => {
  const res = await api.post<{ data: POTWPoll }>(`/potw/${pollId}/vote`, {
    player_id: playerId,
  });
  return res.data.data;
};

/** The edition's vote with live counts; null when the edition has no vote yet. */
export const getAdminPOTWPoll = async (
  totwId: string,
): Promise<POTWPoll | null> => {
  try {
    const res = await api.get<{ data: POTWPoll }>(`/admin/totw/${totwId}/potw`);
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
};

export const saveAdminPOTWPoll = async (
  totwId: string,
  payload: SavePOTWPollPayload,
): Promise<POTWPoll> => {
  const res = await api.put<{ data: POTWPoll }>(
    `/admin/totw/${totwId}/potw`,
    payload,
  );
  return res.data.data;
};

export const deleteAdminPOTWPoll = async (totwId: string): Promise<void> => {
  await api.delete(`/admin/totw/${totwId}/potw`);
};

export const overrideAdminPOTW = async (
  totwId: string,
  playerId: string,
): Promise<POTWPoll> => {
  const res = await api.post<{ data: POTWPoll }>(
    `/admin/totw/${totwId}/potw/override`,
    { player_id: playerId },
  );
  return res.data.data;
};

export const clearAdminPOTWOverride = async (
  totwId: string,
): Promise<POTWPoll> => {
  const res = await api.delete<{ data: POTWPoll }>(
    `/admin/totw/${totwId}/potw/override`,
  );
  return res.data.data;
};

export const getAdminPlayerDayStats = async (
  playerId: string,
  eventDayId: string,
): Promise<Record<string, string>> => {
  const res = await api.get<{ data: Record<string, string> }>(
    "/admin/totw/player-stats",
    {
      params: { player_id: playerId, event_day_id: eventDayId },
    },
  );
  return res.data.data;
};

export const saveTOTWArticle = async (
  totwId: string,
  payload: CreateNewsPayload,
): Promise<TeamOfTheWeek> => {
  const res = await api.put<{ data: TeamOfTheWeek }>(
    `/admin/totw/${totwId}/article`,
    payload,
  );
  return res.data.data;
};

export default api;
