import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { Supplier } from "@/types/models";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Fornecedores() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", contact: "", notes: "" });
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(
    () => suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [suppliers, search]
  );

  const loadSuppliers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar fornecedores");
      setLoading(false);
      return;
    }

    const mapped: Supplier[] = (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone ?? "",
      contact: r.contact ?? "",
      notes: r.notes ?? "",
    }));
    setSuppliers(mapped);
    setLoading(false);
  };

  useEffect(() => {
    loadSuppliers();

    const channel = supabase
      .channel("realtime:suppliers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suppliers" },
        () => loadSuppliers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => { setForm({ name: "", phone: "", contact: "", notes: "" }); setEditSupplier(null); setShowForm(true); };
  const openEdit = (s: Supplier) => { setForm(s); setEditSupplier(s); setShowForm(true); };

  const save = async () => {
    if (!form.name) { toast.error("Informe o nome"); return; }

    const payload = {
      name: form.name,
      phone: form.phone || null,
      contact: form.contact || null,
      notes: form.notes || null,
    };

    if (editSupplier) {
      const { error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", editSupplier.id);
      if (error) {
        toast.error("Erro ao atualizar fornecedor");
        return;
      }
      toast.success("Fornecedor atualizado");
    } else {
      const { error } = await supabase.from("suppliers").insert(payload);
      if (error) {
        toast.error("Erro ao cadastrar fornecedor");
        return;
      }
      toast.success("Fornecedor cadastrado");
    }

    await loadSuppliers();
    setShowForm(false);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover fornecedor");
      return;
    }
    toast("Fornecedor removido");
    await loadSuppliers();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Carregando..." : `${suppliers.length} fornecedores`}
          </p>
        </div>
        <button onClick={openNew} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-fast hover:opacity-90 active:scale-[0.98] flex items-center gap-2"><Plus className="h-4 w-4" /> Novo Fornecedor</button>
      </div>
      <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-fast" placeholder="Buscar fornecedor..." /></div>
      {!loading && suppliers.length === 0 ? (
        <div className="bg-card rounded-xl shadow-card p-12 text-center"><p className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado ainda.</p><button onClick={openNew} className="mt-4 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-fast hover:opacity-90">Cadastrar Primeiro Fornecedor</button></div>
      ) : (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border"><th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome</th><th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Contato</th><th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Telefone</th><th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Obs</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-border transition-fast hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.contact}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono-tabular">{s.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[200px]">{s.notes}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1 justify-end"><button onClick={() => openEdit(s)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground transition-fast hover:bg-accent hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => remove(s.id)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground transition-fast hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4">
            <div><label className="text-xs text-muted-foreground mb-1 block">Nome</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Contato</label><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Telefone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Observações</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            <div className="flex justify-end gap-2"><button onClick={() => setShowForm(false)} className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button><button onClick={save} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Salvar</button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
