import { describe, expect, it } from "vitest";
import {
  addBundleDemand,
  calculateForecast,
  calculatePercentChange,
  calculateProfit,
} from "./analytics";

describe("sales analytics", () => {
  it("calculates gross profit from the sold line and captured cost", () => {
    expect(calculateProfit(30_000, 8_000, 2)).toBe(14_000);
  });

  it("omits a trend when there is no previous-period baseline", () => {
    expect(calculatePercentChange(12, 0)).toBeNull();
    expect(calculatePercentChange(12, 6)).toBe(100);
  });

  it("adds bundle sales to component demand without replacing parent sales", () => {
    const demand = addBundleDemand(
      [
        { productId: 1, averageDailySales: 2 },
        { productId: 10, averageDailySales: 1 },
      ],
      [
        {
          productId: 10,
          averageDailySales: 1,
          components: [
            { componentProductId: 1, quantity: 2 },
            { componentProductId: 2, quantity: 1 },
          ],
        },
      ]
    );
    expect(demand.get(1)).toBe(4);
    expect(demand.get(2)).toBe(1);
    expect(demand.get(10)).toBe(1);
  });

  it("predicts stockout, risk, and reorder quantity from real demand inputs", () => {
    const forecast = calculateForecast(
      10,
      4,
      2,
      3,
      new Date("2025-01-01T00:00:00.000Z")
    );
    expect(forecast.coverageDays).toBe(5);
    expect(forecast.stockoutDate?.toISOString()).toBe(
      "2025-01-06T00:00:00.000Z"
    );
    expect(forecast.risk).toBe("Medium");
    expect(forecast.reorderQuantity).toBe(14);
  });
});
