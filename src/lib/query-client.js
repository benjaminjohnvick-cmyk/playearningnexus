import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 1000 * 60 * 5,      // data stays fresh for 5 minutes — no redundant refetches
			gcTime: 1000 * 60 * 10,         // keep cached data in memory for 10 minutes
			refetchOnMount: false,           // don't re-fetch if data is still fresh on mount
			refetchOnReconnect: false,       // don't auto-refetch on network reconnect
		},
	},
});