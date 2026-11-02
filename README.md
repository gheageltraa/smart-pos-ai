# Kopipintar — Smart POS & AI Inventory Forecast

Kopipintar is a static Vite/React application for coffee-shop POS, inventory, purchase orders, and stock forecasting. The browser uses Supabase Auth and `@supabase/supabase-js` directly; the deployed app does not run an Express or tRPC server.

## Roles

- **Admin:** Dashboard, POS, Inventory, Forecast, Purchase Orders, Suppliers, Reports, Settings, and Help.
- **Kasir:** POS only.

The UI role comes from `profiles.role`; PostgreSQL Row Level Security must be enabled using [`supabase/static_frontend.sql`](supabase/static_frontend.sql).

## Stack and data flow

- **Frontend:** Vite, React 19, TypeScript, Tailwind CSS, Recharts, and Lucide.
- **Auth and data:** Supabase Auth, PostgreSQL, RLS, and `@supabase/supabase-js`.
- **Checkout:** The browser calls the `create_pos_sale` PostgreSQL function. It validates stock and prices, writes the sale and its items atomically, and the database trigger reduces stock.
- **Forecast:** Inventory and (for Admin) sales history are read from Supabase; the explanation is calculated in the browser.
- **Reports:** Current report charts and financial totals are sample UI data, not live Supabase reports.

## Run locally

Set the two public frontend variables, then run:

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
```

The production frontend is emitted to `dist/public`. Login requires valid Supabase Auth accounts and profiles.

## Supabase setup

For a new demo database, `pnpm db:setup` bootstraps and seeds tables and requires `SUPABASE_DB_URL` only in the setup environment. Then run [`supabase/static_frontend.sql`](supabase/static_frontend.sql) in the Supabase SQL Editor and provision accounts with `pnpm auth:seed`. The account provisioning script requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the local setup environment only.

For existing databases, preserve existing data and apply the migration after confirming the app tables exist. The older SQL files in `supabase/` remain available; do not combine incompatible schema bootstraps.

## Vercel

- **Build Command:** `pnpm build`
- **Output Directory:** `dist/public`

Set only these frontend environment variables in Vercel:

```text
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Never put a service-role key, database URL/password, or other secret in a `VITE_*` variable or browser code. RLS—not the anon key—protects database access.
