import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    console.log('Buscando grupos da instância:', instanceName);
    
    if (!instanceName) {
      throw new Error('Nome da instância é obrigatório');
    }

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autenticação não encontrado');
    }

    // Buscar configurações da Evolution API
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create Supabase client with user's auth
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

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
      const errorText = await evolutionResponse.text();
      console.error('Erro da Evolution API:', evolutionResponse.status, errorText);
      throw new Error('Erro ao buscar grupos da instância');
    }

    const groupsData = await evolutionResponse.json();
    console.log(`Encontrados ${groupsData.length} grupos`);

    // Get user from auth header
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Get or create instance record
    const { data: existingInstance } = await supabase
      .from('instances')
      .select('id')
      .eq('instance_id', instanceName)
      .eq('user_id', user.id)
      .single();

    let instanceRecordId: string;

    if (existingInstance) {
      instanceRecordId = existingInstance.id;
      // Update instance status
      await supabase
        .from('instances')
        .update({ status: 'connected', updated_at: new Date().toISOString() })
        .eq('id', instanceRecordId);
    } else {
      // Create instance record
      const { data: newInstance, error: instanceError } = await supabase
        .from('instances')
        .insert({
          instance_id: instanceName,
          user_id: user.id,
          status: 'connected',
        })
        .select('id')
        .single();

      if (instanceError || !newInstance) {
        console.error('Erro ao criar instância:', instanceError);
        throw new Error('Erro ao salvar instância');
      }
      instanceRecordId = newInstance.id;
    }

    // Save groups to database
    const groupsToInsert = groupsData.map((group: any) => ({
      wa_group_id: group.id,
      name: group.subject || 'Sem nome',
      description: group.description || null,
      members_count: group.size || 0,
      user_id: user.id,
      instance_id: instanceRecordId,
      status: 'open',
    }));

    console.log(`Salvando ${groupsToInsert.length} grupos no banco de dados`);

    // Delete existing groups for this instance to avoid duplicates
    await supabase
      .from('groups')
      .delete()
      .eq('instance_id', instanceRecordId);

    // Insert new groups
    const { error: insertError } = await supabase
      .from('groups')
      .insert(groupsToInsert);

    if (insertError) {
      console.error('Erro ao salvar grupos:', insertError);
      throw new Error('Erro ao salvar grupos no banco de dados');
    }

    console.log('Grupos salvos com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        groups: groupsData,
        saved: groupsToInsert.length,
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
