/**
 * Login, and the only place the Sanctum token is ever written.
 *
 * The browser posts credentials here rather than to Laravel directly, so the token
 * comes back to the server, goes straight into an httpOnly cookie, and is never
 * exposed to client JavaScript.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiFetchServer, ApiError } from '@/lib/api/client';
import { AUTH_COOKIE } from '@/lib/auth/session';
import type { SessionUser } from '@/types/store';

interface LoginResponse {
  token: string;
  user: SessionUser;
}

/** Thirty days, matching a reasonable "remember me" window. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(request: NextRequest) {
  const credentials = await request.json().catch(() => null);

  if (!credentials?.email || !credentials?.password) {
    return NextResponse.json(
      { code: 'validation_failed', message: 'Email and password are required.' },
      { status: 422 },
    );
  }

  try {
    const { token, user } = await apiFetchServer<LoginResponse>('/api/login', {
      method: 'POST',
      body: credentials,
      cache: 'no-store',
    });

    const response = NextResponse.json({ data: user });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });

    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      // Pass the code through unchanged. The login screen shows one message that does
      // not reveal which field was wrong, and a soft deleted account is reported as
      // invalid credentials rather than as a deleted account.
      return NextResponse.json(
        { code: error.code, message: error.message, errors: error.errors },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { code: 'unknown', message: 'Could not reach the API.' },
      { status: 502 },
    );
  }
}
