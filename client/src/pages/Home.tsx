import { useEffect, useMemo, useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { adjustSupabaseProductStock, createSupabaseSale, getCurrentProfile, insertSupabaseProduct, isSupabaseAuthConfigured, listSupabaseProducts, signInWithUsername, supabase } from "@/lib/supabase";
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type PageKey = "dashboard" | "pos" | "inventory" | "forecast" | "orders" | "suppliers" | "reports" | "settings" | "help";
type Risk = "Tinggi" | "Sedang" | "Sehat" | "Habis";
type OrderStatus = "Draft" | "Ordered" | "Received";

type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
  supplier: string;
  dailySales: number;
  trend: number;
  emoji: string;
};

type CartItem = Product & { qty: number };
type PurchaseOrder = {
  id: string;
  supplier: string;
  product: string;
  qty: number;
  unit: string;
  unitCost: number;
  total: number;
  reason: string;
  status: OrderStatus;
  created: string;
};

type Toast = { tone: "success" | "info" | "warning"; message: string };
type OutletOption = { id: number; name: string; code: string; city: string; active: number };

const categories = ["Semua", "Kopi", "Non-kopi", "Makanan", "Minuman"];
const navItems: { id: PageKey; label: string; icon: LucideIcon; badge?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pos", label: "POS / Kasir", icon: Calculator },
  { id: "inventory", label: "Inventory", icon: Boxes, badge: "3" },
  { id: "forecast", label: "AI Forecast", icon: Sparkles, badge: "AI" },
  { id: "orders", label: "Purchase Order", icon: ClipboardList },
  { id: "suppliers", label: "Supplier", icon: Truck },
  { id: "reports", label: "Reports", icon: FileBarChart },
];

const initialProducts: Product[] = [
  { id: 1, name: "Arabica Coffee", sku: "COF-001", category: "Kopi", unit: "kg", stock: 12, minStock: 20, cost: 120000, price: 28500, supplier: "PT Coffee Supply", dailySales: 4, trend: 18, emoji: "☕" },
  { id: 2, name: "Robusta Coffee", sku: "COF-002", category: "Kopi", unit: "kg", stock: 28, minStock: 15, cost: 88000, price: 22000, supplier: "PT Coffee Supply", dailySales: 2.7, trend: 8, emoji: "☕" },
  { id: 3, name: "Matcha Latte", sku: "DRK-001", category: "Non-kopi", unit: "pack", stock: 8, minStock: 12, cost: 35000, price: 32000, supplier: "Green Tea Co.", dailySales: 2.1, trend: 32, emoji: "🍵" },
  { id: 4, name: "Cappuccino", sku: "DRK-002", category: "Kopi", unit: "pack", stock: 45, minStock: 18, cost: 15000, price: 28000, supplier: "PT Coffee Supply", dailySales: 4.8, trend: 14, emoji: "☕" },
  { id: 5, name: "Americano", sku: "DRK-003", category: "Kopi", unit: "pack", stock: 34, minStock: 18, cost: 12000, price: 24000, supplier: "PT Coffee Supply", dailySales: 3.8, trend: 6, emoji: "🧊" },
  { id: 6, name: "Croissant Butter", sku: "FOD-001", category: "Makanan", unit: "pcs", stock: 18, minStock: 12, cost: 12500, price: 26000, supplier: "Bakehouse Jakarta", dailySales: 2.4, trend: 12, emoji: "🥐" },
  { id: 7, name: "Brownies Fudge", sku: "FOD-002", category: "Makanan", unit: "pcs", stock: 6, minStock: 10, cost: 10000, price: 22000, supplier: "Bakehouse Jakarta", dailySales: 1.8, trend: -4, emoji: "🍫" },
  { id: 8, name: "Mineral Water", sku: "MIN-001", category: "Minuman", unit: "btl", stock: 70, minStock: 30, cost: 3500, price: 8000, supplier: "FreshMart Supply", dailySales: 6.1, trend: 2, emoji: "💧" },
  { id: 9, name: "Vanilla Syrup", sku: "SYP-001", category: "Non-kopi", unit: "btl", stock: 9, minStock: 8, cost: 75000, price: 115000, supplier: "Mixology Goods", dailySales: 0.6, trend: 5, emoji: "🍯" },
  { id: 10, name: "Caramel Sauce", sku: "SYP-002", category: "Non-kopi", unit: "btl", stock: 15, minStock: 8, cost: 68000, price: 105000, supplier: "Mixology Goods", dailySales: 0.7, trend: 3, emoji: "🍮" },
  { id: 11, name: "Iced Chocolate", sku: "DRK-004", category: "Non-kopi", unit: "pack", stock: 22, minStock: 14, cost: 18000, price: 30000, supplier: "Green Tea Co.", dailySales: 2.5, trend: 11, emoji: "🍫" },
  { id: 12, name: "Pain au Chocolat", sku: "FOD-003", category: "Makanan", unit: "pcs", stock: 13, minStock: 10, cost: 14000, price: 28000, supplier: "Bakehouse Jakarta", dailySales: 1.6, trend: 3, emoji: "🥖" },
  { id: 13, name: "Cold Brew", sku: "DRK-005", category: "Kopi", unit: "btl", stock: 24, minStock: 12, cost: 18000, price: 32000, supplier: "PT Coffee Supply", dailySales: 2.9, trend: 21, emoji: "🫗" },
  { id: 14, name: "Espresso Blend", sku: "COF-003", category: "Kopi", unit: "kg", stock: 19, minStock: 14, cost: 135000, price: 290000, supplier: "PT Coffee Supply", dailySales: 1.5, trend: 9, emoji: "☕" },
  { id: 15, name: "Lemon Tea", sku: "DRK-006", category: "Non-kopi", unit: "pack", stock: 31, minStock: 15, cost: 9500, price: 20000, supplier: "Green Tea Co.", dailySales: 2.4, trend: 4, emoji: "🍋" },
];

const initialOrders: PurchaseOrder[] = [
  { id: "PO-2409-001", supplier: "Green Tea Co.", product: "Matcha Latte", qty: 15, unit: "pack", unitCost: 35000, total: 525000, reason: "Trend penjualan naik 32% minggu ini.", status: "Ordered", created: "18 Sep 2024" },
  { id: "PO-2409-002", supplier: "Bakehouse Jakarta", product: "Brownies Fudge", qty: 20, unit: "pcs", unitCost: 10000, total: 200000, reason: "Stok di bawah minimum stock.", status: "Draft", created: "19 Sep 2024" },
];

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value).replace("Rp", "Rp ");
const number = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value);
const todayLabel = "Kamis, 19 September 2024";

function mapSupabaseProduct(row: any): Product {
  return { id: Number(row.id), name: row.name, sku: row.sku, category: row.category, unit: row.unit, stock: Number(row.stock), minStock: Number(row.min_stock), cost: Number(row.cost), price: Number(row.price), supplier: row.supplier || "Supplier belum diatur", dailySales: Number(row.daily_sales || 0), trend: Number(row.trend || 0), emoji: row.emoji || "📦" };
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
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
  if (getCoverage(product) <= 3 || product.stock <= Math.max(5, product.minStock * 0.65)) return "Tinggi";
  if (product.stock <= product.minStock) return "Sedang";
  return "Sehat";
}

function getCoverage(product: Product) {
  return product.dailySales ? product.stock / product.dailySales : 99;
}

function getStockoutDate(product: Product) {
  if (getCoverage(product) > 30) return "Aman >30 hari";
  const date = new Date();
  date.setDate(date.getDate() + Math.max(1, Math.ceil(getCoverage(product))));
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return <button aria-label={label} onClick={onClick} className="icon-button">{children}</button>;
}

function StatusBadge({ risk }: { risk: Risk }) {
  const styles: Record<Risk, string> = { Tinggi: "badge badge-red", Sedang: "badge badge-amber", Sehat: "badge badge-green", Habis: "badge badge-red" };
  return <span className={styles[risk]}>{risk === "Tinggi" ? "Kritis" : risk}</span>;
}

