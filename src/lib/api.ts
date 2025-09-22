import { supabase } from '@/integrations/supabase/client';

// Standardized type definitions
type GenerateTextParams = {
  category: string;            // "celebrations" or "celebrations > birthday"
  subcategory?: string;        // optional if you use flat category path above
  tone: string;                // Humorous, Savage, ...
  style: "Generic"|"Sarcastic"|"Wholesome"|"Weird";
  rating: "G"|"PG"|"PG-13"|"R";
  insertWords?: string[];      // prefer array over CSV
  comedianStyle?: { name: string; flavor: string } | null;
  userId?: string;
};

type GenerateTextResponse = { success: true; options: string[] } | { success: false; error: string };

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
  subSubcategory?: string | null;
  tone: string;
  textStyle: "Generic"|"Sarcastic"|"Wholesome"|"Weird";
  rating: "G"|"PG"|"PG-13"|"R";
  insertWords?: string[];
  visualStyle: "Auto"|"General"|"Realistic"|"Design"|"3D Render"|"Anime";
  visualTaste?: string;
  customVisuals?: string[];
  dimension: "Square"|"Portrait"|"Landscape";
};

type GenerateVisualsResponse = { success: true; visuals: VisualRecommendation[] } | { success: false; error: string };

// Controlled fetch with timeout and abort
const ctlFetch = async <T>(fn: string, body: any, timeoutMs = 15000): Promise<T> => {
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

export async function generateTextOptions(params: GenerateTextParams): Promise<string[]> {
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
    comedianStyle: params.comedianStyle ?? null,
    userId: params.userId ?? "anonymous"
  };

  try {
    const res = await ctlFetch<GenerateTextResponse>("generate-text", payload);
    if (!res || (res as any).success !== true) {
      const msg = (res as any)?.error || "Generation failed";
      throw new Error(msg);
    }
    const options = (res as any).options as string[];
    if (!Array.isArray(options) || options.length === 0) {
      throw new Error("No options returned");
    }
    
    // Client-side guard: ensure basic validation
    const validated = options.filter(s => s && s.length >= 50 && s.length <= 120);
    if (validated.length === 0) {
      throw new Error("All generated options failed validation");
    }
    
    return validated.slice(0, 4);
  } catch (error: any) {
    // Try once more with slight delay if first attempt fails
    if (error.name !== 'AbortError') {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        const retryRes = await ctlFetch<GenerateTextResponse>("generate-text", payload, 10000);
        if (retryRes && (retryRes as any).success === true) {
          const retryOptions = (retryRes as any).options as string[];
          const validated = retryOptions.filter(s => s && s.length >= 50 && s.length <= 120);
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