-- Create table for generation history to ensure uniqueness
CREATE TABLE public.gen_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  category TEXT NOT NULL,
  tone TEXT NOT NULL,
  style TEXT NOT NULL,
  rating TEXT NOT NULL,
  insert_words JSONB,
  text_out TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.gen_history ENABLE ROW LEVEL SECURITY;

-- Create policies for accessing generation history
CREATE POLICY "Users can view their own generation history" 
ON public.gen_history 
FOR SELECT 
USING (auth.uid()::text = user_id OR user_id IS NULL);

CREATE POLICY "System can insert generation history" 
ON public.gen_history 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_gen_history_user_created ON public.gen_history (user_id, created_at DESC);
CREATE INDEX idx_gen_history_text_hash ON public.gen_history (text_hash);
CREATE INDEX idx_gen_history_created ON public.gen_history (created_at DESC);