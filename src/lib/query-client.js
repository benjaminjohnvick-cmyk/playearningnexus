import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 0,
			staleTime: 1000 * 60 * 10,      // data stays fresh for 10 minutes — less refetch pressure
			gcTime: 1000 * 60 * 30,         // keep cached data in memory for 30 minutes
			refetchOnMount: false,           // don't re-fetch if data is still fresh on mount
			refetchOnReconnect: false,       // don't auto-refetch on network reconnect
		},
	},
});