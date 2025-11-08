import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CheckCircle2, XCircle, Loader2, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActionHistory {
  id: string;
  action_type: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  target_count: number;
  success_count: number;
  error_count: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function History() {
  const [history, setHistory] = useState<ActionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadHistory();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('action-history-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'action_history'
        },
        () => {
          console.log('History updated, reloading...');
          loadHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('action_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setHistory((data || []) as ActionHistory[]);
    } catch (error: any) {
      console.error('Erro ao carregar histórico:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar histórico",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string; icon: any }> = {
      pending: { label: "Pendente", className: "bg-muted text-muted-foreground", icon: Clock },
      running: { label: "Executando", className: "bg-primary animate-pulse", icon: Loader2 },
      completed: { label: "Concluído", className: "bg-gradient-success", icon: CheckCircle2 },
      failed: { label: "Falhou", className: "bg-destructive", icon: XCircle },
    };

    const variant = variants[status] || variants.pending;
    const Icon = variant.icon;
    
    return (
      <Badge className={variant.className}>
        <Icon className="mr-1 h-3 w-3" />
        {variant.label}
      </Badge>
    );
  };

  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'close_groups': 'Fechar Grupos',
      'open_groups': 'Abrir Grupos',
      'send_message': 'Enviar Mensagem',
      'change_name': 'Alterar Nome',
      'change_photo': 'Alterar Foto',
      'change_description': 'Alterar Descrição',
      'import_groups': 'Importar Grupos',
    };
    return labels[actionType] || actionType;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Histórico de Ações</h1>
        <p className="text-muted-foreground mt-2">
          Acompanhe todas as ações executadas no sistema
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{history.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {history.filter(h => h.status === 'completed').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Execução</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {history.filter(h => h.status === 'running' || h.status === 'pending').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Falhadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {history.filter(h => h.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico Completo
          </CardTitle>
          <CardDescription>
            Últimas 100 ações registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Resultados</TableHead>
                <TableHead>Duração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma ação registrada ainda
                  </TableCell>
                </TableRow>
              ) : (
                history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getActionTypeLabel(item.action_type)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {item.description}
                      {item.error_message && (
                        <p className="text-xs text-destructive mt-1">
                          {item.error_message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(item.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.target_count > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">
                            Total: {item.target_count}
                          </div>
                          {item.success_count > 0 && (
                            <div className="text-xs text-green-600">
                              ✓ {item.success_count}
                            </div>
                          )}
                          {item.error_count > 0 && (
                            <div className="text-xs text-red-600">
                              ✗ {item.error_count}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.completed_at ? (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(
                            (new Date(item.completed_at).getTime() - 
                             new Date(item.created_at).getTime()) / 1000
                          )}s
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}