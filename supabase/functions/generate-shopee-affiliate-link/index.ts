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

    // Generate timestamp for signature
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Generate affiliate link using Shopee Affiliate API
    // For now, we'll append the App ID as a query parameter
    // In production, this should use the Shopee Open API to generate proper affiliate links
    
    const url = new URL(productUrl);
    url.searchParams.set('af_siteid', appId);
    url.searchParams.set('pid', appId);
    const affiliateUrl = url.toString();

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
