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
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 [TEST] Testando conexão Shopee para usuário:', userId);

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
      console.error('❌ [TEST] Credenciais não encontradas:', credError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'CREDENTIALS_NOT_FOUND',
          message: 'Credenciais Shopee não configuradas ou inativas',
          details: credError
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { appId, password } = credentials.credentials as { appId: string; password: string };

    if (!appId || !password) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'CREDENTIALS_INCOMPLETE',
          message: 'Credenciais Shopee incompletas (appId ou password faltando)'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [TEST] Credenciais encontradas, testando API...');

    // Test the Shopee API with a simple query
    const testResult = await testShopeeAPI(appId, password);

    return new Response(
      JSON.stringify(testResult),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [TEST] Erro no teste:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'TEST_EXCEPTION',
        message: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function testShopeeAPI(appId: string, password: string) {
  const endpoint = 'https://open-api.affiliate.shopee.com.br/graphql';
  
  // Simple test query - just fetch first page with 5 items
  const query = `
    query TestProductOfferQuery($page: Int, $limit: Int, $listType: Int, $sortType: Int) {
      productOfferV2(
        listType: $listType
        sortType: $sortType
        page: $page
        limit: $limit
      ) {
        nodes {
          commissionRate
          commission
          price
          productName
          productLink
          offerLink
        }
        pageInfo {
          page
          limit
          hasNextPage
        }
      }
    }
  `;

  const variables = {
    listType: 0,
    sortType: 4,
    limit: 5,
    page: 1,
  };

  const payload = JSON.stringify({
    query,
    operationName: 'TestProductOfferQuery',
    variables,
  });

  // Generate authentication signature
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureString = `${appId}${timestamp}${payload}${password}`;
  
  console.log('🔐 [TEST] Gerando assinatura de autenticação');
  console.log('  📋 appId:', appId);
  console.log('  ⏰ timestamp:', timestamp);
  console.log('  📦 payload length:', payload.length);
  console.log('  📝 payload preview:', payload.substring(0, 150) + '...');
  
  // Calculate SHA256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const authHeader = `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
  
  console.log('  🔑 signature:', signature.substring(0, 20) + '...');
  console.log('  📤 auth header:', authHeader.substring(0, 80) + '...');

  const requestDetails = {
    endpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader.substring(0, 80) + '...',
    },
    payload: {
      query: query.substring(0, 100) + '...',
      variables,
    },
    timestamp,
    appId,
    signaturePreview: signature.substring(0, 20) + '...',
  };

  console.log('📡 [TEST] Fazendo requisição para Shopee API...');

  const startTime = Date.now();
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: payload,
    });

    const duration = Date.now() - startTime;
    const responseHeaders = Object.fromEntries(response.headers.entries());

    console.log('📥 [TEST] Resposta recebida');
    console.log('  📊 status:', response.status, response.statusText);
    console.log('  ⏱️ duration:', duration, 'ms');
    console.log('  📋 headers:', JSON.stringify(responseHeaders));

    const responseData = await response.json();
    
    console.log('📦 [TEST] Response body:', JSON.stringify(responseData).substring(0, 500));

    // Classify the response
    const classification = classifyResponse(response.status, responseData);

    return {
      success: response.ok && !responseData.errors,
      httpStatus: response.status,
      statusText: response.statusText,
      duration,
      classification,
      request: requestDetails,
      response: {
        headers: responseHeaders,
        data: responseData.data || null,
        errors: responseData.errors || null,
        rawBody: responseData,
      },
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [TEST] Erro na requisição:', error);
    
    return {
      success: false,
      httpStatus: 0,
      statusText: 'Network Error',
      duration,
      classification: {
        type: 'NETWORK_ERROR',
        severity: 'CRITICAL',
        message: 'Falha na conexão com a API Shopee',
        details: error instanceof Error ? error.message : String(error),
      },
      request: requestDetails,
      response: null,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : { message: String(error) },
      timestamp: new Date().toISOString(),
    };
  }
}

