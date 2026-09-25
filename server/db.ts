import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertOutlet, InsertUser, OutletMember, outlets, outletMembers, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

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
  const db = await getDb();
  if (!db) return { ...outlet, id: Date.now() };
  const result = await db.insert(outlets).values(outlet);
  return { ...outlet, id: Number(result[0].insertId) };
}

export type OutletAccess = Pick<OutletMember, "outletId" | "role">;
