import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  adjustSupabaseProductStock,
  createSupabaseSale,
  getCurrentProfile,
  insertSupabasePurchaseOrder,
  insertSupabaseProduct,
  insertSupabaseSupplier,
  isSupabaseAuthConfigured,
  listSupabasePurchaseOrders,
  listSupabaseProducts,
  listSupabaseSuppliers,
  signInWithUsername,
  supabase,
  type KopipintarProfile,
  type SupabaseProduct,
  updateSupabasePurchaseOrderStatus,
  updateSupabasePurchaseOrder,
  deleteSupabasePurchaseOrder,
  deleteSupabaseProduct,
  deleteSupabaseSupplier,
  getSupabaseTaxRate,
  listSupabaseCategories,
  listSupabaseOutlets,
  receiveSupabasePurchaseOrder,
  updateSupabaseSupplier,
  type SupabaseCategory,
  type SupabaseSupplier,
} from "@/lib/supabase";
import {
  resolveDisplayName,
} from "@/lib/datetime";
import { calculateForecast } from "@/lib/analytics";
import type { Product, PurchaseOrder } from "@/lib/models";
import DashboardLive from "@/components/DashboardLive";
import ReportsLive from "@/components/ReportsLive";
import ForecastLive from "@/components/ForecastLive";
import SuppliersLive from "@/components/SuppliersLive";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  Calculator,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Coffee,
  CreditCard,
  Eye,
  EyeOff,
  FileBarChart,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Minus,
  PackagePlus,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  Users,
  X,
  Zap,
  Receipt,
  Trash2,
  Coffee as CoffeeIcon,
  CupSoda,
  CakeSlice,
  Croissant,
  Pizza,
  IceCreamBowl,
  Package,
  GlassWater,
  Sandwich,
  Cookie,
  Soup,
  Milk,
  Citrus,
  Pencil,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { calculateChange, canAddToCart, quickCashOptions } from "@shared/pos";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PageKey =
  | "dashboard"
  | "pos"
  | "inventory"
  | "forecast"
  | "orders"
  | "suppliers"
  | "reports"
  | "settings"
  | "help";
type Risk = "Tinggi" | "Sedang" | "Sehat" | "Habis";
type OrderStatus = "Draft" | "Ordered" | "Received";

type CartItem = Product & { qty: number };

type Toast = { tone: "success" | "info" | "warning"; message: string };
type OutletOption = {
  id: number;
  name: string;
  code: string;
  city: string;
  active: boolean;
};

const navItems: {
  id: PageKey;
  label: string;
  icon: LucideIcon;
  badge?: string;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pos", label: "POS / Kasir", icon: Calculator },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "forecast", label: "AI Forecast", icon: Sparkles },
  { id: "orders", label: "Purchase Order", icon: ClipboardList },
  { id: "suppliers", label: "Supplier", icon: Truck },
  { id: "reports", label: "Reports", icon: FileBarChart },
];

const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace("Rp", "Rp ");
const number = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value);

const iconOptions = [
  { name: "Coffee", label: "Kopi", Icon: CoffeeIcon },
  { name: "CupSoda", label: "Minuman", Icon: CupSoda },
  { name: "CakeSlice", label: "Kue", Icon: CakeSlice },
  { name: "Croissant", label: "Croissant", Icon: Croissant },
  { name: "Pizza", label: "Pizza", Icon: Pizza },
  { name: "IceCreamBowl", label: "Es krim", Icon: IceCreamBowl },
  { name: "Package", label: "Paket", Icon: Package },
  { name: "GlassWater", label: "Air", Icon: GlassWater },
  { name: "Sandwich", label: "Sandwich", Icon: Sandwich },
  { name: "Cookie", label: "Cookie", Icon: Cookie },
  { name: "Soup", label: "Sup", Icon: Soup },
  { name: "Milk", label: "Susu", Icon: Milk },
  { name: "Citrus", label: "Citrus", Icon: Citrus },
] as const;
const iconByEmoji: Record<string, string> = {
  "☕": "Coffee",
  "🍵": "CupSoda",
  "🧊": "GlassWater",
  "🥐": "Croissant",
  "🍫": "CakeSlice",
  "💧": "GlassWater",
  "🍯": "CupSoda",
  "🍮": "CakeSlice",
  "🥖": "Sandwich",
  "🫗": "CupSoda",
  "🍋": "Citrus",
};
function ProductIcon({
  product,
  size = 26,
}: {
  product: Pick<Product, "iconName" | "emoji">;
  size?: number;
}) {
  const selected =
    iconOptions.find(
      option =>
        option.name ===
        (product.iconName || iconByEmoji[product.emoji] || "Package")
    ) || iconOptions.find(option => option.name === "Package")!;
  return <selected.Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function mapSupabaseProduct(row: SupabaseProduct): Product {
  return {
    id: Number(row.id),
    name: row.name,
    sku: row.sku,
    category: row.category,
    unit: row.unit,
    stock: Number(row.stock),
    minStock: Number(row.min_stock),
    cost: Number(row.cost),
    price: Number(row.price),
    categoryId: row.category_id ? Number(row.category_id) : null,
    supplier: row.supplier || "",
    supplierLeadTimeDays: null,
    dailySales: Number(row.daily_sales || 0),
    historyDays: Number(row.history_days || 0),
    trend: typeof row.trend === "number" ? row.trend : null,
    emoji: row.emoji || "📦",
    iconName: row.icon_name || null,
    isBundle: Boolean(row.is_bundle),
    bundleItems: (row.bundle_items || []).map((item: any) => ({
      componentProductId: Number(item.component_product_id),
      quantity: Number(item.quantity),
    })),
  };
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map(row =>
      row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getRisk(product: Product): Risk {
  if (product.stock === 0) return "Habis";
  if (product.stock <= product.minStock / 2)
    return "Tinggi";
  if (product.stock <= product.minStock) return "Sedang";
  return "Sehat";
}

function getCoverage(product: Product) {
  return product.dailySales > 0 ? product.stock / product.dailySales : Infinity;
}

function getStockoutDate(product: Product) {
  if (product.dailySales <= 0) return "Belum cukup data";
  const date = new Date();
  date.setDate(date.getDate() + Math.max(1, Math.ceil(getCoverage(product))));
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button aria-label={label} onClick={onClick} className="icon-button">
      {children}
    </button>
  );
}

function StatusBadge({ risk }: { risk: Risk }) {
  const styles: Record<Risk, string> = {
    Tinggi: "badge badge-red",
    Sedang: "badge badge-amber",
    Sehat: "badge badge-green",
    Habis: "badge badge-red",
  };
  return (
    <span className={styles[risk]}>{risk === "Tinggi" ? "Kritis" : risk}</span>
  );
}

function Sparkline({
  points,
  color = "#4f8a77",
}: {
  points: number[];
  color?: string;
}) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const width = 88;
  const height = 32;
  const coords = points
    .map(
      (point, index) =>
        `${(index / (points.length - 1)) * width},${height - ((point - min) / Math.max(1, max - min)) * 24 - 4}`
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="sparkline"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
}

function AuthLanding({
  onAuthenticated,
  onGoogle,
  onToast,
}: {
  onAuthenticated: () => void;
  onGoogle: () => void;
  onToast: (toast: Toast) => void;
}) {
  const rememberedLoginKey = "kopipintar-remembered-login";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    try {
      const remembered = JSON.parse(
        localStorage.getItem(rememberedLoginKey) || "null"
      ) as { username?: string; rememberMe?: boolean } | null;
      if (remembered?.rememberMe && remembered.username) {
        setUsername(remembered.username);
        setRememberMe(true);
      }
    } catch {
      localStorage.removeItem(rememberedLoginKey);
    }
  }, []);

  const submit = async () => {
    setLoginError(null);
    if (!supabase) {
      const message =
        "Supabase Auth belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.";
      setLoginError(message);
      return onToast({ tone: "warning", message });
    }
    if (!username.trim() || password.length < 6) {
      const message = "Isi username/email dan password minimal 6 karakter.";
      setLoginError(message);
      return onToast({ tone: "warning", message });
    }
    setBusy(true);
    try {
      const result = await signInWithUsername(username.trim(), password);
      if (result.error) {
        setLoginError(result.error.message);
        onToast({ tone: "warning", message: result.error.message });
        return;
      }
      if (rememberMe) {
        localStorage.setItem(
          rememberedLoginKey,
          JSON.stringify({ username: username.trim(), rememberMe: true })
        );
      } else {
        localStorage.removeItem(rememberedLoginKey);
      }
      onToast({ tone: "success", message: "Login berhasil." });
      onAuthenticated();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Login gagal. Silakan coba lagi.";
      setLoginError(message);
      onToast({ tone: "warning", message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--paper)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-[980px] grid-cols-1 gap-4 md:grid-cols-[1.1fr_.9fr] md:gap-6">
        <section className="panel hidden min-h-[520px] flex-col justify-between p-6 sm:p-8 md:flex lg:p-[34px]">
          <div>
            <div className="brand-row">
              <div className="brand-mark">
                <Coffee size={20} />
              </div>
              <div>
                <div className="brand-name">
                  Kopi<span>pintar</span>
                </div>
                <div className="brand-subtitle">OPERATING SYSTEM</div>
              </div>
            </div>
            <div className="eyebrow mt-12 lg:mt-[70px]">
              SMART POS / BUSINESS CONTROL
            </div>
            <h1 className="my-[18px] text-[clamp(2.5rem,6vw,4.8rem)] leading-[.98]">
              Kelola kedai lebih <em>pintar.</em>
            </h1>
            <p className="max-w-[450px] leading-[1.7]">
              Dashboard operasional untuk memantau penjualan, stok, dan
              keputusan restock dalam satu tempat.
            </p>
          </div>
          <div className="flex flex-wrap gap-[18px] text-[13px] text-[var(--ink-soft)]">
            <span>
              <b>01</b> Dashboard
            </span>
            <span>
              <b>02</b> POS / Kasir
            </span>
            <span>
              <b>03</b> AI Forecast
            </span>
          </div>
        </section>
        <section className="panel w-full p-5 sm:p-7 md:p-[30px]">
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <div className="brand-mark">
              <Coffee size={18} />
            </div>
            <div>
              <div className="brand-name">
                Kopi<span>pintar</span>
              </div>
              <div className="brand-subtitle">OPERATING SYSTEM</div>
            </div>
          </div>
          <div className="mb-6 inline-flex rounded-lg bg-[var(--mint-soft)] p-1">
            <span className="rounded-md bg-[var(--mint)] px-4 py-2 text-xs font-bold text-white">
              Login
            </span>
          </div>
          <h2>Selamat datang kembali</h2>
          <p>
            Masuk dengan username atau email untuk membuka dashboard utama dan
            POS.
          </p>
          <label className="mt-5 grid gap-2 text-[13px] font-bold">
            Username / Email
            <input
              className="select-control w-full"
              value={username}
              onChange={event => {
                setUsername(event.target.value);
                setLoginError(null);
              }}
              placeholder="admin atau admin@kopipintar.com"
              autoComplete="username"
            />
          </label>
          <label className="mt-4 grid gap-2 text-[13px] font-bold">
            Password
            <div className="relative">
              <input
                className="select-control w-full pr-[42px]"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={event => {
                  setPassword(event.target.value);
                  setLoginError(null);
                }}
                placeholder="Minimal 6 karakter"
                autoComplete="current-password"
              />
              <button
                type="button"
                aria-label={
                  showPassword ? "Sembunyikan password" : "Tampilkan password"
                }
                onClick={() => setShowPassword(value => !value)}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md bg-transparent text-[var(--ink-muted)]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <label className="mt-3 flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={event => {
                const checked = event.target.checked;
                setRememberMe(checked);
                if (!checked) localStorage.removeItem(rememberedLoginKey);
              }}
              className="h-4 w-4 cursor-pointer accent-[var(--mint)]"
            />
            <span>Ingat saya</span>
          </label>
          <button
            className="button button-primary mt-5 w-full justify-center"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Memproses..." : "Masuk ke Dashboard"}
          </button>
          {loginError && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-[#efc7c2] bg-[#fff1ef] px-3 py-2.5 text-xs leading-[1.45] text-[#a33d39]"
            >
              {loginError}
            </div>
          )}
          <div className="my-5 flex items-center gap-2.5 text-xs text-[var(--ink-muted)]">
            <span className="h-px flex-1 bg-[var(--line)]" />
            atau
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>
          <button
            className="button button-secondary w-full justify-center"
            onClick={onGoogle}
          >
            Masuk dengan Google
          </button>
          <button
            className="button button-secondary mt-2 w-full justify-center"
            onClick={() => setShowDemo(true)}
          >
            <Sparkles size={15} /> Jelajahi demo interaktif
          </button>
          <small className="mt-4 block leading-[1.5] text-[var(--ink-muted)]">
            Gunakan akun operator yang sudah dibuat di Supabase Auth.
          </small>
        </section>
      </div>
      {showDemo && <DemoPreview onClose={() => setShowDemo(false)} />}
    </div>
  );
}

