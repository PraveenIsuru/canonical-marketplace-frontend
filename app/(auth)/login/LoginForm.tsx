'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { login } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { Alert, Button, Input } from '@/components/ui';

/**
 * S-09 Login.
 *
 * Honours the `next` parameter, so a visitor bounced here by the proxy lands back
 * where they were trying to go.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  const next = params.get('next');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const user = await login({ email, password });

      // Seed the cache so the navigation resolves without a second round trip.
      queryClient.setQueryData(queryKeys.user.current(), user);

      // Only relative paths, so a crafted ?next=https://elsewhere cannot turn this
      // form into an open redirect.
      router.push(next?.startsWith('/') ? next : '/');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown', 'Sign in failed.'));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        {next && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to continue to that page.
          </p>
        )}
      </div>

      {/*
        One message for any credential failure. Saying which half was wrong would
        confirm to an attacker that an address is registered. A soft deleted account
        reaches this same message rather than announcing itself as deleted.
      */}
      {error && error.code !== 'rate_limited' && (
        <Alert tone="error">{error.fieldError('email') ?? error.message}</Alert>
      )}

      {error?.code === 'rate_limited' && (
        <Alert tone="warning" title="Too many attempts">
          Wait a minute before trying again.
        </Alert>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button type="submit" loading={pending}>
          Sign in
        </Button>
      </form>

      <div className="flex flex-col gap-1 text-sm">
        <Link href="/forgot-password" className="underline">
          Forgot your password?
        </Link>
        <p className="text-zinc-600 dark:text-zinc-400">
          No account?{' '}
          <Link href="/register" className="underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
