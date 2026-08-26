/**
 * Auth and account calls (EP-01 to EP-07, EP-55).
 *
 * Login and logout do not go to Laravel directly. They go to this application's own
 * route handlers, which put the token into an httpOnly cookie so client JavaScript
 * never touches it. Everything else talks to the API.
 */

import { apiFetch, ApiError } from '@/lib/api/client';
import { sessionUserSchema } from '@/lib/schemas/common';
import type { SessionUser } from '@/types/store';

export interface Credentials {
  email: string;
  password: string;
}

export interface RegistrationDetails extends Credentials {
  name: string;
  password_confirmation: string;
}

/** EP-02, through the local route handler that writes the cookie. */
export async function login(credentials: Credentials): Promise<SessionUser> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, body.code ?? 'unknown', body.message ?? 'Sign in failed.', body.errors);
  }

  return sessionUserSchema.parse(body.data);
}

/** EP-03, through the local route handler that clears the cookie. */
export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

/**
 * EP-01. Registration returns a token, so the account is signed in immediately.
 *
 * It goes through the local route handler for the same reason login does: the token
 * must land in the httpOnly cookie rather than in JavaScript.
 */
export async function register(details: RegistrationDetails): Promise<SessionUser> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, body.code ?? 'unknown', body.message ?? 'Registration failed.', body.errors);
  }

  return sessionUserSchema.parse(body.data);
}

/** EP-05. The response is identical whether or not the address is registered. */
export function requestPasswordReset(email: string): Promise<{ message: string }> {
  return apiFetch('/api/password/forgot', { method: 'POST', body: { email } });
}

export interface ResetDetails {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

/** EP-06. */
export function resetPassword(details: ResetDetails): Promise<{ message: string }> {
  return apiFetch('/api/password/reset', { method: 'POST', body: details });
}

/** EP-55. */
export function resendVerificationEmail(): Promise<{ message: string }> {
  return apiFetch('/api/email/verification-notification', { method: 'POST' });
}

/** EP-07. Coordinates are validated server side against plausible bounds. */
export async function updateLocation(latitude: number, longitude: number): Promise<SessionUser> {
  const data = await apiFetch<unknown>('/api/user/location', {
    method: 'PATCH',
    body: { latitude, longitude },
  });

  return sessionUserSchema.parse(data);
}
