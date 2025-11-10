-- Adicionar coluna is_favorite na tabela groups
ALTER TABLE public.groups 
ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;

-- Criar índice para melhorar performance na ordenação
CREATE INDEX idx_groups_favorite ON public.groups(user_id, is_favorite DESC, name);