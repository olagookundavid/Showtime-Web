import api from './client';
import type {
  PaginatedResponse,
  Competition,
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
  CupState,
} from "../types";

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

export const getTeams = async (
  page: number = 1,
  limit: number = 20,
): Promise<PaginatedResponse<Team>> => {
  const response = await api.get<PaginatedResponse<Team>>(
    `/matches/teams?page=${page}&limit=${limit}`,
  );
  return response.data;
};

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
