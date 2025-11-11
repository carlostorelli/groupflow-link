import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Edit, Play, FileText, AlertCircle, Trash2, X } from "lucide-react";
import { format } from "date-fns";

type StoreKey = "shopee" | "amazon" | "magalu" | "ml" | "shein" | "aliexpress" | "awin";
type AutomationMode = "search" | "monitor";
type PriorityType = "discount" | "price";
type FilterType = "light" | "heavy";
type AutomationStatus = "active" | "paused";

interface Automation {
  id: string;
  name: string;
  mode: AutomationMode;
  start_time: string;
  end_time: string;
  interval_minutes: number;
  send_groups: string[];
  monitor_groups?: string[];
  stores: StoreKey[];
  categories: string[];
  priority: PriorityType;
  filter_type: FilterType;
  min_discount?: number;
  min_price?: number;
  max_price?: number;
  texts: string[];
  ctas: string[];
  last_run_at?: string;
  next_run_at?: string;
  status: AutomationStatus;
  last_error?: string;
}

interface Group {
  id: string;
  name: string;
  wa_group_id: string;
}

const STORES: { value: StoreKey; label: string }[] = [
  { value: "shopee", label: "Shopee" },
  { value: "amazon", label: "Amazon" },
  { value: "magalu", label: "Magazine Luiza" },
  { value: "ml", label: "Mercado Livre" },
  { value: "shein", label: "Shein" },
  { value: "aliexpress", label: "AliExpress" },
  { value: "awin", label: "Awin" },
];

const CATEGORIES = [
  "Eletrônicos",
  "Moda",
  "Casa e Decoração",
  "Beleza",
  "Esportes",
  "Livros",
  "Brinquedos",
  "Alimentos",
  "Automotivo",
  "Pets",
];

const INTERVALS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

