import { useQuery } from '@tanstack/react-query';
import { getBroadcastScenes } from '../services/broadcastApi';

/**
 * Data for a match's full-screen scenes, fetched only while a scene is on air.
 * It is refreshed every 10 seconds, so the standings follow the live score.
 */
export function useBroadcastScenes(matchId: string, active: boolean) {
  return useQuery({
    queryKey: ['broadcastScenes', matchId],
    queryFn: () => getBroadcastScenes(matchId),
    enabled: active && !!matchId,
    refetchInterval: active ? 10000 : false,
    staleTime: 5000,
  });
}
