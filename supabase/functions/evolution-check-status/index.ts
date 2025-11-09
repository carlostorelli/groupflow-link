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
    console.log('Verificando status da instância:', instanceName);
    
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

    console.log('Consultando Evolution API:', `${apiUrl}/instance/connectionState/${instanceName}`);

    // Verificar status da instância
    const evolutionResponse = await fetch(
      `${apiUrl}/instance/connectionState/${instanceName}`,
      {
        headers: {
          'apikey': apiKey,
        },
      }
    );

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error('Erro na resposta da Evolution API:', evolutionResponse.status, errorText);
      
      // Handle 404 specifically (instance doesn't exist)
      if (evolutionResponse.status === 404) {
        console.log('Instância não encontrada (404) - retornando status not_found');
        return new Response(
          JSON.stringify({
            success: true,
            status: 'not_found',
            instance: null,
            rawData: { error: errorText }
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }
      
      throw new Error('Erro ao verificar status da instância');
    }

    const statusData = await evolutionResponse.json();
    console.log('✅ Status retornado pela Evolution API:', JSON.stringify(statusData, null, 2));

    // Extrair o status de diferentes possíveis locais na resposta
    const extractedStatus = 
      statusData?.instance?.state || 
      statusData?.state || 
      statusData?.status ||
      statusData?.instance?.status;

    console.log('📊 Status extraído:', extractedStatus);

    return new Response(
      JSON.stringify({
        success: true,
        status: extractedStatus,
        instance: statusData.instance || statusData,
        rawData: statusData,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro ao verificar status:', error);
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
