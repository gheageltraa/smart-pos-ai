import { describe, expect, it } from "vitest";
import { adjustProductStock, createPurchaseOrder, createSale } from "./functional-db";
import { getSupabaseAdmin } from "./supabase";

describe("functional backend contracts", () => {
  it("keeps POS checkout usable in demo mode when Supabase is not configured", async () => {
    if (getSupabaseAdmin()) return;
    const result = await createSale({ outletId: 1, paymentMethod: "Tunai", subtotal: 10000, tax: 1000, total: 11000, items: [{ productId: 1, productName: "Test Coffee", qty: 1, unitPrice: 10000, unitCost: 4000 }] });
    expect(result.provider).toBe("demo");
    expect(result.total).toBe(11000);
  });

  it("returns a safe stock adjustment contract without a database", async () => {
    if (getSupabaseAdmin()) return;
    const result = await adjustProductStock(1, 1, 2);
    expect(result).toMatchObject({ id: 1, outletId: 1, amount: 2, provider: "demo" });
  });

  it("creates a draft purchase order contract", async () => {
    const result = await createPurchaseOrder({ outletId: 1, supplier: "Test Supplier", productId: 1, product: "Test Coffee", qty: 10, unit: "kg", unitCost: 100000, reason: "Forecast test" });
    expect(result.status).toBe("Draft");
    expect(result.total).toBe(1000000);
  });
});
