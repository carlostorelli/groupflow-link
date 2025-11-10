-- Modificar saved_redirect_links para incluir estratégia de distribuição e contador de cliques por grupo
ALTER TABLE public.saved_redirect_links 
ADD COLUMN IF NOT EXISTS distribution_strategy text DEFAULT 'member_limit' CHECK (distribution_strategy IN ('member_limit', 'click_limit'));

-- Adicionar coluna para armazenar os cliques por grupo
ALTER TABLE public.saved_redirect_links 
ADD COLUMN IF NOT EXISTS group_clicks jsonb DEFAULT '{}'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN public.saved_redirect_links.distribution_strategy IS 'Estratégia de distribuição: member_limit (baseado em vagas) ou click_limit (baseado em número de cliques)';
COMMENT ON COLUMN public.saved_redirect_links.group_clicks IS 'Contador de cliques por grupo: {group_id: clicks_count}';