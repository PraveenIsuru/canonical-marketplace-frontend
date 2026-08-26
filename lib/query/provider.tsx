'use client';

/**
 * TanStack Query provider.
 *
 * The client is created inside state rather than at module scope, so that a server
 * render never shares a cache between two different visitors.
 */

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Each screen sets its own staleTime from lib/query/keys.ts. This is the floor.
        staleTime: 30 * 1000,
        refetchOnWindowFocus: true,
        retry(failureCount, error) {
          // Retrying a 4xx just repeats a request the server already rejected.
          // A queued AI job is recovered by polling the job, not by retrying the call.
          if (error instanceof ApiError) {
            if (error.code === 'ai_unavailable') return false;
            if (error.status >= 400 && error.status < 500) return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
