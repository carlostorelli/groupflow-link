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
import { Plus, X, Upload, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CreateMultipleGroups() {
  const [groupName, setGroupName] = useState("Grupo");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  // Carregar grupos disponíveis
  useEffect(() => {
    loadAvailableGroups();
  }, []);

  const loadAvailableGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, wa_group_id, is_admin')
        .eq('is_admin', true)
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

  const handleCreate = async () => {
    if (selectedGroups.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum grupo selecionado",
        description: "Selecione pelo menos um grupo para aplicar as configurações",
      });
      return;
    }

    try {
      // Converter foto para base64 se existir
      let photoBase64 = null;
      if (groupPhoto) {
        const reader = new FileReader();
        photoBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(groupPhoto);
        });
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Criar jobs para cada grupo selecionado
      const jobsToCreate = [];
      const selectedGroupsData = availableGroups.filter(g => selectedGroups.includes(g.id));

      for (let i = 0; i < selectedGroupsData.length; i++) {
        const group = selectedGroupsData[i];
        const numberedGroupName = `#${i + 1} ${groupName}`;
        
        // Job para mudar nome (com índice específico)
        jobsToCreate.push({
          user_id: user.id,
          action_type: 'change_group_name',
          scheduled_for: new Date(Date.now() + (i * 8000)).toISOString(), // Espaçar 8s entre cada grupo
          payload: {
            groups: [group.id],
            name: numberedGroupName, // Já passa o nome completo com número
            autoNumber: false // Não precisa mais auto-numerar
          },
          status: 'pending'
        });

        // Job para mudar foto (se fornecida) - executar primeiro para evitar problemas
        if (photoBase64) {
          jobsToCreate.push({
            user_id: user.id,
            action_type: 'change_group_photo',
            scheduled_for: new Date(Date.now() + (i * 8000) + 2000).toISOString(),
            payload: {
              groups: [group.id],
              image: photoBase64
            },
            status: 'pending'
          });
        }

        // Job para mudar descrição (se fornecida)
        if (description.trim()) {
          jobsToCreate.push({
            user_id: user.id,
            action_type: 'update_description',
            scheduled_for: new Date(Date.now() + (i * 8000) + 4000).toISOString(),
            payload: {
              groups: [group.id],
              description: description
            },
            status: 'pending'
          });
        }

        // Job para mudar status
        jobsToCreate.push({
          user_id: user.id,
          action_type: status === 'closed' ? 'close_groups' : 'open_groups',
          scheduled_for: new Date(Date.now() + (i * 8000) + 6000).toISOString(),
          payload: {
            groups: [group.id]
          },
          status: 'pending'
        });
      }

      const { error } = await supabase
        .from('jobs')
        .insert(jobsToCreate);

      if (error) throw error;

      toast({
        title: "Configurações agendadas!",
        description: `${selectedGroups.length} grupo(s) serão configurados em instantes`,
      });

      // Resetar form e fechar dialog
      setSelectedGroups([]);
      setGroupName("Grupo");
      setDescription("");
      setStatus("open");
      setGroupPhoto(null);
      setDialogOpen(false);

    } catch (error: any) {
      console.error('Erro ao configurar grupos:', error);
      toast({
        variant: "destructive",
        title: "Erro ao configurar grupos",
        description: error.message || "Tente novamente",
      });
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Configurar Vários Grupos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Múltiplos Grupos</DialogTitle>
          <DialogDescription>
            Aplique configurações em vários grupos de uma vez
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>ℹ️ Como funciona:</strong> Selecione os grupos existentes onde você é admin e aplique as configurações desejadas (nome numerado, descrição, status e foto).
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Selecionar Grupos (você é admin)</Label>
            <div className="border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
              {availableGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum grupo disponível. Sincronize seus grupos primeiro.
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
            <Label htmlFor="groupName">Nome Base dos Grupos</Label>
            <Input
              id="groupName"
              placeholder="Ex: Ofertas Shopee"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Os grupos serão renomeados para: #1 {groupName}, #2 {groupName}, #3 {groupName}...
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição dos Grupos</Label>
            <Textarea
              id="description"
              placeholder="Ex: Grupo exclusivo para ofertas e descontos diários da Shopee"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Esta descrição será aplicada a todos os grupos criados
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status dos Grupos</Label>
            <Select value={status} onValueChange={(value: "open" | "closed") => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">🔓 Aberto - Todos podem comentar</SelectItem>
                <SelectItem value="closed">🔒 Fechado - Apenas admins podem escrever</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupPhoto">Foto dos Grupos</Label>
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
            <p className="text-xs text-muted-foreground">
              Esta foto será aplicada a todos os grupos selecionados
            </p>
          </div>

          <Button onClick={handleCreate} className="w-full" disabled={selectedGroups.length === 0}>
            Configurar {selectedGroups.length || "0"} Grupo(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}