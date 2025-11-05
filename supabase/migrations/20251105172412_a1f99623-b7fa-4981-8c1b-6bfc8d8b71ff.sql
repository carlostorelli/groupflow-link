-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table for admin management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create plans table
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly DECIMAL(10,2),
  price_semester DECIMAL(10,2),
  price_annual DECIMAL(10,2),
  group_limit INTEGER NOT NULL DEFAULT 1,
  storage_limit BIGINT NOT NULL DEFAULT 1000000000,
  features JSONB DEFAULT '[]'::jsonb,
  kiwify_product_id_monthly TEXT,
  kiwify_product_id_semester TEXT,
  kiwify_product_id_annual TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on plans
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- RLS policies for plans
CREATE POLICY "Everyone can view active plans"
ON public.plans
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage plans"
ON public.plans
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create settings table for API configurations
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for settings
CREATE POLICY "Admins can manage settings"
ON public.settings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Add phone_number to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Create trigger for plans updated_at
CREATE TRIGGER update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Insert default plans
INSERT INTO public.plans (name, slug, description, price_monthly, price_semester, price_annual, group_limit, storage_limit, features)
VALUES 
  ('Free', 'free', 'Plano gratuito básico', 0, 0, 0, 1, 1000000000, '["Acesso básico", "1 grupo"]'::jsonb),
  ('Starter', 'starter', 'Plano inicial para começar', 29.90, 149.90, 269.90, 5, 5000000000, '["5 grupos", "5GB de armazenamento", "Suporte por email"]'::jsonb),
  ('Pro', 'pro', 'Plano profissional completo', 79.90, 419.90, 749.90, 20, 15000000000, '["20 grupos", "15GB de armazenamento", "Suporte prioritário", "Ferramentas AI"]'::jsonb),
  ('Master', 'master', 'Plano avançado ilimitado', 149.90, 799.90, 1499.90, 100, 50000000000, '["100 grupos", "50GB de armazenamento", "Suporte 24/7", "Todas as ferramentas AI", "Recursos avançados"]'::jsonb);