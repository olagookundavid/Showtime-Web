import { createContext, useContext } from 'react';
import type { ArenaDivision, ArenaSeason } from '../../types';

export interface ArenaScopeValue {
  /** The season being shown (the live one, or the latest). */
  season: ArenaSeason | null;
  divisions: ArenaDivision[];
  /** The division being shown. Empty until the first load, or when there are none. */
  division: ArenaDivision | null;
  /** The id to send to the API: the visitor's choice, or empty for the default. */
  divisionId: string;
  setDivisionId: (id: string) => void;
  isLoading: boolean;
}

export const ArenaScopeContext = createContext<ArenaScopeValue | undefined>(undefined);


export const useArenaScope = (): ArenaScopeValue => {
  const ctx = useContext(ArenaScopeContext);
  if (!ctx) throw new Error('useArenaScope must be used within ArenaScopeProvider');
  return ctx;
};
