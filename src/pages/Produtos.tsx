import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { Product } from "@/types/models";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Produtos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.barcode.includes(search)
      ),
    [products, search]
  );

  const [form, setForm] = useState<Partial<Product>>({
    name: "", barcode: "", category: "", brand: "", costPrice: 0, salePrice: 0, stock: 0, minStock: 0, unit: "unidade",
  });

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar produtos");
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
      .channel("realtime:products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          loadProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setForm({ name: "", barcode: "", category: "", brand: "", costPrice: 0, salePrice: 0, stock: 0, minStock: 0, unit: "unidade" });
    setEditProduct(null);
    setShowForm(true);
  };

  const openEdit = (p: Product) => { setForm(p); setEditProduct(p); setShowForm(true); };

  const save = async () => {
    if (!form.name) { toast.error("Informe o nome do produto"); return; }

    const payload = {
      name: form.name,
      barcode: form.barcode || null,
      category: form.category || null,
      brand: form.brand || null,
      unit: form.unit ?? "unidade",
      cost_price: Number(form.costPrice ?? 0),
      sale_price: Number(form.salePrice ?? 0),
      stock: Number(form.stock ?? 0),
      min_stock: Number(form.minStock ?? 0),
    };

    if (editProduct) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editProduct.id);

      if (error) {
        toast.error("Erro ao atualizar produto");
        return;
      }
      toast.success("Produto atualizado");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) {
        toast.error("Erro ao cadastrar produto");
        return;
      }
      toast.success("Produto cadastrado");
    }

    await loadProducts();
    setShowForm(false);
  };

  const remove = async (id: string) => {
    // Remove dependências (itens de venda e movimentações de estoque) antes de remover o produto
    const { error: saleItemsError } = await supabase
      .from("sale_items")
      .delete()
      .eq("product_id", id);
    if (saleItemsError) {
      toast.error("Erro ao remover itens de venda do produto");
      return;
    }

    const { error: stockMovementsError } = await supabase
      .from("stock_movements")
      .delete()
      .eq("product_id", id);
    if (stockMovementsError) {
      toast.error("Erro ao remover movimentações de estoque do produto");
      return;
    }

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover produto");
      return;
    }
    toast("Produto removido");
    await loadProducts();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Carregando..." : `${products.length} produtos cadastrados`}
          </p>
        </div>
        <button onClick={openNew} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-fast hover:opacity-90 active:scale-[0.98] flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo Produto
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-fast" placeholder="Buscar produto..." />
      </div>

      {!loading && products.length === 0 ? (
        <div className="bg-card rounded-xl shadow-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhum produto cadastrado ainda.</p>
          <button onClick={openNew} className="mt-4 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-fast hover:opacity-90">Cadastrar Primeiro Produto</button>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Produto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoria</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Custo</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Venda</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Margem</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Estoque</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border transition-fast hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-3 font-mono-tabular text-muted-foreground text-xs">{p.barcode}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-muted-foreground">R$ {p.costPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-medium text-foreground">R$ {p.salePrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-success">{p.margin.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono-tabular text-xs px-2 py-0.5 rounded-full ${p.stock <= p.minStock ? (p.stock === 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning") : "text-foreground"}`}>{p.stock} {p.unit === "unidade" ? "un." : p.unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(p)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground transition-fast hover:bg-accent hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(p.id)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground transition-fast hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Nome</label><input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Código de Barras</label><input value={form.barcode || ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="w-full h-9 px-3 rounded-md bg-muted text-sm font-mono-tabular text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Auto-gerado se vazio" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Categoria</label><input value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Marca</label><input value={form.brand || ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Unidade</label><select value={form.unit || "unidade"} onChange={(e) => setForm({ ...form, unit: e.target.value as Product["unit"] })} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"><option value="unidade">Unidade</option><option value="caixa">Caixa</option><option value="pacote">Pacote</option></select></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Preço de Compra</label><input type="number" value={form.costPrice || ""} onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })} className="w-full h-9 px-3 rounded-md bg-muted text-sm font-mono-tabular text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Preço de Venda</label><input type="number" value={form.salePrice || ""} onChange={(e) => setForm({ ...form, salePrice: parseFloat(e.target.value) || 0 })} className="w-full h-9 px-3 rounded-md bg-muted text-sm font-mono-tabular text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            {form.costPrice && form.salePrice ? <div className="col-span-2 text-xs text-success">Margem: {(((form.salePrice - form.costPrice) / form.costPrice) * 100).toFixed(1)}%</div> : null}
            <div><label className="text-xs text-muted-foreground mb-1 block">Estoque Atual</label><input type="number" value={form.stock || ""} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} className="w-full h-9 px-3 rounded-md bg-muted text-sm font-mono-tabular text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Estoque Mínimo</label><input type="number" value={form.minStock || ""} onChange={(e) => setForm({ ...form, minStock: parseInt(e.target.value) || 0 })} className="w-full h-9 px-3 rounded-md bg-muted text-sm font-mono-tabular text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground transition-fast hover:bg-muted">Cancelar</button>
            <button onClick={save} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-fast hover:opacity-90 active:scale-[0.98]">Salvar</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
