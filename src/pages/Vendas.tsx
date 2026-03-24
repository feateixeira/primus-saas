import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Filter, Receipt } from "lucide-react";

type PaymentMethodKey = "dinheiro" | "pix" | "debito" | "credito" | "todos";

const METHOD_LABELS: Record<Exclude<PaymentMethodKey, "todos">, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Débito",
  credito: "Crédito",
};

interface SalePayment {
  method: string;
  amount: number;
}

interface SaleDisplay {
  id: string;
  date: string;
  total: number;
  cashRegisterId: string | null;
  payments: SalePayment[];
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

export default function Vendas() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleDisplay[]>([]);
  const [registers, setRegisters] = useState<{ id: string; opened_at: string; status: string }[]>([]);

  const [dateFrom, setDateFrom] = useState(() => {
    const t = new Date();
    return startOfDay(t).toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const t = new Date();
    return startOfDay(t).toISOString().slice(0, 10);
  });
  const [cashRegisterFilter, setCashRegisterFilter] = useState<string>("todos");
  const [methodFilter, setMethodFilter] = useState<PaymentMethodKey>("todos");

  const loadRegisters = useCallback(async () => {
    const { data } = await supabase
      .from("cash_registers")
      .select("id, opened_at, status")
      .order("opened_at", { ascending: false });
    setRegisters(data ?? []);
  }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    const from = startOfDay(new Date(dateFrom + "T12:00:00"));
    const to = endOfDay(new Date(dateTo + "T12:00:00"));

    let q = supabase
      .from("sales")
      .select("id, date, total, cash_register_id, status")
      .eq("status", "completed")
      .gte("date", from.toISOString())
      .lt("date", to.toISOString())
      .order("date", { ascending: false });

    if (cashRegisterFilter !== "todos") {
      q = q.eq("cash_register_id", cashRegisterFilter);
    }

    const { data: salesRows, error: salesError } = await q;

    if (salesError) {
      toast.error("Erro ao carregar vendas");
      setLoading(false);
      return;
    }

    const list = salesRows ?? [];
    if (list.length === 0) {
      setSales([]);
      setLoading(false);
      return;
    }

    const saleIds = list.map((s) => s.id);

    const { data: movs, error: movError } = await supabase
      .from("cash_movements")
      .select("sale_id, payment_method, amount")
      .eq("type", "sale")
      .in("sale_id", saleIds);

    if (movError) {
      toast.error("Erro ao carregar pagamentos das vendas");
      setLoading(false);
      return;
    }

    const bySale = new Map<string, SalePayment[]>();
    for (const m of movs ?? []) {
      if (!m.sale_id) continue;
      const method = (m.payment_method as string) ?? "dinheiro";
      const amt = Number(m.amount ?? 0);
      if (amt <= 0) continue;
      const arr = bySale.get(m.sale_id) ?? [];
      arr.push({ method, amount: amt });
      bySale.set(m.sale_id, arr);
    }

    const mapped: SaleDisplay[] = list.map((s) => ({
      id: s.id,
      date: s.date,
      total: Number(s.total ?? 0),
      cashRegisterId: s.cash_register_id,
      payments: bySale.get(s.id) ?? [],
    }));

    setSales(mapped);
    setLoading(false);
  }, [dateFrom, dateTo, cashRegisterFilter]);

  useEffect(() => {
    loadRegisters();
  }, [loadRegisters]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  useEffect(() => {
    const channel = supabase
      .channel("realtime:vendas")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => loadSales())
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_movements" }, () => loadSales())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSales]);

  const totalsByMethod = useMemo(() => {
    const acc: Record<string, number> = {
      dinheiro: 0,
      pix: 0,
      debito: 0,
      credito: 0,
    };
    for (const s of sales) {
      for (const p of s.payments) {
        const k = p.method as keyof typeof acc;
        if (k in acc) acc[k] += p.amount;
      }
    }
    return acc;
  }, [sales]);

  const totalGeral = useMemo(() => sales.reduce((a, s) => a + s.total, 0), [sales]);

  const filteredSales = useMemo(() => {
    if (methodFilter === "todos") return sales;
    return sales.filter((s) =>
      s.payments.some((p) => p.method === methodFilter && p.amount > 0)
    );
  }, [sales, methodFilter]);

  const totalLista = useMemo(
    () => filteredSales.reduce((a, s) => a + s.total, 0),
    [filteredSales]
  );

  const setToday = () => {
    const t = new Date();
    const d = startOfDay(t).toISOString().slice(0, 10);
    setDateFrom(d);
    setDateTo(d);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Vendas
          </h1>
          <p className="text-sm text-muted-foreground">
            Conferência de vendas e formas de pagamento (conferência de caixa)
          </p>
        </div>
        <button
          type="button"
          onClick={setToday}
          className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-fast flex items-center gap-2 self-start"
        >
          <Calendar className="h-4 w-4" />
          Hoje
        </button>
      </div>

      <div className="bg-card rounded-xl shadow-card p-4 mb-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="h-4 w-4" />
          Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data final</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Caixa</label>
            <select
              value={cashRegisterFilter}
              onChange={(e) => setCashRegisterFilter(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground"
            >
              <option value="todos">Todos os caixas</option>
              {registers.map((r) => (
                <option key={r.id} value={r.id}>
                  {new Date(r.opened_at).toLocaleString()} ({r.status === "open" ? "aberto" : "fechado"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Forma de pagamento (lista)</label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as PaymentMethodKey)}
              className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground"
            >
              <option value="todos">Todas</option>
              {(Object.keys(METHOD_LABELS) as Exclude<PaymentMethodKey, "todos">[]).map((k) => (
                <option key={k} value={k}>
                  {METHOD_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-card rounded-xl shadow-card p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Total período</span>
          <div className="font-mono-tabular text-lg font-semibold text-foreground mt-1">
            {loading ? "…" : `R$ ${totalGeral.toFixed(2)}`}
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {sales.length} venda(s) · lista: {filteredSales.length}
            {methodFilter !== "todos" && !loading && (
              <span className="block mt-0.5">Soma lista: R$ {totalLista.toFixed(2)}</span>
            )}
          </span>
        </div>
        {(Object.keys(METHOD_LABELS) as Exclude<PaymentMethodKey, "todos">[]).map((k) => (
          <div key={k} className="bg-card rounded-xl shadow-card p-4">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">{METHOD_LABELS[k]}</span>
            <div className="font-mono-tabular text-lg font-semibold text-foreground mt-1">
              {loading ? "…" : `R$ ${totalsByMethod[k].toFixed(2)}`}
            </div>
            <span className="text-[10px] text-muted-foreground">Soma no período (todas as vendas)</span>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Lista de vendas ({filteredSales.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Valores por método vêm dos lançamentos de caixa vinculados à venda.
          </p>
        </div>
        <div className="overflow-x-auto max-h-[min(60vh,560px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-[1] border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Data/Hora</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">ID</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Pagamentos</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Caixa</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma venda no período/filtro selecionado.
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => (
                  <tr key={s.id} className="border-b border-border hover:bg-muted/40">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(s.date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-xs text-muted-foreground">
                      {s.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-medium">
                      R$ {s.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {s.payments.length === 0 ? (
                        <span className="text-xs text-warning">Sem lançamento de pagamento</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {s.payments.map((p, i) => (
                            <span
                              key={`${s.id}-${i}`}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-muted font-mono-tabular"
                            >
                              {METHOD_LABELS[p.method as Exclude<PaymentMethodKey, "todos">] ?? p.method}: R${" "}
                              {p.amount.toFixed(2)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono-tabular text-muted-foreground">
                      {s.cashRegisterId ? s.cashRegisterId.slice(0, 8) + "…" : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
