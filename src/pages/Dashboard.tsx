import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, ShoppingCart, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({
    revenue: 0,
    salesCount: 0,
    avgTicket: 0,
    profit: 0,
  });
  const [lowStock, setLowStock] = useState<{ id: string; name: string; stock: number; minStock: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const [{ data: sales }, { data: items }, { data: products }] = await Promise.all([
      supabase
        .from("sales")
        .select("id,total")
        .eq("status", "completed")
        .gte("date", start)
        .lt("date", end),
      supabase
        .from("sale_items")
        .select("name,quantity,unit_price,cost_price,sale_id"),
      supabase
        .from("products")
        .select("id,name,stock,min_stock")
        .order("name", { ascending: true }),
    ]);

    const salesToday = (sales ?? []).map((s) => ({ id: s.id, total: Number(s.total ?? 0) }));
    const revenue = salesToday.reduce((a, s) => a + s.total, 0);
    const salesCount = salesToday.length;
    const avgTicket = salesCount > 0 ? revenue / salesCount : 0;

    const saleIds = new Set(salesToday.map((s) => s.id));
    const itemsToday = (items ?? []).filter((it) => saleIds.has(it.sale_id));
    const profit = itemsToday.reduce((a, it) => {
      const qty = Number(it.quantity ?? 0);
      const unit = Number(it.unit_price ?? 0);
      const cost = Number(it.cost_price ?? 0);
      return a + (unit - cost) * qty;
    }, 0);

    // Se min_stock = 0 (default), não deve considerar como "estoque baixo"
    const low = (products ?? [])
      .filter((p) => (p.min_stock ?? 0) > 0 && (p.stock ?? 0) <= (p.min_stock ?? 0))
      .map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0, minStock: p.min_stock ?? 0 }));

    const byProduct = new Map<string, number>();
    for (const it of itemsToday) {
      byProduct.set(it.name, (byProduct.get(it.name) ?? 0) + Number(it.quantity ?? 0));
    }
    const top = [...byProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, qty]) => ({ name, qty }));

    setKpi({ revenue, salesCount, avgTicket, profit });
    setLowStock(low);
    setTopProducts(top);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel("realtime:dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "sale_items" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_movements" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const kpis = useMemo(
    () => [
      { label: "Faturamento do Dia", value: loading ? "..." : `R$ ${kpi.revenue.toFixed(2)}`, icon: DollarSign },
      { label: "Vendas do Dia", value: loading ? "..." : String(kpi.salesCount), icon: ShoppingCart },
      { label: "Ticket Médio", value: loading ? "..." : `R$ ${kpi.avgTicket.toFixed(2)}`, icon: TrendingUp },
      { label: "Lucro Estimado", value: loading ? "..." : `R$ ${kpi.profit.toFixed(2)}`, icon: DollarSign },
    ],
    [kpi, loading]
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do negócio</p>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <motion.div key={kpi.label} variants={item} className="bg-card rounded-xl shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="font-mono-tabular text-2xl font-semibold text-foreground">{kpi.value}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div variants={item} className="bg-card rounded-xl shadow-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Produtos Mais Vendidos ({topProducts.length})
            </h2>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-auto pr-1">
                {topProducts.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-3">{p.name}</span>
                    <span className="font-mono-tabular text-foreground">{p.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div variants={item} className="bg-card rounded-xl shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h2 className="text-sm font-semibold text-foreground">
                Estoque Baixo ({lowStock.length})
              </h2>
            </div>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto com estoque baixo.</p>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-auto pr-1">
                {lowStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-3">{p.name}</span>
                    <span className="font-mono-tabular text-foreground">
                      {p.stock}/{p.minStock}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
