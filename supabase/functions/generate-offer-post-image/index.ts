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
    const { 
      productImageUrl, 
      topText, 
      bottomText, 
      backgroundColor,
      layout = 'square',
      template = 'default'
    } = await req.json();

    console.log('Gerando imagem de postagem com:', { 
      productImageUrl, 
      topText, 
      bottomText, 
      backgroundColor,
      layout,
      template
    });

    if (!productImageUrl || !topText) {
      return new Response(
        JSON.stringify({ error: 'productImageUrl e topText são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Definir dimensões baseado no layout
    const dimensions: Record<string, { width: number; height: number }> = {
      square: { width: 1024, height: 1024 },
      horizontal: { width: 1024, height: 576 },
      vertical: { width: 576, height: 1024 }
    };

    const { width, height } = dimensions[layout] || dimensions.square;

    // Templates predefinidos
    const templates: Record<string, { colors: string; style: string }> = {
      default: {
        colors: backgroundColor,
        style: 'moderno e profissional'
      },
      blackfriday: {
        colors: '#000000 com detalhes em amarelo/dourado (#FFD700)',
        style: 'BLACK FRIDAY - use elementos de fogo, raios, explosões. Muito impacto visual e senso de urgência'
      },
      natal: {
        colors: '#C41E3A (vermelho natal) e #165B33 (verde natal) com detalhes dourados',
        style: 'NATAL - use elementos natalinos como estrelas, neve, presentes. Ambiente festivo e acolhedor'
      },
      fretegratis: {
        colors: '#00A86B (verde) com detalhes em branco',
        style: 'FRETE GRÁTIS - destaque visual para "FRETE GRÁTIS", use ícones de entrega, caminhões. Transmita economia e conveniência'
      }
    };

    const templateConfig = templates[template] || templates.default;
    const finalBgColor = template === 'default' ? backgroundColor : templateConfig.colors;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Buscar a imagem do produto
    console.log('Buscando imagem do produto:', productImageUrl);
    const productImageResponse = await fetch(productImageUrl);
    if (!productImageResponse.ok) {
      throw new Error(`Erro ao buscar imagem do produto: ${productImageResponse.status}`);
    }

    const productImageBuffer = await productImageResponse.arrayBuffer();
    const productImageBase64 = btoa(
      new Uint8Array(productImageBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    // Criar prompt para a IA gerar a imagem de postagem
    const layoutDescription = layout === 'horizontal' 
      ? 'formato HORIZONTAL (paisagem) ideal para stories e posts'
      : layout === 'vertical' 
      ? 'formato VERTICAL (retrato) ideal para Instagram Stories e WhatsApp Status'
      : 'formato QUADRADO ideal para feed do Instagram';

    const prompt = `Crie uma imagem de postagem para redes sociais com as seguintes especificações:

DIMENSÕES:
- Tamanho: ${width}x${height}px
- Formato: ${layoutDescription}

LAYOUT:
- Fundo: ${finalBgColor}
- Topo (${layout === 'horizontal' ? '30%' : '20%'} superior): Texto "${topText}" em fonte GRANDE, BOLD, branca com sombra preta para contraste
- Centro (${layout === 'horizontal' ? '40%' : '55%'}): Imagem do produto fornecida, centralizada, com destaque e boa visibilidade
- Rodapé (${layout === 'horizontal' ? '30%' : '25%'} inferior): Texto "${bottomText}" em fonte menor (60% do topo), branca com sombra

ESTILO VISUAL:
- ${templateConfig.style}
- Design ${template === 'default' ? 'moderno e profissional' : 'temático e impactante'} para e-commerce
- Alto contraste para legibilidade máxima
- Composição equilibrada e atraente
- Tipografia clara e legível
${template !== 'default' ? `- Elementos visuais relacionados ao tema ${template}` : ''}

IMPORTANTE: 
- A imagem do produto deve estar CLARAMENTE VISÍVEL e ser o FOCO PRINCIPAL
- Textos devem ser MUITO LEGÍVEIS com contraste forte
- Se for tema especial (Black Friday, Natal, Frete Grátis), adicione elementos visuais relacionados mas sem ofuscar o produto`;

    console.log('Chamando API Lovable AI para gerar imagem...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${productImageBase64}`
                }
              }
            ]
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro na API Lovable AI:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos em Settings -> Workspace -> Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Erro na API de IA: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('Resposta da API recebida');

    const generatedImageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!generatedImageUrl) {
      console.error('Resposta da API:', JSON.stringify(aiData, null, 2));
      throw new Error('Imagem não encontrada na resposta da API');
    }

    console.log('Imagem gerada com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true,
        imageUrl: generatedImageUrl
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Erro ao gerar imagem:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao gerar imagem',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
