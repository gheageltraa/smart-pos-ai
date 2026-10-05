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

Script membuat dan mengisi:

- `categories`
- `products`
- `suppliers`
- `sales`
- `sale_items`

Seed demo berisi 15 produk, 5 supplier, dan 120 transaksi dengan 360 item transaksi dalam rentang 30 hari. RLS diaktifkan dan policy CRUD anon/authenticated dibuat untuk kebutuhan prototype lomba. Untuk produksi, policy harus dibatasi berdasarkan user dan outlet membership.

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
