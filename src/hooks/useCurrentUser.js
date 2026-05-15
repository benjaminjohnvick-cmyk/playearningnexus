/**
 * useCurrentUser — single shared hook for getting the current authenticated user.
 *
 * Uses a single globally-shared React Query cache key so that no matter how many
 * components call this hook simultaneously, only ONE network request is made.
 *
 * REPLACES the pattern:
 *   const [user, setUser] = useState(null);
 *   useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);
 *
 * USAGE:
 *   import { useCurrentUser } from '@/hooks/useCurrentUser';
 *   const { user, isLoading } = useCurrentUser();
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useCurrentUser() {
  const { data: user = null, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return null;
      return base44.auth.me();
    },
    staleTime: 1000 * 60 * 20,  // 20 minutes — very aggressive caching
    gcTime: 1000 * 60 * 60,     // 1 hour in memory
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { user, isLoading };
}