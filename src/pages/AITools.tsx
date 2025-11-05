import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, TrendingUp, Users, MessageSquare, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AITools() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Campaign Creator State
  const [campaignPrompt, setCampaignPrompt] = useState("");
  const [campaignResult, setCampaignResult] = useState<any>(null);

  // Engagement Analyzer State
  const [selectedGroup, setSelectedGroup] = useState("");
  const [engagementResult, setEngagementResult] = useState<any>(null);

  // Trend Analyzer State
  const [selectedPlatform, setSelectedPlatform] = useState("shopee");
  const [trendCategory, setTrendCategory] = useState("");
  const [trendResult, setTrendResult] = useState<any>(null);

  // Message Enhancer State
  const [productLinks, setProductLinks] = useState("");
  const [copyStyle, setCopyStyle] = useState("aggressive");
  const [messageResult, setMessageResult] = useState<any>(null);

  const handleCreateCampaign = async () => {
    if (!campaignPrompt.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, descreva sua campanha",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-campaign', {
        body: { prompt: campaignPrompt }
      });

      if (error) throw error;

      setCampaignResult(data);
      toast({
        title: "Campanha criada! 🎉",
        description: "Sua campanha foi gerada com sucesso",
      });
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a campanha",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeEngagement = async () => {
    if (!selectedGroup) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um grupo",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-engagement', {
        body: { groupId: selectedGroup }
      });

      if (error) throw error;

      setEngagementResult(data);
      toast({
        title: "Análise concluída! 📊",
        description: "Confira as sugestões de engajamento",
      });
    } catch (error) {
      console.error('Error analyzing engagement:', error);
      toast({
        title: "Erro",
        description: "Não foi possível analisar o engajamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeTrends = async () => {
    if (!trendCategory.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe a categoria de produtos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-trends', {
        body: { platform: selectedPlatform, category: trendCategory }
      });

      if (error) throw error;

      setTrendResult(data);
      toast({
        title: "Tendências identificadas! 🔥",
        description: "Veja os produtos em alta",
      });
    } catch (error) {
      console.error('Error analyzing trends:', error);
      toast({
        title: "Erro",
        description: "Não foi possível identificar tendências",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnhanceMessage = async () => {
    if (!productLinks.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, cole os links dos produtos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('enhance-message', {
        body: { productLinks, copyStyle }
      });

      if (error) throw error;

      setMessageResult(data);
      toast({
        title: "Mensagens criadas! ✨",
        description: "Escolha a que mais combina com você",
      });
    } catch (error) {
      console.error('Error enhancing message:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar as mensagens",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ferramentas de IA</h1>
        <p className="text-muted-foreground mt-2">
          Use inteligência artificial para criar campanhas, analisar engajamento e identificar tendências
        </p>
      </div>

      <Tabs defaultValue="campaign" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="campaign">
            <Sparkles className="h-4 w-4 mr-2" />
            Criar Campanha
          </TabsTrigger>
          <TabsTrigger value="engagement">
            <Users className="h-4 w-4 mr-2" />
            Engajamento
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Tendências
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageSquare className="h-4 w-4 mr-2" />
            Mensagens
          </TabsTrigger>
        </TabsList>

        {/* Campaign Creator Tab */}
        <TabsContent value="campaign" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🚀 Crie sua Campanha com IA</CardTitle>
              <CardDescription>
                Descreva sua campanha e a IA gerará nomes de grupos, fotos, descrições e cronograma completo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder='Ex: "Quero fazer uma oferta de produtos da Shopee e captar gente interessada em descontos."'
                value={campaignPrompt}
                onChange={(e) => setCampaignPrompt(e.target.value)}
                rows={4}
              />
              <Button onClick={handleCreateCampaign} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando campanha...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar Campanha Completa
                  </>
                )}
              </Button>

              {campaignResult && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">📝 Nomes dos Grupos</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {campaignResult.groupNames?.map((name: string, i: number) => (
                        <li key={i}>{name}</li>
                      ))}
                    </ul>
                  </div>

                  {campaignResult.groupImage && (
                    <div className="p-4 bg-muted rounded-lg">
                      <h3 className="font-semibold mb-2">🎨 Foto do Grupo</h3>
                      <img src={campaignResult.groupImage} alt="Group" className="w-full max-w-md rounded-lg" />
                    </div>
                  )}

                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">📄 Descrição</h3>
                    <p className="whitespace-pre-wrap">{campaignResult.description}</p>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">💬 Mensagem de Boas-vindas</h3>
                    <p className="whitespace-pre-wrap">{campaignResult.welcomeMessage}</p>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">📅 Cronograma de 7 Dias</h3>
                    <div className="space-y-2">
                      {campaignResult.schedule?.map((day: any, i: number) => (
                        <div key={i} className="border-l-2 border-primary pl-4">
                          <p className="font-medium">Dia {day.day}: {day.title}</p>
                          <p className="text-sm text-muted-foreground">{day.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Analyzer Tab */}
        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>📊 IA de Engajamento Automatizado</CardTitle>
              <CardDescription>
                Analise a interação do grupo e receba sugestões para reativar membros
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um grupo para analisar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group-1">🔥 Descontos Diários Grupo 01</SelectItem>
                  <SelectItem value="group-2">💰 Ofertas Shopee Grupo 02</SelectItem>
                  <SelectItem value="group-3">🛍️ Compras Inteligentes Grupo 03</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleAnalyzeEngagement} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Analisar Engajamento
                  </>
                )}
              </Button>

              {engagementResult && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">📈 Status do Grupo</h3>
                    <p className="text-2xl font-bold text-primary">{engagementResult.status}</p>
                    <p className="text-sm text-muted-foreground mt-1">{engagementResult.analysis}</p>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">💡 Sugestões de Reativação</h3>
                    <ul className="space-y-2">
                      {engagementResult.suggestions?.map((suggestion: any, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <div>
                            <p className="font-medium">{suggestion.type}</p>
                            <p className="text-sm text-muted-foreground">{suggestion.content}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">🎯 Plano de Ação</h3>
                    <p className="whitespace-pre-wrap">{engagementResult.actionPlan}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trend Analyzer Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🔥 Identificador de Tendências</CardTitle>
              <CardDescription>
                Descubra os produtos mais vendidos e tendências do momento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shopee">🛍️ Shopee</SelectItem>
                  <SelectItem value="shein">👗 Shein</SelectItem>
                  <SelectItem value="mercadolivre">📦 Mercado Livre</SelectItem>
                  <SelectItem value="aliexpress">🌐 AliExpress</SelectItem>
                </SelectContent>
              </Select>

              <Textarea
                placeholder='Ex: "Moda feminina", "Eletrônicos", "Casa e decoração"'
                value={trendCategory}
                onChange={(e) => setTrendCategory(e.target.value)}
                rows={3}
              />

              <Button onClick={handleAnalyzeTrends} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Identificando tendências...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Identificar Tendências
                  </>
                )}
              </Button>

              {trendResult && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">🔥 Produtos em Alta</h3>
                    <div className="space-y-3">
                      {trendResult.products?.map((product: any, i: number) => (
                        <div key={i} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-muted-foreground">{product.description}</p>
                              <p className="text-lg font-bold text-primary mt-2">{product.price}</p>
                            </div>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              #{i + 1}
                            </span>
                          </div>
                          <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                            <span>💰 {product.sales} vendas</span>
                            <span>⭐ {product.rating}</span>
                          </div>
                          {product.url && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => window.open(product.url, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Buscar Produto
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">📊 Análise de Mercado</h3>
                    <p className="whitespace-pre-wrap">{trendResult.marketAnalysis}</p>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">💡 Recomendações</h3>
                    <p className="whitespace-pre-wrap">{trendResult.recommendations}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Message Enhancer Tab */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>✨ Criador de Mensagens Personalizadas</CardTitle>
              <CardDescription>
                Cole os links dos produtos da Shopee e escolha o estilo de copy para criar mensagens persuasivas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder='Cole os links dos produtos aqui, um por linha&#10;Ex:&#10;https://shopee.com.br/produto1&#10;https://shopee.com.br/produto2'
                value={productLinks}
                onChange={(e) => setProductLinks(e.target.value)}
                rows={5}
              />

              <Select value={copyStyle} onValueChange={setCopyStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estilo de copy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aggressive">🔥 Venda Agressiva</SelectItem>
                  <SelectItem value="scarcity">⏰ Escassez e Urgência</SelectItem>
                  <SelectItem value="emotional">❤️ Apelo Emocional</SelectItem>
                  <SelectItem value="benefit">💎 Foco em Benefícios</SelectItem>
                  <SelectItem value="social">👥 Prova Social</SelectItem>
                  <SelectItem value="storytelling">📖 Storytelling</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleEnhanceMessage} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando mensagens...
                  </>
                ) : (
                  <>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Gerar Mensagens
                  </>
                )}
              </Button>

              {messageResult && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">📝 Informações dos Produtos</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{messageResult.productInfo}</p>
                  </div>

                  {messageResult.messages?.map((msg: any, i: number) => (
                    <div key={i} className="p-4 bg-muted rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">💬 Opção {i + 1}: {msg.style}</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.message);
                            toast({
                              title: "Copiado!",
                              description: "Mensagem copiada para a área de transferência",
                            });
                          }}
                        >
                          Copiar
                        </Button>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{msg.message}</p>
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          <strong>Por que funciona:</strong> {msg.reason}
                        </p>
                      </div>
                    </div>
                  ))}

                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">💡 Dicas de Uso</h3>
                    <ul className="text-sm space-y-1">
                      {messageResult.tips?.map((tip: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
