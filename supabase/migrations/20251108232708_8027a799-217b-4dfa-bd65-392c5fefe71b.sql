-- Create action history table
CREATE TABLE IF NOT EXISTS public.action_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  target_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.action_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own action history"
  ON public.action_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own action history"
  ON public.action_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own action history"
  ON public.action_history
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_action_history_user_id ON public.action_history(user_id);
CREATE INDEX idx_action_history_created_at ON public.action_history(created_at DESC);
CREATE INDEX idx_action_history_status ON public.action_history(status);