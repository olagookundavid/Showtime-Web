import api from "./client";
import type {
  GamePlay,
  PlayPayload,
  SituationUpdate,
  BulkRecomputeResult,
  GameRules,
  GameRulesPayload,
} from "../types";

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
