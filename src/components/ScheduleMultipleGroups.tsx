import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, AlertCircle, X, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ScheduleMultipleGroups() {
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"open" | "closed" | "none">("none");
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGroupPhoto(file);
      toast({
        title: "Foto selecionada",
        description: file.name,
      });
    }
  };

  const handleSchedule = async () => {
    if (!scheduledDate || !scheduledTime) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha data e hora",
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

    // Verificar se pelo menos uma ação foi configurada
    if (!groupName.trim() && !description.trim() && !message.trim() && status === "none" && !groupPhoto) {
      toast({
        variant: "destructive",
        title: "Nenhuma ação configurada",
        description: "Configure pelo menos uma ação (nome, descrição, mensagem, status ou foto)",
      });
      return;
    }

    try {
      // Converter foto para base64 se existir
      let photoBase64 = null;
      if (groupPhoto) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(groupPhoto);
        });
        photoBase64 = dataUrl.split(',')[1] || dataUrl;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Combinar data e hora no timezone local
      const localDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
      
      // Criar jobs para cada grupo selecionado
      const jobsToCreate = [];
      const selectedGroupsData = availableGroups.filter(g => selectedGroups.includes(g.id));

      for (let i = 0; i < selectedGroupsData.length; i++) {
        const group = selectedGroupsData[i];
        const baseTime = localDateTime.getTime() + (i * 8000); // 8 segundos entre grupos
        let actionDelay = 0;

        // Job para mudar nome (se fornecido)
        if (groupName.trim()) {
          const numberedGroupName = `#${i + 1} ${groupName}`;
          jobsToCreate.push({
            user_id: user.id,
            action_type: 'change_group_name',
            scheduled_for: new Date(baseTime + actionDelay).toISOString(),
            payload: {
              groups: [group.id],
              name: numberedGroupName,
              autoNumber: false
            },
            status: 'pending'
          });
          actionDelay += 2000;
        }

        // Job para mudar foto (se fornecida)
        if (photoBase64) {
          jobsToCreate.push({
            user_id: user.id,
            action_type: 'change_group_photo',
            scheduled_for: new Date(baseTime + actionDelay).toISOString(),
            payload: {
              groups: [group.id],
              image: photoBase64
            },
            status: 'pending'
          });
          actionDelay += 2000;
        }

        // Job para mudar descrição (se fornecida)
        if (description.trim()) {
          jobsToCreate.push({
            user_id: user.id,
            action_type: 'update_description',
            scheduled_for: new Date(baseTime + actionDelay).toISOString(),
            payload: {
              groups: [group.id],
              description: description
            },
            status: 'pending'
          });
          actionDelay += 2000;
        }

        // Job para mudar status (se diferente de "none")
        if (status !== "none") {
          jobsToCreate.push({
            user_id: user.id,
            action_type: status === 'closed' ? 'close_groups' : 'open_groups',
            scheduled_for: new Date(baseTime + actionDelay).toISOString(),
            payload: {
              groups: [group.id]
            },
            status: 'pending'
          });
          actionDelay += 2000;
        }

        // Job para enviar mensagem (se fornecida)
        if (message.trim()) {
          jobsToCreate.push({
            user_id: user.id,
            action_type: 'send_message',
            scheduled_for: new Date(baseTime + actionDelay).toISOString(),
            payload: {
              groups: [group.id],
              message: message
            },
            status: 'pending'
          });
        }
      }

      const { error } = await supabase
        .from('jobs')
        .insert(jobsToCreate);

      if (error) throw error;

      toast({
        title: "Ações agendadas!",
        description: `${jobsToCreate.length} ação(ões) agendada(s) para ${selectedGroups.length} grupo(s)`,
      });

      // Resetar form e fechar dialog
      setSelectedGroups([]);
      setGroupName("");
      setDescription("");
      setMessage("");
      setStatus("none");
      setGroupPhoto(null);
      setScheduledDate("");
      setScheduledTime("");
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
          <DialogTitle>Agendar Ações em Múltiplos Grupos</DialogTitle>
          <DialogDescription>
            Configure múltiplas ações para vários grupos e agende para uma data/hora específica
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>ℹ️ Como funciona:</strong> Configure as ações desejadas (nome, descrição, status, foto e/ou mensagem) e escolha quando serão executadas. As ações serão aplicadas automaticamente em todos os grupos selecionados.
            </AlertDescription>
          </Alert>

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
              {selectedGroups.length} grupo(s) selecionado(s) - Receberão numeração: #1, #2, #3...
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupName">Nome Base dos Grupos (opcional)</Label>
            <Input
              id="groupName"
              placeholder="Ex: Ofertas Shopee"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            {groupName.trim() && (
              <p className="text-xs text-muted-foreground">
                Os grupos serão renomeados para: #1 {groupName}, #2 {groupName}, #3 {groupName}...
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição dos Grupos (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Ex: Grupo exclusivo para ofertas e descontos diários da Shopee"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status dos Grupos (opcional)</Label>
            <Select value={status} onValueChange={(value: "open" | "closed" | "none") => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não alterar</SelectItem>
                <SelectItem value="open">🔓 Aberto - Todos podem comentar</SelectItem>
                <SelectItem value="closed">🔒 Fechado - Apenas admins podem escrever</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupPhoto">Foto dos Grupos (opcional)</Label>
            <div className="flex gap-2">
              <Input
                id="groupPhoto"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="flex-1"
              />
              {groupPhoto && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setGroupPhoto(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {groupPhoto && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>{groupPhoto.name}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem (opcional)</Label>
            <Textarea
              id="message"
              placeholder="Digite a mensagem a ser enviada... Use @todos para mencionar todos"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
            {message.includes('@todos') && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Menção @todos detectada!</strong> Os participantes de cada grupo serão buscados dinamicamente no momento do envio. Certifique-se de que você tem permissão para visualizar os membros dos grupos.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Button onClick={handleSchedule} className="w-full" disabled={selectedGroups.length === 0}>
            Agendar Ações para {selectedGroups.length || "0"} Grupo(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
