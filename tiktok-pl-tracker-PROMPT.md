# Project prompt: TikTok Shop Profit & Loss Tracker (Next.js + TypeScript + MongoDB)

You are working on a production web app for a TikTok Shop seller. It tracks every order, the real profit or loss on each one, ROI, and the business expenses that sit outside individual orders (Kalodata, Shopify, software, staff). The seller is not an accountant, so the app must be accurate, clear and simple to use.

**If this repository already contains the code**, read it first, run `npm install`, `npm test`, `npm run typecheck` and `npm run build`, and treat this document as the specification: fix anything that does not match it, and keep everything that does. **If the repository is empty**, build the app from this specification.

Do not change the calculation rules in section 4 without asking. They were agreed with the owner and match the Google Sheet version of this tracker.

---

## 1. Tech stack

- **Next.js 16** (App Router, Turbopack) with **TypeScript 5** in strict mode
  - In Next.js 16 the `middleware.ts` file convention is renamed to **`proxy.ts`**, exporting a function named `proxy`.
  - `params` and `searchParams` are Promises in pages and route handlers. Always `await` them.
- **React 19**
- **Tailwind CSS 4** via `@tailwindcss/postcss`
  - Theme tokens go in `@theme` in `globals.css`.
  - Custom reusable classes must be declared with `@utility` (for example `@utility btn-primary { @apply btn ... }`). Plain `.class` rules cannot be used inside `@apply` in Tailwind 4.
  - Do not name a custom class `table`, because it collides with Tailwind's built-in `table` utility. Use `data-table`.
- **MongoDB** with **Mongoose 9**, set as `serverExternalPackages: ["mongoose"]` in `next.config.ts`
- **Recharts 3** for charts
- **Zod 4** for request validation
- **Vitest** for unit tests, configured in `vitest.config.mts` (ESM) with the `@/*` alias pointing at `src/`
- Node.js 20 or newer. Path alias `@/*` → `src/*`.

## 2. Environment variables

Document these in `.env.example` and the README.

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string (MongoDB Atlas free tier works). |
| `APP_PASSWORD` | Recommended | Single password for signing in. When empty, sign-in is disabled (local use only). |
| `SESSION_SECRET` | When `APP_PASSWORD` is set | At least 32 characters. Signs the session cookie. |
| `APP_TIMEZONE` | No | IANA time zone for "Today", "This Week" and similar. Default `Asia/Karachi`. |

The database connection must be lazy, so `next build` succeeds without `MONGODB_URI`. When it is missing, API routes return a clear error: "MONGODB_URI is not set. Copy .env.example to .env.local and add your connection string."

## 3. Data model

Store every date as a **`"YYYY-MM-DD"` string**, never a `Date`. This keeps range comparisons free of time zone shifts, and lexical string comparison works for filtering.

### Order

| Field | Type | Notes |
|---|---|---|
| `orderDate` | string (date) | required, indexed |
| `orderId` | string | required, **unique**, trimmed. TikTok order IDs are long numbers, so always keep them as strings. |
| `productName` | string | required |
| `sku` | string | |
| `status` | enum | `Pending`, `Processing`, `Shipped`, `Delivered`, `Cancelled`, `Returned`, `Refunded` |
| `payoutStatus` | enum | `Awaiting payout`, `Settled` |
| `currency` | string | 3-letter code, uppercase, default `USD` |
| `quantity` | number | default 1 |
| `salePrice` | number | per unit |
| `buyPrice` | number | per unit |
| `packaging`, `shipping`, `otherCosts` | number | per order |
| `referralFee`, `transactionFee`, `fulfillmentFee`, `affiliateCommission`, `adCost`, `otherPlatformFees` | number | per order, entered manually because TikTok fee structures vary |
| `salesTax` | number | per order |
| `taxTreatment` | enum or `null` | `On top of price`, `Deducted from payout`, or `null`, meaning "use the default from Settings" |
| `refund` | number | amount refunded to the buyer |
| `notes` | string | |

All money fields default to 0. Use timestamps.

### Expense (business expense, not tied to one order)

