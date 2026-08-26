import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyEmailNotice } from './VerifyEmailNotice';

export const metadata: Metadata = {
  title: 'Verify your email',
  robots: { index: false, follow: false },
};

/** S-13 Verify email notice. */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailNotice />
    </Suspense>
  );
}
