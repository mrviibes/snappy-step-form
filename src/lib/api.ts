import { supabase } from '@/integrations/supabase/client';

// Standardized type definitions
type GenerateTextParams = {
  category: string;            // "celebrations" or "celebrations > birthday"
  subcategory?: string;        // optional if you use flat category path above
  tone: string;                // Humorous, Savage, ...
  style?: "Generic"|"Sarcastic"|"Wholesome"|"Weird";
  rating: "G"|"PG"|"PG-13"|"R";
  insertWords?: string[];      // prefer array over CSV
  userId?: string;
};

type GenerateTextResponse = { success: true; options: Array<{line: string}> } | { success: false; error: string };

export interface VisualRecommendation {
  visualStyle: string
  layout: string
  description: string
  props: string[]
  interpretation?: string
  palette?: string[]
  mood?: string
}

type GenerateVisualsParams = {
  finalText: string;
  category: string;
  subcategory?: string;
  tone: string;
  textStyle: "Generic"|"Sarcastic"|"Wholesome"|"Weird";
  rating: "G"|"PG"|"PG-13"|"R";
  insertWords?: string[];
  visualStyle: "Auto"|"General"|"Realistic"|"Design"|"3D Render"|"Anime";
  visualTaste?: string;
  insertedVisuals?: string[];
  dimension: "Square"|"Portrait"|"Landscape";
};

type GenerateVisualsResponse = { success: true; visuals: VisualRecommendation[] } | { success: false; error: string };

type GenerateFinalPromptParams = {
  finalText: string;
  category: string;
  subcategory?: string;
  tone: string;
  textStyle: "Generic"|"Sarcastic"|"Wholesome"|"Weird";
  rating: "G"|"PG"|"PG-13"|"R";
  insertWords?: string[];
  visualStyle: "Auto"|"General"|"Realistic"|"Design"|"3D Render"|"Anime";
  layout: string;
  dimension: "Square"|"Portrait"|"Landscape";
  insertedVisuals?: string[];
};

type GenerateFinalPromptResponse = { 
  success: true; 
  templates: Array<{
    name: string;
    positive: string;
    negative: string;
    description: string;
  }>; 
} | { 
  success: false; 
  error: string; 
};

export interface GenerateImageParams {
  prompt: string;
  negativePrompt?: string;
  dimension?: 'square' | 'portrait' | 'landscape';
  quality?: 'high' | 'medium' | 'low';
}

type GenerateImageResponse = {
  success: true;
  imageData: string;
} | {
  success: true;
  jobId: string;
  status: 'pending';
  provider: 'ideogram' | 'openai';
} | {
  success: false;
  error: string;
};

// Controlled fetch with timeout and abort
const ctlFetch = async <T>(fn: string, body: any, timeoutMs = 30000): Promise<T> => {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
  );
  
  try {
    const invokePromise = supabase.functions.invoke(fn, { body });
    const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as any;
    if (error) throw error;
    return (data as T) ?? ({} as T);
  } catch (error) {
    throw error;
  }
};

export async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await ctlFetch<{ ok: boolean }>("health", {});
    return !!res.ok;
  } catch {
    return false;
  }
}

export async function getServerModels(): Promise<{ text: string; visuals: string; images: string } | null> {
  try {
    const res = await ctlFetch<{ ok: boolean; models?: { text: string; visuals: string; images: string } }>("health", {});
    return res.models || null;
  } catch {
    return null;
  }
}

