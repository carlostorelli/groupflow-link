import { useState } from "react";
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

const mockJobs = [
  {
    id: "1",
    action: "send_message",
    scheduledFor: "2024-12-01 14:00",
    status: "pending",
  },
  {
    id: "2",
    action: "update_description",
    scheduledFor: "2024-12-02 09:00",
    status: "pending",
  },
  {
    id: "3",
    action: "close_groups",
    scheduledFor: "2024-11-30 18:00",
    status: "done",
  },
];

const mockGroups = [
  { id: "1", name: "Grupo 1" },
  { id: "2", name: "Grupo 2" },
  { id: "3", name: "Grupo 3" },
  { id: "4", name: "Grupo VIP" },
];

export default function Jobs() {
  const [jobs] = useState(mockJobs);
  const [actionType, setActionType] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [payload, setPayload] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const { toast } = useToast();

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

  const handleScheduleJob = () => {
    if (!actionType || !scheduledDate || !scheduledTime) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para agendar a ação",
      });
      return;
    }

    toast({
      title: "Ação agendada!",
      description: `Sua ação será executada em ${scheduledDate} às ${scheduledTime}`,
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

        <Dialog>
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
                  {mockGroups.map((group) => (
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
                  ))}
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

              <Button onClick={handleScheduleJob} className="w-full">
                <Calendar className="mr-2 h-4 w-4" />
                Agendar Ação
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
                    {getActionLabel(job.action)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {job.scheduledFor}
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
