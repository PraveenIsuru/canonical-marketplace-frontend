import type { Metadata } from 'next';
import { ProductWizard } from './ProductWizard';

export const metadata: Metadata = {
  title: 'New product',
  robots: { index: false, follow: false },
};

export default function WizardPage() {
  return <ProductWizard />;
}
