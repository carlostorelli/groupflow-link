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
import { Loader2, Copy, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Admin() {
  const [email, setEmail] = useState("");
  const [event, setEvent] = useState("");
  const [product, setProduct] = useState("");
  const [loading, setLoading] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/api/webhooks/kiwify`;

  useEffect(() => {
    fetchWebhookLogs();
  }, []);

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
      
      // Limpar formulário
      setEmail("");
      setEvent("");
      setProduct("");
      
      // Atualizar logs
      await fetchWebhookLogs();
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

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Painel Administrativo</h1>
        <p className="text-muted-foreground">Gerencie webhooks e configurações do sistema</p>
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
