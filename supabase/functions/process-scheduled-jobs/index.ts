import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Processando jobs agendados...');

    // Buscar jobs pendentes que já passaram do horário agendado
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('Erro ao buscar jobs:', fetchError);
      throw fetchError;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('✅ Nenhum job pendente para processar');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum job para processar', processed: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 ${pendingJobs.length} job(s) encontrado(s)`);

    let processed = 0;
    let errors = 0;

    // Processar cada job
    for (const job of pendingJobs) {
      try {
        console.log(`⚙️ Processando job ${job.id} - Tipo: ${job.action_type}`);

        // Atualizar status para running
        await supabase
          .from('jobs')
          .update({ status: 'running', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        // Buscar informações do usuário
        const { data: userData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', job.user_id)
          .single();

        if (!userData) {
          throw new Error('Usuário não encontrado');
        }

        // Buscar instância do usuário
        const { data: instances } = await supabase
          .from('instances')
          .select('instance_id')
          .eq('user_id', job.user_id)
          .eq('status', 'connected')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!instances || instances.length === 0) {
          throw new Error('Nenhuma instância conectada');
        }

        const instanceName = instances[0].instance_id;

        // Buscar dados dos grupos do payload
        const groupIds = job.payload.groups || [];
        const { data: groupsData } = await supabase
          .from('groups')
          .select('wa_group_id, name')
          .in('id', groupIds)
          .eq('user_id', job.user_id);

        if (!groupsData || groupsData.length === 0) {
          throw new Error('Nenhum grupo válido encontrado');
        }

        console.log(`📤 Executando ação em ${groupsData.length} grupo(s)`);

        // Executar a ação apropriada baseada no tipo
        let successCount = 0;
        let errorCount = 0;

        const groupErrors: string[] = [];
        
        for (const group of groupsData) {
          try {
            if (job.action_type === 'send_message') {
              // Processar menções
              let mentions: string[] | undefined = undefined;
              const message = job.payload.message || '';
              
              if (message.includes('@todos')) {
                // Buscar todos os participantes do grupo
                const { data: participantsData, error: participantsError } = await supabase.functions.invoke('evolution-fetch-group-participants', {
                  body: {
                    instanceName,
                    groupId: group.wa_group_id,
                  }
                });

                if (participantsError) {
                  console.error(`❌ Erro ao buscar participantes:`, participantsError);
                } else if (participantsData?.participants && Array.isArray(participantsData.participants)) {
                  // Extrair apenas os números (remover @s.whatsapp.net) e remover duplicatas
                  const phoneNumbers = participantsData.participants
                    .filter((p: any) => p && typeof p === 'string' && p.includes('@'))
                    .map((p: string) => p.split('@')[0]);
                  
                  // Remover duplicatas
                  mentions = Array.from(new Set(phoneNumbers));
                  console.log(`📢 ${mentions.length} menções únicas processadas`);
                }
              }

              const { data: sendData, error: sendError } = await supabase.functions.invoke('evolution-send-message', {
                body: {
                  instanceName,
                  groupId: group.wa_group_id,
                  message: message,
                  mentions: mentions,
                }
              });

              if (sendError) throw sendError;
              if (sendData?.error) throw new Error(sendData.error);
            } else if (job.action_type === 'update_description') {
              const { data: descData, error: descError } = await supabase.functions.invoke('evolution-update-group-description', {
                body: {
                  instanceName,
                  groupId: group.wa_group_id,
                  description: job.payload.description || '',
                }
              });

              if (descError) throw descError;
              if (descData?.error) throw new Error(descData.error);
            } else if (job.action_type === 'close_groups') {
              const { data: settingData, error: settingError } = await supabase.functions.invoke('evolution-update-group-settings', {
                body: {
                  instanceName,
                  groupId: group.wa_group_id,
                  action: 'announcement',
                }
              });

              if (settingError) throw settingError;
              if (settingData?.error) throw new Error(settingData.error);
            } else if (job.action_type === 'open_groups') {
              const { data: settingData, error: settingError } = await supabase.functions.invoke('evolution-update-group-settings', {
                body: {
                  instanceName,
                  groupId: group.wa_group_id,
                  action: 'not_announcement',
                }
              });

              if (settingError) throw settingError;
              if (settingData?.error) throw new Error(settingData.error);
            } else if (job.action_type === 'change_group_name') {
              const { data: nameData, error: nameError } = await supabase.functions.invoke('evolution-update-group-subject', {
                body: {
                  instanceName,
                  groupId: group.wa_group_id,
                  subject: job.payload.name || '',
                }
              });

              if (nameError) throw nameError;
              if (nameData?.error) throw new Error(nameData.error);
            } else if (job.action_type === 'change_group_photo') {
              const { data: photoData, error: photoError } = await supabase.functions.invoke('evolution-update-group-picture', {
                body: {
                  instanceName,
                  groupId: group.wa_group_id,
                  image: job.payload.image || '',
                }
              });

              if (photoError) throw photoError;
              if (photoData?.error) throw new Error(photoData.error);
            }

            successCount++;
            console.log(`✅ Ação executada no grupo: ${group.name}`);

            // Aguardar 1 segundo entre ações para evitar rate limit
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (groupError: any) {
            errorCount++;
            const errorMsg = groupError?.message || 'Erro desconhecido';
            
            // Detectar erro de permissão
            let userFriendlyMsg = `${group.name}`;
            if (errorMsg.includes('403') || errorMsg.includes('Forbidden') || errorMsg.includes('not-admin') || errorMsg.includes('permission')) {
              userFriendlyMsg += ' - Você não é admin deste grupo';
            } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
              userFriendlyMsg += ' - Grupo não encontrado';
            } else {
              userFriendlyMsg += ` - ${errorMsg}`;
            }
            
            groupErrors.push(userFriendlyMsg);
            console.error(`❌ Erro no grupo ${group.name}:`, groupError);
          }
        }

        // Atualizar job com resultado
        const finalStatus = errorCount === 0 ? 'done' : (successCount > 0 ? 'done' : 'failed');
        const errorMessage = groupErrors.length > 0 
          ? `Erros (${errorCount}/${groupsData.length}): ${groupErrors.join('; ')}`
          : null;
          
        await supabase
          .from('jobs')
          .update({
            status: finalStatus,
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        processed++;
        console.log(`✅ Job ${job.id} processado - ${successCount} sucesso, ${errorCount} erros`);

      } catch (jobError: any) {
        errors++;
        console.error(`❌ Erro ao processar job ${job.id}:`, jobError);

        // Marcar job como failed
        await supabase
          .from('jobs')
          .update({
            status: 'failed',
            error_message: jobError.message || 'Erro desconhecido',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    }

    console.log(`✅ Processamento concluído: ${processed} sucesso, ${errors} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        total: pendingJobs.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
