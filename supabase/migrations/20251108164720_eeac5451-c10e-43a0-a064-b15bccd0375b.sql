-- Add unique constraint for instance_id and user_id combination to support upsert
-- This allows the same instance_id to be used by different users, but each user can only have one instance with that name

-- First, check if there's an existing unique constraint on just instance_id and drop it
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'instances_instance_id_key'
  ) THEN
    ALTER TABLE public.instances DROP CONSTRAINT instances_instance_id_key;
  END IF;
END $$;

-- Add unique constraint on the combination of instance_id and user_id
ALTER TABLE public.instances 
ADD CONSTRAINT instances_instance_id_user_id_key 
UNIQUE (instance_id, user_id);