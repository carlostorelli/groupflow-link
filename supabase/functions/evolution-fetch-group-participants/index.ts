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
    const { instanceName, groupId } = await req.json();
    console.log('🔍 Buscando participantes do grupo:', { instanceName, groupId });
    
    if (!instanceName || !groupId) {
      throw new Error('instanceName e groupId são obrigatórios');
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

    // Encode parameters for URL
    const encodedInstanceName = encodeURIComponent(instanceName);
    const encodedGroupId = encodeURIComponent(groupId);

    console.log('📡 Chamando Evolution API para buscar metadata do grupo');
    console.log('URL:', `${apiUrl}/group/participants/${encodedInstanceName}`);
    
    // Buscar metadata do grupo via Evolution API
    const metadataResponse = await fetch(
      `${apiUrl}/group/participants/${encodedInstanceName}?groupJid=${encodedGroupId}`,
      {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error('❌ Erro ao buscar metadata:', metadataResponse.status, errorText);
      
      // Retornar erro específico
      if (metadataResponse.status === 403) {
        throw new Error('Sem permissão para acessar informações do grupo');
      } else if (metadataResponse.status === 404) {
        throw new Error('Grupo não encontrado');
      } else {
        throw new Error(`Erro ao buscar participantes: ${metadataResponse.status}`);
      }
    }

    const metadata = await metadataResponse.json();
    console.log('✅ Metadata recebida:', JSON.stringify(metadata).substring(0, 200));

    // Extrair JIDs dos participantes
    // A Evolution API pode retornar em diferentes formatos, vamos verificar
    let participants: string[] = [];
    
    if (Array.isArray(metadata)) {
      // Se for um array direto de participantes
      // IMPORTANTE: Priorizar 'jid' sobre 'id' pois 'id' pode conter @lid
      participants = metadata.map((p: any) => p.jid || p.id || p);
    } else if (metadata.participants && Array.isArray(metadata.participants)) {
      // Se vier dentro de um objeto com campo participants
      // IMPORTANTE: Priorizar 'jid' sobre 'id' pois 'id' pode conter @lid
      participants = metadata.participants.map((p: any) => p.jid || p.id || p);
    } else if (metadata.data && Array.isArray(metadata.data)) {
      // Se vier dentro de data
      // IMPORTANTE: Priorizar 'jid' sobre 'id' pois 'id' pode conter @lid
      participants = metadata.data.map((p: any) => p.jid || p.id || p);
    }

    console.log(`📋 Participantes extraídos (primeiros 3):`, participants.slice(0, 3));

    // Filtrar apenas JIDs válidos (formato: número@s.whatsapp.net)
    const validParticipants = participants.filter((p: string) => 
      typeof p === 'string' && (p.includes('@s.whatsapp.net') || p.includes('@g.us'))
    );

    console.log(`✅ ${validParticipants.length} participantes válidos encontrados`);

    if (validParticipants.length === 0) {
      throw new Error('Nenhum participante encontrado no grupo');
    }

    return new Response(
      JSON.stringify({
        success: true,
        participants: validParticipants,
        count: validParticipants.length,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro ao buscar participantes:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        participants: [],
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200  // Retornar 200 para o frontend tratar o erro
      }
    );
  }
});
