import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Period = "hoje" | "semana" | "mes";

export default function Relatorios() {
  const [period, setPeriod] = useState<Period>("semana");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ revenue: 0, salesCount: 0, profit: 0 });

  const range = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === "hoje") {
      return { start: startOfDay, end: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000) };
    }
    if (period === "semana") {
      const start = new Date(startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000);
      return { start, end: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000) };
    }
    // mês (últimos 30 dias)
    const start = new Date(startOfDay.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { start, end: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000) };
  }, [period]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const start = range.start.toISOString();
    const end = range.end.toISOString();

    const { data: sales } = await supabase
      .from("sales")
      .select("id,total")
      .eq("status", "completed")
      .gte("date", start)
      .lt("date", end);

    const salesList = (sales ?? []).map((s) => ({ id: s.id, total: Number(s.total ?? 0) }));
    const revenue = salesList.reduce((a, s) => a + s.total, 0);
    const salesCount = salesList.length;

    const saleIds = new Set(salesList.map((s) => s.id));
    const saleIdArray = Array.from(saleIds);

    let itemsInRange: any[] = [];
    if (saleIdArray.length > 0) {
      const { data: items } = await supabase
        .from("sale_items")
        .select("quantity,unit_price,cost_price,sale_id")
        .in("sale_id", saleIdArray);
      itemsInRange = items ?? [];
    }

    const totalCost = itemsInRange.reduce((a, it) => {
      const qty = Number(it.quantity ?? 0);
      const cost = Number(it.cost_price ?? 0);
      return a + cost * qty;
    }, 0);
    
    // Lucro real = Faturamento (vendas com descontos já aplicados) - Custo (soma de todos os produtos vendidos)
    const profit = revenue - totalCost;

    setSummary({ revenue, salesCount, profit });
    setLoading(false);
  }, [range.end, range.start]);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel("realtime:reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "sale_items" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_movements" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [period, refresh]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise de desempenho</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["hoje", "semana", "mes"] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`h-8 px-3 rounded-md text-xs font-medium transition-fast ${period === p ? "bg-card shadow-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl shadow-card p-5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Faturamento</span>
          <div className="font-mono-tabular text-2xl font-semibold text-foreground mt-2">
            {loading ? "..." : `R$ ${summary.revenue.toFixed(2)}`}
          </div>
        </div>
        <div className="bg-card rounded-xl shadow-card p-5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendas</span>
          <div className="font-mono-tabular text-2xl font-semibold text-foreground mt-2">
            {loading ? "..." : String(summary.salesCount)}
          </div>
        </div>
        <div className="bg-card rounded-xl shadow-card p-5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lucro Estimado</span>
          <div className="font-mono-tabular text-2xl font-semibold text-success mt-2">
            {loading ? "..." : `R$ ${summary.profit.toFixed(2)}`}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card p-12 text-center">
        {summary.salesCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum dado de venda registrado ainda. Os relatórios serão gerados automaticamente conforme as vendas forem realizadas.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Relatório atualizado em tempo real a partir do banco de dados.
          </p>
        )}
      </div>
    </div>
  );
}
