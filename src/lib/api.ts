import { supabase } from "@/integrations/supabase/client";
import { STYLE_DEFS, type ComedyStyleId } from "@/lib/comedyStyles";

// Normalizers
const toTitle = (s?: string) =>
  (s || "").trim().toLowerCase().replace(/^\w/, c => c.toUpperCase());

const CANON_TONES = new Set(["Humorous","Savage","Sentimental","Inspirational"]);
const CANON_RATINGS = new Set(["G","PG","PG-13","R"]);

function canonTone(s?: string): string {
  const t = toTitle(s);
  return CANON_TONES.has(t) ? t : "Humorous";
}
function canonRating(s?: string): string {
  const r = (s || "").toUpperCase();
  return CANON_RATINGS.has(r) ? r : "PG";
}
function canonStyle(s?: string): ComedyStyleId | undefined {
  return s && (s in STYLE_DEFS) ? s as ComedyStyleId : undefined;
}

// Types
export interface GenerateTextParams {
  category: string;
  subcategory?: string;
  tone?: string;
  rating?: string;
  insertWords?: string[];
  theme?: string;
  styleId?: ComedyStyleId;
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

// Types for visual generation
export interface GenerateVisualsParams {
  topics: string[];              // from Step 1 tags
  text: string;                  // final selected line from Step 2
  optional_visuals?: string[];   // optional user-added visual tags
  composition?: "Normal" | "Big-Head" | "Close-Up" | "Goofy" | "Zoomed" | "Surreal";
  subjectScene?: string;         // concrete scene description
}

export interface VisualOption {
  design: string;
  subject: string;
  setting: string;
}

export interface GenerateVisualsResponse {
  success: boolean;
  model?: string;
  visuals: VisualOption[];
  source?: string;
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
    "generate-text": 26000,
    "generate-final-prompt": 26000,
    "generate-visuals": 26000,
    "generate-image": 26000,
    "poll-image-status": 15000,
  };
  const timeoutMs = TIMEOUTS[functionName] ?? 26000;

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
  
  // Safety check: ensure category/subcategory are always provided
  if (!params.category && !params.subcategory) {
    params.category = "misc";
    params.subcategory = "general";
  }
  
  const nonce = crypto.randomUUID().slice(0, 8);
  
  const payload = {
    category: params.category || "misc",
    subcategory: params.subcategory || "general",
    theme: params.theme,
    tone: canonTone(params.tone),
    rating: canonRating(params.rating),
    insertWords,
    styleId: canonStyle(params.styleId),
    nonce
  };
  
  const targetFn = import.meta.env.VITE_USE_TEXT_DEBUG === "true" 
    ? "generate-text-debug" 
    : "generate-text";
  
  const res = await ctlFetch<any>(targetFn, payload);
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
export async function generateVisualOptions(params: GenerateVisualsParams): Promise<GenerateVisualsResponse> {
  const { data, error } = await supabase.functions.invoke("generate-visuals", { 
    body: {
      topics: params.topics || [],
      text: params.text || "",
      optional_visuals: params.optional_visuals || [],
      composition: params.composition || "Normal",
      subjectScene: params.subjectScene || ""
    }
  });

  if (error) {
    const ctx: any = (error as any).context || {};
    const msg = ctx?.body || (error as any).message || "Visual generation failed";
    throw new Error(typeof msg === "string" ? msg : "Visual generation failed");
  }

  const body = typeof data === "string" ? JSON.parse(data) : data;
  if (!body?.success || !Array.isArray(body.visuals)) {
    throw new Error(body?.error || "Visual generation failed");
  }
  // hard ensure only 4 lines
  body.visuals = body.visuals.slice(0, 4);
  return body as GenerateVisualsResponse;
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
