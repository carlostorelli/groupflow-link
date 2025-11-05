import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, UserCheck, TrendingUp, Link2 } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalGroups: 0,
    fullGroups: 0,
    totalMembers: 0,
    activeLinks: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      const { data: groups } = await supabase
        .from("groups")
        .select("*")
        .eq("user_id", user.id);

      const { data: links } = await supabase
        .from("redirect_links")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (groups) {
        const totalMembers = groups.reduce((sum, group) => sum + group.members_count, 0);
        const fullGroups = groups.filter((g) => g.status === "full").length;

        setStats({
          totalGroups: groups.length,
          fullGroups,
          totalMembers,
          activeLinks: links?.length || 0,
        });
      }
    };

    fetchStats();
  }, [user]);

  const statCards = [
    {
      title: "Total de Grupos",
      value: stats.totalGroups,
      icon: Users,
      iconColor: "bg-[#10b981]",
    },
    {
      title: "Grupos Cheios",
      value: stats.fullGroups,
      icon: UserCheck,
      iconColor: "bg-[#10b981]",
    },
    {
      title: "Total de Membros",
      value: stats.totalMembers,
      icon: TrendingUp,
      iconColor: "bg-[#10b981]",
    },
    {
      title: "Links Ativos",
      value: stats.activeLinks,
      icon: Link2,
      iconColor: "bg-[#10b981]",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Visão geral da sua operação WhatsApp
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title} className="shadow-card border-0">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.iconColor}`}>
                <card.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Bem-vindo ao Zapp Grupos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Comece conectando seu WhatsApp na aba "WhatsApp" para importar seus grupos.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <h3 className="font-semibold mb-2 text-primary">1. Conecte seu WhatsApp</h3>
                <p className="text-sm text-foreground/70">
                  Use o QR Code para conectar sua conta
                </p>
              </div>
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <h3 className="font-semibold mb-2 text-primary">2. Importe seus grupos</h3>
                <p className="text-sm text-foreground/70">
                  Seus grupos serão listados automaticamente
                </p>
              </div>
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <h3 className="font-semibold mb-2 text-primary">3. Configure redirecionamento</h3>
                <p className="text-sm text-foreground/70">
                  Crie links inteligentes para distribuir membros
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
