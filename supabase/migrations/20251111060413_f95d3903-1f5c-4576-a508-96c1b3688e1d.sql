-- Drop existing table if it exists to clean up
DROP TABLE IF EXISTS public.automation_runs CASCADE;

-- Create automation_runs table for locking and interval control
CREATE TABLE public.automation_runs (
  automation_id UUID PRIMARY KEY REFERENCES public.automations(id) ON DELETE CASCADE,
  last_sent_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  lock_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their automation runs"
  ON public.automation_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_runs.automation_id
      AND automations.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage automation runs"
  ON public.automation_runs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add index for deduplication on dispatch_logs (simple index without time filter)
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_dedup
  ON public.dispatch_logs (automation_id, product_url, created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_automation_runs_updated_at
  BEFORE UPDATE ON public.automation_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();