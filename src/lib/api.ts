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
  rules_id?: string;           // Rules system identifier
};

type GenerateTextResponse = { 
  success: true; 
  options: Array<{line: string}> 
} | { 
  success: false; 
  error: string 
} | {
  lines: Array<{ line: string; length?: number; index?: number; valid?: boolean }>;
  model: string;
  count: number;
} | Array<{line: string}>; // Legacy array format

export type TextOptionsResponse = GenerateTextResponse;

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
  completed_text: string;
  category: string;
  subcategory?: string;
  tone: string;
  rating: "G"|"PG"|"PG-13"|"R";
  insertWords?: string[];
  image_style: "Auto"|"General"|"Realistic"|"Design"|"3D Render"|"Anime";
  visualTaste?: string;
  composition_modes?: string[];
  image_dimensions: "Square"|"Portrait"|"Landscape";
  specific_visuals?: string[];
};

type GenerateVisualsResponse = { success: true; visuals: VisualRecommendation[] } | { success: false; error: string };

type GenerateFinalPromptParams = {
  completed_text: string;
  category: string;
  subcategory?: string;
  tone: string;
  rating: "G"|"PG"|"PG-13"|"R";
  insertWords?: string[];
  image_style: "Auto"|"General"|"Realistic"|"Design"|"3D Render"|"Anime";
  text_layout: string;
  image_dimensions: "square"|"portrait"|"landscape"|"custom";
  composition_modes?: string[];
  visual_recommendation?: string;
  provider?: "gemini" | "ideogram";
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
  image_dimensions?: 'square' | 'portrait' | 'landscape';
  quality?: 'high' | 'medium' | 'low';
  provider?: 'ideogram' | 'gemini';
}

type GenerateImageResponse = {
  success: true;
  imageData: string;
} | {
  success: true;
  jobId: string;
  status: 'pending';
  provider: 'ideogram' | 'openai' | 'gemini';
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

export async function generateTextOptions(params: GenerateTextParams): Promise<TextOptionsResponse> {
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
    userId: params.userId ?? "anonymous",
    rules_id: params.rules_id
  };

  try {
    const res = await ctlFetch<GenerateTextResponse>("generate-text", payload);
    
    // Handle new response format with success and lines
    if (res && typeof res === 'object' && 'success' in res && (res as any).success === true && 'lines' in res) {
      const lines = (res as any).lines;
      if (!Array.isArray(lines) || lines.length === 0) {
        throw new Error("No options returned");
      }
      
      // Handle both string arrays and object arrays - no validation
      const options = lines.map((line: any) => 
        typeof line === 'string' ? { line } : line
      );
      
      return options.slice(0, 4);
    }
    
    // Handle new response format with model information
    if (res && typeof res === 'object' && 'lines' in res && 'model' in res) {
      // New format with model information
      const options = (res as any).lines as Array<{line: string}>;
      if (!Array.isArray(options) || options.length === 0) {
        throw new Error("No options returned");
      }
      
      return res; // Return full response with model info
    }
    
    // Legacy array format
    if (Array.isArray(res)) {
      const options = res as Array<{line: string}>;
      if (options.length === 0) {
        throw new Error("No options returned");
      }
      
      return options.slice(0, 4);
    }
    
    // Handle { options: string[] } format from backend
    if (res && typeof res === 'object' && 'options' in res) {
      const raw = (res as any).options;
      const normalized = Array.isArray(raw)
        ? raw.map((o: any) => (typeof o === 'string' ? { line: o } : o))
        : [];
      if (!normalized.length) throw new Error('No options returned');
      return normalized.slice(0, 4);
    }
    
    // Fallback: check for old response format
    if (!res || (res as any).success !== true) {
      const msg = (res as any)?.error || "Generation failed";
      throw new Error(msg);
    }
    throw new Error("Invalid response format");
  } catch (error: any) {
    // Try once more with slight delay if first attempt fails
    if (error.name !== 'AbortError') {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        const retryRes = await ctlFetch<GenerateTextResponse>("generate-text", payload, 20000);
        
        // Handle { options: string[] } format
        if (retryRes && typeof retryRes === 'object' && 'options' in retryRes) {
          const raw = (retryRes as any).options;
          const normalized = Array.isArray(raw)
            ? raw.map((o: any) => (typeof o === 'string' ? { line: o } : o))
            : [];
          if (normalized.length) return normalized.slice(0, 4);
        }
        
        if (retryRes && (retryRes as any).success === true && Array.isArray((retryRes as any).options)) {
          return (retryRes as any).options.slice(0, 4);
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
    const res = await ctlFetch<GenerateVisualsResponse>("generate-visuals", params, 90000); // 90 second timeout for visual generation
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
    const rawRes = await ctlFetch<GenerateFinalPromptResponse>("generate-final-prompt", params);
    console.log('📥 Raw response from generate-final-prompt:', rawRes);
    
    // Safe parsing: handle both string and object responses
    const res = typeof rawRes === "string" ? JSON.parse(rawRes) : rawRes;
    console.log('🔄 Parsed response:', res);
    
    if (!res || !res.success) {
      console.error('❌ Response validation failed:', { res, hasRes: !!res, success: res?.success });
      const errorMessage = res?.error || "Template generation failed";
      throw new Error(errorMessage);
    }
    
    console.log('✅ Successfully parsed templates:', res.templates);
    return {
      templates: res.templates
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

export async function pollImageStatus(jobId: string, provider: 'ideogram' | 'openai' | 'gemini'): Promise<{
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

// Test function for Gemini API
export async function testGeminiAPI(): Promise<any> {
  try {
    const response = await ctlFetch<any>("test-gemini", {}, 15000);
    return response;
  } catch (error) {
    console.error('Error testing Gemini API:', error);
    throw error;
  }
}