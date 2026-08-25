# Frontend Build Plan

**Status:** Build ready
**Applies to:** `C:\MyApps\canonical-marketplace\frontend`

---

## 1. Context

This repository is the Next.js client for the canonical product marketplace. It talks only to the Laravel API service. It holds no business rules and never talks to the database, Redis, the search engine, or any external vendor directly.

At the time this plan was written the repository was a bare `create-next-app` scaffold, four files under `app/`, no dependencies beyond Next, React, and Tailwind. The backend was an untouched Laravel starter kit with no `routes/api.php`, so **no platform endpoint existed yet**.

The platform needs 37 screens (`S-01` to `S-37`), 6 cross cutting interface elements (`X-01` to `X-06`), and consumes 61 API endpoints. Work proceeds through 13 milestones, `M0` to `M12`. `M0` is specified here file by file and needs no backend. `M1` onward are specified as milestone goals with their screen lists.

Because the backend lags, this plan includes a **fixture backed mock API inside the frontend**, toggled by an environment flag, so screens can be built and clicked through before the API exists.

---

## 2. Ground rules established by the repository

Where anything written elsewhere disagrees with the repository, the repository wins.

| Item | Reality | Consequence |
|---|---|---|
| Next.js | **16.3.2** | See section 2.1 |
| React | 19.2.8 | No change |
| Route root | `app/` at repository root, **no `src/`** | Every path in this document is relative to the repository root |
| Styling | Tailwind CSS v4 through `@tailwindcss/postcss` | Use v4 syntax, `@import "tailwindcss"` and `@theme inline` in `app/globals.css` |
| Path alias | `@/*` maps to `./*` | Import as `@/lib/api/client` |
| Agent rules | `AGENTS.md` is written and re-added by `next dev` | Commit it with the work rather than fighting the diff |

### 2.1 Next.js 16 specifics

1. **`middleware.ts` is renamed to `proxy.ts`.** Same functionality and same `config.matcher`, but the file lives at the repository root as `proxy.ts` and exports `proxy` rather than `middleware`.
2. **Route `params` and `searchParams` are Promises.** Every page and route handler must `await params`.
3. **Cache Components (`use cache`, `cacheLife`, `cacheTag`) is opt in and off by default.** Do **not** enable `cacheComponents` in `next.config.ts`. The classic model, meaning `export const revalidate`, `export const dynamic`, and `revalidatePath()`, is fully supported in Next 16 and is the simpler choice for this project.
4. Consult `node_modules/next/dist/docs/` before using any API that feels uncertain. The docs are bundled locally.

### 2.2 Invariants the interface must never break

A change that breaks one of these is wrong regardless of what it improves.

1. No control anywhere lets a seller edit a product, an attribute, or a variant directly. The only seller path into product data is a proposal.
2. No control anywhere removes a generated variant combination, not even for an administrator.
3. The AI confidence score is never rendered on any screen and never appears in a type definition.
4. A proposal is accepted or rejected as a whole. No field level accept or reject controls.
5. A pending proposal renders as a blocked state, never as an editable listing.
6. Buyer search falls back to keyword results with a **visible** notice. Every other AI path blocks and shows the queued job panel.
7. Public catalogue routes work with no token and never resolve a session.
8. Notifications are email only. **No notification bell and no in app notification centre, anywhere.**
9. Prices cross the boundary as integers in the smallest currency unit. Divide by 100 for display only.
10. No checkout, cart, payment, or order screens exist.

### 2.3 Things that are deliberately absent, do not build them

- No control to declare a matched product new.
- No verification appeal, administrator confirmation, or attempt reset.
- No rollback control on version history.
- No seller posting identity in communities. A user who runs a store posts as a verified buyer.
- No user ban control for administrators.

---

## 3. Dependencies to install

```
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install leaflet react-leaflet
npm install @types/leaflet --save-dev
npm install date-fns
npm install zod
```

Leaflet covers the two map needs, a draggable pin for manual placement and a static marker for store display. It needs `NEXT_PUBLIC_MAP_TILE_URL` and must be loaded through `next/dynamic` with `ssr: false`, since it touches `window` at import time.

`zod` catches a backend response drifting from the contract at the point of the fetch rather than three components deeper.

---

## 4. Target directory layout