export async function generateTextOptions(params: GenerateTextParams): Promise<Array<{line: string}>> {
  // Normalize insertWords to array
  const insertWords = Array.isArray(params.insertWords)
    ? params.insertWords.filter(Boolean)
    : params.insertWords ? [params.insertWords as unknown as string] : [];

  const categoryPath = params.subcategory
    ? `${params.category || "celebrations"} > ${params.subcategory}`
    : (params.category || "celebrations");

  const payload = {
    category: categoryPath,
    tone: params.tone,
    style: params.style || "Generic",
    rating: params.rating || "PG",
    insertWords,                          // consistent name and array
    userId: params.userId ?? "anonymous"
  };

  try {
    const res = await ctlFetch<GenerateTextResponse>("generate-text", payload);
    
    // The edge function returns a direct array of {line} objects
    if (Array.isArray(res)) {
      const options = res as Array<{line: string}>;
      if (options.length === 0) {
        throw new Error("No options returned");
      }
      
      // Client-side guard: ensure basic validation
      const validated = options.filter(o => o?.line && o.line.length >= 50 && o.line.length <= 120);
      if (validated.length === 0) {
        throw new Error("All generated options failed validation");
      }
      
      return validated.slice(0, 4);
    }
    
    // Fallback: check for old response format
    if (!res || (res as any).success !== true) {
      const msg = (res as any)?.error || "Generation failed";
      throw new Error(msg);
    }
    const options = (res as any).options as Array<{line: string}>;
    if (!Array.isArray(options) || options.length === 0) {
      throw new Error("No options returned");
    }
    
    // Client-side guard: ensure basic validation
    const validated = options.filter(o => o?.line && o.line.length >= 50 && o.line.length <= 120);
    if (validated.length === 0) {
      throw new Error("All generated options failed validation");
    }
    
    return validated.slice(0, 4);
  } catch (error: any) {
    // Try once more with slight delay if first attempt fails
    if (error.name !== 'AbortError') {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        const retryRes = await ctlFetch<GenerateTextResponse>("generate-text", payload, 20000);
        if (retryRes && (retryRes as any).success === true) {
          const retryOptions = (retryRes as any).options as Array<{line: string}>;
          const validated = retryOptions.filter(o => o?.line && o.line.length >= 50 && o.line.length <= 120);
          if (validated.length > 0) {
            return validated.slice(0, 4);
          }
        }
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }
    
    console.error('Text generation failed:', error);
    throw error;
  }
}

export async function generateVisualOptions(params: GenerateVisualsParams): Promise<VisualRecommendation[]> {
  try {
    const res = await ctlFetch<GenerateVisualsResponse>("generate-visuals", params);
    if (!res || (res as any).success !== true) {
      throw new Error((res as any)?.error || "Visual generation failed");
    }
    const visuals = (res as any).visuals as VisualRecommendation[];
    if (!Array.isArray(visuals) || visuals.length === 0) {
      throw new Error("No visuals returned");
    }
    return visuals.slice(0, 4);
  } catch (error) {
    console.error('Visual generation failed:', error);
    throw error;
  }
}

// Generate 4 prompt templates for Step-4
export async function generateFinalPrompt(params: GenerateFinalPromptParams): Promise<{templates: Array<{name: string, positive: string, negative: string, description: string}>}> {
  try {
    const res = await ctlFetch<GenerateFinalPromptResponse>("generate-final-prompt", params);
    if (!res || !(res as any).success) {
      throw new Error((res as any)?.error || "Template generation failed");
    }
    return {
      templates: (res as any).templates
    };
  } catch (error) {
    console.error('Template generation failed:', error);
    throw error;
  }
}

// Generate image using Ideogram V3
export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResponse> {
  try {
    const response = await ctlFetch<GenerateImageResponse>("generate-image", params, 60000);
    return response;
  } catch (error) {
    console.error('Error generating image:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate image');
  }
}

export async function pollImageStatus(jobId: string, provider: 'ideogram' | 'openai'): Promise<{
  success: boolean;
  status: 'pending' | 'completed' | 'failed';
  imageData?: string;
  error?: string;
  progress?: number;
}> {
  try {
    const response = await ctlFetch<{
      success: boolean;
      status: 'pending' | 'completed' | 'failed';
      imageData?: string;
      error?: string;
      progress?: number;
    }>("poll-image-status", { jobId, provider }, 15000);
    return response;
  } catch (error) {
    console.error('Error polling image status:', error);
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Failed to poll image status'
    };
  }
}