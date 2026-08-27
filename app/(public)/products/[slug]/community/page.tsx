import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/api/catalogue';
import { getPosts } from '@/lib/api/community';
import { CommunityThread } from './CommunityThread';

/**
 * S-06 A product's discussion.
 *
 * **Indexable**, per the build plan's indexing rules, alongside the product page and
 * the store page. That is the whole reason the first page of posts is fetched on the
 * server rather than in the browser: a discussion among people who have each proved
 * they own the product is exactly the content worth having in an index, and a thread
 * that only exists after JavaScript runs is a thread no crawler ever sees.
 *
 * Public and session free. Reading needs no account; the value of a verified
 * discussion is to the person deciding what to buy, and putting it behind a login
 * would hide it from precisely them.
 */
export const revalidate = 30;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) return { title: 'Product not found' };

  return {
    title: `${product.name} discussion | What owners say`,
    description: `What people who own ${product.name} say about it. Only verified owners can post.`,
    alternates: { canonical: `/products/${product.slug}/community` },
  };
}

export default async function CommunityPage({ params }: Params) {
  const { slug } = await params;

  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  const initial = await getPosts(slug);

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <nav className="text-sm">
          <Link href={`/products/${product.slug}`} className="underline">
            {product.name}
          </Link>
        </nav>
        <h1 className="mt-2 text-2xl font-semibold">What owners say</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {/*
            The rule stated up front, because it is what makes this worth reading and it
            explains the verification prompt below before somebody meets it.
          */}
          Everyone posting here has proved they own {product.name} by photographing it.
          Anyone can read.
        </p>
      </div>

      <CommunityThread slug={slug} productName={product.name} initial={initial} />
    </div>
  );
}
