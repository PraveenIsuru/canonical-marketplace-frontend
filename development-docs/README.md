# Development Docs

These documents are the authority on what this repository builds and in what order. **Read them before making any change.**

| Document | Covers | Owned by |
|---|---|---|
| [frontend-build-plan.md](frontend-build-plan.md) | Repository ground rules, the invariants, the M0 specification, and the M0 to M12 roadmap | This repository |
| [shared/api-contract.md](shared/api-contract.md) | The wire format: envelope, error codes, money, pagination, endpoint index, and the shapes that are easy to get wrong | **The backend.** This repository mirrors it |
| [shared/integration-protocol.md](shared/integration-protocol.md) | How this repository and the backend stay in step | Shared |
| [shared/milestone-log.md](shared/milestone-log.md) | The handover record. Read the backend's entry before starting a milestone, append your own when done | Shared, both sides append |

## The shared folder

`development-docs/shared/` is **byte identical** in this repository and in `C:\MyApps\canonical-marketplace\backend`. Not roughly the same. Identical, enforced by a hash comparison.

**The backend owns `api-contract.md`.** Do not edit this repository's copy. A shape change starts in the backend, and a shape defined only here is a shape no server implements.

To verify the copies match:

```bash
npm run docs:check
```

It skips cleanly when the backend repository is not present. To pull a backend change across:

```bash
cp -r ../backend/development-docs/shared/. ./development-docs/shared/
```

When you append to `milestone-log.md`, copy it back the other way and commit both repositories.

## There is no mock API

Within each milestone the backend ships its endpoints first, then this repository builds the screens that consume them, against the real running API. A screen whose endpoint does not answer does not get built yet.

What the screens are built against is **seeded data**, not fixtures. If a state cannot be reached with the seeded data, ask for a seeder change rather than inventing a fixture. The reasoning is in section 6 of `shared/integration-protocol.md`.

## How to use this folder

1. Read `frontend-build-plan.md` in full before the first change of a session.
2. Run `npm run docs:check`. If it fails, resolve it before writing code.
3. Read the backend's entry for the current milestone in `shared/milestone-log.md`, so you build against what actually shipped rather than what was planned.
4. Read `shared/api-contract.md` before writing any fetch, type, or schema. **Never guess a shape or an error code that is not in it.**
5. Check section 2.2 of the build plan, the invariants, before adding any control to any screen. Several obvious looking controls are forbidden by design.
6. Append your own milestone log entry when the screens are done.

## Quick facts that catch people out

- This is **Next.js 16**, not 15. `middleware.ts` is now `proxy.ts`, and route `params` are Promises that must be awaited.
- The App Router lives at `app/` in the repository root. There is **no `src/` directory**.
- Cache Components is off and stays off. Use `export const revalidate` and `revalidatePath()`.
- Prices are integers in the smallest currency unit. Divide by 100 for display only, never store or send a float.
- This repository holds no business rules and talks to nothing but the Laravel API. Not the database, not Redis, not the search index.