function DemoPreview({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"Ringkasan" | "Stok" | "Forecast" | "Kasir">("Ringkasan");
  const [demoCart, setDemoCart] = useState(0);
  const [saleComplete, setSaleComplete] = useState(false);
  const tabs = ["Ringkasan", "Stok", "Forecast", "Kasir"] as const;
  const sampleProducts = [
    { name: "Kopi Susu Gula Aren", sku: "KOP-001", stock: 8, minimum: 12, status: "Rendah" },
    { name: "Matcha Latte", sku: "TEA-014", stock: 24, minimum: 10, status: "Sehat" },
    { name: "Croissant Butter", sku: "FOD-008", stock: 3, minimum: 8, status: "Kritis" },
  ];
  const bars = [38, 57, 46, 72, 61, 91, 76];

  return (
    <div
      className="modal-backdrop"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-title"
        style={{ width: "min(100%, 980px)", padding: 22 }}
      >
        <button className="modal-close" onClick={onClose} aria-label="Tutup demo">
          <X size={17} />
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4 pr-9">
          <div>
            <div className="ai-kicker"><Sparkles size={13} /> KOPIPINTAR / DEMO INTERAKTIF</div>
            <h2 id="demo-title" className="mt-2 font-serif text-2xl font-medium text-[var(--ink)]">Operasional kedai, sekilas terlihat.</h2>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[var(--ink-soft)]">Jelajahi contoh dashboard, stok, perkiraan restock, dan alur kasir. Semua angka di sini adalah data contoh.</p>
          </div>
          <span className="badge badge-blue"><span className="badge-dot" /> DATA CONTOH</span>
        </div>

        <div className="report-tabs mt-5 max-w-full overflow-x-auto" role="tablist" aria-label="Bagian demo">
          {tabs.map(tab => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Ringkasan" && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="text-sm font-bold text-[var(--ink)]">Kedai Bumi · Senopati</h3><p className="mt-1 text-[10px] text-[var(--ink-muted)]">Ringkasan operasional hari ini</p></div>
              <span className="badge badge-green">● Outlet aktif</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Penjualan", "Rp 4.820.000", "+12,4%"],
                ["Transaksi", "76", "vs kemarin"],
                ["Estimasi profit", "Rp 1.640.000", "Margin 34%"],
                ["Perlu restock", "4 produk", "2 prioritas"],
              ].map(([label, value, note]) => (
                <div className="metric-card accent-mint" key={label}>
                  <div className="metric-label mt-0">{label}</div>
                  <div className="metric-value text-base sm:text-lg">{value}</div>
                  <div className="metric-note">{note}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr]">
              <section className="panel min-w-0 p-4">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-xs font-bold">Performa penjualan</h3><p className="mt-1 text-[10px] text-[var(--ink-muted)]">7 hari terakhir</p></div><b className="text-sm text-[var(--mint-dark)]">Rp 28,6 jt</b></div>
                <div className="mt-4 flex h-28 items-end justify-between gap-2 border-b border-l border-[var(--line)] px-2">
                  {bars.map((height, index) => <div key={index} className="flex h-full flex-1 items-end"><span className="w-full rounded-t-sm bg-[var(--mint)]" style={{ height: `${height}%`, opacity: index === 5 ? 1 : 0.35 + index * 0.08 }} /></div>)}
                </div>
                <div className="mt-2 flex justify-between text-[9px] text-[var(--ink-muted)]"><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span></div>
              </section>
              <section className="panel p-4">
                <div className="ai-kicker"><Sparkles size={12} /> INSIGHT</div>
                <h3 className="mt-2 text-sm font-bold">Croissant Butter hampir habis</h3>
                <p className="mt-2 text-[10px] leading-relaxed text-[var(--ink-soft)]">Dengan penjualan rata-rata 5 unit per hari, stok diperkirakan habis dalam kurang dari 1 hari.</p>
                <div className="mt-3 rounded-lg bg-[var(--amber-soft)] px-3 py-2 text-[10px] font-semibold text-[#8b6428]">Saran: restock 24 unit sebelum besok.</div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "Stok" && (
          <section className="panel overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4"><div><h3 className="text-sm font-bold">Kondisi inventory</h3><p className="mt-1 text-[10px] text-[var(--ink-muted)]">Pantau stok dan minimum setiap produk.</p></div><span className="badge badge-amber">4 perlu restock</span></div>
            <div className="table-wrap"><table className="data-table min-w-[560px]"><thead><tr><th>Produk</th><th>SKU</th><th>Stok</th><th>Minimum</th><th>Status</th></tr></thead><tbody>
              {sampleProducts.map(product => <tr key={product.sku}><td><b>{product.name}</b></td><td className="mono-text">{product.sku}</td><td><b>{product.stock} unit</b></td><td>{product.minimum} unit</td><td><span className={`badge ${product.status === "Sehat" ? "badge-green" : product.status === "Rendah" ? "badge-amber" : "badge-red"}`}>{product.status}</span></td></tr>)}
            </tbody></table></div>
            <p className="px-4 py-3 text-[10px] text-[var(--ink-muted)]">Penjualan di POS otomatis mengurangi stok produk dan komponen paket.</p>
          </section>
        )}

        {activeTab === "Forecast" && (
          <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
            <section className="forecast-hero min-h-0 p-5 md:p-6"><div><div className="ai-kicker text-[#bfe5cf]"><Sparkles size={13} /> PERKIRAAN BERBASIS DATA</div><h3 className="mt-3 font-serif text-2xl text-white">Restock sebelum stok habis.</h3><p className="mt-2 max-w-lg text-xs leading-relaxed text-[#b8c7c3]">Demand harian dihitung dari transaksi aktual, termasuk pemakaian komponen dalam bundle.</p><div className="forecast-method mt-4"><span><Check size={13} /> Riwayat penjualan</span><span><Check size={13} /> Lead time supplier</span></div></div></section>
            <section className="panel p-4"><h3 className="text-sm font-bold">Prioritas hari ini</h3>
              {[ ["Croissant Butter", "Stok habis ±0,6 hari", "24 unit"], ["Kopi Susu Gula Aren", "Stok habis ±1,8 hari", "30 unit"], ["Susu Oat", "Stok habis ±3 hari", "12 unit"] ].map(([name, timing, quantity], index) => <div className="flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-0" key={name}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${index === 0 ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[var(--amber-soft)] text-[var(--amber)]"}`}>{index + 1}</span><div className="min-w-0 flex-1"><b className="block truncate text-xs">{name}</b><small className="text-[10px] text-[var(--ink-muted)]">{timing}</small></div><b className="text-xs text-[var(--mint-dark)]">{quantity}</b></div>)}
            </section>
          </div>
        )}

        {activeTab === "Kasir" && (
          <div className="grid gap-3 md:grid-cols-[1fr_.8fr]">
            <section className="panel p-4"><div className="panel-header"><div><h3 className="text-sm font-bold">POS / Kasir</h3><p>Contoh katalog produk yang siap dijual.</p></div><ShoppingCart size={18} className="muted-icon" /></div>
              {[ ["Kopi Susu Gula Aren", "Rp 28.000"], ["Matcha Latte", "Rp 32.000"], ["Croissant Butter", "Rp 24.000"] ].map(([name, price]) => <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-3 last:border-0" key={name}><div><b className="text-xs">{name}</b><small className="mt-1 block text-[10px] text-[var(--ink-muted)]">{price}</small></div><button className="button button-secondary min-h-8 px-3" onClick={() => { setDemoCart(count => count + 1); setSaleComplete(false); }}><Plus size={14} /> Tambah</button></div>)}
            </section>
            <section className="panel flex flex-col p-4"><h3 className="text-sm font-bold">Keranjang demo</h3><div className="my-4 flex flex-1 items-center justify-center rounded-lg bg-[var(--paper)] p-4 text-center"><div><ShoppingCart size={24} className="mx-auto text-[var(--mint)]" /><b className="mt-2 block text-sm">{demoCart} item</b><span className="text-[10px] text-[var(--ink-muted)]">Total simulasi Rp {new Intl.NumberFormat("id-ID").format(demoCart * 28000)}</span></div></div><button className="button button-primary w-full justify-center" disabled={!demoCart} onClick={() => { setSaleComplete(true); setDemoCart(0); }}><Check size={15} /> Simulasikan pembayaran</button>{saleComplete && <p className="mt-2 text-center text-[10px] font-semibold text-[var(--mint-dark)]" role="status">Pembayaran demo berhasil. Tidak ada transaksi tersimpan.</p>}</section>
          </div>
        )}
      </section>
    </div>
  );
}

function AppShell({
  activePage,
  setActivePage,
  children,
  onNotifications,
  outlets,
  selectedOutletId,
  onOutletChange,
  user,
  onLogout,
  inventoryAttention,
  dataStatus,
}: {
  activePage: PageKey;
  setActivePage: (page: PageKey) => void;
  children: React.ReactNode;
  onNotifications: () => void;
  outlets: OutletOption[];
  selectedOutletId: number;
  onOutletChange: (id: number) => void;
  user: { name?: string | null; email?: string | null; role?: string } | null;
  onLogout: () => void;
  inventoryAttention: number;
  dataStatus: "loading" | "live" | "error";
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isCashier = user?.role === "kasir";
  return (
    <div className="app-shell overflow-x-hidden">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <Coffee size={20} strokeWidth={2.8} />
          </div>
          <div>
            <div className="brand-name">
              Kopi<span>pintar</span>
            </div>
            <div className="brand-subtitle">OPERATING SYSTEM</div>
          </div>
          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-avatar">
            {outlets.find(outlet => outlet.id === selectedOutletId)?.code.slice(0, 2) || ""}
          </div>
          <div className="workspace-copy">
            <select
              aria-label="Pilih outlet"
              value={selectedOutletId}
              onChange={event => onOutletChange(Number(event.target.value))}
            >
              {outlets.map(outlet => (
                <option value={outlet.id} key={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
            <span>
              {outlets.find(outlet => outlet.id === selectedOutletId)?.city || ""}
            </span>
          </div>
          <ChevronRight size={16} className="muted-icon" />
        </div>
        <div className="nav-heading">WORKSPACE</div>
        <nav className="main-nav">
          {navItems
            .filter(item => !isCashier || item.id === "pos")
            .map(({ id, label, icon: NavIcon }) => {
              const badge = id === "inventory" ? String(inventoryAttention) : undefined;
              return (
              <button
                key={id}
                onClick={() => {
                  setActivePage(id);
                  setSidebarOpen(false);
                }}
                className={`nav-item ${activePage === id ? "active" : ""}`}
              >
                <NavIcon size={18} />
                <span>{label}</span>
                {badge && (
                  <span
                    className="nav-badge"
                  >
                    {badge}
                  </span>
                )}
              </button>
              );
            })}
        </nav>
        {!isCashier && (
          <div className="sidebar-footer">
            <div className="nav-heading">PREFERENSI</div>
            <button
              onClick={() => setActivePage("settings")}
              className={`nav-item ${activePage === "settings" ? "active" : ""}`}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
            <button
              onClick={() => setActivePage("help")}
              className={`nav-item ${activePage === "help" ? "active" : ""}`}
            >
              <CircleHelp size={18} />
              <span>Help center</span>
            </button>
          </div>
        )}
        <div className="sidebar-profile">
          <div className="profile-avatar">
            {user?.name?.slice(0, 2).toUpperCase() || ""}
          </div>
          <div>
            <b>{user?.name || "Pengguna"}</b>
            <span>{user?.role === "admin" ? "Administrator" : user?.role === "kasir" ? "Kasir" : ""}</span>
          </div>
          <button className="profile-logout" onClick={onLogout}>
            {user ? "Keluar" : "Masuk"}
          </button>
        </div>
      </aside>
      {sidebarOpen && (
        <button
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Tutup menu"
        />
      )}
      <main className="main-area min-w-0 overflow-x-hidden">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka menu"
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>
              {navItems.find(item => item.id === activePage)?.label ||
                (activePage === "settings"
                  ? "Settings"
                  : activePage === "help"
                    ? "Help center"
                    : "Dashboard")}
            </b>
          </div>
          <div className="topbar-actions">
            <span className={`status-dot ${dataStatus}`}>
              <span /> {dataStatus === "live" ? "Data Supabase" : dataStatus === "error" ? "Gagal memuat" : "Memuat..."}
            </span>
            <IconButton label="Notifikasi" onClick={onNotifications}>
              <Bell size={18} />
            </IconButton>
            <div className="topbar-avatar">
              {user?.name?.slice(0, 2).toUpperCase() || ""}
            </div>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-title-row">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

function sellableStock(product: Product, products: Product[]) {
  if (!product.isBundle) return product.stock;
  if (!product.bundleItems?.length) return 0;
  return Math.min(
    ...product.bundleItems.map(item => {
      const component = products.find(candidate => candidate.id === item.componentProductId);
      return component ? Math.floor(component.stock / item.quantity) : 0;
    })
  );
}

function POS({
  products,
  setProducts,
  onToast,
  onTransaction,
  hasSupabaseSession,
  outletId,
  categoryNames,
  taxRate,
  outletName,
  footerText,
  productLoading,
  productError,
  taxRateError,
  onRefreshProducts,
  onRetryTaxRate,
}: {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  onToast: (toast: Toast) => void;
  onTransaction: (total: number) => void | Promise<void>;
  hasSupabaseSession: boolean;
  outletId: number;
  categoryNames: string[];
  taxRate: number | null;
  outletName: string;
  footerText: string;
  productLoading: boolean;
  productError: string | null;
  taxRateError: string | null;
  onRefreshProducts: () => Promise<void>;
  onRetryTaxRate: () => void;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState("Semua");
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [payment, setPayment] = useState("QRIS");
  const [cashReceived, setCashReceived] = useState(0);
  const [note, setNote] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [bouncingId, setBouncingId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<{
    transactionNumber: string;
    items: CartItem[];
    subtotal: number;
    tax: number;
    total: number;
    payment: string;
    cashReceived: number;
    change: number;
    note: string;
    footerText: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const filtered = products.filter(
    product =>
      (category === "Semua" || product.category === category) &&
      (product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.sku.toLowerCase().includes(query.toLowerCase()))
  );
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = Math.round(subtotal * (taxRate ?? 0));
  const total = subtotal + tax;
  const selectedCash = payment === "Tunai" ? cashReceived : total;
  const change = calculateChange(total, selectedCash);
  const playBeep = () => {
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 620;
      gain.gain.value = 0.035;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.055);
    } catch {
      /* optional */
    }
  };
  const addToCart = (product: Product) => {
    const availableStock = sellableStock(product, products);
    if (availableStock <= 0)
      return onToast({
        tone: "warning",
        message: `${product.name} sedang habis.`,
      });
    setCart(current => {
      const found = current.find(item => item.id === product.id);
      if (found && !canAddToCart(availableStock, found.qty)) {
        onToast({
          tone: "warning",
          message: `Stok ${product.name} hanya ${availableStock} ${product.unit}.`,
        });
        return current;
      }
      return found
        ? current.map(item =>
            item.id === product.id ? { ...item, qty: item.qty + 1 } : item
          )
        : [...current, { ...product, stock: availableStock, qty: 1 }];
    });
    setBouncingId(product.id);
    window.setTimeout(() => setBouncingId(null), 260);
    playBeep();
  };
  const scanBySku = (rawCode: string) => {
    const code = rawCode.trim().toLowerCase();
    if (!code) return;
    const matches = products.filter(product => product.sku.trim().toLowerCase() === code);
    if (matches.length !== 1) {
      onToast({
        tone: "warning",
        message: matches.length ? `SKU ${rawCode} digunakan oleh beberapa produk.` : `Produk dengan SKU ${rawCode} tidak ditemukan.`,
      });
      return;
    }
    setCategory("Semua");
    setQuery("");
    addToCart(matches[0]);
  };
  const changeQty = (id: number, amount: number) =>
    setCart(current =>
      current
        .map(item =>
          item.id === id
            ? {
                ...item,
                qty: Math.max(0, Math.min(item.qty + amount, item.stock)),
              }
            : item
        )
        .filter(item => item.qty > 0)
    );
  const clearCart = () => {
    setCart([]);
    setNote("");
    setCashReceived(0);
    onToast({ tone: "info", message: "Keranjang berhasil dikosongkan." });
  };
  const pay = async () => {
    if (isSaving) return;
    if (taxRate === null)
      return onToast({
        tone: "warning",
        message: "Tarif transaksi belum berhasil dimuat dari Supabase. Coba lagi.",
      });
    if (!cart.length)
      return onToast({
        tone: "warning",
        message: "Tambahkan produk ke keranjang terlebih dahulu.",
      });
    if (payment === "Tunai" && cashReceived < total)
      return onToast({
        tone: "warning",
        message: `Uang tunai kurang ${money(total - cashReceived)}.`,
      });
    setIsSaving(true);
    try {
      const saleInput = {
        outletId,
        paymentMethod: payment as "QRIS" | "Tunai" | "Debit",
        cashReceived: selectedCash,
        items: cart.map(item => ({
          productId: item.id,
          qty: item.qty,
        })),
      };
      if (!isSupabaseAuthConfigured || !hasSupabaseSession)
        throw new Error("Login Supabase diperlukan untuk menyimpan transaksi.");
      const sale = await createSupabaseSale(saleInput);
      setProducts(current =>
        current.map(product => {
          const directItem = cart.find(cartItem => cartItem.id === product.id);
          const bundleUsage = cart.reduce((totalUsage, cartItem) => {
            const component = cartItem.bundleItems?.find(
              item => item.componentProductId === product.id
            );
            return totalUsage + (component?.quantity || 0) * cartItem.qty;
          }, 0);
          return product.isBundle
            ? product
            : {
                ...product,
                stock: Math.max(
                  0,
                  product.stock - (directItem?.qty || 0) - bundleUsage
                ),
              };
        })
      );
      await onTransaction(sale.total);
      setReceipt({
        transactionNumber: sale.transactionNumber,
        items: cart,
        subtotal: sale.subtotal,
        tax: sale.tax,
        total: sale.total,
        payment,
        cashReceived: selectedCash,
        change: calculateChange(sale.total, selectedCash),
        note,
        footerText,
      });
      setCartOpen(false);
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes("Insufficient stock")
          ? "Stok tidak cukup untuk menyelesaikan transaksi. Perbarui stok produk dan coba lagi."
          : error instanceof Error
            ? `Transaksi gagal disimpan: ${error.message}`
            : "Transaksi gagal disimpan. Periksa koneksi Supabase.";
      return onToast({
        tone: "warning",
        message,
      });
    } finally {
      setIsSaving(false);
    }
  };
  const finishTransaction = () => {
    setReceipt(null);
    setCart([]);
    setNote("");
    setCashReceived(0);
    onToast({
      tone: "success",
      message: "Transaksi berhasil disimpan dan stok diperbarui.",
    });
  };
  const cartPanel = (
    <aside
      className={`${cartOpen ? "fixed inset-x-3 bottom-3 z-50 max-h-[calc(100vh-7rem)]" : "hidden"} md:sticky md:top-4 md:flex md:h-[calc(100vh-8rem)] md:w-[40%] md:max-w-md md:shrink-0 md:flex-col md:rounded-xl md:border md:bg-gray-50 md:p-4 ${cartOpen ? "flex flex-col rounded-2xl border bg-gray-50 p-4 shadow-2xl" : ""}`}
    >
      <div className="flex items-start justify-between border-b border-gray-200 pb-4">
        <div>
          <div className="eyebrow">ORDER / DRAFT</div>
          <h2 className="mt-1 text-lg font-bold text-gray-800">
            Keranjang baru
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{cart.length} item</span>
          <button
            className="md:hidden"
            onClick={() => setCartOpen(false)}
            aria-label="Tutup keranjang"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between py-3">
        <span className="text-xs text-gray-500">
          {cart.length ? "Pesanan aktif" : "Draft transaksi"}
        </span>
        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="flex items-center gap-1 text-xs font-semibold text-red-500 transition-all duration-300 hover:text-red-700"
          >
            <Trash2 size={13} /> Kosongkan
          </button>
        )}
      </div>
      {cart.length ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-3">
          {cart.map(item => (
            <div
              className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm"
              key={item.id}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f0e8] text-xl">
                <ProductIcon product={item} size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm text-gray-800">
                  {item.name}
                </b>
                <span className="text-xs text-gray-500">
                  {money(item.price)}
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    aria-label={`Kurangi ${item.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border bg-white transition-all duration-300 hover:border-[var(--mint)] hover:bg-[var(--mint-soft)] active:scale-90"
                    onClick={() => changeQty(item.id, -1)}
                  >
                    <Minus size={13} />
                  </button>
                  <b className="min-w-4 text-center text-xs">{item.qty}</b>
                  <button
                    aria-label={`Tambah ${item.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border bg-white transition-all duration-300 hover:border-[var(--mint)] hover:bg-[var(--mint-soft)] active:scale-90"
                    onClick={() => changeQty(item.id, 1)}
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    aria-label={`Hapus ${item.name}`}
                    className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-red-500 transition-all duration-300 hover:bg-red-50 hover:text-red-700 active:scale-90"
                    onClick={() =>
                      setCart(current =>
                        current.filter(cartItem => cartItem.id !== item.id)
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <strong className="shrink-0 text-xs text-gray-800">
                {money(item.price * item.qty)}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-8 text-center text-gray-400">
          <ShoppingCart size={38} strokeWidth={1.5} />
          <b className="text-sm text-gray-600">Belum ada pesanan</b>
          <span className="max-w-[210px] text-xs leading-relaxed">
            Silakan pilih produk untuk memulai transaksi.
          </span>
        </div>
      )}
      <div className="mt-2 border-t border-gray-200 pt-3">
        <label className="mb-1 block text-xs font-semibold text-gray-600">
          Catatan transaksi{" "}
          <span className="font-normal text-gray-400">(opsional)</span>
        </label>
        <textarea
          className="select-control min-h-[58px] w-full resize-none text-xs"
          value={note}
          onChange={event => setNote(event.target.value)}
          placeholder="Less sugar, take away..."
        />
      </div>
      <div className="space-y-2 border-t border-gray-200 pt-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-gray-500">
          <span>Subtotal</span>
          <b className="text-gray-800">{money(subtotal)}</b>
        </div>
        {taxRateError && <button className="row-link" onClick={onRetryTaxRate}>Tarif pajak gagal dimuat. Coba lagi.</button>}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-gray-500">
          <span>
            Pajak layanan <small>{taxRate === null ? "—" : `${number(taxRate * 100)}%`}</small>
          </span>
          <b className="text-gray-800">{money(tax)}</b>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-gray-200 pt-3 text-sm sm:text-base">
          <span className="font-semibold text-gray-800">Total</span>
          <strong className="text-[var(--mint-dark)]">{money(total)}</strong>
        </div>
      </div>
      <div className="mt-3">
        <span className="mb-2 block text-xs font-semibold text-gray-600">
          Metode pembayaran
        </span>
        <div className="grid grid-cols-3 gap-2">
          {["QRIS", "Tunai", "Debit"].map(method => (
            <button
              key={method}
              onClick={() => {
                setPayment(method);
                if (method !== "Tunai") setCashReceived(0);
              }}
              className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all duration-300 active:scale-95 ${payment === method ? "border-[var(--mint)] bg-[var(--mint-soft)] text-[var(--mint-dark)]" : "border-gray-200 bg-white text-gray-500 hover:border-[var(--mint)]"}`}
            >
              {method === "QRIS" ? (
                <Zap size={14} />
              ) : method === "Tunai" ? (
                <Store size={14} />
              ) : (
                <CreditCard size={14} />
              )}
              {method}
            </button>
          ))}
        </div>
      </div>
      {payment === "Tunai" && (
        <div className="mt-3 rounded-xl bg-white p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-gray-500">Uang diterima</span>
            <b
              className={
                cashReceived >= total
                  ? "text-[var(--mint-dark)]"
                  : "text-red-500"
              }
            >
              {cashReceived ? money(cashReceived) : "Belum dipilih"}
            </b>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {quickCashOptions(total).map(option => (
              <button
                key={option.label}
                onClick={() => setCashReceived(option.value)}
                className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition-all duration-300 active:scale-95 ${cashReceived === option.value ? "border-[var(--mint)] bg-[var(--mint-soft)] text-[var(--mint-dark)]" : "border-gray-200 hover:border-[var(--mint)]"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {cashReceived >= total && (
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>Kembalian</span>
              <b className="text-[var(--mint-dark)]">{money(change)}</b>
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-gray-500 sm:text-xs">
        <span className="live-dot" />{" "}
        {hasSupabaseSession
          ? "Checkout Supabase siap"
          : "Login Supabase diperlukan"}
      </div>
      <button
        className="button button-primary mt-3 w-full justify-center transition-all duration-300 active:scale-[.98]"
        onClick={pay}
        disabled={isSaving || taxRate === null}
      >
        {isSaving ? "Menyimpan..." : `Bayar ${money(total)}`}{" "}
        <ChevronRight size={16} />
      </button>
    </aside>
  );
  return (
    <>
      <PageTitle
        eyebrow={`TRANSACTION / ${outletName}`}
        title="POS / Kasir"
        description="Proses pesanan dengan cepat, stok otomatis tersinkronisasi."
        actions={
          <div className="counter-status">
            <span className="live-dot" /> Supabase checkout
          </div>
        }
      />
      <div className="flex h-full flex-col items-stretch gap-4 md:flex-row md:items-start md:gap-5 lg:gap-6">
        <section className="flex min-w-0 flex-1 flex-col rounded-xl border bg-white p-4 md:w-[60%] md:flex-none lg:w-2/3 lg:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="search-box flex-1">
              <Search size={17} />
              <input
                ref={searchInputRef}
                placeholder="Cari produk atau SKU..."
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key !== "Enter" || !event.currentTarget.value.trim()) return;
                  event.preventDefault();
                  scanBySku(event.currentTarget.value);
                }}
              />
            </div>
            <button
              className="button button-secondary shrink-0"
              onClick={() => {
                setCategory("Semua");
                searchInputRef.current?.focus();
                onToast({ tone: "info", message: "Scanner siap. Scan barcode SKU lalu tekan Enter." });
              }}
            >
              Scan barcode
            </button>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {["Semua", ...categoryNames].map(item => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`rounded-full border px-2 py-1 text-[10px] font-medium transition-all duration-300 active:scale-95 sm:px-3 sm:py-1.5 sm:text-xs md:px-4 md:py-2 md:text-sm ${category === item ? "border-[var(--mint)] bg-[var(--mint)] text-white" : "border-gray-200 bg-white text-gray-600 hover:border-[var(--mint)] hover:text-[var(--mint-dark)]"}`}
              >
                {item}
              </button>
            ))}
          </div>
          {productError && <div className="empty-state" role="alert"><b>Produk gagal dimuat</b><span>{productError}</span><button className="button button-secondary" onClick={() => void onRefreshProducts()}>Coba lagi</button></div>}
          {productLoading && !products.length && <div className="h-48 animate-pulse rounded-lg bg-gray-100" />}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4">
            {filtered.map(product => (
              <button
                key={product.id}
                disabled={sellableStock(product, products) === 0}
                onClick={() => addToCart(product)}
                className={`group relative flex cursor-pointer flex-col justify-between rounded-xl border bg-white p-3 text-left transition-all duration-300 hover:-translate-y-1 hover:border-[var(--mint)] hover:shadow-md active:scale-[.98] lg:p-4 ${bouncingId === product.id ? "scale-95 ring-2 ring-[var(--mint)]" : ""} ${sellableStock(product, products) === 0 ? "cursor-not-allowed opacity-50 grayscale" : ""}`}
              >
                <div>
                  {sellableStock(product, products) === 0 && (
                    <span className="absolute right-2 top-2 rounded-full bg-gray-600 px-2 py-1 text-[10px] font-bold text-white">
                      Habis
                    </span>
                  )}
                  <div className="mb-3 flex h-20 w-full items-center justify-center rounded-lg bg-slate-100 text-3xl text-[var(--mint-dark)] transition-all duration-300 group-hover:scale-[1.03] lg:h-24 lg:text-4xl">
                    <ProductIcon product={product} size={34} />
                  </div>
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-sm font-semibold leading-tight text-gray-800 sm:text-base">
                      {product.name}
                    </div>
                    <div className="mt-1 truncate text-[10px] text-gray-400 sm:text-xs">
                      {product.category} · {product.unit}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
                  <strong className="whitespace-nowrap text-sm font-bold text-[var(--mint-dark)] sm:text-base">
                    {money(product.price)}
                  </strong>
                  <span
                    className={`whitespace-nowrap text-right text-[10px] text-gray-500 sm:text-xs ${product.stock <= product.minStock ? "font-semibold text-[var(--red)]" : ""}`}
                  >
                    {product.isBundle
                      ? `${sellableStock(product, products)} paket`
                      : `${product.stock} tersedia`}
                  </span>
                </div>
              </button>
            ))}
          </div>
          {!filtered.length && !productLoading && !productError && (
            <div className="empty-state">
              <Search size={24} />
              <b>{products.length ? "Produk tidak ditemukan" : "Belum ada produk"}</b>
              <span>{products.length ? "Coba ubah pencarian atau kategori." : "Tambahkan produk di Inventory untuk mulai bertransaksi."}</span>
            </div>
          )}
        </section>
        {cartPanel}
      </div>
      <button
        onClick={() => setCartOpen(true)}
        className="fixed bottom-4 left-4 right-4 z-40 flex items-center justify-between rounded-2xl bg-[var(--mint-dark)] px-4 py-3 text-white shadow-xl transition-all duration-300 active:scale-[.98] md:hidden"
      >
        <span className="flex items-center gap-2">
          <ShoppingCart size={18} />
          <b>
            {cart.length
              ? `${cart.length} item di keranjang`
              : "Buka keranjang"}
          </b>
        </span>
        <strong>{money(total)}</strong>
      </button>
      {cartOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setCartOpen(false)}
          aria-label="Tutup keranjang"
        />
      )}
      {receipt && (
        <SuccessModal receipt={receipt} onClose={finishTransaction} />
      )}
    </>
  );
}

function SuccessModal({
  receipt,
  onClose,
}: {
  receipt: {
    transactionNumber: string;
    items: CartItem[];
    subtotal: number;
    tax: number;
    total: number;
    payment: string;
    cashReceived: number;
    change: number;
    note: string;
    footerText: string;
  };
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal success-modal max-h-[90vh] overflow-y-auto">
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Tutup struk"
        >
          <X size={18} />
        </button>
        <div className="mb-3 flex justify-center">
          <div className="success-check">
            <Check size={25} />
          </div>
        </div>
        <div className="text-center">
          <div className="eyebrow">TRANSACTION COMPLETE</div>
          <h2>Pembayaran berhasil</h2>
          <p>Struk transaksi sudah siap dicetak.</p>
        </div>
        <div
          id="thermal-receipt"
          className="my-5 border-y border-dashed border-gray-300 bg-[#fffdfa] px-4 py-5 font-mono text-xs text-gray-700"
        >
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 font-sans text-base font-bold">
              <Coffee size={16} /> Kopipintar
            </div>
            <p className="mt-1 text-[10px] text-gray-500">
              SMART POS / BUSINESS CONTROL
            </p>
            <p className="mt-3 border-b border-dashed border-gray-300 pb-3">
              {new Date().toLocaleString("id-ID")}
              <br />
              {receipt.transactionNumber}
            </p>
          </div>
          <div className="space-y-2 py-3">
            {receipt.items.map(item => (
              <div key={item.id} className="flex justify-between gap-3">
                <span className="max-w-[65%]">
                  {item.name} x{item.qty}
                </span>
                <span>{money(item.price * item.qty)}</span>
              </div>
            ))}
          </div>
          {receipt.note && (
            <p className="border-t border-dashed border-gray-300 pt-2 text-[10px]">
              Catatan: {receipt.note}
            </p>
          )}
          <div className="mt-2 space-y-1 border-t border-dashed border-gray-300 pt-3">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Pajak</span>
              <span>{money(receipt.tax)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>TOTAL</span>
              <span>{money(receipt.total)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span>Bayar ({receipt.payment})</span>
              <span>{money(receipt.cashReceived)}</span>
            </div>
            {receipt.payment === "Tunai" && (
              <div className="flex justify-between">
                <span>Kembalian</span>
                <span>{money(receipt.change)}</span>
              </div>
            )}
          </div>
          <p className="mt-4 text-center text-[10px]">
            {receipt.footerText}
          </p>
        </div>
        <div className="receipt-actions">
          <button
            className="button button-secondary"
            onClick={() => window.print()}
          >
            <Receipt size={16} /> Cetak / Print
          </button>
          <button className="button button-primary" onClick={onClose}>
            Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  );
}

function Inventory({
  products,
  setProducts,
  onToast,
  outletId,
  canWriteSupabase,
  categoryOptions,
  supplierOptions,
  loading,
  loadError,
  onRefresh,
}: {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  onToast: (toast: Toast) => void;
  outletId: number;
  canWriteSupabase: boolean;
  categoryOptions: Array<{ id: number; name: string }>;
  supplierOptions: Array<{ name: string }>;
  loading: boolean;
  loadError: string | null;
  onRefresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Semua status");
  const [selected, setSelected] = useState<Product | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const inventoryProducts = products.map(product => ({
    ...product,
    stock: sellableStock(product, products),
  }));
  const rows = inventoryProducts.filter(
    product =>
      product.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "Semua status" ||
        (filter === "Kritis"
          ? getRisk(product) === "Tinggi" || getRisk(product) === "Habis"
          : getRisk(product) === filter))
  );
  const adjustStock = async (product: Product, amount: number) => {
    if (!canWriteSupabase)
      return onToast({
        tone: "warning",
        message: "Hanya Admin yang dapat mengubah inventory.",
      });
    if (product.isBundle)
      return onToast({
        tone: "info",
        message: "Stok paket mengikuti ketersediaan komponen.",
      });
    try {
      await adjustSupabaseProductStock(product.id, outletId, amount);
    } catch (error) {
      return onToast({
        tone: "warning",
        message:
          error instanceof Error
            ? `Stok belum tersimpan: ${error.message}`
            : "Stok belum tersimpan ke Supabase.",
      });
    }
    setProducts(current =>
      current.map(item =>
        item.id === product.id
          ? { ...item, stock: Math.max(0, item.stock + amount) }
          : item
      )
    );
    await onRefresh();
    onToast({
      tone: "success",
      message: `Stok ${product.name} berhasil disesuaikan.`,
    });
  };
  const deleteProduct = async (product: Product) => {
    if (!canWriteSupabase)
      return onToast({ tone: "warning", message: "Hanya Admin yang dapat menghapus produk." });
    if (!window.confirm(`Hapus produk ${product.name}?`)) return;
    try {
      await deleteSupabaseProduct(product.id, outletId);
      setProducts(current => current.filter(item => item.id !== product.id));
      setSelected(null);
      await onRefresh();
      onToast({ tone: "success", message: `${product.name} berhasil dihapus.` });
    } catch (error) {
      onToast({
        tone: "warning",
        message: error instanceof Error ? `Produk gagal dihapus: ${error.message}` : "Produk gagal dihapus dari Supabase.",
      });
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="OPERATIONS / STOCK CONTROL"
        title="Inventory"
        description="Pantau setiap SKU dan jaga operasional tetap siap melayani."
        actions={
          <button
            className="button button-primary"
            onClick={() => setShowAdd(true)}
          >
            <Plus size={16} /> Tambah produk
          </button>
        }
      />
      {loadError && <div className="empty-state" role="alert"><b>Inventory gagal dimuat</b><span>{loadError}</span><button className="button button-secondary" onClick={onRefresh}>Coba lagi</button></div>}
      <div className="inventory-kpis">
        <div className="mini-kpi">
          <span className="kpi-icon">
            <Boxes size={16} />
          </span>
          <div>
            <span>Total SKU</span>
            <b>{products.length} produk</b>
          </div>
        </div>
        <div className="mini-kpi">
          <span className="kpi-icon amber-bg">
            <AlertCircle size={16} />
          </span>
          <div>
            <span>Perlu restock</span>
            <b>
              {products.filter(product => getRisk(product) !== "Sehat").length}{" "}
              produk
            </b>
          </div>
        </div>
        <div className="mini-kpi">
          <span className="kpi-icon mint-bg">
            <Check size={16} />
          </span>
          <div>
            <span>Nilai persediaan</span>
            <b>
              {money(
                products.reduce(
                  (sum, product) => sum + product.stock * product.cost,
                  0
                )
              )}
            </b>
          </div>
        </div>
      </div>
      <section className="panel inventory-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              placeholder="Cari nama produk atau SKU..."
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
          <select
            className="select-control"
            value={filter}
            onChange={event => setFilter(event.target.value)}
          >
            <option>Semua status</option>
            <option>Kritis</option>
            <option>Sedang</option>
            <option>Sehat</option>
          </select>
          <button
            className="button button-secondary"
            onClick={() =>
              downloadCsv("kopipintar-inventory.csv", [
                ["Produk", "SKU", "Stok", "Status"],
                ...rows.map(product => [
                  product.name,
                  product.sku,
                  `${product.stock} ${product.unit}`,
                  getRisk(product),
                ]),
              ])
            }
          >
            Export CSV
          </button>
        </div>
        {loading && !products.length ? (
          <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
        ) : <div className="table-wrap overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>SKU</th>
                <th>Kategori</th>
                <th>Stok saat ini</th>
                <th>Min. stok</th>
                <th>Harga jual</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(product => (
                <tr key={product.id}>
                  <td>
                    <button
                      className="table-product"
                      onClick={() => setSelected(product)}
                    >
                      <span className="table-emoji">
                        <ProductIcon product={product} size={22} />
                      </span>
                      <span>
                        <b className="truncate text-[10px] sm:text-[11px]">
                          {product.name}
                        </b>
                        <small>{product.supplier}</small>
                      </span>
                    </button>
                  </td>
                  <td className="mono-text">{product.sku}</td>
                  <td>{product.category}</td>
                  <td>
                    <b>
                      {number(product.stock)} {product.unit}
                    </b>
                  </td>
                  <td>
                    {number(product.minStock)} {product.unit}
                  </td>
                  <td>{money(product.price)}</td>
                  <td>
                    <StatusBadge risk={getRisk(product)} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={() => adjustStock(product, 1)}
                        aria-label={`Tambah stok ${product.name}`}
                      >
                        <Plus size={15} />
                      </button>
                      <button
                        onClick={() => setSelected(product)}
                        aria-label={`Lihat ${product.name}`}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
        {!rows.length && (
          <div className="empty-state">
            <Search size={24} />
            <b>{products.length ? "Produk tidak ditemukan" : "Belum ada produk"}</b>
            <span>{products.length ? "Coba ubah kata kunci atau filter." : "Tambahkan produk untuk mulai mengelola inventory."}</span>
          </div>
        )}
        <div className="table-footer">
          <span>
            Menampilkan {rows.length} dari {products.length} produk
          </span>
        </div>
      </section>
      {selected && (
        <ProductModal
          product={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
          onAdjust={amount => {
            adjustStock(selected, amount);
            setSelected({
              ...selected,
              stock: Math.max(0, selected.stock + amount),
            });
          }}
          onDelete={() => void deleteProduct(selected)}
        />
      )}{" "}
      {(showAdd || editing) && (
        <AddProductModal
          initialProduct={editing || undefined}
          availableProducts={products}
          categoryOptions={categoryOptions}
          supplierOptions={supplierOptions}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onAdd={async product => {
            if (!canWriteSupabase)
              return onToast({
                tone: "warning",
                message: "Hanya Admin yang dapat mengubah inventory.",
              });
            try {
              const saved = await insertSupabaseProduct({
                ...product,
                outlet_id: outletId,
                category_id: product.categoryId,
                min_stock: product.minStock,
                icon_name: product.iconName,
                is_bundle: Boolean(product.isBundle),
                bundle_items: product.bundleItems || [],
              });
              const savedProduct = mapSupabaseProduct(saved);
              setProducts(current =>
                product.id
                  ? current.map(item => item.id === product.id ? savedProduct : item)
                  : [...current, savedProduct]
              );
              await onRefresh();
            } catch (error) {
              return onToast({
                tone: "warning",
                message:
                  error instanceof Error
                    ? `Produk belum tersimpan: ${error.message}`
                    : "Produk belum tersimpan ke Supabase.",
              });
            }
            setShowAdd(false);
            setEditing(null);
            onToast({
              tone: "success",
              message: product.id
                ? "Produk berhasil diperbarui."
                : "Produk baru berhasil ditambahkan.",
            });
          }}
        />
      )}
    </>
  );
}

function ProductModal({
  product,
  onClose,
  onEdit,
  onAdjust,
  onDelete,
}: {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
  onAdjust: (amount: number) => void;
  onDelete: () => void;
}) {
  const coverage = getCoverage(product);
  return (
    <div className="modal-backdrop">
      <div className="modal product-modal">
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="product-modal-head">
          <div className="large-product-emoji">
            <ProductIcon product={product} size={42} />
          </div>
          <div>
            <div className="eyebrow">PRODUCT DETAIL / {product.sku}</div>
            <h2>{product.name}</h2>
            <p>
              {product.category} · Supplier: {product.supplier}
            </p>
          </div>
          <StatusBadge risk={getRisk(product)} />
        </div>
        <div className="detail-grid">
          <div>
            <span>Harga beli</span>
            <b>{money(product.cost)}</b>
          </div>
          <div>
            <span>Harga jual</span>
            <b>{money(product.price)}</b>
          </div>
          <div>
            <span>Stok saat ini</span>
            <b>
              {number(product.stock)} {product.unit}
            </b>
          </div>
          <div>
            <span>Minimum stok</span>
            <b>
              {number(product.minStock)} {product.unit}
            </b>
          </div>
        </div>
        <div className="detail-forecast">
          <div>
            <span>Average daily sales</span>
            <b>
              {number(product.dailySales)} {product.unit}/hari
            </b>
          </div>
          <div>
            <span>Stock coverage</span>
            <b>{Number.isFinite(coverage) ? `${number(coverage)} hari` : "Belum cukup data"}</b>
          </div>
          <div>
            <span>Predicted stockout</span>
            <b>{Number.isFinite(coverage) ? `±${Math.ceil(coverage)} hari` : "Belum dapat diprediksi"}</b>
          </div>
        </div>
        <p>{product.historyDays} hari transaksi tersedia untuk perhitungan forecast.</p>
        <div className="modal-footer flex-wrap">
          <button className="button button-secondary" onClick={onEdit}>
            <Settings size={15} /> Edit produk
          </button>
          <button className="button button-secondary" onClick={onDelete}>
            <Trash2 size={15} /> Hapus produk
          </button>
          <button
            className="button button-secondary"
            onClick={() => onAdjust(-1)}
          >
            <Minus size={15} /> Kurangi stok
          </button>
          <button className="button button-primary" onClick={() => onAdjust(1)}>
            <Plus size={15} /> Tambah stok
          </button>
        </div>
      </div>
    </div>
  );
}

function AddProductModal({
  onClose,
  onAdd,
  initialProduct,
  availableProducts,
  categoryOptions,
  supplierOptions,
}: {
  onClose: () => void;
  onAdd: (product: Omit<Product, "id"> & { id?: number }) => void;
  initialProduct?: Product;
  availableProducts: Product[];
  categoryOptions: Array<{ id: number; name: string }>;
  supplierOptions: Array<{ name: string }>;
}) {
  const [name, setName] = useState(initialProduct?.name || "");
  const [sku, setSku] = useState(initialProduct?.sku || "");
  const [price, setPrice] = useState(
    initialProduct ? String(initialProduct.price) : ""
  );
  const [cost, setCost] = useState(initialProduct ? String(initialProduct.cost) : "");
  const [stock, setStock] = useState(
    initialProduct ? String(initialProduct.stock) : ""
  );
  const [minStock, setMinStock] = useState(
    initialProduct ? String(initialProduct.minStock) : ""
  );
  const [unit, setUnit] = useState(initialProduct?.unit || "");
  const [categoryId, setCategoryId] = useState(
    initialProduct?.categoryId ? String(initialProduct.categoryId) : ""
  );
  const [supplier, setSupplier] = useState(initialProduct?.supplier || "");
  const [iconName, setIconName] = useState(
    initialProduct?.iconName || "Package"
  );
  const [isBundle, setIsBundle] = useState(Boolean(initialProduct?.isBundle));
  const [bundleItems, setBundleItems] = useState(
    initialProduct?.bundleItems || []
  );
  const submit = () => {
    if (
      !name.trim() ||
      !sku.trim() ||
      !categoryId ||
      !unit.trim() ||
      !price ||
      !cost ||
      !minStock ||
      (!isBundle && !stock)
    )
      return;
    if (isBundle && !bundleItems.length) return;
    const category = categoryOptions.find(
      item => item.id === Number(categoryId)
    );
    if (!category) return;
    onAdd({
      ...(initialProduct ? { id: initialProduct.id } : {}),
      name: name.trim(),
      sku: sku.trim(),
      category: category.name,
      categoryId: category.id,
      unit: unit.trim(),
      stock: isBundle ? 0 : Number(stock),
      minStock: Number(minStock),
      cost: Number(cost),
      price: Number(price),
      supplier,
      supplierLeadTimeDays: initialProduct?.supplierLeadTimeDays ?? null,
      dailySales: initialProduct?.dailySales || 0,
      historyDays: initialProduct?.historyDays || 0,
      trend: initialProduct?.trend ?? null,
      emoji: initialProduct?.emoji || "📦",
      iconName,
      isBundle,
      bundleItems,
    });
  };
  return (
    <div className="modal-backdrop">
      <div className="modal form-modal w-full max-w-[670px] p-4 sm:p-6">
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="eyebrow">
          INVENTORY / {initialProduct ? "EDIT SKU" : "NEW SKU"}
        </div>
        <h2>{initialProduct ? "Edit produk" : "Tambah produk"}</h2>
        <p>
          Pilih ikon Lucide agar produk mudah dikenali di POS dan inventory.
        </p>
        <label>
          Nama produk
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Contoh: Salted Caramel Latte"
          />
        </label>
        <label>
          SKU
          <input value={sku} onChange={event => setSku(event.target.value)} />
        </label>
        <label>
          Kategori
          <select className="select-control" value={categoryId} onChange={event => setCategoryId(event.target.value)}>
            <option value="">Pilih kategori</option>
            {categoryOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          Satuan
          <input value={unit} onChange={event => setUnit(event.target.value)} />
        </label>
        <label>
          Supplier
          <select className="select-control" value={supplier} onChange={event => setSupplier(event.target.value)}>
            <option value="">Tidak ditentukan</option>
            {supplierOptions.map(item => <option value={item.name} key={item.name}>{item.name}</option>)}
          </select>
        </label>
        <label>
          Harga jual
          <input
            type="number"
            value={price}
            onChange={event => setPrice(event.target.value)}
          />
        </label>
        <label>
          Harga pokok
          <input type="number" value={cost} onChange={event => setCost(event.target.value)} />
        </label>
        <label className={isBundle ? "opacity-50" : ""}>
          Stok awal{" "}
          {isBundle && (
            <span className="font-normal">(otomatis dari komponen)</span>
          )}
          <input
            type="number"
            value={isBundle ? "" : stock}
            onChange={event => setStock(event.target.value)}
            disabled={isBundle}
          />
        </label>
        <label>
          Minimum stok
          <input type="number" value={minStock} onChange={event => setMinStock(event.target.value)} />
        </label>
        <label className="mt-4 flex min-h-10 cursor-pointer flex-row items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--mint-soft)] px-3 py-2 text-xs font-bold text-[var(--ink)]">
          <input
            type="checkbox"
            checked={isBundle}
            onChange={event => setIsBundle(event.target.checked)}
            className="h-4 w-4 accent-[var(--mint)]"
          />
          <span>Jadikan produk ini sebagai Paket / Bundle</span>
        </label>
        {isBundle && (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[#fafcfb] p-3">
            <div className="mb-2 text-xs font-bold text-[var(--ink)]">
              Komponen paket
            </div>
            <div className="space-y-2">
              {bundleItems.map((item, index) => (
                <div
                  className="flex min-w-0 items-center gap-2"
                  key={`${item.componentProductId}-${index}`}
                >
                  <select
                    className="select-control min-w-0 flex-1 text-xs"
                    value={item.componentProductId}
                    onChange={event =>
                      setBundleItems(current =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index
                            ? {
                                ...entry,
                                componentProductId: Number(event.target.value),
                              }
                            : entry
                        )
                      )
                    }
                  >
                    {availableProducts
                      .filter(product => product.id !== initialProduct?.id)
                      .map(product => (
                        <option value={product.id} key={product.id}>
                          {product.name}
                        </option>
                      ))}
                  </select>
                  <input
                    className="select-control w-16 text-center text-xs"
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={event =>
                      setBundleItems(current =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index
                            ? {
                                ...entry,
                                quantity: Math.max(
                                  1,
                                  Number(event.target.value)
                                ),
                              }
                            : entry
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-red-500 hover:bg-red-50"
                    onClick={() =>
                      setBundleItems(current =>
                        current.filter((_, entryIndex) => entryIndex !== index)
                      )
                    }
                    aria-label="Hapus komponen"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="button button-secondary mt-3 w-full justify-center text-xs"
              onClick={() => {
                const candidate = availableProducts.find(
                  product =>
                    product.id !== initialProduct?.id &&
                    !bundleItems.some(
                      item => item.componentProductId === product.id
                    )
                );
                if (candidate)
                  setBundleItems(current => [
                    ...current,
                    { componentProductId: candidate.id, quantity: 1 },
                  ]);
              }}
            >
              <Plus size={14} /> Tambah komponen
            </button>
            <p className="mt-2 text-[10px] leading-tight text-[var(--ink-muted)]">
              Stok paket dihitung dari komponen dengan ketersediaan paling
              sedikit.
            </p>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            Icon produk
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7 sm:gap-2">
            {iconOptions.map(({ name: optionName, label, Icon }) => (
              <button
                type="button"
                key={optionName}
                title={label}
                aria-label={`Pilih ikon ${label}`}
                onClick={() => setIconName(optionName)}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-1.5 text-[9px] transition-all duration-200 sm:p-2 sm:text-[10px] hover:-translate-y-0.5 hover:border-[var(--mint)] ${iconName === optionName ? "border-[var(--mint)] bg-[var(--mint-soft)] text-[var(--mint-dark)] ring-2 ring-[var(--mint)]/20" : "border-gray-200 bg-white text-gray-500"}`}
              >
                <Icon size={18} className="sm:h-5 sm:w-5" />
                <span className="max-w-full text-[10px] leading-tight sm:text-xs">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-footer flex-wrap">
          <button className="button button-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="button button-primary" onClick={submit}>
            Simpan produk
          </button>
        </div>
      </div>
    </div>
  );
}

function Orders({
  orders,
  onConfirm,
  onReceive,
  onEdit,
  onDelete,
  onToast,
  onCreateDraft,
  loading,
  error,
  onRefresh,
}: {
  orders: PurchaseOrder[];
  onConfirm: (id: string) => void;
  onReceive: (order: PurchaseOrder) => void;
  onEdit: (order: PurchaseOrder) => void;
  onDelete: (order: PurchaseOrder) => void;
  onToast: (toast: Toast) => void;
  onCreateDraft: () => void;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState("Semua");
  const visible =
    filter === "Semua"
      ? orders
      : orders.filter(order => order.status === filter);
  return (
    <>
      <PageTitle
        eyebrow="PROCUREMENT / SUPPLY CHAIN"
        title="Purchase Order"
        description="Kelola draft dan pesanan supplier dari satu tempat."
        actions={
          <button className="button button-primary" onClick={onCreateDraft}>
            <Plus size={16} /> Buat draft
          </button>
        }
      />
      {error && <div className="empty-state" role="alert"><b>Purchase order gagal dimuat</b><span>{error}</span><button className="button button-secondary" onClick={onRefresh}>Coba lagi</button></div>}
      <div className="order-status-grid">
        <div className="mini-kpi">
          <span className="kpi-icon violet-bg">
            <FileText size={16} />
          </span>
          <div>
            <span>Total order</span>
            <b>{orders.length} order</b>
          </div>
        </div>
        <div className="mini-kpi">
          <span className="kpi-icon amber-bg">
            <ClipboardList size={16} />
          </span>
          <div>
            <span>Menunggu diproses</span>
            <b>
              {orders.filter(order => order.status === "Draft").length} draft
            </b>
          </div>
        </div>
        <div className="mini-kpi">
          <span className="kpi-icon mint-bg">
            <Check size={16} />
          </span>
          <div>
            <span>Nilai pembelian</span>
            <b>{money(orders.reduce((sum, order) => sum + order.total, 0))}</b>
          </div>
        </div>
      </div>
      <section className="panel orders-panel">
        <div className="panel-header min-w-0 flex-wrap">
          <div>
            <h2>Semua purchase order</h2>
            <p>Riwayat order dan status pengiriman</p>
          </div>
          <div className="filter-pills">
            {["Semua", "Draft", "Ordered", "Received"].map(item => (
              <button
                key={item}
                className={filter === item ? "active" : ""}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {loading && !orders.length ? <div className="h-48 animate-pulse rounded-lg bg-gray-100" /> : <div className="table-wrap overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Supplier</th>
                <th>Produk</th>
                <th>Total</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map(order => (
                <tr key={order.id}>
                  <td className="mono-text">{order.id}</td>
                  <td>
                    <b>{order.supplier}</b>
                  </td>
                  <td>
                    <div className="order-product">
                      <span>{order.product}</span>
                      <small>
                        {order.qty} {order.unit} · {order.reason}
                      </small>
                    </div>
                  </td>
                  <td>
                    <b>{money(order.total)}</b>
                  </td>
                  <td>{order.created}</td>
                  <td>
                    <span
                      className={`badge ${order.status === "Draft" ? "badge-amber" : order.status === "Ordered" ? "badge-blue" : "badge-green"}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {order.status === "Draft" && (
                        <>
                          <button className="small-action" onClick={() => onEdit(order)}>Edit</button>
                          <button className="small-action" onClick={() => onConfirm(order.id)}>Pesan</button>
                          <button className="row-link" onClick={() => onDelete(order)}>Hapus</button>
                        </>
                      )}
                      {order.status === "Ordered" && <button className="small-action" onClick={() => onReceive(order)}>Tandai diterima</button>}
                      {order.status === "Received" && <span>Stok diperbarui</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
        {!visible.length && (
          <div className="empty-state">
            <ClipboardList size={24} />
            <b>{orders.length ? "Belum ada order di filter ini" : "Belum ada purchase order"}</b>
            <span>{orders.length ? "Ubah filter untuk melihat pesanan lain." : "Buat draft dari forecast atau tombol di atas."}</span>
          </div>
        )}
      </section>
    </>
  );
}

function SettingsPage({
  onToast,
  authUser,
  displayName,
  outlet,
  taxRate,
  onGoogleLogin,
  onGoogleLogout,
  receiptFooter,
  onReceiptFooterChange,
  dataStatus,
}: {
  onToast: (toast: Toast) => void;
  authUser: User | null;
  displayName: string;
  outlet: OutletOption | null;
  taxRate: number | null;
  onGoogleLogin: () => void;
  onGoogleLogout: () => void;
  receiptFooter: string;
  onReceiptFooterChange: (value: string) => void;
  dataStatus: "loading" | "live" | "error";
}) {
  const save = () => {
    localStorage.setItem("kopipintar-receipt-footer", receiptFooter);
    onToast({ tone: "success", message: "Pengaturan berhasil disimpan." });
  };
  return (
    <>
      <PageTitle
        eyebrow="PREFERENCES / WORKSPACE CONTROL"
        title="Settings"
        description="Atur preferensi outlet, struk, dan koneksi akun."
        actions={
          <button className="button button-primary" onClick={save}>
            <Check size={16} /> Simpan perubahan
          </button>
        }
      />
      <div className="dashboard-grid">
        <section className="panel" style={{ padding: 22 }}>
          <div className="panel-header min-w-0 flex-wrap">
            <div>
              <h2>Outlet & transaksi</h2>
              <p>Informasi outlet dan tarif pajak berasal dari data transaksi Supabase.</p>
            </div>
            <Settings size={20} className="muted-icon" />
          </div>
          <label
            style={{
              display: "grid",
              gap: 8,
              marginTop: 18,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Outlet
            <input className="select-control" value={outlet ? `${outlet.name} · ${outlet.city}` : "Belum ada outlet"} readOnly />
          </label>
          <label
            style={{
              display: "grid",
              gap: 8,
              marginTop: 18,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Footer struk
            <input
              className="select-control"
              value={receiptFooter}
              onChange={event => onReceiptFooterChange(event.target.value)}
            />
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 20,
              fontSize: 13,
            }}
          >
            <span>
              <b>Pajak layanan {taxRate === null ? "Belum dimuat" : `${number(taxRate * 100)}%`}</b>
              <br />
              <small>Tarif dihitung dari transaksi tersimpan di outlet ini.</small>
            </span>
          </label>
        </section>
        <section className="panel" style={{ padding: 22 }}>
          <div className="panel-header min-w-0 flex-wrap">
            <div>
              <h2>Supabase Auth</h2>
              <p>Akun operator yang saat ini masuk.</p>
            </div>
            <Users size={20} className="muted-icon" />
          </div>
          {authUser ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 18,
              }}
            >
              <div className="profile-avatar">
                {(
                  authUser.user_metadata?.full_name ||
                  authUser.email ||
                  "G"
                )
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <b>
                  {displayName}
                </b>
                <br />
                <small>{authUser.email}</small>
              </div>
              <button
                className="button button-secondary"
                onClick={onGoogleLogout}
              >
                Keluar
              </button>
            </div>
          ) : (
            <>
              <p style={{ marginTop: 18 }}>
                Belum ada akun Google yang terhubung.
              </p>
              <button className="button button-primary" onClick={onGoogleLogin}>
                Masuk dengan Google
              </button>
              {!isSupabaseAuthConfigured && (
                <small
                  style={{
                    display: "block",
                    marginTop: 12,
                    color: "var(--amber)",
                  }}
                >
                  Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY untuk
                  mengaktifkan.
                </small>
              )}
            </>
          )}
        </section>
        <section
          className="panel"
          style={{ padding: 22, gridColumn: "1 / -1" }}
        >
          <div className="panel-header min-w-0 flex-wrap">
            <div>
              <h2>Penyimpanan data</h2>
              <p>Status sinkronisasi untuk outlet yang sedang dipilih.</p>
            </div>
            <Boxes size={20} className="muted-icon" />
          </div>
          <p style={{ marginTop: 16 }}>
            {dataStatus === "live"
              ? "Data outlet tersinkron dan siap digunakan."
              : dataStatus === "error"
                ? "Sebagian data gagal dimuat. Coba muat ulang atau hubungi admin."
                : "Sedang memuat data outlet..."}
          </p>
        </section>
      </div>
    </>
  );
}

function HelpCenter({
  onToast,
  onNavigate,
}: {
  onToast: (toast: Toast) => void;
  onNavigate: (page: PageKey) => void;
}) {
  const [open, setOpen] = useState("database");
  const faqs = [
    {
      id: "database",
      q: "Bagaimana menghubungkan Supabase?",
      a: "Siapkan tabel Supabase, jalankan supabase/static_frontend.sql, lalu set VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada frontend.",
    },
    {
      id: "product",
      q: "Bagaimana menambah produk?",
      a: "Buka Inventory, klik Tambah produk, isi nama, harga, dan stok awal. Data akan tersimpan ke backend jika Supabase aktif.",
    },
    {
      id: "google",
      q: "Kenapa Google login belum aktif?",
      a: "Aktifkan Google Provider di Supabase Authentication, isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY, lalu tambahkan redirect URL.",
    },
    {
      id: "order",
      q: "Bagaimana membuat purchase order?",
      a: "Buka AI Forecast, pilih produk kritis, buat draft, lalu konfirmasi dari halaman Purchase Order.",
    },
  ];
  return (
    <>
      <PageTitle
        eyebrow="SUPPORT / GET STARTED"
        title="Help Center"
        description="Panduan singkat untuk menjalankan Kopipintar."
        actions={
          <button
            className="button button-primary"
            onClick={() => onNavigate("settings")}
          >
            <Settings size={16} /> Buka Settings
          </button>
        }
      />
      <div className="dashboard-grid">
        <section className="panel" style={{ padding: 22 }}>
          <div className="ai-kicker">
            <span className="ai-spark">
              <CircleHelp size={13} />
            </span>{" "}
            KOPIPINTAR STARTER GUIDE
          </div>
          <h2 style={{ marginTop: 18 }}>Mulai dari 3 langkah.</h2>
          <p>
            <b>01 Hubungkan Supabase</b>
            <br />
            Jalankan SQL dan isi environment variables.
          </p>
          <p>
            <b>02 Isi inventory</b>
            <br />
            Tambahkan produk, supplier, dan stok awal.
          </p>
          <p>
            <b>03 Mulai transaksi</b>
            <br />
            Gunakan POS lalu pantau AI Forecast.
          </p>
          <button
            className="button button-secondary"
            onClick={() =>
              onToast({
                tone: "success",
                message: "Checklist onboarding selesai dibuka.",
              })
            }
          >
            Lihat checklist
          </button>
        </section>
        <section className="panel" style={{ padding: 22 }}>
          <div className="panel-header min-w-0 flex-wrap">
            <div>
              <h2>Pertanyaan umum</h2>
              <p>Jawaban kendala yang paling sering terjadi.</p>
            </div>
            <HelpCircle size={20} className="muted-icon" />
          </div>
          {faqs.map(item => (
            <div key={item.id} style={{ borderTop: "1px solid var(--line)" }}>
              <button
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "16px 0",
                  background: "transparent",
                  border: 0,
                  textAlign: "left",
                  font: "inherit",
                  cursor: "pointer",
                }}
                onClick={() => setOpen(open === item.id ? "" : item.id)}
              >
                <b>{item.q}</b>
                <ChevronRight size={16} />
              </button>
              {open === item.id && (
                <p style={{ color: "var(--ink-soft)", lineHeight: 1.6 }}>
                  {item.a}
                </p>
              )}
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function NotificationPanel({
  onClose,
  onNavigate,
  products,
}: {
  onClose: () => void;
  onNavigate: (page: PageKey) => void;
  products: Product[];
}) {
  const alerts = products
    .filter(product => product.stock <= product.minStock)
    .sort((a, b) => a.stock - b.stock);
  const trendProducts = products
    .filter(product => product.trend !== null)
    .sort((a, b) => Math.abs(b.trend || 0) - Math.abs(a.trend || 0));
  return (
    <div className="notification-panel">
      <div className="notification-header">
        <b>Notifikasi</b>
        <button onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {alerts.map(product => (
        <button key={product.id} onClick={() => { onNavigate("forecast"); onClose(); }} className="notification-item warning">
          <span><AlertCircle size={16} /></span>
          <div><b>Stok perlu perhatian</b><small>{product.name}: {number(product.stock)} {product.unit} dari minimum {number(product.minStock)}.</small></div>
        </button>
      ))}
      {trendProducts.slice(0, 1).map(product => (
        <button key={product.id} onClick={() => { onNavigate("forecast"); onClose(); }} className="notification-item success">
          <span><ArrowUpRight size={16} /></span>
          <div><b>Perubahan demand</b><small>{product.name}: {number(product.trend || 0)}% dibanding 7 hari sebelumnya.</small></div>
        </button>
      ))}
      {!alerts.length && !trendProducts.length && <div className="empty-state"><b>Belum ada insight</b><span>Insight muncul setelah data stok dan penjualan tersedia.</span></div>}
    </div>
  );
}

export default function Home() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<SupabaseCategory[]>([]);
  const [supplierRecords, setSupplierRecords] = useState<SupabaseSupplier[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [forecastProductId, setForecastProductId] = useState<number | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<KopipintarProfile | null>(null);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceRetry, setWorkspaceRetry] = useState(0);
  const [taxRate, setTaxRate] = useState<number | null>(null);
  const [taxRateLoaded, setTaxRateLoaded] = useState(false);
  const [taxRateError, setTaxRateError] = useState<string | null>(null);
  const [taxRetry, setTaxRetry] = useState(0);
  const [receiptFooter, setReceiptFooter] = useState(
    () => localStorage.getItem("kopipintar-receipt-footer") || "Terima kasih sudah berkunjung!"
  );

  const showToast = useCallback((next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const approvedRole = profile?.role === "admin" || profile?.role === "kasir";
  const selectedOutlet = outlets.find(outlet => outlet.id === selectedOutletId) || null;
  const productsWithSupplier = useMemo(
    () => products.map(product => ({
      ...product,
      supplierLeadTimeDays:
        supplierRecords.find(supplier => supplier.name === product.supplier)?.lead_time_days ?? null,
    })),
    [products, supplierRecords]
  );
  const productsForUi = useMemo(
    () => productsWithSupplier.map(product => ({
      ...product,
      stock: sellableStock(product, productsWithSupplier),
    })),
    [productsWithSupplier]
  );

  const refreshProducts = useCallback(async () => {
    if (!isSupabaseAuthConfigured || !supabase || !approvedRole || !selectedOutletId) return;
    setSupabaseLoading(true);
    setProductError(null);
    try {
      const rows = await listSupabaseProducts(selectedOutletId, true);
      setProducts(rows.map(mapSupabaseProduct));
      setProductsLoaded(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Data inventory gagal dimuat dari Supabase.";
      setProducts([]);
      setProductsLoaded(false);
      setProductError(message);
      showToast({ tone: "warning", message: `Data inventory gagal dimuat: ${message}` });
    } finally {
      setSupabaseLoading(false);
    }
  }, [approvedRole, selectedOutletId, showToast]);

  const refreshOrders = useCallback(async () => {
    if (!supabase || profile?.role !== "admin" || !selectedOutletId) return;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const rows = await listSupabasePurchaseOrders(selectedOutletId);
      setOrders(rows.map(order => ({
        dbId: order.id,
        id: order.order_number,
        supplier: order.supplier,
        product: order.product_name,
        qty: Number(order.qty),
        unit: order.unit,
        unitCost: Number(order.unit_cost),
        total: Number(order.total),
        reason: order.reason,
        status: order.status,
        created: new Date(order.created_at).toLocaleDateString("id-ID"),
      })));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Purchase order gagal dimuat dari Supabase.";
      setOrders([]);
      setOrdersError(message);
      showToast({ tone: "warning", message: `Purchase order gagal dimuat: ${message}` });
    } finally {
      setOrdersLoading(false);
    }
  }, [profile?.role, selectedOutletId, showToast]);

  useEffect(() => {
    if (!supabase || !approvedRole) return;
    let active = true;
    setWorkspaceLoading(true);
    setWorkspaceLoaded(false);
    setWorkspaceError(null);
    Promise.all([
      listSupabaseOutlets(),
      listSupabaseCategories(),
      profile?.role === "admin" ? listSupabaseSuppliers() : Promise.resolve([]),
    ])
      .then(([outletRows, categories, suppliers]) => {
        if (!active) return;
        setOutlets(outletRows);
        setCategoryOptions(categories);
        setSupplierRecords(suppliers);
        setSelectedOutletId(current =>
          outletRows.some(outlet => outlet.id === current)
            ? current
            : outletRows[0]?.id || 0
        );
        setWorkspaceLoaded(true);
      })
      .catch(error => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Data workspace gagal dimuat.";
        setWorkspaceError(message);
        showToast({ tone: "warning", message: `Workspace gagal dimuat: ${message}` });
      })
      .finally(() => {
        if (active) setWorkspaceLoading(false);
      });
    return () => { active = false; };
  }, [approvedRole, profile?.role, showToast, workspaceRetry]);

  useEffect(() => {
    if (!approvedRole || !selectedOutletId) return;
    void refreshProducts();
  }, [approvedRole, refreshProducts, selectedOutletId]);

  useEffect(() => {
    setProducts([]);
    setProductsLoaded(false);
    setProductError(null);
    setOrders([]);
    setOrdersError(null);
    setTaxRate(null);
    setTaxRateLoaded(false);
  }, [selectedOutletId]);

  useEffect(() => {
    if (!approvedRole || profile?.role !== "admin" || !selectedOutletId) return;
    void refreshOrders();
  }, [approvedRole, activePage, profile?.role, refreshOrders, selectedOutletId]);

  useEffect(() => {
    if (!approvedRole || !selectedOutletId) return;
    let active = true;
    setTaxRateLoaded(false);
    setTaxRateError(null);
    getSupabaseTaxRate(selectedOutletId)
      .then(rate => { if (active) { setTaxRate(rate); setTaxRateLoaded(true); } })
      .catch(error => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Tarif pajak gagal dimuat.";
        setTaxRate(null);
        setTaxRateError(message);
        setTaxRateLoaded(true);
      });
    return () => { active = false; };
  }, [approvedRole, selectedOutletId, taxRetry]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const profileFailure = (error: unknown) => {
      if (!active) return;
      setProfile(null);
      const message = error instanceof Error ? error.message : "Role profile tidak dapat dibaca.";
      showToast({ tone: "warning", message: `Login berhasil, tetapi profile/RLS gagal dibaca: ${message}` });
    };
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!active) return;
        const user = data.session?.user ?? null;
        setAuthUser(user);
        if (user) return getCurrentProfile().then(value => { if (active) setProfile(value); });
        setProfile(null);
      })
      .catch(profileFailure);
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null);
      if (session)
        window.setTimeout(() => getCurrentProfile().then(value => { if (active) setProfile(value); }).catch(profileFailure), 0);
      else setProfile(null);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [showToast]);

  const googleLogin = async () => {
    if (!supabase) return showToast({ tone: "warning", message: "Google Auth belum dikonfigurasi." });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) showToast({ tone: "warning", message: error.message });
  };

  const googleLogout = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    showToast(error
      ? { tone: "warning", message: error.message }
      : { tone: "success", message: "Anda sudah keluar dari Google Auth." });
  };

  const createDraft = async (product?: Product) => {
    if (!product) return showToast({ tone: "info", message: "Belum ada produk untuk dibuatkan draft." });
    if (!product.historyDays || product.dailySales <= 0)
      return showToast({ tone: "info", message: `Belum cukup riwayat transaksi untuk menghitung kebutuhan ${product.name}.` });
    if (!product.supplier)
      return showToast({ tone: "warning", message: `Pilih supplier untuk ${product.name} sebelum membuat purchase order.` });
    const forecast = calculateForecast(product.stock, product.minStock, product.dailySales, product.supplierLeadTimeDays || 0);
    const qty = forecast.reorderQuantity;
    if (qty <= 0) return showToast({ tone: "info", message: `Stok ${product.name} belum membutuhkan reorder.` });
    const existing = orders.find(order => order.product === product.name && order.status === "Draft");
    if (existing) {
      setActivePage("orders");
      return showToast({ tone: "info", message: `Draft ${product.name} sudah tersedia.` });
    }
    const reason = `Rata-rata demand ${number(product.dailySales)} ${product.unit}/hari; stok ${number(product.stock)}; lead time ${product.supplierLeadTimeDays ?? "tidak tersedia"} hari.`;
    try {
      await insertSupabasePurchaseOrder({
        outlet_id: selectedOutletId,
        supplier: product.supplier,
        product_id: product.id,
        product_name: product.name,
        qty,
        unit: product.unit,
        unit_cost: product.cost,
        reason,
      });
      await refreshOrders();
      setActivePage("orders");
      showToast({ tone: "success", message: `Draft pesanan ${product.name} berhasil dibuat.` });
    } catch (error) {
      showToast({ tone: "warning", message: error instanceof Error ? `Draft gagal disimpan: ${error.message}` : "Draft gagal disimpan ke Supabase." });
    }
  };

  const changeOrderStatus = async (orderNumber: string) => {
    try {
      await updateSupabasePurchaseOrderStatus(orderNumber, selectedOutletId, "Ordered");
      await refreshOrders();
      showToast({ tone: "success", message: `${orderNumber} dikonfirmasi dan dikirim ke supplier.` });
    } catch (error) {
      showToast({ tone: "warning", message: error instanceof Error ? `Status order gagal disimpan: ${error.message}` : "Status order gagal disimpan ke Supabase." });
    }
  };

  const receiveOrder = async (order: PurchaseOrder) => {
    try {
      await receiveSupabasePurchaseOrder(order.dbId);
      await Promise.all([refreshOrders(), refreshProducts()]);
      showToast({ tone: "success", message: `${order.id} diterima; stok produk diperbarui.` });
    } catch (error) {
      showToast({ tone: "warning", message: error instanceof Error ? `Penerimaan order gagal: ${error.message}` : "Penerimaan order gagal." });
    }
  };

  const editOrder = async (order: PurchaseOrder) => {
    const qty = Number(window.prompt("Jumlah", String(order.qty)));
    if (!Number.isFinite(qty) || qty <= 0) return showToast({ tone: "warning", message: "Jumlah harus lebih besar dari nol." });
    const unitCost = Number(window.prompt("Harga satuan", String(order.unitCost)));
    if (!Number.isFinite(unitCost) || unitCost < 0) return showToast({ tone: "warning", message: "Harga satuan tidak valid." });
    const supplier = window.prompt("Supplier", order.supplier);
    if (!supplier?.trim()) return;
    const reason = window.prompt("Alasan order", order.reason);
    if (reason === null) return;
    try {
      await updateSupabasePurchaseOrder(order.id, selectedOutletId, {
        supplier: supplier.trim(), qty, unit_cost: unitCost, reason: reason.trim(),
      });
      await refreshOrders();
      showToast({ tone: "success", message: `${order.id} berhasil diperbarui.` });
    } catch (error) {
      showToast({ tone: "warning", message: error instanceof Error ? `Order gagal diperbarui: ${error.message}` : "Order gagal diperbarui." });
    }
  };

  const deleteOrder = async (order: PurchaseOrder) => {
    if (!window.confirm(`Hapus draft ${order.id}?`)) return;
    try {
      await deleteSupabasePurchaseOrder(order.id, selectedOutletId);
      await refreshOrders();
      showToast({ tone: "success", message: `${order.id} berhasil dihapus.` });
    } catch (error) {
      showToast({ tone: "warning", message: error instanceof Error ? `Draft gagal dihapus: ${error.message}` : "Draft gagal dihapus." });
    }
  };

  const effectivePage = profile?.role === "admin" ? activePage : "pos";
  const displayName = authUser
    ? resolveDisplayName(profile?.full_name, authUser.user_metadata?.full_name, profile?.username, authUser.email)
    : "Pengguna";
  const currentUser = authUser
    ? { name: displayName, email: authUser.email, role: profile?.role || "pending" }
    : null;
  const openAuthenticatedWorkspace = () => setActivePage("dashboard");

  useEffect(() => {
    if (authUser && profile?.role === "kasir" && activePage !== "pos") setActivePage("pos");
  }, [authUser, profile?.role, activePage]);

  const handleLogout = async () => {
    try {
      if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setNotificationsOpen(false);
      setActivePage("dashboard");
      showToast({ tone: "success", message: "Anda sudah keluar. Silakan login kembali." });
    } catch (error) {
      showToast({ tone: "warning", message: error instanceof Error ? `Logout gagal: ${error.message}` : "Logout gagal melalui Supabase Auth." });
    }
  };

  const inventoryAttention = productsForUi.filter(product =>
    getRisk(product) === "Tinggi" || getRisk(product) === "Sedang" || getRisk(product) === "Habis"
  ).length;
  const dataStatus: "loading" | "live" | "error" =
    workspaceError || productError || taxRateError
      ? "error"
      : workspaceLoading || !workspaceLoaded || supabaseLoading || !productsLoaded || !taxRateLoaded
        ? "loading"
        : "live";

  if (!authUser) return <AuthLanding onAuthenticated={openAuthenticatedWorkspace} onGoogle={googleLogin} onToast={showToast} />;
  if (profile?.role !== "admin" && profile?.role !== "kasir")
    return (
      <div className="min-h-screen bg-[var(--canvas)] px-4 py-12">
        <section className="mx-auto max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-[var(--ink)]">Akun menunggu persetujuan</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">Login berhasil, tetapi akun ini belum memiliki role Kopipintar yang disetujui. Hubungi administrator untuk meminta akses.</p>
          <button className="button button-secondary mt-6 justify-center" onClick={() => void handleLogout()}>Keluar</button>
        </section>
      </div>
    );

  let content: React.ReactNode;
  if (workspaceError) {
    content = <div className="empty-state" role="alert"><b>Workspace gagal dimuat</b><span>{workspaceError}</span><button className="button button-secondary" onClick={() => setWorkspaceRetry(current => current + 1)}>Coba lagi</button></div>;
  } else if (!selectedOutlet && workspaceLoaded) {
    content = <div className="empty-state"><b>Belum ada outlet aktif</b><span>Tambahkan outlet di Supabase sebelum menggunakan aplikasi.</span></div>;
  } else if (effectivePage === "dashboard") {
    content = <DashboardLive products={productsForUi} outletId={selectedOutletId} outletName={selectedOutlet ? `${selectedOutlet.name} - ${selectedOutlet.city}` : ""} userName={displayName} productLoading={supabaseLoading} productError={productError} onRetryProducts={refreshProducts} onPage={setActivePage} onForecast={product => { setForecastProductId(product.id); setActivePage("forecast"); }} />;
  } else if (effectivePage === "pos") {
    content = <POS products={productsForUi} setProducts={setProducts} outletId={selectedOutletId} onToast={showToast} onTransaction={async () => { await refreshProducts(); showToast({ tone: "success", message: "Penjualan tercatat dan stok diperbarui dari Supabase." }); }} hasSupabaseSession={Boolean(authUser)} categoryNames={categoryOptions.map(item => item.name)} taxRate={taxRate} outletName={selectedOutlet?.name || ""} footerText={receiptFooter} productLoading={supabaseLoading} productError={productError} taxRateError={taxRateError} onRefreshProducts={refreshProducts} onRetryTaxRate={() => setTaxRetry(current => current + 1)} />;
  } else if (effectivePage === "inventory") {
    content = <Inventory products={productsForUi} setProducts={setProducts} outletId={selectedOutletId} onToast={showToast} canWriteSupabase={profile?.role === "admin"} categoryOptions={categoryOptions} supplierOptions={supplierRecords} loading={supabaseLoading} loadError={productError} onRefresh={refreshProducts} />;
  } else if (effectivePage === "forecast") {
    content = <ForecastLive products={productsForUi} onCreateDraft={product => void createDraft(product)} onRefresh={() => void refreshProducts()} initialProductId={forecastProductId} loading={supabaseLoading} error={productError} />;
  } else if (effectivePage === "orders") {
    content = <Orders orders={orders} loading={ordersLoading} error={ordersError} onRefresh={() => void refreshOrders()} onCreateDraft={() => void createDraft(productsForUi.find(product => getRisk(product) !== "Sehat"))} onConfirm={id => void changeOrderStatus(id)} onReceive={order => void receiveOrder(order)} onEdit={order => void editOrder(order)} onDelete={order => void deleteOrder(order)} onToast={showToast} />;
  } else if (effectivePage === "suppliers") {
    content = <SuppliersLive products={productsForUi} onToast={showToast} />;
  } else if (effectivePage === "settings") {
    content = <SettingsPage onToast={showToast} authUser={authUser} displayName={displayName} outlet={selectedOutlet} taxRate={taxRate} onGoogleLogin={googleLogin} onGoogleLogout={googleLogout} receiptFooter={receiptFooter} onReceiptFooterChange={setReceiptFooter} dataStatus={dataStatus} />;
  } else if (effectivePage === "help") {
    content = <HelpCenter onToast={showToast} onNavigate={setActivePage} />;
  } else {
    content = <ReportsLive outletId={selectedOutletId} onToast={showToast} />;
  }

  return (
    <div className="shell-wrap">
      <AppShell
        activePage={effectivePage}
        setActivePage={setActivePage}
        onNotifications={() => setNotificationsOpen(current => !current)}
        outlets={outlets}
        selectedOutletId={selectedOutletId}
        onOutletChange={id => setSelectedOutletId(id)}
        user={currentUser}
        onLogout={handleLogout}
        inventoryAttention={inventoryAttention}
        dataStatus={dataStatus}
      >
        {content}
      </AppShell>
      {supabaseLoading && <div className="fixed right-6 top-20 z-40 rounded-full border bg-white px-3 py-2 text-xs shadow">Memuat data Supabase...</div>}
      {notificationsOpen && <NotificationPanel onClose={() => setNotificationsOpen(false)} onNavigate={setActivePage} products={productsForUi} />}
      {toast && <div className={`toast toast-${toast.tone}`}><span className="live-dot" />{toast.message}<button onClick={() => setToast(null)} aria-label="Tutup notifikasi"><X size={15} /></button></div>}
    </div>
  );
}
