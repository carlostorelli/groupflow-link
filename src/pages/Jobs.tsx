import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Plus } from "lucide-react";

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

export default function Jobs() {
  const [jobs] = useState(mockJobs);
  const [actionType, setActionType] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [payload, setPayload] = useState("");
  const { toast } = useToast();

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
    };
    return labels[action] || action;
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
                  </SelectContent>
                </Select>
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

              {(actionType === "send_message" || actionType === "update_description") && (
                <div className="space-y-2">
                  <Label htmlFor="payload">
                    {actionType === "send_message" ? "Mensagem" : "Nova Descrição"}
                  </Label>
                  <Textarea
                    id="payload"
                    placeholder={
                      actionType === "send_message"
                        ? "Digite sua mensagem..."
                        : "Digite a nova descrição..."
                    }
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    rows={4}
                  />
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
