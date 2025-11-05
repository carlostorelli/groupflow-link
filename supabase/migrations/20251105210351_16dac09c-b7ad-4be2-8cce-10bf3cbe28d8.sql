-- Remover política antiga de inserção
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;

-- Criar nova política que permite inserção se:
-- 1. O usuário é admin, OU
-- 2. Não existe nenhum admin ainda (primeiro admin)
CREATE POLICY "Admins can insert roles or create first admin"
ON public.user_roles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role)
);