export function quickCashOptions(total: number) {
  return [
    { label: "Uang Pas", value: total },
    { label: "Rp 50.000", value: 50000 },
    { label: "Rp 100.000", value: 100000 },
  ];
}

export function calculateChange(total: number, cashReceived: number) {
  return Math.max(0, cashReceived - total);
}

export function canAddToCart(stock: number, currentQty: number) {
  return stock > 0 && currentQty < stock;
}
