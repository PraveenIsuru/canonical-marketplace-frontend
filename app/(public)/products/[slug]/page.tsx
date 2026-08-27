import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, getProducts, getSellers, getSummary, getVariants } from '@/lib/api/catalogue';
import { ProductImage } from '@/components/product/ProductImage';
import { ProductInteractive } from '@/components/product/ProductInteractive';
import { Card } from '@/components/ui';

/**
 * S-04 Canonical product page.
 *
 * The most important screen in the system, and the one that has to be indexable. The
 * shell below, meaning the name, images, specifications, and summary, is prerendered
 * and revalidated on demand when the backend creates a version. Only the seller
 * segment and the variant selector are interactive.
 */
export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) return { title: 'Product not found' };

  return {
    title: `${product.name} | Prices and sellers near you`,
    description: product.description?.slice(0, 155) ?? undefined,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.images.slice(0, 1).map((image) => ({ url: image.url })),
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;

  const product = await getProduct(slug);

  // A mistyped slug is not a system failure, so it renders the scoped not found
  // boundary rather than the error boundary.
  if (!product) notFound();

  const [variants, summary, sellers] = await Promise.all([
    getVariants(slug),
    getSummary(slug),
    // The initial list, so the page is useful before JavaScript runs and to a crawler.
    // Unsorted by distance, because the server does not know where the visitor is.
    getSellers(slug),
  ]);

  const primary = product.images[0] ?? null;
  const specifications = Object.entries(product.specifications);

  return (
    <article className="flex flex-col gap-10">
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/products" className="underline">
          Catalogue
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="underline">
          {product.category}
        </Link>
      </nav>

      <header className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <ProductImage
            url={primary?.url ?? null}
            alt={product.name}
            className="aspect-square w-full"
            sizes="(max-width: 640px) 100vw, 50vw"
            priority
          />

          {product.images.length > 1 && (
            <ul className="grid grid-cols-4 gap-2">
              {/* Up to eight per product. The first is eager, the rest lazy. */}
              {product.images.slice(1, 8).map((image) => (
                <li key={image.id}>
                  <ProductImage url={image.url} alt="" className="aspect-square w-full" sizes="25vw" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{product.category}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>

          {product.description && (
            <p className="text-zinc-600 dark:text-zinc-400">{product.description}</p>
          )}

          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {product.seller_count === 0
              ? 'No sellers carry this product yet'
              : `Carried by ${product.seller_count} ${product.seller_count === 1 ? 'seller' : 'sellers'}`}
          </p>
        </div>
      </header>

      {specifications.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Specifications</h2>
          <Card>
            <dl className="grid gap-2 sm:grid-cols-2">
              {specifications.map(([key, value]) => (
                <div key={key} className="flex gap-2 text-sm">
                  <dt className="w-32 shrink-0 text-zinc-500 dark:text-zinc-400">{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>
      )}

      {/*
        Omitted entirely when the endpoint returns null. Rendering an empty panel would
        look like a section that failed to load.
      */}
      {/*
        The discussion, live as of M9. Linked whether or not a summary exists: a product
        nobody has written about yet is exactly where an owner might be first, and the
        summary is only generated once there are a few posts to describe.
      */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">What owners say</h2>
        {summary && (
          <Card>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{summary.summary}</p>
          </Card>
        )}
        <p className="text-sm">
          <Link href={`/products/${product.slug}/community`} className="underline">
            {summary ? 'Read the discussion' : 'See what owners are saying'}
          </Link>
          <span className="text-zinc-500 dark:text-zinc-400">
            {' '}
            Everyone posting has proved they own it.
          </span>
        </p>
      </section>

      <ProductInteractive product={product} variants={variants} initialSellers={sellers.data} />

      <StructuredData product={product} sellers={sellers.data} />
    </article>
  );
}

/**
 * Product schema for search engines.
 *
 * The offers block is omitted where no seller is attached. Such products stay visible,
 * and emitting an empty aggregate would misrepresent availability to a crawler.
 */
function StructuredData({
  product,
  sellers,
}: {
  product: Awaited<ReturnType<typeof getProduct>> & object;
  sellers: Awaited<ReturnType<typeof getSellers>>['data'];
}) {
  const prices = sellers.map((listing) => listing.price_minor);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? undefined,
    image: product.images.map((image) => image.url),
    offers:
      prices.length > 0
        ? {
            '@type': 'AggregateOffer',
            offerCount: sellers.length,
            lowPrice: Math.min(...prices) / 100,
            highPrice: Math.max(...prices) / 100,
            priceCurrency: sellers[0]?.currency,
          }
        : undefined,
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
  );
}

/**
 * Prerenders the catalogue at build time so product pages are genuinely static.
 *
 * The plan requires this page to be static with on demand revalidation, which the
 * backend triggers through the revalidation webhook when a version is created.
 * Without a param list Next can only render it on first request.
 *
 * Returning an empty list on failure is deliberate. A build should not break because
 * the API happened to be down; the pages simply render on demand instead, and
 * dynamicParams keeps slugs added after the build reachable either way.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const { data } = await getProducts({ perPage: 100 });

    return data.map((product) => ({ slug: product.slug }));
  } catch {
    return [];
  }
}
