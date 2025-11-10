-- Create enum types for automations
CREATE TYPE automation_mode AS ENUM ('search', 'monitor');
CREATE TYPE automation_status AS ENUM ('active', 'paused');
CREATE TYPE priority_type AS ENUM ('discount', 'price');
CREATE TYPE filter_type AS ENUM ('light', 'heavy');
CREATE TYPE store_key AS ENUM ('shopee', 'amazon', 'magalu', 'ml', 'shein', 'aliexpress');
CREATE TYPE dispatch_status AS ENUM ('sent', 'skipped', 'error');

-- Table: automations
CREATE TABLE public.automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode automation_mode NOT NULL DEFAULT 'search',
  start_time TEXT NOT NULL DEFAULT '00:01',
  end_time TEXT NOT NULL DEFAULT '23:59',
  interval_minutes INTEGER NOT NULL DEFAULT 30 CHECK (interval_minutes >= 5 AND interval_minutes <= 120),
  send_groups TEXT[] NOT NULL DEFAULT '{}',
  monitor_groups TEXT[] DEFAULT '{}',
  stores store_key[] NOT NULL DEFAULT '{}',
  categories TEXT[] NOT NULL DEFAULT '{}',
  priority priority_type NOT NULL DEFAULT 'discount',
  filter_type filter_type NOT NULL DEFAULT 'light',
  min_discount INTEGER CHECK (min_discount >= 0 AND min_discount <= 100),
  min_price NUMERIC(10,2) CHECK (min_price >= 0),
  max_price NUMERIC(10,2) CHECK (max_price >= 0),
  texts TEXT[] NOT NULL DEFAULT '{}',
  ctas TEXT[] NOT NULL DEFAULT '{}',
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  status automation_status NOT NULL DEFAULT 'active',
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: affiliate_credentials
CREATE TABLE public.affiliate_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store store_key NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',
  auto_generate BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, store)
);

-- Table: deals (cache de ofertas encontradas)
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  store store_key NOT NULL,
  title TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  old_price NUMERIC(10,2),
  discount INTEGER,
  image_url TEXT,
  product_url TEXT NOT NULL,
  category TEXT,
  affiliate_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: dispatch_logs
CREATE TABLE public.dispatch_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  automation_name TEXT NOT NULL,
  store store_key NOT NULL,
  group_id TEXT NOT NULL,
  group_name TEXT,
  product_url TEXT NOT NULL,
  affiliate_url TEXT,
  status dispatch_status NOT NULL DEFAULT 'sent',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automations
CREATE POLICY "Users can view their own automations"
  ON public.automations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own automations"
  ON public.automations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own automations"
  ON public.automations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own automations"
  ON public.automations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for affiliate_credentials
CREATE POLICY "Users can view their own credentials"
  ON public.affiliate_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own credentials"
  ON public.affiliate_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credentials"
  ON public.affiliate_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credentials"
  ON public.affiliate_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for deals
CREATE POLICY "Users can view their own deals"
  ON public.deals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deals"
  ON public.deals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deals"
  ON public.deals FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for dispatch_logs
CREATE POLICY "Users can view their own logs"
  ON public.dispatch_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own logs"
  ON public.dispatch_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_automations_user_id ON public.automations(user_id);
CREATE INDEX idx_automations_status ON public.automations(status);
CREATE INDEX idx_automations_next_run ON public.automations(next_run_at);
CREATE INDEX idx_affiliate_credentials_user_store ON public.affiliate_credentials(user_id, store);
CREATE INDEX idx_deals_automation ON public.deals(automation_id);
CREATE INDEX idx_deals_created_at ON public.deals(created_at);
CREATE INDEX idx_dispatch_logs_user ON public.dispatch_logs(user_id);
CREATE INDEX idx_dispatch_logs_automation ON public.dispatch_logs(automation_id);
CREATE INDEX idx_dispatch_logs_created_at ON public.dispatch_logs(created_at);

-- Triggers for updated_at
CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_affiliate_credentials_updated_at
  BEFORE UPDATE ON public.affiliate_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();