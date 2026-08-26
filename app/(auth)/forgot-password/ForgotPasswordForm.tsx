'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { requestPasswordReset } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { Alert, Button, Input } from '@/components/ui';

/**
 * S-11 Forgot password.
 *
 * The confirmation is identical whether or not the address is registered, so this
 * screen cannot be used to discover which addresses have accounts. That is why the
 * success copy says "if that address has an account" rather than "check your inbox".
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown', 'Request failed.'));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <Alert tone="success">
          If that address has an account, a reset link is on its way. The link expires
          after an hour.
        </Alert>
        <Link href="/login" className="text-sm underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Enter your email address and we will send you a link to set a new password.
        </p>
      </div>

      {error?.code === 'rate_limited' ? (
        <Alert tone="warning" title="Too many attempts">
          Wait a minute before trying again.
        </Alert>
      ) : (
        error && <Alert tone="error">{error.message}</Alert>
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
          error={error?.fieldError('email')}
        />

        <Button type="submit" loading={pending}>
          Send reset link
        </Button>
      </form>

      <Link href="/login" className="text-sm underline">
        Back to sign in
      </Link>
    </div>
  );
}
