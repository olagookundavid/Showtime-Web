import { useQuery } from '@tanstack/react-query';
import { arenaApi } from '../../../services';
import type { ArenaContract } from '../../../types';

/** Every manager query lives under this prefix, so one invalidation refreshes them all. */
export const MANAGE_KEY = ['arena', 'manage'] as const;

export const manageKeys = {
  club: (clubId?: string) => ['arena', 'manage', 'club', clubId ?? ''] as const,
  fixtures: (clubId?: string) => ['arena', 'manage', 'fixtures', clubId ?? ''] as const,
  contracts: ['arena', 'manage', 'contracts'] as const,
  contract: (id: string) => ['arena', 'manage', 'contract', id] as const,
  freeAgents: (q: string) => ['arena', 'manage', 'free-agents', q] as const,
  playerSearch: (q: string) => ['arena', 'manage', 'player-search', q] as const,
  sheet: (matchId: string, clubId?: string) => ['arena', 'manage', 'sheet', matchId, clubId ?? ''] as const,
};

export const NO_CONTRACTS: ArenaContract[] = [];

export const isOpenContract = (c: Pick<ArenaContract, 'status'>): boolean =>
  c.status === 'awaiting_release' || c.status === 'awaiting_player';

/** Today's date (yyyy-mm-dd) in Lagos, where every Arena date is read. */
export const lagosToday = (): string => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Lagos' }).format(new Date());

/** Whether clubs can make and sign offers right now, as the organiser has set it. */
export const useTransferWindow = () => {
  const q = useQuery({
    queryKey: ['arena', 'scope', 'window'],
    queryFn: () => arenaApi.scope(),
    staleTime: 30_000,
  });
  const season = q.data?.season ?? null;
  return {
    season,
    isLoading: q.isLoading,
    /** True only once we know the window is shut, so nothing is blocked while loading. */
    closed: season ? !season.transfer_window_open || season.status === 'completed' : false,
  };
};
