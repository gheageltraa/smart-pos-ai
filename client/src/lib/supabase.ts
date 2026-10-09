import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseAuthConfigured = Boolean(url && anonKey);
export const supabase = isSupabaseAuthConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type KopipintarRole = "admin" | "kasir";
export type KopipintarProfile = {
  id: string;
  username: string;
  full_name: string | null;
  role: KopipintarRole;
};

export const usernameEmail = (username: string) => {
  const normalized = username.trim().toLowerCase();
  return normalized.includes("@") ? normalized : `${normalized}@kopipintar.com`;
};

export async function signInWithUsername(username: string, password: string) {
  const client = requireClient();
  return client.auth.signInWithPassword({
    email: usernameEmail(username),
    password,
  });
}

export async function getCurrentProfile() {
  const client = requireClient();
  const { data: session } = await client.auth.getSession();
  if (!session.session?.user) return null;
  const { data, error } = await client
    .from("profiles")
    .select("id, username, full_name, role")
    .eq("id", session.session.user.id)
    .maybeSingle();
  if (error) throw error;
  return data as KopipintarProfile | null;
}

export type SupabaseProduct = {
  id: number;
  name: string;
  sku: string;
  category: string;
  unit: string;
  stock: number;
  min_stock: number;
  cost: number;
  price: number;
  supplier: string;
  daily_sales: number;
  trend: number;
  emoji: string;
  icon_name: string | null;
  outlet_id: number;
};

function requireClient() {
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  return supabase;
}

export async function listSupabaseProducts(outletId: number) {
  const client = requireClient();
  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("outlet_id", outletId)
    .order("name");
  if (error) throw error;
  const products = (data || []) as SupabaseProduct[];
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data: sales, error: salesError } = await client
    .from("sales")
    .select("id, created_at")
    .eq("outlet_id", outletId)
    .gte("created_at", since.toISOString());
  if (salesError || !sales?.length) return products;
  const saleIds = sales.map(sale => sale.id);
  const { data: items, error: itemsError } = await client
    .from("sale_items")
    .select("product_id, qty")
    .in("sale_id", saleIds);
  if (itemsError) return products;
  const totals = new Map<number, number>();
  for (const item of items || [])
    totals.set(
      Number(item.product_id),
      (totals.get(Number(item.product_id)) || 0) + Number(item.qty)
    );
  const currentSince = new Date();
  currentSince.setDate(currentSince.getDate() - 7);
  const previousSince = new Date();
  previousSince.setDate(previousSince.getDate() - 14);
  const currentIds = new Set(
    sales
      .filter(sale => new Date(sale.created_at) >= currentSince)
      .map(sale => sale.id)
  );
  const previousIds = new Set(
    sales
      .filter(
        sale =>
          new Date(sale.created_at) >= previousSince &&
          new Date(sale.created_at) < currentSince
      )
      .map(sale => sale.id)
  );
  const { data: trendItems } = await client
    .from("sale_items")
    .select("sale_id, product_id, qty")
    .in("sale_id", saleIds);
  const currentTotals = new Map<number, number>();
  const previousTotals = new Map<number, number>();
  for (const item of trendItems || []) {
    const target = currentIds.has(item.sale_id)
      ? currentTotals
      : previousIds.has(item.sale_id)
        ? previousTotals
        : null;
    if (target)
      target.set(
        Number(item.product_id),
        (target.get(Number(item.product_id)) || 0) + Number(item.qty)
      );
  }
  return products.map(product => {
    const dailySales = Number(
      (totals.get(product.id) || Number(product.daily_sales) * 30) / 30
    );
    const current = currentTotals.get(product.id) || 0;
    const previous = previousTotals.get(product.id) || 0;
    const trend =
      previous > 0
        ? Math.round(((current - previous) / previous) * 100)
        : Number(product.trend || 0);
    return { ...product, daily_sales: dailySales, trend };
  });
}

export async function insertSupabaseProduct(
  input: Omit<SupabaseProduct, "id" | "outlet_id"> & { outlet_id: number }
) {
  const client = requireClient();
  const { data, error } = await client
    .from("products")
    .insert({
      name: input.name,
      sku: input.sku,
      category: input.category,
      unit: input.unit,
      stock: input.stock,
      min_stock: input.min_stock,
      cost: input.cost,
      price: input.price,
      supplier: input.supplier,
      daily_sales: input.daily_sales,
      trend: input.trend,
      emoji: input.emoji,
      icon_name: input.icon_name,
      outlet_id: input.outlet_id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SupabaseProduct;
}

export async function adjustSupabaseProductStock(
  productId: number,
  outletId: number,
  amount: number
) {
  const client = requireClient();
  const { data: current, error: readError } = await client
    .from("products")
    .select("stock")
    .eq("id", productId)
    .eq("outlet_id", outletId)
    .single();
  if (readError) throw readError;
  const nextStock = Math.max(0, Number(current.stock) + amount);
  const { data, error } = await client
    .from("products")
    .update({ stock: nextStock, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("outlet_id", outletId)
    .select("*")
    .single();
  if (error) throw error;
  return data as SupabaseProduct;
}

export async function createSupabaseSale(input: {
  outletId: number;
  paymentMethod: "QRIS" | "Tunai" | "Debit";
  subtotal: number;
  tax: number;
  total: number;
  items: Array<{
    productId: number;
    productName: string;
    qty: number;
    unitPrice: number;
    unitCost: number;
  }>;
}) {
  const client = requireClient();
  const transactionNumber = `KBP-${Date.now().toString().slice(-8)}`;
  const { data: sale, error: saleError } = await client
    .from("sales")
    .insert({
      transaction_number: transactionNumber,
      outlet_id: input.outletId,
      payment_method: input.paymentMethod,
      subtotal: input.subtotal,
      tax: input.tax,
      total: input.total,
    })
    .select("id, transaction_number")
    .single();
  if (saleError) throw saleError;
  const { error: itemsError } = await client.from("sale_items").insert(
    input.items.map(item => ({
      sale_id: sale.id,
      product_id: item.productId,
      product_name: item.productName,
      qty: item.qty,
      unit_price: item.unitPrice,
      unit_cost: item.unitCost,
      line_total: item.qty * item.unitPrice,
    }))
  );
  if (itemsError) throw itemsError;
  return {
    transactionNumber: sale.transaction_number,
    total: input.total,
    provider: "supabase" as const,
  };
}
