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
    const { prompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('Criando campanha com prompt:', prompt);

    // Generate campaign strategy
    const strategyResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: 'Você é um especialista em marketing digital e campanhas de WhatsApp. Crie estratégias completas e eficazes.'
          },
          {
            role: 'user',
            content: `Com base nesta descrição de campanha: "${prompt}"

Gere uma estratégia completa em formato JSON com:
1. groupNames: Array com 5 nomes criativos para grupos (use emojis)
2. description: Descrição atraente para fixar no grupo (máximo 200 caracteres)
3. welcomeMessage: Mensagem de boas-vindas calorosa e profissional
4. schedule: Array com 7 objetos, cada um contendo:
   - day: número do dia (1-7)
   - title: título do post do dia
   - message: mensagem completa para enviar

Responda APENAS com o JSON, sem markdown ou texto adicional.`
          }
        ],
      }),
    });

    if (!strategyResponse.ok) {
      const errorText = await strategyResponse.text();
      console.error('Erro da API de estratégia:', strategyResponse.status, errorText);
      throw new Error(`Erro ao gerar estratégia: ${strategyResponse.status}`);
    }

    const strategyData = await strategyResponse.json();
    const campaignData = JSON.parse(strategyData.choices[0].message.content);

    // Generate group image
    const imagePrompt = `Create a vibrant and professional WhatsApp group cover image for: ${prompt}. Include relevant icons, emojis, and promotional elements. Make it eye-catching and suitable for a sales/discount group. Ultra high resolution.`;
    
    const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: imagePrompt
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    let groupImage = null;
    if (imageResponse.ok) {
      const imageData = await imageResponse.json();
      groupImage = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    }

    const result = {
      ...campaignData,
      groupImage
    };

    console.log('Campanha criada com sucesso');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao criar campanha:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
