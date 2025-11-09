-- Adicionar campo is_admin na tabela groups para controlar permissões
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Adicionar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_groups_is_admin ON public.groups(is_admin);