import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, QrCode } from "lucide-react";

export default function WhatsApp() {
  const [instanceName, setInstanceName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const { toast } = useToast();

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
    
    // Simulação - na versão real, chamará a Evolution API
    setTimeout(() => {
      setConnected(true);
      setConnecting(false);
      toast({
        title: "WhatsApp conectado!",
        description: "Sua instância foi conectada com sucesso",
      });
    }, 2000);
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
              </div>
            ) : (
              <Button 
                onClick={handleConnect} 
                disabled={connecting}
                className="w-full"
              >
                {connecting ? "Conectando..." : "Gerar QR Code"}
              </Button>
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
              {connecting || connected ? (
                <div className="bg-white p-8 rounded-lg shadow-glow">
                  <div className="w-48 h-48 bg-background rounded-lg flex items-center justify-center">
                    {connecting ? (
                      <div className="text-center">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                        <p className="text-sm">Gerando QR Code...</p>
                      </div>
                    ) : (
                      <QrCode className="h-32 w-32 text-muted-foreground" />
                    )}
                  </div>
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
