import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ShoppingCart, LogIn } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error("Credenciais inválidas");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <span className="text-base font-bold text-primary-foreground tracking-tight">PD</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">PrimusDIstri</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistema de Gestão</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl shadow-card p-6 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="admin@primus.com"
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-fast hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
