interface GenerateTextParams {
  tone: string
  category?: string
  subcategory?: string
  specificWords?: string[]
  style?: string
  rating?: string
  comedianStyle?: string
}

interface GenerateTextResponse {
  success: boolean
  options: string[]
  model: string
  error?: string
}

export interface VisualRecommendation {
  visualStyle: string
  layout: string
  description: string
  props: string[]
  interpretation?: string
  palette?: string[]
  mood?: string
}

interface GenerateVisualsParams {
  finalText: string
  category: string
  subcategory?: string
  subSubcategory?: string
  tone: string
  textStyle: string
  rating: string
  insertWords?: string[]
  visualStyle: string
  visualTaste?: string
  customVisuals?: string[]
  dimension?: string
}

interface GenerateVisualsResponse {
  success: boolean
  visuals: VisualRecommendation[]
  model: string
  error?: string
}

interface HealthResponse {
  ok: boolean
  error?: string
}

// Get Supabase URL from the environment or use localhost for development
// NOTE: Lovable does not support VITE_* envs in preview. Prefer supabase.functions.invoke.
import { supabase } from '@/integrations/supabase/client';

export async function checkServerHealth(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('health', { body: {} });
    if (error) return false;
    const payload = (data as any) || {};
    return !!payload.ok;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

export async function generateTextOptions(params: GenerateTextParams): Promise<string[]> {
  try {
    // Translate frontend params to edge function input
    const mandatory_words = Array.isArray(params.specificWords)
      ? params.specificWords.join(', ')
      : (params.specificWords as any) || '';

    const categoryPath = params.subcategory
      ? `${params.category || 'celebrations'} > ${params.subcategory}`
      : (params.category || 'celebrations');

    const { data, error } = await supabase.functions.invoke('generate-text', {
      body: {
        category: categoryPath,
        tone: params.tone,
        style: params.style || 'Generic',
        rating: params.rating || 'PG',
        mandatory_words,
      },
    });

    if (error) throw error;
    const payload = (data as any) || {};

    // Support both shapes: { options } or { success, options }
    const options: string[] = payload.options || [];
    if (!options || options.length === 0) {
      throw new Error(payload.error || 'No options returned');
    }
    return options;
  } catch (error) {
    console.error('Text generation failed:', error);
    throw error;
  }
}

export async function generateVisualOptions(params: GenerateVisualsParams): Promise<VisualRecommendation[]> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-visuals', {
      body: params,
    });
    if (error) throw error;
    const payload = (data as any) || {};
    const visuals: VisualRecommendation[] = payload.visuals || payload || [];
    if (!Array.isArray(visuals) || visuals.length === 0) {
      throw new Error(payload.error || 'Visual generation failed');
    }
    return visuals;
  } catch (error) {
    console.error('Visual generation failed:', error);
    throw error;
  }
}