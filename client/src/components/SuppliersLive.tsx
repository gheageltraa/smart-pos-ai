import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, Trash2, Truck } from "lucide-react";
import type { Product } from "@/lib/models";
import {
  deleteSupabaseSupplier,
  insertSupabaseSupplier,
  listSupabaseSuppliers,
  updateSupabaseSupplier,
  type SupabaseSupplier,
} from "@/lib/supabase";

type Props = {
  products: Product[];
  onToast: (toast: { tone: "success" | "info" | "warning"; message: string }) => void;
};

export default function SuppliersLive({ products, onToast }: Props) {
  const [suppliers, setSuppliers] = useState<SupabaseSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSuppliers(await listSupabaseSuppliers());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Supplier gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const productCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      if (product.supplier)
        counts.set(product.supplier, (counts.get(product.supplier) || 0) + 1);
    }
    return counts;
  }, [products]);

  const add = async () => {
    const name = window.prompt("Nama supplier");
    if (!name?.trim()) return;
    const contact = window.prompt("Nama kontak");
    const phone = window.prompt("Nomor telepon");
    const leadTime = Number(window.prompt("Lead time dalam hari"));
    if (!Number.isInteger(leadTime) || leadTime < 0)
      return onToast({ tone: "warning", message: "Lead time harus berupa bilangan hari yang valid." });
    try {
      await insertSupabaseSupplier({
        name: name.trim(),
        contact: contact?.trim() || "",
        phone: phone?.trim() || "",
        lead_time_days: leadTime,
      });
      await refresh();
      onToast({ tone: "success", message: `${name.trim()} berhasil ditambahkan.` });
    } catch (cause) {
      onToast({
        tone: "warning",
        message: cause instanceof Error ? `Supplier gagal ditambahkan: ${cause.message}` : "Supplier gagal disimpan.",
      });
    }
  };

  const edit = async (supplier: SupabaseSupplier) => {
    const name = window.prompt("Nama supplier", supplier.name);
    if (!name?.trim()) return;
    const contact = window.prompt("Nama kontak", supplier.contact);
    if (contact === null) return;
    const phone = window.prompt("Nomor telepon", supplier.phone);
    if (phone === null) return;
    const leadTime = Number(window.prompt("Lead time dalam hari", String(supplier.lead_time_days)));
    if (!Number.isInteger(leadTime) || leadTime < 0)
      return onToast({ tone: "warning", message: "Lead time harus berupa bilangan hari yang valid." });
    const status = window.prompt("Status supplier", supplier.status);
    if (status === null) return;
    if (!["Aktif", "Review", "Nonaktif"].includes(status.trim()))
      return onToast({ tone: "warning", message: "Pilih status Aktif, Review, atau Nonaktif." });
    try {
      await updateSupabaseSupplier(supplier.id, {
        name: name.trim(),
        contact: contact.trim(),
        phone: phone.trim(),
        lead_time_days: leadTime,
        status: status.trim(),
      });
      await refresh();
      onToast({ tone: "success", message: `${name.trim()} berhasil diperbarui.` });
    } catch (cause) {
      onToast({
        tone: "warning",
        message: cause instanceof Error ? `Supplier gagal diperbarui: ${cause.message}` : "Supplier gagal diperbarui.",
      });
    }
  };

  const remove = async (supplier: SupabaseSupplier) => {
    if (!window.confirm(`Hapus supplier ${supplier.name}?`)) return;
    try {
      await deleteSupabaseSupplier(supplier.id);
      await refresh();
      onToast({ tone: "success", message: `${supplier.name} berhasil dihapus.` });
    } catch (cause) {
      onToast({
        tone: "warning",
        message: cause instanceof Error ? `Supplier gagal dihapus: ${cause.message}` : "Supplier gagal dihapus.",
      });
    }
  };

  return (
    <>
      <div className="page-title-row">
        <div><div className="eyebrow">PARTNERS / SUPPLY NETWORK</div><h1>Supplier</h1><p>Data pemasok dan lead time dari Supabase.</p></div>
        <div className="page-actions"><button className="button button-primary" onClick={() => void add()}><Plus size={16} /> Tambah supplier</button></div>
      </div>
      {error && <div className="empty-state" role="alert"><b>Supplier gagal dimuat</b><span>{error}</span><button className="button button-secondary" onClick={() => void refresh()}>Coba lagi</button></div>}
      {loading && !suppliers.length ? <div className="h-48 animate-pulse rounded-xl bg-gray-100" /> : (
        <div className="supplier-grid">
          {suppliers.map(supplier => (
            <div className="supplier-card panel" key={supplier.id}>
              <div className="supplier-top">
                <div className="supplier-avatar">{supplier.name.slice(0, 2).toUpperCase()}</div>
                <div><h3>{supplier.name}</h3><span>{supplier.contact}</span></div>
                <button className="icon-button small" onClick={() => void edit(supplier)} aria-label={`Edit ${supplier.name}`}><ChevronRight size={16} /></button>
              </div>
              <div className="supplier-meta">
                <div><span>Produk</span><b>{productCounts.get(supplier.name) || 0}</b></div>
                <div><span>Lead time</span><b>{supplier.lead_time_days} hari</b></div>
              </div>
              <div className="supplier-bottom">
                <span className="badge"><span className="badge-dot" /> {supplier.status}</span>
                <div className="flex gap-2">
                  {supplier.phone && <a className="row-link" href={`tel:${supplier.phone}`}>Hubungi</a>}
                  <button className="row-link" onClick={() => void remove(supplier)} aria-label={`Hapus ${supplier.name}`}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
          {!suppliers.length && !loading && <div className="empty-state"><Truck size={24} /><b>Belum ada supplier</b><span>Tambahkan supplier untuk mengelola pemasok.</span></div>}
        </div>
      )}
    </>
  );
}
