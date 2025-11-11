import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { automationId } = await req.json();

    if (!automationId) {
      throw new Error('automationId é obrigatório');
    }

    console.log(`🔄 Resetando histórico da automação: ${automationId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get automation to verify it exists and get user_id
    const { data: automation, error: autoError } = await supabase
      .from('automations')
      .select('user_id, name')
      .eq('id', automationId)
      .single();

    if (autoError || !automation) {
      throw new Error('Automação não encontrada');
    }

    // Calculate 24h ago
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Delete dispatch logs from last 24h for this automation
    const { error: deleteError, count } = await supabase
      .from('dispatch_logs')
      .delete({ count: 'exact' })
      .eq('automation_id', automationId)
      .eq('status', 'sent')
      .gte('created_at', yesterday.toISOString());

    if (deleteError) {
      console.error('❌ Erro ao deletar histórico:', deleteError);
      throw deleteError;
    }

    console.log(`✅ ${count || 0} registro(s) deletado(s) do histórico`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedCount: count || 0,
        message: `Histórico de ${count || 0} produto(s) resetado com sucesso` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro ao resetar histórico:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
