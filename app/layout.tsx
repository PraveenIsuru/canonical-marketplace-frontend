import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/lib/query/provider';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Marketplace',
    template: '%s | Marketplace',
  },
  description:
    'One canonical record per product, with prices and contact details for every seller carrying it.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <QueryProvider>
          <Navigation />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <Footer />
        </QueryProvider>
      </body>
    </html>
  );
}
