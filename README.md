# Kopipintar — Smart POS & AI Inventory Forecast

Kopipintar adalah sistem operasi ringan untuk UMKM kedai kopi. Aplikasi menggabungkan POS, inventory, purchase order, laporan, dan AI Forecast agar pemilik kedai dapat mengambil keputusan restock berdasarkan data transaksi, bukan intuisi semata.

## Demo

- **Website:** gunakan checkpoint WebDev project ini atau deploy hasil ZIP secara mandiri.
- **Akun admin:** `admin` / `adminkopipintar`
- **Akun kasir:** `kasir` / `kasirkopipintar`

Akun `admin` dapat mengakses Dashboard, POS, Inventory, AI Forecast, Purchase Order, Supplier, Reports, Settings, dan Help Center. Akun `kasir` hanya mendapatkan akses POS/Kasir.

## Tech stack & arsitektur

- **Frontend:** Vite, React, TypeScript, Tailwind CSS, Recharts, Lucide React.
- **Data & Auth:** Supabase Auth, Supabase PostgreSQL, Row Level Security.
- **Backend:** tRPC/Express fallback adapter untuk deployment yang memakai server runtime.
- **Database logic:** PostgreSQL trigger `sale_item_decrements_stock` otomatis mengurangi `products.stock` setiap `sale_items` dibuat.
- **Deployment:** ZIP self-hostable; frontend memakai `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.

Alurnya: browser membaca session Supabase → profile menentukan role → RLS membatasi operasi → POS membuat `sales` dan `sale_items` → trigger database mengurangi stock → Forecast membaca histori transaksi.

## AI Forecasting

Forecast menghitung **Average Daily Sales** dari transaksi historis 30 hari. Rumus sederhananya:

```text
Average Daily Sales = total quantity terjual 30 hari / 30
Stock Coverage = stock saat ini / Average Daily Sales
Predicted Stockout Date = hari ini + ceil(Stock Coverage)
```

Risk level ditentukan dari stock coverage dan minimum stock. Detail forecast menampilkan alasan dalam bahasa sederhana, contoh: “Penjualan rata-rata 4 kg/hari, stok 12 kg, maka diprediksi habis dalam 3 hari. Risk: HIGH.” Tren 7 hari terakhir dan lead time supplier membantu menentukan rekomendasi jumlah restock.

## Fitur utama

1. Login username/email dengan Supabase Auth.
2. RBAC admin/kasir dan RLS database.
3. POS tablet: search, kategori, product card, cart, quantity, tax, Cash/QRIS/Debit, checkout.
4. Inventory CRUD dan stock adjustment.
5. AI Forecast dengan explainability.
6. Purchase Draft dengan supplier, jumlah rekomendasi, harga estimasi, alasan, dan status Draft/Ordered/Received.
7. Reports dengan chart tren penjualan, produk terlaris, Profit & Loss, dan Export CSV.
8. Settings, Help Center, multi-outlet demo, dan mode demo.

## Menjalankan lokal

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

Jangan pernah menaruh `SUPABASE_DB_URL`, database password, atau service-role key ke `VITE_*`, browser, atau repository publik.

## Struktur data

- `profiles`: username, nama, dan role pengguna.
- `categories`: kategori produk.
- `products`: SKU, stok, harga, supplier, daily sales, dan trend.
- `suppliers`: kontak supplier dan lead time.
- `sales`: header transaksi.
- `sale_items`: item transaksi dan sumber trigger stok.
- `purchase_orders`: draft/order restock.

## Batasan prototype

Payment gateway masih berupa adapter demo; integrasi QRIS/debit produksi memerlukan provider dan credential resmi. RLS sudah role-aware untuk demo, tetapi deployment multi-outlet produksi sebaiknya menambah membership per outlet dan audit log.
