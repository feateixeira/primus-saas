import { useEffect, useRef } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const lastNotifiedRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("/low-stock.mp3");

    const checkLowStock = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,stock,min_stock")
        .gt("min_stock", 0);

      if (error || !data) return;

      const lowNow = data.filter(
        (p) => typeof p.stock === "number" && typeof p.min_stock === "number" && p.stock <= p.min_stock
      );

      if (lowNow.length === 0) {
        lastNotifiedRef.current.clear();
        return;
      }

      const newlyLow = lowNow.filter((p) => !lastNotifiedRef.current.has(p.id));
      if (newlyLow.length === 0) return;

      newlyLow.forEach((p) => lastNotifiedRef.current.add(p.id));

      const names = newlyLow.map((p) => p.name).slice(0, 3).join(", ");
      toast.warning(`Produtos com estoque baixo: ${names}${newlyLow.length > 3 ? " ..." : ""}`);

      try {
        await audioRef.current?.play();
      } catch {
        // ignore autoplay errors
      }
    };

    const channel = supabase
      .channel("realtime:low-stock-alert")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          checkLowStock();
        }
      )
      .subscribe();

    // checa uma vez ao montar
    checkLowStock();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center">
              <SidebarTrigger className="mr-3" />
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
