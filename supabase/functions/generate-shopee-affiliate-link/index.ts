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
    const { productUrl, userId } = await req.json();

    if (!productUrl || !userId) {
      return new Response(
        JSON.stringify({ error: 'productUrl e userId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔗 Gerando link de afiliado Shopee para:', productUrl);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's Shopee credentials
    const { data: credentials, error: credError } = await supabase
      .from('affiliate_credentials')
      .select('credentials')
      .eq('user_id', userId)
      .eq('store', 'shopee')
      .eq('is_active', true)
      .single();

    if (credError || !credentials) {
      console.error('❌ Credenciais Shopee não encontradas:', credError);
      return new Response(
        JSON.stringify({ error: 'Credenciais Shopee não configuradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { appId, password } = credentials.credentials as { appId: string; password: string };

    if (!appId || !password) {
      return new Response(
        JSON.stringify({ error: 'Credenciais Shopee incompletas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate affiliate link using Shopee Affiliate API
    console.log('🔗 Gerando short link da Shopee...');
    
    const graphqlQuery = `
      mutation GenerateShortLink($originalUrl: String!, $subIds: [String]) {
        generateShortLink(originalUrl: $originalUrl, subIds: $subIds) {
          shortLink
          error
        }
      }
    `;

    const variables = {
      originalUrl: productUrl,
      subIds: [userId], // Track by user ID
    };

    const payload = JSON.stringify({
      query: graphqlQuery,
      operationName: 'GenerateShortLink',
      variables,
    });

    // Generate authentication signature
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureString = `${appId}${timestamp}${payload}${password}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const authHeader = `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;

    const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: payload,
    });

    const responseData = await response.json();
    console.log('📥 Resposta API Shopee:', responseData);

    if (responseData.errors) {
      console.error('❌ Erro ao gerar link:', responseData.errors);
      throw new Error(`Erro na API Shopee: ${responseData.errors[0]?.message || 'Erro desconhecido'}`);
    }

    const shortLink = responseData.data?.generateShortLink?.shortLink;
    
    if (!shortLink) {
      console.error('❌ Short link não retornado');
      // Fallback to original URL with appId parameter
      const url = new URL(productUrl);
      url.searchParams.set('af_siteid', appId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          affiliateUrl: url.toString(),
          originalUrl: productUrl,
          warning: 'Link de afiliado gerado localmente (API indisponível)'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const affiliateUrl = shortLink;

    console.log('✅ Link de afiliado gerado:', affiliateUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        affiliateUrl,
        originalUrl: productUrl
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro ao gerar link de afiliado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar link de afiliado';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
