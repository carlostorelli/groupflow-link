-- Adicionar coluna para código de convite do WhatsApp
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS invite_code text;