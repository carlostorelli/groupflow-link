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
  
  // Build GraphQL query for product offers
  const query = `
    query ProductOfferQuery($keyword: String, $limit: Int, $page: Int) {
      productOffer(
        keyword: $keyword
        limit: $limit
        page: $page
      ) {
        nodes {
          itemId
          itemName
          itemImage
          itemUrl
          shopId
          shopName
          price
          originalPrice
          discount
          commissionRate
          sales
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
    keyword: searchParams.keyword || '',
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

  if (!responseData.data?.productOffer?.nodes) {
    console.log('⚠️ Nenhum produto encontrado');
    return [];
  }

  const products = responseData.data.productOffer.nodes;

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

  // Transform to our format
  return filteredProducts.map((product: any) => ({
    title: product.itemName,
    price: parseFloat(product.price),
    old_price: product.originalPrice ? parseFloat(product.originalPrice) : null,
    discount: product.discount ? parseFloat(product.discount) : null,
    image_url: product.itemImage,
    product_url: product.itemUrl,
    category: searchParams.categories?.[0] || 'geral',
    commission: parseFloat(product.commissionRate) * 100, // Convert to percentage
    sales: product.sales || 0,
    shop_name: product.shopName,
  }));
}
