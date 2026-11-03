import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronRight, HelpCircle, RefreshCw, Sparkles } from "lucide-react";
import { calculateForecast } from "@/lib/analytics";
import type { Product } from "@/lib/models";

type Props = {
  products: Product[];
  onCreateDraft: (product: Product) => void;
  onRefresh: () => void;
  initialProductId?: number | null;
  loading: boolean;
  error: string | null;
};

const number = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value);

function forecastDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(date)
    : "Belum dapat diprediksi";
}

function riskLabel(risk: "High" | "Medium" | "Safe") {
  return risk === "High" ? "Tinggi" : risk === "Medium" ? "Sedang" : "Sehat";
}

export default function ForecastLive({
  products,
  onCreateDraft,
  onRefresh,
  initialProductId,
  loading,
  error,
}: Props) {
  const forecasts = useMemo(
    () =>
      products.map(product => ({
        product,
        result: calculateForecast(
          product.stock,
          product.minStock,
          product.dailySales,
          product.supplierLeadTimeDays || 0
        ),
      })),
    [products]
  );
  const [selectedId, setSelectedId] = useState<number | null>(
    forecasts[0]?.product.id ?? null
  );
  useEffect(() => {
    if (!forecasts.some(row => row.product.id === selectedId))
      setSelectedId(forecasts[0]?.product.id ?? null);
  }, [forecasts, selectedId]);
  useEffect(() => {
    if (initialProductId && forecasts.some(row => row.product.id === initialProductId))
      setSelectedId(initialProductId);
  }, [forecasts, initialProductId]);
  const selected = forecasts.find(row => row.product.id === selectedId);
  const priority = [...forecasts]
    .filter(({ product, result }) => product.historyDays > 0 && result.risk !== "Safe")
    .sort((a, b) => (a.result.coverageDays ?? Infinity) - (b.result.coverageDays ?? Infinity));
  const historyDays = Math.max(0, ...products.map(product => product.historyDays));

  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">INTELLIGENCE / DECISION SUPPORT</div>
          <h1>AI Forecast</h1>
          <p>Perkiraan berbasis transaksi 30 hari terakhir dan pemakaian komponen bundle.</p>
        </div>
        <div className="page-actions">
          <button className="button button-secondary" onClick={onRefresh}><RefreshCw size={16} /> Refresh forecast</button>
        </div>
      </div>
      <div className="forecast-hero">
        <div>
          <div className="ai-kicker"><Sparkles size={13} /> FORECAST DARI DATA SUPABASE</div>
          <h2>Perkiraan stok berdasarkan penjualan aktual.</h2>
          <p>Rata-rata harian memakai penjualan item selama 30 hari. Penjualan bundle juga menambah pemakaian setiap komponennya.</p>
          <div className="forecast-method">
            <span><Check size={14} /> Data penjualan 30 hari</span>
            <span><Check size={14} /> Pemakaian bundle dihitung</span>
            <span><Check size={14} /> Lead time supplier bila tersedia</span>
          </div>
        </div>
        <div className="forecast-orbit">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-center"><Sparkles size={27} /><b>{historyDays}</b><small>hari data</small></div>
        </div>
      </div>
      {error && <div className="empty-state" role="alert"><b>Forecast gagal dimuat</b><span>{error}</span><button className="button button-secondary" onClick={onRefresh}>Coba lagi</button></div>}
      <div className="forecast-layout">
        <section className="panel forecast-table-panel">
          <div className="panel-header min-w-0 flex-wrap">
            <div><h2>Prioritas restock</h2><p>{priority.length} produk berdasarkan stok dan demand aktual</p></div>
          </div>
          <div className="table-wrap overflow-x-auto">
            <table className="data-table forecast-table">
              <thead><tr><th>Produk</th><th>Stok</th><th>Rata-rata/hari</th><th>Perkiraan habis</th><th>Risiko</th><th /></tr></thead>
              <tbody>
                {forecasts.map(({ product, result }) => (
                  <tr key={product.id} onClick={() => setSelectedId(product.id)} className={selectedId === product.id ? "selected-row" : ""}>
                    <td><b>{product.name}</b><small className="block">{product.sku}</small></td>
                    <td>{number(product.stock)} {product.unit}</td>
                    <td>{product.historyDays ? `${number(result.averageDailySales)} ${product.unit}/hari` : "Belum ada riwayat"}</td>
                    <td>{product.historyDays ? forecastDate(result.stockoutDate) : "Belum dapat diprediksi"}</td>
                    <td>{product.historyDays ? riskLabel(result.risk) : "Data belum cukup"}</td>
                    <td><button className="recommendation-link" onClick={event => { event.stopPropagation(); setSelectedId(product.id); }}>Detail <ChevronRight size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && !products.length ? <div className="h-48 animate-pulse rounded-lg bg-gray-100" /> : null}
          {!products.length && !loading && <div className="empty-state"><b>Belum ada produk</b><span>Tambahkan produk dan catat transaksi untuk membuat forecast.</span></div>}
        </section>
        {selected && (
          <section className="forecast-detail-card">
            <div className="detail-card-top">
              <div className="product-hero-mini"><span>{selected.product.name.slice(0, 1)}</span><div><b>{selected.product.name}</b><small>{selected.product.sku} · {selected.product.supplier}</small></div></div>
              <span className="badge">{selected.product.historyDays ? riskLabel(selected.result.risk) : "Data belum cukup"}</span>
            </div>
            <div className="prediction-label"><span>Perkiraan stok habis</span><strong>{forecastDate(selected.result.stockoutDate)}</strong></div>
            {selected.product.historyDays ? (
              <>
                <p className="prediction-copy">
                  Rata-rata penjualan/pemakaian{" "}
                  <b>{number(selected.result.averageDailySales)} {selected.product.unit}/hari</b>,
                  stok saat ini <b>{number(selected.product.stock)} {selected.product.unit}</b>.
                  {selected.result.coverageDays === null
                    ? " Belum ada demand yang tercatat untuk produk ini."
                    : ` Dengan pola tersebut, cakupan stok sekitar ${number(selected.result.coverageDays)} hari.`}
                </p>
                <div className="why-prediction">
                  <div className="why-head"><b>Dasar perhitungan</b><HelpCircle size={15} /></div>
                  <div className="why-item"><span className="why-dot mint" /><span>Data outlet mencakup <b>{selected.product.historyDays} hari transaksi</b> dalam jendela 30 hari.</span></div>
                  <div className="why-item"><span className="why-dot blue" /><span>Demand harian menghitung item langsung dan komponen bundle terjual.</span></div>
                  <div className="why-item"><span className="why-dot amber" /><span>Lead time pemasok: <b>{selected.product.supplierLeadTimeDays === null ? "belum tersedia" : `${selected.product.supplierLeadTimeDays} hari`}</b>.</span></div>
                  {selected.product.trend !== null && <div className="why-item"><span className="why-dot mint" /><span>Perubahan demand 7 hari: <b>{number(selected.product.trend)}%</b> dibanding minggu sebelumnya.</span></div>}
                </div>
                <div className="forecast-action">
                  <div><b>Rekomendasi pembelian</b><span>{number(selected.result.reorderQuantity)} {selected.product.unit}</span></div>
                  <button className="button button-primary" disabled={selected.result.reorderQuantity <= 0} onClick={() => onCreateDraft(selected.product)}>
                    <AlertCircle size={15} /> Buat draft Purchase Order
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state"><b>Belum cukup riwayat transaksi</b><span>Forecast baru tersedia setelah penjualan tercatat.</span></div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
