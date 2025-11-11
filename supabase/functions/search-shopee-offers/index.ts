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
    limit: 50, // Maximum allowed by Shopee API
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
  
  console.log(`📊 Total de produtos da API: ${products.length}`);
  
  // Category synonyms to improve filtering (using word boundaries)
  const categorySynonyms: Record<string, string[]> = {
    'pets': ['\\bpet\\b', '\\bcachorro\\b', '\\bgato\\b', '\\bcao\\b', '\\bcão\\b', '\\banimal\\b', '\\bracao\\b', '\\bração\\b', '\\bcoleira\\b', '\\bpetisco\\b', '\\banimais\\b'],
    'pet': ['\\bpet\\b', '\\bcachorro\\b', '\\bgato\\b', '\\bcao\\b', '\\bcão\\b', '\\banimal\\b', '\\bracao\\b', '\\bração\\b', '\\bcoleira\\b', '\\bpetisco\\b', '\\banimais\\b'],
    'beleza': ['\\bbeleza\\b', '\\bmaquiagem\\b', '\\bskincare\\b', '\\bperfume\\b', '\\bcosmetico\\b', '\\bcosmético\\b', '\\bcuidado\\b', '\\bshampoo\\b', '\\bcreme\\b', '\\bbatom\\b'],
    'eletrônicos': ['\\beletronico\\b', '\\beletrônico\\b', '\\bcelular\\b', '\\bfone\\b', '\\btablet\\b', '\\bnotebook\\b', '\\btech\\b', '\\bsmartwatch\\b', '\\bcarregador\\b', '\\bcabo\\b', '\\bmouse\\b', '\\bteclado\\b'],
    'eletronicos': ['\\beletronico\\b', '\\beletrônico\\b', '\\bcelular\\b', '\\bfone\\b', '\\btablet\\b', '\\bnotebook\\b', '\\btech\\b', '\\bsmartwatch\\b', '\\bcarregador\\b', '\\bcabo\\b', '\\bmouse\\b', '\\bteclado\\b'],
    'moda': ['\\broupa\\b', '\\bblusa\\b', '\\bcalca\\b', '\\bcalça\\b', '\\bvestido\\b', '\\bsapato\\b', '\\btenis\\b', '\\btênis\\b', '\\bcamisa\\b', '\\bshort\\b', '\\bbolsa\\b', '\\bacessorio\\b', '\\bacessório\\b'],
    'casa e decoração': ['\\bcasa\\b', '\\bdecoracao\\b', '\\bdecoração\\b', '\\bcozinha\\b', '\\bquarto\\b', '\\bsala\\b', '\\borganizador\\b', '\\bluminaria\\b', '\\bluminária\\b', '\\bquadro\\b', '\\btapete\\b'],
    'casa e decoracao': ['\\bcasa\\b', '\\bdecoracao\\b', '\\bdecoração\\b', '\\bcozinha\\b', '\\bquarto\\b', '\\bsala\\b', '\\borganizador\\b', '\\bluminaria\\b', '\\bluminária\\b', '\\bquadro\\b', '\\btapete\\b'],
    'casa': ['\\bcasa\\b', '\\bdecoracao\\b', '\\bdecoração\\b', '\\bcozinha\\b', '\\bquarto\\b', '\\bsala\\b', '\\borganizador\\b', '\\bluminaria\\b', '\\bluminária\\b', '\\bquadro\\b', '\\btapete\\b'],
    'esportes': ['\\besporte\\b', '\\bfitness\\b', '\\btreino\\b', '\\bacademia\\b', '\\bcorrida\\b', '\\bbola\\b', '\\braquete\\b', '\\bbike\\b', '\\bbicicleta\\b', '\\bnatacao\\b', '\\bnatação\\b'],
    'esporte': ['\\besporte\\b', '\\bfitness\\b', '\\btreino\\b', '\\bacademia\\b', '\\bcorrida\\b', '\\bbola\\b', '\\braquete\\b', '\\bbike\\b', '\\bbicicleta\\b', '\\bnatacao\\b', '\\bnatação\\b'],
    'livros': ['\\blivro\\b', '\\bliteratura\\b', '\\bromance\\b', '\\bficcao\\b', '\\bficção\\b', '\\bautor\\b', '\\bbestseller\\b', '\\bleitura\\b', '\\bebook\\b', '\\be-book\\b'],
    'brinquedos': ['\\bbrinquedo\\b', '\\bboneca\\b', '\\bcarrinho\\b', '\\bjogo\\b', '\\blego\\b', '\\bpuzzle\\b', '\\binfantil\\b', '\\bcrianca\\b', '\\bcriança\\b'],
    'alimentos': ['\\balimento\\b', '\\bcomida\\b', '\\bbebida\\b', '\\bsnack\\b', '\\blanche\\b', '\\bdoce\\b', '\\bchocolate\\b', '\\bbiscoito\\b', '\\bcafe\\b', '\\bcafé\\b', '\\bcha\\b', '\\bchá\\b'],
    'automotivo': ['\\bautomotivo\\b', '\\bcarro\\b', '\\bmoto\\b', '\\bpeca\\b', '\\bpeça\\b', '\\bacessorio carro\\b', '\\bacessório carro\\b', '\\bsuporte\\b', '\\boleo\\b', '\\bóleo\\b', '\\bfiltro\\b']
  };
  
  // Filter by categories/keywords (if provided)
  if (searchParams.categories && searchParams.categories.length > 0) {
    console.log(`🔍 Filtrando por categorias: ${searchParams.categories.join(', ')}`);
    
    filteredProducts = products.filter((p: any) => {
      const productName = (p.productName || '').toLowerCase();
      
      return searchParams.categories!.some(category => {
        const categoryLower = category.toLowerCase();
        
        // Get synonyms for this category
        const synonymPatterns = categorySynonyms[categoryLower] || [categoryLower];
        
        // Check if product name contains any synonym as whole word
        return synonymPatterns.some(pattern => {
          try {
            const regex = new RegExp(pattern, 'i');
            return regex.test(productName);
          } catch (e) {
            // Fallback to simple includes if regex fails
            return productName.includes(pattern);
          }
        });
      });
    });
    
    console.log(`✅ ${filteredProducts.length} produtos encontrados para as categorias selecionadas`);
    
    // Log some product names for debugging
    if (filteredProducts.length > 0 && filteredProducts.length < 5) {
      filteredProducts.forEach((p: any) => {
        console.log(`   - ${p.productName}`);
      });
    }
    
    // If no products found after filtering, return empty array
    if (filteredProducts.length === 0) {
      console.log(`⚠️ Nenhum produto encontrado com as categorias especificadas`);
    }
  }

  // Filter by keyword (alternative to categories)
  if (searchParams.keyword && !searchParams.categories?.length) {
    const keyword = searchParams.keyword.toLowerCase();
    filteredProducts = filteredProducts.filter((p: any) => 
      (p.productName || '').toLowerCase().includes(keyword)
    );
    console.log(`🔍 Filtrados ${filteredProducts.length} produtos por palavra-chave`);
  }

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
    
    // ALWAYS prioritize offerLink (short affiliate link)
    // productLink is only used as fallback for image extraction
    const affiliateLink = product.offerLink || ''; // Empty if not available
    const fullProductLink = product.productLink || '';
    
    return {
      id: affiliateLink || fullProductLink || String(Date.now()),
      title: product.productName || 'Produto',
      price,
      old_price: null,
      discount: commission > 0 ? Math.round(commission) : null,
      image_url: extractImageFromUrl(fullProductLink || affiliateLink),
      product_url: affiliateLink || fullProductLink, // Will be converted to short link later if needed
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
