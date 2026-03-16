import { useEffect, useMemo, useState } from "react";
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Lock, Unlock, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Caixa() {
  const [isOpen, setIsOpen] = useState(false);
  const [cashRegisterId, setCashRegisterId] = useState<string | null>(null);
  const [registers, setRegisters] = useState<{ id: string; opened_at: string; closed_at: string | null; status: string }[]>([]);
  const [initialAmount, setInitialAmount] = useState(0);
  const [withdrawals, setWithdrawals] = useState<{ amount: number; reason: string }[]>([]);
  const [deposits, setDeposits] = useState<{ amount: number; reason: string }[]>([]);
  const [showDialog, setShowDialog] = useState<"open" | "sangria" | "suprimento" | "close" | null>(null);
  const [dialogAmount, setDialogAmount] = useState(0);
  const [dialogReason, setDialogReason] = useState("");
  const [salesTotals, setSalesTotals] = useState({
    totalSales: 0,
    totalCash: 0,
    totalPix: 0,
    totalDebit: 0,
    totalCredit: 0,
  });
  const [viewDetails, setViewDetails] = useState<{
    id: string;
    openedAt: string;
    closedAt: string | null;
    initialAmount: number;
    totalSales: number;
    totalCash: number;
    totalPix: number;
    totalDebit: number;
    totalCredit: number;
    withdrawals: { amount: number; reason: string }[];
    deposits: { amount: number; reason: string }[];
  } | null>(null);

  const totalWithdrawals = withdrawals.reduce((a, w) => a + w.amount, 0);
  const totalDeposits = deposits.reduce((a, d) => a + d.amount, 0);
  const expectedCash = initialAmount + salesTotals.totalCash + totalDeposits - totalWithdrawals;

  const refresh = async (id: string) => {
    const [{ data: reg }, { data: movs }, { data: sales }] = await Promise.all([
      supabase.from("cash_registers").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("cash_movements")
        .select("type, amount, reason, payment_method")
        .eq("cash_register_id", id),
      supabase
        .from("sales")
        .select("total")
        .eq("cash_register_id", id)
        .eq("status", "completed"),
    ]);

    if (reg) {
      setIsOpen(reg.status === "open");
      setCashRegisterId(reg.id);
      setInitialAmount(Number(reg.initial_amount ?? 0));
    }

    const withdrawalsList =
      (movs ?? [])
        .filter((m) => m.type === "withdrawal")
        .map((m) => ({ amount: Number(m.amount ?? 0), reason: m.reason ?? "" })) ?? [];
    const depositsList =
      (movs ?? [])
        .filter((m) => m.type === "deposit")
        .map((m) => ({ amount: Number(m.amount ?? 0), reason: m.reason ?? "" })) ?? [];
    setWithdrawals(withdrawalsList);
    setDeposits(depositsList);

    const totalSales = (sales ?? []).reduce((a, s) => a + Number(s.total ?? 0), 0);
    const payment = (movs ?? []).filter((m) => m.type === "sale");
    const totalCash = payment
      .filter((m) => m.payment_method === "dinheiro")
      .reduce((a, m) => a + Number(m.amount ?? 0), 0);
    const totalPix = payment
      .filter((m) => m.payment_method === "pix")
      .reduce((a, m) => a + Number(m.amount ?? 0), 0);
    const totalDebit = payment
      .filter((m) => m.payment_method === "debito")
      .reduce((a, m) => a + Number(m.amount ?? 0), 0);
    const totalCredit = payment
      .filter((m) => m.payment_method === "credito")
      .reduce((a, m) => a + Number(m.amount ?? 0), 0);

    setSalesTotals({ totalSales, totalCash, totalPix, totalDebit, totalCredit });
  };

  const loadRegisterDetails = async (id: string) => {
    const [{ data: reg }, { data: movs }, { data: sales }] = await Promise.all([
      supabase
        .from("cash_registers")
        .select("id, opened_at, closed_at, initial_amount")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("cash_movements")
        .select("type, amount, reason, payment_method")
        .eq("cash_register_id", id),
      supabase
        .from("sales")
        .select("total")
        .eq("cash_register_id", id)
        .eq("status", "completed"),
    ]);

    if (!reg) return;

    const withdrawalsList =
      (movs ?? [])
        .filter((m) => m.type === "withdrawal")
        .map((m) => ({ amount: Number(m.amount ?? 0), reason: m.reason ?? "" })) ?? [];
    const depositsList =
      (movs ?? [])
        .filter((m) => m.type === "deposit")
        .map((m) => ({ amount: Number(m.amount ?? 0), reason: m.reason ?? "" })) ?? [];

    const totalSales = (sales ?? []).reduce((a, s) => a + Number(s.total ?? 0), 0);
    const payment = (movs ?? []).filter((m) => m.type === "sale");
    const totalCash = payment
      .filter((m) => m.payment_method === "dinheiro")
      .reduce((a, m) => a + Number(m.amount ?? 0), 0);
    const totalPix = payment
      .filter((m) => m.payment_method === "pix")
      .reduce((a, m) => a + Number(m.amount ?? 0), 0);
    const totalDebit = payment
      .filter((m) => m.payment_method === "debito")
      .reduce((a, m) => a + Number(m.amount ?? 0), 0);
    const totalCredit = payment
      .filter((m) => m.payment_method === "credito")
      .reduce((a, m) => a + Number(m.amount ?? 0), 0);

    setViewDetails({
      id: reg.id,
      openedAt: reg.opened_at,
      closedAt: reg.closed_at,
      initialAmount: Number(reg.initial_amount ?? 0),
      totalSales,
      totalCash,
      totalPix,
      totalDebit,
      totalCredit,
      withdrawals: withdrawalsList,
      deposits: depositsList,
    });
  };

  const loadCurrent = async () => {
    const { data } = await supabase
      .from("cash_registers")
      .select("id, opened_at, closed_at, status, initial_amount")
      .order("opened_at", { ascending: false });

    setRegisters(data ?? []);

    const open = (data ?? []).find((r) => r.status === "open");
    if (!open) {
      setIsOpen(false);
      setCashRegisterId(null);
      setInitialAmount(0);
      setWithdrawals([]);
      setDeposits([]);
      setSalesTotals({ totalSales: 0, totalCash: 0, totalPix: 0, totalDebit: 0, totalCredit: 0 });
      return;
    }

    await refresh(open.id);
  };

  useEffect(() => {
    loadCurrent();

    const channel = supabase
      .channel("realtime:caixa")
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_registers" }, () => {
        loadCurrent();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_movements" }, () => {
        if (cashRegisterId) refresh(cashRegisterId);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => {
        if (cashRegisterId) refresh(cashRegisterId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashRegisterId]);

  const openCaixa = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("cash_registers")
      .insert({
        initial_amount: dialogAmount,
        status: "open",
        created_by: auth.user?.id ?? null,
      })
      .select("id, initial_amount")
      .single();

    if (error) {
      toast.error("Erro ao abrir caixa");
      return;
    }

    setIsOpen(true);
    setCashRegisterId(data.id);
    setInitialAmount(Number(data.initial_amount ?? 0));
    setShowDialog(null);
    setDialogAmount(0);
    toast.success("Caixa aberto");
  };

  const addSangria = async () => {
    if (!cashRegisterId) return;
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("cash_movements").insert({
      cash_register_id: cashRegisterId,
      type: "withdrawal",
      amount: dialogAmount,
      reason: dialogReason || null,
      created_by: auth.user?.id ?? null,
    });

    if (error) {
      toast.error("Erro ao registrar sangria");
      return;
    }

    setShowDialog(null);
    setDialogAmount(0);
    setDialogReason("");
    toast.success("Sangria registrada");
  };

  const addSuprimento = async () => {
    if (!cashRegisterId) return;
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("cash_movements").insert({
      cash_register_id: cashRegisterId,
      type: "deposit",
      amount: dialogAmount,
      reason: dialogReason || null,
      created_by: auth.user?.id ?? null,
    });

    if (error) {
      toast.error("Erro ao registrar suprimento");
      return;
    }

    setShowDialog(null);
    setDialogAmount(0);
    setDialogReason("");
    toast.success("Suprimento registrado");
  };

  const closeCaixa = async () => {
    if (!cashRegisterId) return;
    const { error } = await supabase
      .from("cash_registers")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", cashRegisterId);

    if (error) {
      toast.error("Erro ao fechar caixa");
      return;
    }

    setIsOpen(false);
    setCashRegisterId(null);
    setShowDialog(null);
    toast.success("Caixa fechado com sucesso");
  };

  const paymentSummary = useMemo(
    () => [
      { label: "Dinheiro", value: salesTotals.totalCash, color: "text-primary" },
      { label: "Pix", value: salesTotals.totalPix, color: "text-success" },
      { label: "Débito", value: salesTotals.totalDebit, color: "text-warning" },
      { label: "Crédito", value: salesTotals.totalCredit, color: "text-muted-foreground" },
    ],
    [salesTotals]
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Caixa</h1>
          <p className="text-sm text-muted-foreground">Status: <span className={`font-medium ${isOpen ? "text-success" : "text-destructive"}`}>{isOpen ? "Aberto" : "Fechado"}</span></p>
        </div>
        {!isOpen ? (
          <button onClick={() => setShowDialog("open")} className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-medium transition-fast hover:opacity-90 active:scale-[0.98] flex items-center gap-2"><Unlock className="h-4 w-4" /> Abrir Caixa</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setShowDialog("sangria")} className="h-9 px-4 rounded-lg bg-destructive/10 text-destructive text-sm font-medium transition-fast hover:bg-destructive/20 flex items-center gap-2"><ArrowDownCircle className="h-4 w-4" /> Sangria</button>
            <button onClick={() => setShowDialog("suprimento")} className="h-9 px-4 rounded-lg bg-success/10 text-success text-sm font-medium transition-fast hover:bg-success/20 flex items-center gap-2"><ArrowUpCircle className="h-4 w-4" /> Suprimento</button>
            <button onClick={() => setShowDialog("close")} className="h-9 px-4 rounded-lg bg-foreground text-background text-sm font-medium transition-fast hover:opacity-90 flex items-center gap-2"><Lock className="h-4 w-4" /> Fechar Caixa</button>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl shadow-card p-5"><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Vendido</span><div className="font-mono-tabular text-2xl font-semibold text-foreground mt-2">R$ {salesTotals.totalSales.toFixed(2)}</div></div>
            <div className="bg-card rounded-xl shadow-card p-5"><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dinheiro Esperado</span><div className="font-mono-tabular text-2xl font-semibold text-foreground mt-2">R$ {expectedCash.toFixed(2)}</div></div>
            <div className="bg-card rounded-xl shadow-card p-5"><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sangrias</span><div className="font-mono-tabular text-2xl font-semibold text-destructive mt-2">R$ {totalWithdrawals.toFixed(2)}</div></div>
            <div className="bg-card rounded-xl shadow-card p-5"><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suprimentos</span><div className="font-mono-tabular text-2xl font-semibold text-success mt-2">R$ {totalDeposits.toFixed(2)}</div></div>
          </div>
          <div className="bg-card rounded-xl shadow-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Vendas por Forma de Pagamento</h2>
            <div className="space-y-3">
              {paymentSummary.map((ps) => (<div key={ps.label} className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{ps.label}</span><span className={`font-mono-tabular font-medium ${ps.color}`}>R$ {ps.value.toFixed(2)}</span></div>))}
            </div>
          </div>
        </div>
      )}

      {!isOpen && (
        <div className="flex items-center justify-center h-64"><div className="text-center"><Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Caixa fechado. Abra o caixa para começar.</p></div></div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">Caixas anteriores</h2>
        {registers.filter((r) => r.status === "closed").length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum caixa fechado ainda.</p>
        ) : (
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Abertura</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Fechamento</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {registers
                  .filter((r) => r.status === "closed")
                  .map((r) => (
                    <tr key={r.id} className="border-b border-border">
                      <td className="px-4 py-3 text-sm text-foreground">
                        {new Date(r.opened_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {r.closed_at ? new Date(r.closed_at).toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            onClick={() => loadRegisterDetails(r.id)}
                            className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-fast"
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!showDialog} onOpenChange={() => setShowDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{showDialog === "open" ? "Abrir Caixa" : showDialog === "sangria" ? "Registrar Sangria" : showDialog === "suprimento" ? "Registrar Suprimento" : "Fechar Caixa"}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4">
            {showDialog === "close" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Confirmar fechamento do caixa?</p>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total vendido</span><span className="font-mono-tabular">R$ {salesTotals.totalSales.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Esperado em caixa</span><span className="font-mono-tabular">R$ {expectedCash.toFixed(2)}</span></div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowDialog(null)} className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button>
                  <button onClick={closeCaixa} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Fechar Caixa</button>
                </div>
              </div>
            ) : (
              <>
                <div><label className="text-xs text-muted-foreground mb-1 block">{showDialog === "open" ? "Valor Inicial" : "Valor"}</label><input type="number" value={dialogAmount || ""} onChange={(e) => setDialogAmount(parseFloat(e.target.value) || 0)} className="w-full h-9 px-3 rounded-md bg-muted text-sm font-mono-tabular text-foreground focus:outline-none focus:ring-2 focus:ring-primary" autoFocus /></div>
                {showDialog !== "open" && (<div><label className="text-xs text-muted-foreground mb-1 block">Motivo</label><input value={dialogReason} onChange={(e) => setDialogReason(e.target.value)} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>)}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowDialog(null)} className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button>
                  <button onClick={showDialog === "open" ? openCaixa : showDialog === "sangria" ? addSangria : addSuprimento} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Confirmar</button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewDetails} onOpenChange={() => setViewDetails(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Caixa</DialogTitle>
          </DialogHeader>
          {viewDetails && (
            <div className="space-y-4 mt-4 text-sm">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Abertura</span>
                  <span className="font-mono-tabular">
                    {new Date(viewDetails.openedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fechamento</span>
                  <span className="font-mono-tabular">
                    {viewDetails.closedAt
                      ? new Date(viewDetails.closedAt).toLocaleString()
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor inicial</span>
                  <span className="font-mono-tabular">
                    R$ {viewDetails.initialAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total vendido</span>
                  <span className="font-mono-tabular">
                    R$ {viewDetails.totalSales.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  Vendas por forma de pagamento
                </span>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dinheiro</span>
                    <span className="font-mono-tabular">
                      R$ {viewDetails.totalCash.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pix</span>
                    <span className="font-mono-tabular">
                      R$ {viewDetails.totalPix.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Débito</span>
                    <span className="font-mono-tabular">
                      R$ {viewDetails.totalDebit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Crédito</span>
                    <span className="font-mono-tabular">
                      R$ {viewDetails.totalCredit.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  Sangrias
                </span>
                {viewDetails.withdrawals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma sangria registrada.</p>
                ) : (
                  <div className="space-y-1">
                    {viewDetails.withdrawals.map((w, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-muted-foreground truncate max-w-[180px]">
                          {w.reason || "Sem motivo"}
                        </span>
                        <span className="font-mono-tabular">
                          R$ {w.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  Suprimentos
                </span>
                {viewDetails.deposits.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum suprimento registrado.</p>
                ) : (
                  <div className="space-y-1">
                    {viewDetails.deposits.map((d, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-muted-foreground truncate max-w-[180px]">
                          {d.reason || "Sem motivo"}
                        </span>
                        <span className="font-mono-tabular">
                          R$ {d.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
