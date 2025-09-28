import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  final_prompt_rules_gemini,
  layoutTagShort,
  dimensionMap,
  toneMap,
  ratingMap,
  textQualityNegatives,
  getCategoryNegatives
} from "../_shared/final-prompt-rules.ts";

// ============== MODEL ==============
const getFinalPromptModel = () =>
  Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o-mini";
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

// ============== CORS ==============
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============== INTERFACES ==============
interface FinalPromptRequest {
  completed_text: string;
  category?: string;
  subcategory?: string;
  tone?: string;
  rating?: string;
  insertWords?: string[];
  image_style?: string;        // e.g., "realistic", "illustrated"
  text_layout?: string;        // can be "auto" or one of our six; if absent we still return all six
  image_dimensions?: "square" | "portrait" | "landscape" | "custom";
  composition_modes?: string[]; // optional, e.g., ["very_close"]
  visual_recommendation?: string;
}

interface PromptTemplate {
  name: string;
  positive: string;
  negative: string;
  description: string;
}

// ============== COMPOSITION MODELS (six) ==============
const compositionModels: Record<string, { positive: string; negative: string; label: string }> = {
  base_realistic: {
    label: "Base Realistic",
    positive: "photoreal composition, natural anatomy and proportions, coherent lighting and perspective",
    negative: "distorted anatomy, warped perspective, surreal limbs, extra fingers, rubbery faces"
  },
  exaggerated_props: {
    label: "Exaggerated Proportions",
    positive: "stylized anatomy with elongated limbs or oversized features, playful silhouette, consistent joint anatomy",
    negative: "broken joints, melted limbs, off-model faces"
  },
  tiny_head: {
    label: "Tiny-Head",
    positive: "intentionally small head (15–25% of normal), clean neck transition, confident posture",
    negative: "oversized head, missing neck, headless, floating head, grotesque deformation"
  },
  very_close: {
    label: "Very Close",
    positive: "close-up or mid-close framing with subject dominant, shallow depth of field, clean background, crisp edge lighting",
    negative: "busy background, cut-off features, awkward crop, harsh shadows on text"
  },
  object_head: {
    label: "Object-Head Person",
    positive: "human body with everyday object as head (e.g., basketball/TV/neon sign), clean neck mount, bold silhouette, editorial lighting",
    negative: "human head still visible, object floating off-neck, unreadable silhouette, cluttered background"
  },
  surreal_scale: {
    label: "Surreal Mixed-Scale",
    positive: "dramatic scale contrast (3–10x) with consistent perspective, occlusion and shadowing",
    negative: "inconsistent shadows, double horizons, floating feet, scale drift across elements"
  }
};

// ============== LAYOUT ORDER (six) ==============
const SIX_LAYOUTS: Array<{ key: string; line: string }> = [
  { key: "meme-text",          line: "Layout: bold meme text top/bottom, high-contrast, 6–8% padding." },
  { key: "badge-callout",      line: "Layout: floating badge callout, compact stylish bubble with minimal outline." },
  { key: "negative-space",     line: "Layout: text in open negative space, ≥10% whitespace buffer, sharp modern font." },
  { key: "caption",            line: "Layout: strong bottom caption, centered, clean sharp typography, perfectly legible." },
  { key: "integrated-in-scene",line: "Layout: typography integrated into scene (painted on poster or wall), natural and stylish." },
  { key: "dynamic-overlay",    line: "Layout: diagonal overlay aligned with scene energy lines, crisp editorial style." }
];

// ============== OPENAI CALL (kept, though we don't need LLM to build strings) ==============
function buildOpenAIRequest(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; maxTokens: number }
) {
  const body: any = { model, messages };
  if (model.startsWith("gpt-5") || model.startsWith("o3") || model.startsWith("o4")) {
    body.max_completion_tokens = options.maxTokens;
  } else {
    body.max_tokens = options.maxTokens;
    if (options.temperature !== undefined) body.temperature = options.temperature;
  }
  return body;
}

// ============== HTTP ==============
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const required = ["completed_text", "image_dimensions"];
    const missing = required.filter((f) => !body[f]);
    if (missing.length) {
      return new Response(JSON.stringify({ success: false, error: `Missing: ${missing.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const templates = await generatePromptTemplates(body as FinalPromptRequest);
    return new Response(JSON.stringify({ success: true, templates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Generate final prompt error:", e);
    return new Response(JSON.stringify({ success: false, error: String((e as Error)?.message || "prompt_generation_failed") }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// ============== HELPERS ==============
function aspectLabel(dim?: string) {
  const d = (dim || "").toLowerCase();
  if (d === "square") return "1:1";
  if (d === "portrait") return "9:16";
  if (d === "landscape") return "16:9";
  return "1:1";
}

function getCompositionInserts(modes?: string[]) {
  if (!modes || modes.length === 0) return null;
  const first = modes[0]?.toLowerCase();
  const found = compositionModels[first as keyof typeof compositionModels];
  if (!found) return null;
  return {
    compPos: `Composition: ${found.positive}.`,
    compNeg: found.negative
  };
}

// ============== CORE ==============
async function generatePromptTemplates(p: FinalPromptRequest): Promise<PromptTemplate[]> {
  const {
    completed_text,
    category = "celebrations",
    tone = "humorous",
    rating = "PG",
    image_style = "realistic",
    image_dimensions = "square",
    visual_recommendation = "",
    composition_modes = []   // e.g., ["very_close"] or ["tiny_head"]
  } = p;

  const aspect = aspectLabel(image_dimensions);
  const toneStr = toneMap[tone?.toLowerCase()] || tone?.toLowerCase() || "funny, witty, playful";
  const styleStr = image_style.toLowerCase();

  // Base scene (your “Base:” text, compacted to play nice with Gemini Flash)
  // Removed hardcoded example scene text

  // Composition inserts (optional)
  const comp = getCompositionInserts(composition_modes);
  const compPos = comp?.compPos ? ` ${comp.compPos}` : "";
  const compNeg = comp?.compNeg || "";

  // Build negatives
  let negative = textQualityNegatives;
  const categoryNegs = getCategoryNegatives(category, rating);
  if (categoryNegs) negative += `, ${categoryNegs}`;
  if (compNeg) negative += `, ${compNeg}`;

  // Use the new template structure for Gemini 2.5 flash
  const prompts: PromptTemplate[] = SIX_LAYOUTS.map((L) => {
    const positive = 
`A ${aspect} ${styleStr} image.


Mandatory Text: "${completed_text}"
Layout: ${layoutTagShort[L.key]}, clean large professional typography.

Scene
Design a ${toneStr} scene: ${visual_recommendation || "engaging and stylish elements"}.
Keep the overall look stylish and polished.


    // Compact negative for Gemini
    const neg =
      `${negative}, low contrast, dull lighting, meme borders, split captions, cramped padding`;

    return {
      name: `Gemini — ${L.key}`,
      description: `Compact prompt for layout: ${L.key}`,
      positive: positive,
      negative: neg
    };
  });

  return prompts;
}
