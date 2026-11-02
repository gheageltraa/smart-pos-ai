# Kopipintar — Supabase frontend

The production app is a static Vite/React frontend using `@supabase/supabase-js`. No Manus OAuth, tRPC API, Express process, or server runtime is needed by the deployed app.

## Direct Supabase features

- Username or email/password login uses Supabase Auth. Usernames map to `@kopipintar.com`.
- Remember Me stores the username in localStorage; it never stores the password.
- Supabase profiles determine Admin/Kasir role. Kasir is restricted to POS in the UI and by RLS.
- Inventory, suppliers, purchase orders, and product reads use Supabase queries.
- Checkout calls the `create_pos_sale` database function to validate current prices/stock and atomically write a sale and its items.
- Admin forecast reads sales history from Supabase; the explanation is calculated locally.
- Reports currently display sample data rather than live Supabase reports.

## Database and account setup

For a new demo project, run `pnpm db:setup` with `SUPABASE_DB_URL` available only in the setup environment. Then run [`../supabase/static_frontend.sql`](../supabase/static_frontend.sql) in the Supabase SQL Editor. Provision demo accounts with `pnpm auth:seed` using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` locally. Neither server secret is needed by the frontend or Vercel.

The migration enables RLS, admin-only inventory/supplier/order management, role-validated checkout, and ownership checks on cashier sales. Keep it applied before deploying the client.

New Supabase Auth users receive a `pending` profile through a database trigger; the migration also adds pending profiles for existing Auth users that do not yet have one. OAuth metadata cannot grant a role. Pending accounts can read only their own profile and must be explicitly approved by an administrator by assigning `kasir` or `admin` to their profile. The app grants no workspace access until that approval.

## Google sign-in setup

1. In Google Cloud Console, configure the OAuth consent screen and create a Web application OAuth client. Add the Kopipintar production domain (and local development origin, if needed) to **Authorized JavaScript origins**.
2. Add the Supabase callback URL to the Google OAuth client's **Authorized redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase Dashboard → **Authentication → Providers → Google**, enable Google and enter the Google client ID and client secret. Keep the client secret in Supabase only; never put it in Vite environment variables or frontend code.
4. In Supabase Dashboard → **Authentication → URL Configuration**, set **Site URL** to the primary deployed app origin, for example `https://your-app.vercel.app`. Add each allowed app origin under **Redirect URLs**, including the production domain and any preview/local origins you intend to use (for example `http://localhost:5173`). The frontend sends the current `window.location.origin` as the OAuth redirect target, so each origin must be allowlisted.

## Frontend environment

Vercel and local frontend builds need only:

```text
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Use **Build Command** `pnpm build` and **Output Directory** `dist/public`. `vercel.json` contains the SPA rewrite.

## Local commands

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
```
