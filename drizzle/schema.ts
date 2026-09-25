import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const outlets = mysqlTable("outlets", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  city: varchar("city", { length: 96 }).notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const outletMembers = mysqlTable("outletMembers", {
  id: int("id").autoincrement().primaryKey(),
  outletId: int("outletId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["manager", "cashier"]).default("cashier").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  membershipUnique: uniqueIndex("outlet_member_unique").on(table.outletId, table.userId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Outlet = typeof outlets.$inferSelect;
export type InsertOutlet = typeof outlets.$inferInsert;
export type OutletMember = typeof outletMembers.$inferSelect;
export type InsertOutletMember = typeof outletMembers.$inferInsert;
