import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, QrCode, RefreshCw, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

export default function WhatsApp() {
  const [instanceName, setInstanceName] = useState("");
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedGroups, setImportedGroups] = useState<string[]>([]);
  const { toast } = useToast();

  // Carregar estado da conexão do banco ao montar
  useEffect(() => {
    const loadConnectionState = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: instances, error } = await supabase
          .from('instances')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'connected')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (instances && instances.length > 0) {
          const instance = instances[0];
          setInstanceName(instance.instance_id);
          setInstanceId(instance.id);
          setConnected(true);
          console.log('Estado da conexão carregado:', instance);
        }
      } catch (error) {
        console.error('Erro ao carregar estado da conexão:', error);
      }
    };

    loadConnectionState();
  }, []);

  // Polling durante a conexão
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (connecting && instanceName) {
      interval = setInterval(() => {
        checkStatus();
      }, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connecting, instanceName]);

  // Polling periódico para manter status atualizado (a cada 30s)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (connected && instanceName && !connecting) {
      interval = setInterval(() => {
        verifyConnectionStatus();
      }, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connected, instanceName, connecting]);

  const updateInstanceStatus = async (status: 'pending' | 'connected' | 'disconnected') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('instances')
        .upsert({
          instance_id: instanceName,
          user_id: user.id,
          status: status,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'instance_id,user_id'
        })
        .select()
        .single();

      if (error) throw error;
      
      if (data) {
        setInstanceId(data.id);
        console.log('Status da instância atualizado no banco:', data);
      }
    } catch (error) {
      console.error('Erro ao atualizar status da instância:', error);
    }
  };

  const verifyConnectionStatus = async () => {
    if (!instanceName) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('evolution-check-status', {
        body: { instanceName }
      });

      if (error) throw error;

      console.log('✅ Verificação periódica (30s):', {
        instanceName,
        status: data.instance?.state,
        timestamp: new Date().toISOString()
      });

      const connectedStatuses = ['open', 'connected', 'CONNECTED', 'OPEN'];
      const currentStatus = data.instance?.state || data.rawData?.instance?.state;
      
      if (data.success && currentStatus && connectedStatuses.includes(currentStatus)) {
        if (!connected) {
          console.log('🔄 Reconectado automaticamente');
          setConnected(true);
          await updateInstanceStatus('connected');
        }
      } else {
        // Se não está mais conectado, atualizar estado
        if (connected) {
          console.log('❌ Conexão perdida detectada:', {
            previousStatus: 'connected',
            currentStatus,
            timestamp: new Date().toISOString()
          });
          setConnected(false);
          await updateInstanceStatus('disconnected');
          toast({
            variant: "destructive",
            title: "Conexão perdida",
            description: `WhatsApp desconectado (status: ${currentStatus}). Clique em "Reconectar" para gerar novo QR Code.`,
            duration: 10000,
          });
        }
      }
    } catch (error) {
      console.error('❌ Erro ao verificar status:', error);
    }
  };

  const checkStatus = async () => {
    if (!instanceName) return;
    
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-check-status', {
        body: { instanceName }
      });

      if (error) throw error;

      console.log('Status da Evolution API:', data);

      // Aceitar diferentes variações de status conectado
      const connectedStatuses = ['open', 'connected', 'CONNECTED', 'OPEN'];
      const currentStatus = data.instance?.state || data.rawData?.instance?.state;
      
      if (data.success && currentStatus && connectedStatuses.includes(currentStatus)) {
        setConnected(true);
        setConnecting(false);
        setQrCode(null);
        await updateInstanceStatus('connected');
        toast({
          title: "WhatsApp conectado!",
          description: "Sua instância foi conectada com sucesso",
        });
      }
    } catch (error: any) {
      console.error('Erro ao verificar status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnect = async () => {
    if (!instanceName.trim()) {
      toast({
        variant: "destructive",
        title: "Nome da instância obrigatório",
        description: "Por favor, insira um nome para sua instância",
      });
      return;
    }

    setConnecting(true);
    setQrCode(null);
    
    try {
      console.log('🔄 Iniciando conexão com instância:', instanceName);
      
      // Deletar instância antiga se existir
      try {
        await supabase.functions.invoke('evolution-delete-instance', {
          body: { instanceName }
        });
        console.log('✅ Instância antiga removida');
        // Aguardar 2 segundos para garantir que foi deletada
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.log('ℹ️ Nenhuma instância antiga para remover');
      }

      // Criar nova instância
      const { data, error } = await supabase.functions.invoke('evolution-create-instance', {
        body: { instanceName }
      });

      if (error) {
        console.error('❌ Erro na função:', error);
        throw error;
      }

      if (data.success) {
        console.log('✅ Instância criada:', data.instance);
        if (data.qrcode?.base64) {
          setQrCode(data.qrcode.base64);
          toast({
            title: "QR Code gerado!",
            description: "Escaneie o código com seu WhatsApp",
          });
        }
      } else {
        throw new Error(data.error || 'Erro ao criar instância');
      }
    } catch (error: any) {
      console.error('❌ Erro ao conectar:', error);
      toast({
        variant: "destructive",
        title: "Erro ao conectar",
        description: error.message || "Erro ao gerar QR Code. Verifique as configurações da Evolution API no painel de Admin.",
        duration: 7000,
      });
      setConnecting(false);
      setConnected(false);
    }
  };

  const handleImportGroups = async () => {
    if (!instanceName) return;

    setImporting(true);
    setImportProgress(0);
    setImportedGroups([]);

    try {
      console.log('🔄 Iniciando importação de grupos...');
      
      // Buscar grupos da Evolution API
      const { data, error } = await supabase.functions.invoke('evolution-fetch-groups', {
        body: { instanceName }
      });

      if (error) throw error;

      if (!data.success || !data.groups) {
        throw new Error('Erro ao buscar grupos');
      }

      const groups = data.groups;
      console.log(`✅ ${groups.length} grupos encontrados`);

      // Buscar user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Importar grupos progressivamente
      const totalGroups = groups.length;
      const importedNumbers: string[] = [];

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        
        // Salvar no banco
        const { error: insertError } = await supabase
          .from('groups')
          .upsert({
            user_id: user.id,
            instance_id: instanceId,
            wa_group_id: group.id,
            name: group.subject || 'Sem nome',
            description: group.desc || null,
            members_count: group.size || 0,
            status: 'open',
          }, {
            onConflict: 'wa_group_id,user_id'
          });

        if (insertError) {
          console.error('Erro ao salvar grupo:', insertError);
        } else {
          importedNumbers.push(group.id);
          setImportedGroups(prev => [...prev, `${group.subject || 'Sem nome'} (${group.id})`]);
        }

        // Atualizar progresso
        const progress = Math.round(((i + 1) / totalGroups) * 100);
        setImportProgress(progress);
        
        console.log(`📥 [${i + 1}/${totalGroups}] ${group.subject || 'Sem nome'} - ${group.id}`);
      }

      toast({
        title: "Grupos importados!",
        description: `${importedNumbers.length} grupos foram importados com sucesso`,
      });

    } catch (error: any) {
      console.error('❌ Erro ao importar grupos:', error);
      toast({
        variant: "destructive",
        title: "Erro ao importar grupos",
        description: error.message || "Tente novamente",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Conexão WhatsApp</h1>
        <p className="text-muted-foreground mt-2">
          Conecte sua conta do WhatsApp para gerenciar grupos
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Conectar WhatsApp
            </CardTitle>
            <CardDescription>
              Use a Evolution API para conectar sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instance-name">Nome da Instância</Label>
              <Input
                id="instance-name"
                placeholder="Ex: Meu WhatsApp"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                disabled={connected}
              />
            </div>

            {connected ? (
              <div className="space-y-4">
                <Badge className="bg-gradient-success">
                  Conectado
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Sua instância está ativa e funcionando
                </p>
                
                {importing ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Importando grupos...</span>
                        <span className="font-medium">{importProgress}%</span>
                      </div>
                      <Progress value={importProgress} className="h-2" />
                    </div>
                    
                    {importedGroups.length > 0 && (
                      <div className="space-y-2 max-h-32 overflow-y-auto bg-muted/30 rounded-lg p-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          Grupos importados ({importedGroups.length}):
                        </p>
                        {importedGroups.map((group, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground truncate">
                            ✓ {group}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={handleImportGroups}
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Importar Grupos
                  </Button>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={async () => {
                      setConnecting(true);
                      await handleConnect();
                    }}
                    disabled={connecting || importing}
                    className="flex-1"
                  >
                    Reconectar
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={async () => {
                      if (instanceId) {
                        await updateInstanceStatus('disconnected');
                      }
                      setConnected(false);
                      setInstanceName("");
                      setInstanceId(null);
                    }}
                    disabled={importing}
                    className="flex-1"
                  >
                    Desconectar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Button 
                  onClick={handleConnect} 
                  disabled={connecting}
                  className="w-full"
                >
                  {connecting ? "Conectando..." : "Gerar QR Code"}
                </Button>
                {connecting && (
                  <Button 
                    variant="outline"
                    onClick={checkStatus}
                    disabled={checkingStatus}
                    className="w-full"
                  >
                    {checkingStatus ? "Verificando..." : "Verificar Status"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-card to-secondary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code
            </CardTitle>
            <CardDescription>
              Escaneie com seu WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8">
              {qrCode ? (
                <div className="bg-white p-4 rounded-lg shadow-glow">
                  <img 
                    src={qrCode} 
                    alt="QR Code" 
                    className="w-64 h-64"
                  />
                  {checkingStatus && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <p className="text-sm">Aguardando leitura...</p>
                    </div>
                  )}
                </div>
              ) : connecting ? (
                <div className="text-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                  <p className="text-sm">Gerando QR Code...</p>
                </div>
              ) : connected ? (
                <div className="text-center text-muted-foreground">
                  <QrCode className="h-32 w-32 mx-auto mb-4 text-green-500" />
                  <Badge className="bg-gradient-success">Conectado</Badge>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <QrCode className="h-24 w-24 mx-auto mb-4 opacity-50" />
                  <p>Clique em "Gerar QR Code" para começar</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Como funciona?</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Digite um nome para sua instância do WhatsApp</li>
            <li>Clique em "Gerar QR Code"</li>
            <li>Abra o WhatsApp no seu celular</li>
            <li>Vá em Configurações → Aparelhos conectados → Conectar um aparelho</li>
            <li>Escaneie o QR Code exibido na tela</li>
            <li>Pronto! Seus grupos serão importados automaticamente</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
