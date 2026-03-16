import { useEffect, useMemo, useState } from "react";
import { Search, ArrowUpCircle, ArrowDownCircle, RefreshCw } from "lucide-react";
import { Product } from "@/types/models";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Estoque() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showMovement, setShowMovement] = useState<{ id: string; type: "entrada" | "saida" | "ajuste" } | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );
  const totalStockValue = useMemo(
    () => products.reduce((a, p) => a + p.salePrice * p.stock, 0),
    [products]
  );

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar estoque");
      setLoading(false);
      return;
    }

    const mapped: Product[] = (data ?? []).map((r) => {
      const costPrice = Number(r.cost_price ?? 0);
      const salePrice = Number(r.sale_price ?? 0);
      return {
        id: r.id,
        name: r.name,
        barcode: r.barcode ?? "",
        category: r.category ?? "",
        brand: r.brand ?? "",
        costPrice,
        salePrice,
        margin: costPrice > 0 ? ((salePrice - costPrice) / costPrice) * 100 : 0,
        stock: r.stock ?? 0,
        minStock: r.min_stock ?? 0,
        unit: (r.unit as Product["unit"]) ?? "unidade",
      };
    });
    setProducts(mapped);
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();

    const channel = supabase
      .channel("realtime:products-stock")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => loadProducts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyMovement = async () => {
    if (!showMovement || quantity <= 0) { toast.error("Informe a quantidade"); return; }

    const product = products.find((p) => p.id === showMovement.id);
    if (!product) {
      toast.error("Produto não encontrado");
      return;
    }

    const previousStock = product.stock;
    const newStock =
      showMovement.type === "entrada"
        ? previousStock + quantity
        : showMovement.type === "saida"
          ? Math.max(0, previousStock - quantity)
          : quantity;

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", product.id);

    if (updateError) {
      toast.error("Erro ao atualizar estoque");
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    const { error: movementError } = await supabase.from("stock_movements").insert({
      product_id: product.id,
      type: showMovement.type,
      quantity,
      reason: reason || null,
      previous_stock: previousStock,
      new_stock: newStock,
      created_by: auth.user?.id ?? null,
    });

    if (movementError) {
      toast.error("Estoque atualizado, mas falhou ao registrar movimentação");
    }

    toast.success(`Estoque ${showMovement.type === "entrada" ? "adicionado" : showMovement.type === "saida" ? "removido" : "ajustado"}`);
    setShowMovement(null); setQuantity(0); setReason("");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Estoque</h1>
          <p className="text-sm text-muted-foreground">Valor total: <span className="font-mono-tabular font-medium text-foreground">R$ {totalStockValue.toFixed(2)}</span></p>
        </div>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-fast" placeholder="Buscar produto..." />
      </div>
      {!loading && products.length === 0 ? (
        <div className="bg-card rounded-xl shadow-card p-12 text-center"><p className="text-sm text-muted-foreground">Nenhum produto cadastrado ainda.</p></div>
      ) : (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border"><th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Produto</th><th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Estoque</th><th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Mínimo</th><th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Preço</th><th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Total</th><th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Ações</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border transition-fast hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3 text-right"><span className={`font-mono-tabular text-xs px-2 py-0.5 rounded-full ${p.stock <= p.minStock ? (p.stock === 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning") : "bg-success/10 text-success"}`}>{p.stock} un.</span></td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-muted-foreground">{p.minStock}</td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-foreground">R$ {p.salePrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono-tabular font-medium text-foreground">R$ {(p.salePrice * p.stock).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setShowMovement({ id: p.id, type: "entrada" })} className="h-7 w-7 rounded-md flex items-center justify-center text-success transition-fast hover:bg-success/10" title="Entrada"><ArrowUpCircle className="h-4 w-4" /></button>
                      <button onClick={() => setShowMovement({ id: p.id, type: "saida" })} className="h-7 w-7 rounded-md flex items-center justify-center text-destructive transition-fast hover:bg-destructive/10" title="Saída"><ArrowDownCircle className="h-4 w-4" /></button>
                      <button onClick={() => setShowMovement({ id: p.id, type: "ajuste" })} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground transition-fast hover:bg-muted" title="Ajuste"><RefreshCw className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!showMovement} onOpenChange={() => setShowMovement(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{showMovement?.type === "entrada" ? "Entrada de Estoque" : showMovement?.type === "saida" ? "Saída de Estoque" : "Ajuste de Estoque"}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4">
            <div><label className="text-xs text-muted-foreground mb-1 block">{showMovement?.type === "ajuste" ? "Novo Estoque" : "Quantidade"}</label><input type="number" value={quantity || ""} onChange={(e) => setQuantity(parseInt(e.target.value) || 0)} className="w-full h-9 px-3 rounded-md bg-muted text-sm font-mono-tabular text-foreground focus:outline-none focus:ring-2 focus:ring-primary" autoFocus /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Motivo</label><input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Opcional" /></div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowMovement(null)} className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground transition-fast hover:bg-muted">Cancelar</button>
              <button onClick={applyMovement} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-fast hover:opacity-90 active:scale-[0.98]">Confirmar</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
