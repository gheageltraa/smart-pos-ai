# Supabase backend setup

The app is **Supabase-ready**. The server prefers Supabase when both variables below are present, then falls back to the existing MySQL connection, then demo data:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in `VITE_*` variables or browser code.

## 1. Create the database

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run [`supabase/schema.sql`](supabase/schema.sql).
4. Run [`supabase/functional_features.sql`](supabase/functional_features.sql).
5. Confirm the seeded outlets and suppliers exist.

The schema includes users, outlets, outlet memberships, products, purchase orders, purchase-order items, suppliers, sales transactions, and transaction items. Row Level Security is enabled; the Node server uses the service-role key and performs protected queries server-side.

After setup, the following actions persist to Supabase: POS checkout and stock deduction, inventory adjustment, product creation, supplier creation, purchase-order creation, and purchase-order status changes.

## 2. Configure the server

Copy the ZIP contents to your host and set these server environment variables:

```bash
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
JWT_SECRET=your-long-random-secret
VITE_APP_ID=your-manus-app-id
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im
OAUTH_SERVER_URL=https://oauth.manus.im
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=Your Name
```

The app supports Google Auth through Supabase Auth as an additional browser login. Enable **Authentication → Providers → Google**, add your Google OAuth Client ID/Secret, and configure the deployed URL plus `http://localhost:3000` under **Authentication → URL Configuration → Redirect URLs**. Then use **Settings → Masuk dengan Google**.

Manus OAuth remains available as a legacy login path. Supabase is the persistent application data backend. For fully private production endpoints, add Supabase Auth JWT verification to the server and tighten RLS policies.

Read [`DATABASE_DARI_NOL.md`](DATABASE_DARI_NOL.md) for the beginner setup guide.

## 3. Run locally

```bash
pnpm install
pnpm check
pnpm test
pnpm build
pnpm start
```

The server serves the built frontend and exposes the typed tRPC API under `/api/trpc`.

## 4. Deploy

Use any Node 22 host that supports a long-running Express process:

- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Start command: `pnpm start`
- Health check: `/`
- Set the environment variables above in the host dashboard.

For a static-only host, deploy the `dist/public` folder, but the backend features will not work there; use a Node host for the complete app.
