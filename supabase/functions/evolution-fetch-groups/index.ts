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
    const { instanceName } = await req.json();
    
    if (!instanceName) {
      throw new Error('Nome da instância é obrigatório');
    }

    // Buscar configurações da Evolution API
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const settingsResponse = await fetch(
      `${supabaseUrl}/rest/v1/settings?key=in.(evolution_api_url,evolution_api_key)&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );

    const settings = await settingsResponse.json();
    const apiUrl = settings.find((s: any) => s.key === 'evolution_api_url')?.value;
    const apiKey = settings.find((s: any) => s.key === 'evolution_api_key')?.value;

    if (!apiUrl || !apiKey) {
      throw new Error('Configurações da Evolution API não encontradas');
    }

    // Encode instance name for URL
    const encodedInstanceName = encodeURIComponent(instanceName);
    
    // Buscar grupos da instância com participantes para ter o tamanho correto
    const evolutionResponse = await fetch(
      `${apiUrl}/group/fetchAllGroups/${encodedInstanceName}?getParticipants=true`,
      {
        headers: {
          'apikey': apiKey,
        },
      }
    );

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error('Erro na Evolution API:', evolutionResponse.status, errorText);
      throw new Error(`Erro ao buscar grupos: ${evolutionResponse.status}`);
    }

    const groupsData = await evolutionResponse.json();
    
    // Processar dados dos grupos incluindo informação de admin
    const processedGroups = groupsData.map((group: any) => {
      // Verificar se o usuário é admin no grupo
      const participants = group.participants || [];
      const ourParticipant = participants.find((p: any) => 
        p.admin === 'admin' || p.admin === 'superadmin'
      );
      
      return {
        ...group,
        // O tamanho real vem do array de participantes
        size: group.participants?.length || group.size || 0,
        // Verificar se o grupo está aberto baseado nas configurações
        isOpen: !group.restrict && !group.announce,
        // Verificar se o usuário é admin
        isAdmin: ourParticipant !== undefined,
      };
    });

    console.log(`✅ ${processedGroups.length} grupos processados (incluindo info de admin)`);

    return new Response(
      JSON.stringify({
        success: true,
        groups: processedGroups,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro ao buscar grupos:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
