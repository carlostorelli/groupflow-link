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

      // 🔒 STEP 1: Check if already locked by another worker
      const { data: currentLock } = await supabase
        .from('automation_runs')
        .select('lock_until, last_sent_at')
        .eq('automation_id', automation.id)
        .maybeSingle();

      // Check if locked by another worker (lock still valid)
      if (currentLock?.lock_until && new Date(currentLock.lock_until) > now) {
        const timeLeft = Math.ceil((new Date(currentLock.lock_until).getTime() - now.getTime()) / 1000);
        console.log(`🔒 Automação ${automation.id} já está travada (expira em ${timeLeft}s)`);
        continue; // Skip this automation
      }

      // 🔒 STEP 2: Check interval (only for automatic execution, not manual)
      if (!automationId) { // Only check interval for automatic execution
        const intervalMs = automation.interval_minutes * 60 * 1000;
        if (currentLock?.last_sent_at) {
          const lastSent = new Date(currentLock.last_sent_at);
          const timeSinceLastSent = now.getTime() - lastSent.getTime();
          
          if (timeSinceLastSent < intervalMs) {
            const waitMinutes = Math.ceil((intervalMs - timeSinceLastSent) / 60000);
            console.log(`⏰ Automação ${automation.id} executada há ${Math.ceil(timeSinceLastSent/1000/60)}min, aguardando mais ${waitMinutes}min`);
            continue;
          }
        }
      }

      // 🔒 STEP 3: Acquire lock NOW
      const lockDuration = 90000; // 90 seconds
      const lockUntil = new Date(now.getTime() + lockDuration);

      await supabase
        .from('automation_runs')
        .upsert({
          automation_id: automation.id,
          lock_until: lockUntil.toISOString(),
        }, {
          onConflict: 'automation_id'
        });

      console.log(`✅ Lock adquirido, processando...`);

      if (automation.mode === 'search') {
        await processSearchMode(supabase, automation);
      } else if (automation.mode === 'monitor') {
        await processMonitorMode(supabase, automation);
      }

      // Update automation run times and release lock
      const nextRun = new Date(now.getTime() + automation.interval_minutes * 60000);
      await supabase
        .from('automations')
        .update({
          last_run_at: now.toISOString(),
          next_run_at: nextRun.toISOString(),
          last_error: null,
        })
        .eq('id', automation.id);

      // Update automation_runs to mark successful execution
      await supabase
        .from('automation_runs')
        .update({
          last_sent_at: now.toISOString(),
          next_run_at: nextRun.toISOString(),
          lock_until: new Date(now.getTime() - 1000).toISOString(),
        })
        .eq('automation_id', automation.id);

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
      
      // Update automation with error and release lock
      await supabase
        .from('automations')
        .update({
          last_error: errorMessage,
          last_run_at: now.toISOString(),
        })
        .eq('id', automation.id);

      // Release lock on error
      await supabase
        .from('automation_runs')
        .update({ lock_until: new Date(now.getTime() - 1000).toISOString() })
        .eq('automation_id', automation.id);
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
      
      // Log full stack trace
      if (error instanceof Error) {
        console.error('📛 Error stack:', error.stack);
      }
      
      // Extract error details
      const errorType = (error as any).type || 'UNKNOWN_ERROR';
      const status = (error as any).status;
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Create detailed error log
      const detailedErrorMsg = `Erro na busca da loja ${cred.store}: ${errorMessage}`;
      
      // Log error to dispatch_logs with classification
      await supabase.from('dispatch_logs').insert({
        user_id: automation.user_id,
        automation_id: automation.id,
        automation_name: automation.name || 'Automação',
        store: cred.store,
        group_id: 'system',
        product_url: 'https://search-error.log',
        status: 'error',
        error: detailedErrorMsg,
      });

      console.error('📊 Erro classificado:', {
        store: cred.store,
        errorType,
        statusCode: status,
        message: errorMessage.substring(0, 200),
        fullError: JSON.stringify((error as any).originalError || error, Object.getOwnPropertyNames(error), 2),
      });
      
      // Continue with next store (don't block entire automation)
    }
  }
}

