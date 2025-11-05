import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { platform, category } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log(`Analisando tendências na ${platform} para categoria: ${category}`);

    const platformNames: Record<string, string> = {
      shopee: 'Shopee',
      shein: 'Shein',
      mercadolivre: 'Mercado Livre'
    };
    
    const platformName = platformNames[platform] || 'Shopee';

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em e-commerce, tendências de mercado e análise de produtos populares em plataformas brasileiras.'
          },
          {
            role: 'user',
            content: `Identifique produtos em tendência na plataforma ${platformName} para a categoria "${category}".

Gere uma análise completa em formato JSON com:
1. products: Array com 10 produtos em alta, cada um contendo:
   - name: Nome do produto
   - description: Breve descrição (1 linha)
   - price: Faixa de preço estimada (ex: "R$ 50 - R$ 80")
   - sales: Número estimado de vendas recentes (ex: "2.5k")
   - rating: Avaliação (ex: "4.8")
2. marketAnalysis: Análise detalhada do mercado para essa categoria (3-4 parágrafos)
3. recommendations: Recomendações estratégicas para sellers (3-4 parágrafos)

Base-se em conhecimento real sobre tendências atuais do mercado brasileiro.
Responda APENAS com o JSON, sem markdown ou texto adicional.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API:', response.status, errorText);
      throw new Error(`Erro ao analisar tendências: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    console.log('Análise de tendências concluída');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao analisar tendências:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
