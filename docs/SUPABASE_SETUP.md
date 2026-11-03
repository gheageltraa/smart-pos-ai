# Supabase setup for static deployment

Kopipintar is built as a static Vite frontend. Authentication and application data use Supabase Auth and `@supabase/supabase-js` directly in the browser; Vercel does not need an Express/tRPC server.

## 1. Prepare the database

For a new demo database, bootstrap the app tables and sample data with `pnpm db:setup`. This one-time script requires a direct Supabase PostgreSQL connection string in `SUPABASE_DB_URL`; do not set it in Vercel or the browser.

After the app tables exist, run [`../supabase/static_frontend.sql`](../supabase/static_frontend.sql), followed by [`../supabase/reporting.sql`](../supabase/reporting.sql), in the Supabase SQL Editor. The first file adds direct-client RLS policies and atomic checkout. The reporting migration adds live dashboard/reporting views and one-time atomic PO receipt. Optionally run `../supabase/seed_demo_sales.sql` last only when marked demo history is needed.

- Admin: product, bundle, supplier, and purchase-order management plus sales-history reads.
- Kasir: product/bundle reads, POS checkout, and access only to their own sales.
- Both roles: profile self-read; no client operation can change a profile role.

The older SQL files in `supabase/` are retained. The app bootstrap in `scripts/db-setup.js` uses a different legacy schema shape, so do not run both bootstrap paths on the same fresh database without reviewing their existing tables first.

## 2. Create Supabase Auth users

Provision users with the existing Admin API setup script, not from browser code:

```text
SUPABASE_URL=https://PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server-only-key
pnpm auth:seed
```

The script creates `admin@kopipintar.com` / `adminkopipintar` and `kasir@kopipintar.com` / `kasirkopipintar`, and writes each user's role to `profiles`. The service-role key is for this local provisioning step only. Never set it as a `VITE_*` variable or add it to Vercel.

## 3. Configure local or Vercel frontend

Set only:

```text
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Vercel settings:

- **Build Command:** `pnpm build`
- **Output Directory:** `dist/public`

The existing `vercel.json` sends unmatched routes to `/index.html`.

## 4. Local quality checks

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

The optional Google button uses Supabase Auth's Google provider. Configure its provider and redirect URLs in Supabase if you want to enable it.
