import { createClient } from "@supabase/supabase-js";
import { formatJakartaDateKey, shiftDateKey } from "@/lib/datetime";

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

export type KopipintarRole = "admin" | "kasir" | "pending";
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
  category_id?: number | null;
  unit: string;
  stock: number;
  min_stock: number;
  cost: number;
  price: number;
  supplier: string;
  daily_sales: number;
  trend: number | null;
  emoji: string;
  icon_name: string | null;
  is_bundle: boolean;
  outlet_id: number;
  bundle_items?: Array<{
    component_product_id?: number;
    componentProductId?: number;
    quantity: number;
  }>;
  average_daily_sales?: number;
  history_days?: number;
};

function requireClient() {
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  return supabase;
}

export async function listSupabaseProducts(
  outletId: number,
  includeSalesHistory = true
) {
  const client = requireClient();
  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("outlet_id", outletId)
    .order("name");
  if (error) throw error;
  const products = (data || []) as SupabaseProduct[];
  if (!products.length) return products;
  const { data: bundleItems, error: bundleError } = await client
    .from("bundle_items")
    .select("bundle_product_id, component_product_id, quantity")
    .in(
      "bundle_product_id",
      products.map(product => product.id)
    );
  if (bundleError) throw bundleError;
  const bundleMap = new Map<
    number,
    Array<{ component_product_id: number; quantity: number }>
  >();
  for (const item of bundleItems || []) {
    const list = bundleMap.get(Number(item.bundle_product_id)) || [];
    list.push({
      component_product_id: Number(item.component_product_id),
      quantity: Number(item.quantity),
    });
    bundleMap.set(Number(item.bundle_product_id), list);
  }
  for (const product of products)
    product.bundle_items = bundleMap.get(product.id) || [];
  if (!includeSalesHistory) return products;
  const { data: demandRows, error: demandError } = await client
    .from("reporting_product_demand_30d")
    .select("product_id, average_daily_sales, history_days")
    .eq("outlet_id", outletId);
  if (demandError) throw demandError;
  const demandByProduct = new Map(
    (demandRows || []).map(row => [
      Number(row.product_id),
      {
        average: Number(row.average_daily_sales),
        historyDays: Number(row.history_days),
      },
    ])
  );
  const todayKey = formatJakartaDateKey();
  const { data: trendRows, error: trendError } = await client
    .from("reporting_product_demand_daily")
    .select("sale_date, product_id, qty_sold")
    .eq("outlet_id", outletId)
    .gte("sale_date", shiftDateKey(todayKey, -13))
    .lte("sale_date", todayKey);
  if (trendError) throw trendError;
  const trendByProduct = new Map<number, { current: number; previous: number }>();
  const currentStart = shiftDateKey(todayKey, -6);
  const previousStart = shiftDateKey(todayKey, -13);
  for (const row of trendRows || []) {
    const id = Number(row.product_id);
    const trend = trendByProduct.get(id) || { current: 0, previous: 0 };
    if (row.sale_date >= currentStart) trend.current += Number(row.qty_sold);
    else if (row.sale_date >= previousStart) trend.previous += Number(row.qty_sold);
    trendByProduct.set(id, trend);
  }
  return products.map(product => {
    const demand = demandByProduct.get(product.id);
    const trend = trendByProduct.get(product.id);
    return {
      ...product,
      daily_sales: demand?.average || 0,
      average_daily_sales: demand?.average || 0,
      history_days: demand?.historyDays || 0,
      trend:
        trend && trend.previous > 0
          ? ((trend.current - trend.previous) / trend.previous) * 100
          : null,
    };
  });
}

export type SupabaseOutlet = {
  id: number;
  name: string;
  code: string;
  city: string;
  active: boolean;
};

export async function listSupabaseOutlets() {
  const { data, error } = await requireClient()
    .from("outlets")
    .select("id, name, code, city, active")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data || []) as SupabaseOutlet[];
}

export type SupabaseCategory = { id: number; name: string };

export async function listSupabaseCategories() {
  const { data, error } = await requireClient()
    .from("categories")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return (data || []) as SupabaseCategory[];
}

export type ReportingDailySale = {
  outlet_id: number;
  sale_date: string;
  revenue: number;
  profit: number;
  transaction_count: number;
  units_sold: number;
};

export type ReportingTopProductDaily = {
  sale_date: string;
  product_id: number;
  product_name: string;
  qty_sold: number;
  revenue: number;
  profit: number;
};

export type ReportingCategoryDaily = {
  sale_date: string;
  category: string;
  qty_sold: number;
  revenue: number;
  profit: number;
};

export type ReportingPaymentDaily = {
  sale_date: string;
  payment_method: string;
  transaction_count: number;
  revenue: number;
};

