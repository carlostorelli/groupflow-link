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

    // Buscar grupos da instância
    const evolutionResponse = await fetch(
      `${apiUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
      {
        headers: {
          'apikey': apiKey,
        },
      }
    );

    if (!evolutionResponse.ok) {
      throw new Error('Erro ao buscar grupos da instância');
    }

    const groupsData = await evolutionResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        groups: groupsData,
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
