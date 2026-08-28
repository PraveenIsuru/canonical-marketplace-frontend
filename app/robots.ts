import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { PROTECTED_PREFIXES } from '@/proxy';

/**
 * The site wide indexing rules from section 6.2 of the build plan.
 *
 * Every page already carries its own `robots` metadata, so why both. Because the two
 * do different jobs and only one of them works before a page is fetched. A `noindex`
 * tag is a rule a crawler reads **after** requesting the page, so it stops the page
 * ranking but not the request. A disallow here stops the request being made at all.
 *
 * For the authenticated groups that distinction is the point. Those routes redirect to
 * `/login?next=…` for anybody without a session, so a crawler that follows a stray link
 * into `/dashboard` learns nothing and costs a redirect anyway. There is no reason to
 * let it happen thousands of times.
 *
 * `/search` is the interesting exception and is deliberately **not** disallowed. Its
 * pages carry `index: false, follow: true`, which means "do not rank this, but do walk
 * the product links on it". Disallowing it would stop the crawler reading the page and
 * so stop it following those links, which is the opposite of what is wanted: search
 * results are a route through to product pages, they are just not a destination
 * themselves. **A rule that blocks a crawl is not a stronger version of a rule that
 * blocks an index**, and treating it as one is how sites accidentally hide half their
 * catalogue.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          /*
           * The authenticated groups, read from the same list the redirect uses, so a
           * route added to one is covered by the other.
           *
           * Each prefix becomes **two** rules, and the shape of them matters more than
           * it looks. A robots.txt rule matches by prefix and nothing else, so a bare
           * `Disallow: /store` also blocks `/stores/1`, which is one of the three
           * routes section 6.2 requires to be indexed. The bare form would quietly
           * hide every store page on the platform from search, and the only sign of it
           * would be traffic that never arrived.
           *
           * `/store$` anchors the exact path and `/store/` covers everything beneath
           * it, which is precisely the "exact match or followed by a slash" rule the
           * proxy applies. `$` and `*` are part of the robots.txt standard in RFC 9309
           * and are understood by the crawlers that matter.
           *
           * The same trap catches `/verify` against `/verify-email`, a public auth
           * screen, which is why the proxy has a note about it too.
           */
          ...PROTECTED_PREFIXES.flatMap((prefix) => [`${prefix}$`, `${prefix}/`]),
          // The auth screens. Not secret, and not worth a crawl budget either.
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/verify-email',
          // The route handlers. Machine endpoints, one of which is the revalidation
          // webhook, and none of which is a page.
          '/api/',
        ],
      },
    ],
    host: SITE_URL,
  };
}
