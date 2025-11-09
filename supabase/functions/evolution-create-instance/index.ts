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
      throw new Error('Configurações da Evolution API não encontradas. Configure no painel de Admin.');
    }

    // Tentar deletar instância antiga primeiro (caso exista)
    try {
      const deleteResponse = await fetch(`${apiUrl}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: { 'apikey': apiKey },
      });
      console.log('✅ Instância antiga deletada:', deleteResponse.status);
      // Aguardar 3 segundos para garantir que foi deletada
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (e) {
      console.log('ℹ️ Nenhuma instância antiga para deletar:', e);
    }

    console.log('🔄 Criando nova instância:', instanceName);

    // Criar instância na Evolution API
    const evolutionResponse = await fetch(`${apiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });

    console.log('📡 Resposta da Evolution API:', evolutionResponse.status);

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error('❌ Erro na Evolution API:', evolutionResponse.status, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        throw new Error(`Erro na Evolution API (${evolutionResponse.status}): ${errorText}`);
      }
      
      // Se o erro for de nome duplicado, tentar reconectar
      if (errorData?.response?.message?.[0]?.includes('already in use')) {
        throw new Error('Esta instância já existe. Por favor, use outro nome ou aguarde alguns segundos.');
      }
      
      throw new Error(`Erro na Evolution API: ${JSON.stringify(errorData)}`);
    }

    const evolutionData = await evolutionResponse.json();
    console.log('✅ Instância criada com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        instance: evolutionData.instance,
        qrcode: evolutionData.qrcode,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro ao criar instância:', error);
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
