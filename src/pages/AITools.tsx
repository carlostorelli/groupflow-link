import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, TrendingUp, Users, MessageSquare, ExternalLink, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AITools() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Campaign Creator State
  const [campaignPrompt, setCampaignPrompt] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [campaignResult, setCampaignResult] = useState<any>(null);

  // Engagement Analyzer State
  const [selectedGroup, setSelectedGroup] = useState("");
  const [engagementResult, setEngagementResult] = useState<any>(null);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Trend Analyzer State
  const [selectedPlatform, setSelectedPlatform] = useState("shopee");
  const [trendCategory, setTrendCategory] = useState("");
  const [trendResult, setTrendResult] = useState<any>(null);

  // Message Enhancer State
  const [productLinks, setProductLinks] = useState("");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [copyStyle, setCopyStyle] = useState("aggressive");
  const [messageResult, setMessageResult] = useState<any>(null);
  
  // Image Generator State
  const [topText, setTopText] = useState("PROMOÇÃO");
  const [bottomText, setBottomText] = useState("Válida por tempo determinado");
  const [selectedColor, setSelectedColor] = useState("#FF6B6B");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);

  // Load user's groups
  useEffect(() => {
    const loadGroups = async () => {
      try {
        setLoadingGroups(true);
        const { data, error } = await supabase
          .from('groups')
          .select('id, name, members_count, status')
          .order('name');

        if (error) {
          console.error('Erro ao carregar grupos:', error);
          throw error;
        }
        
        console.log('Grupos carregados:', data);
        setUserGroups(data || []);
      } catch (error) {
        console.error('Erro ao carregar grupos:', error);
        toast({
          title: "Erro ao carregar grupos",
          description: "Não foi possível carregar seus grupos",
          variant: "destructive",
        });
        setUserGroups([]);
      } finally {
        setLoadingGroups(false);
      }
    };

    loadGroups();
  }, [toast]);

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
        body: { 
          prompt: campaignPrompt,
          imagePrompt: imagePrompt || campaignPrompt
        }
      });

      if (error) throw error;

      setCampaignResult(data);
      toast({
        title: "Campanha criada! 🎉",
        description: "Sua campanha foi gerada com sucesso e está salva",
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

  const handleNewCampaign = () => {
    setCampaignPrompt("");
    setImagePrompt("");
    setCampaignResult(null);
    toast({
      title: "Pronto!",
      description: "Você pode criar uma nova campanha agora",
    });
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
      console.log('Chamando analyze-engagement com groupId:', selectedGroup);
      
      const { data, error } = await supabase.functions.invoke('analyze-engagement', {
        body: { groupId: selectedGroup }
      });

      console.log('Resposta da função:', { data, error });

      if (error) {
        console.error('Erro retornado pela função:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Nenhum dado retornado pela função');
      }

      setEngagementResult(data);
      toast({
        title: "Análise concluída! 📊",
        description: "Confira as sugestões de engajamento",
      });
    } catch (error: any) {
      console.error('Error analyzing engagement:', error);
      
      const errorMessage = error?.message || error?.error || 'Não foi possível analisar o engajamento';
      
      toast({
        title: "Erro na análise",
        description: errorMessage,
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
        body: { 
          productLinks, 
          copyStyle,
          affiliateLink: affiliateLink || null
        }
      });

      if (error) throw error;

      setMessageResult(data);
      setGeneratedImage(null); // Reset generated image
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

  const handleGenerateImage = async () => {
    if (!messageResult?.productImage) {
      toast({
        title: "Erro",
        description: "Primeiro gere as mensagens para obter a imagem do produto",
        variant: "destructive",
      });
      return;
    }

    if (!topText.trim() || !bottomText.trim()) {
      toast({
        title: "Erro",
        description: "Preencha os textos superior e inferior",
        variant: "destructive",
      });
      return;
    }

    setGeneratingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-offer-post-image', {
        body: {
          productImageUrl: messageResult.productImage,
          topText: topText.trim(),
          bottomText: bottomText.trim(),
          backgroundColor: selectedColor
        }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast({
          title: "Imagem criada! 🎨",
          description: "Sua arte de postagem está pronta",
        });
      }
    } catch (error: any) {
      console.error('Error generating image:', error);
      
      const errorMsg = error?.message || 'Não foi possível gerar a imagem';
      
      toast({
        title: "Erro ao gerar imagem",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setGeneratingImage(false);
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
              {!campaignResult ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="campaignPrompt">Descrição da Campanha</Label>
                    <Textarea
                      id="campaignPrompt"
                      placeholder='Ex: "Quero fazer uma oferta de produtos da Shopee e captar gente interessada em descontos."'
                      value={campaignPrompt}
                      onChange={(e) => setCampaignPrompt(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="imagePrompt">Texto para Imagem do Grupo (Opcional)</Label>
                    <Input
                      id="imagePrompt"
                      placeholder='Ex: "Ofertas e descontos da Shopee" ou deixe vazio para usar a descrição da campanha'
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      A IA gerará uma imagem baseada neste texto. Se deixar vazio, usará a descrição da campanha.
                    </p>
                  </div>

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
                </>
              ) : (
                <>
                  <div className="space-y-4">
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

                  <Button onClick={handleNewCampaign} variant="outline" className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Gerar Nova Campanha
                  </Button>
                </>
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
              <Select value={selectedGroup} onValueChange={setSelectedGroup} disabled={loadingGroups}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingGroups ? "Carregando grupos..." : "Selecione um grupo para analisar"} />
                </SelectTrigger>
                <SelectContent>
                  {loadingGroups ? (
                    <SelectItem value="loading" disabled>
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Carregando...
                    </SelectItem>
                  ) : userGroups.length > 0 ? (
                    userGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} ({group.members_count} membros)
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-groups" disabled>
                      Nenhum grupo encontrado
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              <Button onClick={handleAnalyzeEngagement} disabled={loading || !selectedGroup || loadingGroups} className="w-full">
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
              <div className="space-y-2">
                <Label htmlFor="productLinks">Link do Produto</Label>
                <Textarea
                  id="productLinks"
                  placeholder="Cole o link do produto aqui&#10;Ex: https://shopee.com.br/produto"
                  value={productLinks}
                  onChange={(e) => setProductLinks(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Cole apenas um link de produto por vez para melhores resultados
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="affiliateLink">Link de Afiliado (Opcional)</Label>
                <Input
                  id="affiliateLink"
                  placeholder="Ex: https://s.shopee.com.br/seu-link-afiliado"
                  value={affiliateLink}
                  onChange={(e) => setAffiliateLink(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Se você tem um link de afiliado, cole aqui para ser incluído nas mensagens geradas
                </p>
              </div>

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

                  {/* Image Generator Section */}
                  <div className="p-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg border-2 border-primary/20">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      🎨 Gerar Arte de Postagem
                    </h3>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="topText">Texto Superior</Label>
                          <Input
                            id="topText"
                            value={topText}
                            onChange={(e) => setTopText(e.target.value)}
                            placeholder="Ex: PROMOÇÃO"
                            maxLength={30}
                          />
                          <p className="text-xs text-muted-foreground">Texto grande no topo da imagem</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="bottomText">Texto Inferior</Label>
                          <Input
                            id="bottomText"
                            value={bottomText}
                            onChange={(e) => setBottomText(e.target.value)}
                            placeholder="Ex: Válida por tempo determinado"
                            maxLength={50}
                          />
                          <p className="text-xs text-muted-foreground">Texto menor no rodapé da imagem</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="bgColor">Cor de Fundo</Label>
                          <div className="flex gap-2">
                            <Input
                              id="bgColor"
                              type="color"
                              value={selectedColor}
                              onChange={(e) => setSelectedColor(e.target.value)}
                              className="w-20 h-10"
                            />
                            <Input
                              type="text"
                              value={selectedColor}
                              onChange={(e) => setSelectedColor(e.target.value)}
                              placeholder="#FF6B6B"
                              className="flex-1"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">Escolha a cor predominante da postagem</p>
                        </div>

                        <Button 
                          onClick={handleGenerateImage} 
                          disabled={generatingImage}
                          className="w-full"
                        >
                          {generatingImage ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Gerando imagem...
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Gerar Arte
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Preview da Arte</Label>
                        <div className="bg-background rounded-lg border-2 border-dashed border-border p-4 min-h-[300px] flex items-center justify-center">
                          {generatedImage ? (
                            <div className="space-y-2 w-full">
                              <img 
                                src={generatedImage} 
                                alt="Arte gerada" 
                                className="w-full rounded-lg shadow-lg"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = generatedImage;
                                  link.download = 'postagem.png';
                                  link.click();
                                  toast({
                                    title: "Download iniciado!",
                                    description: "A imagem está sendo baixada",
                                  });
                                }}
                              >
                                Baixar Imagem
                              </Button>
                            </div>
                          ) : (
                            <div className="text-center text-muted-foreground">
                              <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">A arte aparecerá aqui</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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