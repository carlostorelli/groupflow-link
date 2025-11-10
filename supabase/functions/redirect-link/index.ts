import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GroupPriority {
  id: string;
  name: string;
  wa_group_id: string;
  members_count: number;
  member_limit: number;
  priority: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');

    console.log('🔗 Processando redirect link:', { slug });

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Slug é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar link salvo
    const { data: savedLink, error: linkError } = await supabase
      .from('saved_redirect_links')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (linkError) {
      console.error('❌ Erro ao buscar link:', linkError);
      throw linkError;
    }

    if (!savedLink) {
      console.log('❌ Link não encontrado:', slug);
      return new Response(
        JSON.stringify({ error: 'Link não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Link encontrado:', savedLink);

    // Buscar informações atualizadas dos grupos
    const groupIds = (savedLink.group_priorities as GroupPriority[]).map(g => g.id);
    const { data: currentGroups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, wa_group_id, members_count, member_limit')
      .in('id', groupIds);

    if (groupsError) {
      console.error('❌ Erro ao buscar grupos:', groupsError);
      throw groupsError;
    }

    console.log('📊 Grupos atuais:', currentGroups);

    // Criar mapa de grupos atualizados
    const groupMap = new Map(
      currentGroups?.map(g => [g.id, g]) || []
    );

    // Ordenar grupos por prioridade e buscar o primeiro com vagas
    const sortedGroups = (savedLink.group_priorities as GroupPriority[])
      .sort((a, b) => a.priority - b.priority);

    let selectedGroup = null;

    for (const priorityGroup of sortedGroups) {
      const currentGroup = groupMap.get(priorityGroup.id);
      if (!currentGroup) {
        console.log(`⚠️ Grupo ${priorityGroup.name} não encontrado no banco`);
        continue;
      }

      const availableSlots = currentGroup.member_limit - currentGroup.members_count;
      
      console.log(`🔍 Verificando grupo ${currentGroup.name}:`, {
        members: currentGroup.members_count,
        limit: currentGroup.member_limit,
        available: availableSlots
      });

      if (availableSlots > 0) {
        selectedGroup = currentGroup;
        console.log(`✅ Grupo selecionado: ${selectedGroup.name}`);
        break;
      }
    }

    if (!selectedGroup) {
      console.log('❌ Nenhum grupo com vagas disponíveis');
      return new Response(
        JSON.stringify({ 
          error: 'Todos os grupos estão cheios',
          message: 'No momento não há vagas disponíveis. Tente novamente mais tarde.'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Registrar clique
    const userAgent = req.headers.get('user-agent') || null;
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || null;

    const { error: clickError } = await supabase
      .from('redirect_link_clicks')
      .insert({
        link_id: savedLink.id,
        ip_address: ipAddress,
        user_agent: userAgent
      });

    if (clickError) {
      console.error('⚠️ Erro ao registrar clique:', clickError);
      // Não falhar a requisição por erro no log
    }

    // Atualizar contador de cliques
    await supabase
      .from('saved_redirect_links')
      .update({ 
        total_clicks: (savedLink.total_clicks || 0) + 1 
      })
      .eq('id', savedLink.id);

    console.log('📊 Clique registrado com sucesso');

    // Montar URL do WhatsApp
    const whatsappUrl = `https://chat.whatsapp.com/${selectedGroup.wa_group_id}`;

    console.log('🚀 Redirecionando para:', whatsappUrl);

    return new Response(
      JSON.stringify({
        success: true,
        redirect_url: whatsappUrl,
        group_name: selectedGroup.name,
        available_slots: selectedGroup.member_limit - selectedGroup.members_count
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
