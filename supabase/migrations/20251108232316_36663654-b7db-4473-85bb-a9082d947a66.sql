-- Update default member limit to 1024
ALTER TABLE public.groups 
ALTER COLUMN member_limit SET DEFAULT 1024;

-- Update existing groups to have 1024 as limit
UPDATE public.groups 
SET member_limit = 1024 
WHERE member_limit = 500;