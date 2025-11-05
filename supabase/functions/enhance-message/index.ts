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
    const { productLinks, copyStyle } = await req.json();
    console.log('Criando mensagens para:', productLinks, 'Estilo:', copyStyle);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const styleDescriptions: Record<string, string> = {
      aggressive: 'Venda Agressiva - Use linguagem direta, imperativos, CAPS LOCK estratégico, senso de oportunidade única',
      scarcity: 'Escassez e Urgência - Foque em tempo limitado, estoque acabando, "últimas unidades", "só hoje"',
      emotional: 'Apelo Emocional - Conecte com sonhos, desejos, transformação de vida, felicidade',
      benefit: 'Foco em Benefícios - Destaque vantagens práticas, economia, solução de problemas',
      social: 'Prova Social - Use testemunhos imaginários, "milhares já compraram", tendências',
      storytelling: 'Storytelling - Conte uma pequena história envolvente sobre o produto'
    };

    const styleDesc = styleDescriptions[copyStyle] || styleDescriptions.aggressive;

    const prompt = `Você é um especialista em copywriting para vendas no WhatsApp. Analise os seguintes links de produtos e crie mensagens de venda persuasivas.

Links dos produtos:
${productLinks}

Estilo solicitado: ${styleDesc}

IMPORTANTE: Primeiro, faça uma breve análise dos links fornecidos (mesmo que sejam genéricos, extraia o máximo de informação possível do texto do link).

Depois, crie 3 versões diferentes de mensagens de venda no estilo solicitado. Cada mensagem deve:
- Ter entre 100-200 palavras
- Usar emojis estrategicamente
- Incluir call-to-action forte
- Ser adaptada para envio em grupos de WhatsApp
- Ser única e diferente das outras versões

Além disso, forneça:
- Uma explicação de por que cada mensagem funciona
- 3 dicas práticas de como usar essas mensagens

Retorne APENAS um JSON válido (sem markdown) no seguinte formato:
{
  "productInfo": "Breve análise dos produtos baseada nos links fornecidos",
  "messages": [
    {
      "style": "Nome descritivo desta variação",
      "message": "Texto completo da mensagem de venda",
      "reason": "Explicação de por que esta abordagem funciona"
    }
  ],
  "tips": [
    "Dica prática 1",
    "Dica prática 2",
    "Dica prática 3"
  ]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um especialista em copywriting para vendas. Sempre retorne respostas em JSON válido, sem markdown.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API de IA:', response.status, errorText);
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(content);

    console.log('Mensagens criadas com sucesso');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao criar mensagens:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});