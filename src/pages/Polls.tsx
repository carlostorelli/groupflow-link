import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Send, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Poll {
  id: string;
  title: string;
  question: string;
  options: string[];
  created_at: string;
}

export default function Polls() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Form states
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  
  // Data states
  const [instances, setInstances] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  
  // Schedule dialog
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    loadPolls();
    loadInstances();
  }, []);

  useEffect(() => {
    if (selectedInstance) {
      loadGroups(selectedInstance);
    }
  }, [selectedInstance]);

  const loadPolls = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("polls")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPolls((data || []).map(poll => ({
        ...poll,
        options: poll.options as unknown as string[]
      })));
    } catch (error) {
      console.error("Erro ao carregar enquetes:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as enquetes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadInstances = async () => {
    try {
      const { data, error } = await supabase
        .from("instances")
        .select("*")
        .eq("status", "connected");

      if (error) throw error;
      setInstances(data || []);
    } catch (error) {
      console.error("Erro ao carregar instâncias:", error);
    }
  };

  const loadGroups = async (instanceId: string) => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("instance_id", instanceId)
        .eq("is_admin", true)
        .order("name");

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error("Erro ao carregar grupos:", error);
    }
  };

  const addOption = () => {
    if (options.length < 12) {
      setOptions([...options, ""]);
    } else {
      toast({
        title: "Limite atingido",
        description: "Você pode adicionar no máximo 12 opções",
        variant: "destructive",
      });
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const savePoll = async () => {
    if (!title.trim() || !question.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o título e a pergunta",
        variant: "destructive",
      });
      return;
    }

    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      toast({
        title: "Opções insuficientes",
        description: "A enquete precisa ter pelo menos 2 opções",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("polls").insert({
        user_id: user.id,
        title,
        question,
        options: validOptions,
        instance_id: selectedInstance || instances[0]?.id,
      });

      if (error) throw error;

      toast({
        title: "Enquete salva!",
        description: "A enquete foi salva com sucesso",
      });

      // Reset form
      setTitle("");
      setQuestion("");
      setOptions(["", ""]);
      
      loadPolls();
    } catch (error) {
      console.error("Erro ao salvar enquete:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a enquete",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const sendPoll = async (pollId: string) => {
    if (!selectedInstance || selectedGroups.length === 0) {
      toast({
        title: "Seleção necessária",
        description: "Selecione uma instância e pelo menos um grupo",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const poll = polls.find(p => p.id === pollId);
      if (!poll) throw new Error("Enquete não encontrada");

      const instance = instances.find(i => i.id === selectedInstance);
      if (!instance) throw new Error("Instância não encontrada");

      for (const groupId of selectedGroups) {
        const group = groups.find(g => g.id === groupId);
        if (!group) continue;

        const { error } = await supabase.functions.invoke("evolution-send-poll", {
          body: {
            instanceName: instance.instance_id,
            groupId: group.wa_group_id,
            question: poll.question,
            options: poll.options,
          },
        });

        if (error) {
          console.error(`Erro ao enviar para grupo ${group.name}:`, error);
          throw error;
        }
      }

      toast({
        title: "Enquete enviada!",
        description: `Enquete enviada para ${selectedGroups.length} grupo(s)`,
      });

      setSelectedGroups([]);
    } catch (error) {
      console.error("Erro ao enviar enquete:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a enquete",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const schedulePoll = async () => {
    if (!scheduledDate || !scheduledTime || !selectedPollId) {
      toast({
        title: "Dados incompletos",
        description: "Preencha a data e hora do agendamento",
        variant: "destructive",
      });
      return;
    }

    if (selectedGroups.length === 0) {
      toast({
        title: "Grupos necessários",
        description: "Selecione pelo menos um grupo",
        variant: "destructive",
      });
      return;
    }

    try {
      const poll = polls.find(p => p.id === selectedPollId);
      if (!poll) throw new Error("Enquete não encontrada");

      const instance = instances.find(i => i.id === selectedInstance);
      if (!instance) throw new Error("Instância não encontrada");

      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      for (const groupId of selectedGroups) {
        const group = groups.find(g => g.id === groupId);
        if (!group) continue;

        const { error } = await supabase.from("jobs").insert({
          user_id: user.id,
          action_type: "send_message" as const,
          poll_id: selectedPollId,
          scheduled_for: scheduledFor.toISOString(),
          payload: {
            type: "poll",
            instanceName: instance.instance_id,
            groupId: group.wa_group_id,
            question: poll.question,
            options: poll.options,
          },
        });

        if (error) throw error;
      }

      toast({
        title: "Enquete agendada!",
        description: `Enquete agendada para ${scheduledDate} às ${scheduledTime}`,
      });

      setShowScheduleDialog(false);
      setScheduledDate("");
      setScheduledTime("");
      setSelectedPollId(null);
      setSelectedGroups([]);
    } catch (error) {
      console.error("Erro ao agendar enquete:", error);
      toast({
        title: "Erro",
        description: "Não foi possível agendar a enquete",
        variant: "destructive",
      });
    }
  };

  const deletePoll = async (pollId: string) => {
    try {
      const { error } = await supabase
        .from("polls")
        .delete()
        .eq("id", pollId);

      if (error) throw error;

      toast({
        title: "Enquete excluída",
        description: "A enquete foi excluída com sucesso",
      });

      loadPolls();
    } catch (error) {
      console.error("Erro ao excluir enquete:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a enquete",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Enquetes</h1>
        <p className="text-muted-foreground mt-2">
          Crie e envie enquetes para seus grupos
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Criar Nova Enquete</CardTitle>
          <CardDescription>
            Preencha os dados para criar uma nova enquete
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título da Enquete</Label>
            <Input
              id="title"
              placeholder="Ex: Enquete sobre horários"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="question">Pergunta</Label>
            <Textarea
              id="question"
              placeholder="Digite a pergunta da enquete"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Opções de Resposta (mín: 2, máx: 12)</Label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Opção ${index + 1}`}
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                />
                {options.length > 2 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeOption(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 12 && (
              <Button
                variant="outline"
                onClick={addOption}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Opção
              </Button>
            )}
          </div>

          <Button onClick={savePoll} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Enquete"
            )}
          </Button>
        </CardContent>
      </Card>

      {polls.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Enquetes Salvas</CardTitle>
            <CardDescription>
              Gerencie e envie suas enquetes para os grupos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Instância</Label>
                <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.instance_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Grupos</Label>
                <Select
                  value={selectedGroups[0] || ""}
                  onValueChange={(value) => {
                    if (!selectedGroups.includes(value)) {
                      setSelectedGroups([...selectedGroups, value]);
                    }
                  }}
                  disabled={!selectedInstance}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione grupos" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedGroups.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedGroups.map((groupId) => {
                      const group = groups.find(g => g.id === groupId);
                      return (
                        <span
                          key={groupId}
                          className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm flex items-center gap-2"
                        >
                          {group?.name}
                          <button
                            onClick={() => setSelectedGroups(selectedGroups.filter(g => g !== groupId))}
                            className="hover:text-destructive"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Pergunta</TableHead>
                  <TableHead>Opções</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (
                  polls.map((poll) => (
                    <TableRow key={poll.id}>
                      <TableCell className="font-medium">{poll.title}</TableCell>
                      <TableCell>{poll.question}</TableCell>
                      <TableCell>{poll.options.length} opções</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => sendPoll(poll.id)}
                            disabled={sending || !selectedInstance || selectedGroups.length === 0}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Enviar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPollId(poll.id);
                              setShowScheduleDialog(true);
                            }}
                            disabled={!selectedInstance || selectedGroups.length === 0}
                          >
                            <Calendar className="h-4 w-4 mr-1" />
                            Agendar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deletePoll(poll.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Enquete</DialogTitle>
            <DialogDescription>
              Escolha a data e hora para enviar a enquete
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={schedulePoll}>
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
