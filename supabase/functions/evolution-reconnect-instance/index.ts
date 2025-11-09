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

    console.log('🔄 Tentando reconectar instância:', instanceName);

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

    console.log('✅ Configurações carregadas. Tentando buscar QR code...');

    // Tentar buscar o QR code diretamente (a Evolution API retorna QR se desconectado)
    const qrResponse = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': apiKey },
    });

    console.log('📡 Resposta da Evolution API:', qrResponse.status);

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text();
      console.error('❌ Erro da Evolution API:', errorText);
      
      // Se retornou 404, a instância não existe mais
      if (qrResponse.status === 404) {
        throw new Error('Instância não existe mais na Evolution API. Crie uma nova conexão na página WhatsApp.');
      }
      
      throw new Error(`Erro ao buscar QR code: ${errorText}`);
    }

    const qrData = await qrResponse.json();
    console.log('✅ QR Code obtido com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        qrcode: qrData.qrcode || qrData,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro ao reconectar instância:', error);
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
