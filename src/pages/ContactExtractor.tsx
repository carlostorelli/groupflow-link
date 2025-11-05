import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Calendar, Users, UserPlus, Loader2, Filter } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  phone: string;
  isAdmin: boolean;
}

const mockGroups = [
  { id: "1", name: "Grupo 1" },
  { id: "2", name: "Grupo 2" },
  { id: "3", name: "Grupo VIP" },
];

export default function ContactExtractor() {
  const [groupLink, setGroupLink] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [inviteMessage, setInviteMessage] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [filterAdminsOnly, setFilterAdminsOnly] = useState(false);
  const { toast } = useToast();

  const handleExtract = async () => {
    if (!groupLink.trim()) {
      toast({
        variant: "destructive",
        title: "Link obrigatório",
        description: "Insira o link do grupo para extrair contatos",
      });
      return;
    }

    setIsExtracting(true);
    
    // Simulação de extração
    setTimeout(() => {
      const mockContacts: Contact[] = [
        { id: "1", name: "João Silva", phone: "+5511999999999", isAdmin: true },
        { id: "2", name: "Maria Santos", phone: "+5511988888888", isAdmin: false },
        { id: "3", name: "Pedro Costa", phone: "+5511977777777", isAdmin: false },
        { id: "4", name: "Ana Oliveira", phone: "+5511966666666", isAdmin: true },
        { id: "5", name: "Carlos Souza", phone: "+5511955555555", isAdmin: false },
        { id: "6", name: "Julia Lima", phone: "+5511944444444", isAdmin: false },
        { id: "7", name: "Roberto Alves", phone: "+5511933333333", isAdmin: false },
        { id: "8", name: "Fernanda Rocha", phone: "+5511922222222", isAdmin: false },
      ];
      
      setContacts(mockContacts);
      setIsExtracting(false);
      
      toast({
        title: "Contatos extraídos!",
        description: `${mockContacts.length} contatos foram extraídos do grupo`,
      });
    }, 2000);
  };

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const toggleAll = () => {
    const filteredContacts = filterAdminsOnly 
      ? contacts.filter(c => !c.isAdmin)
      : contacts;
    
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id));
    }
  };

  const handleScheduleInvites = () => {
    if (selectedContacts.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum contato selecionado",
        description: "Selecione ao menos um contato para enviar convites",
      });
      return;
    }

    if (!targetGroupId) {
      toast({
        variant: "destructive",
        title: "Grupo não selecionado",
        description: "Selecione o grupo destino para os convites",
      });
      return;
    }

    if (!inviteMessage.trim()) {
      toast({
        variant: "destructive",
        title: "Mensagem obrigatória",
        description: "Digite uma mensagem de convite",
      });
      return;
    }

    toast({
      title: "Convites agendados!",
      description: `${selectedContacts.length} convite(s) agendado(s) com sucesso`,
    });
  };

  const exportContacts = () => {
    const selectedContactsData = contacts.filter(c => 
      selectedContacts.includes(c.id)
    );
    
    const csv = [
      "Nome,Telefone,Admin",
      ...selectedContactsData.map(c => 
        `${c.name},${c.phone},${c.isAdmin ? "Sim" : "Não"}`
      )
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contatos.csv";
    a.click();
    
    toast({
      title: "Contatos exportados!",
      description: "Arquivo CSV baixado com sucesso",
    });
  };

  const filteredContacts = filterAdminsOnly 
    ? contacts.filter(c => !c.isAdmin)
    : contacts;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Extrator de Contatos</h1>
        <p className="text-muted-foreground mt-2">
          Extraia contatos de grupos e envie convites programados
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Extrair Contatos do Grupo</CardTitle>
          <CardDescription>
            Insira o link do grupo para extrair todos os contatos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-link">Link do Grupo WhatsApp</Label>
            <div className="flex gap-2">
              <Input
                id="group-link"
                placeholder="https://chat.whatsapp.com/..."
                value={groupLink}
                onChange={(e) => setGroupLink(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleExtract}
                disabled={isExtracting || !groupLink.trim()}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extraindo...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Extrair
                  </>
                )}
              </Button>
            </div>
          </div>

          {contacts.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">
                  {contacts.length} contatos extraídos
                </span>
              </div>
              <Badge className="bg-gradient-success">
                Extração concluída
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {contacts.length > 0 && (
        <>
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contatos Extraídos</CardTitle>
                  <CardDescription>
                    {selectedContacts.length} contato(s) selecionado(s)
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportContacts}
                    disabled={selectedContacts.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        disabled={selectedContacts.length === 0}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Programar Convites
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Programar Envio de Convites</DialogTitle>
                        <DialogDescription>
                          Configure o envio automático de convites para os contatos selecionados
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="target-group">Grupo Destino</Label>
                          <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                            <SelectTrigger id="target-group">
                              <SelectValue placeholder="Selecione o grupo" />
                            </SelectTrigger>
                            <SelectContent>
                              {mockGroups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                  {group.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="invite-message">Mensagem do Convite</Label>
                          <Textarea
                            id="invite-message"
                            placeholder="Olá! Gostaria de te convidar para participar do nosso grupo..."
                            value={inviteMessage}
                            onChange={(e) => setInviteMessage(e.target.value)}
                            rows={4}
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="schedule-date">Data</Label>
                            <Input
                              id="schedule-date"
                              type="date"
                              value={scheduledDate}
                              onChange={(e) => setScheduledDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="schedule-time">Hora</Label>
                            <Input
                              id="schedule-time"
                              type="time"
                              value={scheduledTime}
                              onChange={(e) => setScheduledTime(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                          <p className="text-sm">
                            <strong>Resumo:</strong> {selectedContacts.length} convite(s) serão enviados
                            {scheduledDate && scheduledTime 
                              ? ` em ${scheduledDate} às ${scheduledTime}`
                              : " imediatamente"}
                          </p>
                        </div>

                        <Button onClick={handleScheduleInvites} className="w-full">
                          <Calendar className="mr-2 h-4 w-4" />
                          {scheduledDate && scheduledTime ? "Agendar Convites" : "Enviar Agora"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="filter-admins"
                      checked={filterAdminsOnly}
                      onCheckedChange={(checked) => {
                        setFilterAdminsOnly(checked as boolean);
                        setSelectedContacts([]);
                      }}
                    />
                    <Label
                      htmlFor="filter-admins"
                      className="text-sm font-normal cursor-pointer"
                    >
                      <Filter className="inline h-3 w-3 mr-1" />
                      Excluir administradores
                    </Label>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedContacts.includes(contact.id)}
                            onCheckedChange={() => toggleContact(contact.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell>{contact.phone}</TableCell>
                        <TableCell>
                          {contact.isAdmin ? (
                            <Badge variant="outline" className="bg-primary/10">
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline">Membro</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Como funciona?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  O extrator de contatos permite capturar participantes de grupos e enviar convites automatizados:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Cole o link do grupo WhatsApp para extrair os contatos</li>
                  <li>Selecione os contatos que deseja convidar</li>
                  <li>Opcionalmente, filtre para excluir administradores</li>
                  <li>Escolha o grupo destino para onde enviar os convites</li>
                  <li>Personalize a mensagem de convite</li>
                  <li>Agende o envio ou envie imediatamente</li>
                </ol>
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm">
                    <strong>Dica:</strong> Use a opção de agendamento para enviar convites gradualmente 
                    e evitar ser bloqueado pelo WhatsApp
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
