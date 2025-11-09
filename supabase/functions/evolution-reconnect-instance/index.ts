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

    // Primeiro, verificar se a instância existe na Evolution API
    const checkResponse = await fetch(`${apiUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
      headers: { 'apikey': apiKey },
    });

    if (!checkResponse.ok) {
      throw new Error('Instância não encontrada na Evolution API');
    }

    const instances = await checkResponse.json();
    const instance = instances.find((inst: any) => inst.instance?.instanceName === instanceName);

    if (!instance) {
      throw new Error('Instância não encontrada na Evolution API');
    }

    // Tentar reconectar e buscar QR code
    const qrResponse = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': apiKey },
    });

    if (!qrResponse.ok) {
      const errorData = await qrResponse.json().catch(() => ({}));
      console.error('Erro ao buscar QR code:', errorData);
      throw new Error('Erro ao buscar QR code da instância');
    }

    const qrData = await qrResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        instance: instance.instance,
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
