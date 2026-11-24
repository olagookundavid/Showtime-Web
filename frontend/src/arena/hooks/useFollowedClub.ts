import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts';
import { arenaApi } from '../../services';
import { arenaKeys, useArenaMe } from './useArenaMe';

const STORAGE_KEY = 'arena_my_club';

const read = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

/**
 * The club someone has chosen as "my club". Visitors keep it in this browser;
 * signed-in users keep it on their account so it follows them to other devices.
 */
export const useFollowedClub = () => {
  const { isAuthenticated } = useAuth();
  const me = useArenaMe();
  const queryClient = useQueryClient();
  const [local, setLocal] = useState(read);

  const store = (id: string) => {
    setLocal(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable: the choice just won't be remembered here.
    }
  };

  const follow = useMutation({
    mutationFn: async (clubId: string) => {
      if (isAuthenticated) await arenaApi.follow(clubId);
    },
    onSuccess: (_d, clubId) => {
      store(clubId);
      queryClient.invalidateQueries({ queryKey: arenaKeys.me });
    },
  });
  const unfollow = useMutation({
    mutationFn: async () => {
      if (isAuthenticated) await arenaApi.unfollow();
    },
    onSuccess: () => {
      store('');
      queryClient.invalidateQueries({ queryKey: arenaKeys.me });
    },
  });

  const clubId = (isAuthenticated ? me.data?.followed_club_id : '') || local;
  const choose = useCallback((id: string) => follow.mutate(id), [follow]);
  const clear = useCallback(() => unfollow.mutate(), [unfollow]);
  return { clubId, choose, clear, pending: follow.isPending || unfollow.isPending };
};
