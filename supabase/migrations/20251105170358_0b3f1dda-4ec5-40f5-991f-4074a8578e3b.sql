-- Add subscription fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS storage_limit bigint DEFAULT 1000000000;

-- Create webhook_logs table
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  event text NOT NULL,
  product text,
  processed_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view webhook logs (we'll implement admin role system later)
CREATE POLICY "Authenticated users can view webhook logs"
ON public.webhook_logs
FOR SELECT
TO authenticated
USING (true);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed_at ON public.webhook_logs(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_email ON public.webhook_logs(email);