```
app/
├── (public)/            S-01 to S-08   anonymous, indexable
├── (auth)/              S-09 to S-13   login, register, password, verify
├── (buyer)/             S-14 to S-16   wishlist, verification, account
├── (seller)/            S-17 to S-31   onboarding, attach, listings, proposals
├── (admin)/             S-32 to S-37   escalations, products, metrics
├── api/
│   ├── auth/login/route.ts       writes the httpOnly cookie
│   ├── auth/logout/route.ts      clears it
│   ├── revalidate/route.ts       revalidation webhook consumer
│   └── mock/[...path]/route.ts   fixture API, development only
├── layout.tsx
├── globals.css
├── not-found.tsx        S-08
└── error.tsx            S-08
components/
├── ui/                  buttons, inputs, cards, skeletons, dialogs, empty states
├── layout/              X-04 navigation, footer
├── product/             gallery, variant selector, specifications, structured data
├── seller/              seller row, filters, location prompt (X-03)
├── proposal/            change comparison, vote actions, X-05 pending notice
├── community/           post list, composer, reply thread
└── system/              X-01 queued job panel, X-02 fallback notice, X-06 login wrapper
lib/
├── api/                 client.ts plus one module per resource
├── auth/                session.ts, guards.ts
├── location/            geolocation.ts
├── query/               keys.ts, provider.tsx
├── format/              money.ts, dates.ts
└── mock/                fixtures and the handler map
types/                   product.ts, store.ts, proposal.ts, community.ts, api.ts
proxy.ts                 route protection (NOT middleware.ts)
development-docs/        this plan
```

Route groups map to **access level**, not to visual layout. That is what makes it obvious at a glance whether a new route belongs behind authentication.

---

## 5. M0 Foundations, specified

Nothing in this milestone needs the backend.

### 5.1 Configuration and environment

- `.env.local`, plus a committed `.env.example`, holding `NEXT_PUBLIC_API_URL`, `API_URL`, `REVALIDATE_SECRET`, `NEXT_PUBLIC_MAP_TILE_URL`, and `NEXT_PUBLIC_USE_MOCK_API`.
- **No AI provider key ever appears here.** All AI calls originate from the Laravel service, which keeps provider credentials out of the frontend entirely.
- `next.config.ts`: add `images.remotePatterns` for the object storage host. Leave `cacheComponents` off.

### 5.2 `lib/api/client.ts`, the fetch wrapper

- `ApiError` carries `status`, `code`, and `message`, plus an optional `errors` record for 422 responses. The error envelope is exactly `code`, `message`, and optionally `errors`. **Branch on `code`, never on `message`.**
- `AiUnavailableError extends ApiError` carrying `queuedJobId`, thrown when `code` is `ai_unavailable`. This is a first class outcome, not a generic failure, because the flow blocks and the work queues.
- Successful bodies wrap their payload in `data`. Unwrap once in the client so no caller has to.
- When `NEXT_PUBLIC_USE_MOCK_API` is true the base URL points at `/api/mock` instead of the Laravel host. Nothing else in the application knows the difference.
- Two entry points: `apiFetch` for the browser, and a server variant that reads the cookie and uses `API_URL`. Server components cannot use `credentials: 'include'`.

### 5.3 `proxy.ts`, route protection

Exports `proxy(request: NextRequest)` and a `config.matcher` that **excludes** `products`, `search`, `stores`, `_next/static`, `_next/image`, and `favicon.ico`. Public catalogue traffic is the majority of all traffic and must not pay for session resolution. Unauthenticated access to a protected path redirects to `/login?next=<pathname>`.

The proxy is an **optimistic check only**. Real authorisation happens server side on every endpoint. Do not try to make it decide seller or administrator eligibility beyond the presence of a token.

### 5.4 `lib/auth/session.ts` and `lib/auth/guards.ts`

- `getSession()` reads the `auth_token` httpOnly cookie and calls `GET /api/user` with `cache: 'no-store'`.
- Guards: `isSeller` (a `store` exists on the session), `isAdmin` (`is_admin` is true), `canViewVersionHistory`. Roles are not stored separately, they are derived.
- Guards are **rendering hints only**, since eligibility is decided server side. Proposal review eligibility in particular cannot be computed on the client, because it depends on which stores were attached at the moment the proposal opened.
- `app/api/auth/login/route.ts` receives credentials, calls the login endpoint, and writes the returned token to an httpOnly, `sameSite: 'lax'` cookie, `secure` in production. **Client JavaScript never touches the token.**

### 5.5 Types

Write `types/product.ts`, `store.ts`, `proposal.ts`, `community.ts`, and `api.ts`, observing:

- `SearchResponse` is `{ mode: 'ai' | 'keyword'; data: ProductSummary[]; links: PaginationLinks; meta: PaginationMeta }`. `mode` is **required, never optional**, so the fallback notice is driven by data rather than inferred from an absent field.
- `Proposal` has no confidence field. Not optional, not nullable, **absent**.
- `Product` has no owner or creator field. Records are platform owned.
- A shared `Paginated<T>` matching Laravel's length aware paginator, since almost every list endpoint returns it.
- All money is `price_minor: number` paired with `currency: string`. Never a float.

