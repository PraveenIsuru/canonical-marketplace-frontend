'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import type { SessionUser } from '@/types/store';

/**
 * The session, resolved client side.
 *
 * Deliberately not read in a server layout. Reading cookies there would make every
 * route dynamic, including the public catalogue, which has to stay statically
 * generated and must never resolve a session.
 *
 * Cached across navigations by TanStack Query, so this costs one request per visit
 * rather than one per page.
 */
export function useSession() {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.user.current(),
    queryFn: async (): Promise<SessionUser | null> => {
      const response = await fetch('/api/auth/session');
      if (!response.ok) return null;
      const body = await response.json();
      return body.data ?? null;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return { session: data ?? null, isLoading: isPending };
}
