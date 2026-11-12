# TikTok Shop P&L Tracker

A web app for an agency that runs TikTok Shops for several clients. For each client it tracks every order, the real profit or loss on each one, ROI, and the business expenses (Kalodata, Shopify, software, staff) that sit outside individual orders. Each client's data, settings and reports are completely separate, and the agency gets an overview of every client in one place.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, MongoDB (Mongoose) and Recharts. It uses the same calculation rules as the Google Sheet version, and can import data from it.

## What it does

### For each client (`/c/<client>/...`)

| Page | URL | Purpose |
|---|---|---|
| **Dashboard** | `/c/<client>` | Orders by status, revenue, every cost type, gross profit, business expenses, net profit, margins, ROI, realized vs pending profit, and 6 charts. Filter by Today, This Week, This Month, Last Month, This Year, All Time or a custom range. |
| **Orders** | `/c/<client>/orders` | Add, edit, delete and search orders. Profit, margin and ROI are calculated per order, with a live preview while you type. |
| **Business Expenses** | `/c/<client>/expenses` | Costs not tied to one order, with totals for this month, last month, this year, and by category. |
| **Monthly Reports** | `/c/<client>/reports` | January to December for any year, with month-over-month change in net profit. |
| **Product Analysis** | `/c/<client>/products` | Per-product totals, plus most profitable, low-margin, loss-making and best-selling products. |
| **Settings** | `/c/<client>/settings` | The client's reporting currency, exchange rates, low-margin threshold and sales tax treatment, plus who has access to the client. Agency admins only. |

`<client>` is the client's web address (slug), e.g. `/c/alis-home-store`. The old single-shop URLs (`/orders`, `/reports`, ...) open the same page for the last client you used.

### For the agency

| Page | URL | Purpose |
|---|---|---|
| **All clients** | `/clients` | Every active client for a period: orders, revenue, gross profit, business expenses, net profit, net margin and last order date, each in the client's own currency. Red for a loss, yellow for a margin below that client's threshold. One total per currency; different currencies are never added together. |
| **Clients** | `/clients/manage` | Create, edit, archive, unarchive and permanently delete clients. |
| **Users** | `/users` | Add people, set their role, and tick the clients each one can access (edit or view only). |
| **My account** | `/account` | Your details and password change (everyone). |

The sidebar has a **client switcher** (searchable) when you can access more than one client, and remembers the last client you opened.

## Clients, roles and access

There is no public sign-up. Only people an agency admin adds can sign in, with their email and password.

- **Client**: one business / TikTok Shop. Every order, business expense and settings record belongs to exactly one client.
- **Agency admin**: sees and manages every client, creates clients, manages all users and every client's settings.
- **Member**: a team member or a client (shop owner). Sees only the clients they are given, with **edit** or **view only** access on each. A member can belong to several clients with different access on each.

| | Agency admin | Member with **edit** on a client | Member with **view only** on a client |
|---|---|---|---|
| See that client's dashboard, orders, expenses, reports, products | ✓ | ✓ | ✓ |
| Add, edit, delete and import that client's orders and expenses | ✓ | ✓ | ✗ |
| That client's settings and exchange rates | ✓ | ✗ | ✗ |
| Who has access to that client | ✓ | ✗ | ✗ |
| Clients they are not a member of | ✓ | not visible (404) | not visible (404) |
| Archived clients | ✓ (still editable) | not visible (404) | not visible (404) |
| All clients overview, Clients, Users | ✓ | ✗ | ✗ |

- **Starting page:** admins land on the All clients overview; members open their last (or only) client.
- **Giving access:** on a client's Settings page (People), add an existing user or invite a new one, or tick clients on the Users page. A new account gets a generated temporary password with a Copy button; they can change it under My account.
- **Removing access:** remove the person from the client, deactivate the account, or archive the client. All take effect on the person's next click.
- **First admin:** set `ADMIN_EMAIL` and `ADMIN_PASSWORD` and sign in with them. The admin account is created on that first sign-in. Then change the password under **My account**; the two variables are ignored once an admin exists.
- **Forgotten password:** an admin uses Reset password on the Users page. If the admin is locked out, run `npm run create-admin -- you@example.com "new-password" "Your Name"`.
- **Deleting a client** is only possible once it is archived, and asks you to type its name. It deletes its orders, expenses, settings and memberships.

### Security

- Every database query for orders, expenses and settings filters by client. Updates and deletes match the record id **and** the client, so an id from one client can never change another client's data.
- Every client page and API route goes through one access check (`requireClientAccess` in [`src/lib/session.ts`](src/lib/session.ts)). It answers **404** when you have no access, so nobody can discover other clients' names, and reads access fresh on every request.
- Passwords are hashed with scrypt. After 5 wrong passwords an account is locked for 15 minutes. Sessions last 30 days in an httpOnly cookie and end on every device when the password is changed or reset or the account is deactivated. There is always at least one active admin, and you cannot demote or delete yourself.
- Automated tests ([`src/lib/isolation.test.ts`](src/lib/isolation.test.ts)) prove that a member of one client gets 404 when reading, editing, deleting or importing into another, including with the other client's record ids.