function classifyResponse(status: number, responseData: any) {
  // Check for GraphQL errors first
  if (responseData.errors && Array.isArray(responseData.errors)) {
    const firstError = responseData.errors[0];
    const errorCode = firstError.extensions?.code;
    const errorMessage = firstError.message || '';

    // Token/Authentication errors
    if (errorCode === 10020 || errorMessage.includes('Invalid Signature')) {
      return {
        type: 'INVALID_SIGNATURE',
        severity: 'CRITICAL',
        message: 'Assinatura inválida - verifique appId e password',
        details: 'A autenticação falhou. Possíveis causas: appId incorreto, password incorreto, ou problema na geração da assinatura SHA256.',
        errorCode,
        suggestion: 'Reconfigure suas credenciais Shopee em Programas de Afiliados.',
      };
    }

    if (errorCode === 10001 || errorMessage.includes('Unauthorized') || errorMessage.includes('Token')) {
      return {
        type: 'AUTH_ERROR',
        severity: 'CRITICAL',
        message: 'Token expirado ou inválido',
        details: errorMessage,
        errorCode,
        suggestion: 'Gere um novo token na plataforma Shopee Affiliate.',
      };
    }

    // Query/Schema errors
    if (errorMessage.includes('Cannot query field') || errorMessage.includes('Unknown field')) {
      return {
        type: 'MALFORMED_QUERY',
        severity: 'HIGH',
        message: 'Consulta GraphQL malformada',
        details: errorMessage,
        errorCode,
        suggestion: 'O schema da API Shopee pode ter mudado. Contate o suporte.',
      };
    }

    // Permission errors
    if (errorCode === 10003 || errorMessage.includes('Permission') || errorMessage.includes('Forbidden')) {
      return {
        type: 'PERMISSION_DENIED',
        severity: 'HIGH',
        message: 'Permissões insuficientes',
        details: errorMessage,
        errorCode,
        suggestion: 'Verifique se sua conta Shopee Affiliate tem as permissões necessárias.',
      };
    }

    // Rate limiting
    if (errorCode === 10029 || errorMessage.includes('Rate limit')) {
      return {
        type: 'RATE_LIMIT',
        severity: 'MEDIUM',
        message: 'Limite de requisições excedido',
        details: errorMessage,
        errorCode,
        suggestion: 'Aguarde alguns minutos antes de tentar novamente.',
      };
    }

    // Generic GraphQL error
    return {
      type: 'GRAPHQL_ERROR',
      severity: 'HIGH',
      message: 'Erro GraphQL',
      details: errorMessage,
      errorCode,
      allErrors: responseData.errors,
    };
  }

  // HTTP status errors
  if (status >= 500) {
    return {
      type: 'SERVER_ERROR',
      severity: 'HIGH',
      message: 'Erro no servidor Shopee',
      details: `HTTP ${status} - O servidor da Shopee está com problemas`,
      suggestion: 'Tente novamente em alguns minutos.',
    };
  }

  if (status === 401 || status === 403) {
    return {
      type: 'HTTP_AUTH_ERROR',
      severity: 'CRITICAL',
      message: 'Falha de autenticação HTTP',
      details: `HTTP ${status} - Credenciais inválidas ou expiradas`,
      suggestion: 'Reconfigure suas credenciais Shopee.',
    };
  }

  if (status === 400) {
    return {
      type: 'BAD_REQUEST',
      severity: 'HIGH',
      message: 'Requisição malformada',
      details: `HTTP ${status} - A requisição está incorreta`,
      suggestion: 'Contate o suporte se o problema persistir.',
    };
  }

  if (!status || status === 0) {
    return {
      type: 'NETWORK_ERROR',
      severity: 'CRITICAL',
      message: 'Erro de rede',
      details: 'Não foi possível conectar à API Shopee',
      suggestion: 'Verifique sua conexão com a internet.',
    };
  }

  // Success
  if (status === 200 && responseData.data) {
    return {
      type: 'SUCCESS',
      severity: 'INFO',
      message: 'Conexão bem-sucedida',
      details: 'API Shopee está respondendo corretamente',
      productsFound: responseData.data.productOfferV2?.nodes?.length || 0,
    };
  }

  // Unknown
  return {
    type: 'UNKNOWN',
    severity: 'MEDIUM',
    message: 'Resposta desconhecida',
    details: `HTTP ${status}`,
  };
}
