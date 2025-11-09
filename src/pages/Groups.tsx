import { useState, useEffect } from "react";
import { AtSign, Check, Search, AlertCircle, Wifi, WifiOff, QrCode } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useNavigate } from "react-router-dom";

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
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [instanceName, setInstanceName] = useState<string>('');
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectQrCode, setReconnectQrCode] = useState<string | null>(null);
  const [showReconnectDialog, setShowReconnectDialog] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Carregar grupos do banco
  useEffect(() => {
    loadGroups();
    checkConnectionStatus();
  }, []);

  const handleReconnect = async () => {
    if (!instanceName) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome da instância não encontrado",
      });
      return;
    }

    setReconnecting(true);
    setReconnectQrCode(null);

    try {
      const { data, error } = await supabase.functions.invoke('evolution-reconnect-instance', {
        body: { instanceName }
      });

      console.log('Resposta reconnect:', { data, error });

      if (error) throw error;

      if (data.success && data.qrcode) {
        // Verificar diferentes formatos de QR code
        const qrCodeBase64 = data.qrcode.base64 || data.qrcode;
        
        if (qrCodeBase64) {
          setReconnectQrCode(qrCodeBase64);
          setShowReconnectDialog(true);
          toast({
            title: "QR Code gerado!",
            description: "Escaneie o código com seu WhatsApp para reconectar",
          });

          // Iniciar polling para verificar conexão
          const pollInterval = setInterval(async () => {
            try {
              const { data: statusData, error: statusError } = await supabase.functions.invoke('evolution-check-status', {
                body: { instanceName }
              });

              console.log('🔄 Polling status:', {
                success: statusData?.success,
                status: statusData?.status,
                instanceState: statusData?.instance?.state,
                rawInstanceState: statusData?.rawData?.instance?.state,
                fullData: statusData
              });

              if (statusError) {
                console.error('Erro no polling:', statusError);
                return;
              }

              // Verificar múltiplas possibilidades de status conectado
              const connectedStatuses = ['open', 'OPEN', 'connected', 'CONNECTED'];
              
              // Tentar pegar o status de diferentes lugares na resposta
              const currentStatus = 
                statusData?.status || 
                statusData?.rawData?.instance?.state || 
                statusData?.instance?.state ||
                statusData?.rawData?.state;
              
              console.log('Status detectado:', currentStatus);
              
              if (statusData?.success && currentStatus && connectedStatuses.includes(currentStatus)) {
                console.log('✅ WhatsApp conectado! Limpando polling...');
                clearInterval(pollInterval);
                setConnectionStatus('connected');
                setShowReconnectDialog(false);
                setReconnectQrCode(null);
                setReconnecting(false);
                
                // Atualizar status no banco
                await supabase
                  .from('instances')
                  .update({ 
                    status: 'connected',
                    updated_at: new Date().toISOString()
                  })
                  .eq('instance_id', instanceName);

                toast({
                  title: "WhatsApp reconectado!",
                  description: "Sua instância foi reconectada com sucesso",
                });
                
                // Recarregar grupos após reconexão
                setTimeout(() => {
                  loadGroups();
                }, 1000);
              }
            } catch (pollError) {
              console.error('Erro no polling:', pollError);
            }
          }, 3000);

          // Limpar polling após 2 minutos
          setTimeout(() => clearInterval(pollInterval), 120000);
        } else {
          throw new Error('QR Code não encontrado na resposta');
        }
      } else {
        throw new Error(data.error || 'Erro ao gerar QR code');
      }
    } catch (error: any) {
      console.error('Erro ao reconectar:', error);
      toast({
        variant: "destructive",
        title: "Erro ao reconectar",
        description: error.message || "Tente conectar novamente na página WhatsApp",
      });
    } finally {
      setReconnecting(false);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: instances } = await supabase
        .from('instances')
        .select('instance_id, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!instances || instances.length === 0) {
        setConnectionStatus('disconnected');
        setInstanceName('');
        return;
      }

      const instance = instances[0];
      setInstanceName(instance.instance_id);
      setConnectionStatus(instance.status === 'connected' ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setConnectionStatus('disconnected');
    }
  };

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
    console.log('🔖 Inserindo menção:', mention);
    setMessage(prev => {
      const newMessage = prev + mention;
      console.log('💬 Nova mensagem:', newMessage);
      return newMessage;
    });
    setMentionOpen(false);
    
    toast({
      title: "Menção adicionada",
      description: `"${mention.trim()}" foi adicionado à mensagem`,
    });
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

  const handleSendMessage = async () => {
    if (selectedGroups.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum grupo selecionado",
        description: "Selecione pelo menos um grupo para executar esta ação",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        variant: "destructive",
        title: "Mensagem vazia",
        description: "Digite uma mensagem antes de enviar",
      });
      return;
    }

    // Criar registro no histórico
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: historyRecord, error: historyError } = await supabase
      .from('action_history')
      .insert({
        user_id: user.id,
        action_type: 'send_message',
        description: `Enviando mensagem para ${selectedGroups.length} grupo(s)`,
        status: 'running',
        target_count: selectedGroups.length,
      })
      .select()
      .single();

    if (historyError) {
      console.error('Erro ao criar histórico:', historyError);
    }

    // Processar menções
    let processedMessage = message;
    let mentions: string[] = [];

    // Se contém @todos, buscar todos os membros dos grupos
    if (message.includes('@todos')) {
      // A Evolution API vai mencionar todos automaticamente se não passar o array de mentions
      processedMessage = message.replace('@todos', '');
      mentions = []; // Vazio = menciona todos
    }

    // Buscar instância
    const { data: instances } = await supabase
      .from('instances')
      .select('instance_id')
      .eq('user_id', user.id)
      .eq('status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!instances || instances.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhuma instância conectada",
        description: "Conecte seu WhatsApp primeiro",
      });
      
      if (historyRecord) {
        await supabase
          .from('action_history')
          .update({
            status: 'failed',
            error_message: 'Nenhuma instância conectada',
            completed_at: new Date().toISOString(),
          })
          .eq('id', historyRecord.id);
      }
      return;
    }

    const instanceName = instances[0].instance_id;

    // Verificar se a instância realmente está conectada na Evolution API
    console.log('🔍 Verificando status da instância antes de enviar...');
    try {
      const { data: statusData, error: statusError } = await supabase.functions.invoke('evolution-check-status', {
        body: { instanceName }
      });

      console.log('📊 Status recebido:', statusData);

      // Verificar múltiplas possibilidades de localização do status
      const connectedStatuses = ['open', 'connected'];
      const currentStatus = statusData?.status || 
                           statusData?.rawData?.instance?.state || 
                           statusData?.instance?.state || 
                           statusData?.rawData?.state ||
                           statusData?.state;

      console.log('🔍 Status extraído:', currentStatus);

      if (statusError || !currentStatus || !connectedStatuses.includes(currentStatus)) {
        const errorMsg = currentStatus 
          ? `Instância desconectada (Status: ${currentStatus})` 
          : 'Instância não encontrada na Evolution API';
        
        console.error('❌ Status inválido:', errorMsg);
        
        toast({
          variant: "destructive",
          title: "WhatsApp desconectado",
          description: "Sua instância do WhatsApp está desconectada. Reconecte na página do WhatsApp.",
        });

        if (historyRecord) {
          await supabase
            .from('action_history')
            .update({
              status: 'failed',
              error_message: errorMsg,
              completed_at: new Date().toISOString(),
            })
            .eq('id', historyRecord.id);
        }
        return;
      }
      console.log('✅ Instância verificada e conectada:', currentStatus);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      toast({
        variant: "destructive",
        title: "Erro ao verificar conexão",
        description: "Não foi possível verificar o status da conexão do WhatsApp",
      });
      
      if (historyRecord) {
        await supabase
          .from('action_history')
          .update({
            status: 'failed',
            error_message: 'Erro ao verificar status da conexão',
            completed_at: new Date().toISOString(),
          })
          .eq('id', historyRecord.id);
      }
      return;
    }

    // Buscar dados dos grupos selecionados
    const { data: selectedGroupsData } = await supabase
      .from('groups')
      .select('wa_group_id, name')
      .in('id', selectedGroups);

    if (!selectedGroupsData) return;

    let successCount = 0;
    let errorCount = 0;

    // Enviar para cada grupo
    for (const group of selectedGroupsData) {
      try {
        const { data, error } = await supabase.functions.invoke('evolution-send-message', {
          body: {
            instanceName,
            groupId: group.wa_group_id,
            message: processedMessage,
            mentions: mentions.length > 0 ? mentions : undefined,
          }
        });

        if (error || !data?.success) {
          errorCount++;
          console.error(`Erro ao enviar para ${group.name}:`, error || data?.error);
        } else {
          successCount++;
          console.log(`✅ Mensagem enviada para ${group.name}`);
        }

        // Aguardar 1 segundo entre mensagens para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        errorCount++;
        console.error(`Erro ao enviar para ${group.name}:`, error);
      }
    }

    // Atualizar histórico
    if (historyRecord) {
      await supabase
        .from('action_history')
        .update({
          status: errorCount === selectedGroupsData.length ? 'failed' : 'completed',
          success_count: successCount,
          error_count: errorCount,
          error_message: errorCount > 0 ? `${errorCount} falhas ao enviar` : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', historyRecord.id);
    }

    toast({
      title: "Mensagens enviadas",
      description: `${successCount} enviadas com sucesso${errorCount > 0 ? `, ${errorCount} falharam` : ''}`,
    });

    // Limpar formulário
    setMessage("");
    setMediaFiles([]);
    setSelectedGroups([]);
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

      {/* Alerta de Status da Conexão */}
      {connectionStatus === 'disconnected' && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>WhatsApp Desconectado</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Sua instância {instanceName ? `"${instanceName}"` : ''} está desconectada. 
              Reconecte para enviar mensagens.
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleReconnect}
              disabled={reconnecting}
              className="ml-4 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              {reconnecting ? "Reconectando..." : "Reconectar Agora"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Dialog de QR Code para Reconexão */}
      <Dialog open={showReconnectDialog} onOpenChange={setShowReconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code abaixo com seu WhatsApp para reconectar a instância "{instanceName}"
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {reconnectQrCode ? (
              <img 
                src={reconnectQrCode} 
                alt="QR Code" 
                className="w-64 h-64 border-2 border-border rounded-lg"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Aguardando escaneamento...
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {connectionStatus === 'connected' && (
        <Alert className="border-success/50 bg-success/10">
          <Wifi className="h-4 w-4 text-success" />
          <AlertTitle className="text-success">WhatsApp Conectado</AlertTitle>
          <AlertDescription className="text-success/90">
            Instância "{instanceName}" está conectada e pronta para enviar mensagens.
          </AlertDescription>
        </Alert>
      )}

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
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            console.log('🔘 Botão Mencionar clicado');
                            setMentionOpen(!mentionOpen);
                          }}
                        >
                          <AtSign className="mr-2 h-4 w-4" />
                          Mencionar
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="end">
                        <Command>
                          <CommandInput placeholder="Buscar menção..." />
                          <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
                          <CommandGroup heading="Opções de Menção">
                            <CommandItem 
                              onSelect={() => {
                                console.log('✅ Selecionou @todos');
                                insertMention("@todos ");
                              }}
                              className="cursor-pointer"
                            >
                              <AtSign className="mr-2 h-4 w-4" />
                              Mencionar todos
                            </CommandItem>
                            <CommandItem 
                              onSelect={() => {
                                console.log('✅ Selecionou @pessoa');
                                insertMention("@pessoa ");
                              }}
                              className="cursor-pointer"
                            >
                              <AtSign className="mr-2 h-4 w-4" />
                              Mencionar pessoa específica
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
                  onClick={handleSendMessage}
                  disabled={!message.trim() || selectedGroups.length === 0}
                >
                  Enviar Mensagem
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