function Sparkline({ points, color = "#4f8a77" }: { points: number[]; color?: string }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const width = 88;
  const height = 32;
  const coords = points.map((point, index) => `${(index / (points.length - 1)) * width},${height - ((point - min) / Math.max(1, max - min)) * 24 - 4}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true"><polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={coords} /></svg>;
}

function AuthLanding({ onDemo, onGoogle, onToast }: { onDemo: () => void; onGoogle: () => void; onToast: (toast: Toast) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!supabase) return onToast({ tone: "warning", message: "Supabase Auth belum dikonfigurasi. Gunakan mode demo atau isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY." });
    if ((mode === "login" ? !username : !email) || password.length < 6) return onToast({ tone: "warning", message: mode === "login" ? "Isi username dan password minimal 6 karakter." : "Isi email dan password minimal 6 karakter." });
    setBusy(true);
    const result = mode === "login" ? await signInWithUsername(username, password) : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    setBusy(false);
    if (result.error) return onToast({ tone: "warning", message: result.error.message });
    onToast({ tone: "success", message: mode === "login" ? "Login berhasil." : "Akun berhasil dibuat. Cek email jika konfirmasi dibutuhkan." });
    if (mode === "signup" && !result.data.session) return;
    onDemo();
  };
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--paper)" }}><div style={{ width: "min(980px, 100%)", display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 24 }}><section className="panel" style={{ padding: 34, minHeight: 520, display: "flex", flexDirection: "column", justifyContent: "space-between" }}><div><div className="brand-row"><div className="brand-mark"><Coffee size={20} /></div><div><div className="brand-name">Kopi<span>pintar</span></div><div className="brand-subtitle">OPERATING SYSTEM</div></div></div><div className="eyebrow" style={{ marginTop: 70 }}>SMART POS / BUSINESS CONTROL</div><h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.8rem)", lineHeight: .98, margin: "18px 0" }}>Kelola kedai lebih <em>pintar.</em></h1><p style={{ maxWidth: 450, lineHeight: 1.7 }}>Dashboard operasional untuk memantau penjualan, stok, dan keputusan restock dalam satu tempat.</p></div><div style={{ display: "flex", gap: 18, flexWrap: "wrap", color: "var(--ink-soft)", fontSize: 13 }}><span><b>01</b> Dashboard</span><span><b>02</b> POS / Kasir</span><span><b>03</b> AI Forecast</span></div></section><section className="panel" style={{ padding: 30 }}><div style={{ display: "flex", gap: 8, marginBottom: 24 }}><button className={`button ${mode === "login" ? "button-primary" : "button-secondary"}`} onClick={() => setMode("login")}>Login</button><button className={`button ${mode === "signup" ? "button-primary" : "button-secondary"}`} onClick={() => setMode("signup")}>Signup</button></div><h2>{mode === "login" ? "Selamat datang kembali" : "Buat akun operator"}</h2><p>{mode === "login" ? "Masuk dengan username untuk membuka dashboard utama dan POS." : "Daftarkan akun untuk mulai mengelola outlet."}</p>{mode === "signup" && <label style={{ display: "grid", gap: 7, marginTop: 20, fontSize: 13, fontWeight: 700 }}>Nama<input className="select-control" value={name} onChange={event => setName(event.target.value)} placeholder="Nama kamu" /></label>}{mode === "login" ? <label style={{ display: "grid", gap: 7, marginTop: 16, fontSize: 13, fontWeight: 700 }}>Username<input className="select-control" value={username} onChange={event => setUsername(event.target.value)} placeholder="admin atau kasir" /></label> : <label style={{ display: "grid", gap: 7, marginTop: 16, fontSize: 13, fontWeight: 700 }}>Email<input className="select-control" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="nama@email.com" /></label>}<label style={{ display: "grid", gap: 7, marginTop: 16, fontSize: 13, fontWeight: 700 }}>Password<input className="select-control" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Minimal 6 karakter" /></label><button className="button button-primary" style={{ width: "100%", justifyContent: "center", marginTop: 22 }} onClick={submit} disabled={busy}>{busy ? "Memproses..." : mode === "login" ? "Masuk ke Dashboard" : "Buat akun"}</button><div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0", color: "var(--ink-muted)", fontSize: 12 }}><span style={{ height: 1, background: "var(--line)", flex: 1 }} />atau<span style={{ height: 1, background: "var(--line)", flex: 1 }} /></div><button className="button button-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={onGoogle}>Masuk dengan Google</button><button className="button" style={{ width: "100%", justifyContent: "center", marginTop: 10, background: "transparent", border: 0 }} onClick={onDemo}>Lanjutkan sebagai Demo</button><small style={{ display: "block", marginTop: 18, color: "var(--ink-muted)", lineHeight: 1.5 }}>Akun demo: admin / adminkopipintar atau kasir / kasirkopipintar.</small></section></div></div>;
}

function AppShell({ activePage, setActivePage, children, onNotifications, outlets, selectedOutletId, onOutletChange, user, onLogout }: { activePage: PageKey; setActivePage: (page: PageKey) => void; children: React.ReactNode; onNotifications: () => void; outlets: OutletOption[]; selectedOutletId: number; onOutletChange: (id: number) => void; user: { name?: string | null; email?: string | null; role?: string } | null; onLogout: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isCashier = user?.role === "kasir";
  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><Coffee size={20} strokeWidth={2.8} /></div>
          <div><div className="brand-name">Kopi<span>pintar</span></div><div className="brand-subtitle">OPERATING SYSTEM</div></div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu"><X size={18} /></button>
        </div>
        <div className="workspace-switcher"><div className="workspace-avatar">KB</div><div className="workspace-copy"><select aria-label="Pilih outlet" value={selectedOutletId} onChange={event => onOutletChange(Number(event.target.value))}>{outlets.map(outlet => <option value={outlet.id} key={outlet.id}>{outlet.name}</option>)}</select><span>{outlets.find(outlet => outlet.id === selectedOutletId)?.city || "Outlet utama"}</span></div><ChevronRight size={16} className="muted-icon" /></div>
        <div className="nav-heading">WORKSPACE</div>
        <nav className="main-nav">
          {navItems.filter(item => !isCashier || item.id === "pos").map(({ id, label, icon: NavIcon, badge }) => <button key={id} onClick={() => { setActivePage(id); setSidebarOpen(false); }} className={`nav-item ${activePage === id ? "active" : ""}`}><NavIcon size={18} /><span>{label}</span>{badge && <span className={`nav-badge ${badge === "AI" ? "ai-badge" : ""}`}>{badge}</span>}</button>)}
        </nav>
        {!isCashier && <div className="sidebar-footer"><div className="nav-heading">PREFERENSI</div><button onClick={() => setActivePage("settings")} className={`nav-item ${activePage === "settings" ? "active" : ""}`}><Settings size={18} /><span>Settings</span></button><button onClick={() => setActivePage("help")} className={`nav-item ${activePage === "help" ? "active" : ""}`}><CircleHelp size={18} /><span>Help center</span></button></div>}
        <div className="sidebar-profile"><div className="profile-avatar">{(user?.name || "AR").slice(0, 2).toUpperCase()}</div><div><b>{user?.name || "Demo Operator"}</b><span>{user?.role === "admin" ? "Administrator" : "Cashier"}</span></div><button className="profile-logout" onClick={onLogout}>{user ? "Keluar" : "Masuk"}</button></div>
      </aside>
      {sidebarOpen && <button className="mobile-overlay" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu" />}
      <main className="main-area">
        <header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Buka menu"><Menu size={20} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><b>{navItems.find(item => item.id === activePage)?.label || (activePage === "settings" ? "Settings" : activePage === "help" ? "Help center" : "Dashboard")}</b></div><div className="topbar-actions"><span className="status-dot"><span /> Semua sistem normal</span><IconButton label="Notifikasi" onClick={onNotifications}><Bell size={18} /></IconButton><div className="topbar-avatar">{(user?.name || "AR").slice(0, 2).toUpperCase()}</div></div></header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}

function PageTitle({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="page-title-row"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

function MetricCard({ icon: CardIcon, label, value, change, positive = true, note, accent = "mint" }: { icon: LucideIcon; label: string; value: string; change: string; positive?: boolean; note: string; accent?: "mint" | "blue" | "amber" | "violet" }) {
  return <div className={`metric-card accent-${accent}`}><div className="metric-top"><div className="metric-icon"><CardIcon size={17} /></div><span className={positive ? "change positive" : "change negative"}>{positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change}</span></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></div>;
}

function SalesChart() {
  const bars = [44, 66, 52, 78, 60, 87, 69, 75, 58, 82, 70, 92, 76, 84, 63, 73, 88, 67, 91, 79, 95, 77, 84, 72, 89, 97, 82, 94, 87, 100];
  const labels = ["21 Agu", "25 Agu", "29 Agu", "02 Sep", "06 Sep", "10 Sep", "14 Sep", "19 Sep"];
  return <div className="sales-chart"><div className="chart-y-labels"><span>Rp 5 jt</span><span>Rp 3,5 jt</span><span>Rp 2 jt</span><span>Rp 0</span></div><div className="chart-plot"><div className="chart-grid"><i /><i /><i /><i /></div><div className="chart-bars">{bars.map((height, index) => <div key={index} className="chart-bar-wrap"><div className="chart-bar" style={{ height: `${height}%`, animationDelay: `${index * 12}ms` }} /></div>)}</div><div className="chart-x-labels">{labels.map(label => <span key={label}>{label}</span>)}</div></div></div>;
}

function Dashboard({ products, setActivePage, onForecast, onToast }: { products: Product[]; setActivePage: (page: PageKey) => void; onForecast: (product: Product) => void; onToast: (toast: Toast) => void }) {
  const lowStock = products.filter(product => getRisk(product) === "Tinggi" || getRisk(product) === "Sedang");
  const topProducts = [...products].sort((a, b) => b.dailySales * b.price - a.dailySales * a.price).slice(0, 4);
  const [period, setPeriod] = useState("30 hari");
  return <>
    <PageTitle eyebrow={`OVERVIEW / ${todayLabel}`} title="Selamat sore, Andi" description="Pantau kesehatan bisnis Kedai Bumi dalam satu pandangan." actions={<><button className="button button-secondary" onClick={() => onToast({ tone: "info", message: "Data dashboard sudah paling baru." })}><span className="live-dot" /> Data live</button><button className="button button-primary" onClick={() => setActivePage("pos")}><Plus size={16} /> Transaksi baru</button></>} />
    <div className="metric-grid"><MetricCard icon={BarChart3} label="Penjualan hari ini" value="Rp 4.850.000" change="12,5%" note="vs kemarin" accent="mint" /><MetricCard icon={ShoppingCart} label="Total transaksi" value="128" change="8,2%" note="vs kemarin" accent="blue" /><MetricCard icon={Zap} label="Estimasi profit" value="Rp 2.910.000" change="14,8%" note="margin 60%" accent="amber" /><MetricCard icon={PackagePlus} label="Produk terjual" value="486" change="6,4%" note="unit hari ini" accent="violet" /><MetricCard icon={AlertCircle} label="Perlu perhatian" value={`${lowStock.length} produk`} change="" positive={false} note="cek rekomendasi AI" accent="amber" /></div>
    <div className="dashboard-grid top-grid"><section className="panel chart-panel"><div className="panel-header"><div><h2>Performa penjualan</h2><p>Revenue kotor dari semua channel</p></div><select className="select-control" value={period} onChange={event => setPeriod(event.target.value)}><option>7 hari</option><option>30 hari</option><option>90 hari</option></select></div><div className="chart-total"><strong>{period === "7 hari" ? "Rp 28.400.000" : period === "90 hari" ? "Rp 246.800.000" : "Rp 118.420.000"}</strong><span className="positive-text"><ArrowUpRight size={15} /> 12,5%</span><span className="chart-muted">dari periode sebelumnya</span></div><SalesChart /></section><section className="panel insight-panel"><div className="panel-header"><div><div className="ai-kicker"><span className="ai-spark"><Sparkles size={13} /></span> AI-POWERED ASSISTANT</div><h2>3 hal yang butuh perhatian</h2></div><button className="text-button" onClick={() => setActivePage("forecast")}>Lihat semua <ChevronRight size={15} /></button></div><div className="insight-list"><button className="insight-card insight-critical" onClick={() => onForecast(products.find(product => product.name === "Arabica Coffee") || products[0])}><span className="insight-icon"><AlertCircle size={17} /></span><span><b>Arabica Coffee akan habis 3 hari lagi</b><small>Stok 12 kg · penjualan naik 18%</small></span><ChevronRight size={17} /></button><button className="insight-card insight-positive" onClick={() => onToast({ tone: "success", message: "Matcha Latte ditandai sebagai produk rising." })}><span className="insight-icon"><ArrowUpRight size={17} /></span><span><b>Matcha Latte sedang naik daun</b><small>Permintaan naik 32% minggu ini</small></span><ChevronRight size={17} /></button><button className="insight-card insight-action" onClick={() => onForecast(products.find(product => product.name === "Arabica Coffee") || products[0])}><span className="insight-icon"><Zap size={17} /></span><span><b>Rekomendasi reorder tersedia</b><small>20 kg Arabica · estimasi Rp 2,4 jt</small></span><ChevronRight size={17} /></button></div><div className="assistant-footer"><span><Sparkles size={14} /> Estimasi berdasarkan 30+ hari data transaksi</span><button onClick={() => setActivePage("forecast")}>Pelajari cara kerja</button></div></section></div>
    <div className="dashboard-grid bottom-grid"><section className="panel"><div className="panel-header"><div><h2>Produk terlaris</h2><p>Kontributor revenue tertinggi hari ini</p></div><button className="text-button" onClick={() => setActivePage("reports")}>Lihat laporan <ChevronRight size={15} /></button></div><div className="product-list">{topProducts.map((product, index) => <div className="product-row" key={product.id}><div className="rank">0{index + 1}</div><div className="product-emoji">{product.emoji}</div><div className="product-row-copy"><b>{product.name}</b><span>{number(product.dailySales * 10)} unit terjual</span></div><div className="product-revenue"><b>{money(product.dailySales * product.price * 10)}</b><span className={product.trend >= 0 ? "positive-text" : "negative-text"}>{product.trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(product.trend)}%</span></div><Sparkline points={[4, 7, 6, 8, 6 + index, 9, 11]} /></div>)}</div></section><section className="panel attention-panel"><div className="panel-header"><div><h2>Status inventory</h2><p>Ringkasan kesehatan stok</p></div><button className="icon-button small" onClick={() => setActivePage("inventory")}><ChevronRight size={16} /></button></div><div className="inventory-summary"><div><span className="summary-number danger">{products.filter(product => getRisk(product) === "Tinggi").length}</span><span>Kritis</span></div><div><span className="summary-number warning">{products.filter(product => getRisk(product) === "Sedang").length}</span><span>Rendah</span></div><div><span className="summary-number success">{products.filter(product => getRisk(product) === "Sehat").length}</span><span>Sehat</span></div></div><div className="stock-progress"><div className="progress-label"><span>Rasio stok sehat</span><b>{Math.round((products.filter(product => getRisk(product) === "Sehat").length / products.length) * 100)}%</b></div><div className="progress-track"><span style={{ width: `${Math.round((products.filter(product => getRisk(product) === "Sehat").length / products.length) * 100)}%` }} /></div><small>Target minimal 80% untuk operasi optimal</small></div><div className="mini-alert"><AlertCircle size={15} /><span><b>Prioritas:</b> segera restock Arabica Coffee</span><button onClick={() => setActivePage("forecast")}>Tindakan <ChevronRight size={14} /></button></div></section></div>
  </>;
}

function POS({ products, setProducts, onToast, onTransaction, isAuthenticated, hasSupabaseSession, outletId }: { products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; onToast: (toast: Toast) => void; onTransaction: (total: number) => void; isAuthenticated: boolean; hasSupabaseSession: boolean; outletId: number }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState("Semua");
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("QRIS");
  const [isPaid, setIsPaid] = useState(false);
  const paymentSession = trpc.integrations.paymentSession.useMutation();
  const createSale = trpc.sales.create.useMutation();
  const barcodeLookup = trpc.integrations.barcodeLookup.useQuery({ code: "USB-SCANNER-READY" }, { enabled: false });
  const filtered = products.filter(product => (category === "Semua" || product.category === category) && product.name.toLowerCase().includes(query.toLowerCase()));
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + tax;
  const addToCart = (product: Product) => setCart(current => { const found = current.find(item => item.id === product.id); if (found) return current.map(item => item.id === product.id ? { ...item, qty: Math.min(item.qty + 1, product.stock) } : item); return [...current, { ...product, qty: 1 }]; });
  const changeQty = (id: number, amount: number) => setCart(current => current.map(item => item.id === id ? { ...item, qty: Math.max(0, Math.min(item.qty + amount, item.stock)) } : item).filter(item => item.qty > 0));
  const pay = async () => { if (!cart.length) return onToast({ tone: "warning", message: "Tambahkan produk ke keranjang terlebih dahulu." }); if (isAuthenticated) { try { await paymentSession.mutateAsync({ total, method: payment as "QRIS" | "Tunai" | "Debit" }); } catch { return onToast({ tone: "warning", message: "Payment gateway belum aktif untuk outlet ini." }); } } try { const saleInput = { outletId, paymentMethod: payment as "QRIS" | "Tunai" | "Debit", subtotal, tax, total, items: cart.map(item => ({ productId: item.id, productName: item.name, qty: item.qty, unitPrice: item.price, unitCost: item.cost })) }; if (isSupabaseAuthConfigured && hasSupabaseSession) await createSupabaseSale(saleInput); else await createSale.mutateAsync(saleInput); } catch { return onToast({ tone: "warning", message: "Transaksi gagal disimpan. Periksa koneksi backend." }); } setProducts(current => current.map(product => { const item = cart.find(cartItem => cartItem.id === product.id); return item ? { ...product, stock: product.stock - item.qty } : product; })); onTransaction(total); setIsPaid(true); };
  return <><PageTitle eyebrow="TRANSACTION / COUNTER 01" title="POS / Kasir" description="Proses pesanan dengan cepat, stok otomatis tersinkronisasi." actions={<div className="counter-status"><span className="live-dot" /> Counter 01 · Siap melayani</div>} /><div className="pos-layout"><section className="pos-catalog panel"><div className="pos-toolbar"><div className="search-box"><Search size={17} /><input placeholder="Cari produk atau SKU..." value={query} onChange={event => setQuery(event.target.value)} /></div><button className="button button-secondary" onClick={() => barcodeLookup.refetch().then(() => onToast({ tone: "success", message: "Barcode gateway siap — hubungkan scanner USB/Bluetooth untuk lookup otomatis." }))}>Scan barcode</button></div><div className="category-tabs">{categories.map(item => <button key={item} onClick={() => setCategory(item)} className={category === item ? "active" : ""}>{item}</button>)}</div><div className="catalog-grid">{filtered.map(product => <button key={product.id} onClick={() => product.stock > 0 && addToCart(product)} className={`catalog-card ${product.stock === 0 ? "disabled" : ""}`}><div className="catalog-emoji">{product.emoji}</div><div className="catalog-card-copy"><b>{product.name}</b><span>{product.category} · {product.unit}</span></div><div className="catalog-card-bottom"><strong>{money(product.price)}</strong><small className={product.stock <= product.minStock ? "stock-low" : ""}>{product.stock} tersedia</small></div><span className="add-product"><Plus size={15} /></span></button>)}</div></section><aside className="cart-panel panel"><div className="cart-header"><div><div className="eyebrow">ORDER / DRAFT</div><h2>Keranjang baru</h2></div><span className="order-number">#KBP-1428</span></div>{cart.length ? <div className="cart-items">{cart.map(item => <div className="cart-item" key={item.id}><div className="cart-item-emoji">{item.emoji}</div><div className="cart-item-copy"><b>{item.name}</b><span>{money(item.price)}</span><div className="qty-control"><button onClick={() => changeQty(item.id, -1)}><Minus size={13} /></button><b>{item.qty}</b><button onClick={() => changeQty(item.id, 1)}><Plus size={13} /></button></div></div><strong>{money(item.price * item.qty)}</strong></div>)}</div> : <div className="cart-empty"><ShoppingCart size={27} /><b>Keranjang masih kosong</b><span>Pilih produk di sebelah kiri untuk mulai transaksi.</span></div>}<div className="cart-summary"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Pajak layanan <small>10%</small></span><b>{money(tax)}</b></div><div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div></div><div className="payment-method"><span className="field-label">Metode pembayaran</span><div className="payment-options">{["QRIS", "Tunai", "Debit"].map(method => <button key={method} onClick={() => setPayment(method)} className={payment === method ? "active" : ""}>{method === "QRIS" ? <Zap size={14} /> : method === "Tunai" ? <Store size={14} /> : <CreditCard size={14} />}{method}</button>)}</div></div><div className="adapter-note"><span className="live-dot" /> {isAuthenticated ? "Payment adapter aktif" : "Demo mode · login untuk gateway real"}</div><button className="button button-primary pay-button" onClick={pay}>Bayar {money(total)} <ChevronRight size={16} /></button></aside></div>{isPaid && <SuccessModal total={total} payment={payment} onClose={() => { setIsPaid(false); setCart([]); onToast({ tone: "success", message: "Transaksi berhasil disimpan dan stok diperbarui." }); }} />}</>;
}

function SuccessModal({ total, payment, onClose }: { total: number; payment: string; onClose: () => void }) {
  return <div className="modal-backdrop"><div className="modal success-modal"><button className="modal-close" onClick={onClose}><X size={18} /></button><div className="success-check"><Check size={25} /></div><div className="eyebrow">TRANSACTION COMPLETE</div><h2>Pembayaran berhasil</h2><p>Transaksi sudah tersimpan dan inventory otomatis diperbarui.</p><div className="receipt-box"><div><span>Transaction ID</span><b>#KBP-{Math.floor(1000 + Math.random() * 8999)}</b></div><div><span>Total pembayaran</span><b>{money(total)}</b></div><div><span>Metode</span><b>{payment}</b></div></div><div className="receipt-actions"><button className="button button-secondary" onClick={() => window.print()}>Cetak struk</button><button className="button button-primary" onClick={onClose}>Selesai</button></div></div></div>;
}

function Inventory({ products, setProducts, onToast, outletId, canWriteSupabase }: { products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; onToast: (toast: Toast) => void; outletId: number; canWriteSupabase: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Semua status");
  const [selected, setSelected] = useState<Product | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const rows = products.filter(product => product.name.toLowerCase().includes(query.toLowerCase()) && (filter === "Semua status" || (filter === "Kritis" ? getRisk(product) === "Tinggi" : getRisk(product) === filter)));
  const adjustMutation = trpc.inventory.adjust.useMutation();
  const saveProduct = trpc.inventory.upsert.useMutation();
  const adjustStock = async (product: Product, amount: number) => { try { if (isSupabaseAuthConfigured && canWriteSupabase) await adjustSupabaseProductStock(product.id, outletId, amount); else await adjustMutation.mutateAsync({ outletId, productId: product.id, amount }); } catch { return onToast({ tone: "warning", message: "Stok belum tersimpan ke backend." }); } setProducts(current => current.map(item => item.id === product.id ? { ...item, stock: Math.max(0, item.stock + amount) } : item)); onToast({ tone: "success", message: `Stok ${product.name} berhasil disesuaikan.` }); };
  return <><PageTitle eyebrow="OPERATIONS / STOCK CONTROL" title="Inventory" description="Pantau setiap SKU dan jaga operasional tetap siap melayani." actions={<button className="button button-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Tambah produk</button>} /><div className="inventory-kpis"><div className="mini-kpi"><span className="kpi-icon"><Boxes size={16} /></span><div><span>Total SKU</span><b>{products.length} produk</b></div></div><div className="mini-kpi"><span className="kpi-icon amber-bg"><AlertCircle size={16} /></span><div><span>Perlu restock</span><b>{products.filter(product => getRisk(product) !== "Sehat").length} produk</b></div></div><div className="mini-kpi"><span className="kpi-icon mint-bg"><Check size={16} /></span><div><span>Nilai persediaan</span><b>{money(products.reduce((sum, product) => sum + product.stock * product.cost, 0))}</b></div></div></div><section className="panel inventory-panel"><div className="table-toolbar"><div className="search-box"><Search size={17} /><input placeholder="Cari nama produk atau SKU..." value={query} onChange={event => setQuery(event.target.value)} /></div><select className="select-control" value={filter} onChange={event => setFilter(event.target.value)}><option>Semua status</option><option>Kritis</option><option>Sedang</option><option>Sehat</option></select><button className="button button-secondary" onClick={() => downloadCsv("kopipintar-inventory.csv", [["Produk", "SKU", "Stok", "Status"], ...rows.map(product => [product.name, product.sku, `${product.stock} ${product.unit}`, getRisk(product)])])}>Export CSV</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Produk</th><th>SKU</th><th>Kategori</th><th>Stok saat ini</th><th>Min. stok</th><th>Harga jual</th><th>Status</th><th /></tr></thead><tbody>{rows.map(product => <tr key={product.id}><td><button className="table-product" onClick={() => setSelected(product)}><span className="table-emoji">{product.emoji}</span><span><b>{product.name}</b><small>{product.supplier}</small></span></button></td><td className="mono-text">{product.sku}</td><td>{product.category}</td><td><b>{number(product.stock)} {product.unit}</b></td><td>{number(product.minStock)} {product.unit}</td><td>{money(product.price)}</td><td><StatusBadge risk={getRisk(product)} /></td><td><div className="row-actions"><button onClick={() => adjustStock(product, 1)} aria-label={`Tambah stok ${product.name}`}><Plus size={15} /></button><button onClick={() => setSelected(product)} aria-label={`Lihat ${product.name}`}><ChevronRight size={15} /></button></div></td></tr>)}</tbody></table></div>{!rows.length && <div className="empty-state"><Search size={24} /><b>Produk tidak ditemukan</b><span>Coba ubah kata kunci atau filter.</span></div>}<div className="table-footer"><span>Menampilkan {rows.length} dari {products.length} produk</span><div className="pagination"><button disabled>‹</button><button className="active">1</button><button>2</button><button>›</button></div></div></section>{selected && <ProductModal product={selected} onClose={() => setSelected(null)} onAdjust={amount => { adjustStock(selected, amount); setSelected({ ...selected, stock: Math.max(0, selected.stock + amount) }); }} />} {showAdd && <AddProductModal onClose={() => setShowAdd(false)} onAdd={async product => { try { if (isSupabaseAuthConfigured) await insertSupabaseProduct({ ...product, outlet_id: outletId, min_stock: product.minStock, daily_sales: product.dailySales }); else await saveProduct.mutateAsync({ ...product, outletId }); } catch { return onToast({ tone: "warning", message: "Produk belum tersimpan ke backend." }); } setProducts(current => [...current, { ...product, id: Math.max(...current.map(item => item.id)) + 1 }]); setShowAdd(false); onToast({ tone: "success", message: "Produk baru berhasil ditambahkan." }); }} />}</>;
}

function ProductModal({ product, onClose, onAdjust }: { product: Product; onClose: () => void; onAdjust: (amount: number) => void }) {
  const coverage = getCoverage(product);
  return <div className="modal-backdrop"><div className="modal product-modal"><button className="modal-close" onClick={onClose}><X size={18} /></button><div className="product-modal-head"><div className="large-product-emoji">{product.emoji}</div><div><div className="eyebrow">PRODUCT DETAIL / {product.sku}</div><h2>{product.name}</h2><p>{product.category} · Supplier: {product.supplier}</p></div><StatusBadge risk={getRisk(product)} /></div><div className="detail-grid"><div><span>Harga beli</span><b>{money(product.cost)}</b></div><div><span>Harga jual</span><b>{money(product.price)}</b></div><div><span>Stok saat ini</span><b>{number(product.stock)} {product.unit}</b></div><div><span>Minimum stok</span><b>{number(product.minStock)} {product.unit}</b></div></div><div className="detail-forecast"><div><span>Average daily sales</span><b>{number(product.dailySales)} {product.unit}/hari</b></div><div><span>Stock coverage</span><b>{coverage > 30 ? ">30" : number(coverage)} hari</b></div><div><span>Predicted stockout</span><b>{coverage > 30 ? "Aman" : `±${Math.ceil(coverage)} hari`}</b></div></div><div className="fake-history"><div className="history-head"><b>Sales history</b><span>30 hari</span></div><div className="history-bars">{[35, 42, 30, 53, 45, 60, 48, 70, 58, 76, 69, 83, 74, 88].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div><div className="modal-footer"><button className="button button-secondary" onClick={() => onAdjust(-1)}><Minus size={15} /> Kurangi stok</button><button className="button button-primary" onClick={() => onAdjust(1)}><Plus size={15} /> Tambah stok</button></div></div></div>;
}

function AddProductModal({ onClose, onAdd }: { onClose: () => void; onAdd: (product: Omit<Product, "id">) => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const submit = () => { if (!name || !price || !stock) return; onAdd({ name, sku: `NEW-${Math.floor(100 + Math.random() * 899)}`, category: "Kopi", unit: "pcs", stock: Number(stock), minStock: 5, cost: Math.round(Number(price) * 0.5), price: Number(price), supplier: "Supplier baru", dailySales: 1, trend: 0, emoji: "📦" }); };
  return <div className="modal-backdrop"><div className="modal form-modal"><button className="modal-close" onClick={onClose}><X size={18} /></button><div className="eyebrow">INVENTORY / NEW SKU</div><h2>Tambah produk</h2><p>Masukkan informasi dasar produk untuk mulai melacak stok.</p><label>Nama produk<input value={name} onChange={event => setName(event.target.value)} placeholder="Contoh: Salted Caramel Latte" /></label><label>Harga jual<input type="number" value={price} onChange={event => setPrice(event.target.value)} placeholder="28000" /></label><label>Stok awal<input type="number" value={stock} onChange={event => setStock(event.target.value)} placeholder="20" /></label><div className="modal-footer"><button className="button button-secondary" onClick={onClose}>Batal</button><button className="button button-primary" onClick={submit}>Simpan produk</button></div></div></div>;
}

function Forecast({ products, onCreateDraft, onToast }: { products: Product[]; onCreateDraft: (product: Product) => void; onToast: (toast: Toast) => void }) {
  const riskyProducts = products.filter(product => getRisk(product) !== "Sehat").sort((a, b) => getCoverage(a) - getCoverage(b));
  const [selected, setSelected] = useState<Product>(products.find(product => product.name === "Arabica Coffee") || riskyProducts[0] || products[0]);
  const aiExplain = trpc.forecast.explain.useMutation();
  return <><PageTitle eyebrow="INTELLIGENCE / DECISION SUPPORT" title="AI Forecast" description="Prediksi kebutuhan stok berdasarkan 30 hari transaksi historis — transparan dan mudah dijelaskan." actions={<button className="button button-secondary" onClick={() => onToast({ tone: "info", message: "Forecast diperbarui berdasarkan 30+ hari transaksi." })}><Sparkles size={16} /> Refresh forecast</button>} /><div className="forecast-hero"><div><div className="ai-kicker"><span className="ai-spark"><Sparkles size={13} /></span> AI-POWERED BUSINESS ASSISTANT</div><h2>Jangan tunggu stok habis.<br /><em>Ambil keputusan lebih awal.</em></h2><p>Model membaca average daily sales, tren 7 hari, stok saat ini, dan lead time supplier.</p><div className="forecast-method"><span><Check size={14} /> 30-day historical sales</span><span><Check size={14} /> Explainable calculation</span><span><Check size={14} /> Supplier lead time</span></div></div><div className="forecast-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-center"><Sparkles size={27} /><b>AI</b><small>ready</small></div><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" /></div></div><div className="forecast-layout"><section className="panel forecast-table-panel"><div className="panel-header"><div><h2>Prioritas restock</h2><p>{riskyProducts.length} produk membutuhkan perhatian</p></div><span className="forecast-confidence"><Zap size={13} /> Confidence 87%</span></div><div className="table-wrap"><table className="data-table forecast-table"><thead><tr><th>Produk</th><th>Stok</th><th>Avg. daily sales</th><th>Predicted stockout date</th><th>Risk level</th><th>Rekomendasi</th></tr></thead><tbody>{riskyProducts.map(product => <tr key={product.id} onClick={() => setSelected(product)} className={selected?.id === product.id ? "selected-row" : ""}><td><div className="table-product"><span className="table-emoji">{product.emoji}</span><span><b>{product.name}</b><small>{product.sku} · trend {product.trend}%</small></span></div></td><td><b>{number(product.stock)} {product.unit}</b></td><td>{number(product.dailySales)} {product.unit}/hari</td><td><b className={getCoverage(product) < 4 ? "danger-text" : "warning-text"}>{getStockoutDate(product)}</b></td><td><StatusBadge risk={getRisk(product)} /></td><td><button className="recommendation-link" onClick={event => { event.stopPropagation(); setSelected(product); }}>Lihat rekomendasi <ChevronRight size={14} /></button></td></tr>)}</tbody></table></div></section><section className="forecast-detail-card"><div className="detail-card-top"><div className="product-hero-mini"><span>{selected.emoji}</span><div><b>{selected.name}</b><small>{selected.sku} · {selected.supplier}</small></div></div><StatusBadge risk={getRisk(selected)} /></div><div className="prediction-label"><span>Predicted stockout date</span><strong>{getStockoutDate(selected)}</strong></div><p className="prediction-copy">Penjualan rata-rata <b>{number(selected.dailySales)} {selected.unit}/hari</b>, stok saat ini <b>{number(selected.stock)} {selected.unit}</b>, sehingga diprediksi habis dalam <b>{getCoverage(selected) > 30 ? "lebih dari 30 hari" : `${Math.ceil(getCoverage(selected))} hari`}.</b> Risk: <b>{getRisk(selected).toUpperCase()}</b>.</p><div className="why-prediction"><div className="why-head"><b>Why this prediction?</b><HelpCircle size={15} /></div><div className="why-item"><span className="why-dot mint" /><span>Sales {selected.trend >= 0 ? "meningkat" : "menurun"} <b>{Math.abs(selected.trend)}%</b> dalam 7 hari terakhir</span></div><div className="why-item"><span className="why-dot blue" /><span>30-day average <b>{number(selected.dailySales)} {selected.unit}/hari</b></span></div><div className="why-item"><span className="why-dot amber" /><span>Stok <b>{number(selected.stock)} {selected.unit}</b> dibagi rata-rata penjualan</span></div></div><div className="recommendation-box"><div className="recommendation-icon"><Zap size={17} /></div><div><span>AI Recommendation</span><b>Restock {Math.max(10, Math.ceil(selected.dailySales * 7))} {selected.unit} {selected.name}</b><p>Menjaga stock coverage selama ±7 hari ke depan.</p></div></div>{aiExplain.data && <div className="ai-provider-response"><Sparkles size={14} /><span><b>AI provider:</b> {aiExplain.data.text}</span></div>}<div className="forecast-detail-actions"><button className="button button-secondary" disabled={aiExplain.isPending} onClick={() => aiExplain.mutate({ product: selected.name, unit: selected.unit, stock: selected.stock, dailySales: selected.dailySales, trend: selected.trend, supplier: selected.supplier, leadTimeDays: 3 })}><Sparkles size={15} /> {aiExplain.isPending ? "Menganalisis..." : "Minta analisis AI"}</button><button className="button button-primary" onClick={() => onCreateDraft(selected)}>Create Purchase Draft <ChevronRight size={16} /></button></div><small className="forecast-disclaimer"><Sparkles size={12} /> Forecast berasal dari data historis, bukan angka acak.</small></section></div></>;
}

function Orders({ orders, onConfirm, onToast, onCreateDraft }: { orders: PurchaseOrder[]; onConfirm: (id: string) => void; onToast: (toast: Toast) => void; onCreateDraft: () => void }) {
  const [filter, setFilter] = useState("Semua");
  const visible = filter === "Semua" ? orders : orders.filter(order => order.status === filter);
  return <><PageTitle eyebrow="PROCUREMENT / SUPPLY CHAIN" title="Purchase Order" description="Kelola draft dan pesanan supplier dari satu tempat." actions={<button className="button button-primary" onClick={onCreateDraft}><Plus size={16} /> Buat draft</button>} /><div className="order-status-grid"><div className="mini-kpi"><span className="kpi-icon violet-bg"><FileText size={16} /></span><div><span>Total order bulan ini</span><b>{orders.length} order</b></div></div><div className="mini-kpi"><span className="kpi-icon amber-bg"><ClipboardList size={16} /></span><div><span>Menunggu diproses</span><b>{orders.filter(order => order.status === "Draft").length} draft</b></div></div><div className="mini-kpi"><span className="kpi-icon mint-bg"><Check size={16} /></span><div><span>Nilai pembelian</span><b>{money(orders.reduce((sum, order) => sum + order.total, 0))}</b></div></div></div><section className="panel orders-panel"><div className="panel-header"><div><h2>Semua purchase order</h2><p>Riwayat order dan status pengiriman</p></div><div className="filter-pills">{["Semua", "Draft", "Ordered", "Received"].map(item => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Order ID</th><th>Supplier</th><th>Produk</th><th>Total</th><th>Tanggal</th><th>Status</th><th /></tr></thead><tbody>{visible.map(order => <tr key={order.id}><td className="mono-text">{order.id}</td><td><b>{order.supplier}</b></td><td><div className="order-product"><span>{order.product}</span><small>{order.qty} {order.unit} · {order.reason}</small></div></td><td><b>{money(order.total)}</b></td><td>{order.created}</td><td><span className={`badge ${order.status === "Draft" ? "badge-amber" : order.status === "Ordered" ? "badge-blue" : "badge-green"}`}>{order.status}</span></td><td>{order.status === "Draft" ? <button className="small-action" onClick={() => onConfirm(order.id)}>Konfirmasi</button> : <button className="row-link" onClick={() => onToast({ tone: "info", message: `Detail ${order.id}: ${order.status}, total ${money(order.total)}.` })}>Detail <ChevronRight size={14} /></button>}</td></tr>)}</tbody></table></div>{!visible.length && <div className="empty-state"><ClipboardList size={24} /><b>Belum ada order di filter ini</b><span>Buat draft dari AI Forecast atau tombol di atas.</span></div>}</section></>;
}

function Suppliers({ onToast }: { onToast: (toast: Toast) => void }) {
  const fallback = [{ name: "PT Coffee Supply", contact: "Rizky Pratama", products: "5 produk", lead: "3 hari", status: "Aktif", initials: "CS" }, { name: "Green Tea Co.", contact: "Maya Kusuma", products: "3 produk", lead: "5 hari", status: "Aktif", initials: "GT" }, { name: "Bakehouse Jakarta", contact: "Dimas Haryono", products: "4 produk", lead: "2 hari", status: "Aktif", initials: "BJ" }, { name: "FreshMart Supply", contact: "Santi Dewi", products: "2 produk", lead: "1 hari", status: "Aktif", initials: "FM" }, { name: "Mixology Goods", contact: "Fajar Nugroho", products: "2 produk", lead: "4 hari", status: "Review", initials: "MG" }];
  const supplierQuery = trpc.suppliers.list.useQuery(undefined, { retry: false });
  const createSupplier = trpc.suppliers.create.useMutation();
  const suppliers = supplierQuery.data?.length ? supplierQuery.data.map(item => ({ name: item.name, contact: item.contact, products: "-", lead: `${item.lead_time_days} hari`, status: item.status, initials: item.name.slice(0, 2).toUpperCase(), phone: item.phone })) : fallback;
  const addSupplier = async () => { const name = window.prompt("Nama supplier baru"); if (!name) return; const contact = window.prompt("Nama kontak supplier", "PIC Supplier") || "PIC Supplier"; const phone = window.prompt("Nomor telepon", "+62") || "+62"; try { await createSupplier.mutateAsync({ name, contact, phone, leadTimeDays: 3, status: "Aktif" }); supplierQuery.refetch(); onToast({ tone: "success", message: `${name} berhasil ditambahkan.` }); } catch { onToast({ tone: "warning", message: "Supplier belum tersimpan ke backend." }); } };
  return <><PageTitle eyebrow="PARTNERS / SUPPLY NETWORK" title="Supplier" description="Hubungan supplier yang sehat membuat forecasting lebih presisi." actions={<button className="button button-primary" onClick={addSupplier}><Plus size={16} /> Tambah supplier</button>} /><div className="supplier-grid">{suppliers.map(supplier => <div className="supplier-card panel" key={supplier.name}><div className="supplier-top"><div className="supplier-avatar">{supplier.initials}</div><div><h3>{supplier.name}</h3><span>{supplier.contact}</span></div><button className="icon-button small" onClick={() => onToast({ tone: "info", message: `Detail ${supplier.name}: lead time ${supplier.lead}.` })}><ChevronRight size={16} /></button></div><div className="supplier-meta"><div><span>Produk</span><b>{supplier.products}</b></div><div><span>Lead time</span><b>{supplier.lead}</b></div></div><div className="supplier-bottom"><span className={`badge ${supplier.status === "Aktif" ? "badge-green" : "badge-amber"}`}><span className="badge-dot" /> {supplier.status}</span><button className="row-link" onClick={() => { if ("phone" in supplier && supplier.phone) window.location.href = `tel:${supplier.phone}`; else onToast({ tone: "info", message: `Kontak ${supplier.contact}: tersedia di data supplier.` }); }}>Hubungi <ChevronRight size={14} /></button></div></div>)}</div><div className="supplier-note"><Truck size={18} /><div><b>Supplier lead time terhubung ke AI Forecast</b><span>Rekomendasi reorder mempertimbangkan waktu pengiriman agar stok tiba sebelum habis.</span></div><button onClick={() => onToast({ tone: "info", message: "Lead time dipakai dalam perhitungan prediksi stockout." })}>Pelajari <ChevronRight size={15} /></button></div></>;
}

function ReportsChart() {
  const trend = [{ day: "21 Agu", revenue: 2.1, profit: 1.1 }, { day: "25 Agu", revenue: 2.8, profit: 1.5 }, { day: "29 Agu", revenue: 2.4, profit: 1.3 }, { day: "02 Sep", revenue: 3.2, profit: 1.8 }, { day: "06 Sep", revenue: 3.0, profit: 1.7 }, { day: "10 Sep", revenue: 3.7, profit: 2.1 }, { day: "14 Sep", revenue: 4.1, profit: 2.4 }, { day: "19 Sep", revenue: 4.8, profit: 2.9 }];
  const top = [{ name: "Espresso", value: 4350000 }, { name: "Vanilla", value: 1150000 }, { name: "Caramel", value: 1050000 }, { name: "Cold Brew", value: 928000 }];
  return <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}><div style={{ height: 250 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="#e9eeeb" /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} unit=" jt" /><Tooltip formatter={(value: number) => [`Rp ${value} jt`, ""]} /><Legend /><Line type="monotone" dataKey="revenue" name="Revenue" stroke="#4f8a77" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="profit" name="Profit" stroke="#7b6aa5" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div><div style={{ height: 250 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={top} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#e9eeeb" /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={65} /><Tooltip formatter={(value: number) => [money(value), "Revenue"]} /><Bar dataKey="value" name="Produk terlaris" fill="#4f8a77" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></div>;
}

function Reports({ onToast }: { onToast: (toast: Toast) => void }) {
  const exportReport = () => { downloadCsv("kopipintar-report.csv", [["Metric", "Value"], ["Revenue", "25500000"], ["COGS", "12000000"], ["Gross Profit", "13500000"], ["Operating Expenses", "4000000"], ["Net Profit", "9500000"]]); onToast({ tone: "success", message: "Laporan CSV berhasil diunduh." }); };
  return <><PageTitle eyebrow="ANALYTICS / BUSINESS HEALTH" title="Reports" description="Ubah data operasional menjadi keputusan bisnis yang lebih baik." actions={<><select className="select-control"><option>30 hari terakhir</option><option>7 hari terakhir</option><option>Tahun ini</option></select><button className="button button-secondary" onClick={() => window.print()}>Export PDF</button><button className="button button-primary" onClick={exportReport}>Export CSV</button></>} /><div className="report-tabs"><button className="active" onClick={() => onToast({ tone: "info", message: "Overview menampilkan ringkasan bisnis." })}>Overview</button><button onClick={() => onToast({ tone: "info", message: "Sales report: gunakan Export CSV untuk mengunduh data penjualan." })}>Sales report</button><button onClick={() => onToast({ tone: "info", message: "Profit & Loss menampilkan revenue, COGS, dan net profit." })}>Profit & Loss</button><button onClick={() => onToast({ tone: "info", message: "Inventory report menampilkan nilai dan status stok." })}>Inventory report</button></div><div className="report-grid"><section className="panel report-main"><div className="panel-header"><div><h2>Revenue & profit</h2><p>Performa finansial 30 hari terakhir</p></div><div className="legend"><span><i className="legend-dot revenue" /> Revenue</span><span><i className="legend-dot profit" /> Profit</span></div></div><ReportsChart /></section><section className="panel pnl-card"><div className="panel-header"><div><h2>Profit & Loss</h2><p>September 2024</p></div><FileBarChart size={20} className="muted-icon" /></div><div className="pnl-rows"><div><span>Revenue</span><b>{money(25500000)}</b></div><div><span>Cost of Goods Sold</span><b className="negative-text">-{money(12000000)}</b></div><div className="pnl-divider" /><div><span>Gross Profit</span><b>{money(13500000)}</b></div><div><span>Operating Expenses</span><b className="negative-text">-{money(4000000)}</b></div><div className="pnl-total"><span>Net Profit</span><strong>{money(9500000)}</strong></div></div></section></div><div className="report-grid bottom-reports"><section className="panel category-report"><div className="panel-header"><div><h2>Sales by category</h2><p>Kontribusi revenue</p></div></div><div className="donut-row"><div className="donut-chart"><div><strong>Rp 25,5 jt</strong><span>Total revenue</span></div></div><div className="donut-legend"><div><i className="donut-coffee" /><span>Kopi</span><b>52%</b></div><div><i className="donut-food" /><span>Makanan</span><b>26%</b></div><div><i className="donut-drink" /><span>Non-kopi</span><b>14%</b></div><div><i className="donut-other" /><span>Lainnya</span><b>8%</b></div></div></div></section><section className="panel performance-report"><div className="panel-header"><div><h2>Product performance</h2><p>Produk dengan pertumbuhan tercepat</p></div></div><div className="performance-list">{[{ name: "Matcha Latte", value: "+32%", width: "88%", tone: "mint" }, { name: "Cold Brew", value: "+21%", width: "72%", tone: "blue" }, { name: "Arabica Coffee", value: "+18%", width: "64%", tone: "amber" }, { name: "Cappuccino", value: "+14%", width: "52%", tone: "violet" }].map(item => <div className="performance-item" key={item.name}><div><span>{item.name}</span><b>{item.value}</b></div><div className="performance-track"><i className={item.tone} style={{ width: item.width }} /></div></div>)}</div></section></div></>;
}

function ForecastQuickModal({ product, onClose, onCreateDraft }: { product: Product; onClose: () => void; onCreateDraft: (product: Product) => void }) {
  const days = Math.max(1, Math.ceil(getCoverage(product)));
  const qty = Math.max(10, Math.ceil(product.dailySales * 7));
  return <div className="modal-backdrop"><div className="modal quick-forecast-modal"><button className="modal-close" onClick={onClose}><X size={18} /></button><div className="quick-forecast-top"><div className="product-hero-mini"><span>{product.emoji}</span><div><b>{product.name}</b><small>{product.sku} · {product.supplier}</small></div></div><StatusBadge risk={getRisk(product)} /></div><div className="eyebrow" style={{ marginTop: 22 }}>AI RECOMMENDATION</div><h2>Stok diprediksi habis dalam {days} hari.</h2><p>Berdasarkan penjualan 7 hari terakhir, demand {product.trend >= 0 ? "meningkat" : "menurun"} <b>{Math.abs(product.trend)}%</b>. Inventory saat ini diperkirakan hanya bertahan sampai <b>{days} hari</b> ke depan.</p><div className="quick-metric-row"><div><span>Stok saat ini</span><b>{number(product.stock)} {product.unit}</b></div><div><span>Penjualan harian</span><b>{number(product.dailySales)} {product.unit}</b></div><div><span>Rekomendasi order</span><b>{qty} {product.unit}</b></div></div><div className="quick-explanation"><b>Why this prediction?</b><br />Sales meningkat {Math.abs(product.trend)}% · Avg. daily sales {number(product.dailySales)} {product.unit} · Supplier lead time 3 hari.</div><div className="modal-footer"><button className="button button-secondary" onClick={onClose}>Nanti saja</button><button className="button button-primary" onClick={() => onCreateDraft(product)}>Buat draft pesanan <ChevronRight size={16} /></button></div></div></div>;
}

function SettingsPage({ onToast, googleUser, onGoogleLogin, onGoogleLogout }: { onToast: (toast: Toast) => void; googleUser: any; onGoogleLogin: () => void; onGoogleLogout: () => void }) {
  const [receiptFooter, setReceiptFooter] = useState(() => localStorage.getItem("kopipintar-receipt-footer") || "Terima kasih sudah berkunjung!");
  const [taxEnabled, setTaxEnabled] = useState(() => localStorage.getItem("kopipintar-tax-enabled") !== "false");
  const save = () => { localStorage.setItem("kopipintar-receipt-footer", receiptFooter); localStorage.setItem("kopipintar-tax-enabled", String(taxEnabled)); onToast({ tone: "success", message: "Pengaturan berhasil disimpan." }); };
  return <><PageTitle eyebrow="PREFERENCES / WORKSPACE CONTROL" title="Settings" description="Atur preferensi outlet, struk, dan koneksi akun." actions={<button className="button button-primary" onClick={save}><Check size={16} /> Simpan perubahan</button>} /><div className="dashboard-grid"><section className="panel" style={{ padding: 22 }}><div className="panel-header"><div><h2>Outlet & transaksi</h2><p>Preferensi ini tersimpan di perangkat kasir.</p></div><Settings size={20} className="muted-icon" /></div><label style={{ display: "grid", gap: 8, marginTop: 18, fontSize: 13, fontWeight: 700 }}>Nama outlet<input className="select-control" defaultValue="Kedai Bumi" /></label><label style={{ display: "grid", gap: 8, marginTop: 18, fontSize: 13, fontWeight: 700 }}>Footer struk<input className="select-control" value={receiptFooter} onChange={event => setReceiptFooter(event.target.value)} /></label><label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 20, fontSize: 13 }}><span><b>Pajak layanan 10%</b><br /><small>Tambahkan pajak layanan ke transaksi POS.</small></span><input type="checkbox" checked={taxEnabled} onChange={event => setTaxEnabled(event.target.checked)} /></label></section><section className="panel" style={{ padding: 22 }}><div className="panel-header"><div><h2>Google Auth</h2><p>Login Google menggunakan Supabase Auth.</p></div><Users size={20} className="muted-icon" /></div>{googleUser ? <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}><div className="profile-avatar">{(googleUser.user_metadata?.full_name || googleUser.email || "G").slice(0, 2).toUpperCase()}</div><div style={{ flex: 1 }}><b>{googleUser.user_metadata?.full_name || "Google account"}</b><br /><small>{googleUser.email}</small></div><button className="button button-secondary" onClick={onGoogleLogout}>Keluar</button></div> : <><p style={{ marginTop: 18 }}>Belum ada akun Google yang terhubung.</p><button className="button button-primary" onClick={onGoogleLogin}>Masuk dengan Google</button>{!isSupabaseAuthConfigured && <small style={{ display: "block", marginTop: 12, color: "var(--amber)" }}>Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY untuk mengaktifkan.</small>}</>}</section><section className="panel" style={{ padding: 22, gridColumn: "1 / -1" }}><div className="panel-header"><div><h2>Data & deployment</h2><p>Supabase menyimpan inventory, transaksi, supplier, dan purchase order.</p></div><Boxes size={20} className="muted-icon" /></div><p>Service role key hanya di server. Untuk langkah setup database dari nol, baca file <b>DATABASE_DARI_NOL.md</b>.</p><button className="button button-secondary" onClick={() => onToast({ tone: "info", message: "Gunakan DATABASE_DARI_NOL.md untuk setup Supabase." })}>Lihat panduan database</button></section></div></>;
}

function HelpCenter({ onToast, onNavigate }: { onToast: (toast: Toast) => void; onNavigate: (page: PageKey) => void }) {
  const [open, setOpen] = useState("database");
  const faqs = [{ id: "database", q: "Bagaimana menghubungkan Supabase?", a: "Buat project Supabase, jalankan dua SQL file di folder supabase, lalu isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di server." }, { id: "product", q: "Bagaimana menambah produk?", a: "Buka Inventory, klik Tambah produk, isi nama, harga, dan stok awal. Data akan tersimpan ke backend jika Supabase aktif." }, { id: "google", q: "Kenapa Google login belum aktif?", a: "Aktifkan Google Provider di Supabase Authentication, isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY, lalu tambahkan redirect URL." }, { id: "order", q: "Bagaimana membuat purchase order?", a: "Buka AI Forecast, pilih produk kritis, buat draft, lalu konfirmasi dari halaman Purchase Order." }];
  return <><PageTitle eyebrow="SUPPORT / GET STARTED" title="Help Center" description="Panduan singkat untuk menjalankan Kopipintar." actions={<button className="button button-primary" onClick={() => onNavigate("settings")}><Settings size={16} /> Buka Settings</button>} /><div className="dashboard-grid"><section className="panel" style={{ padding: 22 }}><div className="ai-kicker"><span className="ai-spark"><CircleHelp size={13} /></span> KOPIPINTAR STARTER GUIDE</div><h2 style={{ marginTop: 18 }}>Mulai dari 3 langkah.</h2><p><b>01 Hubungkan Supabase</b><br />Jalankan SQL dan isi environment variables.</p><p><b>02 Isi inventory</b><br />Tambahkan produk, supplier, dan stok awal.</p><p><b>03 Mulai transaksi</b><br />Gunakan POS lalu pantau AI Forecast.</p><button className="button button-secondary" onClick={() => onToast({ tone: "success", message: "Checklist onboarding selesai dibuka." })}>Lihat checklist</button></section><section className="panel" style={{ padding: 22 }}><div className="panel-header"><div><h2>Pertanyaan umum</h2><p>Jawaban kendala yang paling sering terjadi.</p></div><HelpCircle size={20} className="muted-icon" /></div>{faqs.map(item => <div key={item.id} style={{ borderTop: "1px solid var(--line)" }}><button style={{ width: "100%", display: "flex", justifyContent: "space-between", padding: "16px 0", background: "transparent", border: 0, textAlign: "left", font: "inherit", cursor: "pointer" }} onClick={() => setOpen(open === item.id ? "" : item.id)}><b>{item.q}</b><ChevronRight size={16} /></button>{open === item.id && <p style={{ color: "var(--ink-soft)", lineHeight: 1.6 }}>{item.a}</p>}</div>)}</section></div></>;
}

function NotificationPanel({ onClose, onNavigate }: { onClose: () => void; onNavigate: (page: PageKey) => void }) {
  return <div className="notification-panel"><div className="notification-header"><b>Notifikasi</b><button onClick={onClose}><X size={16} /></button></div><button onClick={() => { onNavigate("forecast"); onClose(); }} className="notification-item critical"><span><AlertCircle size={16} /></span><div><b>Critical Stock</b><small>Arabica Coffee diprediksi habis dalam 3 hari.</small><time>2 menit lalu</time></div></button><button onClick={() => { onNavigate("forecast"); onClose(); }} className="notification-item warning"><span><AlertCircle size={16} /></span><div><b>Low Stock</b><small>Brownies Fudge berada di bawah minimum stock.</small><time>1 jam lalu</time></div></button><button onClick={() => { onNavigate("dashboard"); onClose(); }} className="notification-item success"><span><ArrowUpRight size={16} /></span><div><b>Positive Trend</b><small>Matcha Latte sales meningkat 32% minggu ini.</small><time>3 jam lalu</time></div></button></div>;
}

export default function Home() {
  const auth = useAuth();
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [demoAccess, setDemoAccess] = useState(() => localStorage.getItem("kopipintar-demo-access") === "true");
  const [products, setProducts] = useState<Product[]>(() => { try { return JSON.parse(localStorage.getItem("smart-pos-products") || "null") || initialProducts; } catch { return initialProducts; } });
  const [orders, setOrders] = useState<PurchaseOrder[]>(() => { try { return JSON.parse(localStorage.getItem("smart-pos-orders") || "null") || initialOrders; } catch { return initialOrders; } });
  const [toast, setToast] = useState<Toast | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [forecastProduct, setForecastProduct] = useState<Product | null>(null);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [profile, setProfile] = useState<{ username: string; full_name: string | null; role: "admin" | "kasir" } | null>(null);
  const [selectedOutletId, setSelectedOutletId] = useState(1);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const workspaceQuery = trpc.workspace.me.useQuery(undefined, { enabled: auth.isAuthenticated, retry: false });
  const inventoryInput = useMemo(() => ({ outletId: selectedOutletId }), [selectedOutletId]);
  const inventoryQuery = trpc.inventory.list.useQuery(inventoryInput, { retry: false });
  const ordersQuery = trpc.orders.list.useQuery(inventoryInput, { retry: false });
  const createOrderMutation = trpc.orders.create.useMutation();
  const updateOrderMutation = trpc.orders.updateStatus.useMutation();
  const outlets: OutletOption[] = workspaceQuery.data?.outlets || [{ id: 1, name: "Kedai Bumi", code: "KB-01", city: "Jakarta Selatan", active: 1 }, { id: 2, name: "Kedai Bumi — Senopati", code: "KB-02", city: "Jakarta Selatan", active: 1 }, { id: 3, name: "Kedai Bumi — Bandung", code: "KB-03", city: "Bandung", active: 1 }];
  useEffect(() => { localStorage.setItem("smart-pos-products", JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem("smart-pos-orders", JSON.stringify(orders)); }, [orders]);
  useEffect(() => { if (workspaceQuery.data?.outlets[0] && !workspaceQuery.data.outlets.some(outlet => outlet.id === selectedOutletId)) setSelectedOutletId(workspaceQuery.data.outlets[0].id); }, [workspaceQuery.data, selectedOutletId]);
  useEffect(() => { if (!isSupabaseAuthConfigured && inventoryQuery.data?.length) setProducts(inventoryQuery.data as Product[]); }, [inventoryQuery.data]);
  useEffect(() => { if (ordersQuery.data?.length) setOrders(ordersQuery.data.map((order: any) => ({ id: String(order.order_number || order.id), supplier: order.supplier, product: order.product_name || "Multiple items", qty: Number(order.qty || 1), unit: order.unit || "pcs", unitCost: Number(order.unit_cost || 0), total: Number(order.total || 0), reason: order.reason || "Purchase order tersimpan di backend", status: order.status, created: new Date(order.created_at).toLocaleDateString("id-ID") }))); }, [ordersQuery.data]);
  const showToast = (next: Toast) => { setToast(next); window.setTimeout(() => setToast(null), 3000); };
  useEffect(() => {
    if (!isSupabaseAuthConfigured) return;
    let active = true;
    setSupabaseLoading(true);
    listSupabaseProducts(selectedOutletId).then(rows => {
      if (active && rows.length) setProducts(rows.map(mapSupabaseProduct));
    }).catch(() => {
      if (active) showToast({ tone: "warning", message: "Data Supabase belum dapat dimuat. Mode demo tetap tersedia." });
    }).finally(() => { if (active) setSupabaseLoading(false); });
    return () => { active = false; };
  }, [selectedOutletId]);
  useEffect(() => { if (!supabase) return; supabase.auth.getUser().then(({ data }) => setGoogleUser(data.user)); getCurrentProfile().then(setProfile).catch(() => setProfile(null)); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setGoogleUser(session?.user || null); if (session) getCurrentProfile().then(setProfile).catch(() => setProfile(null)); else setProfile(null); }); return () => listener.subscription.unsubscribe(); }, []);
  const googleLogin = async () => { if (!supabase) return showToast({ tone: "warning", message: "Google Auth belum dikonfigurasi." }); const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } }); if (error) showToast({ tone: "warning", message: error.message }); };
  const googleLogout = async () => { if (!supabase) return; const { error } = await supabase.auth.signOut(); showToast(error ? { tone: "warning", message: error.message } : { tone: "success", message: "Anda sudah keluar dari Google Auth." }); };
  const createDraft = async (product: Product) => { const qty = Math.max(10, Math.ceil(product.dailySales * 7)); const existing = orders.find(order => order.product === product.name && order.status === "Draft"); if (existing) { setForecastProduct(null); setActivePage("orders"); return showToast({ tone: "info", message: `Draft ${product.name} sudah tersedia.` }); } const reason = `Forecast menunjukkan stok akan habis dalam ${Math.max(1, Math.ceil(getCoverage(product)))} hari.`; let createdId = `PO-2409-${String(orders.length + 3).padStart(3, "0")}`; try { const created = await createOrderMutation.mutateAsync({ outletId: selectedOutletId, supplier: product.supplier, productId: product.id, product: product.name, qty, unit: product.unit, unitCost: product.cost, reason }); createdId = String((created as { orderNumber?: string; id?: number }).orderNumber || (created as { id?: number }).id || createdId); } catch { return showToast({ tone: "warning", message: "Draft gagal disimpan ke backend." }); } setOrders(current => [{ id: createdId, supplier: product.supplier, product: product.name, qty, unit: product.unit, unitCost: product.cost, total: qty * product.cost, reason, status: "Draft", created: "19 Sep 2024" }, ...current]); setForecastProduct(null); setActivePage("orders"); showToast({ tone: "success", message: `Draft pesanan ${product.name} berhasil dibuat.` }); };
  const content = useMemo(() => {
    if (activePage === "dashboard") return <Dashboard products={products} setActivePage={setActivePage} onForecast={setForecastProduct} onToast={showToast} />;
    if (activePage === "pos") return <POS products={products} setProducts={setProducts} outletId={selectedOutletId} onToast={showToast} onTransaction={() => showToast({ tone: "success", message: "Penjualan tercatat di dashboard." })} isAuthenticated={auth.isAuthenticated} hasSupabaseSession={Boolean(googleUser)} />;
    if (activePage === "inventory") return <Inventory products={products} setProducts={setProducts} outletId={selectedOutletId} onToast={showToast} canWriteSupabase={Boolean(googleUser && profile?.role === "admin")} />;
    if (activePage === "forecast") return <Forecast products={products} onCreateDraft={createDraft} onToast={showToast} />;
    if (activePage === "orders") return <Orders onCreateDraft={() => createDraft(products.find(product => getRisk(product) !== "Sehat") || products[0])} orders={orders} onConfirm={async id => { try { await updateOrderMutation.mutateAsync({ id, status: "Ordered" }); } catch { return showToast({ tone: "warning", message: "Status order gagal disimpan." }); } setOrders(current => current.map(order => order.id === id ? { ...order, status: "Ordered" } : order)); showToast({ tone: "success", message: `${id} dikonfirmasi dan dikirim ke supplier.` }); }} onToast={showToast} />;
    if (activePage === "suppliers") return <Suppliers onToast={showToast} />;
    if (activePage === "settings") return <SettingsPage onToast={showToast} googleUser={googleUser} onGoogleLogin={googleLogin} onGoogleLogout={googleLogout} />;
    if (activePage === "help") return <HelpCenter onToast={showToast} onNavigate={setActivePage} />;
    return <Reports onToast={showToast} />;
  }, [activePage, products, orders, auth.isAuthenticated, googleUser]);
  const currentUser = auth.user || (googleUser ? { name: profile?.full_name || googleUser.user_metadata?.full_name || googleUser.email, email: googleUser.email, role: profile?.role || "admin" } : null);
  const openWorkspace = () => { localStorage.setItem("kopipintar-demo-access", "true"); setDemoAccess(true); setActivePage("dashboard"); };
  useEffect(() => { if (profile?.role === "kasir" && activePage !== "pos") setActivePage("pos"); }, [profile?.role, activePage]);
  const handleLogout = async () => {
    try {
      if (supabase) await supabase.auth.signOut();
      if (auth.isAuthenticated) await auth.logout();
    } finally {
      localStorage.removeItem("kopipintar-demo-access");
      setDemoAccess(false);
      setGoogleUser(null);
      setProfile(null);
      setNotificationsOpen(false);
      setActivePage("dashboard");
      showToast({ tone: "success", message: "Anda sudah keluar. Silakan login kembali." });
    }
  };
  if (!auth.isAuthenticated && !googleUser && !demoAccess) return <AuthLanding onDemo={openWorkspace} onGoogle={googleLogin} onToast={showToast} />;
  return <div className="shell-wrap"><AppShell activePage={activePage} setActivePage={setActivePage} onNotifications={() => setNotificationsOpen(current => !current)} outlets={outlets} selectedOutletId={selectedOutletId} onOutletChange={id => { setSelectedOutletId(id); showToast({ tone: "info", message: `Berpindah ke ${outlets.find(outlet => outlet.id === id)?.name || "outlet"}.` }); }} user={currentUser} onLogout={handleLogout}>{content}</AppShell>{supabaseLoading && <div style={{ position: "fixed", top: 76, right: 24, zIndex: 40, padding: "8px 12px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink-soft)", fontSize: 11, boxShadow: "0 8px 18px rgba(35,56,46,.08)" }}>Memuat data live…</div>}{notificationsOpen && <NotificationPanel onClose={() => setNotificationsOpen(false)} onNavigate={setActivePage} />}{forecastProduct && <ForecastQuickModal product={forecastProduct} onClose={() => setForecastProduct(null)} onCreateDraft={createDraft} />}{toast && <div className={`toast ${toast.tone}`}><Check size={16} />{toast.message}</div>}</div>;
}
