import Link from 'next/link';
import { formatMoney } from '@/lib/format/money';
import { ProductImage } from './ProductImage';
import type { ProductSummary } from '@/lib/schemas/catalogue';

/**
 * One catalogue card.
 *
 * A product no live store carries still appears here. It shows "No sellers yet" in
 * place of a price, because such products stay visible in the catalogue rather than
 * disappearing until somebody stocks them.
 */
export function ProductCard({ product }: { product: ProductSummary }) {
  const price = formatMoney(product.lowest_price_minor, product.currency);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
    >
      <ProductImage url={product.primary_image?.url ?? null} alt={product.name} className="aspect-square w-full" />

      <div className="flex flex-1 flex-col gap-1">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{product.category}</p>
        <h3 className="font-medium leading-snug group-hover:underline">{product.name}</h3>

        <div className="mt-auto pt-1">
          {price === null ? (
            // Never a zero price. Zero would read as free rather than as unstocked.
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No sellers yet</p>
          ) : (
            <>
              <p className="font-semibold">{price}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                from {product.seller_count} {product.seller_count === 1 ? 'seller' : 'sellers'}
              </p>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
