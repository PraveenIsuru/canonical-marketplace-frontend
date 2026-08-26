import { Alert } from '@/components/ui';

/**
 * X-02 Keyword fallback notice.
 *
 * Rendered when, and only when, the response body says `mode` is `keyword`.
 *
 * There is no other trigger and there must never be one. The frontend does not infer a
 * fallback from an empty result set, from a slow response, or from anything else: the
 * backend is the single authority on which path served a query, and a client that
 * guessed would eventually disagree with the server about what a visitor was shown.
 *
 * The fallback is never silent. A buyer seeing worse results than usual deserves to
 * know the reason is a temporary outage rather than their own phrasing.
 */
export function KeywordFallbackNotice() {
  return (
    <Alert tone="warning" title="Showing keyword results">
      Smart search is temporarily unavailable, so these results come from a plain
      keyword match. Short, specific words work better than a full sentence while this
      lasts.
    </Alert>
  );
}
