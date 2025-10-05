import { supabase } from "@/integrations/supabase/client";

// Types
export interface GenerateTextParams {
  category: string;
  subcategory?: string;
  tone?: string;
  rating?: string;
  insertWords?: string[];
  theme?: string;
}

export interface TextOptionsResponse {
  line: string;
}

export interface GenerateTextResponse {
  options: TextOptionsResponse[];
  model?: string;
  source?: "model" | "fallback";
  req_id?: string;
}

export interface VisualRecommendation {
  title: string;
  subject: string;
  setting: string;
  action: string;
  prop: string;
  camera: "close-up" | "medium" | "wide" | "overhead";
  lens: "24mm" | "35mm" | "50mm";
  lighting: "soft daylight" | "hard flash" | "warm kitchen" | "studio key";
  color: "muted pastels" | "punchy saturated" | "neutral clean";
  composition: "base_realistic" | "very_close" | "zoomed" | "goofy_wide" | "surreal_scale" | "integrated";
  readability: "negative-left" | "negative-right" | "bottom-caption" | "integrated-sign";
  description?: string;
}

export interface GenerateVisualsResponse {
  visuals: VisualRecommendation[];
  model?: string;
  req_id?: string;
  debug?: {
    diversityCheck: boolean;
    compositionCount: number;
  };
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

// Helper function to call edge functions with timeout
async function ctlFetch<T = any>(functionName: string, payload: any): Promise<T> {
  const TIMEOUTS: Record<string, number> = {
    "generate-text": 70000,
    "generate-final-prompt": 120000,
    "generate-visuals": 120000,
    "generate-image": 45000,
    "poll-image-status": 15000,
  };
  const timeoutMs = TIMEOUTS[functionName] ?? 60000;

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timeout (${Math.round(timeoutMs/1000)}s)`)), timeoutMs)
  );

  const call = (async () => {
    const { data, error } = await supabase.functions.invoke(functionName, { body: payload });

    // Non-2xx: surface the actual error body if present
    if (error) {
      const ctx: any = (error as any).context || {};
      let status = (error as any).status || ctx?.status || 0;
      let msg: string | undefined;

      // Supabase often puts the server error JSON into ctx.body (string)
      if (typeof ctx.body === "string" && ctx.body.trim()) {
        try {
          const parsed = JSON.parse(ctx.body);
          msg = parsed?.error || parsed?.message || ctx.body;
          status = parsed?.status || status;
        } catch {
          msg = ctx.body;
        }
      }

      if (!msg) msg = (error as any).message || `Failed to call ${functionName}`;
      throw new Error(`HTTP ${status || '???'} — ${msg}`);
    }

    // Parse string payload if needed
    let body: any = data;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }

    // Edge returned structured failure
    if (body && typeof body === "object" && body.success === false) {
      const s = body.status || 500;
      throw new Error(`HTTP ${s} — ${body.error || `Request failed (${functionName})`}`);
    }

    return body as T;
  })();

  return Promise.race([call, timeout]);
}

// Text generation
export async function generateTextOptions(params: GenerateTextParams): Promise<GenerateTextResponse> {
  const insertWords = Array.isArray(params.insertWords) ? params.insertWords.filter(Boolean).slice(0,2) : [];
  
  // Generate nonce for fresh generation
  const nonce = crypto.randomUUID().slice(0, 8);
  
  const payload = {
    category: params.category || "celebrations",
    subcategory: params.subcategory || "birthday",
    theme: params.theme,
    tone: params.tone || "humorous",
    rating: params.rating || "PG",
    insertWords,
    nonce  // Include in body as backup
  };
  
  // TEMP: switch target function for debugging
  const targetFn = import.meta.env.VITE_USE_TEXT_DEBUG === "true" 
    ? "generate-text-debug" 
    : "generate-text";
  
  // Add nonce to URL as primary method
  const functionUrl = `${targetFn}?nonce=${nonce}`;
  const res = await ctlFetch<any>(functionUrl, payload);
  if (!res?.success || !Array.isArray(res.options) || res.options.length < 1) {
    throw new Error(res?.error || "Generation failed");
  }
  return {
    options: res.options.slice(0, 4).map((line: string) => ({ line })),
    model: res.model,
    source: res.source,
    req_id: res.req_id
  };
}

// Visual generation
export async function generateVisualOptions(params: {
  category: string;
  subcategory?: string;
  tone?: string;
  style?: string;
  layout?: string;
  completed_text: string;
  composition_modes?: string[];
  insertedVisuals?: string[];
}): Promise<GenerateVisualsResponse> {
  const payload = {
    category: params.category || "celebrations",
    subcategory: params.subcategory,
    tone: params.tone || "humorous",
    rating: "PG",
    image_style: params.style || "Auto",
    text_layout: params.layout || "Open Space",
    completed_text: params.completed_text,
    composition_modes: params.composition_modes || [],
    specific_visuals: params.insertedVisuals || [],
    count: 4
  };

  const res = await ctlFetch<any>("generate-visuals", payload);
  if (!res || res.success !== true || !Array.isArray(res.visuals) || res.visuals.length === 0) {
    throw new Error(res?.error || "Visual generation failed");
  }
  
  return {
    visuals: res.visuals,
    model: res.model,
    req_id: res.req_id,
    debug: res.debug
  };
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
  const payload: any = {
    // Required by edge function
    completed_text: (params as any).completed_text ?? params.textLine ?? "",
    image_dimensions: (params as any).image_dimensions ?? (params as any).aspectRatio ?? "square",

    // Optional context
    category: params.category || "celebrations",
    subcategory: params.subcategory,
    tone: params.tone || "humorous",
    rating: params.rating || "PG",
    image_style: ((params as any).image_style ?? params.style) || "Auto",
    text_layout: ((params as any).text_layout ?? params.layout) || "Open Space",
    composition_modes: (params as any).composition_modes,
    visual_recommendation: (params as any).visual_recommendation ?? params.visualScene,
    provider: (params as any).provider || "ideogram",
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
