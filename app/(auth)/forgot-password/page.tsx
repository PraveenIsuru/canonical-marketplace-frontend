import type { Metadata } from 'next';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
};

/** S-11 Forgot password. */
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
