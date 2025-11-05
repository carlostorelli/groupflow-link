import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Link2,
  Calendar,
  UserPlus,
  Sparkles,
  LogOut,
  Moon,
  Sun,
  Shield,
} from "lucide-react";
import logoLight from "@/assets/logo-light.png";
import logoDark from "@/assets/logo-dark.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageSquare },
  { title: "Grupos", url: "/groups", icon: Users },
  { title: "Link de Redirecionamento", url: "/redirect", icon: Link2 },
  { title: "Agendamentos", url: "/jobs", icon: Calendar },
  { title: "Extrator de Contatos", url: "/contacts", icon: UserPlus },
  { title: "Ferramentas de IA", url: "/ai-tools", icon: Sparkles },
  { title: "Admin", url: "/admin", icon: Shield },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const { data: isAdmin = false } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      console.log('Admin check for user:', user.id, 'Result:', data);

      if (error) {
        console.error('Error checking admin:', error);
        return false;
      }

      return !!data;
    },
    enabled: !!user,
    initialData: false,
    staleTime: 0, // Always refetch
  });

  const visibleMenuItems = menuItems.filter(item => {
    if (item.url === '/admin') {
      return isAdmin;
    }
    return true;
  });

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent" : "";

  return (
    <Sidebar collapsible="icon">
      <SidebarTrigger className="m-2 self-end" />

      <SidebarContent>
        {/* Logo section */}
        <div className="px-4 py-6 mb-4">
          {!collapsed && (
            <img 
              src={theme === "dark" ? logoDark : logoLight} 
              alt="Zapp Grupos" 
              className="h-10 w-auto"
            />
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4 space-y-2">
          <Button 
            variant="ghost" 
            className="w-full justify-start" 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-4 w-4" />
                {!collapsed && <span className="ml-2">Tema Claro</span>}
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                {!collapsed && <span className="ml-2">Tema Escuro</span>}
              </>
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start" 
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
