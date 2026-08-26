/**
 * Registration (EP-01).
 *
 * Goes through a route handler for the same reason login does: registration returns a
 * token, and that token must land in the httpOnly cookie rather than in JavaScript.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiFetchServer, ApiError } from '@/lib/api/client';
import { AUTH_COOKIE } from '@/lib/auth/session';
import type { SessionUser } from '@/types/store';

interface RegisterResponse {
  token: string;
  user: SessionUser;
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(request: NextRequest) {
  const details = await request.json().catch(() => null);

  if (!details) {
    return NextResponse.json(
      { code: 'validation_failed', message: 'Registration details are required.' },
      { status: 422 },
    );
  }

  try {
    const { token, user } = await apiFetchServer<RegisterResponse>('/api/register', {
      method: 'POST',
      body: details,
      cache: 'no-store',
    });

    const response = NextResponse.json({ data: user }, { status: 201 });

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
      // Field errors pass through unchanged so the form can show them per input.
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
