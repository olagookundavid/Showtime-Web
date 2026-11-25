import { useQuery } from '@tanstack/react-query';
import { arenaApi } from '../../services';
import { useArenaScope } from '../scope';

/**
 * The public pages all show "the chosen division". Each hook waits for the
 * scope to resolve first, so the first request already names the right division.
 */
const useDivisionQuery = <T>(key: string, fetcher: (divisionId?: string) => Promise<T>, extra: unknown[] = []) => {
  const { divisionId, isLoading, season } = useArenaScope();
  return useQuery({
    queryKey: ['arena', key, divisionId, ...extra],
    queryFn: () => fetcher(divisionId || undefined),
    // With no season there is nothing to ask for.
    enabled: !isLoading && Boolean(season),
  });
};

export const useOverview = () => useDivisionQuery('overview', arenaApi.overview);
export const useStandings = () => useDivisionQuery('standings', arenaApi.standings);
export const useBracket = () => useDivisionQuery('bracket', arenaApi.bracket);
export const useMatches = (state?: 'results' | 'upcoming') =>
  useDivisionQuery('matches', (d) => arenaApi.matches(d, state), [state ?? 'all']);
export const useDivisionClubs = () => useDivisionQuery('clubs', (d) => arenaApi.clubs(d));
export const usePlayerStats = (clubId?: string, q?: string) =>
  useDivisionQuery('players', (d) => arenaApi.playerStats(d, clubId, q), [clubId ?? '', q ?? '']);

export const useFormations = () =>
  useQuery({ queryKey: ['arena', 'formations'], queryFn: arenaApi.formations, staleTime: Infinity });
