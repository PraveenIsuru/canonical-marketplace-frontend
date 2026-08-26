import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
  // Authenticated surfaces carry no public value and are kept out of the index.
  robots: { index: false, follow: false },
};

/** S-09 Login. */
export default function LoginPage() {
  return (
    // useSearchParams needs a Suspense boundary to avoid opting the route into
    // client side bailout during prerender.
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
