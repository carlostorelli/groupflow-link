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
    const { appId, password } = await req.json();

    if (!appId || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'App ID e Password são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Testando credenciais Shopee para App ID:', appId);

    // Test Shopee API connection
    // Using Shopee Open Platform API to validate credentials
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/shop/get_shop_info';
    const baseUrl = 'https://partner.shopeemobile.com';
    
    // Generate sign for authentication
    const signString = `${appId}${path}${timestamp}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(signString + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sign = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const apiUrl = `${baseUrl}${path}?partner_id=${appId}&timestamp=${timestamp}&sign=${sign}`;
    
    console.log('📡 Fazendo requisição para Shopee API...');
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data_response = await response.json();
    console.log('📥 Resposta da Shopee:', data_response);

    // Check if the response indicates successful authentication
    if (data_response.error) {
      console.error('❌ Erro na autenticação Shopee:', data_response.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data_response.message || 'Credenciais inválidas ou erro na API da Shopee'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Credenciais Shopee validadas com sucesso!');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Credenciais válidas!' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro ao testar credenciais Shopee:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro ao conectar com a API da Shopee'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
