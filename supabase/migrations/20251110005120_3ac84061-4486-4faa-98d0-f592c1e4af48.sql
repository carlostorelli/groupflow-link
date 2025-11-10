-- Adicionar policy para permitir leitura pública de links ativos
DROP POLICY IF EXISTS "Anyone can view active redirect links" ON public.saved_redirect_links;

CREATE POLICY "Anyone can view active redirect links" 
ON public.saved_redirect_links 
FOR SELECT 
USING (is_active = true);