import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  final_prompt_rules_gemini,
  final_prompt_rules_ideogram,
  layoutTagShort,
  layoutMap,
  dimensionMap,
  toneMap,
  ratingMap,
  textQualityNegatives,
  textFailureNegatives,
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
  image_style?: string;        // "realistic" | "illustrated" etc.
  text_layout?: string;        // "auto" or one of six
  image_dimensions?: "square" | "portrait" | "landscape" | "custom";
  composition_modes?: string[]; // e.g., ["very_close"]
  visual_recommendation?: string;
  provider?: "gemini" | "ideogram"; // defaults to gemini
}

interface PromptTemplate {
  name: string;
  positive: string;
  negative: string;
  description: string;
}

// ============== WORD LIMITS ==============
const POS_MAX = 80;
const NEG_MAX = 10;

// ============== COMPOSITION MODELS (six) ==============
const compositionModels: Record<string, { positive: string; negative: string; label: string }> = {
  base_realistic: {
    label: "Base Realistic",
    positive: "photoreal composition, natural anatomy, coherent lighting",
    negative: "distorted anatomy, warped perspective"
  },
  exaggerated_props: {
    label: "Exaggerated Proportions",
    positive: "stylized anatomy, playful silhouette, consistent joints",
    negative: "broken joints, melted limbs"
  },
  tiny_head: {
    label: "Tiny-Head",
    positive: "small head, clean neck transition, confident posture",
    negative: "oversized head, missing neck"
  },
  very_close: {
    label: "Very Close",
    positive: "close-up framing, shallow depth, crisp edge lighting",
    negative: "busy background, awkward crop"
  },
  object_head: {
    label: "Object-Head Person",
    positive: "body with object head, bold silhouette, editorial lighting",
    negative: "object floating, unreadable silhouette"
  },
  surreal_scale: {
    label: "Surreal Mixed-Scale",
    positive: "dramatic scale contrast, consistent shadows/perspective",
    negative: "inconsistent shadows, scale drift"
  }
};

