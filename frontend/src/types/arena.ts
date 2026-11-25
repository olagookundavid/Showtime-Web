// Clubs Arena (EA FC Pro Clubs tournament). These mirror the JSON the
// /api/v1/arena endpoints return; keep them in step with backend/internal/arena.

export type ArenaSeasonStatus = "setup" | "active" | "playoffs" | "completed";
export type ArenaMatchStage = "league" | "semi" | "final";
export type ArenaMatchStatus = "scheduled" | "completed" | "forfeit" | "postponed";
export type ArenaContractStatus =
  | "awaiting_release"
  | "awaiting_player"
  | "signed"
  | "rejected"
  | "release_declined"
  | "withdrawn";
export type ArenaSquadRole = "first_team" | "rotation" | "reserve";
export type ArenaPlatform = "PS" | "XBOX" | "PC";
export type ArenaSheetStatus = "draft" | "submitted";

export interface ArenaSeason {
  id: string;
  number: number;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  status: ArenaSeasonStatus;
  transfer_window_open: boolean;
  created_at: string;
  updated_at: string;
  divisions?: ArenaDivision[];
}

export interface ArenaDivision {
  id: string;
  season_id: string;
  name: string;
  description: string;
  sort_order: number;
  playoff_spots: 0 | 2 | 4;
  /** 0 = Sunday ... 6 = Saturday, in Lagos time. */
  kickoff_day: number;
  kickoff_slots: string[];
  club_ids: string[];
  club_count: number;
  /** True once a result is in: clubs can't be moved and fixtures can't be deleted. */
  locked: boolean;
}

export interface ArenaClubRef {
  id: string;
  slug: string;
  name: string;
  short: string;
  color: string;
  crest_url: string;
}

export interface ArenaClub {
  id: string;
  slug: string;
  name: string;
  short: string;
  color: string;
  crest_url: string;
  founded_year: number | null;
  manager_user_id: string | null;
  manager_name?: string;
  manager_email?: string;
  status: "active" | "archived";
  division_id?: string | null;
  division_name?: string;
  squad_size: number;
  has_played: boolean;
  created_at: string;
}

export interface ArenaPlayer {
  id: string;
  user_id: string | null;
  gamertag: string;
  ea_id: string;
  platform: ArenaPlatform;
  primary_position: string;
  avatar_url: string;
  club_id: string | null;
  club_slug?: string;
  club_name?: string;
  club_short?: string;
  club_color?: string;
  shirt_number: number | null;
  squad_role?: ArenaSquadRole | "";
  created_at: string;
}

export interface ArenaMatch {
  id: string;
  season_id: string;
  division_id: string;
  division_name?: string;
  stage: ArenaMatchStage;
  matchweek: number;
  home_club_id: string | null;
  away_club_id: string | null;
  home: ArenaClubRef | null;
  away: ArenaClubRef | null;
  kickoff_at: string | null;
  status: ArenaMatchStatus;
  home_score: number | null;
  away_score: number | null;
  penalty_winner: "home" | "away" | null;
  feeds_match_id: string | null;
  feeds_slot: "home" | "away" | null;
}

export interface ArenaStandingRow {
  rank: number;
  club: ArenaClubRef;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  /** Last five results, oldest first, e.g. "WWDLW". */
  form: string;
}

export interface ArenaPlayerSeasonStats {
  player_id: string;
  gamertag: string;
  position: string;
  club_id: string;
  club_name: string;
  club_short: string;
  club_color: string;
  shirt_number: number | null;
  avatar_url: string;
  apps: number;
  goals: number;
  assists: number;
  avg_rating: number | null;
  motms: number;
}

export interface ArenaPlayerStat {
  match_id: string;
  player_id: string;
  club_id: string;
  gamertag?: string;
  started: boolean;
  goals: number;
  assists: number;
  rating: number | null;
  motm: boolean;
}

export interface ArenaContractEvent {
  label: string;
  at: string;
}

export interface ArenaContract {
  id: string;
  season_id: string;
  player_id: string;
  player_name: string;
  club_id: string;
  club_name: string;
  club_short: string;
  club_color: string;
  from_club_id: string | null;
  from_club_name?: string;
  squad_role: ArenaSquadRole;
  end_date: string;
  fee_ngn: number;
  terms: string;
  status: ArenaContractStatus;
  signature: string;
  signed_at: string | null;
  reason: string;
  created_at: string;
  updated_at: string;
  events?: ArenaContractEvent[];
}

export interface ArenaFormation {
  name: string;
  slots: string[];
  /** [x, y] as a percentage of the pitch board. */
  coords: [number, number][];
}

export interface ArenaSheetSlot {
  index: number;
  position: string;
  player_id: string;
}

export interface ArenaTeamSheet {
  id: string;
  match_id: string;
  club_id: string;
  formation: string;
  captain_player_id: string | null;
  status: ArenaSheetStatus;
  revision: number;
  submitted_at: string | null;
  review_reason: string;
  starters: ArenaSheetSlot[];
  bench: string[];
  errors?: string[];
}

export interface ArenaSheetEditor {
  match: ArenaMatch;
  sheet: ArenaTeamSheet;
  roster: ArenaPlayer[];
  formations: ArenaFormation[];
  locked: boolean;
  lock_reason: string;
  errors: string[];
}

export interface ArenaSheetPlayer {
  index: number;
  position: string;
  player_id: string;
  gamertag: string;
  shirt_number: number | null;
}

