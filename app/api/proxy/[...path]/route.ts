/**
 * Authenticated API proxy.
 *
 * The Sanctum token lives in an httpOnly cookie on this application's origin. The
 * Laravel API is a different origin, so a browser `fetch` with `credentials:
 * 'include'` sends nothing useful to it, and the token can never be read by client
 * JavaScript to attach by hand. That is the whole point of httpOnly.
 *
 * So authenticated browser calls come here instead. This handler reads the cookie
 * server side, attaches the Bearer header, and forwards to Laravel. The token stays
 * out of JavaScript and out of the network tab.
 *
 * Public catalogue reads do not need this. Server components fetch them directly with
 * `apiFetchServer`, which keeps them cacheable.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from '@/lib/auth/session';

const API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/** Hop-by-hop headers must not be forwarded, and the host must be the API's own. */
const STRIPPED = new Set(['host', 'connection', 'content-length', 'accept-encoding']);

async function forward(request: NextRequest, path: string[]): Promise<NextResponse> {
  if (!API_URL) {
    return NextResponse.json(
      { code: 'misconfigured', message: 'API_URL is not set.' },
      { status: 500 },
    );
  }

  const token = await getToken();
  const target = `${API_URL}/api/${path.join('/')}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;

  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      // GET and HEAD carry no body. Everything else streams through untouched, which
      // is what lets multipart uploads reach the API intact.
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return NextResponse.json(
      { code: 'unknown', message: 'Could not reach the API.' },
      { status: 502 },
    );
  }

  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/json',
      // Per visitor and never shared. These responses are authenticated by definition.
      'Cache-Control': 'no-store, private',
    },
  });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: Context) {
  return forward(request, (await params).path);
}

export async function POST(request: NextRequest, { params }: Context) {
  return forward(request, (await params).path);
}

export async function PATCH(request: NextRequest, { params }: Context) {
  return forward(request, (await params).path);
}

export async function PUT(request: NextRequest, { params }: Context) {
  return forward(request, (await params).path);
}

export async function DELETE(request: NextRequest, { params }: Context) {
  return forward(request, (await params).path);
}
