'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { register } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { Alert, Button, Input } from '@/components/ui';

/**
 * S-10 Register.
 *
 * Registration signs the account in immediately, so it lands on the catalogue rather
 * than on a sign in form.
 */
export function RegisterForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  function update(field: keyof typeof form) {
    return (event: { target: { value: string } }) =>
      setForm((previous) => ({ ...previous, [field]: event.target.value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const user = await register(form);
      queryClient.setQueryData(queryKeys.user.current(), user);
      router.push('/');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown', 'Registration failed.'));
      setPending(false);
    }
  }

  // A taken address is worth its own message with a route out, since the person
  // almost certainly already has an account.
  const emailTaken = error?.fieldError('email')?.toLowerCase().includes('already');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Create an account</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Browsing needs no account. One is needed to save a wishlist, join a
          discussion, or sell.
        </p>
      </div>

      {emailTaken && (
        <Alert tone="warning" title="That address already has an account">
          <Link href="/login" className="underline">
            Sign in instead
          </Link>
        </Alert>
      )}

      {error && !error.isValidationError && (
        <Alert tone="error">{error.message}</Alert>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Name"
          name="name"
          autoComplete="name"
          required
          value={form.name}
          onChange={update('name')}
          error={error?.fieldError('name')}
        />

        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update('email')}
          error={emailTaken ? undefined : error?.fieldError('email')}
        />

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={update('password')}
          error={error?.fieldError('password')}
        />

        <Input
          label="Confirm password"
          type="password"
          name="password_confirmation"
          autoComplete="new-password"
          required
          value={form.password_confirmation}
          onChange={update('password_confirmation')}
        />

        <Button type="submit" loading={pending}>
          Create account
        </Button>
      </form>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{' '}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
