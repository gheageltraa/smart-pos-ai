export type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
  categoryId: number | null;
  unit: string;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
  supplier: string;
  supplierLeadTimeDays: number | null;
  dailySales: number;
  historyDays: number;
  trend: number | null;
  emoji: string;
  iconName: string | null;
  isBundle?: boolean;
  bundleItems?: Array<{ componentProductId: number; quantity: number }>;
};

export type PurchaseOrder = {
  dbId: number;
  id: string;
  supplier: string;
  product: string;
  qty: number;
  unit: string;
  unitCost: number;
  total: number;
  reason: string;
  status: "Draft" | "Ordered" | "Received";
  created: string;
};