### 5.6 `lib/query/provider.tsx` and `lib/query/keys.ts`

A query key factory with two rules that matter:

- **Seller list keys include the coordinates**, otherwise one buyer's distance ordering gets served to another.
- **Search keys include the mode**, so an AI result and a keyword result for the same query string never share a cache entry.

Default `staleTime` per data type:

| Data | Stale time | Reason |
|---|---|---|
| Product detail | 5 minutes | Changes only when a version is created |
| Seller list | 30 seconds | Price and availability change independently |
| Community posts | 30 seconds | Active discussion |
| Sentiment summary | 10 minutes | Regenerated periodically |
| Proposals to review | 1 minute | Three day window, but sellers expect responsiveness |
| Wishlist | 1 minute | Small and user owned |
| Analytics | 5 minutes | Aggregated, not real time |

### 5.7 Root layout and X-04 global navigation

Replace the `create-next-app` boilerplate in `app/layout.tsx` with real metadata, the query provider, and the navigation bar. `app/page.tsx` becomes the S-01 home shell.

Navigation shows buyer and seller entries **together**. There is no mode switch, because a single account may hold both roles.

| Viewer | Entries |
|---|---|
| Anonymous | Catalogue, search, sign in |
| Authenticated, no store | plus wishlist, account, start selling |
| Seller | plus dashboard, listings, proposals, analytics |
| Administrator | plus escalations, products, metrics |

No notification bell. Ever.

### 5.8 S-08 boundaries

`app/not-found.tsx` and `app/error.tsx` at the root, **and again** inside `app/(public)/products/[slug]/`, so a missing product does not fall through to a bare framework page. `not-found` offers search and the catalogue. `error` offers a retry and a link home.

### 5.9 Base UI primitives

Enough of `components/ui/` to build on: `Button`, `Input`, `Select`, `Card`, `Skeleton`, `Dialog`, `EmptyState`, `Alert`. Empty, loading, and error states are part of every screen definition, so having these first stops each screen from inventing its own.

### 5.10 Mock API layer

`app/api/mock/[...path]/route.ts` matches method and path against a handler map in `lib/mock/`, returning fixtures in the real envelope shape.

- Success wraps in `data`. Lists return the paginator shape.
- Errors return `{ code, message, errors? }` using the real codes.
- Query parameters that change behaviour are honoured, so distance sorting, filters, and pagination actually exercise the interface.
- Deliberate failure fixtures for every state the screens must handle: `ai_unavailable` with a `queued_job_id`, `mode: 'keyword'` search results, `proposal_pending`, `store_exists`, `geocoding_failed: true`, `not_verified`, `already_voted`, `review_closed`.
- A jobs fixture reporting `queued`, then `processing`, then `completed` across successive polls, so X-01 can be built and tested properly.

Development only. Excluded from production builds behind the environment flag.

### 5.11 M0 demonstrates

The frontend starts, navigation renders correctly for each viewer type, an unknown route shows the not found boundary, a protected path redirects to login with the `next` parameter set, and a mock endpoint returns a correctly enveloped response.

---

## 6. Milestone roadmap, M1 to M12

Each milestone builds against the mock first, then flips to the real API once the matching backend work lands. Every screen ships its loading, empty, error, and blocked states. **A screen that renders only its happy path is not finished.**

Do not begin a milestone before its predecessor demonstrates.

