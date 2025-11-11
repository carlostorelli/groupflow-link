-- Create storage bucket for offer images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('offer-images', 'offer-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for offer images
CREATE POLICY "Anyone can view offer images"
ON storage.objects FOR SELECT
USING (bucket_id = 'offer-images');

CREATE POLICY "Authenticated users can upload offer images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'offer-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own offer images"
ON storage.objects FOR DELETE
USING (bucket_id = 'offer-images' AND auth.role() = 'authenticated');