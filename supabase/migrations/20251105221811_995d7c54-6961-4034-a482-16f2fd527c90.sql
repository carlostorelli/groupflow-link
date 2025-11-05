-- Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create table for saved redirect links with click tracking
CREATE TABLE IF NOT EXISTS public.saved_redirect_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  group_priorities JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_redirect_links ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own redirect links" 
ON public.saved_redirect_links 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own redirect links" 
ON public.saved_redirect_links 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own redirect links" 
ON public.saved_redirect_links 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own redirect links" 
ON public.saved_redirect_links 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_saved_redirect_links_updated_at
BEFORE UPDATE ON public.saved_redirect_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for redirect link clicks
CREATE TABLE IF NOT EXISTS public.redirect_link_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id UUID NOT NULL REFERENCES public.saved_redirect_links(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address TEXT
);

-- Enable RLS for clicks
ALTER TABLE public.redirect_link_clicks ENABLE ROW LEVEL SECURITY;

-- Policy to allow tracking clicks (anyone can insert)
CREATE POLICY "Anyone can track clicks" 
ON public.redirect_link_clicks 
FOR INSERT 
WITH CHECK (true);

-- Policy for users to view clicks on their links
CREATE POLICY "Users can view clicks on their links" 
ON public.redirect_link_clicks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.saved_redirect_links 
    WHERE saved_redirect_links.id = redirect_link_clicks.link_id 
    AND saved_redirect_links.user_id = auth.uid()
  )
);