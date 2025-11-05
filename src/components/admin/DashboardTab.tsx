import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, Users, TrendingUp, Package } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  planStats: { plan: string; count: number }[];
  growthData: { date: string; users: number }[];
}

interface DashboardTabProps {
  onStatsUpdate: (stats: DashboardStats) => void;
}

export default function DashboardTab({ onStatsUpdate }: DashboardTabProps) {
  const [email, setEmail] = useState("");
  const [event, setEvent] = useState("");
  const [product, setProduct] = useState("");
  const [loading, setLoading] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    planStats: [],
    growthData: []
  });

  const webhookUrl = `${window.location.origin}/api/webhooks/kiwify`;

  useEffect(() => {
    fetchWebhookLogs();
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('plan, created_at, updated_at');

      if (profilesError) throw profilesError;

      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);

      const totalUsers = profiles?.length || 0;
      const activeUsers = profiles?.filter(p => 
        new Date(p.updated_at) > thirtyDaysAgo
      ).length || 0;
      const inactiveUsers = totalUsers - activeUsers;

      const planCounts = profiles?.reduce((acc: any, profile) => {
        const plan = profile.plan || 'free';
        acc[plan] = (acc[plan] || 0) + 1;
        return acc;
      }, {});

      const planStats = Object.entries(planCounts || {}).map(([plan, count]) => ({
        plan: plan.charAt(0).toUpperCase() + plan.slice(1),
        count: count as number
      }));

      const growthData = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(now, i);
        const count = profiles?.filter(p => 
          new Date(p.created_at) <= date
        ).length || 0;
        growthData.push({
          date: format(date, 'dd/MM', { locale: ptBR }),
          users: count
        });
      }

      const newStats = {
        totalUsers,
        activeUsers,
        inactiveUsers,
        planStats,
        growthData
      };

      setStats(newStats);
      onStatsUpdate(newStats);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const fetchWebhookLogs = async () => {
    const { data, error } = await supabase
      .from('webhook_logs')
      .select('*')
      .order('processed_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Erro ao buscar logs:', error);
      return;
    }

    setWebhookLogs(data || []);
  };

  const handleSimulateWebhook = async () => {
    if (!email || !event) {
      toast.error("Por favor, preencha email e evento");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('kiwify-webhook', {
        body: {
          email,
          evento: event,
          produto: product || undefined,
          token: 'ppwef2elcdu'
        }
      });

      if (error) throw error;

      toast.success("Webhook simulado com sucesso!");
      
      setEmail("");
      setEvent("");
      setProduct("");
      
      await fetchWebhookLogs();
      await fetchDashboardStats();
    } catch (error: any) {
      console.error('Erro ao simular webhook:', error);
      toast.error(error.message || "Erro ao simular webhook");
    } finally {
      setLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada para área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  const getEventBadge = (event: string) => {
    const eventLower = event.toLowerCase();
    if (eventLower.includes('aprovada') || eventLower.includes('renovada')) {
      return <Badge className="bg-green-500">Ativa</Badge>;
    }
    if (eventLower.includes('cancelada')) {
      return <Badge variant="destructive">Cancelada</Badge>;
    }
    if (eventLower.includes('atrasada')) {
      return <Badge className="bg-yellow-500">Atrasada</Badge>;
    }
    return <Badge variant="secondary">{event}</Badge>;
  };

  const getPlanFromProduct = (product: string | null) => {
    if (!product) return "N/A";
    const productLower = product.toLowerCase();
    if (productLower.includes('starter')) return 'Starter';
    if (productLower.includes('pro')) return 'Pro';
    if (productLower.includes('master')) return 'Master';
    return product;
  };

  const PLAN_COLORS = {
    Free: "hsl(var(--chart-1))",
    Starter: "hsl(var(--chart-2))",
    Pro: "hsl(var(--chart-3))",
    Master: "hsl(var(--chart-4))"
  };

  return (
    <div className="space-y-8">
      {/* Dashboard de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeUsers} ativos, {stats.inactiveUsers} inativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Ativos nos últimos 30 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Contratados</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.planStats.length}</div>
            <p className="text-xs text-muted-foreground">
              Diferentes planos ativos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Crescimento de Usuários</CardTitle>
            <CardDescription>Últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                users: {
                  label: "Usuários",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-[200px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.growthData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="users" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Plano</CardTitle>
            <CardDescription>Usuários por tipo de plano</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={Object.fromEntries(
                stats.planStats.map(({ plan }) => [
                  plan.toLowerCase(),
                  { label: plan, color: PLAN_COLORS[plan as keyof typeof PLAN_COLORS] || "hsl(var(--chart-1))" }
                ])
              )}
              className="h-[200px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={stats.planStats}
                    dataKey="count"
                    nameKey="plan"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {stats.planStats.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={PLAN_COLORS[entry.plan as keyof typeof PLAN_COLORS] || "hsl(var(--chart-1))"} 
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* URL do Webhook */}
      <Card>
        <CardHeader>
          <CardTitle>URL do Webhook Kiwify</CardTitle>
          <CardDescription>
            Configure esta URL no painel da Kiwify para receber eventos automáticos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-sm" />
            <Button onClick={copyWebhookUrl} variant="outline" size="icon">
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Token de segurança: <code className="bg-muted px-2 py-1 rounded">ppwef2elcdu</code>
          </p>
        </CardContent>
      </Card>

      {/* Simulador de Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle>Simulador de Webhooks</CardTitle>
          <CardDescription>
            Teste o processamento de webhooks sem precisar fazer uma compra real
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email do Usuário</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event">Evento</Label>
              <Select value={event} onValueChange={setEvent}>
                <SelectTrigger id="event">
                  <SelectValue placeholder="Selecione o evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assinatura aprovada">Assinatura Aprovada</SelectItem>
                  <SelectItem value="assinatura renovada">Assinatura Renovada</SelectItem>
                  <SelectItem value="assinatura cancelada">Assinatura Cancelada</SelectItem>
                  <SelectItem value="assinatura atrasada">Assinatura Atrasada</SelectItem>
                  <SelectItem value="assinatura expirada">Assinatura Expirada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product">Produto</Label>
              <Select value={product} onValueChange={setProduct}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Plano Starter">Plano Starter</SelectItem>
                  <SelectItem value="Plano Pro">Plano Pro</SelectItem>
                  <SelectItem value="Plano Master">Plano Master</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSimulateWebhook} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              "Simular Webhook"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Últimos Eventos */}
      <Card>
        <CardHeader>
          <CardTitle>Últimos Eventos Processados</CardTitle>
          <CardDescription>
            Histórico dos 10 últimos webhooks recebidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {webhookLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum evento processado ainda
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Plano</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.processed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.email}</TableCell>
                      <TableCell>{getEventBadge(log.event)}</TableCell>
                      <TableCell>{getPlanFromProduct(log.product)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
