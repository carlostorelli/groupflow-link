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
    const { instanceName, groupId, message, mentions } = await req.json();
    console.log('Enviando mensagem:', { instanceName, groupId, messageLength: message?.length });
    
    if (!instanceName || !groupId || !message) {
      throw new Error('Dados incompletos');
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

    // Verificar se a instância existe e está conectada
    console.log('Verificando status da instância:', instanceName);
    console.log('URL da Evolution API:', apiUrl);
    console.log('URL completa:', `${apiUrl}/instance/connectionState/${encodedInstanceName}`);
    
    const statusResponse = await fetch(
      `${apiUrl}/instance/connectionState/${encodedInstanceName}`,
      {
        headers: {
          'apikey': apiKey,
        },
      }
    );

    console.log('Status response:', statusResponse.status);

    if (!statusResponse.ok) {
      if (statusResponse.status === 404) {
        // Atualizar status no banco de dados para disconnected
        await fetch(
          `${supabaseUrl}/rest/v1/instances?instance_id=eq.${encodeURIComponent(instanceName)}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'disconnected' }),
          }
        );
        
        throw new Error(`Instância "${instanceName}" não encontrada na Evolution API. O status foi atualizado para desconectado. Por favor, reconecte seu WhatsApp na página de conexão.`);
      }
      throw new Error(`Erro ao verificar status da instância: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    console.log('Status da instância:', statusData);

    if (statusData.instance?.state !== 'open') {
      // Atualizar status no banco de dados
      await fetch(
        `${supabaseUrl}/rest/v1/instances?instance_id=eq.${encodeURIComponent(instanceName)}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'disconnected' }),
        }
      );
      
      throw new Error(`Instância "${instanceName}" não está conectada. Status: ${statusData.instance?.state || 'desconhecido'}. Por favor, reconecte seu WhatsApp.`);
    }

    console.log('Enviando para Evolution API:', `${apiUrl}/message/sendText/${encodedInstanceName}`);

    // Preparar payload
    const payload: any = {
      number: groupId,
      text: message,
    };

    // Adicionar menções se fornecidas
    if (mentions && mentions.length > 0) {
      payload.mentions = mentions;
    }

    // Enviar mensagem via Evolution API
    const evolutionResponse = await fetch(
      `${apiUrl}/message/sendText/${encodedInstanceName}`,
      {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error('Erro na resposta da Evolution API:', evolutionResponse.status, errorText);
      throw new Error(`Erro ao enviar mensagem: ${evolutionResponse.status}`);
    }

    const responseData = await evolutionResponse.json();
    console.log('Mensagem enviada com sucesso:', responseData.key?.id);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: responseData.key?.id,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
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