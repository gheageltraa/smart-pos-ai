import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  Plus,
  PackagePlus,
  ShoppingCart,
  Sparkles,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calculateForecast, calculatePercentChange } from "@/lib/analytics";
import {
  firstName,
  formatJakartaDateKey,
  formatOverviewDate,
  getGreeting,
  shiftDateKey,
} from "@/lib/datetime";
import type { Product } from "@/lib/models";
import {
  getSupabaseReportRange,
  type ReportingDailySale,
  type ReportingTopProductDaily,
} from "@/lib/supabase";

type Props = {
  products: Product[];
  outletId: number;
  outletName: string;
  userName: string;
  productLoading: boolean;
  productError: string | null;
  onRetryProducts: () => void;
  onPage: (page: "pos" | "forecast" | "reports" | "inventory") => void;
  onForecast: (product: Product) => void;
};

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

function dateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${dateKey}T12:00:00+07:00`));
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
  change,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  change: number | null;
}) {
  return (
    <div className="metric-card accent-mint">
      <div className="metric-top">
        <div className="metric-icon">
          <Icon size={17} />
        </div>
        {change !== null && (
          <span className={`change ${change >= 0 ? "positive" : "negative"}`}>
            {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {number(Math.abs(change))}%
          </span>
        )}
      </div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

export default function DashboardLive({
  products,
  outletId,
  outletName,
  userName,
  productLoading,
  productError,
  onRetryProducts,
  onPage,
  onForecast,
}: Props) {
  const [period, setPeriod] = useState<7 | 30>(30);
  const [daily, setDaily] = useState<ReportingDailySale[]>([]);
  const [topProductRows, setTopProductRows] = useState<ReportingTopProductDaily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    const today = new Date();
    const todayKey = formatJakartaDateKey(today);
    try {
      const report = await getSupabaseReportRange(
        outletId,
        shiftDateKey(todayKey, -Math.max(period * 2 - 1, 13)),
        todayKey
      );
      setDaily(report.daily);
      setTopProductRows(report.topProducts);
      setLastUpdated(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat laporan Supabase.");
    } finally {
      setLoading(false);
    }
  }, [outletId, period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const todayKey = formatJakartaDateKey(now);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const todayKpis = daily.find(row => row.sale_date === todayKey);
  const yesterdayKpis = daily.find(row => row.sale_date === yesterdayKey);
  const visibleFrom = shiftDateKey(todayKey, -(period - 1));
  const previousFrom = shiftDateKey(todayKey, -(period * 2 - 1));
  const previousTo = shiftDateKey(todayKey, -period);
  const visibleDaily = daily
    .filter(row => row.sale_date >= visibleFrom && row.sale_date <= todayKey)
    .sort((a, b) => a.sale_date.localeCompare(b.sale_date));
  const previousDaily = daily.filter(
    row => row.sale_date >= previousFrom && row.sale_date <= previousTo
  );
  const currentRevenue = visibleDaily.reduce((sum, row) => sum + Number(row.revenue), 0);
  const previousRevenue = previousDaily.reduce((sum, row) => sum + Number(row.revenue), 0);
  const periodChange = calculatePercentChange(currentRevenue, previousRevenue);
  const displayError = error || productError;

  const chartData = useMemo(() => {
    const byDate = new Map(visibleDaily.map(row => [row.sale_date, Number(row.revenue)]));
    return Array.from({ length: period }, (_, index) => {
      const date = shiftDateKey(visibleFrom, index);
      return { date: dateLabel(date), revenue: byDate.get(date) || 0 };
    });
  }, [period, visibleFrom, visibleDaily]);

  const productSummaries = useMemo(() => {
    const byProduct = new Map<
      number,
      { name: string; qty: number; revenue: number; daily: Map<string, number>; trend: number | null }
    >();
    for (const row of topProductRows) {
      const entry = byProduct.get(row.product_id) || {
        name: row.product_name,
        qty: 0,
        revenue: 0,
        daily: new Map<string, number>(),
        trend: null,
      };
      if (row.sale_date >= visibleFrom && row.sale_date <= todayKey) {
        entry.qty += Number(row.qty_sold);
        entry.revenue += Number(row.revenue);
        entry.daily.set(row.sale_date, (entry.daily.get(row.sale_date) || 0) + Number(row.qty_sold));
      }
      byProduct.set(row.product_id, entry);
    }
    const currentCutoff = shiftDateKey(todayKey, -6);
    const previousCutoff = shiftDateKey(todayKey, -13);
    byProduct.forEach((entry, productId) => {
      const current = topProductRows
        .filter(row => row.product_id === productId && row.sale_date >= currentCutoff && row.sale_date <= todayKey)
        .reduce((sum, row) => sum + Number(row.qty_sold), 0);
      const previous = topProductRows
        .filter(row => row.product_id === productId && row.sale_date >= previousCutoff && row.sale_date < currentCutoff)
        .reduce((sum, row) => sum + Number(row.qty_sold), 0);
      entry.trend = calculatePercentChange(current, previous);
    });
    return Array.from(byProduct.entries())
      .map(([id, entry]) => ({ id, ...entry }))
      .filter(product => product.qty > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 4);
  }, [topProductRows, todayKey, visibleFrom]);

  const attentionProducts = products
    .filter(product => {
      const forecast = calculateForecast(
        product.stock,
        product.minStock,
        product.dailySales,
        product.supplierLeadTimeDays || 0,
        now
      );
      return product.stock <= product.minStock || forecast.risk === "High";
    })
    .sort((a, b) => a.stock - b.stock);
  const healthyCount = products.filter(product => product.stock > product.minStock).length;
  const healthyRatio = products.length
    ? Math.round((healthyCount / products.length) * 100)
    : null;
  const historyDays = Math.max(0, ...products.map(product => product.historyDays));
  const trendInsight = productSummaries.find(product => product.trend !== null);
  const reorderProduct = attentionProducts.find(product => product.dailySales > 0);
  const stockoutProduct = attentionProducts.find(product => product.dailySales > 0);
  const stockoutForecast = stockoutProduct
    ? calculateForecast(
        stockoutProduct.stock,
        stockoutProduct.minStock,
        stockoutProduct.dailySales,
        stockoutProduct.supplierLeadTimeDays || 0,
        now
      )
    : null;
  const unitsChange = calculatePercentChange(
    Number(todayKpis?.units_sold || 0),
    Number(yesterdayKpis?.units_sold || 0)
  );
  const transactionChange = calculatePercentChange(
    Number(todayKpis?.transaction_count || 0),
    Number(yesterdayKpis?.transaction_count || 0)
  );
  const profitChange = calculatePercentChange(
    Number(todayKpis?.profit || 0),
    Number(yesterdayKpis?.profit || 0)
  );

  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">{`OVERVIEW / ${formatOverviewDate(now).toLocaleUpperCase("id-ID")}`}</div>
          <h1>{`${getGreeting(now)}, ${firstName(userName)}`}</h1>
          <p>{outletName}</p>
        </div>
        <div className="page-actions">
          <>
            <button className="button button-secondary" onClick={() => { void refresh(); onRetryProducts(); }}>
              {loading || productLoading ? "Memuat..." : displayError ? "Gagal memuat - Coba lagi" : "Data live"}
              {lastUpdated && !displayError && (
                <small className="ml-2">
                  {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(lastUpdated)}
                </small>
              )}
            </button>
            <button className="button button-primary" onClick={() => onPage("pos")}>
              <Plus size={16} /> Transaksi baru
            </button>
          </>
        </div>
      </div>
      {displayError && <div className="empty-state" role="alert">{displayError}</div>}
      <div className="metric-grid">
        <Metric icon={BarChart3} label="Penjualan hari ini" value={money(Number(todayKpis?.revenue || 0))} change={calculatePercentChange(Number(todayKpis?.revenue || 0), Number(yesterdayKpis?.revenue || 0))} note="vs kemarin" />
        <Metric icon={ShoppingCart} label="Total transaksi" value={number(Number(todayKpis?.transaction_count || 0))} change={transactionChange} note="vs kemarin" />
        <Metric icon={Zap} label="Estimasi profit" value={money(Number(todayKpis?.profit || 0))} change={profitChange} note={todayKpis?.revenue ? `Margin ${number((Number(todayKpis.profit) / Number(todayKpis.revenue)) * 100)}%` : "Belum ada transaksi"} />
        <Metric icon={PackagePlus} label="Unit terjual" value={number(Number(todayKpis?.units_sold || 0))} change={unitsChange} note="hari ini vs kemarin" />
        <Metric icon={AlertCircle} label="Perlu perhatian" value={number(attentionProducts.length)} change={null} note="produk berisiko" />
      </div>
      <div className="dashboard-grid top-grid">
        <section className="panel chart-panel min-w-0">
          <div className="panel-header min-w-0 flex-wrap">
            <div>
              <h2>Performa penjualan</h2>
              <p>Data transaksi outlet pada periode yang dipilih</p>
            </div>
            <select className="select-control" value={period} onChange={event => setPeriod(Number(event.target.value) as 7 | 30)}>
              <option value={7}>7 hari</option>
              <option value={30}>30 hari</option>
            </select>
          </div>
          <div className="chart-total min-w-0 flex-wrap gap-2">
            <strong>{money(currentRevenue)}</strong>
            {periodChange !== null && (
              <span className={periodChange >= 0 ? "positive-text" : "negative-text"}>
                {periodChange >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                {number(Math.abs(periodChange))}%
              </span>
            )}
            <span className="chart-muted">vs periode sebelumnya</span>
          </div>
          {loading && !lastUpdated ? (
            <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
          ) : !visibleDaily.length ? (
            <div className="empty-state"><b>Belum ada transaksi</b></div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9eeeb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number) => [money(value), "Penjualan"]} />
                  <Line type="monotone" dataKey="revenue" name="Penjualan" stroke="#4f8a77" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="panel insight-panel min-w-0">
          <div className="panel-header min-w-0 flex-wrap">
            <div>
              <div className="ai-kicker"><Sparkles size={13} /> AI-POWERED ASSISTANT</div>
              <h2>Insight dari data transaksi</h2>
            </div>
            <button className="text-button" onClick={() => onPage("forecast")}>Lihat forecast <ChevronRight size={15} /></button>
          </div>
          {historyDays < 7 ? (
            <div className="empty-state">
              <b>Belum cukup riwayat transaksi</b>
              <span>Insight tren memerlukan data dari beberapa hari berbeda.</span>
            </div>
          ) : (
            <div className="insight-list">
              {stockoutProduct && stockoutForecast?.coverageDays !== null && stockoutForecast?.coverageDays !== undefined && (
                <button className="insight-card insight-critical" onClick={() => onForecast(stockoutProduct)}>
                  <AlertCircle size={17} />
                  <span><b>{stockoutProduct.name} diperkirakan habis dalam {Math.ceil(stockoutForecast.coverageDays)} hari</b><small>Stok {number(stockoutProduct.stock)} {stockoutProduct.unit}</small></span>
                  <ChevronRight size={17} />
                </button>
              )}
              {trendInsight && trendInsight.trend !== null && (
                <div className="insight-card insight-positive">
                  {trendInsight.trend >= 0 ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
                  <span><b>{trendInsight.name} {trendInsight.trend >= 0 ? "meningkat" : "menurun"}</b><small>{number(Math.abs(trendInsight.trend))}% dibanding 7 hari sebelumnya</small></span>
                </div>
              )}
              {reorderProduct && (
                <button className="insight-card insight-action" onClick={() => onForecast(reorderProduct)}>
                  <Zap size={17} />
                  <span><b>Rekomendasi reorder {reorderProduct.name}</b><small>{number(calculateForecast(reorderProduct.stock, reorderProduct.minStock, reorderProduct.dailySales, reorderProduct.supplierLeadTimeDays || 0).reorderQuantity)} {reorderProduct.unit}</small></span>
                  <ChevronRight size={17} />
                </button>
              )}
            </div>
          )}
          <div className="assistant-footer">
            <span><Check size={14} /> Estimasi berdasarkan {historyDays} hari data transaksi</span>
            <button onClick={() => onPage("forecast")}>Pelajari cara kerja</button>
          </div>
        </section>
      </div>
      <div className="dashboard-grid bottom-grid">
        <section className="panel">
          <div className="panel-header min-w-0 flex-wrap">
            <div><h2>Produk terlaris</h2><p>Penjualan pada periode aktif</p></div>
            <button className="text-button" onClick={() => onPage("reports")}>Lihat laporan <ChevronRight size={15} /></button>
          </div>
          {productSummaries.length ? (
            <div className="product-list">
              {productSummaries.map((product, index) => {
                const values = Array.from({ length: 7 }, (_, offset) =>
                  product.daily.get(shiftDateKey(todayKey, offset - 6)) || 0
                );
                return (
                  <div className="product-row min-w-0 gap-2 sm:gap-3" key={product.id}>
                    <div className="rank">{index + 1}</div>
                    <div className="product-row-copy min-w-0"><b className="truncate">{product.name}</b><span>{number(product.qty)} unit terjual</span></div>
                    <div className="product-revenue"><b>{money(product.revenue)}</b>{product.trend !== null && <span className={product.trend >= 0 ? "positive-text" : "negative-text"}>{number(product.trend)}%</span>}</div>
                    <Sparkline points={values} />
                  </div>
                );
              })}
            </div>
          ) : <div className="empty-state"><b>Belum ada transaksi</b></div>}
        </section>
        <section className="panel attention-panel">
          <div className="panel-header min-w-0 flex-wrap">
            <div><h2>Status inventory</h2><p>Stok dibandingkan minimum stok</p></div>
            <button className="icon-button small" onClick={() => onPage("inventory")}><ChevronRight size={16} /></button>
          </div>
          <div className="inventory-summary">
            <div><span className="summary-number danger">{products.filter(product => product.stock <= product.minStock / 2).length}</span><span>Kritis</span></div>
            <div><span className="summary-number warning">{products.filter(product => product.stock > product.minStock / 2 && product.stock <= product.minStock).length}</span><span>Rendah</span></div>
            <div><span className="summary-number success">{healthyCount}</span><span>Sehat</span></div>
          </div>
          <div className="stock-progress">
            <div className="progress-label"><span>Rasio stok sehat</span><b>{healthyRatio === null ? "—" : `${healthyRatio}%`}</b></div>
            <div className="progress-track"><span style={{ width: `${healthyRatio || 0}%` }} /></div>
          </div>
          {attentionProducts[0] && (
            <div className="mini-alert">
              <AlertCircle size={15} />
              <span><b>Prioritas:</b> {attentionProducts[0].name}</span>
              <button onClick={() => onForecast(attentionProducts[0])}>Tindakan <ChevronRight size={14} /></button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (!points.length) return null;
  const max = Math.max(...points, 1);
  const width = 88;
  const height = 32;
  const coords = points
    .map((point, index) => `${(index / Math.max(1, points.length - 1)) * width},${height - (point / max) * 24 - 4}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      <polyline fill="none" stroke="#4f8a77" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={coords} />
    </svg>
  );
}
