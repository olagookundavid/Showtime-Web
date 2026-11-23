import api from './client';
import type {
  ArenaBracketView,
  ArenaClub,
  ArenaClubInput,
  ArenaClubProfile,
  ArenaContract,
  ArenaContractStatus,
  ArenaDivision,
  ArenaDivisionInput,
  ArenaFixturePlan,
  ArenaFixtureRequest,
  ArenaFormation,
  ArenaMatch,
  ArenaMatchDetail,
  ArenaMatchesView,
  ArenaMe,
  ArenaMyPlayerInput,
  ArenaOfferInput,
  ArenaOverview,
  ArenaPlayer,
  ArenaPlayerInput,
  ArenaPlayerProfile,
  ArenaPlayerStatsView,
  ArenaRescheduleInput,
  ArenaScope,
  ArenaResultForm,
  ArenaResultInput,
  ArenaSeason,
  ArenaSeasonInput,
  ArenaSeasonStatus,
  ArenaSheetEditor,
  ArenaSheetSave,
  ArenaStandingsView,
  ArenaTeamSheet,
} from '../types';

/** Query-string helper that drops empty values. */
const params = (p: Record<string, string | number | boolean | undefined>) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== '' && v !== false));

const get = async <T>(url: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> =>
  (await api.get<T>(url, { params: query ? params(query) : undefined })).data;
const post = async <T>(url: string, body?: unknown): Promise<T> => (await api.post<T>(url, body)).data;
const put = async <T>(url: string, body?: unknown): Promise<T> => (await api.put<T>(url, body)).data;
const del = async <T = { ok: boolean }>(url: string): Promise<T> => (await api.delete<T>(url)).data;

/**
 * Every Clubs Arena endpoint. Public reads take an optional division id; leave it
 * out for the current season's first division.
 */
export const arenaApi = {
  // ---- public ----
  scope: (divisionId?: string) => get<ArenaScope>('/arena/scope', { division_id: divisionId }),
  overview: (divisionId?: string) => get<ArenaOverview>('/arena/overview', { division_id: divisionId }),
  standings: (divisionId?: string) => get<ArenaStandingsView>('/arena/standings', { division_id: divisionId }),
  matches: (divisionId?: string, state?: 'results' | 'upcoming', clubId?: string) =>
    get<ArenaMatchesView>('/arena/matches', { division_id: divisionId, state, club_id: clubId }),
  match: (id: string) => get<ArenaMatchDetail>(`/arena/matches/${id}`),
  clubs: (divisionId?: string, q?: string) => get<ArenaClub[]>('/arena/clubs', { division_id: divisionId, q }),
  club: (slug: string) => get<ArenaClubProfile>(`/arena/clubs/${slug}`),
  playerStats: (divisionId?: string, clubId?: string, q?: string) =>
    get<ArenaPlayerStatsView>('/arena/players', { division_id: divisionId, club_id: clubId, q }),
  player: (id: string) => get<ArenaPlayerProfile>(`/arena/players/${id}`),
  bracket: (divisionId?: string) => get<ArenaBracketView>('/arena/bracket', { division_id: divisionId }),
  seasons: () => get<ArenaSeason[]>('/arena/seasons'),
  formations: () => get<ArenaFormation[]>('/arena/formations'),

  // ---- signed in ----
  me: () => get<ArenaMe>('/arena/me'),
  createMyPlayer: (body: ArenaMyPlayerInput) => post<ArenaPlayer>('/arena/me/player', body),
  updateMyPlayer: (body: ArenaMyPlayerInput) => put<ArenaPlayer>('/arena/me/player', body),
  follow: (clubId: string) => put('/arena/me/follow', { club_id: clubId }),
  unfollow: () => del('/arena/me/follow'),
  myContracts: () => get<ArenaContract[]>('/arena/me/contracts'),
  myContract: (id: string) => get<ArenaContract>(`/arena/me/contracts/${id}`),
  sign: (id: string, signature: string, consent: boolean) =>
    post<ArenaContract>(`/arena/me/contracts/${id}/sign`, { signature, consent }),
  reject: (id: string, reason: string) => post<ArenaContract>(`/arena/me/contracts/${id}/reject`, { reason }),

  // ---- club managers ----
  manageClub: (clubId?: string) =>
    get<{ club: ArenaClub; roster: ArenaPlayer[] }>('/arena/manage/club', { club_id: clubId }),
  manageContracts: (status?: ArenaContractStatus | 'open') => get<ArenaContract[]>('/arena/manage/contracts', { status }),
  manageContract: (id: string) => get<ArenaContract>(`/arena/manage/contracts/${id}`),
  makeOffer: (body: ArenaOfferInput) => post<ArenaContract>('/arena/manage/contracts', body),
  withdrawOffer: (id: string) => post<ArenaContract>(`/arena/manage/contracts/${id}/withdraw`),
  approveRelease: (id: string) => post<ArenaContract>(`/arena/manage/contracts/${id}/approve-release`),
  declineRelease: (id: string, reason: string) => post<ArenaContract>(`/arena/manage/contracts/${id}/decline-release`, { reason }),
  freeAgents: (q?: string) => get<ArenaPlayer[]>('/arena/manage/free-agents', { q }),
  searchPlayers: (q: string) => get<ArenaPlayer[]>('/arena/manage/players/search', { q }),
  manageFixtures: (clubId?: string) => get<ArenaMatch[]>('/arena/manage/fixtures', { club_id: clubId }),
  sheet: (matchId: string, clubId?: string) =>
    get<ArenaSheetEditor>(`/arena/manage/teamsheets/${matchId}`, { club_id: clubId }),
  saveSheet: async (matchId: string, body: ArenaSheetSave, clubId?: string) =>
    (await api.put<ArenaSheetEditor>(`/arena/manage/teamsheets/${matchId}`, body, { params: params({ club_id: clubId }) })).data,
  reopenSheet: async (matchId: string, clubId?: string) =>
    (await api.post<ArenaSheetEditor>(`/arena/manage/teamsheets/${matchId}/reopen`, undefined, { params: params({ club_id: clubId }) })).data,
  autoPick: async (formation: string, clubId?: string) =>
    (await api.post<ArenaTeamSheet>('/arena/manage/teamsheets/autopick', { formation }, { params: params({ club_id: clubId }) })).data,

  // ---- staff: seasons, divisions, fixtures (arena_seasons) ----
  adminSeasons: () => get<ArenaSeason[]>('/arena/admin/seasons'),
  adminSeason: (id: string) => get<ArenaSeason>(`/arena/admin/seasons/${id}`),
  createSeason: (body: ArenaSeasonInput) => post<ArenaSeason>('/arena/admin/seasons', body),
  updateSeason: (id: string, body: ArenaSeasonInput) => put<ArenaSeason>(`/arena/admin/seasons/${id}`, body),
  setSeasonStatus: (id: string, status: ArenaSeasonStatus) => post<ArenaSeason>(`/arena/admin/seasons/${id}/status`, { status }),
  setTransferWindow: (id: string, open: boolean) => post<ArenaSeason>(`/arena/admin/seasons/${id}/window`, { open }),
  createDivision: (seasonId: string, body: ArenaDivisionInput) =>
    post<ArenaDivision>(`/arena/admin/seasons/${seasonId}/divisions`, body),
  updateDivision: (id: string, body: ArenaDivisionInput) => put<ArenaDivision>(`/arena/admin/divisions/${id}`, body),
  deleteDivision: (id: string) => del(`/arena/admin/divisions/${id}`),
  setDivisionClubs: (id: string, clubIds: string[]) => put<ArenaDivision>(`/arena/admin/divisions/${id}/clubs`, { club_ids: clubIds }),
  previewFixtures: (id: string, body: ArenaFixtureRequest) => post<ArenaFixturePlan>(`/arena/admin/divisions/${id}/fixtures/preview`, body),
  generateFixtures: (id: string, body: ArenaFixtureRequest) => post<ArenaFixturePlan>(`/arena/admin/divisions/${id}/fixtures`, body),
  deleteFixtures: (id: string) => del(`/arena/admin/divisions/${id}/fixtures`),
  generatePlayoffs: (id: string) => post<ArenaMatch[]>(`/arena/admin/divisions/${id}/playoffs`),
  reschedule: (matchId: string, body: ArenaRescheduleInput) => put<ArenaMatch>(`/arena/admin/matches/${matchId}/schedule`, body),

  // ---- staff: clubs and players (arena_clubs) ----
  adminClubs: (q?: { division_id?: string; q?: string; archived?: boolean; unassigned?: boolean }) => get<ArenaClub[]>('/arena/admin/clubs', q),
  adminClub: (id: string) => get<ArenaClub>(`/arena/admin/clubs/${id}`),
  createClub: (body: ArenaClubInput) => post<ArenaClub>('/arena/admin/clubs', body),
  updateClub: (id: string, body: ArenaClubInput) => put<ArenaClub>(`/arena/admin/clubs/${id}`, body),
  archiveClub: (id: string, archived: boolean) => post<ArenaClub>(`/arena/admin/clubs/${id}/archive`, { archived }),
  deleteClub: (id: string) => del(`/arena/admin/clubs/${id}`),
  setClubManager: (id: string, email: string) => put<ArenaClub>(`/arena/admin/clubs/${id}/manager`, { email }),
  adminPlayers: (q?: { club_id?: string; q?: string; free?: boolean; limit?: number; offset?: number }) => get<ArenaPlayer[]>('/arena/admin/players', q),
  adminPlayer: (id: string) => get<ArenaPlayer>(`/arena/admin/players/${id}`),
  createPlayer: (body: ArenaPlayerInput) => post<ArenaPlayer>('/arena/admin/players', body),
  updatePlayer: (id: string, body: ArenaPlayerInput) => put<ArenaPlayer>(`/arena/admin/players/${id}`, body),
  deletePlayer: (id: string) => del(`/arena/admin/players/${id}`),
  linkPlayer: (id: string, email: string) => put<ArenaPlayer>(`/arena/admin/players/${id}/user`, { email }),
  registerPlayer: (id: string, body: { club_id: string; shirt_number?: number; squad_role?: string }) =>
    post<ArenaPlayer>(`/arena/admin/players/${id}/register`, body),
  releasePlayer: (id: string) => post<ArenaPlayer>(`/arena/admin/players/${id}/release`),

  // ---- staff: results (arena_results) ----
  resultForm: (matchId: string) => get<ArenaResultForm>(`/arena/admin/matches/${matchId}/result-form`),
  recordResult: (matchId: string, body: ArenaResultInput) => put<ArenaMatch>(`/arena/admin/matches/${matchId}/result`, body),
  clearResult: async (matchId: string) => (await api.delete<ArenaMatch>(`/arena/admin/matches/${matchId}/result`)).data,

  // ---- staff: transfers (arena_transfers) ----
  adminContracts: (status?: ArenaContractStatus | 'open') => get<ArenaContract[]>('/arena/admin/contracts', { status }),
  adminContract: (id: string) => get<ArenaContract>(`/arena/admin/contracts/${id}`),
  adminWithdrawContract: (id: string) => post<ArenaContract>(`/arena/admin/contracts/${id}/withdraw`),
};
