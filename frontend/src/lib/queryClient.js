import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (anciennement cacheTime)
      retry: 1, // 1 retry supplémentaire pour les queries (GET) - opérations idempotentes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0, // Pas de retry pour les mutations (POST/PUT/DELETE) - éviter les doublons
    },
  },
});

// Configuration des retries par endpoint (surcharge au niveau useQuery si nécessaire)
// - GET (queries) : retry: 1 par défaut (idempotent)
// - POST/PUT/DELETE (mutations) : retry: 0 par défaut (non idempotent)
// - Prévisions IA : retry: 0 (coûteux, pas de retry)
// - Health checks : retry: 0 (rapide, pas de retry)