| Field | Type | Notes |
|---|---|---|
| `date` | string (date) | required, indexed |
| `name` | string | required, for example "Kalodata Subscription" |
| `category` | enum | `Product Research Tools`, `E-commerce Platform`, `Software Subscriptions`, `AI Tools`, `Virtual Assistant / Staff`, `Marketing`, `Internet & Utilities`, `Samples & Testing`, `Bank & Payment Fees`, `Other` |
| `description` | string | |
| `billingType` | enum | `One-Time`, `Weekly`, `Monthly`, `Yearly`. This is a label only. The user logs **each charge on the date it was billed**, so a monthly subscription has one row per month and is never counted twice. |
| `amount` | number | |
| `currency` | string | 3-letter code |
| `paymentStatus` | enum | `Paid`, `Pending` |
| `paymentMethod` | enum | `Credit Card`, `Debit Card`, `Bank Transfer`, `PayPal`, `Payoneer`, `Cash`, `Other` |

### Settings (a single document, `key: "main"`)

| Field | Default | Notes |
|---|---|---|
| `reportingCurrency` | `USD` | every report is converted to this |
| `lowMarginThreshold` | `0.15` | stored as a fraction |
| `defaultTaxTreatment` | `On top of price` | |
| `rates` | `{}` | Map: currency code → value of 1 unit in the reporting currency |
| `ratesUpdatedAt` | `null` | string |

Keep enum lists in one constants file (`src/lib/constants.ts`) and reuse them in the models, Zod schemas, forms and filters. Supported currency list for dropdowns: USD, GBP, EUR, PKR, AED, SAR, CAD, AUD, MYR, SGD, PHP, THB, VND, IDR, MXN. Users can add other codes in Settings.

## 4. Calculation rules (the most important part)

Put all of this in pure functions in `src/lib/calc.ts`, with no database access, so it can be unit tested and reused on the client for live previews.

### Currency

`fxRate(currency)` returns 1 when the currency is empty or equals the reporting currency. Otherwise it returns `settings.rates[currency]`. If no rate exists, it returns 1 **and** flags `fxMissing: true`, so the UI can warn the user.

### Per order (all values converted to the reporting currency)

Let `live = 0` if status is `Cancelled`, otherwise `1`. Treat empty or NaN numbers as 0.

```
grossSales        = qty × salePrice × fx
revenue           = live × (qty × salePrice − refund) × fx
productCost       = live × qty × buyPrice × fx
shippingPackaging = live × (packaging + shipping) × fx
otherCosts        = live × otherCosts × fx
tiktokFees        = live × (referralFee + transactionFee + fulfillmentFee + affiliateCommission + otherPlatformFees) × fx
adCost            = live × adCost × fx
taxCost           = live × (treatment == "Deducted from payout" ? salesTax : 0) × fx
                    where treatment = order.taxTreatment ?? settings.defaultTaxTreatment
totalExpenses     = productCost + shippingPackaging + otherCosts + tiktokFees + adCost + taxCost
netProfit         = revenue − totalExpenses
margin            = revenue == 0 ? 0 : netProfit / revenue
investment        = totalExpenses
roi               = investment == 0 ? 0 : netProfit / investment
profitPerUnit     = (live × qty) == 0 ? 0 : netProfit / qty
```

**Basis**
- `Excluded` if Cancelled.
- `Realized` if Returned, Refunded, or (Delivered **and** payout Settled).
- `Estimated` otherwise (Pending, Processing, Shipped, or Delivered but awaiting payout).

**Result**
- `Cancelled` if Cancelled.
- `Loss` if netProfit < 0.
- `Low margin` if margin < lowMarginThreshold.
- `Profitable` otherwise.

Why the rules are this way:
- Cancelled orders are not revenue.
- Refunds reduce revenue. Returned orders keep their product cost as a loss. If an item goes back into stock, the user sets its buying price to 0 on that row.
- Sales tax "On top of price" is paid by the buyer and remitted by TikTok, so it is neither revenue nor cost. "Deducted from payout" comes out of the seller's proceeds, so it is a cost. This avoids counting tax twice.
- Business expenses are **never** deducted from individual orders.

### Period summary (`summarize(orders, expenses, start, end)`, inclusive dates)

- Counts: total orders, delivered, in progress (Pending + Processing + Shipped), cancelled, returned, refunded, counted orders (total − cancelled).
- Sums: revenue, productCost, tiktokFees, taxes, shippingPackaging, adCost, otherCosts, orderExpenses (= sum of totalExpenses).
- `grossProfit = revenue − orderExpenses`
- `grossMargin = grossProfit / revenue`
- `businessExpenses` = sum of expense amounts in the reporting currency, dated within the period
- `netProfit = grossProfit − businessExpenses`
- `netMargin = netProfit / revenue`
- `avgGrossProfitPerOrder = grossProfit / countedOrders`
- `roi = netProfit / (orderExpenses + businessExpenses)`
- `realizedNetProfit` = sum of netProfit for Realized orders − businessExpenses
- `pendingProfit` = sum of netProfit for Estimated orders

