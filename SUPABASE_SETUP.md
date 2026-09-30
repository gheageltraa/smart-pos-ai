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
4. Confirm the seeded outlets exist: `KB-01`, `KB-02`, and `KB-03`.

The schema includes users, outlets, outlet memberships, products, purchase orders, and purchase-order items. Row Level Security is enabled; the Node server uses the service-role key and performs protected queries server-side.

## 2. Configure the server

Copy the ZIP contents to your host and set these server environment variables:

```bash
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET=your-long-random-secret
VITE_APP_ID=your-manus-app-id
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im
OAUTH_SERVER_URL=https://oauth.manus.im
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=Your Name
```

The current authentication layer is Manus OAuth. Supabase is the persistent application data backend. If you want fully independent authentication later, replace the Manus session middleware with Supabase Auth JWT verification.

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