// ============== LAYOUT ORDER (six) ==============
const SIX_LAYOUTS: Array<{ key: string; line: string }> = [
  { key: "meme-text",          line: "Layout: meme text top/bottom." },
  { key: "badge-callout",      line: "Layout: floating badge callout." },
  { key: "negative-space",     line: "Layout: text in open negative space." },
  { key: "caption",            line: "Layout: strong bottom caption." },
  { key: "integrated-in-scene",line: "Layout: typography integrated into scene." },
  { key: "dynamic-overlay",    line: "Layout: diagonal overlay." }
];

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

    const provider = (body.provider as FinalPromptRequest["provider"]) || "gemini";
    const templates = provider === "ideogram"
      ? await generateIdeogramPrompts(body as FinalPromptRequest)
      : await generatePromptTemplates(body as FinalPromptRequest);

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
  return { compPos: `Composition: ${found.positive}.`, compNeg: found.negative };
}
function wc(s: string) {
  return (s || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean).length;
}
function limitWords(s: string, max: number) {
  const words = (s || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  return words.slice(0, max).join(" ");
}
function squeeze(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

// ============== CORE (Gemini compact) ==============
async function generatePromptTemplates(p: FinalPromptRequest): Promise<PromptTemplate[]> {
  const {
    completed_text,
    category = "celebrations",
    tone = "humorous",
    rating = "PG",
    image_style = "realistic",
    image_dimensions = "square",
    text_layout,
    visual_recommendation = "",
    composition_modes = []
  } = p;

  const aspect = aspectLabel(image_dimensions);
  const toneStr = (toneMap[tone?.toLowerCase()] || tone || "playful").split(",")[0];
  const styleStr = image_style.toLowerCase();

  const comp = getCompositionInserts(composition_modes);
  const compPos = comp?.compPos ? comp.compPos.replace("Composition: ", "") : "";
  const compNeg = comp?.compNeg || "";

  let layoutsToGenerate = SIX_LAYOUTS;
  if (text_layout && text_layout !== "auto") {
    const one = SIX_LAYOUTS.find(L => L.key === text_layout);
    layoutsToGenerate = one ? [one] : SIX_LAYOUTS;
  }

  const shortLayout: Record<string,string> = {
    "meme-text": "meme top/bottom",
    "badge-callout": "small badge",
    "negative-space": "open area",
    "caption": "bottom caption",
    "integrated-in-scene": "in-scene text",
    "dynamic-overlay": "diagonal overlay"
  };

  // negatives capped to 10 words
  const negative10 = limitWords([
    "misspelled","illegible","low-contrast","extra","black-bars",
    "speech-bubbles","panels","warped","duplicate","cramped"
  ].join(", "), NEG_MAX);

  const prompts: PromptTemplate[] = layoutsToGenerate.map((L) => {
    const layout = shortLayout[L.key] || "clean text";

    const pieces = [
      `${aspect} ${styleStr} shot`,
      "bright key light, vivid color",
      "crisp focus, cinematic contrast",
      `layout: ${layout}`,
      `text: \""${completed_text}\""`, // preserve exact text
      "font modern, ~25% area",
      visual_recommendation ? `scene: ${visual_recommendation}` : "",
      toneStr ? `mood: ${toneStr}` : "",
      compPos ? `composition: ${compPos}` : ""
    ].filter(Boolean);

    let positive = squeeze(pieces.join(". ") + ".");
    if (wc(positive) > POS_MAX) positive = limitWords(positive, POS_MAX);

    let negative = negative10;
    if (compNeg) {
      const withComp = squeeze(`${negative}, ${compNeg}`);
      negative = wc(withComp) <= NEG_MAX ? withComp : negative;
    }

    return {
      name: `Gemini — ${L.key}`,
      description: `Compact Gemini prompt for layout: ${L.key}`,
      positive,
      negative
    };
  });

  return prompts;
}

// ============== IDEOGRAM (compact, text-first) ==============
async function generateIdeogramPrompts(p: FinalPromptRequest): Promise<PromptTemplate[]> {
  const {
    completed_text,
    category = "celebrations",
    tone = "humorous",
    rating = "PG",
    image_style = "realistic",
    image_dimensions = "square",
    text_layout,
    visual_recommendation = "",
    composition_modes = []
  } = p;

  const aspect = aspectLabel(image_dimensions);
  const toneStr = (toneMap[tone?.toLowerCase()] || tone || "fun").split(",")[0];
  const styleStr = image_style.toLowerCase();

  const comp = getCompositionInserts(composition_modes);
  const compPos = comp?.compPos ? comp.compPos.replace("Composition: ", "") : "";
  const compNeg = comp?.compNeg || "";

  let layoutsToGenerate = SIX_LAYOUTS;
  if (text_layout && text_layout !== "auto") {
    const one = SIX_LAYOUTS.find(L => L.key === text_layout);
    layoutsToGenerate = one ? [one] : SIX_LAYOUTS;
  }

  const shortLayout: Record<string,string> = {
    "meme-text": "meme top/bottom, 6–8% padding",
    "badge-callout": "floating badge, thin outline",
    "negative-space": "text in open area",
    "caption": "bottom caption",
    "integrated-in-scene": "text as real sign",
    "dynamic-overlay": "diagonal overlay"
  };

  const rawNeg = [
    "misspelled","illegible","low-contrast","extra","panels",
    "speech-bubbles","black-bars","warped","duplicate","cramped"
  ];
  const negative10 = limitWords(rawNeg.join(", "), NEG_MAX);

  const prompts: PromptTemplate[] = layoutsToGenerate.map((L) => {
    const layout = shortLayout[L.key] || "clean text";

    const pieces = [
      `${aspect} ${styleStr} scene`,
      "bright natural light, no darkness",
      "vivid color, crisp focus",
      `layout: ${layout}`,
      `MANDATORY TEXT: "${completed_text}"`,
      "modern sans-serif, ~25% area, no panels",
      visual_recommendation ? `scene: ${visual_recommendation}` : "",
      toneStr ? `mood: ${toneStr}` : "",
      compPos ? `composition: ${compPos}` : ""
    ].filter(Boolean);

    let positive = squeeze(pieces.join(". ") + ".");
    if (wc(positive) > POS_MAX) positive = limitWords(positive, POS_MAX);

    let negative = negative10;
    if (compNeg) {
      const withComp = squeeze(`${negative}, ${compNeg}`);
      negative = wc(withComp) <= NEG_MAX ? withComp : negative;
    }

    return {
      name: `Ideogram — ${L.key}`,
      description: `Compact Ideogram prompt for layout: ${L.key}`,
      positive,
      negative
    };
  });

  return prompts;
}
