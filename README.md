# Canonical Marketplace Web Client

The Next.js interface for the canonical product marketplace. It renders the buyer
catalogue, the seller workspace, and the administrator screens.

This repository holds **no business rules**. It talks to nothing but the Laravel API at
`https://github.com/PraveenIsuru/canonical-marketplace-backend.git`, which owns every rule, every shape, and every error code. Not the database,
not Redis, not the search index. There is no mock data here either, so the API has to be
running before anything meaningful renders. See
[Connecting to the backend](#connecting-to-the-backend) below.

## What the platform does

Sellers do not create their own product pages. The catalogue holds one canonical record
per product, and a seller attaches a listing to it. Buyers browse that canonical
catalogue, compare the sellers attached to a product, see stores on a map, and follow
community discussion on a product page.

## Stack

| Part | Choice |
|---|---|
| Framework | Next.js 16, App Router |
| Language | TypeScript |
| UI | React 19 |
| Styling | Tailwind CSS v4 |
| Server state | TanStack Query |
| Validation | Zod, used to parse every API response |
| Maps | Leaflet through react-leaflet |
| Dates | date-fns |

## Requirements

- Node.js 20 or newer, and npm
- **The Laravel API running**, migrated and seeded

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in with a seeded account from the
backend, since seller and administrator screens need a real account behind them.

The defaults in `.env.example` assume the API is on `http://localhost:8000` and this
application is on `http://localhost:3000`. If either differs, edit `.env.local`:

- `NEXT_PUBLIC_API_URL` and `API_URL` both point at the running API. The first is used in
  the browser, the second on the server. They should hold the same value.
- `REVALIDATE_SECRET` must match the backend's value. See below.
- `NEXT_PUBLIC_SITE_URL` is this application's own public origin. Canonical URLs, Open
  Graph tags, and `robots.txt` are resolved against it, so a wrong value publishes wrong
  URLs to crawlers.
- `NEXT_PUBLIC_MAP_TILE_URL` is the map tile source, defaulting to OpenStreetMap.

No AI provider key belongs in this file. Every AI call originates from the Laravel
service, which keeps provider credentials out of the frontend entirely.

## Scripts

```bash
npm run dev    # development server
npm run build  # production build
npm run start  # serve the production build
npm run lint   # ESLint
```

## Connecting to the backend

Start the API first, then this application. Three pieces of wiring connect them.

**The API URL.** `API_URL` and `NEXT_PUBLIC_API_URL` point at the Laravel service. If the
API is not reachable, calls fail rather than falling back to anything, which is the
correct signal.

**Authentication.** Logging in posts credentials to the API, which returns a Sanctum
bearer token. That token is stored in an httpOnly cookie on this application's origin, so
client JavaScript never touches it.

That has one consequence worth knowing about. The API is a different origin, so a browser
`fetch` cannot attach the token by hand. Authenticated browser calls therefore go through
`app/api/proxy/[...path]/route.ts`, which reads the cookie on the server, adds the
`Bearer` header, and forwards the request. The token stays out of JavaScript and out of
the network tab. Public catalogue reads skip the proxy, since server components fetch them
from the API directly and that keeps them cacheable.

`proxy.ts` redirects anonymous visitors away from protected routes, but it is an
**optimistic check only**. It asks whether a token cookie is present and nothing more.
Real authorisation happens server side on every endpoint, so seller and administrator
eligibility is never decided here.

**Page revalidation.** `REVALIDATE_SECRET` must hold **the same value here and in the
backend's `.env`**. When a product version is created, the API calls
`app/api/revalidate/route.ts` so the affected product pages get rebuilt. The secret
arrives as the `x-revalidate-secret` header, and a mismatch is rejected with a 401, which
shows up as product pages that never refresh. The call is made from a queued job, so the
backend also needs a queue worker running for it to arrive at all.

Two API behaviours shape the interface more than the rest:

- **AI unavailability is a normal outcome, not a failure.** When the provider does not
  answer, the API queues the work and says so. The screen shows the queued job panel,
  polls the job id, and resumes the flow from the result. Nothing the user typed is lost.
- **Buyer search never blocks on AI.** It falls back to keyword results with a visible
  notice, which is why search behaves differently from every other AI backed screen.

Prices arrive as integers in the smallest currency unit. Divide by 100 for display only,
and never store or send a float.

## How the code is laid out

```
app/                      App Router, at the repository root. There is no src/ directory
  (public)/               Anonymous catalogue: products, search, stores
  (auth)/                 Login, registration, password reset, email verification
  (buyer)/                Wishlist, account, ownership verification
  (seller)/               Onboarding, wizard, listings, proposals, analytics, versions
  (admin)/                Escalations, product editing, proposal overrides, metrics
  api/                    Route handlers that run on this server, not on Laravel
components/               Presentational and interactive components, grouped by area
  ui/                     The small shared primitives
lib/
  api/                    One fetch wrapper plus a module per endpoint area
  schemas/                Zod schemas, one per response family
  auth/                   Session resolution and route guards
  jobs/                   Queued job polling and draft storage
  query/                  TanStack Query keys and provider
types/                    Shared TypeScript types
proxy.ts                  Route protection. In Next.js 16 this replaces middleware.ts
```

Route groups map to **access level**, not to visual layout, so whether a route sits behind
a login is visible from the folder it lives in.

Every API call goes through the single wrapper in [lib/api/client.ts](lib/api/client.ts).
It attaches headers, unwraps the `data` envelope, and turns errors into typed exceptions
so callers branch on a code rather than sniffing a message. Responses are then parsed with
Zod, so a shape that drifts fails loudly instead of rendering as `undefined`.

## Two Next.js 16 details

- `middleware.ts` is now `proxy.ts`, with a `proxy` export, and route `params` are
  Promises that must be awaited.
- Cache Components stays off. The revalidation webhook depends on the classic model,
  meaning `export const revalidate` and `revalidatePath()`.
