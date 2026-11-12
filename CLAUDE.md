# TikTok Shop P&L Tracker

Multi-client profit & loss tracker for an agency that runs TikTok Shops for several clients.
**Full specification: [tiktok-pl-tracker-PROMPT.md](tiktok-pl-tracker-PROMPT.md).** Read the relevant section before changing behaviour; keep it in sync when the design changes. User-facing docs: [README.md](README.md).

## Who uses it

- **Agency admin** (`role: "admin"`): every client, client settings, the All clients overview, Clients and Users pages.
- **Team member** (`role: "member"`): only clients they have a membership for, `edit` or `view` per client.
- **Client user** (shop owner): technically a member, usually `view` on their own client only.

None of them are accountants: keep the UI plain and numbers exact.

## Rules that must not break

- **Calculation rules** in `src/lib/calc.ts` (spec section 4) were agreed with the owner and match the Google Sheet. Do not change them without asking. Reference case: 23.18 profit; (25.82) net after a $49 expense.
- **Client isolation.** Every function in `src/lib/repo.ts` takes `clientId` first and filters on it; update/delete match `{ _id, clientId }`. Only `loadOverview()` in `src/lib/data.ts` reads across clients, and it returns totals only.
- **One access check:** `requireClientAccess` / `requireClientApi` / `requireClientPage` in `src/lib/session.ts`, used by every client page and route. No access → **404** (never 403, so client names can't be discovered); access too low → 403. Access is read fresh each request.
- Archived clients: hidden from members (404), editable by admins.
- Dates are `"YYYY-MM-DD"` strings, never `Date`. Order IDs are strings, unique per client (`{ clientId, orderId }`).
- Hiding a button is never the protection; the server check is.
- `src/lib/isolation.test.ts` proves the isolation. Extend it when adding client-scoped routes.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 strict · Tailwind CSS 4 · MongoDB + Mongoose 9 · Zod 4 · Recharts 3 · Vitest · Node 20+. Path alias `@/*` → `src/*`.

## Gotchas we already hit

- **Next.js 16 uses `src/proxy.ts`** exporting `proxy`, not `middleware.ts`. The proxy only checks the cookie signature (Web Crypto); roles and client access are checked in pages/routes.
- **`params` and `searchParams` are Promises** in pages and route handlers. Always `await` them.
- **Tailwind 4:** theme tokens go in `@theme` in `globals.css`; reusable classes must be `@utility name { ... }` (plain `.class` rules can't be used in `@apply`).
- **Never name a class `table`**: it collides with Tailwind's `table` utility. Use `data-table`.
- **MongoDB SRV DNS issue:** on this machine's network the `mongodb+srv://` TXT lookup times out (`queryTxt ETIMEOUT`). `.env` therefore uses the standard `mongodb://host1:27017,host2:27017,host3:27017/tiktok-pl?tls=true&authSource=admin&...` format (old SRV string kept commented above it). Shard hosts come from `nslookup -type=SRV _mongodb._tcp.<cluster-host>`.
- **Mongoose never drops old indexes.** Index changes need a migration (see `src/lib/migrate.ts`).
- **`server-only`** throws outside a React server build; Vitest aliases it to `src/test/empty.ts`.
- Root layout doesn't re-render on client navigation; call `router.refresh()` after changing clients so the sidebar list updates.
- Windows: renaming folders under `src/app` can fail with "Permission denied" while the editor/dev server watches them; copy then delete instead.

## Commands

```bash
npm run dev                      # http://localhost:3000
npm run build                    # production build (must pass)
npm run typecheck                # tsc --noEmit (must pass)
npm test                         # Vitest: calc, periods, CSV, auth, client isolation, migration
npm run seed -- <client-slug>    # a few "Example" rows into one client
npm run seed:demo -- <client-slug> [--clear]   # 12-month demo dataset (DEMO- order IDs)
npm run migrate:clients -- --dry-run           # single-shop → clients migration; drop --dry-run to apply
npm run create-admin -- email "password" "Name"   # create/reset an admin if locked out
```

Database tests use `mongodb-memory-server`: `vitest.config.mts` points it at a locally installed `mongod` (here `C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe`) because the binary download on this network is very slow. **Never point tests at Atlas.**

## Where things are

- `src/app/c/[clientSlug]/…` client pages · `src/app/clients` overview (+ `/manage`) · `src/app/users`, `src/app/account`
- `src/app/api/clients/[clientId]/…` client-scoped API · `src/app/api/users`, `api/auth`, `api/account`
- `src/lib/`: `calc.ts` rules · `repo.ts` client data · `clients.ts` clients + memberships · `session.ts` access checks · `users.ts` accounts/lockout · `auth.ts` tokens · `data.ts` loaders + overview · `models.ts` schemas/indexes · `migrate.ts` migration · `constants.ts` all enums
- `scripts/` CLI scripts (load env via `scripts/load-env.ts`)

## Working agreements

- Ask before changing calculation rules, and before running anything that writes to the real database (show a dry run first).
- Don't commit unless asked; the owner reviews first.
- Keep `README.md` and the spec updated with any user-visible change.
- Not planned unless asked: agency billing, client-branded/PDF reports, activity log, TikTok Shop API sync.
