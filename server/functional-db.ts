import { getSupabaseAdmin } from "./supabase";

export type SaleInput = {
  outletId: number;
  paymentMethod: "QRIS" | "Tunai" | "Debit";
  subtotal: number;
  tax: number;
  total: number;
  items: Array<{ productId: number; productName: string; qty: number; unitPrice: number; unitCost: number }>;
};

export async function adjustProductStock(outletId: number, productId: number, amount: number) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { id: productId, outletId, amount, provider: "demo" as const };
  const { data: product, error: readError } = await supabase.from("products").select("id,stock").eq("id", productId).eq("outlet_id", outletId).single();
  if (readError) throw readError;
  const nextStock = Math.max(0, Number(product.stock) + amount);
  const { data, error } = await supabase.from("products").update({ stock: nextStock, updated_at: new Date().toISOString() }).eq("id", productId).eq("outlet_id", outletId).select("*").single();
  if (error) throw error;
  return data;
}

export async function listSuppliers() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createSupplier(input: { name: string; contact: string; phone: string; leadTimeDays: number; status: "Aktif" | "Review" | "Nonaktif" }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ...input, id: Date.now() };
  const { data, error } = await supabase.from("suppliers").insert({ name: input.name, contact: input.contact, phone: input.phone, lead_time_days: input.leadTimeDays, status: input.status }).select("*").single();
  if (error) throw error;
  return data;
}

export async function createSale(input: SaleInput) {
  const supabase = getSupabaseAdmin();
  const transactionNumber = `KBP-${Date.now().toString().slice(-8)}`;
  if (!supabase) return { transactionNumber, total: input.total, provider: "demo" as const };
  const { data: sale, error: saleError } = await supabase.from("sales").insert({ outlet_id: input.outletId, transaction_number: transactionNumber, payment_method: input.paymentMethod, subtotal: input.subtotal, tax: input.tax, total: input.total }).select("*").single();
  if (saleError) throw saleError;
  const { error: itemError } = await supabase.from("sale_items").insert(input.items.map(item => ({ sale_id: sale.id, product_id: item.productId, product_name: item.productName, qty: item.qty, unit_price: item.unitPrice, unit_cost: item.unitCost, line_total: item.qty * item.unitPrice })));
  if (itemError) throw itemError;
  return { transactionNumber, total: input.total, provider: "supabase" as const };
}

export async function listPurchaseOrders(outletId: number) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase.from("purchase_orders").select("*").eq("outlet_id", outletId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPurchaseOrder(input: { outletId: number; supplier: string; productId: number; product: string; qty: number; unit: string; unitCost: number; reason: string }) {
  const supabase = getSupabaseAdmin();
  const orderNumber = `PO-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now().toString().slice(-4)}`;
  const total = input.qty * input.unitCost;
  if (!supabase) return { id: orderNumber, orderNumber, ...input, total, status: "Draft" as const };
  const { data: order, error } = await supabase.from("purchase_orders").insert({ outlet_id: input.outletId, order_number: orderNumber, supplier: input.supplier, product_id: input.productId, product_name: input.product, qty: input.qty, unit: input.unit, unit_cost: input.unitCost, total, reason: input.reason, status: "Draft" }).select("*").single();
  if (error) throw error;
  return { ...order, id: Number(order.id), orderNumber };
}

export async function updatePurchaseOrderStatus(id: number | string, status: "Draft" | "Ordered" | "Received") {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { id, status };
  const query = typeof id === "number" ? supabase.from("purchase_orders").update({ status }).eq("id", id) : supabase.from("purchase_orders").update({ status }).eq("order_number", id);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return data;
}
