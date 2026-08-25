# Development Docs

These documents are the authority on what this repository builds and in what order. **Read them before making any change.**

| Document | Covers |
|---|---|
| [frontend-build-plan.md](frontend-build-plan.md) | Repository ground rules, the invariants the interface must never break, the M0 Foundations specification, and the M0 to M12 milestone roadmap |

## How to use this folder

1. Read `frontend-build-plan.md` in full before the first change of a session.
2. Find the current milestone. Do not start a later milestone before the current one demonstrates its stated outcome.
3. Check section 2.2 of the plan, the invariants, before adding any control to any screen. Several obvious looking controls are forbidden by design, and the plan says which and why.
4. Where the plan disagrees with this repository's actual scaffolding, the scaffolding wins. Record the difference in the plan rather than working around it silently.

## Quick facts that catch people out

- This is **Next.js 16**, not 15. `middleware.ts` is now `proxy.ts`, and route `params` are Promises that must be awaited.
- The App Router lives at `app/` in the repository root. There is **no `src/` directory**.
- Cache Components is off and stays off. Use `export const revalidate` and `revalidatePath()`.
- Prices are integers in the smallest currency unit. Divide by 100 for display only, never store or send a float.
- The frontend holds no business rules. It talks to the Laravel API and nothing else.
