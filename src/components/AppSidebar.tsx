import { 
  LayoutDashboard, ShoppingCart, Package, Warehouse, 
  DollarSign, Users, Truck, BarChart3, Settings, LogOut 
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const allNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, adminOnly: true },
  { title: "PDV", url: "/pdv", icon: ShoppingCart, adminOnly: false },
  { title: "Produtos", url: "/produtos", icon: Package, adminOnly: true },
  { title: "Estoque", url: "/estoque", icon: Warehouse, adminOnly: true },
  { title: "Caixa", url: "/caixa", icon: DollarSign, adminOnly: true },
  { title: "Clientes", url: "/clientes", icon: Users, adminOnly: true },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck, adminOnly: true },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3, adminOnly: true },
  { title: "Configurações", url: "/configuracoes", icon: Settings, adminOnly: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { role, signOut, user } = useAuth();
  const collapsed = state === "collapsed";
  const isOperador = role === "operador";

  const navItems = allNavItems.filter(item => !isOperador || !item.adminOnly);

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <div className="px-4 py-5 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-[13px] font-bold text-primary-foreground tracking-tight">PD</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">PrimusDIstri</span>
              <span className="text-[11px] text-muted-foreground">Gestão de Bebidas</span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/"} 
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground transition-fast hover:bg-accent hover:text-foreground"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto px-4 py-4 border-t border-border">
          {!collapsed && (
            <div className="text-xs text-muted-foreground mb-2 truncate">
              {user?.email}
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground transition-fast hover:bg-destructive/10 hover:text-destructive w-full"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