async function processMonitorMode(supabase: any, automation: Automation) {
  console.log(`👀 Modo monitoramento ativado para automação ${automation.id}`);
  
  // Validate monitor_groups
  if (!automation.monitor_groups || automation.monitor_groups.length === 0) {
    const errorMsg = 'Nenhum grupo de monitoramento configurado';
    console.error('❌', errorMsg);
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

  // Validate send_groups
  if (!automation.send_groups || automation.send_groups.length === 0) {
    const errorMsg = 'Nenhum grupo de envio configurado';
    console.error('❌', errorMsg);
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

  const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

  if (!evolutionUrl || !evolutionKey) {
    const errorMsg = 'Evolution API não configurada nos secrets';
    console.error('❌', errorMsg);
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
    const errorMsg = 'WhatsApp não está conectado';
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
  }

  console.log(`✅ Instância WhatsApp encontrada: ${instance.instance_id}`);

  // Get messages from monitored groups (last 24 hours)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  // Get already processed links to avoid duplicates
  const { data: recentlySent } = await supabase
    .from('dispatch_logs')
    .select('product_url')
    .eq('automation_id', automation.id)
    .eq('status', 'sent')
    .gte('created_at', yesterday.toISOString());

  const sentUrls = new Set(recentlySent?.map((log: any) => log.product_url) || []);
  console.log(`📋 ${sentUrls.size} link(s) já processado(s) nas últimas 24h`);

  // Monitor each group
  for (const groupId of automation.monitor_groups) {
    try {
      console.log(`👁️ Monitorando grupo: ${groupId}`);
      
      // Fetch recent messages from the group
      const encodedInstanceId = encodeURIComponent(instance.instance_id);
      
      // Try to get owner JID from instance info
      let ownerJid = null;
      try {
        const instanceInfoResponse = await fetch(
          `${evolutionUrl}/instance/fetchInstances?instanceName=${encodedInstanceId}`,
          {
            headers: { 'apikey': evolutionKey },
          }
        );

        if (instanceInfoResponse.ok) {
          const instances = await instanceInfoResponse.json();
          console.log(`📱 Instâncias encontradas:`, JSON.stringify(instances, null, 2));
          
          // Try to extract owner from different possible structures
          const instanceData = Array.isArray(instances) ? instances[0] : instances;
          ownerJid = instanceData?.owner || 
                     instanceData?.instance?.owner || 
                     instanceData?.wuid ||
                     instanceData?.instance?.wuid;
          
          if (ownerJid) {
            console.log(`👤 Owner JID encontrado: ${ownerJid}`);
          } else {
            console.warn(`⚠️ Owner JID não encontrado. Processando todas as mensagens (sem filtro de owner).`);
          }
        }
      } catch (e) {
        const error = e as Error;
        console.warn(`⚠️ Erro ao buscar owner JID: ${error.message}. Processando todas as mensagens.`);
      }
      
      // Validate group JID format
      if (!groupId.includes('@g.us')) {
        console.error(`❌ JID inválido: ${groupId} (deve terminar com @g.us)`);
        await supabase.from('dispatch_logs').insert({
          user_id: automation.user_id,
          automation_id: automation.id,
          automation_name: automation.name || 'Automação',
          store: automation.stores[0] || 'shopee',
          group_id: groupId,
          product_url: 'https://error.log',
          status: 'error',
          error: `JID inválido: ${groupId}. Sincronize novamente os grupos.`,
        });
        continue;
      }

      console.log(`🔍 Buscando mensagens com JID validado: ${groupId}`);

      // Use the correct Evolution API endpoint for fetching messages
      const messagesResponse = await fetch(
        `${evolutionUrl}/chat/findMessages/${encodedInstanceId}`,
        {
          method: 'POST',
          headers: {
            'apikey': evolutionKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            where: {
              key: {
                remoteJid: groupId
              }
            },
            limit: 100
          })
        }
      );

      console.log(`📡 Status da busca de mensagens: ${messagesResponse.status}`);

      if (!messagesResponse.ok) {
        const errorText = await messagesResponse.text();
        console.error(`❌ Erro ao buscar mensagens do grupo ${groupId}: ${messagesResponse.status} - ${errorText}`);
        await supabase.from('dispatch_logs').insert({
          user_id: automation.user_id,
          automation_id: automation.id,
          automation_name: automation.name || 'Automação',
          store: automation.stores[0] || 'shopee',
          group_id: groupId,
          product_url: 'https://error.log',
          status: 'error',
          error: `Falha ao buscar mensagens: HTTP ${messagesResponse.status}`,
        });
        continue;
      }

      const messagesData = await messagesResponse.json();
      console.log(`📦 Tipo de resposta:`, typeof messagesData, Array.isArray(messagesData) ? 'Array' : 'Object');
      
      // Evolution API returns data in different formats
      const messages = Array.isArray(messagesData) 
        ? messagesData 
        : (messagesData.data || messagesData.messages || []);
      
      console.log(`📨 Encontradas ${messages.length || 0} mensagens no grupo`);
      
      if (messages.length > 0) {
        console.log(`📋 Exemplo de mensagem (estrutura):`, JSON.stringify(messages[0], null, 2).substring(0, 500));
      }
      
      if (messages.length === 0) {
        console.warn(`⚠️ Nenhuma mensagem encontrada no grupo ${groupId}. Isso pode significar:`);
        console.warn(`   - O grupo está vazio ou sem mensagens recentes`);
        console.warn(`   - O JID do grupo está incorreto`);
        console.warn(`   - A instância não tem permissão para ler mensagens deste grupo`);
      }

      // Process messages
      if (messages && Array.isArray(messages)) {
        console.log(`📝 Processando ${messages.length} mensagens...`);
        
        // Log sample messages for debugging
        if (messages.length > 0) {
          console.log(`📋 Exemplo de mensagens:`, 
            messages.slice(0, 3).map((m: any) => ({
              from: m.key?.participant || m.key?.remoteJid || m.sender,
              text: (m.message?.conversation || 
                     m.message?.extendedTextMessage?.text || 
                     m.body || 
                     'sem texto').substring(0, 100),
              timestamp: m.messageTimestamp || m.timestamp
            }))
          );
        }
        
        for (const msg of messages) {
          try {
            // Ignore messages from self
            if (ownerJid && msg.key?.participant === ownerJid) {
              console.log(`⏭️ Ignorando mensagem do owner: ${ownerJid}`);
              continue;
            }
            if (ownerJid && msg.key?.fromMe) {
              console.log(`⏭️ Ignorando mensagem "fromMe"`);
              continue;
            }

            // Extract text from different message structures
            const text = msg.message?.conversation || 
                        msg.message?.extendedTextMessage?.text ||
                        msg.message?.imageMessage?.caption ||
                        msg.message?.videoMessage?.caption ||
                        msg.body || 
                        '';
            
            if (!text || text.trim() === '') {
              continue;
            }
            
            console.log(`📝 Texto da mensagem: ${text.substring(0, 100)}...`);

            // Extract product links (Shopee, Amazon, Magalu, ML, etc.)
            const productLinks = extractProductLinks(text);
            
            if (productLinks.length === 0) {
              console.log(`⏭️ Nenhum link de produto encontrado nesta mensagem`);
              continue;
            }

            // Take only the first link
            const productLink = productLinks[0];
            console.log(`🔗 Link encontrado: ${productLink}`);

            // Skip if already processed
            if (sentUrls.has(productLink)) {
              console.log(`⏭️ Link já processado: ${productLink}`);
              continue;
            }

            // Detect store and convert to affiliate link
            const store = detectStore(productLink);
            if (!store) {
              console.log(`⚠️ Loja não detectada para: ${productLink}`);
              continue;
            }

            console.log(`🏪 Loja detectada: ${store}`);

            // Get user's credentials for this store
            const { data: credential } = await supabase
              .from('affiliate_credentials')
              .select('*')
              .eq('user_id', automation.user_id)
              .eq('store', store)
              .eq('is_active', true)
              .maybeSingle();

            if (!credential) {
              console.log(`⚠️ Credencial não configurada para ${store}`);
              continue;
            }

            // Generate affiliate link
            let affiliateUrl = productLink;
            
            if (store === 'shopee') {
              try {
                console.log(`🔗 Gerando link de afiliado para: ${productLink}`);
                const affiliateLinkResponse = await supabase.functions.invoke('generate-shopee-affiliate-link', {
                  body: {
                    productUrl: productLink,
                    userId: automation.user_id,
                  },
                });

                if (affiliateLinkResponse.error) {
                  console.error('❌ Erro ao invocar função de afiliado:', affiliateLinkResponse.error);
                  await supabase.from('dispatch_logs').insert({
                    user_id: automation.user_id,
                    automation_id: automation.id,
                    automation_name: automation.name || 'Automação',
                    store,
                    group_id: groupId,
                    product_url: productLink,
                    status: 'error',
                    error: `Falha ao gerar link de afiliado: ${affiliateLinkResponse.error.message}`,
                  });
                  continue;
                }

                if (affiliateLinkResponse.data?.affiliateUrl) {
                  affiliateUrl = affiliateLinkResponse.data.affiliateUrl;
                  console.log('✅ Link de afiliado gerado:', affiliateUrl);
                } else {
                  console.error('❌ Resposta sem URL de afiliado:', affiliateLinkResponse.data);
                  continue;
                }
              } catch (error) {
                console.error('❌ Exceção ao gerar link de afiliado:', error);
                await supabase.from('dispatch_logs').insert({
                  user_id: automation.user_id,
                  automation_id: automation.id,
                  automation_name: automation.name || 'Automação',
                  store,
                  group_id: groupId,
                  product_url: productLink,
                  status: 'error',
                  error: `Erro ao gerar link: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
                });
                continue;
              }
            }

            // Create message with affiliate link
            const messageTemplate = automation.texts[Math.floor(Math.random() * automation.texts.length)] || 
                                   '🔥 Oferta encontrada!';
            const cta = automation.ctas && automation.ctas.length > 0 
              ? automation.ctas[Math.floor(Math.random() * automation.ctas.length)]
              : '🛒 Compre aqui:';

            const formattedMessage = `${messageTemplate}

${cta} ${affiliateUrl}`;

            // Send to all configured groups
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            
            for (const targetGroupId of automation.send_groups) {
              try {
                // Validate target group JID
                if (!targetGroupId.includes('@g.us')) {
                  console.error(`❌ JID de destino inválido: ${targetGroupId}`);
                  throw new Error(`JID inválido: ${targetGroupId}. Sincronize novamente os grupos.`);
                }

                console.log(`📨 [MONITOR] Enviando para grupo ${targetGroupId}...`);
                console.log(`📝 Mensagem: ${formattedMessage.substring(0, 100)}...`);

                const sendPayload = {
                  number: targetGroupId,
                  text: formattedMessage,
                };

                try {
                  const sendResponse = await fetch(
                    `${evolutionUrl}/message/sendText/${encodedInstanceId}`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'apikey': evolutionKey,
                      },
                      body: JSON.stringify(sendPayload),
                    }
                  );

                  console.log(`📡 Status do envio: ${sendResponse.status}`);

                  if (!sendResponse.ok) {
                    const errorText = await sendResponse.text();
                    console.error(`❌ Erro ao enviar mensagem: ${sendResponse.status} - ${errorText}`);
                    
                    await supabase.from('dispatch_logs').insert({
                      user_id: automation.user_id,
                      automation_id: automation.id,
                      automation_name: automation.name || 'Automação',
                      store,
                      group_id: targetGroupId,
                      product_url: productLink,
                      affiliate_url: affiliateUrl,
                      status: 'error',
                      error: `Falha no envio: HTTP ${sendResponse.status}`,
                    });
                    continue;
                  }

                  const sendResult = await sendResponse.json();
                  console.log(`✅ [MONITOR] Mensagem enviada com sucesso:`, sendResult.key || sendResult);

                  // Log success
                  await supabase.from('dispatch_logs').insert({
                    user_id: automation.user_id,
                    automation_id: automation.id,
                    automation_name: automation.name || 'Automação',
                    store,
                    group_id: targetGroupId,
                    product_url: productLink,
                    affiliate_url: affiliateUrl,
                    status: 'sent',
                  });

                  // Mark as processed
                  sentUrls.add(productLink);

                  // Anti-flood: wait 3 seconds between sends
                  await delay(3000);
                } catch (sendError) {
                  console.error(`❌ Exceção ao enviar mensagem:`, sendError);
                  await supabase.from('dispatch_logs').insert({
                    user_id: automation.user_id,
                    automation_id: automation.id,
                    automation_name: automation.name || 'Automação',
                    store,
                    group_id: targetGroupId,
                    product_url: productLink,
                    affiliate_url: affiliateUrl,
                    status: 'error',
                    error: `Erro ao enviar: ${sendError instanceof Error ? sendError.message : 'Erro desconhecido'}`,
                  });
                }
              } catch (error) {
                console.error(`❌ Erro ao processar grupo de envio ${targetGroupId}:`, error);
                await supabase.from('dispatch_logs').insert({
                  user_id: automation.user_id,
                  automation_id: automation.id,
                  automation_name: automation.name || 'Automação',
                  store,
                  group_id: targetGroupId,
                  product_url: productLink,
                  affiliate_url: affiliateUrl,
                  status: 'error',
                  error: `Erro no envio para grupo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
                });
              }
            }

            // Break after first product found (avoid sending too many)
            console.log(`✅ [MONITOR] Link processado com sucesso, parando monitoramento deste grupo`);
            break;
          } catch (error) {
            console.error(`❌ Erro ao processar mensagem:`, error);
            // Continue to next message
          }
        }
      }

    } catch (error) {
      console.error(`❌ Erro crítico ao monitorar grupo ${groupId}:`, error);
      await supabase.from('dispatch_logs').insert({
        user_id: automation.user_id,
        automation_id: automation.id,
        automation_name: automation.name || 'Automação',
        store: automation.stores[0] || 'shopee',
        group_id: groupId,
        product_url: 'https://error.log',
        status: 'error',
        error: `Erro no monitoramento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      });
    }
  }

  console.log(`✅ [MONITOR] Monitoramento concluído para todos os grupos`);
}

function extractProductLinks(text: string): string[] {
  const links: string[] = [];
  
  // Regex patterns for different stores
  const patterns = [
    // Shopee
    /https?:\/\/(www\.)?(shopee\.com\.br|s\.shopee\.com\.br)\/[^\s]+/gi,
    // Amazon
    /https?:\/\/(www\.)?(amazon\.com\.br|amzn\.to)\/[^\s]+/gi,
    // Magazine Luiza
    /https?:\/\/(www\.)?(magazineluiza\.com\.br|magalu\.com\.br)\/[^\s]+/gi,
    // Mercado Livre
    /https?:\/\/(www\.)?(mercadolivre\.com\.br|produto\.mercadolivre\.com\.br)\/[^\s]+/gi,
    // Shein
    /https?:\/\/(www\.)?shein\.com\.br\/[^\s]+/gi,
    // AliExpress
    /https?:\/\/(www\.)?(aliexpress\.com|pt\.aliexpress\.com)\/[^\s]+/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      links.push(...matches);
    }
  }

  // Filter out coupon/category links (must contain product identifier)
  const productLinks = links.filter(link => {
    const lower = link.toLowerCase();
    // Skip cupom/voucher/category pages
    if (lower.includes('cupom') || lower.includes('voucher') || 
        lower.includes('/categoria') || lower.includes('/category') ||
        lower.includes('/collection')) {
      return false;
    }
    // Must contain typical product identifiers
    return lower.includes('/product') || lower.includes('/-i.') || 
           lower.includes('/dp/') || lower.includes('/p/') ||
           lower.includes('/item/') || lower.includes('/MLB-');
  });

  return productLinks;
}

function detectStore(url: string): string | null {
  const lower = url.toLowerCase();
  
  if (lower.includes('shopee.com.br') || lower.includes('s.shopee.com.br')) {
    return 'shopee';
  }
  if (lower.includes('amazon.com.br') || lower.includes('amzn.to')) {
    return 'amazon';
  }
  if (lower.includes('magazineluiza.com.br') || lower.includes('magalu.com.br')) {
    return 'magalu';
  }
  if (lower.includes('mercadolivre.com.br')) {
    return 'ml';
  }
  if (lower.includes('shein.com.br')) {
    return 'shein';
  }
  if (lower.includes('aliexpress.com')) {
    return 'aliexpress';
  }
  
  return null;
}

async function searchDeals(store: string, credentials: any, automation: Automation) {
  console.log(`🔎 Buscando ofertas em ${store}...`);

  if (store === 'shopee') {
    // Use real Shopee API
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestBody = {
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
    };

    console.log('📞 Chamando função search-shopee-offers...');
    console.log('📋 Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('⏰ Timestamp:', new Date().toISOString());

    try {
      const { data, error } = await supabase.functions.invoke('search-shopee-offers', {
        body: requestBody,
      });

      // Log response details
      console.log('📡 Resposta recebida da API Shopee');
      console.log('📊 Response Data:', JSON.stringify({
        success: data?.success,
        offersCount: data?.offers?.length || 0,
        hasError: !!error,
        errorName: error?.name,
        errorMessage: error?.message,
      }, null, 2));

      if (error) {
        // Log full error object for debugging
        console.error('🚨 [FULL ERROR OBJECT]:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        
        // Detailed error classification
        let errorType = 'UNKNOWN_ERROR';
        let errorDetail = '';
        let statusCode: number | undefined;

        // Check if it's a FunctionsHttpError (non-2xx response)
        if (error.name === 'FunctionsHttpError' && error.context) {
          statusCode = error.context.status;
          const status = statusCode || 500; // Fallback to 500 if undefined
          errorType = status >= 500 ? 'STORE_API_ERROR' : 
                      status === 401 || status === 403 ? 'AUTH_ERROR' : 
                      status === 400 ? 'MALFORMED_REQUEST' : 'STORE_API_ERROR';
          
          console.error('🚨 Erro HTTP da API de busca:', {
            errorType,
            status: error.context.status,
            statusText: error.context.statusText,
            url: error.context.url,
          });

          // Try to get response body
          try {
            const errorBody = await error.context.json();
            console.error('📄 Response Body (JSON):', JSON.stringify(errorBody, null, 2));
            errorDetail = `HTTP ${status}: ${JSON.stringify(errorBody)}`;
          } catch (e) {
            try {
              const errorText = await error.context.text();
              console.error('📄 Response Body (Text):', errorText);
              errorDetail = `HTTP ${status}: ${errorText.substring(0, 500)}`;
            } catch (e2) {
              errorDetail = `HTTP ${status}: ${error.context.statusText}`;
            }
          }
        } else {
          // Other types of errors (network, timeout, etc.)
          errorType = 'NETWORK_ERROR';
          errorDetail = error.message || JSON.stringify(error);
          console.error('🚨 Erro de rede/sistema:', {
            errorType,
            name: error.name,
            message: error.message,
            stack: error.stack,
          });
        }

        // Throw detailed error
        const detailedError = new Error(`[${errorType}] ${errorDetail}`);
        (detailedError as any).type = errorType;
        (detailedError as any).status = statusCode;
        (detailedError as any).originalError = error;
        throw detailedError;
      }

      // Validate response structure
      if (!data || !data.offers) {
        console.warn('⚠️ Resposta da API não contém ofertas válidas');
        return [];
      }

      console.log(`✅ ${data.offers.length} oferta(s) encontrada(s)`);
      return data.offers;

    } catch (error) {
      console.error('❌ Exceção ao chamar API Shopee:', error);
      
      // Re-throw with context preserved
      if ((error as any).type) {
        // Already a detailed error from above
        throw error;
      }
      
      // Wrap unexpected errors
      const wrappedError = new Error(`SEARCH_EXCEPTION: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      (wrappedError as any).type = 'SEARCH_EXCEPTION';
      (wrappedError as any).originalError = error;
      throw wrappedError;
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
  console.log(`📤 Processando ${deals.length} oferta(s)...`);

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

  // 🔥 ANTI-FLOOD: Get products already sent in last 24h
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { data: recentlySent } = await supabase
    .from('dispatch_logs')
    .select('product_url')
    .eq('automation_id', automation.id)
    .eq('status', 'sent')
    .gte('created_at', yesterday.toISOString());

  const sentUrls = new Set(recentlySent?.map((log: any) => log.product_url) || []);
  console.log(`📋 ${sentUrls.size} produto(s) já enviado(s) nas últimas 24h`);

  // Find first non-duplicate deal
  const nextDeal = deals.find(d => !sentUrls.has(d.product_url));

  if (!nextDeal) {
    console.log('✅ Todos os produtos já foram enviados recentemente (deduplicação 24h)');
    await supabase.from('dispatch_logs').insert({
      user_id: automation.user_id,
      automation_id: automation.id,
      automation_name: automation.name || 'Automação',
      store,
      group_id: 'system',
      product_url: 'https://info.log',
      status: 'skipped',
      error: 'Nenhum produto novo encontrado (deduplicação 24h)',
    });
    return;
  }

  console.log(`🎯 Enviando APENAS 1 produto: ${nextDeal.title}`);
  const deal = nextDeal;
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
      console.error('❌ Falha ao gerar link curto, abortando envio');
      await supabase.from('dispatch_logs').insert({
        user_id: automation.user_id,
        automation_id: automation.id,
        automation_name: automation.name || 'Automação',
        store,
        group_id: 'system',
        product_url: deal.product_url,
        status: 'error',
        error: 'Falha ao gerar link de afiliado',
      });
      return;
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

  // Format message using the custom text template
  const formattedMessage = `${messageTemplate}

📦 ${deal.title}

${deal.discount ? `💥 ${deal.discount}% OFF` : ''}
🔥 Por: R$ ${deal.price.toFixed(2)} 🤑

${cta} ${affiliateUrl}

⚠️ O preço e disponibilidade do produto podem variar. As promoções são por tempo limitado`;

  console.log(`📝 Mensagem formatada para ${deal.title}`);

  // Helper function to add delay between messages
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Send to all groups (3 second delay between each group)
  for (const groupId of automation.send_groups) {
    try {
      console.log(`📨 Enviando para grupo ${groupId}...`);

      // Encode instance name for URL (important for special characters)
      const encodedInstanceId = encodeURIComponent(instance.instance_id);

      let response;
      let responseData;

      // Validate group JID
      if (!groupId.includes('@g.us')) {
        console.error(`❌ JID inválido: ${groupId} (deve terminar com @g.us)`);
        await supabase.from('dispatch_logs').insert({
          user_id: automation.user_id,
          automation_id: automation.id,
          automation_name: automation.name || 'Automação',
          store,
          group_id: groupId,
          product_url: deal.product_url,
          status: 'error',
          error: `JID inválido: ${groupId}. Sincronize novamente os grupos na tela de Grupos.`,
        });
        continue;
      }

      // TEMPORARY: Sending text only (image disabled for testing)
      console.log('📝 Enviando apenas texto (imagem desabilitada temporariamente)');
      console.log(`🎯 Grupo destino (JID validado): ${groupId}`);
      
      const sendPayload = {
        number: groupId,
        text: formattedMessage,
      };
      console.log(`📦 Payload:`, JSON.stringify(sendPayload, null, 2));

      response = await fetch(
        `${evolutionUrl}/message/sendText/${encodedInstanceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionKey,
          },
          body: JSON.stringify(sendPayload),
        }
      );

      console.log(`📡 Status do envio: ${response.status} ${response.statusText}`);

      // Check if request was successful
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Evolution API retornou erro ${response.status}:`, errorText);
        throw new Error(`Evolution API retornou ${response.status}: ${errorText}`);
      }

      // Get response text first
      const responseText = await response.text();
      console.log(`📄 Resposta bruta: ${responseText}`);

      // Parse response
      try {
        responseData = JSON.parse(responseText);
        console.log('📥 Resposta parseada:', JSON.stringify(responseData, null, 2));
      } catch (e) {
        console.error(`❌ Erro ao parsear JSON:`, e);
        throw new Error(`Resposta JSON inválida: ${responseText}`);
      }

      // Check if Evolution API reported an error in the response
      if (responseData.error) {
        const errorMsg = responseData.error;
        console.error(`❌ Erro na resposta da Evolution:`, errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!responseData.key && !responseData.message) {
        console.error(`❌ Resposta sem key/message:`, responseData);
        throw new Error(`Resposta sem confirmação de envio: ${JSON.stringify(responseData)}`);
      }

      // Log successful dispatch ONLY if everything worked
      await supabase.from('dispatch_logs').insert({
        user_id: automation.user_id,
        automation_id: automation.id,
        automation_name: automation.name || 'Automação',
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
        automation_name: automation.name || 'Automação',
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
