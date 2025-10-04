-- Fix gen_history RLS policies for security

-- Drop the insecure SELECT policy that exposes anonymous data
DROP POLICY IF EXISTS "Users can view their own generation history" ON public.gen_history;

-- Create secure SELECT policy: users can only view their own records
CREATE POLICY "Users can view their own generation history" 
ON public.gen_history 
FOR SELECT 
USING (auth.uid()::text = user_id);

-- Add UPDATE policy: users can only update their own records
CREATE POLICY "Users can update their own generation history" 
ON public.gen_history 
FOR UPDATE 
USING (auth.uid()::text = user_id);

-- Add DELETE policy: users can only delete their own records
CREATE POLICY "Users can delete their own generation history" 
ON public.gen_history 
FOR DELETE 
USING (auth.uid()::text = user_id);