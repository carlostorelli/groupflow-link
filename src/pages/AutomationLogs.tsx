import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, ExternalLink } from "lucide-react";
import { format } from "date-fns";

type StoreKey = "shopee" | "amazon" | "magalu" | "ml" | "shein" | "aliexpress";
type DispatchStatus = "sent" | "skipped" | "error";

interface DispatchLog {
  id: string;
  automation_id: string;
  automation_name: string;
  store: StoreKey;
  group_id: string;
  group_name?: string;
  product_url: string;
  affiliate_url?: string;
  status: DispatchStatus;
  error?: string;
  created_at: string;
}

interface Automation {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  wa_group_id: string;
}

const STORES = [
  { value: "shopee", label: "Shopee" },
  { value: "amazon", label: "Amazon" },
  { value: "magalu", label: "Magazine Luiza" },
  { value: "ml", label: "Mercado Livre" },
  { value: "shein", label: "Shein" },
  { value: "aliexpress", label: "AliExpress" },
];

export default function AutomationLogs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterAutomation, setFilterAutomation] = useState<string>("all");
  const [filterStore, setFilterStore] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [logsRes, automationsRes, groupsRes] = await Promise.all([
        supabase
          .from("dispatch_logs")
          .select("*")
          .eq("user_id", user?.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("automations")
          .select("id, name")
          .eq("user_id", user?.id)
          .order("name"),
        supabase
          .from("groups")
          .select("id, name, wa_group_id")
          .eq("user_id", user?.id)
          .order("name"),
      ]);

      if (logsRes.error) throw logsRes.error;
      if (automationsRes.error) throw automationsRes.error;
      if (groupsRes.error) throw groupsRes.error;

      setLogs(logsRes.data || []);
      setAutomations(automationsRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Erro ao carregar logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Data/Hora",
      "Automação",
      "Loja",
      "Grupo",
      "Produto",
      "Link Afiliado",
      "Status",
      "Erro",
    ];

    const rows = filteredLogs.map((log) => [
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
      log.automation_name,
      STORES.find((s) => s.value === log.store)?.label || log.store,
      log.group_name || log.group_id,
      log.product_url,
      log.affiliate_url || "-",
      log.status,
      log.error || "-",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "CSV exportado com sucesso!" });
  };

  const filteredLogs = logs.filter((log) => {
    if (filterAutomation !== "all" && log.automation_id !== filterAutomation) return false;
    if (filterStore !== "all" && log.store !== filterStore) return false;
    if (filterStatus !== "all" && log.status !== filterStatus) return false;
    if (filterGroup !== "all" && log.group_id !== filterGroup) return false;
    if (searchTerm && !log.product_url.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getStatusBadge = (status: DispatchStatus) => {
    switch (status) {
      case "sent":
        return <Badge variant="default">Enviado</Badge>;
      case "skipped":
        return <Badge variant="secondary">Ignorado</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getGroupName = (groupId: string) => {
    const group = groups.find((g) => g.wa_group_id === groupId);
    return group?.name || groupId;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Logs de Automações</h1>
          <p className="text-muted-foreground">Histórico de envios e ações das automações</p>
        </div>
        <Button onClick={exportCSV} variant="outline" disabled={filteredLogs.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Automação</Label>
              <Select value={filterAutomation} onValueChange={setFilterAutomation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {automations.map((auto) => (
                    <SelectItem key={auto.id} value={auto.id}>
                      {auto.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Loja</Label>
              <Select value={filterStore} onValueChange={setFilterStore}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {STORES.map((store) => (
                    <SelectItem key={store.value} value={store.value}>
                      {store.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.wa_group_id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="skipped">Ignorado</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Buscar URL</Label>
              <Input
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      {filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {logs.length === 0
                ? "Nenhum log registrado ainda"
                : "Nenhum log corresponde aos filtros aplicados"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Registros</CardTitle>
            <CardDescription>
              {filteredLogs.length} de {logs.length} log{logs.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Automação</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium">{log.automation_name}</TableCell>
                    <TableCell>
                      {STORES.find((s) => s.value === log.store)?.label || log.store}
                    </TableCell>
                    <TableCell className="text-xs">{getGroupName(log.group_id)}</TableCell>
                    <TableCell>
                      <a
                        href={log.affiliate_url || log.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ver produto
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {log.error || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
