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
  const [editingSupplier, setEditingSupplier] = useState<SupabaseSupplier | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [leadTime, setLeadTime] = useState("3");
  const [status, setStatus] = useState("Aktif");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const openCreate = () => {
    setEditingSupplier(null);
    setName("");
    setContact("");
    setPhone("");
    setLeadTime("3");
    setStatus("Aktif");
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (supplier: SupabaseSupplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setContact(supplier.contact);
    setPhone(supplier.phone);
    setLeadTime(String(supplier.lead_time_days));
    setStatus(supplier.status);
    setFormError(null);
    setFormOpen(true);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const normalizedName = name.trim();
    const parsedLeadTime = Number(leadTime);
    if (!normalizedName) return setFormError("Nama supplier wajib diisi.");
    if (!Number.isInteger(parsedLeadTime) || parsedLeadTime < 0)
      return setFormError("Lead time harus berupa bilangan hari nol atau lebih.");
    if (!["Aktif", "Review", "Nonaktif"].includes(status))
      return setFormError("Pilih status supplier yang tersedia.");

    setSaving(true);
    try {
      if (editingSupplier) {
        await updateSupabaseSupplier(editingSupplier.id, {
          name: normalizedName,
          contact: contact.trim(),
          phone: phone.trim(),
          lead_time_days: parsedLeadTime,
          status,
        });
      } else {
        await insertSupabaseSupplier({
          name: normalizedName,
          contact: contact.trim(),
          phone: phone.trim(),
          lead_time_days: parsedLeadTime,
          status,
        });
      }
      await refresh();
      setFormOpen(false);
      onToast({ tone: "success", message: editingSupplier ? `${normalizedName} berhasil diperbarui.` : `${normalizedName} berhasil ditambahkan.` });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Supplier gagal disimpan.";
      setFormError(message);
      onToast({
        tone: "warning",
        message: `Supplier gagal disimpan: ${message}`,
      });
    } finally {
      setSaving(false);
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
        <div className="page-actions"><button className="button button-primary" onClick={openCreate}><Plus size={16} /> Tambah supplier</button></div>
      </div>
      {error && <div className="empty-state" role="alert"><b>Supplier gagal dimuat</b><span>{error}</span><button className="button button-secondary" onClick={() => void refresh()}>Coba lagi</button></div>}
      {loading && !suppliers.length ? <div className="h-48 animate-pulse rounded-xl bg-gray-100" /> : (
        <div className="supplier-grid">
          {suppliers.map(supplier => (
            <div className="supplier-card panel" key={supplier.id}>
              <div className="supplier-top">
                <div className="supplier-avatar">{supplier.name.slice(0, 2).toUpperCase()}</div>
                <div><h3>{supplier.name}</h3><span>{supplier.contact}</span></div>
                <button className="icon-button small" onClick={() => openEdit(supplier)} aria-label={`Edit ${supplier.name}`}><ChevronRight size={16} /></button>
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
      {formOpen && (
        <div className="modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget && !saving) setFormOpen(false);
        }}>
          <form className="modal form-modal" onSubmit={event => void save(event)}>
            <button type="button" className="modal-close" onClick={() => setFormOpen(false)} aria-label="Tutup form" disabled={saving}>×</button>
            <div className="eyebrow">SUPPLIER / {editingSupplier ? "EDIT" : "BARU"}</div>
            <h2>{editingSupplier ? "Edit supplier" : "Tambah supplier"}</h2>
            <p>Lengkapi informasi pemasok untuk membantu perencanaan restock.</p>
            <label>Nama supplier<input autoFocus required value={name} onChange={event => setName(event.target.value)} placeholder="Contoh: Dairy Fresh" /></label>
            <label>Nama kontak<input value={contact} onChange={event => setContact(event.target.value)} placeholder="Nama PIC (opsional)" /></label>
            <label>Nomor telepon<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="08xx atau +62 (opsional)" /></label>
            <label>Lead time (hari)<input type="number" min="0" step="1" required value={leadTime} onChange={event => setLeadTime(event.target.value)} /></label>
            <label>Status<select className="select-control" value={status} onChange={event => setStatus(event.target.value)}><option>Aktif</option><option>Review</option><option>Nonaktif</option></select></label>
            {formError && <div className="rounded-lg border border-[#efc7c2] bg-[#fff1ef] px-3 py-2.5 text-xs leading-[1.45] text-[#a33d39]" role="alert">{formError}</div>}
            <div className="modal-footer">
              <button type="button" className="button button-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Batal</button>
              <button type="submit" className="button button-primary" disabled={saving}>{saving ? "Menyimpan..." : editingSupplier ? "Simpan perubahan" : "Tambah supplier"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
