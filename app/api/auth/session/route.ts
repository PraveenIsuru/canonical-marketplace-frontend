/**
 * Session lookup for the client side navigation.
 *
 * This exists so the root layout does not have to read cookies. Reading them in the
 * layout would make every route dynamic, including the public catalogue, which must
 * stay statically generated and must never resolve a session.
 *
 * The token stays server side. Only the resolved user crosses back.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();

  // Never cached, and never stored in a shared cache: this is per visitor.
  return NextResponse.json(
    { data: session },
    { headers: { 'Cache-Control': 'no-store, private' } },
  );
}
