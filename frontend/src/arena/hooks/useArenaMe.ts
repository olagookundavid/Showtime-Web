import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts';
import { arenaApi } from '../../services';

export const arenaKeys = {
  me: ['arena', 'me'] as const,
};

/** The signed-in user's Arena profile: their player, the club they manage, and what is waiting on them. */
export const useArenaMe = () => {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: arenaKeys.me,
    queryFn: arenaApi.me,
    enabled: isAuthenticated,
    staleTime: 15_000,
  });
};
