-- Adicionar novos valores ao enum job_action_type
ALTER TYPE job_action_type ADD VALUE IF NOT EXISTS 'change_group_name';
ALTER TYPE job_action_type ADD VALUE IF NOT EXISTS 'change_group_photo';