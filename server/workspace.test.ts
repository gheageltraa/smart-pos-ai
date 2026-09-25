import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(role: "admin" | "user" = "admin"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      openId: `${role}-test-user`,
      name: role === "admin" ? "Owner Test" : "Cashier Test",
      email: `${role}@example.com`,
      loginMethod: "test",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("workspace access", () => {
  it("returns outlet choices for an admin workspace", async () => {
    const result = await appRouter.createCaller(createContext("admin")).workspace.me();
    expect(result.user.role).toBe("admin");
    expect(result.outlets.length).toBeGreaterThanOrEqual(1);
    expect(result.outlets[0]).toMatchObject({ code: expect.any(String), city: expect.any(String) });
  });

  it("returns the payment adapter readiness contract", async () => {
    const result = await appRouter.createCaller(createContext("user")).integrations.paymentSession({ total: 125000, method: "QRIS" });
    expect(result).toMatchObject({ status: "ready", provider: "qris-adapter", total: 125000 });
  });
});
