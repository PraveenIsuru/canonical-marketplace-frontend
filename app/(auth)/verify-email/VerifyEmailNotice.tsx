'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { resendVerificationEmail } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/useSession';
import { Alert, Button, Skeleton } from '@/components/ui';

/**
 * S-13 Verify email notice, with resend.
 *
 * Registration succeeds even when the verification email fails to send, so this is
 * the way back for somebody whose message never arrived.
 */
export function VerifyEmailNotice() {
  const router = useRouter();
  const { session, isLoading } = useSession();

  const [sent, setSent] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  const verified = session?.email_verified_at != null;

  useEffect(() => {
    // Already verified, so this screen has nothing to say.
    if (!isLoading && verified) {
      router.replace('/account');
    }
  }, [isLoading, verified, router]);

  async function resend() {
    setPending(true);
    setError(null);

    try {
      await resendVerificationEmail();
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown', 'Could not resend.'));
    } finally {
      setPending(false);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Verify your email</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          We sent a link to {session?.email ?? 'your address'}. Open it to confirm the
          address is yours.
        </p>
      </div>

      {sent && <Alert tone="success">A new verification email is on its way.</Alert>}

      {error?.code === 'rate_limited' ? (
        <Alert tone="warning" title="Too many requests">
          Wait a minute before asking for another email.
        </Alert>
      ) : (
        error && <Alert tone="error">{error.message}</Alert>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={resend} loading={pending}>
          Resend the email
        </Button>
        <Link href="/" className="text-sm underline">
          Continue browsing
        </Link>
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        You can browse the catalogue and contact sellers without verifying. Verification
        is needed before joining a product discussion.
      </p>
    </div>
  );
}
