import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Plus, Sparkles, Loader2, AtSign, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  action_type: string;
  scheduled_for: string;
  status: string;
  payload: any;
}

interface Group {
  id: string;
  name: string;
  wa_group_id: string;
}

export default function Jobs() {
  const queryClient = useQueryClient();
  const [actionType, setActionType] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [payload, setPayload] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  // Carregar jobs do banco de dados
  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('scheduled_for', { ascending: false });

      if (error) throw error;
      return data as Job[];
    },
  });

  // Carregar grupos do usuário
  const { data: groups = [] } = useQuery({
    queryKey: ['user-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, wa_group_id')
        .order('name');

      if (error) throw error;
      return data as Group[];
    },
  });

  // Mutation para criar novo job
  const createJobMutation = useMutation({
    mutationFn: async (newJob: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('jobs')
        .insert({
          user_id: user.id,
          action_type: newJob.action_type,
          scheduled_for: newJob.scheduled_for,
          payload: newJob.payload,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: "Ação agendada!",
        description: "A ação será executada no horário programado",
      });
      // Resetar form
      setActionType("");
      setScheduledDate("");
      setScheduledTime("");
      setPayload("");
      setMediaFile(null);
      setSelectedGroups([]);
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao agendar",
        description: error.message,
      });
    },
  });

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const insertMention = (mention: string) => {
    setPayload(prev => prev + mention);
    setMentionOpen(false);
  };

  const handleScheduleJob = async () => {
    if (!actionType || !scheduledDate || !scheduledTime) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para agendar a ação",
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

    // Construir payload baseado no tipo de ação
    let jobPayload: any = {
      groups: selectedGroups,
    };

    if (actionType === 'send_message') {
      if (!payload.trim()) {
        toast({
          variant: "destructive",
          title: "Mensagem vazia",
          description: "Digite uma mensagem para enviar",
        });
        return;
      }
      jobPayload.message = payload;
    } else if (actionType === 'update_description') {
      jobPayload.description = payload;
    } else if (actionType === 'change_group_name') {
      jobPayload.name = payload;
    }

    // Combinar data e hora
    const scheduledFor = `${scheduledDate}T${scheduledTime}:00`;

    createJobMutation.mutate({
      action_type: actionType,
      scheduled_for: scheduledFor,
      payload: jobPayload,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "Pendente", className: "bg-primary" },
      running: { label: "Executando", className: "bg-gradient-primary" },
      done: { label: "Concluído", className: "bg-gradient-success" },
      failed: { label: "Falhou", className: "bg-destructive" },
    };

    const variant = variants[status] || variants.pending;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      send_message: "Enviar Mensagem",
      update_description: "Alterar Descrição",
      close_groups: "Fechar Grupos",
      open_groups: "Abrir Grupos",
      change_group_name: "Alterar Nome do Grupo",
      change_group_photo: "Alterar Foto do Grupo",
    };
    return labels[action] || action;
  };

  const handleEnhanceMessage = async () => {
    if (!payload.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Digite uma mensagem primeiro",
      });
      return;
    }

    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke("enhance-message", {
        body: { message: payload },
      });

      if (error) throw error;

      if (data?.enhancedMessage) {
        setPayload(data.enhancedMessage);
        toast({
          title: "Mensagem melhorada!",
          description: "A IA aprimorou sua mensagem",
        });
      }
    } catch (error) {
      console.error("Erro ao melhorar mensagem:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível melhorar a mensagem",
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Agendamentos</h1>
          <p className="text-muted-foreground mt-2">
            Agende ações para serem executadas automaticamente
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Agendar Nova Ação</DialogTitle>
              <DialogDescription>
                Configure uma ação para ser executada em uma data e hora específicas
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="action-type">Tipo de Ação</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger id="action-type">
                    <SelectValue placeholder="Selecione uma ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="send_message">Enviar Mensagem</SelectItem>
                    <SelectItem value="update_description">Alterar Descrição</SelectItem>
                    <SelectItem value="close_groups">Fechar Grupos</SelectItem>
                    <SelectItem value="open_groups">Abrir Grupos</SelectItem>
                    <SelectItem value="change_group_name">Alterar Nome do Grupo</SelectItem>
                    <SelectItem value="change_group_photo">Alterar Foto do Grupo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Selecionar Grupos</Label>
                <div className="border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
                  {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum grupo disponível. Importe grupos primeiro.
                    </p>
                  ) : (
                    groups.map((group) => (
                      <div key={group.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`group-${group.id}`}
                          checked={selectedGroups.includes(group.id)}
                          onCheckedChange={() => toggleGroup(group.id)}
                        />
                        <Label
                          htmlFor={`group-${group.id}`}
                          className="text-sm font-normal cursor-pointer"
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

              {actionType === "send_message" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="payload">Mensagem</Label>
                      <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="sm">
                            <AtSign className="mr-2 h-4 w-4" />
                            Mencionar
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                          <Command>
                            <CommandInput placeholder="Buscar..." />
                            <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem onSelect={() => insertMention("@todos ")}>
                                <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                                @todos
                              </CommandItem>
                              <CommandItem onSelect={() => insertMention("@pessoa ")}>
                                <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                                @pessoa
                              </CommandItem>
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Textarea
                      id="payload"
                      placeholder="Digite sua mensagem... Use @todos para mencionar todos ou @pessoa para mencionar alguém específico"
                      value={payload}
                      onChange={(e) => setPayload(e.target.value)}
                      rows={4}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleEnhanceMessage}
                      disabled={isEnhancing || !payload.trim()}
                      className="w-full"
                    >
                      {isEnhancing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Melhorando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Melhorar com IA
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="media">Anexar Imagem/Vídeo (opcional)</Label>
                    <Input
                      id="media"
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                    />
                    {mediaFile && (
                      <p className="text-sm text-muted-foreground">
                        Arquivo selecionado: {mediaFile.name}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {actionType === "update_description" && (
                <div className="space-y-2">
                  <Label htmlFor="payload">Nova Descrição</Label>
                  <Textarea
                    id="payload"
                    placeholder="Digite a nova descrição..."
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    rows={4}
                  />
                </div>
              )}

              {actionType === "change_group_name" && (
                <div className="space-y-2">
                  <Label htmlFor="payload">Novo Nome do Grupo</Label>
                  <Input
                    id="payload"
                    placeholder="Digite o novo nome..."
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                  />
                </div>
              )}

              {actionType === "change_group_photo" && (
                <div className="space-y-2">
                  <Label htmlFor="group-photo">Nova Foto do Grupo</Label>
                  <Input
                    id="group-photo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                  />
                  {mediaFile && (
                    <p className="text-sm text-muted-foreground">
                      Arquivo selecionado: {mediaFile.name}
                    </p>
                  )}
                </div>
              )}

              <Button 
                onClick={handleScheduleJob} 
                className="w-full"
                disabled={createJobMutation.isPending}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {createJobMutation.isPending ? 'Agendando...' : 'Agendar Ação'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Disclaimer sobre ações administrativas */}
      <Alert variant="warning">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>ATENÇÃO</AlertTitle>
        <AlertDescription>
          Fechar grupos, Abrir grupos, Alterar nome, Alterar foto e Alterar descrição{" "}
          <strong>só funcionam em grupos ao qual você é administrador, caso contrário dará erro!</strong>
        </AlertDescription>
      </Alert>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Ações Agendadas</CardTitle>
          <CardDescription>
            Lista de todas as ações programadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingJobs ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum agendamento criado ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ação</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      {getActionLabel(job.action_type)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {new Date(job.scheduled_for).toLocaleString('pt-BR')}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Como funcionam os agendamentos?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              O sistema de agendamentos permite que você programe ações para serem executadas
              automaticamente em uma data e hora específicas:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong>Enviar Mensagem:</strong> Envia uma mensagem para todos os grupos
                selecionados
              </li>
              <li>
                <strong>Alterar Descrição:</strong> Atualiza a descrição de múltiplos grupos
              </li>
              <li>
                <strong>Fechar/Abrir Grupos:</strong> Altera as configurações de privacidade
              </li>
              <li>
                <strong>Alterar Nome do Grupo:</strong> Atualiza o nome de grupos específicos
              </li>
              <li>
                <strong>Alterar Foto do Grupo:</strong> Atualiza a foto de grupos específicos
              </li>
            </ul>
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm">
                <strong>Nota:</strong> As ações são executadas por um cron job no servidor. Você
                pode monitorar o status de cada agendamento nesta página.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
