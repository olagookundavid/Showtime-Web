import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { arenaApi } from '../../services';
import { ArenaScopeContext, type ArenaScopeValue } from './useArenaScope';

const STORAGE_KEY = 'arena_division';

const readStored = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

/**
 * Which division the public pages are showing. The visitor's choice is
 * remembered in this browser; with no choice (or a stale one) the first
 * division of the current season is used.
 */
export const ArenaScopeProvider = ({ children }: { children: ReactNode }) => {
  const [stored, setStored] = useState(readStored);
  const { data, isLoading } = useQuery({
    queryKey: ['arena', 'scope', stored],
    queryFn: () => arenaApi.scope(stored || undefined).catch(() => arenaApi.scope()),
  });

  const setDivisionId = useCallback((id: string) => {
    setStored(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage unavailable: the choice just won't be remembered.
    }
  }, []);

  const value = useMemo<ArenaScopeValue>(
    () => ({
      season: data?.season ?? null,
      divisions: data?.divisions ?? [],
      division: data?.division ?? null,
      divisionId: data?.division?.id ?? '',
      setDivisionId,
      isLoading,
    }),
    [data, isLoading, setDivisionId],
  );
  return <ArenaScopeContext.Provider value={value}>{children}</ArenaScopeContext.Provider>;
};
