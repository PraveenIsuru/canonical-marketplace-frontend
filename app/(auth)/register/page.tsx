import type { Metadata } from 'next';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = {
  title: 'Create an account',
  robots: { index: false, follow: false },
};

/** S-10 Register. */
export default function RegisterPage() {
  return <RegisterForm />;
}
