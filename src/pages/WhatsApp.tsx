import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, QrCode, RefreshCw, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function WhatsApp() {
  const [instanceName, setInstanceName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [importingGroups, setImportingGroups] = useState(false);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupsFetchAttempts, setGroupsFetchAttempts] = useState(0);
  const [lastApiStatus, setLastApiStatus] = useState<any>(null);
  const [showDebugMode, setShowDebugMode] = useState(false);
  const [importedGroupsList, setImportedGroupsList] = useState<string[]>([]);
  const { toast } = useToast();

  // Load existing instance from database on mount
  useEffect(() => {
    loadExistingInstance();
  }, []);

  // Poll for status updates while connecting
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

  // Real-time sync: poll database for connection state changes
  useEffect(() => {
    let syncInterval: NodeJS.Timeout;
    
    if (instanceId) {
      syncInterval = setInterval(() => {
        syncConnectionState();
      }, 5000);
    }
    
    return () => {
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [instanceId]);

  const loadExistingInstance = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: instances, error } = await supabase
        .from('instances')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'connected')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (instances && instances.length > 0) {
        const instance = instances[0];
        setInstanceName(instance.instance_id);
        setInstanceId(instance.id);
        setConnected(true);
        setConnecting(false);
      }
    } catch (error: any) {
      console.error('Erro ao carregar instância:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncConnectionState = async () => {
    if (!instanceId) return;
    
    try {
      const { data: instance, error } = await supabase
        .from('instances')
        .select('status, instance_id')
        .eq('id', instanceId)
        .single();

      if (error) throw error;

      if (instance) {
        const isConnected = instance.status === 'connected';
        setConnected(isConnected);
        setConnecting(false);
        
        if (!isConnected && connected) {
          toast({
            variant: "destructive",
            title: "Desconectado",
            description: "A instância foi desconectada",
          });
        }
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar estado:', error);
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
      setLastApiStatus(data);

      // Verificar status atual
      const currentStatus = data.instance?.state || data.rawData?.instance?.state;
      console.log('Status atual da instância:', currentStatus);
      
      // Se está connecting, continuar verificando
      if (currentStatus === 'connecting') {
        console.log('Instância ainda conectando, aguardando...');
        return;
      }
      
      // Aceitar diferentes variações de status conectado
      const connectedStatuses = ['open', 'connected', 'CONNECTED', 'OPEN'];
      
      if (data.success && currentStatus && connectedStatuses.includes(currentStatus)) {
        console.log('✅ Instância conectada! Salvando no banco...');
        setConnected(true);
        setConnecting(false);
        setQrCode(null);
        
        // Update instance status in database and ensure it's recognized
        const instanceRecordId = await updateInstanceStatus('connected');
        
        if (instanceRecordId) {
          setInstanceId(instanceRecordId);
          console.log('✅ Instância salva no banco com ID:', instanceRecordId);
          
          toast({
            title: "WhatsApp conectado!",
            description: "Buscando seus grupos...",
          });
          
          // Import groups with verification and retry logic
          await importGroupsWithRetry();
        } else {
          console.error('❌ Falha ao salvar instância no banco');
          toast({
            variant: "destructive",
            title: "Erro ao salvar conexão",
            description: "A conexão foi estabelecida mas não foi possível salvar no banco de dados",
          });
        }
      }
    } catch (error: any) {
      console.error('Erro ao verificar status:', error);
      setLastApiStatus({ error: error.message });
    } finally {
      setCheckingStatus(false);
    }
  };

  const updateInstanceStatus = async (status: 'connected' | 'pending' | 'disconnected'): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: instance, error } = await supabase
        .from('instances')
        .upsert({
          instance_id: instanceName,
          user_id: user.id,
          status: status,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'instance_id,user_id'
        })
        .select('id')
        .single();

      if (error) throw error;
      
      if (instance) {
        setInstanceId(instance.id);
        console.log('Instance recognized and saved:', instance.id);
        return instance.id;
      }
      
      return null;
    } catch (error: any) {
      console.error('Erro ao atualizar status da instância:', error);
      return null;
    }
  };

  const importGroupsWithRetry = async (maxAttempts = 3) => {
    setImportingGroups(true);
    setGroupsFetchAttempts(0);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      setGroupsFetchAttempts(attempt);
      console.log(`Tentativa ${attempt} de ${maxAttempts} de importar grupos`);
      
      try {
        const result = await importGroups();
        
        // If successful and has groups, we're done
        if (result && result.saved > 0) {
          console.log(`Sucesso! ${result.saved} grupos importados`);
          setImportingGroups(false);
          setShowDebugMode(false);
          return;
        }
        
        // If no groups found and we have more attempts
        if (attempt < maxAttempts) {
          console.log('Nenhum grupo encontrado, aguardando 2s antes de tentar novamente...');
          toast({
            title: `Tentativa ${attempt} de ${maxAttempts}`,
            description: "Nenhum grupo encontrado, tentando novamente...",
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // Last attempt failed, show debug mode
          console.log('Todas as tentativas falharam, ativando modo debug');
          setShowDebugMode(true);
          toast({
            variant: "destructive",
            title: "Nenhum grupo encontrado",
            description: "Use o botão 'Forçar Importação' para tentar manualmente",
          });
        }
      } catch (error: any) {
        console.error(`Erro na tentativa ${attempt}:`, error);
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          setShowDebugMode(true);
        }
      }
    }
    
    setImportingGroups(false);
  };

  const importGroups = async () => {
    if (!instanceName) return null;
    
    try {
      console.log('🔄 Iniciando importação de grupos para:', instanceName);
      setImportedGroupsList([]);
      
      const { data, error } = await supabase.functions.invoke('evolution-fetch-groups', {
        body: { instanceName }
      });

      if (error) {
        console.error('❌ Erro da edge function:', error);
        throw error;
      }

      console.log('📦 Resposta da importação:', data);
      setLastApiStatus(data);

      if (data.success) {
        // Extrair nomes dos grupos se disponível
        if (data.groups && Array.isArray(data.groups)) {
          const groupNames = data.groups.slice(0, 10).map((g: any) => g.subject || 'Sem nome');
          setImportedGroupsList(groupNames);
          console.log('📋 Primeiros grupos:', groupNames);
        }
        
        if (data.saved > 0) {
          toast({
            title: "Grupos importados!",
            description: `${data.saved} grupos foram importados com sucesso`,
          });
        }
        return { saved: data.saved, groups: data.groups };
      } else {
        throw new Error(data.error || 'Erro ao importar grupos');
      }
    } catch (error: any) {
      console.error('❌ Erro ao importar grupos:', error);
      setLastApiStatus({ error: error.message });
      toast({
        variant: "destructive",
        title: "Erro ao importar grupos",
        description: error.message || "Não foi possível importar os grupos.",
      });
      throw error;
    }
  };

  const forceImportGroups = async () => {
    setShowDebugMode(false);
    setImportingGroups(true);
    
    try {
      console.log('Forçando importação manual de grupos');
      await importGroups();
      
      // Verificar se realmente importou
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: groups } = await supabase
        .from('groups')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      if (groups && groups.length > 0) {
        toast({
          title: "Importação forçada concluída!",
          description: `${groups.length} grupos encontrados no banco de dados`,
        });
      } else {
        setShowDebugMode(true);
        toast({
          variant: "destructive",
          title: "Ainda sem grupos",
          description: "Verifique os logs no console para mais detalhes",
        });
      }
    } catch (error: any) {
      console.error('Erro na importação forçada:', error);
      setShowDebugMode(true);
    } finally {
      setImportingGroups(false);
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
      // Update instance status to pending
      await updateInstanceStatus('pending');
      
      const { data, error } = await supabase.functions.invoke('evolution-create-instance', {
        body: { instanceName }
      });

      if (error) throw error;

      if (data.success) {
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
      console.error('Erro ao conectar:', error);
      toast({
        variant: "destructive",
        title: "Erro ao conectar",
        description: error.message || "Erro ao gerar QR Code. Verifique as configurações da Evolution API no painel de Admin.",
      });
      setConnecting(false);
      await updateInstanceStatus('disconnected');
    }
  };

  const handleDisconnect = async () => {
    await updateInstanceStatus('disconnected');
    setConnected(false);
    setInstanceName("");
    setInstanceId(null);
    toast({
      title: "Desconectado",
      description: "Instância desconectada com sucesso",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

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
                
                {importingGroups && groupsFetchAttempts > 0 && (
                  <div className="bg-accent/50 border border-border rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Importando grupos... (Tentativa {groupsFetchAttempts} de 3)
                    </div>
                    {importedGroupsList.length > 0 && (
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        <p className="text-xs text-muted-foreground mb-1">Grupos encontrados:</p>
                        {importedGroupsList.map((groupName, idx) => (
                          <div key={idx} className="text-xs px-2 py-1 bg-background rounded text-foreground">
                            • {groupName}
                          </div>
                        ))}
                        {importedGroupsList.length >= 10 && (
                          <p className="text-xs text-muted-foreground italic">e mais...</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {showDebugMode && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-2">
                    <p className="text-sm font-medium text-destructive">Modo Debug Ativado</p>
                    <p className="text-xs text-muted-foreground">
                      Nenhum grupo foi encontrado após 3 tentativas. 
                      Último status da API está no console.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={forceImportGroups}
                      disabled={importingGroups}
                      className="w-full"
                    >
                      {importingGroups ? "Importando..." : "Forçar Importação"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => console.log('Último status da API:', lastApiStatus)}
                      className="w-full text-xs"
                    >
                      Ver Status no Console
                    </Button>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    onClick={() => importGroupsWithRetry()}
                    disabled={importingGroups}
                    className="flex-1"
                  >
                    {importingGroups ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Importar Grupos
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleDisconnect}
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
