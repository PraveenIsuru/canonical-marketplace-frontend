@AGENTS.md

# Frontend Development Rules

**Before making any change to this repository, read the documents in [development-docs/](development-docs/).** Start with [development-docs/README.md](development-docs/README.md), then read [development-docs/frontend-build-plan.md](development-docs/frontend-build-plan.md) and [development-docs/shared/api-contract.md](development-docs/shared/api-contract.md).

Those documents define the build order, the wire format, and the rules the interface must never break. They are the authority. This file only points at them.

## Non negotiables

- `development-docs/frontend-build-plan.md` decides what to build and in what order. Do not start a later milestone before the current one demonstrates its stated outcome.
- `development-docs/shared/api-contract.md` decides every shape and every error code that crosses the wire. **The backend owns it.** Never edit this repository's copy, and never guess a shape or code that is not in it. If something is missing, add a row to the open requests table in `development-docs/shared/milestone-log.md`.
- **There is no mock API.** The backend ships a milestone's endpoints first, then the screens that consume them are built against the real running API, using seeded data. A screen whose endpoint does not answer does not get built yet.
- Run `npm run docs:check` before starting and before finishing a milestone. A failure means the contract has drifted between the two repositories. Resolve it before writing code.
- Read the backend's entry for the current milestone in `development-docs/shared/milestone-log.md` before starting, and append your own entry when the screens are done.
- Section 2.2 of the build plan lists the invariants. A change that breaks one is wrong regardless of what it improves. Several obvious looking controls are forbidden by design, so check that list before adding any control to any screen.
- Where the plan disagrees with this repository's actual scaffolding, **the scaffolding wins**. This is Next.js 16 with the App Router at `app/` in the repository root and no `src/` directory. Update the plan to match rather than working around the difference silently.
- Every screen ships its loading, empty, error, and blocked states. A screen that renders only its happy path is not finished.
