import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ScheduleMultipleGroups() {
  const [actionType, setActionType] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [payload, setPayload] = useState("");
  const [autoNumberGroups, setAutoNumberGroups] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAvailableGroups();
  }, []);

  const loadAvailableGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, wa_group_id')
        .order('name');

      if (error) throw error;
      setAvailableGroups(data || []);
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSchedule = async () => {
    if (!actionType || !scheduledDate || !scheduledTime) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha tipo de ação, data e hora",
      });
      return;
    }

    if (selectedGroups.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum grupo selecionado",
        description: "Selecione pelo menos um grupo",
      });
      return;
    }

    // Validação específica por tipo de ação
    if (['send_message', 'update_description', 'change_group_name'].includes(actionType) && !payload.trim()) {
      toast({
        variant: "destructive",
        title: "Conteúdo obrigatório",
        description: "Digite o conteúdo necessário para esta ação",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Combinar data e hora no timezone local
      const localDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
      
      // Criar jobs para cada grupo selecionado com espaçamento
      const jobsToCreate = selectedGroups.map((groupId, index) => {
        // Adicionar 5 segundos de espaçamento entre cada grupo
        const scheduledFor = new Date(localDateTime.getTime() + (index * 5000)).toISOString();
        
        let jobPayload: any = {
          groups: [groupId]
        };

        // Construir payload baseado no tipo de ação
        if (actionType === 'send_message') {
          jobPayload.message = payload;
        } else if (actionType === 'update_description') {
          jobPayload.description = payload;
        } else if (actionType === 'change_group_name') {
          // Se auto-numerar, adicionar o número ao nome
          if (autoNumberGroups) {
            jobPayload.name = `#${index + 1} ${payload}`;
            jobPayload.autoNumber = false;
          } else {
            jobPayload.name = payload;
            jobPayload.autoNumber = false;
          }
        }

        return {
          user_id: user.id,
          action_type: actionType as any,
          scheduled_for: scheduledFor,
          payload: jobPayload,
          status: 'pending' as const
        };
      });

      const { error } = await supabase
        .from('jobs')
        .insert(jobsToCreate);

      if (error) throw error;

      toast({
        title: "Ações agendadas!",
        description: `${selectedGroups.length} ação(ões) agendada(s) com sucesso`,
      });

      // Resetar form e fechar dialog
      setSelectedGroups([]);
      setActionType("");
      setScheduledDate("");
      setScheduledTime("");
      setPayload("");
      setAutoNumberGroups(false);
      setDialogOpen(false);

    } catch (error: any) {
      console.error('Erro ao agendar ações:', error);
      toast({
        variant: "destructive",
        title: "Erro ao agendar",
        description: error.message || "Tente novamente",
      });
    }
  };

  const getPayloadLabel = () => {
    switch (actionType) {
      case 'send_message':
        return { label: 'Mensagem', placeholder: 'Digite a mensagem a ser enviada...' };
      case 'update_description':
        return { label: 'Descrição', placeholder: 'Digite a nova descrição do grupo...' };
      case 'change_group_name':
        return { label: 'Nome do Grupo', placeholder: 'Digite o novo nome do grupo...' };
      default:
        return null;
    }
  };

  const payloadConfig = getPayloadLabel();

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Agendar em Vários Grupos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Ação em Múltiplos Grupos</DialogTitle>
          <DialogDescription>
            Agende a mesma ação para vários grupos de uma vez
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>ℹ️ Como funciona:</strong> Selecione os grupos e defina uma ação que será agendada para todos eles com 5 segundos de intervalo entre cada execução.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Tipo de Ação</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="send_message">Enviar Mensagem</SelectItem>
                <SelectItem value="update_description">Alterar Descrição</SelectItem>
                <SelectItem value="close_groups">Fechar Grupos</SelectItem>
                <SelectItem value="open_groups">Abrir Grupos</SelectItem>
                <SelectItem value="change_group_name">Alterar Nome do Grupo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Selecionar Grupos</Label>
            <div className="border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
              {availableGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum grupo disponível. Importe grupos primeiro.
                </p>
              ) : (
                availableGroups.map((group) => (
                  <div key={group.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={selectedGroups.includes(group.id)}
                      onCheckedChange={() => toggleGroup(group.id)}
                    />
                    <Label
                      htmlFor={`group-${group.id}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {group.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedGroups.length} grupo(s) selecionado(s)
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Hora</Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          {payloadConfig && (
            <div className="space-y-2">
              <Label htmlFor="payload">{payloadConfig.label}</Label>
              <Textarea
                id="payload"
                placeholder={payloadConfig.placeholder}
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={4}
              />
              {actionType === 'send_message' && payload.includes('@todos') && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Menção @todos detectada!</strong> Os participantes de cada grupo serão buscados dinamicamente no momento do envio. Certifique-se de que você tem permissão para visualizar os membros dos grupos.
                  </AlertDescription>
                </Alert>
              )}
              {actionType === 'change_group_name' && (
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="autoNumber"
                    checked={autoNumberGroups}
                    onCheckedChange={setAutoNumberGroups}
                  />
                  <Label htmlFor="autoNumber" className="text-sm cursor-pointer">
                    Numerar grupos automaticamente (#1, #2, #3...)
                  </Label>
                </div>
              )}
            </div>
          )}

          <Button onClick={handleSchedule} className="w-full" disabled={selectedGroups.length === 0}>
            Agendar para {selectedGroups.length || "0"} Grupo(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
