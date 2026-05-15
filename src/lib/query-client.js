import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 30000), // exponential backoff up to 30s
			staleTime: 1000 * 60 * 15,      // data stays fresh for 15 minutes
			gcTime: 1000 * 60 * 60,         // keep cached data in memory for 60 minutes
			refetchOnMount: false,           // don't re-fetch if data is still fresh on mount
			refetchOnReconnect: false,       // don't auto-refetch on network reconnect
			refetchInterval: false,          // no polling by default
		},
	},
});