export default function OfferAutomations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [activeStores, setActiveStores] = useState<StoreKey[]>([]);

  // Form state
  const [formData, setFormData] = useState<Partial<Automation>>({
    mode: "search",
    start_time: "00:01",
    end_time: "23:59",
    interval_minutes: 30,
    send_groups: [],
    monitor_groups: [],
    stores: [],
    categories: [],
    priority: "discount",
    filter_type: "light",
    texts: [""],
    ctas: [],
    status: "active",
  });

  useEffect(() => {
    if (user) {
      loadAutomations();
      loadGroups();
      checkWhatsAppConnection();
      loadActiveStores();
    }
  }, [user]);

  const checkWhatsAppConnection = async () => {
    try {
      const { data } = await supabase
        .from("instances")
        .select("status")
        .eq("user_id", user?.id)
        .maybeSingle();

      setWhatsappConnected(data?.status === "connected");
    } catch (error) {
      console.error("Error checking WhatsApp:", error);
    }
  };

  const loadActiveStores = async () => {
    try {
      const { data, error } = await supabase
        .from("affiliate_credentials")
        .select("store, is_active")
        .eq("user_id", user?.id)
        .eq("is_active", true);

      if (error) throw error;
      
      const active = data?.map(cred => cred.store as StoreKey) || [];
      setActiveStores(active);
    } catch (error) {
      console.error("Error loading active stores:", error);
    }
  };

  const loadAutomations = async () => {
    try {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAutomations(data || []);
    } catch (error) {
      console.error("Error loading automations:", error);
      toast({
        title: "Erro ao carregar automações",
        description: "Não foi possível carregar as automações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, wa_group_id")
        .eq("user_id", user?.id)
        .order("name");

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error("Error loading groups:", error);
    }
  };

  const handleSave = async () => {
    if (!formData.name || formData.send_groups?.length === 0 || formData.stores?.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, grupos e lojas.",
        variant: "destructive",
      });
      return;
    }

    if (formData.mode === "monitor" && (!formData.monitor_groups || formData.monitor_groups.length === 0)) {
      toast({
        title: "Grupos para monitorar",
        description: "Selecione até 3 grupos para monitorar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = {
        ...formData,
        user_id: user?.id,
        texts: formData.texts?.filter(t => t.trim()) || [],
      } as any;

      if (editingId) {
        const { error } = await supabase
          .from("automations")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Automação atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from("automations")
          .insert(payload);

        if (error) throw error;
        toast({ title: "Automação criada com sucesso!" });
      }

      setDialogOpen(false);
      resetForm();
      loadAutomations();
    } catch (error) {
      console.error("Error saving automation:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a automação.",
        variant: "destructive",
      });
    }
  };

  const toggleStatus = async (id: string, currentStatus: AutomationStatus) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try {
      const { error } = await supabase
        .from("automations")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      loadAutomations();
      toast({ title: `Automação ${newStatus === "active" ? "ativada" : "pausada"}` });
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta automação?")) return;

    try {
      const { error } = await supabase
        .from("automations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      loadAutomations();
      toast({ title: "Automação excluída" });
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  const openEdit = (automation: Automation) => {
    setEditingId(automation.id);
    setFormData(automation);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      mode: "search",
      start_time: "00:01",
      end_time: "23:59",
      interval_minutes: 30,
      send_groups: [],
      monitor_groups: [],
      stores: [],
      categories: [],
      priority: "discount",
      filter_type: "light",
      texts: [""],
      ctas: [],
      status: "active",
    });
  };

  const addText = () => {
    if ((formData.texts?.length || 0) < 3) {
      setFormData({ ...formData, texts: [...(formData.texts || []), ""] });
    }
  };

  const updateText = (index: number, value: string) => {
    const newTexts = [...(formData.texts || [])];
    newTexts[index] = value;
    setFormData({ ...formData, texts: newTexts });
  };

  const removeText = (index: number) => {
    const newTexts = formData.texts?.filter((_, i) => i !== index) || [];
    setFormData({ ...formData, texts: newTexts });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Automações de Ofertas</h1>
          <p className="text-muted-foreground">Busca e monitoramento de promoções com IA</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Automação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar" : "Nova"} Automação</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Mode */}
              <div className="space-y-2">
                <Label>Modo de Automação</Label>
                <Select
                  value={formData.mode}
                  onValueChange={(v) => setFormData({ ...formData, mode: v as AutomationMode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="search">Busca de Promoções</SelectItem>
                    <SelectItem value="monitor">Monitoramento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label>Nome da Automação *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Promoções Eletrônicos"
                />
              </div>

              {/* Time Window */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horário de Início</Label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horário de Término</Label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              {/* Interval */}
              <div className="space-y-2">
                <Label>Intervalo de Execução (minutos)</Label>
                <Select
                  value={String(formData.interval_minutes)}
                  onValueChange={(v) => setFormData({ ...formData, interval_minutes: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map((i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i} minutos
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Send Groups */}
              <div className="space-y-2">
                <Label>Grupos para Enviar *</Label>
                <Card>
                  <CardContent className="pt-4 max-h-40 overflow-y-auto">
                    {groups.map((group) => (
                      <div key={group.id} className="flex items-center space-x-2 mb-2">
                        <Checkbox
                          checked={formData.send_groups?.includes(group.wa_group_id)}
                          onCheckedChange={(checked) => {
                            const current = formData.send_groups || [];
                            setFormData({
                              ...formData,
                              send_groups: checked
                                ? [...current, group.wa_group_id]
                                : current.filter((g) => g !== group.wa_group_id),
                            });
                          }}
                        />
                        <Label className="cursor-pointer">{group.name}</Label>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Monitor Groups (only for monitor mode) */}
              {formData.mode === "monitor" && (
                <div className="space-y-2">
                  <Label>Grupos a Monitorar (até 3) *</Label>
                  <Card>
                    <CardContent className="pt-4 max-h-40 overflow-y-auto">
                      {groups.map((group) => (
                        <div key={group.id} className="flex items-center space-x-2 mb-2">
                          <Checkbox
                            checked={formData.monitor_groups?.includes(group.wa_group_id)}
                            disabled={(formData.monitor_groups?.length || 0) >= 3 && !formData.monitor_groups?.includes(group.wa_group_id)}
                            onCheckedChange={(checked) => {
                              const current = formData.monitor_groups || [];
                              setFormData({
                                ...formData,
                                monitor_groups: checked
                                  ? [...current, group.wa_group_id]
                                  : current.filter((g) => g !== group.wa_group_id),
                              });
                            }}
                          />
                          <Label className="cursor-pointer">{group.name}</Label>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Stores */}
              <div className="space-y-2">
                <Label>Lojas *</Label>
                <Card>
                  <CardContent className="pt-4 grid grid-cols-2 gap-2">
                    {STORES.filter(store => activeStores.includes(store.value)).map((store) => (
                      <div key={store.value} className="flex items-center space-x-2">
                        <Checkbox
                          checked={formData.stores?.includes(store.value)}
                          onCheckedChange={(checked) => {
                            const current = formData.stores || [];
                            setFormData({
                              ...formData,
                              stores: checked
                                ? [...current, store.value]
                                : current.filter((s) => s !== store.value),
                            });
                          }}
                        />
                        <Label className="cursor-pointer">{store.label}</Label>
                      </div>
                    ))}
                    {activeStores.length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-2">
                        Nenhuma loja com credenciais ativas. Configure em Programas de Afiliado.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <Label>Categorias</Label>
                <Card>
                  <CardContent className="pt-4 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {CATEGORIES.map((cat) => (
                      <div key={cat} className="flex items-center space-x-2">
                        <Checkbox
                          checked={formData.categories?.includes(cat)}
                          onCheckedChange={(checked) => {
                            const current = formData.categories || [];
                            setFormData({
                              ...formData,
                              categories: checked
                                ? [...current, cat]
                                : current.filter((c) => c !== cat),
                            });
                          }}
                        />
                        <Label className="cursor-pointer">{cat}</Label>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Priority & Filter Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) => setFormData({ ...formData, priority: v as PriorityType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discount">Maior Desconto</SelectItem>
                      <SelectItem value="price">Maior Preço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Filtro</Label>
                  <Select
                    value={formData.filter_type}
                    onValueChange={(v) => setFormData({ ...formData, filter_type: v as FilterType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Leve (mais quantidade)</SelectItem>
                      <SelectItem value="heavy">Pesado (mais qualidade)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Desconto Mínimo (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.min_discount || ""}
                    onChange={(e) => setFormData({ ...formData, min_discount: Number(e.target.value) || undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço Mínimo (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.min_price || ""}
                    onChange={(e) => setFormData({ ...formData, min_price: Number(e.target.value) || undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço Máximo (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.max_price || ""}
                    onChange={(e) => setFormData({ ...formData, max_price: Number(e.target.value) || undefined })}
                  />
                </div>
              </div>

              {/* Texts */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Textos da Mensagem (até 3)</Label>
                  {(formData.texts?.length || 0) < 3 && (
                    <Button variant="outline" size="sm" onClick={addText}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar
                    </Button>
                  )}
                </div>
                {formData.texts?.map((text, index) => (
                  <div key={index} className="flex gap-2">
                    <Textarea
                      value={text}
                      onChange={(e) => updateText(index, e.target.value)}
                      placeholder="Ex: 🔥 Oferta imperdível!"
                      rows={2}
                    />
                    {formData.texts && formData.texts.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeText(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Configure suas credenciais em <strong>Programas de Afiliado</strong> para gerar links automaticamente.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingId ? "Salvar" : "Criar e Ativar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!whatsappConnected && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            WhatsApp desconectado — envios pausados. Conecte em WhatsApp.
          </AlertDescription>
        </Alert>
      )}

      {automations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Nenhuma automação criada ainda</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Automação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Automações</CardTitle>
            <CardDescription>
              {automations.length} automação{automations.length !== 1 ? "ões" : ""} configurada{automations.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Lojas</TableHead>
                  <TableHead>Intervalo</TableHead>
                  <TableHead>Janela</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Próxima</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {automations.map((auto) => (
                  <TableRow key={auto.id}>
                    <TableCell className="font-medium">{auto.name}</TableCell>
                    <TableCell>
                      <Badge variant={auto.mode === "search" ? "default" : "secondary"}>
                        {auto.mode === "search" ? "Busca" : "Monitor"}
                      </Badge>
                    </TableCell>
                    <TableCell>{auto.stores.length} loja{auto.stores.length !== 1 ? "s" : ""}</TableCell>
                    <TableCell>{auto.interval_minutes} min</TableCell>
                    <TableCell className="text-xs">
                      {auto.start_time} - {auto.end_time}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={auto.status === "active"}
                        onCheckedChange={() => toggleStatus(auto.id, auto.status)}
                      />
                    </TableCell>
                    <TableCell className="text-xs">
                      {auto.next_run_at ? format(new Date(auto.next_run_at), "dd/MM HH:mm") : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(auto)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(auto.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
