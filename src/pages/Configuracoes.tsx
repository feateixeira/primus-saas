import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

export default function Configuracoes() {
  const [config, setConfig] = useState({
    name: "PrimusDIstri",
    address: "",
    phone: "",
  });

  const save = () => {
    toast.success("Configurações salvas");
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados da distribuidora</p>
      </div>

      <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nome da Distribuidora</label>
          <input value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Endereço</label>
          <input value={config.address} onChange={(e) => setConfig({ ...config, address: e.target.value })} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
          <input value={config.phone} onChange={(e) => setConfig({ ...config, phone: e.target.value })} className="w-full h-9 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="pt-4">
          <button onClick={save} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-fast hover:opacity-90 active:scale-[0.98] flex items-center gap-2">
            <Save className="h-4 w-4" /> Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}
