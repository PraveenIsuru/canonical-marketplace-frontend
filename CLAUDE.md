@AGENTS.md

# Frontend Development Rules

**Before making any change to this repository, read the documents in [development-docs/](development-docs/).** Start with [development-docs/README.md](development-docs/README.md), then read [development-docs/frontend-build-plan.md](development-docs/frontend-build-plan.md) in full.

Those documents define the build order, the screen definitions, the API contract shapes, and the rules the interface must never break. They are the authority. This file only points at them.

## Non negotiables

- `development-docs/frontend-build-plan.md` decides what to build and in what order. Do not start a later milestone before the current one demonstrates its stated outcome.
- Section 2.2 of the plan lists the invariants. A change that breaks one of them is wrong regardless of what it improves. Several obvious looking controls are forbidden by design, so check that list before adding any control to any screen.
- Where the plan disagrees with this repository's actual scaffolding, **the scaffolding wins**. This is Next.js 16 with the App Router at `app/` in the repository root and no `src/` directory. Update the plan to match rather than working around the difference silently.
- Every screen ships its loading, empty, error, and blocked states. A screen that renders only its happy path is not finished.
