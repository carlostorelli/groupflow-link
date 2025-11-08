-- Add unique constraint for wa_group_id and user_id combination
ALTER TABLE public.groups 
ADD CONSTRAINT groups_wa_group_id_user_id_key UNIQUE (wa_group_id, user_id);