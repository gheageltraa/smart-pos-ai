# Kopipintar — Supabase Frontend Integration

Prompt terbaru sudah diimplementasikan dengan pendekatan **Vite + `@supabase/supabase-js` langsung di frontend**. Prisma tidak digunakan.

## Yang sudah dibuat

- `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` terdaftar sebagai environment project.
- Supabase Auth session dibaca saat aplikasi dibuka dan dipantau dengan `onAuthStateChange`.
- Halaman internal tetap tertutup sebelum login atau mode demo aktif.
- Produk Inventory dibaca langsung dari tabel `products`.
- Average Daily Sales dan tren tujuh hari dihitung dari `sales` dan `sale_items`.
- POS memasukkan transaksi ke `sales`, memasukkan item ke `sale_items`, lalu mengurangi stok `products`.
- Tambah produk dan adjustment stok menggunakan Supabase langsung.
- Loading badge muncul saat data live sedang diambil.
- Toast sukses/gagal tetap digunakan setelah transaksi dan perubahan inventory.

## Database setup

Script setup berada di `scripts/db-setup.js`. Password database tidak disimpan di Git atau source code. Jalankan dengan environment variable runtime:

```bash
export SUPABASE_DB_URL="postgresql://..."
pnpm db:setup
unset SUPABASE_DB_URL
```

`db:setup` tidak pernah menulis langsung ke `auth.users`. Setelah schema selesai, buat akun demo melalui API resmi GoTrue Admin:

```bash
export SUPABASE_URL="https://PROJECT_ID.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="server-only-service-role-key"
pnpm auth:seed
unset SUPABASE_SERVICE_ROLE_KEY
```

Script `scripts/create-users.js` memakai `supabase.auth.admin.createUser({ email, password, email_confirm: true })`, lalu menyimpan `user.id` ke `profiles`. Service-role key hanya boleh ada di server/terminal sementara dan tidak boleh masuk ke `VITE_*` atau repository.

Script membuat dan mengisi:

- `categories`
- `products`
- `suppliers`
- `sales`
- `sale_items`
- `profiles` dan `purchase_orders`

Seed demo berisi 15 produk, 5 supplier, dan 120 transaksi dengan 360 item transaksi dalam rentang 30 hari. RLS role-aware membatasi operasi admin/kasir. Trigger PostgreSQL `sale_item_decrements_stock` mengurangi stok setelah `sale_items` dibuat.

## Alur login dan demo

1. Pengguna membuka website dan melihat Login/Signup.
2. Pengguna dapat masuk dengan email/password atau Google Auth.
3. Jika Supabase Auth belum siap, pengguna dapat memilih **Lanjutkan sebagai Demo**.
4. Dashboard, POS, Inventory, AI Forecast, dan halaman internal hanya dirender setelah session atau demo state tersedia.
5. Tombol logout menghapus session Supabase/Manus atau demo state.

## Local deployment

```bash
pnpm install
export VITE_SUPABASE_URL="https://PROJECT_ID.supabase.co"
export VITE_SUPABASE_ANON_KEY="public-anon-key"
export SUPABASE_DB_URL="postgresql://..."
pnpm db:setup
pnpm check
pnpm test
pnpm build
pnpm start
```

`SUPABASE_DB_URL` hanya diperlukan saat menjalankan setup/seed. Jangan memasukkan direct database URL atau service-role key ke variabel `VITE_*`, browser, atau repository publik.
