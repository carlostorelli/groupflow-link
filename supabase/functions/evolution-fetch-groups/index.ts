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
    
    // Buscar o JID do número conectado (owner)
    const hostResponse = await fetch(
      `${apiUrl}/instance/fetchInstances?instanceName=${encodedInstanceName}`,
      {
        headers: {
          'apikey': apiKey,
        },
      }
    );

    if (!hostResponse.ok) {
      throw new Error(`Erro ao buscar instância: ${hostResponse.status}`);
    }

    const instances = await hostResponse.json();
    const myInstance = Array.isArray(instances) 
      ? instances.find((i: any) => i.instance?.instanceName === instanceName)
      : instances;
    
    const ownerJid = myInstance?.instance?.owner || null;
    
    if (!ownerJid) {
      console.warn('⚠️ Não foi possível obter o JID do owner. Processando todos os grupos.');
    } else {
      console.log(`✅ Owner JID: ${ownerJid}`);
    }
    
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
    const processedGroups = groupsData
      .map((group: any) => {
        const participants = group.participants || [];
        
        // Se temos o ownerJid, buscar o participante específico
        // Senão, verificar se existe algum admin (fallback)
        const ourParticipant = ownerJid
          ? participants.find((p: any) => 
              p.id === ownerJid && (p.admin === 'admin' || p.admin === 'superadmin')
            )
          : participants.find((p: any) => 
              p.admin === 'admin' || p.admin === 'superadmin'
            );
        
        const isAdmin = ourParticipant !== undefined;
        
        return {
          ...group,
          size: participants.length || group.size || 0,
          isOpen: !group.restrict && !group.announce,
          isAdmin,
        };
      })
      .filter((group: any) => group.isAdmin); // FILTRAR: apenas grupos onde somos admin

    console.log(`✅ ${processedGroups.length} grupos onde o bot é ADMIN`);

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
