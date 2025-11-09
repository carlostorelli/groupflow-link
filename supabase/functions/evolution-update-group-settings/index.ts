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
    const { instanceName, groupId, action } = await req.json();

    console.log(`🔧 Atualizando configurações do grupo: ${action}`, { instanceName, groupId });

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API não configurada');
    }

    // Endpoint para atualizar configurações do grupo
    const url = `${evolutionApiUrl}/group/updateGroupSetting/${encodeURIComponent(instanceName)}`;
    
    console.log(`📡 Chamando Evolution API: ${url}`);

    const payload = {
      groupJid: groupId,
      action: action // "announcement" ou "not_announcement"
    };

    console.log(`📦 Payload:`, payload);

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
      throw new Error(`Erro ao atualizar grupo: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Grupo atualizado com sucesso:`, result);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao atualizar grupo:', error);
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
