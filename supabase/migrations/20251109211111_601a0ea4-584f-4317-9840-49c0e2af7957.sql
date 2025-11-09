-- Alterar o valor padrão de is_admin para true
-- pois por padrão assumimos que o usuário é admin dos seus grupos
ALTER TABLE public.groups ALTER COLUMN is_admin SET DEFAULT true;