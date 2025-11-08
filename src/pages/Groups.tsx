import { useState, useEffect } from "react";
import { AtSign, Check, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Unlock, MessageSquare, FileEdit, Type, Image as ImageIcon, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateMultipleGroups } from "@/components/CreateMultipleGroups";

interface Group {
  id: string;
  name: string;
  members_count: number;
  member_limit: number;
  status: string;
  wa_group_id: string;
}

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [description, setDescription] = useState("");
  const [groupName, setGroupName] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const { toast } = useToast();

  // Carregar grupos do banco
  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setGroups(data || []);
      console.log('✅ Grupos carregados:', data?.length);
    } catch (error: any) {
      console.error('Erro ao carregar grupos:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar grupos",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const insertMention = (mention: string) => {
    setMessage(prev => prev + mention);
    setMentionOpen(false);
  };

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedGroups.length === groups.length) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(groups.map((g) => g.id));
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedGroups.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum grupo selecionado",
        description: "Selecione pelo menos um grupo para executar esta ação",
      });
      return;
    }

    toast({
      title: "Ação executada",
      description: `${action} aplicado em ${selectedGroups.length} grupo(s)`,
    });
  };

  const handleEnhanceMessage = async () => {
    if (!message.trim()) {
      toast({
        variant: "destructive",
        title: "Mensagem vazia",
        description: "Digite uma mensagem para melhorar",
      });
      return;
    }

    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enhance-message', {
        body: { message }
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data.error,
        });
        return;
      }

      setMessage(data.enhancedMessage);
      toast({
        title: "Mensagem melhorada!",
        description: "A IA personalizou sua mensagem com sucesso",
      });
    } catch (error) {
      console.error('Erro ao melhorar mensagem:', error);
      toast({
        variant: "destructive",
        title: "Erro ao melhorar mensagem",
        description: "Tente novamente em instantes",
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      return isImage || isVideo;
    });

    if (validFiles.length !== files.length) {
      toast({
        variant: "destructive",
        title: "Arquivos inválidos",
        description: "Apenas imagens e vídeos são permitidos",
      });
    }

    setMediaFiles(prev => [...prev, ...validFiles]);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setGroupPhoto(file);
    } else {
      toast({
        variant: "destructive",
        title: "Arquivo inválido",
        description: "Apenas imagens são permitidas",
      });
    }
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      open: { label: "Aberto", className: "bg-gradient-success" },
      closed: { label: "Fechado", className: "bg-destructive" },
      full: { label: "Cheio", className: "bg-primary" },
    };

    const variant = variants[status] || variants.open;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Carregando grupos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Gestão de Grupos</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie todos os seus grupos do WhatsApp em um só lugar - Total de {groups.length} grupos
          </p>
        </div>
        <CreateMultipleGroups />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Buscar grupos por nome..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Ações em Massa</CardTitle>
          <CardDescription>
            {selectedGroups.length} grupo(s) selecionado(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => handleBulkAction("Fechar grupos")}
          >
            <Lock className="mr-2 h-4 w-4" />
            Fechar Grupos
          </Button>
          <Button
            variant="outline"
            onClick={() => handleBulkAction("Abrir grupos")}
          >
            <Unlock className="mr-2 h-4 w-4" />
            Abrir Grupos
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Type className="mr-2 h-4 w-4" />
                Alterar Nome
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar Nome dos Grupos</DialogTitle>
                <DialogDescription>
                  Defina um novo nome para os grupos selecionados
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="groupName">Novo Nome</Label>
                  <Input
                    id="groupName"
                    placeholder="Digite o novo nome..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleBulkAction("Alterar nome")}
                >
                  Atualizar Nome
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ImageIcon className="mr-2 h-4 w-4" />
                Alterar Foto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar Foto dos Grupos</DialogTitle>
                <DialogDescription>
                  Envie uma nova foto para os grupos selecionados
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="groupPhoto">Foto do Grupo</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="groupPhoto"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="flex-1"
                    />
                  </div>
                  {groupPhoto && (
                    <p className="text-sm text-muted-foreground">
                      Arquivo selecionado: {groupPhoto.name}
                    </p>
                  )}
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleBulkAction("Alterar foto")}
                  disabled={!groupPhoto}
                >
                  Atualizar Foto
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                Enviar Mensagem
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Enviar Mensagem</DialogTitle>
                <DialogDescription>
                  Envie uma mensagem para os grupos selecionados
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="message">Mensagem</Label>
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
                    id="message"
                    placeholder="Digite sua mensagem... Use @todos para mencionar todos ou @pessoa para mencionar alguém específico"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEnhanceMessage}
                    disabled={isEnhancing || !message.trim()}
                    className="w-full"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {isEnhancing ? "Melhorando..." : "Melhorar com IA"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="media">Anexar Mídia (Imagens/Vídeos)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="media"
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleMediaUpload}
                      className="flex-1"
                    />
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {mediaFiles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {mediaFiles.length} arquivo(s) selecionado(s):
                      </p>
                      <div className="space-y-1">
                        {mediaFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between text-sm bg-muted p-2 rounded"
                          >
                            <span className="truncate flex-1">{file.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMediaFile(index)}
                            >
                              Remover
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={() => handleBulkAction("Enviar mensagem")}
                >
                  Enviar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileEdit className="mr-2 h-4 w-4" />
                Alterar Descrição
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar Descrição</DialogTitle>
                <DialogDescription>
                  Atualize a descrição dos grupos selecionados
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Nova Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Digite a nova descrição..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleBulkAction("Alterar descrição")}
                >
                  Atualizar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Seus Grupos ({filteredGroups.length}/{groups.length})</CardTitle>
          <CardDescription>
            {groups.length === 0 
              ? "Nenhum grupo importado ainda. Vá para a página WhatsApp e clique em 'Importar Grupos'"
              : searchQuery 
                ? `${filteredGroups.length} grupos encontrados`
                : "Lista completa de grupos importados"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                 <TableHead className="w-12">
                   <Checkbox
                     checked={selectedGroups.length === filteredGroups.length && filteredGroups.length > 0}
                     onCheckedChange={toggleAll}
                   />
                 </TableHead>
                <TableHead>Nome do Grupo</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead>Limite</TableHead>
                <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
           <TableBody>
             {filteredGroups.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                     {searchQuery ? "Nenhum grupo encontrado com esse nome" : "Nenhum grupo importado ainda"}
                   </TableCell>
                 </TableRow>
               ) : (
                 filteredGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedGroups.includes(group.id)}
                        onCheckedChange={() => toggleGroup(group.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>{group.members_count}</TableCell>
                    <TableCell>{group.member_limit}</TableCell>
                    <TableCell>{getStatusBadge(group.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}