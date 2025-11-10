-- Adicionar coluna name para identificação do link
ALTER TABLE public.saved_redirect_links 
ADD COLUMN IF NOT EXISTS name text;

COMMENT ON COLUMN public.saved_redirect_links.name IS 'Nome descritivo para identificar o redirecionamento';