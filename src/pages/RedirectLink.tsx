import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Settings } from "lucide-react";

export default function RedirectLink() {
  const [slug, setSlug] = useState("meu-grupo");
  const [hasLink, setHasLink] = useState(false);
  const { toast } = useToast();

  const handleCreateLink = () => {
    if (!slug.trim()) {
      toast({
        variant: "destructive",
        title: "Slug obrigatório",
        description: "Por favor, insira um slug para seu link",
      });
      return;
    }

    setHasLink(true);
    toast({
      title: "Link criado!",
      description: "Seu link de redirecionamento foi criado com sucesso",
    });
  };

  const copyToClipboard = () => {
    const link = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para sua área de transferência",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Link de Redirecionamento</h1>
        <p className="text-muted-foreground mt-2">
          Crie um link inteligente que distribui automaticamente novos membros
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Configurar Link</CardTitle>
            <CardDescription>
              Personalize seu link de redirecionamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug do Link</Label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 bg-secondary rounded-l-lg text-muted-foreground">
                  /r/
                </span>
                <Input
                  id="slug"
                  placeholder="meu-grupo"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="flex-1 rounded-l-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use apenas letras minúsculas, números e hífens
              </p>
            </div>

            {hasLink ? (
              <div className="space-y-3">
                <Badge className="bg-gradient-success">
                  Link Ativo
                </Badge>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setHasLink(false)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Editar Link
                </Button>
              </div>
            ) : (
              <Button onClick={handleCreateLink} className="w-full">
                Criar Link
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-card to-secondary/20">
          <CardHeader>
            <CardTitle>Seu Link</CardTitle>
            <CardDescription>
              Compartilhe este link para distribuir membros automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasLink ? (
              <>
                <div className="p-4 bg-background rounded-lg border-2 border-primary/20">
                  <code className="text-sm break-all">
                    {window.location.origin}/r/{slug}
                  </code>
                </div>
                <div className="flex gap-2">
                  <Button onClick={copyToClipboard} className="flex-1">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Link
                  </Button>
                  <Button variant="outline" size="icon">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>Configure o slug e crie seu link para visualizá-lo aqui</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Como funciona?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              O sistema de redirecionamento inteligente distribui automaticamente novos membros
              para grupos que ainda têm vagas disponíveis:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Uma pessoa acessa seu link personalizado</li>
              <li>O sistema verifica qual grupo ainda tem vagas</li>
              <li>A pessoa é redirecionada automaticamente para o WhatsApp do grupo</li>
              <li>Quando um grupo atinge o limite, o próximo grupo com vagas é usado</li>
            </ol>
            <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
              <p className="text-sm">
                <strong>Dica:</strong> Configure o limite de membros na página de Grupos para
                controlar quando um grupo deve ser considerado "cheio"
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
