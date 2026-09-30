import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertOutlet, InsertUser, OutletMember, outlets, outletMembers, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getSupabaseAdmin } from "./supabase";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("app_users").upsert({
      open_id: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      last_signed_in: (user.lastSignedIn ?? new Date()).toISOString(),
    }, { onConflict: "open_id" });
    if (error) throw error;
    return;
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase.from("app_users").select("*").eq("open_id", openId).maybeSingle();
    if (error) throw error;
    return data ? {
      id: Number(data.id), openId: data.open_id, name: data.name, email: data.email,
      loginMethod: "supabase", role: data.role, createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at), lastSignedIn: new Date(data.last_signed_in),
    } : undefined;
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

const fallbackOutlets = [
  { id: 1, name: "Kedai Bumi", code: "KB-01", city: "Jakarta Selatan", active: 1 },
  { id: 2, name: "Kedai Bumi — Senopati", code: "KB-02", city: "Jakarta Selatan", active: 1 },
  { id: 3, name: "Kedai Bumi — Bandung", code: "KB-03", city: "Bandung", active: 1 },
];

export async function listOutlets(userId?: number, isAdmin = false) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const query = supabase.from("outlets").select("id,name,code,city,active").eq("active", true).order("id");
    const { data, error } = await query;
    if (!error && data?.length) return data.map(outlet => ({ ...outlet, id: Number(outlet.id), active: outlet.active ? 1 : 0 }));
    if (error) console.warn("[Supabase] listOutlets failed:", error.message);
    return fallbackOutlets;
  }
  const db = await getDb();
  if (!db) return fallbackOutlets;
  try {
    if (isAdmin || !userId) {
      const rows = await db.select().from(outlets).where(eq(outlets.active, 1));
      return rows.length ? rows : fallbackOutlets;
    }
    const rows = await db.select({ id: outlets.id, name: outlets.name, code: outlets.code, city: outlets.city, active: outlets.active })
      .from(outlets)
      .innerJoin(outletMembers, eq(outletMembers.outletId, outlets.id))
      .where(and(eq(outletMembers.userId, userId), eq(outlets.active, 1)));
    return rows.length ? rows : fallbackOutlets.slice(0, 1);
  } catch {
    return fallbackOutlets;
  }
}

export async function createOutlet(outlet: InsertOutlet) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase.from("outlets").insert({ name: outlet.name, code: outlet.code, city: outlet.city, active: Boolean(outlet.active ?? 1) }).select("id,name,code,city,active").single();
    if (error) throw error;
    return { ...data, id: Number(data.id), active: data.active ? 1 : 0 };
  }
  const db = await getDb();
  if (!db) return { ...outlet, id: Date.now() };
  const result = await db.insert(outlets).values(outlet);
  return { ...outlet, id: Number(result[0].insertId) };
}

export type OutletAccess = Pick<OutletMember, "outletId" | "role">;

export type ProductRecord = {
  id: number;
  outletId: number;
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

export async function listProducts(outletId: number): Promise<ProductRecord[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase.from("products").select("*").eq("outlet_id", outletId).order("name");
  if (error) throw error;
  return (data ?? []).map(product => ({
    id: Number(product.id), outletId: Number(product.outlet_id), name: product.name, sku: product.sku,
    category: product.category, unit: product.unit, stock: Number(product.stock), minStock: Number(product.min_stock),
    cost: Number(product.cost), price: Number(product.price), supplier: product.supplier,
    dailySales: Number(product.daily_sales), trend: Number(product.trend), emoji: product.emoji,
  }));
}

export async function upsertProduct(product: Omit<ProductRecord, "id"> & { id?: number }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return product;
  const payload = {
    ...(product.id ? { id: product.id } : {}), outlet_id: product.outletId, name: product.name, sku: product.sku,
    category: product.category, unit: product.unit, stock: product.stock, min_stock: product.minStock,
    cost: product.cost, price: product.price, supplier: product.supplier, daily_sales: product.dailySales,
    trend: product.trend, emoji: product.emoji,
  };
  const { data, error } = await supabase.from("products").upsert(payload, { onConflict: "outlet_id,sku" }).select("*").single();
  if (error) throw error;
  return data;
}
