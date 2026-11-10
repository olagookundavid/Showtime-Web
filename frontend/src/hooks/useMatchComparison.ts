import { useQuery } from '@tanstack/react-query';
import { getMatchPlays, getPublicMatchStats } from '../services';
import { computeTeamComparison } from '../utils';
import type { SceneData } from '../types';

const isFemaleGender = (gender?: string) => {
  const g = (gender || '').toLowerCase().trim();
  return g === 'female' || g === 'f';
};

/**
 * Head-to-head team totals for the broadcast's attack and defence scenes, from
 * the same public stats and play log as the match page, through the same
 * calculation, refreshed every 10 seconds while a stats scene is on air.
 */
export function useMatchComparison(matchId: string, data: SceneData | undefined, active: boolean) {
  const enabled = active && !!matchId;
  const { data: stats } = useQuery({
    queryKey: ['publicMatchStatsCompare', matchId],
    queryFn: () => getPublicMatchStats(matchId),
    enabled,
    refetchInterval: enabled ? 10000 : false,
  });
  const { data: plays } = useQuery({
    queryKey: ['publicMatchPlays', matchId],
    queryFn: () => getMatchPlays(matchId),
    enabled,
    refetchInterval: enabled ? 10000 : false,
  });

  if (!data || !stats || !plays) return null;

  const women = {
    home: new Set(data.home.players.filter((p) => isFemaleGender(p.gender)).map((p) => p.id)),
    away: new Set(data.away.players.filter((p) => isFemaleGender(p.gender)).map((p) => p.id)),
  };
  return computeTeamComparison({
    playerStats: stats.derived || stats.current || [],
    plays,
    homeTeamId: data.home.id,
    awayTeamId: data.away.id,
    isFemale: (side, playerId) => women[side].has(playerId),
  });
}
