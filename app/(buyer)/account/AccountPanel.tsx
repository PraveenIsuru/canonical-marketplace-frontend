'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateLocation } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/useSession';
import { hasSavedLocation, isEmailVerified } from '@/lib/auth/guards';
import { queryKeys } from '@/lib/query/keys';
import { LocationPrompt } from '@/components/seller/LocationPrompt';
import { Alert, Card, Skeleton } from '@/components/ui';
import type { Coordinates } from '@/types/api';

/**
 * S-16 Account.
 *
 * Profile summary plus the saved location used for nearby availability alerts.
 *
 * There is no notification list here. Alerts are email only, so there is nothing in
 * app to show.
 */
export function AccountPanel() {
  const { session, isLoading } = useSession();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: ({ lat, lng }: Coordinates) => updateLocation(lat, lng),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.user.current(), user);
      setSaved(true);
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!session) {
    // The proxy redirects before this renders, so reaching here means the session
    // expired mid visit rather than that the visitor was never signed in.
    return (
      <Alert tone="warning" title="Your session has ended">
        <Link href="/login?next=/account" className="underline">
          Sign in again
        </Link>
      </Alert>
    );
  }

  const error = save.error instanceof ApiError ? save.error : null;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Your account</h1>

      <Card className="flex flex-col gap-2">
        <h2 className="font-medium">Profile</h2>
        <dl className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-zinc-500 dark:text-zinc-400">Name</dt>
          <dd>{session.name}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
          <dd>{session.email}</dd>
        </dl>

        {!isEmailVerified(session) && (
          <Alert tone="warning" className="mt-2">
            Your email is not verified yet.{' '}
            <Link href="/verify-email" className="underline">
              Verify it
            </Link>{' '}
            to join product discussions.
          </Alert>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-medium">Your location</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {hasSavedLocation(session)
              ? 'Saved. Sellers are sorted by distance from here, and you will be emailed when a wishlist item is listed nearby.'
              : /*
                 * Not an error. A user with no location simply receives no proximity
                 * alerts, which is correct rather than a failure.
                 */
                'No location saved. Add one to be emailed when a wishlist item is listed near you.'}
          </p>
        </div>

        {hasSavedLocation(session) && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Currently {session.latitude?.toFixed(4)}, {session.longitude?.toFixed(4)}
          </p>
        )}

        {saved && !save.isPending && <Alert tone="success">Location saved.</Alert>}

        {error && (
          <Alert tone="error">
            {error.fieldError('latitude') ?? error.fieldError('longitude') ?? error.message}
          </Alert>
        )}

        <LocationPrompt
          pending={save.isPending}
          onResolved={(coordinates) => {
            setSaved(false);
            save.mutate(coordinates);
          }}
        />
      </Card>
    </div>
  );
}
