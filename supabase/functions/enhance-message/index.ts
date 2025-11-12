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
    const { productLinks, copyStyle, affiliateLink } = await req.json();
    console.log('Criando mensagens para:', productLinks, 'Estilo:', copyStyle, 'Link afiliado:', affiliateLink);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Tentar extrair a imagem do produto se for link da Shopee
    let productImage = null;
    try {
      const shopeeMatch = productLinks.match(/shopee\.com\.br\/.*?-i\.(\d+)\.(\d+)/);
      if (shopeeMatch) {
        console.log('Link da Shopee detectado, tentando buscar imagem...');
        const shopId = shopeeMatch[1];
        const itemId = shopeeMatch[2];
        
        try {
          // Tentar via API da Shopee primeiro
          const apiUrl = `https://shopee.com.br/api/v4/item/get?shopid=${shopId}&itemid=${itemId}`;
          console.log('Buscando na API da Shopee:', apiUrl);
          
          const apiResponse = await fetch(apiUrl);
          if (apiResponse.ok) {
            const data = await apiResponse.json();
            if (data?.data?.item?.image) {
              productImage = `https://cf.shopee.com.br/file/${data.data.item.image}`;
              console.log('Imagem do produto encontrada via API:', productImage);
            } else if (data?.data?.item?.images && data.data.item.images.length > 0) {
              productImage = `https://cf.shopee.com.br/file/${data.data.item.images[0]}`;
              console.log('Imagem do produto encontrada via API (images array):', productImage);
            }
          }
        } catch (apiError) {
          console.log('Erro ao buscar via API da Shopee:', apiError);
        }
        
        // Fallback: tentar scraping da página
        if (!productImage) {
          console.log('Tentando scraping da página como fallback...');
          const pageResponse = await fetch(productLinks, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (pageResponse.ok) {
            const html = await pageResponse.text();
            // Tentar encontrar a imagem do produto no HTML
            const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
            if (imageMatch) {
              productImage = imageMatch[1];
              console.log('Imagem do produto encontrada via scraping:', productImage);
            }
          }
        }
      }
    } catch (imageError) {
      console.log('Não foi possível extrair imagem do produto:', imageError);
      // Continua mesmo sem a imagem
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

    const linkToInclude = affiliateLink || productLinks;

    const prompt = `Você é um especialista em copywriting para vendas no WhatsApp. Analise o seguinte link de produto e crie mensagens de venda persuasivas.

Link do produto:
${productLinks}

${affiliateLink ? `Link de afiliado (USE ESTE LINK nas mensagens):\n${affiliateLink}\n` : ''}

Estilo solicitado: ${styleDesc}

IMPORTANTE: 
- Primeiro, faça uma breve análise do link fornecido (mesmo que seja genérico, extraia o máximo de informação possível do texto do link).
- OBRIGATÓRIO: Inclua o link ${affiliateLink ? 'de afiliado' : 'do produto'} em TODAS as mensagens geradas. Use o formato "LINK DO PRODUTO AQUI: [link]" no final de cada mensagem.

Depois, crie 3 versões diferentes de mensagens de venda no estilo solicitado. Cada mensagem deve:
- Ter entre 100-200 palavras
- Usar emojis estrategicamente
- Incluir call-to-action forte
- Ser adaptada para envio em grupos de WhatsApp
- Ser única e diferente das outras versões
- SEMPRE terminar com o link do produto

Além disso, forneça:
- Uma explicação de por que cada mensagem funciona
- 3 dicas práticas de como usar essas mensagens

Retorne APENAS um JSON válido (sem markdown) no seguinte formato:
{
  "productInfo": "Breve análise do produto baseada no link fornecido",
  "messages": [
    {
      "style": "Nome descritivo desta variação",
      "message": "Texto completo da mensagem de venda COM O LINK incluído no final",
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
    
    // Adicionar a imagem do produto ao resultado
    if (productImage) {
      result.productImage = productImage;
    }

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