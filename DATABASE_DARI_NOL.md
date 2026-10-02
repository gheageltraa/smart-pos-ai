# Database Kopipintar dari Nol

## Yang harus dilakukan

1. Buat project di https://supabase.com.
2. Buka menu **SQL Editor**.
3. Jalankan `supabase/schema.sql`.
4. Jalankan `supabase/functional_features.sql`.
5. Ambil **Project URL** dan **anon key** dari **Project Settings > API**.
6. Ambil **service role key** untuk server saja; jangan masukkan ke browser.
7. Isi environment variables di hosting atau file lokal yang tidak di-commit.
8. Jalankan aplikasi dengan `pnpm install`, `pnpm check`, `pnpm test`, `pnpm build`, lalu `pnpm start`.

## Alur halaman aplikasi

Saat membuka website, halaman pertama adalah **Login/Signup**. Kamu bisa membuat akun email/password, masuk dengan Google jika Supabase Auth sudah diaktifkan, atau memilih mode demo untuk presentasi lomba. Setelah berhasil masuk, user melihat **Dashboard utama**. Dari tombol **Transaksi baru** atau menu **POS / Kasir**, user berpindah ke page kedua untuk melakukan transaksi.

## Apa itu database?

Database adalah tempat menyimpan data secara permanen. Kopipintar menyimpan outlet, user, produk, stok, supplier, transaksi POS, dan purchase order. Tanpa database, data demo hanya tersimpan di browser dan tidak bisa dipakai bersama oleh beberapa perangkat.

## Apa itu Supabase?

Supabase menyediakan PostgreSQL database, login, API, dan dashboard. Project Supabase adalah database online milik kamu.

## Tabel utama

- `outlets`: daftar cabang.
- `outlet_members`: user, outlet, dan role.
- `products`: SKU, harga, dan stok.
- `suppliers`: vendor dan kontak.
- `sales_transactions`: header transaksi POS.
- `sales_transaction_items`: produk di dalam transaksi.
- `purchase_orders`: header pesanan pembelian.
- `purchase_order_items`: detail produk pesanan.

Satu transaksi bisa memiliki banyak item. Karena itu data transaksi memakai satu tabel header dan satu tabel detail.

## Primary key dan foreign key

**Primary key** adalah ID unik sebuah baris, misalnya `products.id`. **Foreign key** adalah kolom yang menunjuk ke tabel lain, misalnya `sales_transaction_items.product_id` menunjuk ke `products.id`.

## Environment variables

```bash
SUPABASE_URL=https://PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=rahasia-untuk-server
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=anon-key-untuk-browser
```

`SUPABASE_SERVICE_ROLE_KEY` hanya boleh berada di backend. `VITE_SUPABASE_ANON_KEY` boleh berada di frontend, tetapi tetap gunakan RLS/policy untuk keamanan.

## Google Auth

1. Buka Supabase **Authentication > Providers > Google**.
2. Aktifkan Google.
3. Buat OAuth Client ID/Secret di Google Cloud Console.
4. Masukkan Client ID/Secret ke Supabase.
5. Tambahkan callback URL Supabase yang ditampilkan pada halaman provider Google ke Google Cloud.
6. Di Supabase **Authentication > URL Configuration**, isi Site URL dan Redirect URLs untuk localhost/deployment.
7. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
8. Buka Kopipintar > **Settings** > **Masuk dengan Google**.

Jika variable belum diisi, tombol akan memberi pesan konfigurasi. Login Google menyimpan session Supabase di browser. Endpoint backend yang benar-benar privat tetap perlu verifikasi JWT Supabase di server.

## Cara kerja transaksi POS

Kasir memilih produk, browser mengirim item ke backend, backend membuat transaksi dan detail transaksi, lalu stok dikurangi. Setelah refresh, data diambil kembali dari Supabase.

## Checklist lomba

- [ ] Dua SQL file sudah dijalankan.
- [ ] URL dan keys benar.
- [ ] Service role key tidak masuk GitHub/browser.
- [ ] Google Provider aktif dan callback benar.
- [ ] Login Google berhasil.
- [ ] Produk bisa ditambah.
- [ ] Test transaksi mengurangi stok.
- [ ] Purchase order tersimpan setelah refresh.
