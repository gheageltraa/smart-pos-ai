# Database Kopipintar dari Nol

## Setup Supabase

1. Buat project di Supabase.
2. Untuk database demo baru, jalankan `pnpm db:setup` dengan `SUPABASE_DB_URL` hanya di environment lokal/setup. Script ini membuat tabel aplikasi dan mengisi data demo.
3. Jalankan [`supabase/static_frontend.sql`](../supabase/static_frontend.sql), lalu [`supabase/reporting.sql`](../supabase/reporting.sql) di Supabase SQL Editor setelah tabel aplikasi tersedia.
4. Provision akun demo lewat `pnpm auth:seed` dengan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` hanya di terminal lokal. Script membuat akun Admin dan Kasir beserta `profiles.role`.
5. Set variabel frontend di Vercel atau file lokal yang tidak di-commit:

```text
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=anon-key-untuk-browser
```

`SUPABASE_DB_URL` dan `SUPABASE_SERVICE_ROLE_KEY` bukan variabel frontend dan tidak boleh dimasukkan ke `VITE_*` atau Vercel untuk deployment static.

Jalankan [`../supabase/static_frontend.sql`](../supabase/static_frontend.sql) sebelum memakai aplikasi. Migration ini menyiapkan RLS untuk peran Admin/Kasir dan function checkout atomik. Jangan jalankan ulang bootstrap/seed pada database produksi tanpa meninjau dampak perubahan data.

## Alur halaman

Login menerima username atau email dan password lewat Supabase Auth. Remember Me menyimpan username saja di localStorage. Admin memiliki seluruh menu; Kasir hanya dapat memakai POS. Role berasal dari `profiles.role`, dan database RLS tetap membatasi akses meskipun UI dimodifikasi.

User Auth baru mendapat role `pending` dan belum dapat mengakses data aplikasi. Administrator harus menyetujui akun dengan menetapkan role `kasir` atau `admin`.

POS membuat transaksi melalui PostgreSQL function `create_pos_sale`, yang membaca harga dan stok aktual, menyimpan header serta item dalam satu transaksi, dan mengurangi stok melalui trigger. Inventory, supplier, dan purchase order diakses melalui Supabase langsung.

Dashboard, laporan, dan forecast memakai transaksi serta stok aktual dari Supabase. Revenue/profit bundle tetap pada item bundle yang terjual; pemakaian komponen bundle ikut dihitung untuk forecast. SQL opsional `seed_demo_sales.sql` hanya untuk demo dan memberi prefix `DEMO-` pada transaksi yang dapat dihapus terpisah.

## Apa itu database dan Supabase?

Database menyimpan data secara permanen agar aplikasi dan perangkat yang berbeda dapat memakai data yang sama. Kopipintar menyimpan user, outlet, produk, stok, supplier, transaksi, dan purchase order di PostgreSQL.

Supabase menyediakan PostgreSQL, autentikasi, dan API untuk database tersebut. Frontend menggunakan Supabase Auth dan `@supabase/supabase-js`; akses data browser dibatasi oleh Row Level Security (RLS).

## Tabel utama

- `profiles`: username, nama, dan role Supabase Auth.
- `products`, `bundle_items`: katalog dan stok.
- `suppliers`: vendor dan kontak (Admin).
- `sales`, `sale_items`: transaksi POS.
- `purchase_orders`: draft/order restock (Admin).

Satu transaksi dapat memiliki banyak item. Baris item menunjuk ke transaksi dan produk melalui foreign key.

### Primary key dan foreign key

Primary key adalah ID unik untuk setiap baris, misalnya `products.id`. Foreign key adalah kolom yang merujuk ke baris lain, misalnya `sale_items.product_id` merujuk ke `products.id`. Hubungan ini membantu database menjaga konsistensi data.

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