export type SupabaseReportRange = {
  daily: ReportingDailySale[];
  topProducts: ReportingTopProductDaily[];
  categories: ReportingCategoryDaily[];
  payments: ReportingPaymentDaily[];
};

export async function getSupabaseReportRange(
  outletId: number,
  from: string,
  to: string
): Promise<SupabaseReportRange> {
  const client = requireClient();
  const [daily, topProducts, categories, payments] = await Promise.all([
    client
      .from("reporting_daily_sales")
      .select("outlet_id, sale_date, revenue, profit, transaction_count, units_sold")
      .eq("outlet_id", outletId)
      .gte("sale_date", from)
      .lte("sale_date", to)
      .order("sale_date"),
    client
      .from("reporting_top_products_daily")
      .select("sale_date, product_id, product_name, qty_sold, revenue, profit")
      .eq("outlet_id", outletId)
      .gte("sale_date", from)
      .lte("sale_date", to)
      .order("sale_date"),
    client
      .from("reporting_category_daily")
      .select("sale_date, category, qty_sold, revenue, profit")
      .eq("outlet_id", outletId)
      .gte("sale_date", from)
      .lte("sale_date", to)
      .order("sale_date"),
    client
      .from("reporting_payment_method_daily")
      .select("sale_date, payment_method, transaction_count, revenue")
      .eq("outlet_id", outletId)
      .gte("sale_date", from)
      .lte("sale_date", to)
      .order("sale_date"),
  ]);
  if (daily.error) throw daily.error;
  if (topProducts.error) throw topProducts.error;
  if (categories.error) throw categories.error;
  if (payments.error) throw payments.error;
  return {
    daily: (daily.data || []) as ReportingDailySale[],
    topProducts: (topProducts.data || []) as ReportingTopProductDaily[],
    categories: (categories.data || []) as ReportingCategoryDaily[],
    payments: (payments.data || []) as ReportingPaymentDaily[],
  };
}

export async function getSupabaseTaxRate(outletId: number) {
  const { data, error } = await requireClient().rpc("get_outlet_tax_rate", {
    p_outlet_id: outletId,
  });
  if (error) throw error;
  return Number(data || 0);
}

export async function insertSupabaseProduct(
  input: Omit<SupabaseProduct, "id" | "outlet_id" | "daily_sales" | "trend"> & {
    id?: number;
    outlet_id: number;
    daily_sales?: number;
    trend?: number | null;
  }
) {
  const client = requireClient();
  const values = {
    name: input.name,
    sku: input.sku,
    category: input.category,
    category_id: input.category_id ?? null,
    unit: input.unit,
    stock: input.stock,
    min_stock: input.min_stock,
    cost: input.cost,
    price: input.price,
    supplier: input.supplier,
    emoji: input.emoji,
    icon_name: input.icon_name,
    is_bundle: input.is_bundle,
    outlet_id: input.outlet_id,
  };
  const query = input.id
    ? client
        .from("products")
        .update(values)
        .eq("id", input.id)
        .eq("outlet_id", input.outlet_id)
    : client.from("products").insert(values);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  const { error: deleteBundleError } = await client
    .from("bundle_items")
    .delete()
    .eq("bundle_product_id", data.id);
  if (deleteBundleError) throw deleteBundleError;
  if (input.is_bundle && input.bundle_items?.length) {
    const { error: bundleError } = await client.from("bundle_items").insert(
      input.bundle_items.map(item => ({
        bundle_product_id: data.id,
        component_product_id:
          item.component_product_id ?? item.componentProductId,
        quantity: item.quantity,
      }))
    );
    if (bundleError) throw bundleError;
  }
  return data as SupabaseProduct;
}

