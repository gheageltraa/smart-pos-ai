import { describe, expect, it } from "vitest";
import { calculateChange, canAddToCart, quickCashOptions } from "../shared/pos";

describe("POS payment helpers", () => {
  it("creates the requested quick cash options", () => {
    expect(quickCashOptions(38500)).toEqual([
      { label: "Uang Pas", value: 38500 },
      { label: "Rp 50.000", value: 50000 },
      { label: "Rp 100.000", value: 100000 },
    ]);
  });

  it("calculates change without returning a negative amount", () => {
    expect(calculateChange(38500, 50000)).toBe(11500);
    expect(calculateChange(38500, 20000)).toBe(0);
  });

  it("prevents adding beyond available stock", () => {
    expect(canAddToCart(2, 0)).toBe(true);
    expect(canAddToCart(2, 2)).toBe(false);
    expect(canAddToCart(0, 0)).toBe(false);
  });
});
