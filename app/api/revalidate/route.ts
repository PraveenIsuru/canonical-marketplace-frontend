/**
 * The revalidation webhook (EP-51).
 *
 * Hosted here, called by the backend from a queued job whenever a product version is
 * created, and never at any other time. Authenticated by a shared secret header
 * rather than a bearer token, because the caller is a server, not a user.
 *
 * The seller list path is revalidated alongside the product page even though it
 * renders per request, because its static shell carries product metadata.
 */

import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    return NextResponse.json(
      { code: 'misconfigured', message: 'REVALIDATE_SECRET is not set.' },
      { status: 500 },
    );
  }

  if (request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json(
      { code: 'unauthenticated', message: 'Invalid revalidation secret.' },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : null;

  if (!slug) {
    return NextResponse.json(
      { code: 'validation_failed', message: 'A product slug is required.' },
      { status: 422 },
    );
  }

  revalidatePath(`/products/${slug}`);
  revalidatePath(`/products/${slug}/sellers`);

  return NextResponse.json({ data: { revalidated: true, slug } });
}
