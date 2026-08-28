import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/lib/query/provider';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { SITE_URL } from '@/lib/site';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

/**
 * The origin every relative URL in metadata is resolved against.
 *
 * Product pages have emitted `alternates.canonical` and Open Graph images since M2, and
 * both are written as paths. Without this Next resolves them against localhost, so a
 * deployed page would publish a canonical URL pointing at the machine that built it,
 * which is worse than emitting none at all: a crawler is being told, in the one tag
 * whose entire job is to say where a page really lives, that it lives somewhere
 * unreachable.
 *
 * Added at M12, when the SEO work made those tags matter.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
          {/*
            Skip link, added at M12.

            Every page puts the navigation before its content, so somebody using a
            keyboard or a screen reader has to walk past the same handful of links on
            every single page before reaching anything specific to where they are. This
            is the standard way out of that, and it is the first thing in the tab order
            so it is reachable before the links it exists to skip.

            Visually hidden until focused rather than hidden outright: `hidden` or
            `display: none` would take it out of the tab order and defeat the purpose.
          */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white dark:focus:bg-zinc-100 dark:focus:text-zinc-900"
          >
            Skip to content
          </a>

          <Navigation />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>
          <Footer />
        </QueryProvider>
      </body>
    </html>
  );
}