export async function deleteSupabaseProduct(productId: number, outletId: number) {
  const { data, error } = await requireClient()
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("outlet_id", outletId)
    .select("id")
    .single();
  if (error) throw error;
  return data;
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
  cashReceived: number;
  items: Array<{
    productId: number;
    qty: number;
  }>;
}) {
  const client = requireClient();
  const transactionNumber = `KBP-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const { data, error } = await client.rpc("create_pos_sale", {
    p_outlet_id: input.outletId,
    p_transaction_number: transactionNumber,
    p_payment_method: input.paymentMethod,
    p_cash_received: input.cashReceived,
    p_items: input.items.map(item => ({
      productId: item.productId,
      qty: item.qty,
    })),
  });
  if (error) throw error;
  if (
    !data ||
    typeof data.transaction_number !== "string" ||
    typeof data.subtotal !== "number" ||
    typeof data.tax !== "number" ||
    typeof data.total !== "number"
  ) {
    throw new Error("Supabase returned an invalid sale receipt.");
  }
  return {
    transactionNumber: data.transaction_number,
    subtotal: data.subtotal,
    tax: data.tax,
    total: data.total,
    provider: "supabase" as const,
  };
}

export type SupabaseSupplier = {
  id: number;
  name: string;
  contact: string;
  phone: string;
  lead_time_days: number;
  status: string;
};

export async function listSupabaseSuppliers() {
  const { data, error } = await requireClient()
    .from("suppliers")
    .select("id, name, contact, phone, lead_time_days, status")
    .order("name");
  if (error) throw error;
  return (data || []) as SupabaseSupplier[];
}

export async function insertSupabaseSupplier(input: {
  name: string;
  contact: string;
  phone: string;
  lead_time_days: number;
  status?: string;
}) {
  const { data, error } = await requireClient()
    .from("suppliers")
    .insert(input)
    .select("id, name, contact, phone, lead_time_days, status")
    .single();
  if (error) throw error;
  return data as SupabaseSupplier;
}

export async function updateSupabaseSupplier(
  supplierId: number,
  input: Omit<SupabaseSupplier, "id">
) {
  const { data, error } = await requireClient()
    .from("suppliers")
    .update(input)
    .eq("id", supplierId)
    .select("id, name, contact, phone, lead_time_days, status")
    .single();
  if (error) throw error;
  return data as SupabaseSupplier;
}

export async function deleteSupabaseSupplier(supplierId: number) {
  const { data, error } = await requireClient()
    .from("suppliers")
    .delete()
    .eq("id", supplierId)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export type SupabasePurchaseOrder = {
  id: number;
  order_number: string;
  outlet_id: number;
  supplier: string;
  product_id: number | null;
  product_name: string;
  qty: number;
  unit: string;
  unit_cost: number;
  total: number;
  reason: string;
  status: "Draft" | "Ordered" | "Received";
  created_at: string;
};

export async function listSupabasePurchaseOrders(outletId: number) {
  const { data, error } = await requireClient()
    .from("purchase_orders")
    .select(
      "id, order_number, outlet_id, supplier, product_id, product_name, qty, unit, unit_cost, total, reason, status, created_at"
    )
    .eq("outlet_id", outletId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as SupabasePurchaseOrder[];
}

export async function insertSupabasePurchaseOrder(input: {
  outlet_id: number;
  supplier: string;
  product_id: number;
  product_name: string;
  qty: number;
  unit: string;
  unit_cost: number;
  reason: string;
}) {
  const orderNumber = `PO-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const { data, error } = await requireClient()
    .from("purchase_orders")
    .insert({
      ...input,
      order_number: orderNumber,
      total: input.qty * input.unit_cost,
      status: "Draft",
    })
    .select(
      "id, order_number, outlet_id, supplier, product_id, product_name, qty, unit, unit_cost, total, reason, status, created_at"
    )
    .single();
  if (error) throw error;
  return data as SupabasePurchaseOrder;
}

export async function updateSupabasePurchaseOrderStatus(
  orderNumber: string,
  outletId: number,
  status: SupabasePurchaseOrder["status"]
) {
  const { data, error } = await requireClient()
    .from("purchase_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("order_number", orderNumber)
    .eq("outlet_id", outletId)
    .select("order_number")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSupabasePurchaseOrder(
  orderNumber: string,
  outletId: number,
  input: { supplier: string; qty: number; unit_cost: number; reason: string }
) {
  const { data, error } = await requireClient()
    .from("purchase_orders")
    .update({
      ...input,
      total: input.qty * input.unit_cost,
      updated_at: new Date().toISOString(),
    })
    .eq("order_number", orderNumber)
    .eq("outlet_id", outletId)
    .eq("status", "Draft")
    .select(
      "id, order_number, outlet_id, supplier, product_id, product_name, qty, unit, unit_cost, total, reason, status, created_at"
    )
    .single();
  if (error) throw error;
  return data as SupabasePurchaseOrder;
}

export async function deleteSupabasePurchaseOrder(
  orderNumber: string,
  outletId: number
) {
  const { data, error } = await requireClient()
    .from("purchase_orders")
    .delete()
    .eq("order_number", orderNumber)
    .eq("outlet_id", outletId)
    .eq("status", "Draft")
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function receiveSupabasePurchaseOrder(orderId: string | number) {
  const parsedOrderId = Number(orderId);
  if (!Number.isInteger(parsedOrderId))
    throw new Error("Purchase order ID must be an integer.");
  const { data, error } = await requireClient().rpc("receive_purchase_order", {
    p_order_id: parsedOrderId,
  });
  if (error) throw error;
  return data as SupabasePurchaseOrder;
}
