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
    const { category, store, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const categoryText = category ? `da categoria ${category}` : '';
    const storeText = store ? `da loja ${store}` : '';
    
    let systemPrompt = '';
    if (mode === 'search') {
      systemPrompt = `Você é um especialista em copywriting para e-commerce. Crie 3 textos curtos e persuasivos para anunciar ofertas ${categoryText} ${storeText}. Cada texto deve:
- Ter no máximo 20 palavras
- Ser empolgante e criar senso de urgência
- Usar emojis relevantes (máximo 2 por texto)
- Ser direto ao ponto
- Não mencionar valores ou descontos específicos

Retorne apenas os 3 textos, um por linha, sem numeração.`;
    } else {
      systemPrompt = `Você é um especialista em copywriting para grupos de WhatsApp. Crie 3 textos curtos e persuasivos para reenviar ofertas monitoradas ${categoryText} ${storeText}. Cada texto deve:
- Ter no máximo 15 palavras
- Ser casual e direto
- Usar no máximo 1 emoji por texto
- Criar senso de oportunidade
- Não mencionar valores ou descontos específicos

Retorne apenas os 3 textos, um por linha, sem numeração.`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Gere os 3 textos agora.' }
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de uso da IA excedido. Tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('Erro ao chamar API de IA');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    // Parse the response into array of texts
    const texts = aiResponse
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.match(/^\d+\./));

    return new Response(
      JSON.stringify({ texts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const err = error as Error;
    console.error('Error in suggest-offer-text:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
