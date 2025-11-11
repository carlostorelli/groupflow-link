import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchParams {
  keyword?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  sortBy?: 'commission' | 'price_low' | 'price_high' | 'sales';
  limit?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, searchParams } = await req.json() as { 
      userId: string; 
      searchParams: SearchParams 
    };

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Buscando ofertas na Shopee para usuário:', userId);

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
        JSON.stringify({ error: 'Credenciais Shopee não configuradas ou inativas' }),
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

    // Search for products using Shopee Affiliate API
    const offers = await searchShopeeProducts(appId, password, searchParams);

    console.log(`✅ Encontradas ${offers.length} ofertas na Shopee`);

    return new Response(
      JSON.stringify({ 
        success: true,
        offers,
        total: offers.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro ao buscar ofertas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar ofertas';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function searchShopeeProducts(
  appId: string, 
  password: string, 
  searchParams: SearchParams
) {
  const endpoint = 'https://open-api.affiliate.shopee.com.br/graphql';
  
  // Build GraphQL query for product offers using productOfferV2
  // Based on working examples - only use fields that exist in the API
  const query = `
    query ProductOfferQuery($page: Int, $limit: Int, $listType: Int, $sortType: Int) {
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

  // Map sortBy to Shopee sortType
  // 1 = Relevance, 2 = Item Sold, 3 = Price High, 4 = Price Low, 5 = Commission High
  let sortType = 5; // Default to highest commission
  if (searchParams.sortBy === 'price_low') sortType = 4;
  else if (searchParams.sortBy === 'price_high') sortType = 3;
  else if (searchParams.sortBy === 'sales') sortType = 2;
  else if (searchParams.sortBy === 'commission') sortType = 5;

  const variables = {
    listType: 0, // 0 = All products
    sortType: sortType,
    limit: searchParams.limit || 20,
    page: 1,
  };

  const payload = JSON.stringify({
    query,
    operationName: 'ProductOfferQuery',
    variables,
  });

  // Generate authentication signature
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureString = `${appId}${timestamp}${payload}${password}`;
  
  // Calculate SHA256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const authHeader = `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;

  console.log('📡 Fazendo requisição para Shopee API...');
  console.log('Auth Header:', authHeader);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: payload,
  });

  const responseData = await response.json();
  console.log('📥 Resposta da API Shopee:', JSON.stringify(responseData).substring(0, 500));

  if (responseData.errors) {
    console.error('❌ Erros na API Shopee:', responseData.errors);
    throw new Error(`Erro na API Shopee: ${responseData.errors[0]?.message || 'Erro desconhecido'}`);
  }

  if (!responseData.data?.productOfferV2?.nodes) {
    console.log('⚠️ Nenhum produto encontrado');
    return [];
  }

  const products = responseData.data.productOfferV2.nodes;

  // Filter products based on search parameters
  let filteredProducts = products;

  if (searchParams.minPrice) {
    filteredProducts = filteredProducts.filter((p: any) => 
      parseFloat(p.price) >= searchParams.minPrice!
    );
  }

  if (searchParams.maxPrice) {
    filteredProducts = filteredProducts.filter((p: any) => 
      parseFloat(p.price) <= searchParams.maxPrice!
    );
  }

  if (searchParams.minDiscount) {
    filteredProducts = filteredProducts.filter((p: any) => 
      parseFloat(p.discount) >= searchParams.minDiscount!
    );
  }

  // Sort products
  if (searchParams.sortBy) {
    filteredProducts.sort((a: any, b: any) => {
      switch (searchParams.sortBy) {
        case 'commission':
          return parseFloat(b.commissionRate) - parseFloat(a.commissionRate);
        case 'price_low':
          return parseFloat(a.price) - parseFloat(b.price);
        case 'price_high':
          return parseFloat(b.price) - parseFloat(a.price);
        case 'sales':
          return (b.sales || 0) - (a.sales || 0);
        default:
          return 0;
      }
    });
  }

  // Transform to our format with robust fallbacks
  return filteredProducts.map((product: any) => {
    const price = parseFloat(product.price) || 0;
    const commission = parseFloat(product.commission) || 0;
    const commissionRate = parseFloat(product.commissionRate) || 0;
    
    // Priority: use offerLink (already affiliate link) or fallback to productLink
    const productUrl = product.offerLink || product.productLink || '';
    
    return {
      id: productUrl || String(Date.now()),
      title: product.productName || 'Produto',
      price,
      old_price: null,
      discount: commission > 0 ? Math.round(commission) : null,
      image_url: extractImageFromUrl(product.productLink || productUrl),
      product_url: productUrl,
      category: searchParams.categories?.[0] || 'geral',
      commission: commissionRate * 100,
      sales: 0,
      shop_name: 'Shopee',
    };
  });
}

// Helper function to extract product ID from Shopee URL and build image URL
function extractImageFromUrl(url: string): string | null {
  try {
    // Shopee product URLs usually have the format: https://shopee.com.br/product/{shopId}/{itemId}
    // or contain an itemid parameter
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Try to find itemId in path
    if (pathParts.length >= 3) {
      const itemId = pathParts[pathParts.length - 1];
      const shopId = pathParts[pathParts.length - 2];
      
      // Shopee image format (may vary)
      return `https://cf.shopee.com.br/file/${itemId}`;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}
