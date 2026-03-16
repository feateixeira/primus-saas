import { Product, Sale, Client, Supplier } from "@/types/models";

// Empty data - no mock data
export const mockProducts: Product[] = [];
export const mockSalesToday: Sale[] = [];
export const mockWeeklySales: { day: string; total: number }[] = [];
export const mockPaymentBreakdown: { name: string; value: number; fill: string }[] = [];
export const mockClients: Client[] = [];
export const mockSuppliers: Supplier[] = [];
