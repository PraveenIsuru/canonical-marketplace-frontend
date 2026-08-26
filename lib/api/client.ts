/**
 * The single fetch wrapper.
 *
 * Every call to the Laravel API goes through here. It attaches headers, unwraps the
 * `data` envelope, and normalises errors into typed exceptions so that callers branch
 * on a code rather than sniffing a message.
 *
 * There is no mock mode and no fixture fallback. If the API is not running, the call
 * fails, which is the correct signal.
 *
 * See development-docs/shared/api-contract.md, sections 1, 7 and 8.
 */

import type { ApiErrorBody } from '@/types/api';

/** Thrown for every non-2xx response that is not AI unavailability. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the body carried field level validation errors. */
  get isValidationError(): boolean {
    return this.code === 'validation_failed';
  }

  /** The first message for a field, for rendering under an input. */
  fieldError(field: string): string | undefined {
    return this.errors?.[field]?.[0];
  }
}

/**
 * AI provider unavailability is a first class outcome, not a generic failure.
 *
 * The work has been queued and the submission is not lost. The interface shows the
 * queued job panel, polls the job id, and resumes the flow from the result.
 *
 * Buyer search never throws this. It falls back to keyword results instead.
 */
export class AiUnavailableError extends ApiError {
  constructor(
    readonly queuedJobId: string | null,
    message = 'The AI service is taking longer than usual. Your submission has been saved.',
  ) {
    super(503, 'ai_unavailable', message);
    this.name = 'AiUnavailableError';
  }
}

/** Thrown when the API could not be reached at all, as opposed to answering with an error. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Could not reach the API. Check that the backend is running.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

function browserBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_API_URL is not set. Copy .env.example to .env.local.');
  }
  return url.replace(/\/$/, '');
}

function serverBaseUrl(): string {
  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error('API_URL is not set. Copy .env.example to .env.local.');
  }
  return url.replace(/\/$/, '');
}

/** Turns a failed response into the right typed exception. */
async function toError(response: Response): Promise<ApiError> {
  const body: Partial<ApiErrorBody> = await response.json().catch(() => ({}));

  if (body.code === 'ai_unavailable') {
    return new AiUnavailableError(body.queued_job_id ?? null, body.message);
  }

  return new ApiError(
    response.status,
    body.code ?? 'unknown',
    body.message ?? 'The request failed.',
    body.errors,
  );
}

/** True for responses that carry no body at all. */
function isEmpty(response: Response): boolean {
  return response.status === 204 || response.headers.get('content-length') === '0';
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Plain objects are JSON encoded. FormData is passed through untouched. */
  body?: unknown;
  /** Query parameters. Undefined and null values are dropped rather than sent as "undefined". */
  query?: Record<string, string | number | boolean | null | undefined>;
}

function buildUrl(base: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function buildInit(options: RequestOptions): RequestInit {
  // `query` is consumed by buildUrl, so it must not reach fetch as an init option.
  const { body, query, headers, ...rest } = options;
  void query;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  return {
    ...rest,
    headers: {
      Accept: 'application/json',
      // Setting Content-Type on FormData would strip the multipart boundary.
      ...(isFormData || body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined
      ? {}
      : { body: isFormData ? (body as FormData) : JSON.stringify(body) }),
  };
}

/**
 * Browser side fetch. Sends the session cookie so Sanctum can authenticate.
 *
 * Returns the unwrapped `data` payload, so no caller reaches through the envelope.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildUrl(browserBaseUrl(), path, options.query), {
      ...buildInit(options),
      credentials: 'include',
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (!response.ok) {
    throw await toError(response);
  }

  if (isEmpty(response)) {
    return undefined as T;
  }

  const payload = await response.json();
  return unwrap<T>(payload);
}

/**
 * Server side fetch, for server components and route handlers.
 *
 * Server components cannot use `credentials: 'include'`, so the token is passed
 * explicitly by the caller, which reads it from the httpOnly cookie.
 */
export async function apiFetchServer<T>(
  path: string,
  options: RequestOptions & { token?: string | null } = {},
): Promise<T> {
  const { token, ...rest } = options;
  let response: Response;

  try {
    response = await fetch(buildUrl(serverBaseUrl(), path, rest.query), {
      ...buildInit(rest),
      headers: {
        ...buildInit(rest).headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (!response.ok) {
    throw await toError(response);
  }

  if (isEmpty(response)) {
    return undefined as T;
  }

  const payload = await response.json();
  return unwrap<T>(payload);
}

/**
 * Unwraps the success envelope.
 *
 * List endpoints return `data` alongside `links` and `meta`, and search additionally
 * returns `mode`. Those responses are returned whole, because the caller needs the
 * pagination and the mode. Everything else is unwrapped to its `data` payload.
 */
function unwrap<T>(payload: unknown): T {
  if (payload !== null && typeof payload === 'object' && 'data' in payload) {
    const keys = Object.keys(payload);
    const isEnvelopeOnly = keys.length === 1;
    return (isEnvelopeOnly ? (payload as { data: T }).data : payload) as T;
  }

  return payload as T;
}