Every division returns 0 when the denominator is 0.

### Monthly rows (`monthlyRows(orders, expenses, firstMonth, count = 12)`)

One summary per calendar month. Each row has: label ("Nov 2026"), counted orders, every sum above, grossProfit, grossMargin, businessExpenses, netProfit, netMargin, roi, and `changeVsPrior` (netProfit minus the previous row's netProfit, `null` for the first row).

### Product rows (`productRows(orders, settings)`)

Group non-cancelled orders by product name + SKU. Sum units, revenue, productCost, tiktokFees, orderExpenses and profit. Derive profitPerUnit, margin, roi (profit ÷ orderExpenses) and result (Loss / Low margin / Profitable). Sort by profit, highest first.

### Reference test case (must pass)

Settings: USD, threshold 0.15, default tax "On top of price".

Order: Delivered, Settled, USD, qty 2, salePrice 24.99, buyPrice 7.50, packaging 0.80, shipping 4.50, referralFee 3.00, transactionFee 1.50, adCost 2.00, salesTax 3.50, taxTreatment null, refund 0.

Expected:
- revenue 49.98, productCost 15.00, shippingPackaging 5.30, tiktokFees 4.50, taxCost 0, totalExpenses 26.80
- netProfit **23.18**, margin 46.4%, ROI 86.5%, profitPerUnit 11.59
- basis Realized, result Profitable

With a $49 business expense in the same month: gross profit 23.18, net profit **(25.82)**, overall ROI −25.82 ÷ 75.80.

## 5. Dashboard periods (`src/lib/periods.ts`)

- `todayIn(timeZone)` uses `Intl.DateTimeFormat("en-CA", { timeZone })`.
- `resolvePeriod(period, today, customStart, customEnd)` returns inclusive `{ start, end }`:
  - **Today**: today to today
  - **This Week**: Monday to Sunday containing today
  - **This Month**, **Last Month**: calendar months
  - **This Year**: Jan 1 to Dec 31
  - **All Time**: 2000-01-01 to 2100-12-31
  - **Custom Range**: the given dates, falling back to All Time bounds when a date is missing or invalid
- Helpers: `addDays`, `monthStart`, `monthEnd` (leap years correct), `addMonths`, and `isISODate`, which rejects impossible dates like 2026-02-30.

## 6. Pages and UI

### Layout

- Left sidebar in dark navy (`#1F2A44`), collapsing to a top bar with a menu button on mobile.
- Links: Dashboard (`/`), Orders, Business Expenses, Monthly Reports (`/reports`), Product Analysis (`/products`), Settings.
- A "Sign out" button when sign-in is enabled. The sidebar is hidden on `/login`.

### Design

- Clean, premium and readable, with no unnecessary decoration.
- Colors: canvas `#F3F5F8`, white cards, navy and slate (`#5B6B82`) headings, blue accent `#1F5FBF`, green `#1E8E3E` for positive results, red `#C5221F` for negative results, amber or yellow for low margin.
- Money is shown in accounting style: `1,234.56`, negatives in parentheses `(1,234.56)`, and zero as `-`. Percentages have one decimal place. Use tabular numbers.
- Dates display as "8 Nov 2026".
- Tables have a navy header. Columns that are calculated automatically have a slate header, so the user can tell them apart from what they typed.

### Dashboard (`/`, server component)

- A period filter (client component) that updates the URL `?period=...&start=...&end=...`. The From and To fields appear only for Custom Range.
- A "Showing ... to ..." line under the filter.
- A warning banner when any order or expense uses a currency with no exchange rate.
- Three cards:
  - **Orders**: total, delivered, in progress, cancelled, returned, refunded, counted.
  - **Revenue & Order Costs**: revenue, product, TikTok fees, taxes, shipping & packaging, advertising, other, total.
  - **Profit**: gross profit, gross margin, business expenses, net profit (highlighted), net margin, average gross profit per order, overall ROI, realized net profit, estimated pending profit.
- Profit values are green when positive and red when negative.
- Six charts, each with an empty state ("No data for this period"):
  1. Monthly revenue vs net profit (columns; net profit bars red when negative)
  2. Monthly expenses, stacked: order-level costs and business expenses
  3. Net profit margin trend (line)
  4. Revenue by product, top 8 in the period (horizontal bars)
  5. Business expenses by category in the period (donut)
  6. Order status distribution in the period (donut)
- The monthly charts show the 12 months ending at the earlier of the period end and today.

### Orders (`/orders`)

- Table: date, order ID (monospace), product with SKU, status, payout, qty, price (with the currency code when it differs from the reporting currency), then calculated columns: revenue, product cost, TikTok fees, total costs, net profit, margin, ROI, basis badge, result badge, and Edit / Delete actions.
- Rows tinted red for Loss, yellow for Low margin, and gray italic for Cancelled.
- Footer with the filtered count and totals for revenue, costs and profit.
- Filters: text search (order ID, product, SKU, notes), status, result, and a date range.
- "Add order" opens a modal form grouped into Order information, Units & price, Order costs, and TikTok fees, ads & tax.
  - The tax treatment dropdown includes "Default (current default)".
  - A **live preview** of revenue, order costs, net profit, margin and ROI uses `computeOrder` on the client while the user types.
- Deleting asks for confirmation. Empty and loading states.
- Duplicate order ID returns HTTP 409 "An order with this Order ID already exists".

### Business Expenses (`/expenses`)

- A summary card in the reporting currency: this month, last month, this year, average per month over the last 12 full months, paid, pending, all time.
- An "Expenses by category" table with columns for this month, this year and all time.
- Filters: search, category, payment status.
- A table with the amount in the original currency plus the converted amount. A modal form explains "add each charge on the date it was billed".

### Monthly Reports (`/reports?year=2026`)

- Previous and next year arrows.
- A table with one row per month and columns: orders, revenue, product costs, TikTok fees, taxes, shipping & packaging, advertising, other order costs, total order costs, gross profit, gross margin, business expenses, net profit, net margin, ROI, and net profit vs prior month (green or red).
- A totals row: sums, with ratios recomputed from the totals rather than averaged.
- A line chart of revenue, gross profit and net profit.

### Product Analysis (`/products`)

- Four insight cards:
  - Most profitable (top 5 with profit > 0)
  - Low profit margin
  - Generating losses (worst first)
  - Best-selling (top 5 by units)
- The full product table, with rows tinted for Loss and Low margin.

### Settings (`/settings`)

- Reporting currency, low-margin threshold (shown as a percentage, stored as a fraction), and default sales tax treatment, with a plain explanation of the two options.
- Exchange rate grid: one input per currency, the value of 1 unit in the reporting currency, plus "Add currency".
- A **"Load current rates"** button. It saves the reporting currency first, then calls `POST /api/settings/rates`, which fetches `https://open.er-api.com/v6/latest/{reportingCurrency}` and stores `1 / rate` for each currency. It shows when the rates were last loaded.

### Login (`/login`)

- A password field. After signing in, redirect to the `?next=` path, but only when it starts with `/` and not `//`.

### Other

- `error.tsx` with a friendly message and a "Try again" button.
- `not-found.tsx`.
- An app icon (`src/app/icon.svg`).

## 7. API routes (JSON)

Wrap every route in a `handle()` helper that returns consistent errors:
- 400 with readable Zod messages ("orderDate: Use a valid date (YYYY-MM-DD); orderId: Order ID is required")
- 404 for unknown or invalid ObjectIds
- 409 for duplicate order IDs (Mongo error 11000)
- 500 otherwise, with details logged on the server only

| Method | Route | Behaviour |
|---|---|---|
| POST | `/api/auth/login` | `{ password }`. Sets an httpOnly, SameSite=Lax cookie (`secure` in production), valid 30 days. On a wrong password, waits 500 ms and returns 401. |
| POST | `/api/auth/logout` | Clears the cookie |
| GET | `/api/orders?start&end` | `{ orders: OrderWithCalc[], settings }`, newest first |
| POST | `/api/orders` | Create (Zod validated) |
| PUT / DELETE | `/api/orders/[id]` | Update / delete |
| POST | `/api/orders/import` | `{ csv }` → `{ inserted, skipped, errors[] }` |
| GET / POST | `/api/expenses` | List with converted amounts / create |
| PUT / DELETE | `/api/expenses/[id]` | Update / delete |
| POST | `/api/expenses/import` | `{ csv }` → `{ inserted, skipped, errors[] }` |
| GET / PUT | `/api/settings` | Read / save |
| POST | `/api/settings/rates` | Load live exchange rates |

Database access lives in `src/lib/repo.ts` (marked `server-only`). It converts Mongo documents to plain objects with `id: string` and no `_id`, `__v` or timestamps. The Mongoose connection is cached on `globalThis` for hot reload and serverless reuse.

## 8. Sign-in (`src/lib/auth.ts` and `src/proxy.ts`)

- When `APP_PASSWORD` is set, `proxy.ts` protects every route except `/login`, `/api/auth/login` and static assets.
  - Pages without a valid session redirect to `/login?next=...`.
  - API routes without a valid session return 401 JSON.
- Session token: `"<expiryMs>.<hex HMAC-SHA256(expiryMs, SESSION_SECRET)>"`, built with **Web Crypto** (`crypto.subtle`) so it runs inside the proxy.
- Compare signatures in constant time. Compare passwords by comparing HMACs of both values.

## 9. Importing from the Google Sheet

The user already has a Google Sheet version with an "Orders" tab and a "Business Expenses" tab. They download each tab as CSV and import it.

- Write a CSV parser (RFC 4180: quoted fields, escaped quotes, commas and newlines inside quotes, BOM, CRLF) in `src/lib/csv.ts`.
- Find the header row by looking for a column named "Order ID" or "Expense Name". The sheet has a banner row above the headers.
- Normalise headers by lowercasing and stripping non-alphanumerics: "Sale Price / Unit" → `salepriceunit`. Map the sheet columns:

  Order Date, Order ID, Product Name, Product SKU, Order Status, Payout Status, Currency, Quantity, Sale Price / Unit, Buying Price / Unit, Packaging Cost, Shipping Cost, Other Order Costs, Referral / Commission Fee, Transaction Fee, Fulfillment Fee, Affiliate Commission, Advertising Cost, Other Platform Fees, Sales Tax / VAT, Tax Treatment, Refund to Buyer, Notes.

  Expenses: Expense Date, Expense Name, Expense Category, Description, Billing Type, Amount, Currency, Payment Status, Payment Method.
- Numbers: accept `1,234.50`, `(12.00)` as negative, `$5`, and `-` or empty as 0.
- Dates: accept `2026-11-08`, `8 Nov 2026`, and `08/11/2026` (day first).
- Match enums case-insensitively, with sensible fallbacks.
- Skip example rows: order IDs starting with "EXAMPLE", or descriptions containing "Example row". Skip blank rows. Collect per-row errors instead of failing the whole import.
- **Deduplicate**: skip orders whose Order ID already exists (or repeats within the file). Skip expenses with the same date + name (case-insensitive) + amount. Importing twice must be safe.
- The import modal explains: open the tab → File → Download → CSV → pick the file. It then shows how many rows were imported and skipped, plus any row errors.

## 10. Scripts, tests and docs

- `package.json` scripts: `dev`, `build`, `start`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `seed` (`tsx scripts/seed.ts`).
- `scripts/seed.ts` reads `.env.local` and upserts about 6 example orders (including a returned and a cancelled one) and 3 expenses dated relative to today, all marked "Example".
- Tests (Vitest) must cover at least:
  - The reference case in section 4
  - Both tax treatments and the default override
  - Cancelled orders zeroed and Excluded
  - A full refund on a return giving a loss
  - Estimated basis for awaiting payout and shipped orders
  - Low margin flag
  - Currency conversion and missing-rate flag
  - NaN-safe empty numbers
  - `summarize` keeping business expenses out of gross profit
  - Date filtering
  - 12 monthly rows with `changeVsPrior`
  - Product grouping and sorting
  - Every period type, leap-year month end, invalid dates, and time zone handling for "today"
  - The CSV parser, number and date parsing, and both importers, including banner rows and skipped example rows
- `README.md`: features, the calculation rules in plain language, MongoDB Atlas setup, environment variables, local run, Vercel deployment (allow `0.0.0.0/0` in Atlas), importing from the Google Sheet, the API table, and the project layout.
- `.gitignore`: node_modules, .next, .env, .env.local, tsbuildinfo, next-env.d.ts.

## 11. Definition of done

1. `npm test`, `npm run typecheck` and `npm run build` all pass with no errors.
2. With a real `MONGODB_URI`, you can add, edit and delete orders and expenses, the dashboard and reports update, and the reference case shows 23.18 profit and (25.82) net profit after a $49 expense.
3. Sign-in works when `APP_PASSWORD` is set, and every page and API route is blocked without it.
4. Importing the Google Sheet CSVs works, and importing the same file twice adds nothing.
5. The layout works on a phone (sidebar collapses, tables scroll horizontally).

## 12. Ideas for later (do not build unless asked)

- Per-user accounts and multiple shops
- Automatic order sync from the TikTok Shop Seller API
- CSV or Excel export of every table
- Recurring expense templates that create the monthly row automatically
- Restock handling for returned items
