import { useQuery } from '@tanstack/react-query';
import { arenaApi } from '../../../services';
import type { ArenaClub, ArenaPlatform, ArenaPlayer } from '../../../types';

const NO_CLUBS: ArenaClub[] = [];

/** Active clubs, for the "which club" dropdowns. */
export const useClubOptions = () => {
  const { data } = useQuery({ queryKey: ['arena', 'admin', 'club-options'], queryFn: () => arenaApi.adminClubs(), staleTime: 30_000 });
  return data ?? NO_CLUBS;
};

/** A shirt number field value ("" or 1 to 99) as the number the API wants, or undefined. */
export const shirtValue = (raw: string): number | undefined => (raw ? Number(raw) : undefined);

export const shirtError = (raw: string): string => (raw && (Number(raw) < 1 || Number(raw) > 99) ? 'Shirt numbers run from 1 to 99.' : '');

export interface PlayerDetailsState {
  gamertag: string;
  eaId: string;
  platform: ArenaPlatform;
  position: string;
}

export const emptyPlayerDetails = (player?: ArenaPlayer): PlayerDetailsState => ({
  gamertag: player?.gamertag ?? '',
  eaId: player?.ea_id ?? '',
  platform: player?.platform ?? 'PS',
  position: player?.primary_position ?? '',
});

export const playerDetailsErrors = (d: PlayerDetailsState) => ({
  gamertag: d.gamertag.trim().length < 2 || d.gamertag.trim().length > 32 ? 'A gamertag needs 2 to 32 characters.' : '',
  position: d.position ? '' : 'Choose the position they usually play.',
});

