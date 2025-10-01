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
  image_style?: string;         // "realistic" | "illustrated" etc.
  text_layout?: string;         // "auto" or one of six
  image_dimensions?: "square" | "portrait" | "landscape" | "custom";
  composition_modes?: string[]; // e.g., ["norman"]
  specific_visuals?: string[];  // tags from UI
  visual_recommendation?: string;
  provider?: "gemini" | "ideogram"; // defaults to gemini
}

interface PromptTemplate {
  name: string;
  positive: string;  // API-ready single line
  negative: string;
  description: string;
  sections?: {
    aspect?: string;
    lighting?: string;
    layout?: string;
    mandatoryText?: string;
    typography?: string;
    scene?: string;
    mood?: string;
    tags?: string[];
    pretty?: string; // multi-line formatted prompt for UI
  };
}

// ============== WORD LIMITS ==============
const POS_MAX = 80;
const NEG_MAX = 10;

// ============== COMPOSITION MODELS (six) ==============
const compositionModels: Record<string, { positive: string; negative: string; label: string }> = {
  base_realistic: {
    label: "Base Realistic",
    positive: "natural anatomy and proportions, photoreal lighting, coherent perspective",
    negative: "distorted anatomy, warped perspective"
  },
  exaggerated_props: {
    label: "Exaggerated Proportions",
    positive: "giant symmetrical caricature head on body, clean neck transition, stable features",
    negative: "asymmetrical head, floating head, missing neck, grotesque deformation"
  },
  very_close: {
    label: "Very Close",
    positive: "very tight face framing, shallow depth of field, crisp edges, clean background",
    negative: "busy background, awkward crop, cut-off features"
  },
  goofy_wide: {
    label: "Goofy Wide",
    positive: "zoomed-out wide frame, playful mood, small subject scale, ample negative space",
    negative: "scale drift, cluttered horizon, floating subject"
  },
  zoomed: {
    label: "Zoomed",
    positive: "distant subject, wide shot, clear horizon, strong environment emphasis",
    negative: "subject too tiny, messy composition, unclear focal point"
  },
  surreal_scale: {
    label: "Surreal Scale",
    positive: "dramatic scale contrast (3–10x), consistent occlusion and shadowing, coherent perspective",
    negative: "mismatched scales, inconsistent shadows, floating elements"
  }
};

// Map your UI names → internal keys
const legacyMap: Record<string, string> = {
  norman: "base_realistic",
  "big-head": "exaggerated_props",
  big_head: "exaggerated_props",
  "close-up": "very_close",
  close_up: "very_close",
  goofy: "goofy_wide",
  zoomed: "zoomed",
  surreal: "surreal_scale",
  // passthrough
  base_realistic: "base_realistic",
  exaggerated_props: "exaggerated_props",
  very_close: "very_close",
  goofy_wide: "goofy_wide",
  surreal_scale: "surreal_scale",
  object_head: "exaggerated_props"
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
  let first = (modes[0] || "").toLowerCase();
  first = legacyMap[first] || first;
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

// Normalize and cap tags
function normTags(tags?: string[], max = 6) {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = (raw || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
    if (!t) continue;
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
      if (out.length >= max) break;
    }
  }
  return out;
}

// Split meme text at first comma for top/bottom
function maybeSplitMeme(text: string, layoutKey?: string) {
  if (layoutKey !== "meme-text") return `MANDATORY TEXT (exact, verbatim): "${text}" — render as one block.`;
  const i = text.indexOf(",");
  if (i === -1) return `MANDATORY TEXT (exact, verbatim): "${text}" — render as one block.`;
  const top = text.slice(0, i).trim();
  const bottom = text.slice(i + 1).trim();
  return `Text top (verbatim): "${top}" Text bottom (verbatim): "${bottom}"`;
}

// Clean visual_recommendation → natural phrase
function cleanVisRec(s?: string) {
  const raw = (s || "").trim();
  if (!raw) return "clear composition";
  let t = raw.replace(/^[Aa]n?\s+/, "");           // drop leading A/An
  t = t.replace(/\s+/g, " ").replace(/\.*$/, ""); // collapse spaces, drop trailing dots
  t = t.replace(/^lively scene shows\s+/i, "lively ").replace(/^scene shows\s+/i, "");
  return t;
}

// If badge-callout and long text, auto-switch to negative-space
function enforceLayout(key: string, completedText: string, thresh = 12) {
  if (key === "badge-callout" && wc(completedText) > thresh) return "negative-space";
  return key;
}

