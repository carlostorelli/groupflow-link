import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Automation {
  id: string;
  user_id: string;
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
    console.log('⚠️ Nenhuma credencial ativa encontrada');
    return;
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
        console.log(`📭 Nenhuma oferta encontrada para ${cred.store}`);
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
        return [];
      }

      return data?.offers || [];
    } catch (error) {
      console.error('❌ Erro ao chamar API Shopee:', error);
      return [];
    }
  }

  // For other stores, return empty for now
  console.log(`⚠️ Loja ${store} ainda não implementada`);
  return [];
}

async function sendDealsToGroups(supabase: any, automation: Automation, deals: any[], store: string) {
  console.log(`📤 Enviando ${deals.length} oferta(s) para ${automation.send_groups.length} grupo(s)...`);

  const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

  if (!evolutionUrl || !evolutionKey) {
    console.error('❌ Evolution API não configurada');
    return;
  }

  // Get user's instance
  const { data: instance } = await supabase
    .from('instances')
    .select('instance_id')
    .eq('user_id', automation.user_id)
    .eq('status', 'connected')
    .single();

  if (!instance) {
    console.log('⚠️ Nenhuma instância conectada');
    return;
  }

  // Send each deal to each group
  for (const deal of deals) {
    // Generate affiliate link
    const affiliateLinkResponse = await supabase.functions.invoke('generate-shopee-affiliate-link', {
      body: {
        productUrl: deal.product_url,
        userId: automation.user_id,
      },
    });

    const affiliateUrl = affiliateLinkResponse.data?.affiliateUrl || deal.product_url;

    // Use product image from store
    const imageUrl = deal.image_url;
    console.log('🖼️ Usando imagem do produto:', imageUrl);

    // Select random message and CTA
    const messageTemplate = automation.texts[Math.floor(Math.random() * automation.texts.length)];
    const cta = automation.ctas[Math.floor(Math.random() * automation.ctas.length)] || '🛒 Compre aqui:';

    // Format message following the user's pattern
    const formattedMessage = `NADA MELHOR QUE COMPRAR E ECONOMIZAR 🤑🛍️

> CORRE QUE VAI ESGOTAR

📦 ${deal.title}

${deal.old_price ? `🪓 De: R$ ${deal.old_price.toFixed(2)}` : ''}
🔥 Por: R$ ${deal.price.toFixed(2)} 🤑

${cta} ${affiliateUrl}

O preço e disponibilidade do produto podem variar. As promoções são por tempo limitado`;

    // Send to all groups
    for (const groupId of automation.send_groups) {
      try {
        console.log(`📨 Enviando para grupo ${groupId}...`);

        // Send image first if available
        if (imageUrl) {
          await fetch(
            `${evolutionUrl}/message/sendMedia/${instance.instance_id}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionKey,
              },
              body: JSON.stringify({
                number: groupId,
                mediatype: 'image',
                media: imageUrl,
                caption: formattedMessage,
              }),
            }
          );
        } else {
          // Send text only if no image
          await fetch(
            `${evolutionUrl}/message/sendText/${instance.instance_id}`,
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
        }

        // Log successful dispatch
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

        console.log(`✅ Enviado com sucesso para ${groupId}`);

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