/** A submitted team sheet with names, as shown on a match page. */
export interface ArenaSheetView {
  club_id: string;
  formation: string;
  captain_player_id: string;
  starters: ArenaSheetPlayer[];
  bench: ArenaSheetPlayer[];
}

export interface ArenaScope {
  season: ArenaSeason;
  division: ArenaDivision | null;
  divisions: ArenaDivision[];
}

export interface ArenaMetrics {
  clubs: number;
  players: number;
  matches_played: number;
  goals: number;
  goals_per_match: number;
  last_matchweek: number;
  total_matchweeks: number;
  next_matchweek: number;
}

export interface ArenaOverview {
  scope: ArenaScope;
  metrics: ArenaMetrics;
  latest: ArenaMatch[];
  upcoming: ArenaMatch[];
  standings: ArenaStandingRow[];
  top_scorers: ArenaPlayerSeasonStats[];
  champion: ArenaClubRef | null;
}

export interface ArenaStandingsView {
  scope: ArenaScope;
  rows: ArenaStandingRow[];
  playoff_spots: number;
  metrics: ArenaMetrics;
}

export interface ArenaMatchesView {
  scope: ArenaScope;
  matches: ArenaMatch[];
}

export interface ArenaMatchDetail {
  match: ArenaMatch;
  stats: ArenaPlayerStat[];
  sheets: ArenaSheetView[];
}

export interface ArenaClubProfile {
  club: ArenaClub;
  scope: ArenaScope | null;
  standing: ArenaStandingRow | null;
  recent: ArenaMatch[];
  upcoming: ArenaMatch[];
  squad: ArenaPlayerSeasonStats[];
  starting_xi: ArenaSheetView | null;
}

export interface ArenaPlayerStatsView {
  scope: ArenaScope;
  players: ArenaPlayerSeasonStats[];
}

export interface ArenaPlayerMatchLine {
  match_id: string;
  kickoff_at: string | null;
  club_id: string;
  opponent: string;
  home_away: "home" | "away";
  goals_for: number;
  goals_against: number;
  goals: number;
  assists: number;
  rating: number | null;
  motm: boolean;
}

export interface ArenaPlayerProfile {
  player: ArenaPlayer;
  season: ArenaPlayerSeasonStats | null;
  recent: ArenaPlayerMatchLine[];
}

export interface ArenaBracketView {
  scope: ArenaScope;
  semis: ArenaMatch[];
  final: ArenaMatch | null;
  champion: ArenaClubRef | null;
}

export interface ArenaMe {
  player: ArenaPlayer | null;
  managed_club: ArenaClub | null;
  followed_club_id: string;
  open_offers: number;
  pending_releases: number;
}

// ---- admin ---------------------------------------------------------------

export interface ArenaPlannedFixture {
  matchweek: number;
  home: ArenaClubRef;
  away: ArenaClubRef;
  kickoff_at: string;
}

export interface ArenaFixturePlan {
  division: ArenaDivision;
  matchweeks: number;
  fixtures: ArenaPlannedFixture[];
}

export interface ArenaResultFormRow {
  player_id: string;
  gamertag: string;
  position: string;
  shirt_number: number | null;
  included: boolean;
  started: boolean;
  goals: number;
  assists: number;
  rating: number | null;
  motm: boolean;
}

export interface ArenaResultFormSide {
  club: ArenaClubRef;
  players: ArenaResultFormRow[];
}

export interface ArenaResultForm {
  match: ArenaMatch;
  home: ArenaResultFormSide;
  away: ArenaResultFormSide;
}

// ---- request bodies ----------------------------------------------------------

export interface ArenaSeasonInput {
  number: number;
  name: string;
  starts_on: string;
  ends_on: string;
}

export interface ArenaDivisionInput {
  name: string;
  description: string;
  playoff_spots: number;
  kickoff_day: number;
  kickoff_slots: string[];
}

export interface ArenaFixtureRequest {
  first_date?: string;
  legs?: 1 | 2;
}

export interface ArenaClubInput {
  name: string;
  short: string;
  color: string;
  crest_url: string;
  founded_year: number | null;
  division_id?: string;
  manager_email?: string;
}

export interface ArenaPlayerInput {
  gamertag: string;
  ea_id: string;
  platform: ArenaPlatform;
  primary_position: string;
  avatar_url?: string;
  user_email?: string;
  club_id?: string;
  shirt_number?: number;
  squad_role?: ArenaSquadRole;
}

export interface ArenaMyPlayerInput {
  gamertag: string;
  ea_id: string;
  platform: ArenaPlatform;
  primary_position: string;
}

export interface ArenaStatLine {
  player_id: string;
  club_id: string;
  started: boolean;
  goals: number;
  assists: number;
  rating: number | null;
  motm: boolean;
}

export interface ArenaResultInput {
  home_score: number;
  away_score: number;
  penalty_winner?: "home" | "away" | "";
  forfeit_winner?: "home" | "away" | "";
  stats: ArenaStatLine[];
}

export interface ArenaOfferInput {
  player_id: string;
  squad_role: ArenaSquadRole;
  end_date: string;
  fee_ngn: number;
  terms: string;
}

export interface ArenaSheetSave {
  formation: string;
  starters: Record<string, string>;
  bench: string[];
  captain: string;
  submit: boolean;
}

export interface ArenaRescheduleInput {
  kickoff_at: string | null;
  postponed: boolean;
}