// Join lines to single line (API), cap words
function collapseLines(lines: string[], maxWords: number) {
  const one = squeeze(lines.filter(Boolean).join(" "));
  return wc(one) > maxWords ? limitWords(one, maxWords) : one;
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
    composition_modes = [],
    specific_visuals = []
  } = p;

  const aspect = aspectLabel(image_dimensions);
  const toneStr = (toneMap[tone?.toLowerCase()] || tone || "playful").split(",")[0];
  const styleStr = image_style.toLowerCase();

  const comp = getCompositionInserts(composition_modes);
  const compPos = comp?.compPos ? comp.compPos.replace("Composition: ", "") : "";
  const compNeg = comp?.compNeg || "";
  const compName = (composition_modes && composition_modes[0]) || "norman";

  const tags = normTags(specific_visuals);
  const catRateNeg = getCategoryNegatives(category, rating);
  const visPhrase = cleanVisRec(visual_recommendation);

  let layoutsToGenerate = SIX_LAYOUTS;
  if (text_layout && text_layout !== "auto") {
    const one = SIX_LAYOUTS.find(L => L.key === text_layout);
    layoutsToGenerate = one ? [one] : SIX_LAYOUTS;
  }

  // tighter baseNeg, focused on spelling splits (10 words)
  const baseNeg = [
    "misspelled","illegible","broken-words","extra","low-contrast",
    "warped","panels","bubbles","black-bars","cramped"
  ].join(", ");

  const prompts: PromptTemplate[] = layoutsToGenerate.map((L) => {
    const layoutKey = enforceLayout(L.key, completed_text);

    // Multi-line skeleton — EXACT format requested
    const prettyLines = [
`MANDATORY TEXT: "${completed_text}" in a Layout: ${layoutKey} format.`,
"Typography: modern sans-serif; ~25% area; no panels.",
`Aspect: ${aspect} in ${styleStr}.`,
`A ${rating} scene featuring ${visPhrase} in a ${compName} composition.`,
`Mood: ${toneStr}.`
    ];

    // Collapse to single line (≤80 words)
    let positive = collapseLines(prettyLines, POS_MAX);

    // Build compact negative (≤10 words)
    let negative = limitWords(baseNeg, NEG_MAX);
    if (catRateNeg) {
      const tryCR = squeeze(`${negative}, ${catRateNeg}`);
      if (wc(tryCR) <= NEG_MAX) negative = tryCR;
    }
    if (tags.length) {
      const tryTags = squeeze(`${negative}, cluttered props`);
      if (wc(tryTags) <= NEG_MAX) negative = tryTags;
    }
    if (compNeg) {
      const tryComp = squeeze(`${negative}, ${compNeg}`);
      if (wc(tryComp) <= NEG_MAX) negative = tryComp;
    }

    const sections = {
      aspect,
      layout: layoutKey,
      mandatoryText: completed_text,
      typography: "modern sans-serif; ~25% area; no panels",
      scene: visPhrase,
      mood: toneStr,
      tags,
      pretty: prettyLines.join("\n")
    };

    return {
      name: `Gemini — ${layoutKey}`,
      description: `Compact Gemini prompt for layout: ${layoutKey}`,
      positive,
      negative,
      sections
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
    composition_modes = [],
    specific_visuals = []
  } = p;

  const aspect = aspectLabel(image_dimensions);
  const toneStr = (toneMap[tone?.toLowerCase()] || tone || "fun").split(",")[0];
  const styleStr = image_style.toLowerCase();

  const comp = getCompositionInserts(composition_modes);
  const compPos = comp?.compPos ? comp.compPos.replace("Composition: ", "") : "";
  const compNeg = comp?.compNeg || "";
  const compName = (composition_modes && composition_modes[0]) || "norman";

  const tags = normTags(specific_visuals);
  const catRateNeg = getCategoryNegatives(category, rating);
  const visPhrase = cleanVisRec(visual_recommendation);

  let layoutsToGenerate = SIX_LAYOUTS;
  if (text_layout && text_layout !== "auto") {
    const one = SIX_LAYOUTS.find(L => L.key === text_layout);
    layoutsToGenerate = one ? [one] : SIX_LAYOUTS;
  }

  const baseNeg = [
    "misspelled","illegible","broken-words","extra","low-contrast",
    "warped","panels","bubbles","black-bars","cramped"
  ].join(", ");

  const prompts: PromptTemplate[] = layoutsToGenerate.map((L) => {
    const layoutKey = enforceLayout(L.key, completed_text);

    // Multi-line skeleton — EXACT format requested
    const prettyLines = [
`MANDATORY TEXT: "${completed_text}" in a Layout: ${layoutKey} format.`,
"Typography: modern sans-serif; ~25% area; no panels.",
`Aspect: ${aspect} in ${styleStr}.`,
`A ${rating} scene featuring ${visPhrase} in a ${compName} composition.`,
`Mood: ${toneStr}.`
    ];

    // Collapse to single line (≤80 words)
    let positive = collapseLines(prettyLines, POS_MAX);

    // Build compact negative (≤10 words)
    let negative = limitWords(baseNeg, NEG_MAX);
    const cr = catRateNeg ? squeeze(`${negative}, ${catRateNeg}`) : negative;
    if (catRateNeg && wc(cr) <= NEG_MAX) negative = cr;
    if (tags.length) {
      const tryTags = squeeze(`${negative}, cluttered props`);
      if (wc(tryTags) <= NEG_MAX) negative = tryTags;
    }
    if (compNeg) {
      const tryComp = squeeze(`${negative}, ${compNeg}`);
      if (wc(tryComp) <= NEG_MAX) negative = tryComp;
    }

    const sections = {
      aspect,
      layout: layoutKey,
      mandatoryText: completed_text,
      typography: "modern sans-serif; ~25% area; no panels",
      scene: visPhrase,
      mood: toneStr,
      tags,
      pretty: prettyLines.join("\n")
    };

    return {
      name: `Ideogram — ${layoutKey}`,
      description: `Compact Ideogram prompt for layout: ${layoutKey}`,
      positive,
      negative,
      sections
    };
  });

  return prompts;
}
