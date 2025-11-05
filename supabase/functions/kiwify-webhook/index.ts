import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_TOKEN = 'ppwef2elcdu';

interface KiwifyWebhook {
  email: string;
  evento: string;
  produto?: string;
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Webhook recebido da Kiwify');

    const body: KiwifyWebhook = await req.json();
    console.log('Dados do webhook:', JSON.stringify(body));

    // Validar token de segurança
    if (!body.token || body.token !== WEBHOOK_TOKEN) {
      console.error('Token inválido ou ausente');
      return new Response(
        JSON.stringify({ error: 'Token de autenticação inválido' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Validar campos obrigatórios
    if (!body.email || !body.evento) {
      console.error('Campos obrigatórios ausentes');
      return new Response(
        JSON.stringify({ error: 'Email e evento são obrigatórios' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Buscar usuário pelo email
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', body.email)
      .limit(1);

    if (profileError) {
      console.error('Erro ao buscar usuário:', profileError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar usuário' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    if (!profiles || profiles.length === 0) {
      console.error('Usuário não encontrado:', body.email);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const profile = profiles[0];
    let newPlan = 'free';
    let storageLimit = 1000000000; // 1 GB

    // Processar evento
    const evento = body.evento.toLowerCase();
    
    if (evento.includes('cancelada') || evento.includes('atrasada') || 
        evento.includes('expirada') || evento.includes('recusada')) {
      // Downgrade para plano free
      newPlan = 'free';
      storageLimit = 1000000000;
      console.log('Downgrade para plano free');
    } else if (evento.includes('renovada') || evento.includes('aprovada') || 
               evento.includes('confirmada') || evento.includes('ativa')) {
      // Atualizar plano baseado no produto
      const produto = (body.produto || '').toLowerCase();
      
      if (produto.includes('starter')) {
        newPlan = 'starter';
        storageLimit = 5000000000; // 5 GB
      } else if (produto.includes('pro')) {
        newPlan = 'pro';
        storageLimit = 15000000000; // 15 GB
      } else if (produto.includes('master')) {
        newPlan = 'master';
        storageLimit = 50000000000; // 50 GB
      } else {
        console.warn('Produto não reconhecido:', body.produto);
        newPlan = 'starter'; // Default para starter se não reconhecer
        storageLimit = 5000000000;
      }
      console.log(`Upgrade para plano ${newPlan}`);
    } else {
      console.warn('Evento não reconhecido:', body.evento);
    }

    // Atualizar perfil do usuário
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        plan: newPlan,
        storage_limit: storageLimit,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('Erro ao atualizar perfil:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar perfil do usuário' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Registrar log do webhook
    const { error: logError } = await supabaseAdmin
      .from('webhook_logs')
      .insert({
        email: body.email,
        event: body.evento,
        product: body.produto || null
      });

    if (logError) {
      console.error('Erro ao registrar log:', logError);
      // Não retorna erro, apenas loga
    }

    console.log(`Webhook processado com sucesso para ${body.email}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Webhook processado com sucesso',
        plan: newPlan
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Erro ao processar webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
