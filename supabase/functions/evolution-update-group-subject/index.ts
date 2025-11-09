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
    const { instanceName, groupId, subject } = await req.json();

    console.log(`✏️ Atualizando nome do grupo`, { instanceName, groupId, subject });

    // Buscar configurações das variáveis de ambiente ou do banco
    let evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    let evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    // Se não encontrou nas variáveis de ambiente, buscar no banco
    if (!evolutionApiUrl || !evolutionApiKey) {
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
      evolutionApiUrl = settings.find((s: any) => s.key === 'evolution_api_url')?.value;
      evolutionApiKey = settings.find((s: any) => s.key === 'evolution_api_key')?.value;

      if (!evolutionApiUrl || !evolutionApiKey) {
        throw new Error('Evolution API não configurada');
      }
    }

    const url = `${evolutionApiUrl}/group/updateGroupSubject/${encodeURIComponent(instanceName)}`;
    
    console.log(`📡 Chamando Evolution API: ${url}`);

    const payload = {
      groupJid: groupId,
      subject: subject
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro da Evolution API (${response.status}):`, errorText);
      throw new Error(`Erro ao atualizar nome: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Nome do grupo atualizado:`, result);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao atualizar nome:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
