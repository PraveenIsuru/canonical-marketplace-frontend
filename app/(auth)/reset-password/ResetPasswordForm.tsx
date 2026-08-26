'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { resetPassword } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { Alert, Button, Input } from '@/components/ui';

/** S-12 Reset password. */
export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();

  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  // An expired token and an already used one are reported identically by the API,
  // because the difference tells the sender something about a token they should not
  // hold. The screen offers the same way forward either way.
  const tokenRejected = error?.fieldError('token') !== undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await resetPassword({
        token,
        email,
        password,
        password_confirmation: confirmation,
      });

      router.push('/login?reset=1');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown', 'Reset failed.'));
      setPending(false);
    }
  }

  if (!token || !email) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">This link is incomplete</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Open the link from your email exactly as it was sent, or request a new one.
        </p>
        <Link href="/forgot-password" className="text-sm underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Resetting your password signs you out everywhere else.
        </p>
      </div>

      {tokenRejected && (
        <Alert tone="warning" title="This link is no longer valid">
          Reset links expire, and each one works only once.{' '}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
        </Alert>
      )}

      {error && !tokenRejected && !error.isValidationError && (
        <Alert tone="error">{error.message}</Alert>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input label="Email" type="email" value={email} readOnly disabled />

        <Input
          label="New password"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={error?.fieldError('password')}
        />

        <Input
          label="Confirm new password"
          type="password"
          name="password_confirmation"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />

        <Button type="submit" loading={pending}>
          Set new password
        </Button>
      </form>
    </div>
  );
}
