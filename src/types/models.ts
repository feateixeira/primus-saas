export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  brand: string;
  costPrice: number;
  salePrice: number;
  margin: number;
  stock: number;
  minStock: number;
  unit: "unidade" | "caixa" | "pacote";
}

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Payment {
  method: "dinheiro" | "pix" | "debito" | "credito";
  amount: number;
}

export interface Sale {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  payments: Payment[];
  date: string;
  status: "completed" | "cancelled";
  clientId?: string;
}

export interface CashRegister {
  id: string;
  openedAt: string;
  closedAt?: string;
  initialAmount: number;
  sales: Sale[];
  withdrawals: { amount: number; reason: string; date: string }[];
  deposits: { amount: number; reason: string; date: string }[];
  status: "open" | "closed";
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  notes: string;
  totalPurchases: number;
  pendingCredit: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  contact: string;
  notes: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: "entrada" | "saida" | "ajuste";
  quantity: number;
  date: string;
  reason: string;
}
