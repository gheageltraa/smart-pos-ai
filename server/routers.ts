import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { createOutlet, listOutlets, listProducts, upsertProduct } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDataProvider } from "./supabase";
import { adjustProductStock, createPurchaseOrder, createSale, createSupplier, listPurchaseOrders, listSuppliers, updatePurchaseOrderStatus } from "./functional-db";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  config: router({
    provider: publicProcedure.query(() => ({ provider: getDataProvider(), supabaseReady: getDataProvider() === "supabase" })),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  workspace: router({
    me: protectedProcedure.query(async ({ ctx }) => ({
      user: ctx.user,
      outlets: await listOutlets(ctx.user.id, ctx.user.role === "admin"),
    })),
    createOutlet: adminProcedure.input(z.object({ name: z.string().min(2), code: z.string().min(2).max(32), city: z.string().min(2) })).mutation(({ input }) => createOutlet({ ...input, active: 1 })),
  }),

  inventory: router({
    list: publicProcedure.input(z.object({ outletId: z.number().int().positive() })).query(({ input }) => listProducts(input.outletId)),
    upsert: publicProcedure.input(z.object({ outletId: z.number().int().positive(), name: z.string().min(2), sku: z.string().min(2), category: z.string(), unit: z.string(), stock: z.number().nonnegative(), minStock: z.number().nonnegative(), cost: z.number().nonnegative(), price: z.number().nonnegative(), supplier: z.string(), dailySales: z.number().nonnegative(), trend: z.number(), emoji: z.string(), id: z.number().int().positive().optional() })).mutation(({ input }) => upsertProduct(input)),
    adjust: publicProcedure.input(z.object({ outletId: z.number().int().positive(), productId: z.number().int().positive(), amount: z.number().int() })).mutation(({ input }) => adjustProductStock(input.outletId, input.productId, input.amount)),
  }),

  sales: router({
    create: publicProcedure.input(z.object({ outletId: z.number().int().positive(), paymentMethod: z.enum(["QRIS", "Tunai", "Debit"]), subtotal: z.number().nonnegative(), tax: z.number().nonnegative(), total: z.number().positive(), items: z.array(z.object({ productId: z.number().int().positive(), productName: z.string(), qty: z.number().positive(), unitPrice: z.number().nonnegative(), unitCost: z.number().nonnegative() })).min(1) })).mutation(({ input }) => createSale(input)),
  }),

  suppliers: router({
    list: publicProcedure.query(() => listSuppliers()),
    create: publicProcedure.input(z.object({ name: z.string().min(2), contact: z.string().min(2), phone: z.string().min(5), leadTimeDays: z.number().int().positive(), status: z.enum(["Aktif", "Review", "Nonaktif"]) })).mutation(({ input }) => createSupplier(input)),
  }),

  orders: router({
    list: publicProcedure.input(z.object({ outletId: z.number().int().positive() })).query(({ input }) => listPurchaseOrders(input.outletId)),
    create: publicProcedure.input(z.object({ outletId: z.number().int().positive(), supplier: z.string().min(2), productId: z.number().int().positive(), product: z.string().min(2), qty: z.number().positive(), unit: z.string().min(1), unitCost: z.number().nonnegative(), reason: z.string().min(2) })).mutation(({ input }) => createPurchaseOrder(input)),
    updateStatus: publicProcedure.input(z.object({ id: z.union([z.number().int().positive(), z.string().min(2)]), status: z.enum(["Draft", "Ordered", "Received"]) })).mutation(({ input }) => updatePurchaseOrderStatus(input.id, input.status)),
  }),

  forecast: router({
    explain: publicProcedure.input(z.object({ product: z.string(), unit: z.string(), stock: z.number().nonnegative(), dailySales: z.number().positive(), trend: z.number(), supplier: z.string(), leadTimeDays: z.number().int().positive() })).mutation(async ({ input }) => {
      try {
        const result = await invokeLLM({
          model: "gpt-5-nano",
          maxTokens: 180,
          reasoning: { effort: "minimal" },
          messages: [
            { role: "system", content: "You are a concise Indonesian inventory analyst. Return one actionable sentence and one short reason. Do not invent numbers." },
            { role: "user", content: `Analisis ${input.product}. Stok ${input.stock} ${input.unit}, rata-rata penjualan ${input.dailySales} ${input.unit}/hari, tren ${input.trend}%, supplier ${input.supplier}, lead time ${input.leadTimeDays} hari. Jelaskan risiko dan tindakan.` },
          ],
        });
        const content = result.choices[0]?.message?.content;
        const text = typeof content === "string" ? content : "Forecast AI belum tersedia; gunakan estimasi historis sebagai fallback.";
        return { text, model: result.model, source: "built-in-llm" as const };
      } catch {
        return { text: "Forecast AI belum tersedia; gunakan estimasi historical sales sebagai fallback.", model: "fallback", source: "fallback" as const };
      }
    }),
  }),

  integrations: router({
    paymentSession: protectedProcedure.input(z.object({ total: z.number().positive(), method: z.enum(["QRIS", "Tunai", "Debit"]) })).mutation(({ input }) => ({ status: "ready" as const, provider: input.method === "QRIS" ? "qris-adapter" : "cashier-adapter", total: input.total, message: "Payment adapter siap dihubungkan ke provider pilihan Anda." })),
    barcodeLookup: publicProcedure.input(z.object({ code: z.string().min(3) })).query(({ input }) => ({ code: input.code, status: "ready" as const, message: "Barcode gateway siap menerima scanner USB/Bluetooth." })),
  }),
});

export type AppRouter = typeof appRouter;
