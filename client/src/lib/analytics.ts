export type BundleComponent = {
  componentProductId: number;
  quantity: number;
};

export type ProductDemand = {
  productId: number;
  averageDailySales: number;
};

export type Forecast = {
  averageDailySales: number;
  coverageDays: number | null;
  stockoutDate: Date | null;
  risk: "High" | "Medium" | "Safe";
  reorderQuantity: number;
};

export function calculateProfit(lineTotal: number, unitCost: number, qty: number) {
  return lineTotal - unitCost * qty;
}

export function calculatePercentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function addBundleDemand(
  directDemand: ProductDemand[],
  bundles: Array<{
    productId: number;
    averageDailySales: number;
    components: BundleComponent[];
  }>
) {
  const totals = new Map<number, number>();
  for (const demand of directDemand) {
    totals.set(
      demand.productId,
      (totals.get(demand.productId) || 0) + demand.averageDailySales
    );
  }
  for (const bundle of bundles) {
    for (const component of bundle.components) {
      totals.set(
        component.componentProductId,
        (totals.get(component.componentProductId) || 0) +
          bundle.averageDailySales * component.quantity
      );
    }
  }
  return totals;
}

export function calculateForecast(
  stock: number,
  minStock: number,
  averageDailySales: number,
  leadTimeDays: number,
  now: Date = new Date()
): Forecast {
  const average = Math.max(0, averageDailySales);
  const coverageDays = average > 0 ? stock / average : null;
  const stockoutDate =
    coverageDays === null
      ? null
      : new Date(now.getTime() + Math.ceil(coverageDays) * 24 * 60 * 60 * 1000);
  const risk =
    stock <= 0 || (coverageDays !== null && coverageDays <= leadTimeDays)
      ? "High"
      : stock <= minStock ||
          (coverageDays !== null && coverageDays <= leadTimeDays + 7)
        ? "Medium"
        : "Safe";
  const reorderQuantity =
    average > 0
      ? Math.max(
          0,
          Math.ceil(average * (leadTimeDays + 7) + minStock - stock)
        )
      : Math.max(0, minStock - stock);
  return {
    averageDailySales: average,
    coverageDays,
    stockoutDate,
    risk,
    reorderQuantity,
  };
}