| Milestone | Screens | Frontend focus |
|---|---|---|
| **M1** Accounts | S-09, S-10, S-11, S-12, S-13, S-16 | Auth forms, the cookie writing route handler, role resolution from the user endpoint, X-03 location on the account screen |
| **M2** Catalogue read | S-01, S-02, S-04, S-05, S-07, X-03 | The public heart of the platform. Product page with variant selector, seller list with distance sorting and filters, contact details rendered for anonymous visitors |
| **M3** Search | S-03, X-02 | Server rendered results, the keyword fallback notice driven by `mode` from the response body and never decided client side |
| **M4** Seller onboarding | S-17, S-18, S-19, S-20 in its empty state | Store registration, Leaflet pin placement when geocoding fails, a dashboard stating plainly that the store is not yet visible and that at least one approved listing is required |
| **M5** Wizard | S-22, S-25, X-01 | New product wizard, six steps, live combination preview, images held in client state and uploaded after the 201 |
| **M6** Confirmation and proposals | S-23, S-24, S-21, S-26, S-27, X-05 | Match selection, mandatory confirmation with no skip control, the blocked listings state |
| **M7** Peer review | S-28, S-29 | Change comparison, two vote actions, no field level controls, no confidence score |
| **M8** Listings and alerts | S-21 completed, S-14, X-06 | Price and availability editing, detach with the store goes dark warning, wishlist |
| **M9** Community and verification | S-06, S-15 | Threaded discussion with four composer states, verification with the five attempt counter |
| **M10** Analytics and versions | S-30, S-31, plus the view recording call added to S-04 | Date ranged analytics, version snapshots, the 403 explanation when a seller detaches mid session |
| **M11** Administration | S-32 to S-37, plus administrator controls on S-06 | Escalation queue sorted oldest blocked first, direct edit, outcome override |
| **M12** Caching and hardening | Revalidation and SEO across the public group | Static generation switched on, `generateMetadata`, structured data, indexing rules, accessibility pass |

### 6.1 The four screens carrying the most difficulty

Budget extra time for these. Each contains a rule that is easy to get subtly wrong.

**S-04 Canonical product page, M2.** A static shell with a server rendered seller segment and client side variant selection. Combinations that no seller carries must still render, labelled "No sellers yet", and are never hidden, because generated combinations are permanent. Above fifty combinations the selector switches from a button grid to one dropdown per attribute. A product with a single default variant renders no selector at all. Selecting a variant filters the seller list and retargets the wishlist button without navigating.

**S-25 New product wizard, M5.** Six steps, with a combination preview that recomputes as the seller edits attributes so the count is visible before commitment. The image endpoint is keyed by product slug, which does not exist until submission succeeds, so files stay in client state through step 5, are validated locally for format and size, and upload immediately after the 201. **A partial image failure shows a retry and does not undo the product.** There is no control to remove a generated combination.

**S-24 Confirmation flow, M6.** No skip control exists anywhere in the component. Rendering a disabled skip would imply the option exists. Submit stays disabled until every question has a non empty answer, with helper text saying why, and a progress indicator showing answered out of total. Two outcomes: an immediate attachment, or a proposal with the seller blocked from selling that product until it resolves.

**X-01 Queued AI job panel, M5 onward.** Appears on S-15, S-22, S-24, and S-25. Triggered by a 503 carrying `ai_unavailable` and a `queued_job_id`. Polls the job endpoint on a backoff starting at 2 seconds and widening to 15. Retains the user's input on screen. The job id **persists to `localStorage`** so closing the browser does not lose the result, and the panel resumes polling on the next visit. Submitting again while a job is queued directs the user to the existing submission rather than creating a duplicate. It must never be phrased as an error the user caused. It never appears on buyer search.

### 6.2 M12 revalidation detail

`app/api/revalidate/route.ts` compares an `x-revalidate-secret` header against `REVALIDATE_SECRET`, then calls `revalidatePath` for `/products/{slug}` and `/products/{slug}/sellers`. The seller list path is revalidated alongside the product page even though it renders per request, because its static shell carries product metadata.

Indexing rules: `/products/[slug]`, `/products/[slug]/community`, and `/stores/[id]` are indexed. `/search` and every authenticated route are not.

---

## 7. Verification

**M0.**

```
npm run dev      # starts clean on http://localhost:3000
npm run build    # type checks and builds with no errors
npm run lint
```

Then by hand: visit `/` and confirm navigation renders anonymously; visit `/dashboard` and confirm the redirect to `/login?next=/dashboard`; visit `/does-not-exist` and confirm the not found boundary; request `/api/mock/products` and confirm a `data` wrapped paginator; request `/api/revalidate` without the secret header and confirm a 401.

**Per milestone.** Walk that milestone's demonstration flow, once against the mock and again against the real API when it exists. M2 for example is complete when an anonymous visitor with no token browses the catalogue, opens a product, sees every variant including ones no seller carries, declines location and still sees sellers sorted by price, applies a filter, and reads a seller's full contact details and address, all without ever authenticating.

**On each flip from mock to real.** The mock and the Laravel response must agree on envelope shape, error codes, and money as integers. With `zod` installed, a parse failure at the client boundary catches this immediately.

**Before M12 is called done.** Run a production build, view source on a product page, and confirm the product name, description, specifications, and variant list are present in the HTML without JavaScript running, so the page is genuinely indexable. Confirm revalidation fires only on version creation and never on a rejected proposal. Confirm no rendered screen and no response type anywhere contains a confidence score, a verification photograph path, or a product creator field.