## How profit is calculated

These rules run per client, in that client's reporting currency.

- **Revenue** = quantity × sale price − refund to buyer. Cancelled orders count as zero.
- **Order-level costs** = product cost + packaging + shipping + other order costs + TikTok fees (referral, transaction, fulfillment, affiliate, other) + advertising + sales tax when it is deducted from the payout.
- **Net profit per order** = revenue − order-level costs. **Margin** = net profit ÷ revenue. **ROI** = net profit ÷ order-level costs.
- **Gross profit** (dashboard) = revenue − order-level costs. **Net profit** = gross profit − business expenses. Business expenses are never charged to individual orders.
- **Overall ROI** = net profit ÷ (order-level costs + business expenses).
- **Realized** profit covers orders that are Delivered and Settled, plus returns and refunds. **Estimated** profit covers orders still in progress or awaiting payout.
- **Sales tax** set to *On top of price* is neither revenue nor cost. *Deducted from payout* counts as a cost. Each order can override the client's default.
- **Returned orders** keep their product cost as a loss. If the item goes back into stock, set its buying price to 0.
- All amounts are converted to the client's reporting currency using the rates in that client's Settings.

The rules live in [`src/lib/calc.ts`](src/lib/calc.ts) and are covered by tests in [`src/lib/calc.test.ts`](src/lib/calc.test.ts).

## Setup

### 1. Create a MongoDB database

The free tier of [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) is enough.

1. Create a cluster, then a database user with a password.
2. Under **Network Access**, allow your IP address (or `0.0.0.0/0` if you deploy to Vercel).
3. Click **Connect → Drivers** and copy the connection string. Add a database name before the `?`, for example `.../tiktok-pl?retryWrites=true&w=majority`.

**If the app cannot connect with `queryTxt ETIMEOUT`:** some networks cannot do the DNS TXT lookup that `mongodb+srv://` strings need. Use the standard format instead: `mongodb://USER:PASS@host1:27017,host2:27017,host3:27017/tiktok-pl?tls=true&authSource=admin&retryWrites=true&w=majority`. The three host names are the cluster's shard hosts (Atlas shows them under Connect → Drivers when you pick an older driver version, or look them up with `nslookup -type=SRV _mongodb._tcp.<your-cluster-host>`).

