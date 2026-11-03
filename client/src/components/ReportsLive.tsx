import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileBarChart } from "lucide-react";
import { getSupabaseReportRange, type SupabaseReportRange } from "@/lib/supabase";
import { shiftDateKey } from "@/lib/datetime";

type Props = {
  outletId: number;
  onToast: (toast: { tone: "success" | "info" | "warning"; message: string }) => void;
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

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ReportsLive({ outletId, onToast }: Props) {
  const today = todayKey();
  const [from, setFrom] = useState(() => shiftDateKey(today, -29));
  const [to, setTo] = useState(today);
  const [current, setCurrent] = useState<SupabaseReportRange | null>(null);
  const [previous, setPrevious] = useState<SupabaseReportRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!outletId) return;
    if (!from || !to || from > to) {
      setError("Tanggal awal harus sama dengan atau sebelum tanggal akhir.");
      return;
    }
    setLoading(true);
    setError(null);
    const duration =
      Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
    const compareFrom = shiftDateKey(from, -duration);
    const compareTo = shiftDateKey(from, -1);
    try {
      const [currentData, previousData] = await Promise.all([
        getSupabaseReportRange(outletId, from, to),
        getSupabaseReportRange(outletId, compareFrom, compareTo),
      ]);
      setCurrent(currentData);
      setPrevious(previousData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Laporan gagal dimuat dari Supabase.");
    } finally {
      setLoading(false);
    }
  }, [from, outletId, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totals = useMemo(() => {
    const daily = current?.daily || [];
    return {
      revenue: daily.reduce((sum, row) => sum + Number(row.revenue), 0),
      profit: daily.reduce((sum, row) => sum + Number(row.profit), 0),
      transactions: daily.reduce((sum, row) => sum + Number(row.transaction_count), 0),
      units: daily.reduce((sum, row) => sum + Number(row.units_sold), 0),
    };
  }, [current]);
  const previousTotals = useMemo(
    () => ({
      revenue: (previous?.daily || []).reduce((sum, row) => sum + Number(row.revenue), 0),
      profit: (previous?.daily || []).reduce((sum, row) => sum + Number(row.profit), 0),
    }),
    [previous]
  );
  const costOfGoods = totals.revenue - totals.profit;
  const categoryTotals = useMemo(() => {
    const totalsByCategory = new Map<string, number>();
    for (const row of current?.categories || []) {
      totalsByCategory.set(
        row.category,
        (totalsByCategory.get(row.category) || 0) + Number(row.revenue)
      );
    }
    return Array.from(totalsByCategory.entries())
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [current]);
  const productTotals = useMemo(() => {
    const productMap = new Map<
      number,
      { name: string; revenue: number; qty: number; previousRevenue: number }
    >();
    const previousByProduct = new Map<number, number>();
    for (const row of previous?.topProducts || []) {
      previousByProduct.set(
        row.product_id,
        (previousByProduct.get(row.product_id) || 0) + Number(row.revenue)
      );
    }
    for (const row of current?.topProducts || []) {
      const entry = productMap.get(row.product_id) || {
        name: row.product_name,
        revenue: 0,
        qty: 0,
        previousRevenue: previousByProduct.get(row.product_id) || 0,
      };
      entry.revenue += Number(row.revenue);
      entry.qty += Number(row.qty_sold);
      productMap.set(row.product_id, entry);
    }
    return Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [current, previous]);
  const chartData = (current?.daily || []).map(row => ({
    date: new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Jakarta",
    }).format(new Date(`${row.sale_date}T12:00:00+07:00`)),
    revenue: Number(row.revenue),
    profit: Number(row.profit),
  }));
  const paymentTotals = useMemo(() => {
    const totalsByMethod = new Map<string, number>();
    for (const row of current?.payments || []) {
      totalsByMethod.set(
        row.payment_method,
        (totalsByMethod.get(row.payment_method) || 0) + Number(row.revenue)
      );
    }
    return Array.from(totalsByMethod.entries()).map(([method, revenue]) => ({ method, revenue }));
  }, [current]);
  const exportReport = () => {
    if (!current) return;
    const rows: Array<Array<string | number>> = [
      ["Bagian", "Nama", "Tanggal", "Penjualan", "Profit", "Jumlah"],
      ...(current.daily || []).map(row => [
        "Harian",
        "Total",
        row.sale_date,
        row.revenue,
        row.profit,
        row.transaction_count,
      ]),
      ...(current.topProducts || []).map(row => [
        "Produk",
        row.product_name,
        row.sale_date,
        row.revenue,
        row.profit,
        row.qty_sold,
      ]),
      ...(current.categories || []).map(row => [
        "Kategori",
        row.category,
        row.sale_date,
        row.revenue,
        row.profit,
        row.qty_sold,
      ]),
      ...(current.payments || []).map(row => [
        "Pembayaran",
        row.payment_method,
        row.sale_date,
        row.revenue,
        "",
        row.transaction_count,
      ]),
    ];
    downloadCsv("kopipintar-report.csv", rows);
    onToast({ tone: "success", message: "CSV dari data laporan Supabase berhasil diunduh." });
  };

  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">ANALYTICS / BUSINESS HEALTH</div>
          <h1>Reports</h1>
          <p>Ringkasan dari transaksi dan item penjualan pada outlet terpilih.</p>
        </div>
        <div className="page-actions">
          <label className="sr-only" htmlFor="report-from">Tanggal awal</label>
          <input id="report-from" className="select-control" type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} />
          <label className="sr-only" htmlFor="report-to">Tanggal akhir</label>
          <input id="report-to" className="select-control" type="date" value={to} min={from} onChange={event => setTo(event.target.value)} />
          <button className="button button-secondary" onClick={() => void refresh()}>Terapkan</button>
          <button className="button button-primary" onClick={exportReport} disabled={!current || loading}><Download size={16} /> Export CSV</button>
        </div>
      </div>
      {error && <div className="empty-state" role="alert"><b>Laporan gagal dimuat</b><span>{error}</span><button className="button button-secondary" onClick={() => void refresh()}>Coba lagi</button></div>}
      {loading && !current ? (
        <div className="grid gap-4"><div className="h-28 animate-pulse rounded-xl bg-gray-100" /><div className="h-72 animate-pulse rounded-xl bg-gray-100" /></div>
      ) : (
        <>
          <div className="metric-grid">
            <div className="metric-card"><div className="metric-label">Penjualan</div><div className="metric-value">{money(totals.revenue)}</div><div className="metric-note">vs {money(previousTotals.revenue)} periode sebelumnya</div></div>
            <div className="metric-card"><div className="metric-label">Profit kotor</div><div className="metric-value">{money(totals.profit)}</div><div className="metric-note">vs {money(previousTotals.profit)} periode sebelumnya</div></div>
            <div className="metric-card"><div className="metric-label">Transaksi</div><div className="metric-value">{number(totals.transactions)}</div><div className="metric-note">{number(totals.units)} unit terjual</div></div>
            <div className="metric-card"><div className="metric-label">COGS terestimasi</div><div className="metric-value">{money(costOfGoods)}</div><div className="metric-note">Penjualan dikurangi profit item</div></div>
          </div>
          <div className="report-grid">
            <section className="panel report-main">
              <div className="panel-header"><div><h2>Penjualan & profit</h2><p>{from} — {to}</p></div></div>
              {chartData.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value: number) => money(value)} /><Line dataKey="revenue" name="Penjualan" stroke="#4f8a77" strokeWidth={3} /><Line dataKey="profit" name="Profit" stroke="#7b6aa5" strokeWidth={3} /></LineChart></ResponsiveContainer></div> : <div className="empty-state"><b>Belum ada transaksi pada rentang tanggal ini</b></div>}
            </section>
            <section className="panel pnl-card">
              <div className="panel-header"><div><h2>Profit & Loss</h2><p>{from} — {to}</p></div><FileBarChart size={20} /></div>
              <div className="pnl-rows">
                <div><span>Penjualan</span><b>{money(totals.revenue)}</b></div>
                <div><span>Harga pokok produk</span><b className="negative-text">-{money(costOfGoods)}</b></div>
                <div className="pnl-divider" />
                <div className="pnl-total"><span>Profit kotor</span><strong>{money(totals.profit)}</strong></div>
                <p>Biaya operasional tidak tersedia pada data Supabase.</p>
              </div>
            </section>
          </div>
          <div className="report-grid bottom-reports">
            <section className="panel category-report">
              <div className="panel-header"><div><h2>Penjualan per kategori</h2><p>Nilai penjualan dari item transaksi</p></div></div>
              {categoryTotals.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={categoryTotals}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="category" /><YAxis /><Tooltip formatter={(value: number) => money(value)} /><Bar dataKey="revenue" fill="#4f8a77" /></BarChart></ResponsiveContainer></div> : <div className="empty-state"><b>Belum ada penjualan berkategori</b></div>}
            </section>
            <section className="panel performance-report">
              <div className="panel-header"><div><h2>Metode pembayaran</h2><p>Penjualan menurut metode tercatat</p></div></div>
              {paymentTotals.length ? <div className="performance-list">{paymentTotals.map(item => <div className="performance-item" key={item.method}><div><span>{item.method}</span><b>{money(item.revenue)}</b></div></div>)}</div> : <div className="empty-state"><b>Belum ada transaksi</b></div>}
            </section>
          </div>
          <section className="panel mt-5">
            <div className="panel-header"><div><h2>Produk terlaris</h2><p>Diurutkan berdasarkan revenue pada rentang terpilih</p></div></div>
            {productTotals.length ? <div className="table-wrap overflow-x-auto"><table className="data-table"><thead><tr><th>Produk</th><th>Unit terjual</th><th>Revenue</th><th>Perubahan vs periode sebelumnya</th></tr></thead><tbody>{productTotals.map(item => <tr key={item.name}><td>{item.name}</td><td>{number(item.qty)}</td><td>{money(item.revenue)}</td><td>{item.previousRevenue > 0 ? `${number(((item.revenue - item.previousRevenue) / item.previousRevenue) * 100)}%` : "Tidak ada baseline"}</td></tr>)}</tbody></table></div> : <div className="empty-state"><b>Belum ada transaksi</b></div>}
          </section>
        </>
      )}
    </>
  );
}
