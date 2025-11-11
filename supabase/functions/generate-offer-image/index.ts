import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productTitle, productImage, price, oldPrice, discount } = await req.json();

    console.log('🎨 Gerando imagem de oferta para:', productTitle);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Generate promotional image with AI
    const prompt = `Create a professional product promotional image for e-commerce:
    
Product: ${productTitle}
Price: R$ ${price.toFixed(2)}
${oldPrice ? `Original Price (crossed out): R$ ${oldPrice.toFixed(2)}` : ''}
${discount ? `Discount: ${discount}% OFF` : ''}

Design requirements:
- Modern, clean e-commerce style
- Vibrant colors with gradient backgrounds (purple/pink/orange)
- Product image prominently displayed
- Price information clearly visible with old price crossed out
- Discount badge in the corner
- Professional typography
- High quality, attention-grabbing design
- Brazilian Portuguese text
- Similar to Shopee/Mercado Livre promotional style

Make it eye-catching and professional for WhatsApp sharing.`;

    console.log('📡 Chamando Lovable AI para gerar imagem...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ Erro na AI API:', errorText);
      throw new Error(`AI API error: ${aiResponse.status} ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('✅ Imagem gerada pela IA');

    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      throw new Error('Nenhuma imagem retornada pela IA');
    }

    // Extract base64 data
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Upload to Supabase Storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fileName = `offer-${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('offer-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('❌ Erro ao fazer upload:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('offer-images')
      .getPublicUrl(fileName);

    console.log('✅ Imagem salva em:', publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true,
        imageUrl: publicUrl,
        fileName
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro ao gerar imagem:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar imagem';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
