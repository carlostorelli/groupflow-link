import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Loader2, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Contact {
  id: string;
  name: string;
  phone: string;
  isAdmin: boolean;
}

export default function ContactExtractor() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [filterAdminsOnly, setFilterAdminsOnly] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [adminGroups, setAdminGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const { toast } = useToast();

  // Carregar grupos onde o usuário é admin
  useEffect(() => {
    const loadAdminGroups = async () => {
      setLoadingGroups(true);
      try {
        const { data, error } = await supabase
          .from("groups")
          .select("id, name, wa_group_id, members_count, instance_id")
          .eq("is_admin", true)
          .order("name");

        if (error) throw error;

        setAdminGroups(data || []);
      } catch (error) {
        console.error("Erro ao carregar grupos:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar seus grupos",
          variant: "destructive",
        });
      } finally {
        setLoadingGroups(false);
      }
    };

    loadAdminGroups();
  }, [toast]);

  const handleExtract = async () => {
    if (!selectedGroupId) {
      toast({
        variant: "destructive",
        title: "Grupo obrigatório",
        description: "Selecione um grupo para extrair contatos",
      });
      return;
    }

    setIsExtracting(true);
    
    try {
      const selectedGroup = adminGroups.find(g => g.id === selectedGroupId);
      if (!selectedGroup) {
        throw new Error("Grupo não encontrado");
      }

      // Buscar instância do grupo
      const { data: instanceData, error: instanceError } = await supabase
        .from("instances")
        .select("instance_id")
        .eq("id", selectedGroup.instance_id)
        .single();

      if (instanceError || !instanceData) {
        throw new Error("Instância não encontrada");
      }

      const requestBody = {
        useGroupId: true,
        instanceName: instanceData.instance_id,
        groupId: selectedGroup.wa_group_id,
      };

      const { data, error } = await supabase.functions.invoke("extract-contacts", {
        body: requestBody,
      });

      if (error) {
        console.error("Error extracting contacts:", error);
        throw error;
      }

      console.log("Extraction response:", data);

      if (data && data.contacts && data.contacts.length > 0) {
        // Convert API response to our Contact format
        const extractedContacts: Contact[] = data.contacts.map((contact: any, index: number) => ({
          id: contact.id || `contact-${index}`,
          name: contact.name || contact.pushname || contact.phone,
          phone: contact.phone || contact.id?.replace("@c.us", ""),
          isAdmin: contact.isAdmin || false,
        }));

        setContacts(extractedContacts);
        
        toast({
          title: "Contatos extraídos!",
          description: `${extractedContacts.length} contato(s) extraído(s) do grupo`,
        });
      } else {
        // Fallback to show the API is not fully configured
        toast({
          variant: "destructive",
          title: "API não configurada",
          description: data?.message || "Configure a integração com WhatsApp para extrair contatos reais",
        });
      }
    } catch (error) {
      console.error("Error in extraction:", error);
      toast({
        variant: "destructive",
        title: "Erro na extração",
        description: "Não foi possível extrair os contatos. Verifique se sua instância WhatsApp está conectada.",
      });
    } finally {
      setIsExtracting(false);
    }
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

  const exportContacts = async () => {
    const selectedContactsData = contacts.filter(c => 
      selectedContacts.includes(c.id)
    );
    
    try {
      // Carregar o template
      const response = await fetch("/templates/contacts-template.xlsx");
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      
      // Assumindo que a primeira planilha é onde vamos adicionar os dados
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Converter planilha para JSON para facilitar manipulação
      const existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      // Pegar o cabeçalho (primeira linha)
      const headers = existingData[0] || [];
      
      // Mapear os contatos para o formato da planilha
      // Coluna C (índice 2) = WhatsApp
      const contactRows = selectedContactsData.map(contact => {
        const row = new Array(headers.length).fill("");
        
        // Coluna C (índice 2) = WhatsApp (como string, não número)
        row[2] = contact.phone;
        
        return row;
      });
      
      // Criar nova planilha com os dados
      const newData = [headers, ...contactRows];
      const newWorksheet = XLSX.utils.aoa_to_sheet(newData);
      
      // Forçar a coluna C (WhatsApp) como formato de texto explicitamente
      const range = XLSX.utils.decode_range(newWorksheet['!ref'] || 'A1');
      for (let row = 1; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: 2 }); // Coluna C
        if (newWorksheet[cellAddress]) {
          // Definir como string e não número
          newWorksheet[cellAddress].t = 's'; // tipo string
          newWorksheet[cellAddress].v = String(newWorksheet[cellAddress].v); // valor como string
        }
      }
      
      // Substituir a planilha no workbook
      workbook.Sheets[firstSheetName] = newWorksheet;
      
      // Gerar o arquivo
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "contatos-extraidos.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Contatos exportados!",
        description: "Planilha Excel baixada com sucesso",
      });
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast({
        variant: "destructive",
        title: "Erro na exportação",
        description: "Não foi possível exportar a planilha",
      });
    }
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

      <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
            ⚠️ Aviso Importante
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-orange-900 dark:text-orange-200">
            <strong>Use esta ferramenta com responsabilidade!</strong> O uso inadequado pode resultar no bloqueio temporário ou permanente do seu número pelo WhatsApp.
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-orange-900 dark:text-orange-200">
            <li>Não extraia contatos de grupos que você não administra sem permissão</li>
            <li>Evite enviar mensagens em massa para muitos contatos de uma só vez</li>
            <li>Respeite a privacidade dos membros dos grupos</li>
            <li>Use intervalos adequados entre mensagens (mínimo 3-5 segundos)</li>
            <li>Não envie spam ou mensagens não solicitadas</li>
            <li>Siga os Termos de Serviço do WhatsApp</li>
          </ul>
          <p className="text-sm text-orange-900 dark:text-orange-200 font-medium">
            💡 Dica: Use a funcionalidade de agendamento para enviar mensagens gradualmente ao longo do tempo.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Extrair Contatos do Grupo</CardTitle>
          <CardDescription>
            Selecione um grupo que você administra para extrair todos os contatos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-select">Selecione o Grupo</Label>
            <Select
              value={selectedGroupId}
              onValueChange={setSelectedGroupId}
              disabled={isExtracting || loadingGroups}
            >
              <SelectTrigger id="group-select">
                <SelectValue placeholder={loadingGroups ? "Carregando grupos..." : "Selecione um grupo"} />
              </SelectTrigger>
              <SelectContent>
                {loadingGroups ? (
                  <SelectItem value="loading" disabled>
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Carregando...
                  </SelectItem>
                ) : adminGroups.length === 0 ? (
                  <SelectItem value="empty" disabled>
                    Nenhum grupo disponível
                  </SelectItem>
                ) : (
                  adminGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.members_count} membros)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Apenas grupos onde você é administrador
            </p>
          </div>

          <Button
            onClick={handleExtract}
            disabled={isExtracting || !selectedGroupId || loadingGroups}
            className="w-full"
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

          {contacts.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
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
