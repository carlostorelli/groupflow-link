import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { groupId } = await req.json();
    console.log('🔍 Requisição recebida para analisar grupo:', groupId);
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      console.error('❌ LOVABLE_API_KEY não configurada');
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Variáveis do Supabase não configuradas');
      throw new Error('Configuração do banco de dados ausente');
    }

    console.log('✅ API Key encontrada, buscando dados do grupo...');

    // Criar cliente do Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar dados reais do grupo
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError) {
      console.error('❌ Erro ao buscar grupo:', groupError);
      throw new Error('Grupo não encontrado');
    }

    console.log('✅ Grupo encontrado:', group.name);

    // Calcular idade do grupo
    const createdAt = new Date(group.created_at);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Simular dados de engajamento baseados em dados reais
    // Em uma implementação futura, esses dados viriam de mensagens armazenadas
    const groupData = {
      name: group.name,
      members: group.members_count,
      messagesLastWeek: Math.floor(Math.random() * 50) + 10, // Simulado
      messagesThisWeek: Math.floor(Math.random() * 30) + 5,  // Simulado
      activeMembers: Math.floor(group.members_count * 0.2), // Estimativa: 20% ativos
      lastActivity: daysSinceCreation > 7 ? "mais de 7 dias atrás" : `${daysSinceCreation} dias atrás`,
      status: group.status,
      isAdmin: group.is_admin
    };

    console.log('📊 Dados do grupo preparados:', groupData);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em análise de engajamento de grupos de WhatsApp e estratégias de reativação de comunidades.'
          },
          {
            role: 'user',
            content: `Analise os dados deste grupo do WhatsApp e forneça insights:

Dados do Grupo:
- Nome: ${groupData.name}
- Membros: ${groupData.members}
- Mensagens semana passada: ${groupData.messagesLastWeek}
- Mensagens esta semana: ${groupData.messagesThisWeek}
- Membros ativos: ${groupData.activeMembers}
- Última atividade: ${groupData.lastActivity}

Gere uma análise completa em formato JSON com:
1. status: "Baixo", "Médio" ou "Alto" engajamento
2. analysis: Análise detalhada do estado do grupo (2-3 frases)
3. suggestions: Array com 5 objetos contendo:
   - type: tipo da sugestão (Enquete, Pergunta, Oferta, Conteúdo, Dinâmica)
   - content: mensagem pronta para enviar
4. actionPlan: Plano de ação detalhado para os próximos 7 dias

Responda APENAS com o JSON, sem markdown ou texto adicional.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da API Lovable:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Limite de requisições atingido. Por favor, aguarde alguns minutos.');
      }
      if (response.status === 402) {
        throw new Error('Créditos insuficientes. Por favor, adicione créditos à sua conta.');
      }
      
      throw new Error(`Erro ao analisar engajamento: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Resposta recebida da API');
    
    let content = data.choices[0].message.content;
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(content);

    console.log('✅ Análise de engajamento concluída com sucesso');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Erro ao analisar engajamento:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: 'Verifique os logs para mais detalhes'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
