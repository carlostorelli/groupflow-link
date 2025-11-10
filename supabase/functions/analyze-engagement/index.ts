import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { groupId } = await req.json();
    console.log('🔍 Requisição recebida para analisar grupo:', groupId);
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      console.error('❌ LOVABLE_API_KEY não configurada');
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('✅ API Key encontrada, analisando engajamento...');

    // Simulate group data (in real implementation, fetch from database)
    const groupData = {
      name: "Grupo de Descontos",
      members: 150,
      messagesLastWeek: 45,
      messagesThisWeek: 12,
      activeMembers: 8,
      lastActivity: "3 dias atrás"
    };

    console.log('📊 Dados do grupo:', groupData);

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
