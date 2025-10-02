import { supabase } from "@/integrations/supabase/client";

// Types
export interface GenerateTextParams {
  category: string;
  subcategory?: string;
  tone?: string;
  rating?: string;
  insertWords?: string[];
  gender?: string;
}

export interface TextOptionsResponse {
  line: string;
}

export interface VisualRecommendation {
  scene: string;
  composition: string;
  description?: string;
  interpretation?: string;
}

export interface PromptTemplate {
  name: string;
  positive: string;
  negative: string;
  description: string;
}

export interface GenerateImageResponse {
  success: boolean;
  imageData?: string;
  jobId?: string;
  provider?: 'ideogram' | 'openai' | 'gemini';
  error?: string;
}

export interface PollImageStatusResponse {
  success: boolean;
  status: string;
  imageData?: string;
  error?: string;
  progress?: number;
}

// Helper function to call edge functions
async function ctlFetch<T>(functionName: string, payload: any): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
  });

  if (error) {
    console.error(`Error calling ${functionName}:`, error);
    const detailed = (error as any)?.context?.body || error.message || `Failed to call ${functionName}`;
    // Try to extract JSON error.message if body is JSON
    try {
      const parsed = typeof detailed === 'string' ? JSON.parse(detailed) : detailed;
      const msg = parsed?.error || parsed?.message || detailed;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } catch {
      throw new Error(typeof detailed === 'string' ? detailed : JSON.stringify(detailed));
    }
  }

  return data as T;
}

// Text generation
export async function generateTextOptions(params: GenerateTextParams): Promise<TextOptionsResponse[]> {
  const insertWords = Array.isArray(params.insertWords)
    ? params.insertWords.filter(Boolean)
    : params.insertWords ? [params.insertWords as unknown as string] : [];

  const payload = {
    category: params.category || "celebrations",
    subcategory: params.subcategory,
    tone: params.tone,
    rating: params.rating || "PG",
    insertWords,
    gender: params.gender || "neutral"
  };

  const res = await ctlFetch<any>("generate-text", payload);
  if (!res || res.success !== true || !Array.isArray(res.options) || res.options.length === 0) {
    throw new Error(res?.error || "Generation failed");
  }
  return res.options.slice(0, 4).map((line: string) => ({ line }));
}

// Visual generation
export async function generateVisualOptions(params: {
  category: string;
  subcategory?: string;
  tone?: string;
  style?: string;
  layout?: string;
}): Promise<VisualRecommendation[]> {
  const payload = {
    category: params.category || "celebrations",
    subcategory: params.subcategory,
    tone: params.tone || "humorous",
    style: params.style || "Auto",
    layout: params.layout || "Open Space",
  };

  const res = await ctlFetch<any>("generate-visuals", payload);
  if (!res || res.success !== true || !Array.isArray(res.visuals) || res.visuals.length === 0) {
    throw new Error(res?.error || "Visual generation failed");
  }
  return res.visuals.slice(0, 3).map((visual: any) => ({
    scene: visual.scene || visual,
    composition: visual.composition || "",
  }));
}

// Final prompt generation
export async function generateFinalPrompt(params: {
  category: string;
  subcategory?: string;
  tone?: string;
  rating?: string;
  style?: string;
  layout?: string;
  textLine?: string;
  visualScene?: string;
}): Promise<{ templates: PromptTemplate[] }> {
  const payload = {
    category: params.category || "celebrations",
    subcategory: params.subcategory,
    tone: params.tone || "humorous",
    rating: params.rating || "PG",
    style: params.style || "Auto",
    layout: params.layout || "Open Space",
    textLine: params.textLine,
    visualScene: params.visualScene,
  };

  const res = await ctlFetch<any>("generate-final-prompt", payload);
  if (!res || res.success !== true || !Array.isArray(res.templates) || res.templates.length === 0) {
    throw new Error(res?.error || "Prompt generation failed");
  }
  return { templates: res.templates };
}

// Image generation
export async function generateImage(params: {
  prompt?: string;
  positivePrompt?: string;
  negativePrompt?: string;
  style?: string;
  aspectRatio?: string;
  image_dimensions?: string;
  quality?: string;
  provider?: string;
}): Promise<GenerateImageResponse> {
  const payload = {
    prompt: params.prompt || params.positivePrompt || "",
    positivePrompt: params.prompt || params.positivePrompt || "",
    negativePrompt: params.negativePrompt || "",
    style: params.style || "Auto",
    aspectRatio: params.aspectRatio || "ASPECT_1_1",
    image_dimensions: params.image_dimensions,
    quality: params.quality,
    provider: params.provider,
  };

  const res = await ctlFetch<GenerateImageResponse>("generate-image", payload);
  return res;
}

// Poll image status
export async function pollImageStatus(jobId: string, provider: string): Promise<PollImageStatusResponse> {
  const res = await ctlFetch<PollImageStatusResponse>("poll-image-status", {
    jobId,
    provider,
  });
  return res;
}
