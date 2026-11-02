# Database Kopipintar dari Nol

## Setup Supabase

1. Buat project di Supabase.
2. Untuk database demo baru, jalankan `pnpm db:setup` dengan `SUPABASE_DB_URL` hanya di environment lokal/setup. Script ini membuat tabel aplikasi dan mengisi data demo.
3. Jalankan [`supabase/static_frontend.sql`](supabase/static_frontend.sql) di Supabase SQL Editor setelah tabel aplikasi tersedia.
4. Provision akun demo lewat `pnpm auth:seed` dengan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` hanya di terminal lokal. Script membuat akun Admin dan Kasir beserta `profiles.role`.
5. Set variabel frontend di Vercel atau file lokal yang tidak di-commit:

```text
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=anon-key-untuk-browser
```

`SUPABASE_DB_URL` dan `SUPABASE_SERVICE_ROLE_KEY` bukan variabel frontend dan tidak boleh dimasukkan ke `VITE_*` atau Vercel untuk deployment static.

Jalankan `supabase/static_frontend.sql` sebelum memakai aplikasi. Migration ini menyiapkan RLS untuk peran Admin/Kasir dan function checkout atomik. Jangan jalankan ulang bootstrap/seed pada database produksi tanpa meninjau dampak perubahan data.

## Alur halaman

Login menerima username atau email dan password lewat Supabase Auth. Remember Me menyimpan username saja di localStorage. Admin memiliki seluruh menu; Kasir hanya dapat memakai POS. Role berasal dari `profiles.role`, dan database RLS tetap membatasi akses meskipun UI dimodifikasi.

POS membuat transaksi melalui PostgreSQL function `create_pos_sale`, yang membaca harga dan stok aktual, menyimpan header serta item dalam satu transaksi, dan mengurangi stok melalui trigger. Inventory, supplier, dan purchase order diakses melalui Supabase langsung.

## Tabel utama

- `profiles`: username, nama, dan role Supabase Auth.
- `products`, `bundle_items`: katalog dan stok.
- `suppliers`: vendor dan kontak (Admin).
- `sales`, `sale_items`: transaksi POS.
- `purchase_orders`: draft/order restock (Admin).

File SQL lama tetap disimpan. Skema lama yang memakai `sales_transactions` tidak digunakan langsung oleh frontend aktif tanpa migrasi `static_frontend.sql`.

## Deploy ke Vercel

- **Build Command:** `pnpm build`
- **Output Directory:** `dist/public`
- **Environment:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

`vercel.json` menulis ulang route SPA ke `/index.html`.

## Checklist

- [ ] Tabel aplikasi tersedia dan `supabase/static_frontend.sql` sudah dijalankan.
- [ ] Admin/Kasir memiliki akun Auth serta baris `profiles` dengan role benar.
- [ ] Hanya `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` yang disetel untuk frontend.
- [ ] RLS menolak akses Admin dari akun Kasir.
- [ ] Checkout berhasil dan stok berubah setelah refresh.
- [ ] Vercel memakai `pnpm build` dan `dist/public`.
