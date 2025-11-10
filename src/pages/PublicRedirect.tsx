import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PublicRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>("");

  useEffect(() => {
    if (!slug) {
      setError("Link inválido");
      setLoading(false);
      return;
    }

    handleRedirect();
  }, [slug]);

  const handleRedirect = async () => {
    try {
      console.log('🔗 Processando redirecionamento para:', slug);

      const { data, error: functionError } = await supabase.functions.invoke('redirect-link', {
        body: { slug }
      });

      console.log('📡 Resposta:', { data, error: functionError });

      if (functionError) throw functionError;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao processar link');
      }

      setGroupName(data.group_name);
      
      // Redirecionar para o WhatsApp
      console.log('🚀 Redirecionando para WhatsApp:', data.redirect_url);
      window.location.href = data.redirect_url;

    } catch (error: any) {
      console.error('❌ Erro:', error);
      setError(error.message || 'Erro ao processar o link');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <CardTitle>Redirecionando...</CardTitle>
            <CardDescription>
              Preparando seu acesso ao grupo
              {groupName && ` "${groupName}"`}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>Você será redirecionado automaticamente para o WhatsApp</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle>Erro no Redirecionamento</CardTitle>
            <CardDescription className="text-destructive">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {error.includes('cheios') ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Todos os grupos estão com capacidade máxima no momento. 
                  Tente novamente mais tarde.
                </p>
                <Button onClick={() => window.location.reload()} className="w-full">
                  Tentar Novamente
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Não foi possível processar seu link. Verifique se o endereço está correto.
                </p>
                <Button onClick={() => window.history.back()} variant="outline" className="w-full">
                  Voltar
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
