import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractContactsRequest {
  groupLink: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { groupLink }: ExtractContactsRequest = await req.json();
    console.log('🔍 Extraindo contatos do grupo:', groupLink);

    if (!groupLink) {
      throw new Error('Link do grupo é obrigatório');
    }

    // Extrair código do convite do link
    // Formato: https://chat.whatsapp.com/XXXXX
    const groupCodeMatch = groupLink.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
    if (!groupCodeMatch) {
      throw new Error('Formato de link do WhatsApp inválido');
    }

    const inviteCode = groupCodeMatch[1];
    console.log('📋 Código do convite:', inviteCode);

    // Buscar configurações da Evolution API
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar token do header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Usuário não encontrado');
    }

    console.log('👤 Usuário:', user.id);

    // Buscar instância ativa do usuário
    const { data: instances, error: instanceError } = await supabase
      .from('instances')
      .select('instance_id, status')
      .eq('user_id', user.id)
      .eq('status', 'connected')
      .limit(1);

    if (instanceError) {
      console.error('❌ Erro ao buscar instância:', instanceError);
      throw new Error('Erro ao buscar instância do WhatsApp');
    }

    if (!instances || instances.length === 0) {
      throw new Error('Nenhuma instância WhatsApp conectada. Conecte uma instância primeiro.');
    }

    const instanceName = instances[0].instance_id;
    console.log('📱 Instância:', instanceName);

    // Buscar settings da Evolution API
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

    console.log('🔗 Juntando grupo via código de convite...');

    // Primeiro, tentar juntar o grupo via código de convite
    const joinResponse = await fetch(
      `${apiUrl}/group/acceptInvite/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteCode: inviteCode,
        }),
      }
    );

    if (!joinResponse.ok) {
      const errorText = await joinResponse.text();
      console.error('⚠️ Erro ao juntar grupo (pode já estar no grupo):', joinResponse.status, errorText);
      // Não vamos lançar erro aqui, pois pode já estar no grupo
    } else {
      const joinData = await joinResponse.json();
      console.log('✅ Juntou ao grupo:', joinData);
    }

    // Aguardar um pouco para o WhatsApp processar
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('📡 Buscando grupos para encontrar o grupo pelo código...');

    // Buscar todos os grupos da instância (sem participantes completos)
    const groupsResponse = await fetch(
      `${apiUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
      {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!groupsResponse.ok) {
      const errorText = await groupsResponse.text();
      console.error('❌ Erro ao buscar grupos:', groupsResponse.status, errorText);
      throw new Error(`Erro ao buscar grupos: ${groupsResponse.status}`);
    }

    const groupsData = await groupsResponse.json();
    console.log('📋 Total de grupos encontrados:', groupsData.length);

    // Procurar o grupo que tem o código de convite correspondente
    let targetGroup = null;
    for (const group of groupsData) {
      if (group.inviteCode === inviteCode || group.subject?.includes(inviteCode)) {
        targetGroup = group;
        break;
      }
    }

    if (!targetGroup) {
      console.log('⚠️ Grupo não encontrado pelo código, tentando o primeiro grupo...');
      targetGroup = groupsData[0];
    }

    if (!targetGroup) {
      throw new Error('Não foi possível encontrar o grupo');
    }

    console.log('✅ Grupo encontrado:', targetGroup.subject || targetGroup.id);
    
    // Agora buscar TODOS os participantes usando a função específica
    console.log('📡 Buscando participantes completos do grupo...');
    const participantsResponse = await fetch(
      `${supabaseUrl}/functions/v1/evolution-fetch-group-participants`,
      {
        method: 'POST',
        headers: {
          'Authorization': req.headers.get('Authorization') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: instanceName,
          groupId: targetGroup.id,
        }),
      }
    );

    if (!participantsResponse.ok) {
      const errorText = await participantsResponse.text();
      console.error('❌ Erro ao buscar participantes:', errorText);
      throw new Error('Erro ao buscar participantes do grupo');
    }

    const participantsData = await participantsResponse.json();
    
    if (!participantsData.success || !participantsData.participants) {
      throw new Error(participantsData.error || 'Erro ao buscar participantes');
    }

    const participantJids = participantsData.participants;
    console.log('👥 Total de participantes encontrados:', participantJids.length);
    console.log('📋 Primeiros JIDs:', participantJids.slice(0, 3));
    
    const contacts = participantJids.map((jid: string) => {
      // Extrair número do JID (formato: 5547999999999@s.whatsapp.net)
      const phoneNumber = jid
        .replace('@s.whatsapp.net', '')
        .replace('@c.us', '')
        .replace('@g.us', '');
      
      console.log(`👤 Contato extraído: Tel="${phoneNumber}" | JID="${jid}"`);
      
      return {
        id: jid,
        name: '', // Nome não disponível nesta API, apenas JIDs
        phone: phoneNumber,
        isAdmin: false, // Status de admin não disponível nesta chamada
      };
    });

    console.log('✅ Contatos extraídos:', contacts.length);

    return new Response(
      JSON.stringify({
        success: true,
        groupId: targetGroup.id,
        groupName: targetGroup.subject,
        contacts: contacts,
        totalContacts: contacts.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro ao extrair contatos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
        contacts: [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Retornar 200 para o frontend tratar o erro
      }
    );
  }
});
