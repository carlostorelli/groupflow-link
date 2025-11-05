-- Create enum for user plans
CREATE TYPE public.user_plan AS ENUM ('free', 'pro', 'elite');

-- Create enum for instance status
CREATE TYPE public.instance_status AS ENUM ('connected', 'disconnected', 'pending');

-- Create enum for group status
CREATE TYPE public.group_status AS ENUM ('open', 'closed', 'full');

-- Create enum for job status
CREATE TYPE public.job_status AS ENUM ('pending', 'running', 'done', 'failed');

-- Create enum for job action types
CREATE TYPE public.job_action_type AS ENUM ('send_message', 'update_description', 'close_groups', 'open_groups');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  plan public.user_plan NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create instances table
CREATE TABLE public.instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  status public.instance_status NOT NULL DEFAULT 'pending',
  qr_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, instance_id)
);

-- Enable RLS on instances
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

-- Instances policies
CREATE POLICY "Users can view their own instances"
  ON public.instances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own instances"
  ON public.instances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own instances"
  ON public.instances FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own instances"
  ON public.instances FOR DELETE
  USING (auth.uid() = user_id);

-- Create groups table
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  wa_group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  members_count INTEGER NOT NULL DEFAULT 0,
  member_limit INTEGER NOT NULL DEFAULT 500,
  status public.group_status NOT NULL DEFAULT 'open',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(instance_id, wa_group_id)
);

-- Enable RLS on groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Groups policies
CREATE POLICY "Users can view their own groups"
  ON public.groups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own groups"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own groups"
  ON public.groups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own groups"
  ON public.groups FOR DELETE
  USING (auth.uid() = user_id);

-- Create redirect_links table
CREATE TABLE public.redirect_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on redirect_links
ALTER TABLE public.redirect_links ENABLE ROW LEVEL SECURITY;

-- Redirect links policies
CREATE POLICY "Users can view their own redirect links"
  ON public.redirect_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own redirect links"
  ON public.redirect_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own redirect links"
  ON public.redirect_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own redirect links"
  ON public.redirect_links FOR DELETE
  USING (auth.uid() = user_id);

-- Allow public access to redirect links for the redirection feature
CREATE POLICY "Anyone can view active redirect links"
  ON public.redirect_links FOR SELECT
  USING (is_active = true);

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type public.job_action_type NOT NULL,
  payload JSONB NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status public.job_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Jobs policies
CREATE POLICY "Users can view their own jobs"
  ON public.jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs"
  ON public.jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_instances
  BEFORE UPDATE ON public.instances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_groups
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_redirect_links
  BEFORE UPDATE ON public.redirect_links
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_jobs
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();