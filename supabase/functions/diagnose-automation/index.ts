import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiagnosticStep {
  step: string;
  code: string;
  ok: boolean;
  detail: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { automationId } = await req.json();

    if (!automationId) {
      return new Response(
        JSON.stringify({ error: 'automationId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Iniciando diagnóstico da automação:', automationId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const steps: DiagnosticStep[] = [];
    let finalCode = 'SENT_OK';
    let finalMsg = 'Diagnóstico concluído com sucesso';

    // Get automation
    const { data: automation, error: autoError } = await supabase
      .from('automations')
      .select('*')
      .eq('id', automationId)
      .single();

    if (autoError || !automation) {
      return new Response(
        JSON.stringify({ error: 'Automação não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 1: WhatsApp Status
    console.log('📋 Step 1: Verificando status do WhatsApp...');
    try {
      const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

      if (!evolutionUrl || !evolutionKey) {
        steps.push({
          step: 'WA_STATUS',
          code: 'WA_API_NOT_CONFIGURED',
          ok: false,
          detail: 'Evolution API não configurada'
        });
        finalCode = 'WA_API_NOT_CONFIGURED';
        finalMsg = 'Evolution API não configurada';
        throw new Error('Stop');
      }

      const { data: instance } = await supabase
        .from('instances')
        .select('instance_id, status')
        .eq('user_id', automation.user_id)
        .maybeSingle();

      if (!instance || instance.status !== 'connected') {
        steps.push({
          step: 'WA_STATUS',
          code: 'WA_CLOSED',
          ok: false,
          detail: instance ? `Status: ${instance.status}` : 'Instância não encontrada'
        });
        finalCode = 'WA_CLOSED';
        finalMsg = 'WhatsApp não está conectado';
        throw new Error('Stop');
      }

      steps.push({
        step: 'WA_STATUS',
        code: 'WA_OK',
        ok: true,
        detail: 'WhatsApp conectado'
      });
    } catch (error) {
      if (error instanceof Error && error.message !== 'Stop') throw error;
      
      await supabase.from('dispatch_logs').insert({
        user_id: automation.user_id,
        automation_id: automationId,
        automation_name: automation.name,
        store: 'system',
        group_id: 'diagnostic',
        product_url: 'https://diagnostic.log',
        status: 'error',
        error: `${finalCode}: ${finalMsg}`
      });

      return new Response(
        JSON.stringify({ code: finalCode, message: finalMsg, steps }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 2: Grupos de Envio
    console.log('📋 Step 2: Verificando grupos de envio...');
    if (!automation.send_groups || automation.send_groups.length === 0) {
      steps.push({
        step: 'GRUPOS_ENVIO',
        code: 'SEM_GRUPOS',
        ok: false,
        detail: 'Nenhum grupo selecionado para envio'
      });
      finalCode = 'SEM_GRUPOS';
      finalMsg = 'Configure pelo menos um grupo para envio';
      
      await supabase.from('dispatch_logs').insert({
        user_id: automation.user_id,
        automation_id: automationId,
        automation_name: automation.name,
        store: 'system',
        group_id: 'diagnostic',
        product_url: 'https://diagnostic.log',
        status: 'error',
        error: `${finalCode}: ${finalMsg}`
      });

      return new Response(
        JSON.stringify({ code: finalCode, message: finalMsg, steps }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    steps.push({
      step: 'GRUPOS_ENVIO',
      code: 'GRUPOS_OK',
      ok: true,
      detail: `${automation.send_groups.length} grupo(s) configurado(s)`
    });

    // STEP 3: Janela de Horário
    console.log('📋 Step 3: Verificando janela de horário...');
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const inWindow = currentTime >= automation.start_time && currentTime <= automation.end_time;

    if (!inWindow) {
      steps.push({
        step: 'JANELA',
        code: 'FORA_DA_JANELA',
        ok: false,
        detail: `Horário atual: ${currentTime}, Janela: ${automation.start_time}-${automation.end_time}`
      });
      // Note: This is a warning, not a blocker for manual tests
    } else {
      steps.push({
        step: 'JANELA',
        code: 'JANELA_OK',
        ok: true,
        detail: `Dentro da janela: ${automation.start_time}-${automation.end_time}`
      });
    }

    // STEP 4: Credenciais
    console.log('📋 Step 4: Verificando credenciais...');
    const { data: credentials } = await supabase
      .from('affiliate_credentials')
      .select('store')
      .eq('user_id', automation.user_id)
      .eq('is_active', true)
      .in('store', automation.stores);

    if (!credentials || credentials.length === 0) {
      steps.push({
        step: 'CREDENCIAIS',
        code: 'CREDS_AUSENTES',
        ok: false,
        detail: 'Nenhuma credencial ativa para as lojas selecionadas'
      });
      finalCode = 'CREDS_AUSENTES';
      finalMsg = 'Configure credenciais de afiliado para as lojas';
      
      await supabase.from('dispatch_logs').insert({
        user_id: automation.user_id,
        automation_id: automationId,
        automation_name: automation.name,
        store: 'system',
        group_id: 'diagnostic',
        product_url: 'https://diagnostic.log',
        status: 'error',
        error: `${finalCode}: ${finalMsg}`
      });

      return new Response(
        JSON.stringify({ code: finalCode, message: finalMsg, steps }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    steps.push({
      step: 'CREDENCIAIS',
      code: 'CREDS_OK',
      ok: true,
      detail: `${credentials.length} credencial(is) ativa(s): ${credentials.map(c => c.store).join(', ')}`
    });

    // STEP 5: Busca de Ofertas
    console.log('📋 Step 5: Buscando ofertas...');
    try {
      const { data: searchResult, error: searchError } = await supabase.functions.invoke('search-shopee-offers', {
        body: {
          userId: automation.user_id,
          searchParams: {
            categories: automation.categories,
            minPrice: automation.min_price,
            maxPrice: automation.max_price,
            minDiscount: automation.min_discount,
            sortBy: automation.priority === 'discount' ? 'commission' : 'price_low',
            limit: 20
          }
        }
      });

      if (searchError) throw searchError;

      const offers = searchResult?.offers || [];

      if (offers.length === 0) {
        steps.push({
          step: 'BUSCA_STORE',
          code: 'SEM_RESULTADOS',
          ok: false,
          detail: 'Nenhuma oferta encontrada com os filtros atuais'
        });
        finalCode = 'SEM_RESULTADOS';
        finalMsg = 'Nenhuma oferta encontrada. Tente ajustar os filtros.';
        
        await supabase.from('dispatch_logs').insert({
          user_id: automation.user_id,
          automation_id: automationId,
          automation_name: automation.name,
          store: 'shopee',
          group_id: 'diagnostic',
          product_url: 'https://diagnostic.log',
          status: 'skipped',
          error: `${finalCode}: ${finalMsg}`
        });

        return new Response(
          JSON.stringify({ code: finalCode, message: finalMsg, steps }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      steps.push({
        step: 'BUSCA_STORE',
        code: 'BUSCA_OK',
        ok: true,
        detail: `${offers.length} oferta(s) encontrada(s)`
      });

      // STEP 6: Filtro
      console.log('📋 Step 6: Aplicando filtros...');
      // For now, we'll assume all offers pass (filters already applied in search)
      steps.push({
        step: 'FILTRO',
        code: 'FILTRO_OK',
        ok: true,
        detail: `${offers.length} oferta(s) após filtros`
      });

      // STEP 7: Anti-duplicação
      console.log('📋 Step 7: Verificando duplicações...');
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentLogs } = await supabase
        .from('dispatch_logs')
        .select('product_url')
        .eq('automation_id', automationId)
        .gte('created_at', last24h);

      const sentUrls = new Set(recentLogs?.map(log => log.product_url) || []);
      const newOffers = offers.filter((offer: any) => !sentUrls.has(offer.product_url));

      if (newOffers.length === 0) {
        steps.push({
          step: 'ANTIDUP',
          code: 'DUPLICADO_SKIPPED',
          ok: false,
          detail: 'Todas as ofertas já foram enviadas nas últimas 24h'
        });
        finalCode = 'DUPLICADO_SKIPPED';
        finalMsg = 'Todas as ofertas já foram enviadas recentemente';
        
        await supabase.from('dispatch_logs').insert({
          user_id: automation.user_id,
          automation_id: automationId,
          automation_name: automation.name,
          store: 'shopee',
          group_id: 'diagnostic',
          product_url: 'https://diagnostic.log',
          status: 'skipped',
          error: `${finalCode}: ${finalMsg}`
        });

        return new Response(
          JSON.stringify({ code: finalCode, message: finalMsg, steps }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      steps.push({
        step: 'ANTIDUP',
        code: 'ANTIDUP_OK',
        ok: true,
        detail: `${newOffers.length} oferta(s) nova(s) (${offers.length - newOffers.length} duplicada(s))`
      });

      // STEP 8: Teste de Envio
      console.log('📋 Step 8: Testando envio (sem enviar de verdade)...');
      const testOffer = newOffers[0];
      const message = `NADA MELHOR QUE COMPRAR E ECONOMIZAR 🤑🛍️

> CORRE QUE VAI ESGOTAR

📦 ${testOffer.title}

${testOffer.discount ? `💥 ${testOffer.discount}% OFF` : ''}
🔥 Por: R$ ${testOffer.price.toFixed(2)} 🤑

🛒 Compre aqui: ${testOffer.product_url}

⚠️ O preço e disponibilidade do produto podem variar. As promoções são por tempo limitado`;

      steps.push({
        step: 'ENVIO',
        code: 'ENVIO_PRONTO',
        ok: true,
        detail: `Mensagem pronta para ${automation.send_groups.length} grupo(s). Preview: ${message.substring(0, 100)}...`
      });

      await supabase.from('dispatch_logs').insert({
        user_id: automation.user_id,
        automation_id: automationId,
        automation_name: automation.name,
        store: 'shopee',
        group_id: 'diagnostic',
        product_url: testOffer.product_url,
        status: 'sent',
        error: null
      });

    } catch (error) {
      console.error('Erro na busca:', error);
      steps.push({
        step: 'BUSCA_STORE',
        code: 'BUSCA_ERROR',
        ok: false,
        detail: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      finalCode = 'BUSCA_ERROR';
      finalMsg = 'Erro ao buscar ofertas';
    }

    console.log('✅ Diagnóstico concluído');

    return new Response(
      JSON.stringify({ 
        code: finalCode,
        message: finalMsg,
        steps 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro no diagnóstico:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro no diagnóstico';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
