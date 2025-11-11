import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Automation {
  id: string;
  user_id: string;
  name: string;
  mode: 'search' | 'monitor';
  status: 'active' | 'paused';
  stores: string[];
  send_groups: string[];
  monitor_groups: string[];
  categories: string[];
  texts: string[];
  ctas: string[];
  priority: 'discount' | 'price';
  filter_type: 'light' | 'heavy';
  min_discount: number | null;
  min_price: number | null;
  max_price: number | null;
  interval_minutes: number;
  start_time: string;
  end_time: string;
  last_run_at: string | null;
  next_run_at: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 Iniciando processamento de automações de ofertas...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    // Check if specific automation ID is provided (manual execution)
    const { automationId } = await req.json().catch(() => ({}));

    let automations: Automation[];

    if (automationId) {
      // Manual execution - run specific automation
      console.log(`🎯 Execução manual para automação: ${automationId}`);
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('id', automationId)
        .single();

      if (error || !data) {
        throw new Error(`Automação ${automationId} não encontrada`);
      }

      automations = [data];
    } else {
      // Automatic execution - get active automations that need to run
      const { data, error: autoError } = await supabase
        .from('automations')
        .select('*')
        .eq('status', 'active')
        .lte('start_time', currentTime)
        .gte('end_time', currentTime)
        .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`);

      if (autoError) {
        console.error('❌ Erro ao buscar automações:', autoError);
        throw autoError;
      }

      automations = data || [];
    }

    if (!automations || automations.length === 0) {
      console.log('✅ Nenhuma automação ativa para processar');
      return new Response(
        JSON.stringify({ message: 'Nenhuma automação para processar' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Processando ${automations.length} automação(ões)...`);

    // Process each automation
    for (const automation of automations as Automation[]) {
      try {
        console.log(`⚙️ Processando automação: ${automation.id}`);

        if (automation.mode === 'search') {
          await processSearchMode(supabase, automation);
        } else if (automation.mode === 'monitor') {
          await processMonitorMode(supabase, automation);
        }

        // Update automation run times
        const nextRun = new Date(now.getTime() + automation.interval_minutes * 60000);
        await supabase
          .from('automations')
          .update({
            last_run_at: now.toISOString(),
            next_run_at: nextRun.toISOString(),
            last_error: null,
          })
          .eq('id', automation.id);

        console.log(`✅ Automação ${automation.id} processada com sucesso`);

      } catch (error) {
        console.error(`❌ Erro ao processar automação ${automation.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        
        // Log error to dispatch_logs for visibility
        await supabase.from('dispatch_logs').insert({
          user_id: automation.user_id,
          automation_id: automation.id,
          automation_name: automation.name || 'Automação',
          store: automation.stores[0] || 'shopee',
          group_id: 'system',
          product_url: 'https://error.log',
          status: 'error',
          error: errorMessage,
        });
        
        // Update automation with error
        await supabase
          .from('automations')
          .update({
            last_error: errorMessage,
            last_run_at: now.toISOString(),
          })
          .eq('id', automation.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: automations.length,
        message: `${automations.length} automação(ões) processada(s)` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro no processamento de automações:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processSearchMode(supabase: any, automation: Automation) {
  console.log(`🔍 Modo busca ativado para automação ${automation.id}`);

  // Get user's active credentials for configured stores
  const { data: credentials, error: credError } = await supabase
    .from('affiliate_credentials')
    .select('store, credentials')
    .eq('user_id', automation.user_id)
    .eq('is_active', true)
    .in('store', automation.stores);

  if (credError) {
    console.error('❌ Erro ao buscar credenciais:', credError);
    throw credError;
  }

  if (!credentials || credentials.length === 0) {
    const errorMsg = 'Nenhuma credencial de afiliado ativa encontrada. Configure suas credenciais na página "Programas de Afiliado".';
    console.log('⚠️', errorMsg);
    
    // Log this error
    await supabase.from('dispatch_logs').insert({
      user_id: automation.user_id,
      automation_id: automation.id,
      automation_name: automation.name || 'Automação',
      store: automation.stores[0] || 'shopee',
      group_id: 'system',
      product_url: 'https://error.log',
      status: 'error',
      error: errorMsg,
    });
    
    throw new Error(errorMsg);
  }

  console.log(`✅ Encontradas ${credentials.length} credencial(is) ativa(s)`);

  // For each store with credentials, search for deals
  for (const cred of credentials) {
    try {
      console.log(`🏪 Processando loja: ${cred.store}`);

      // Search for products based on categories
      const deals = await searchDeals(cred.store, cred.credentials, automation);

      if (deals.length > 0) {
        console.log(`💎 Encontradas ${deals.length} ofertas para ${cred.store}`);

        // Send deals to groups
        await sendDealsToGroups(supabase, automation, deals, cred.store);
      } else {
        const msg = `Nenhuma oferta encontrada para ${cred.store} com os filtros configurados`;
        console.log(`📭 ${msg}`);
        
        // Log this as info
        await supabase.from('dispatch_logs').insert({
          user_id: automation.user_id,
          automation_id: automation.id,
          automation_name: automation.name || 'Automação',
          store: cred.store,
          group_id: 'system',
          product_url: 'https://info.log',
          status: 'skipped',
          error: msg,
        });
      }

    } catch (error) {
      console.error(`❌ Erro ao processar loja ${cred.store}:`, error);
      // Continue with next store
    }
  }
}

async function processMonitorMode(supabase: any, automation: Automation) {
  console.log(`👀 Modo monitoramento ativado para automação ${automation.id}`);
  
  // TODO: Implement monitoring mode
  // This will listen to WhatsApp messages in monitor_groups
  // Extract product links and convert to affiliate links
  console.log('⚠️ Modo monitoramento ainda não implementado');
}

async function searchDeals(store: string, credentials: any, automation: Automation) {
  console.log(`🔎 Buscando ofertas em ${store}...`);

  if (store === 'shopee') {
    // Use real Shopee API
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      console.log('📞 Chamando função search-shopee-offers...');
      console.log('Parâmetros:', {
        userId: automation.user_id,
        categories: automation.categories,
        minPrice: automation.min_price,
        maxPrice: automation.max_price,
        minDiscount: automation.min_discount,
        sortBy: automation.priority === 'discount' ? 'commission' : 'price_low',
      });

      const { data, error } = await supabase.functions.invoke('search-shopee-offers', {
        body: {
          userId: automation.user_id,
          searchParams: {
            keyword: automation.categories[0] || '',
            categories: automation.categories,
            minPrice: automation.min_price || undefined,
            maxPrice: automation.max_price || undefined,
            minDiscount: automation.min_discount || undefined,
            sortBy: automation.priority === 'discount' ? 'commission' : 'price_low',
            limit: 20,
          },
        },
      });

      if (error) {
        console.error('❌ Erro ao buscar ofertas Shopee:', error);
        throw new Error(`Erro ao buscar ofertas Shopee: ${error.message || JSON.stringify(error)}`);
      }

      console.log('✅ Resposta da API:', { 
        success: data?.success, 
        total: data?.offers?.length || 0 
      });

      return data?.offers || [];
    } catch (error) {
      console.error('❌ Erro ao chamar API Shopee:', error);
      throw error; // Re-throw to be caught by the main error handler
    }
  }

  // For other stores, return empty for now
  console.log(`⚠️ Loja ${store} ainda não implementada`);
  return [];
}

// Helper to download image and convert to base64
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    console.log('📥 Baixando imagem:', url);
    const response = await fetch(url);
    if (!response.ok) {
      console.error('❌ Erro ao baixar imagem:', response.status);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Check size (max 15MB)
    if (bytes.byteLength > 15 * 1024 * 1024) {
      console.error('❌ Imagem muito grande:', bytes.byteLength);
      return null;
    }
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    console.log('✅ Imagem convertida para base64');
    return base64;
  } catch (error) {
    console.error('❌ Erro ao processar imagem:', error);
    return null;
  }
}

async function sendDealsToGroups(supabase: any, automation: Automation, deals: any[], store: string) {
  console.log(`📤 Enviando ${deals.length} oferta(s) para ${automation.send_groups.length} grupo(s)...`);

  // Validate send_groups
  if (!automation.send_groups || automation.send_groups.length === 0) {
    const errorMsg = 'Nenhum grupo de envio configurado. Configure pelo menos um grupo na automação.';
    console.error('❌', errorMsg);
    await supabase.from('dispatch_logs').insert({
      user_id: automation.user_id,
      automation_id: automation.id,
      automation_name: automation.name || 'Automação',
      store,
      group_id: 'system',
      product_url: 'https://error.log',
      status: 'error',
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }

  const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

  if (!evolutionUrl || !evolutionKey) {
    const errorMsg = 'Evolution API não configurada nos secrets';
    console.error('❌', errorMsg);
    await supabase.from('dispatch_logs').insert({
      user_id: automation.user_id,
      automation_id: automation.id,
      automation_name: automation.name || 'Automação',
      store,
      group_id: 'system',
      product_url: 'https://error.log',
      status: 'error',
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }

  // Get user's instance
  const { data: instance } = await supabase
    .from('instances')
    .select('instance_id')
    .eq('user_id', automation.user_id)
    .eq('status', 'connected')
    .single();

  if (!instance) {
    const errorMsg = 'WhatsApp não está conectado. Conecte seu WhatsApp para enviar ofertas.';
    console.error('❌', errorMsg);
    await supabase.from('dispatch_logs').insert({
      user_id: automation.user_id,
      automation_id: automation.id,
      automation_name: automation.name || 'Automação',
      store,
      group_id: 'system',
      product_url: 'https://error.log',
      status: 'error',
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }

  console.log(`✅ Instância WhatsApp encontrada: ${instance.instance_id}`);

  // Helper function to add delay between messages
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Send each deal to each group
  for (const deal of deals) {
    let affiliateUrl = deal.product_url;
    
    // Always ensure we have a short link format
    // If it's not already a short link, generate one
    if (!affiliateUrl || !affiliateUrl.includes('s.shopee.com.br')) {
      console.log('🔗 Gerando link curto para:', deal.product_url);
      
      const affiliateLinkResponse = await supabase.functions.invoke('generate-shopee-affiliate-link', {
        body: {
          productUrl: deal.product_url || deal.image_url, // Fallback to any available URL
          userId: automation.user_id,
        },
      });

      if (affiliateLinkResponse.data?.affiliateUrl) {
        affiliateUrl = affiliateLinkResponse.data.affiliateUrl;
        console.log('✅ Link curto gerado:', affiliateUrl);
      } else {
        console.error('❌ Falha ao gerar link curto, pulando oferta');
        continue; // Skip this offer if we can't generate a short link
      }
    } else {
      console.log('✅ Usando link curto da API:', affiliateUrl);
    }

    // Use product image from store
    const imageUrl = deal.image_url;
    console.log('🖼️ Usando imagem do produto:', imageUrl);

    // Select random message and CTA
    const messageTemplate = automation.texts[Math.floor(Math.random() * automation.texts.length)];
    const cta = automation.ctas && automation.ctas.length > 0 
      ? automation.ctas[Math.floor(Math.random() * automation.ctas.length)]
      : '🛒 Compre aqui:';

    // Format message following the user's pattern
    const formattedMessage = `NADA MELHOR QUE COMPRAR E ECONOMIZAR 🤑🛍️

> CORRE QUE VAI ESGOTAR

📦 ${deal.title}

${deal.discount ? `💥 ${deal.discount}% OFF` : ''}
🔥 Por: R$ ${deal.price.toFixed(2)} 🤑

${cta} ${affiliateUrl}

⚠️ O preço e disponibilidade do produto podem variar. As promoções são por tempo limitado`;

    console.log(`📝 Mensagem formatada para ${deal.title}`);

    // Send to all groups
    for (const groupId of automation.send_groups) {
      try {
        console.log(`📨 Enviando para grupo ${groupId}...`);

        // Encode instance name for URL (important for special characters)
        const encodedInstanceId = encodeURIComponent(instance.instance_id);

        let response;
        let responseData;

        // TEMPORARY: Sending text only (image disabled for testing)
        console.log('📝 Enviando apenas texto (imagem desabilitada temporariamente)');
        response = await fetch(
          `${evolutionUrl}/message/sendText/${encodedInstanceId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionKey,
            },
            body: JSON.stringify({
              number: groupId,
              text: formattedMessage,
            }),
          }
        );

        // Check if request was successful
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Evolution API retornou erro ${response.status}:`, errorText);
          throw new Error(`Evolution API retornou ${response.status}: ${errorText}`);
        }

        // Parse response
        responseData = await response.json();
        console.log('📥 Resposta da Evolution API:', JSON.stringify(responseData));

        // Check if Evolution API reported an error in the response
        if (responseData.error || !responseData.key) {
          const errorMsg = responseData.error || 'Resposta inválida da Evolution API';
          console.error(`❌ Erro na resposta da Evolution:`, errorMsg);
          throw new Error(errorMsg);
        }

        // Log successful dispatch ONLY if everything worked
        await supabase.from('dispatch_logs').insert({
          user_id: automation.user_id,
          automation_id: automation.id,
          automation_name: 'Automação',
          store,
          group_id: groupId,
          product_url: deal.product_url,
          affiliate_url: affiliateUrl,
          status: 'sent',
        });

        console.log(`✅ Mensagem enviada com sucesso para ${groupId} (key: ${responseData.key?.id || 'N/A'})`);

        // Add 3 second delay between messages to avoid flood
        console.log('⏳ Aguardando 3 segundos antes da próxima mensagem...');
        await delay(3000);

      } catch (error) {
        console.error(`❌ Erro ao enviar para grupo ${groupId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

        // Log failed dispatch
        await supabase.from('dispatch_logs').insert({
          user_id: automation.user_id,
          automation_id: automation.id,
          automation_name: 'Automação',
          store,
          group_id: groupId,
          product_url: deal.product_url,
          affiliate_url: affiliateUrl,
          status: 'error',
          error: errorMessage,
        });
      }
    }
  }
}