### 2. Run it locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run migrate:clients      # once: creates the first client and the indexes
npm run dev
```

Open http://localhost:3000 and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string. |
| `SESSION_SECRET` | Yes | Random string of at least 32 characters, used to sign the session cookie. Generate one with `openssl rand -hex 32`. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | For the first sign-in | Details for the first admin account (password at least 8 characters). Ignored once an admin exists. |
| `ADMIN_NAME` | No | Display name for that first admin. Defaults to "Admin". |
| `APP_TIMEZONE` | No | IANA time zone for "Today", "This Week" and similar. Defaults to `Asia/Karachi`. |

Optional test data (into one client, by its web address):

- `npm run seed -- my-shop` adds a few example orders and expenses, marked "Example".
- `npm run seed:demo -- my-shop` adds a 12-month demo dataset (about 250 orders and 115 expenses). Remove it with `npm run seed:demo -- my-shop --clear`.

### 3. Deploy to Vercel

1. Import this repository at [vercel.com/new](https://vercel.com/new).
2. Add `MONGODB_URI`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `APP_TIMEZONE` under **Environment Variables**.
3. Deploy. In MongoDB Atlas, allow access from `0.0.0.0/0` because Vercel's IP addresses change.
4. Run `npm run migrate:clients` once against the production database (from your machine, with its `MONGODB_URI`).

## Moving from the single-shop version

Databases created before clients existed must be migrated once. The migration is safe to run more than once: a second run changes nothing.

```bash
npm run migrate:clients -- --dry-run   # shows every change, changes nothing
npm run migrate:clients                # applies them
```

It:

1. Creates a client called **My Shop** (`/c/my-shop`) if it does not exist yet and there is data from the single-shop version (or no client at all). Old data never goes into some other client you already created, unless you name it with `--client <web-address>`.
2. Puts every order and business expense that has no client into that client.
3. Turns the old single settings document into that client's settings, and gives default settings to any other client that has none.
4. Turns old `editor` / `viewer` users into members of that client with edit / view access.
5. Drops the old unique index on `orders.orderId` (and `settings.key`) and creates the new indexes, including the unique `{ clientId, orderId }`, so two clients can have the same order ID.

Mongoose creates new indexes on its own but never drops old ones, which is why step 5 exists. To drop the old index by hand instead, run `db.orders.dropIndex("orderId_1")` in `mongosh` or Atlas. To put the old data into a client other than My Shop: `npm run migrate:clients -- --client <web-address>`.

## Moving data from the Google Sheet

1. In the Google Sheet, open the **Orders** tab and choose **File → Download → Comma-separated values (.csv)**.
2. In the app, open the client, go to **Orders → Import CSV** and pick the file.
3. Repeat with the **Business Expenses** tab on the Business Expenses page.

Orders already in that client (same Order ID) are skipped, as are expenses with the same date, name and amount, so importing twice is safe. Example rows are ignored.

## API

All routes return JSON. Every route except sign-in needs a signed-in user: **401** when signed out, **404** for a client you cannot access (or that does not exist), **403** when your access to a client you can see is too low. `:client` is the client's id (its web address also works).

| Method | Route | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | anyone | `{ "email", "password" }`. Sets the session cookie. |
| `POST` | `/api/auth/logout` | anyone | Clears the session cookie |
| `PUT` | `/api/account/password` | any user | `{ "currentPassword", "newPassword" }` |
| `GET` | `/api/clients` | any user | Clients you can open, with your access on each |
| `POST` | `/api/clients` | admin | Create a client (and its settings): `{ name, slug?, shopName?, marketplace?, contactName?, contactEmail?, notes?, reportingCurrency? }` |
| `GET` | `/api/clients/:client` | view | The client and your access |
| `PUT` | `/api/clients/:client` | admin | Edit details; `{ "status": "Archived" \| "Active" }` archives or unarchives |
| `DELETE` | `/api/clients/:client` | admin | Permanently delete an archived client and all its data: `{ "confirmName" }` |
| `GET` | `/api/clients/:client/orders?start=&end=` | view | Orders with calculated profit fields |
| `POST` | `/api/clients/:client/orders` | edit | Create an order |
| `PUT` / `DELETE` | `/api/clients/:client/orders/:id` | edit | Update or delete an order |
| `POST` | `/api/clients/:client/orders/import` | edit | Import `{ "csv": "..." }` → `{ inserted, skipped, errors }` |
| `GET` | `/api/clients/:client/expenses?start=&end=` | view | Business expenses with converted amounts |
| `POST` | `/api/clients/:client/expenses` | edit | Create a business expense |
| `PUT` / `DELETE` | `/api/clients/:client/expenses/:id` | edit | Update or delete an expense |
| `POST` | `/api/clients/:client/expenses/import` | edit | Import `{ "csv": "..." }` |
| `GET` | `/api/clients/:client/settings` | view | The client's settings |
| `PUT` | `/api/clients/:client/settings` | admin | Save the client's settings |
| `POST` | `/api/clients/:client/settings/rates` | admin | Load current exchange rates from open.er-api.com |
| `GET` | `/api/clients/:client/people` | admin | Members with access to the client |
| `POST` | `/api/clients/:client/people` | admin | `{ userId, access }` adds an existing user; `{ name, email, password, access }` invites a new one |
| `PUT` / `DELETE` | `/api/clients/:client/people/:userId` | admin | Change `{ access }` or remove access |
| `GET` / `POST` | `/api/users` | admin | List users (with their clients) or create one: `{ name, email, password, role, memberships? }` |
| `PUT` / `DELETE` | `/api/users/:id` | admin | Update (name, email, role, active, password, memberships) or delete a user |

## Development

```bash
npm test          # calculation, period, CSV, sign-in, client isolation and migration tests
npm run typecheck
npm run build
```

The database tests run a throwaway in-memory MongoDB with [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server); they never touch Atlas. If MongoDB Server is installed locally (e.g. `C:\Program Files\MongoDB\Server\<version>\bin\mongod.exe`), its `mongod` is used; otherwise one is downloaded on the first run. Set `MONGOMS_SYSTEM_BINARY` to point at a specific `mongod`.

Project layout:

```
src/
  app/
    c/[clientSlug]/   client pages (dashboard, orders, expenses, reports, products, settings)
    clients/          agency overview and client management
    users/, account/  user management and My account
    api/clients/[clientId]/...   client-scoped API routes
  components/         UI components (forms, tables, charts, sidebar with client switcher)
  lib/
    calc.ts           profit rules and report aggregation (unchanged by clients)
    periods.ts        date ranges for the dashboard filter
    importers.ts      Google Sheet CSV import
    models.ts         Mongoose schemas and indexes
    repo.ts           orders, expenses and settings for one client (clientId is always required)
    clients.ts        clients and memberships
    data.ts           report loading and the agency overview
    session.ts        current user and requireClientAccess()
    users.ts          user accounts, sign-in, lockout
    auth.ts           session tokens (Web Crypto, also used by the proxy)
    password.ts       scrypt password hashing
    migrate.ts        the single-shop → clients migration
  proxy.ts            sign-in check for every request
  test/               in-memory MongoDB helpers for tests
scripts/
  migrate-clients.ts  npm run migrate:clients
  seed.ts             a few example rows for one client
  seed-demo.ts        12-month demo dataset for one client
  create-admin.ts     create or reset an admin account
```
