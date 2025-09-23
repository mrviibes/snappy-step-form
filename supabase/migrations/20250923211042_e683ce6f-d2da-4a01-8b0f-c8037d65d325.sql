-- Fix security vulnerability in visual_history table
-- Add user_id column to track ownership and implement proper RLS policies

-- First, add user_id column to visual_history table
ALTER TABLE public.visual_history 
ADD COLUMN user_id text;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow all operations on visual_history" ON public.visual_history;

-- Create secure RLS policies that match the pattern used in gen_history
CREATE POLICY "Users can view their own visual history" 
ON public.visual_history 
FOR SELECT 
USING (((auth.uid())::text = user_id) OR (user_id IS NULL));

CREATE POLICY "Users can insert their own visual history" 
ON public.visual_history 
FOR INSERT 
WITH CHECK (((auth.uid())::text = user_id) OR (user_id IS NULL));

CREATE POLICY "Users can update their own visual history" 
ON public.visual_history 
FOR UPDATE 
USING (((auth.uid())::text = user_id) OR (user_id IS NULL))
WITH CHECK (((auth.uid())::text = user_id) OR (user_id IS NULL));

CREATE POLICY "Users can delete their own visual history" 
ON public.visual_history 
FOR DELETE 
USING (((auth.uid())::text = user_id) OR (user_id IS NULL));

-- Create index for better performance on user_id queries
CREATE INDEX IF NOT EXISTS idx_visual_history_user_id ON public.visual_history(user_id);