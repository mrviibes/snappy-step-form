-- Create visual_history table to store visual generation data separately from text generation
CREATE TABLE public.visual_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  final_text TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  tone TEXT NOT NULL,
  text_style TEXT NOT NULL,
  rating TEXT NOT NULL,
  insert_words TEXT[] DEFAULT '{}',
  visual_style TEXT NOT NULL,
  generated_visuals JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.visual_history ENABLE ROW LEVEL SECURITY;

-- Create policies for visual_history (for now, allow all operations since we don't have auth yet)
CREATE POLICY "Allow all operations on visual_history" 
ON public.visual_history 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create index for better performance on queries
CREATE INDEX idx_visual_history_created_at ON public.visual_history(created_at DESC);
CREATE INDEX idx_visual_history_category ON public.visual_history(category);
CREATE INDEX idx_visual_history_final_text ON public.visual_history USING gin(to_tsvector('english', final_text));