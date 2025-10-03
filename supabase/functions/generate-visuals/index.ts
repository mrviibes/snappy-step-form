import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { visual_rules, subcategory_contexts, composition_mode_cues } from "../_shared/visual-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getVisualsModel = () => Deno.env.get("OPENAI_VISUALS_MODEL") || "gpt-5-mini";
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

// ---------- OpenAI request builder ----------
function buildOpenAIRequest(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { maxTokens: number }
) {
  const body: any = { model, messages };
  if (model.startsWith("gpt-5") || model.startsWith("o3") || model.startsWith("o4")) {
    body.max_completion_tokens = options.maxTokens;
  } else {
    body.max_tokens = options.maxTokens;
    body.temperature = 0.9;
  }
  return body;
}

// ---------- Types ----------
interface GenerateVisualsParams {
  category: string;
  subcategory: string;
  tone: string;
  rating: string;
  insertWords?: string[];
  composition_modes?: string[];     // e.g., ["very_close","exaggerated_props"]
  image_style: string;
  completed_text: string;
  count: number;
  specific_visuals?: string[];      // e.g., ["old man drinking and crying"]
}

interface GenerateVisualsResponse {
  success: boolean;
  visuals: { description: string }[];
  model: string;
  debug?: { lengths: number[]; validCount: number; literalCount: number; keywords: string[] };
  error?: string;
}

// ---------- Helpers ----------
const WORDS = (s: string) => (s.match(/\b[\w''-]+\b/gu) || []);
const clamp15 = (s: string) => WORDS(s).slice(0, 15).join(" ");
const cleanLine = (s: string) =>
  s.replace(/^\s*[-*]?\s*\d{1,3}[.)]\s*/u, "").replace(/^["'""]+|["'""]+$/g, "").trim();

function pickCue(index: number, modes: string[]): string {
  if (!modes || modes.length === 0) return composition_mode_cues.base_realistic;
  const key = (modes[index % modes.length] || "").toLowerCase();
  return composition_mode_cues[key] || composition_mode_cues.base_realistic;
}

function hasAnyToken(s: string, tokens: string[]) {
  const low = s.toLowerCase();
  return tokens.some(t => t && low.includes(t));
}

function extractKeyTokens(phrases: string[]): string[] {
  // take meaningful tokens (length > 2), de-dupe, keep order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of phrases) {
    for (const tok of (p || "").toLowerCase().split(/[^\p{L}\p{N}''-]+/u)) {
      if (tok && tok.length > 2 && !seen.has(tok)) {
        seen.add(tok);
        out.push(tok);
      }
    }
  }
  return out.slice(0, 6); // we only need a few anchors
}

function synthLine(
  tone: string,
  visualTokens: string[],
  cue: string
): string {
  // ultra-simple fallback sentence scaffold, ≤15 words
  const base = [
    "Humorous", "Romantic", "Playful", "Serious", "Savage", "Wholesome", "Inspirational", "Nostalgic"
  ];
  const toneWord = base.find(b => b.toLowerCase() === tone.toLowerCase()) || "Playful";
  const vis = visualTokens.slice(0, 3).join(" ");
  return clamp15(`${toneWord.toLowerCase()} scene: ${vis}, ${cue}.`);
}

// ---------- Core generation ----------
async function generateVisuals(params: GenerateVisualsParams): Promise<GenerateVisualsResponse> {
  if (!openAIApiKey) throw new Error("OpenAI API key not found");

  const model = getVisualsModel();
  const {
    category, subcategory, tone, rating,
    insertWords = [], composition_modes = [],
    image_style, completed_text, specific_visuals = []
  } = params;

  const subCtx = subcategory_contexts[subcategory?.toLowerCase()] || subcategory_contexts.default;

  // Add category-specific brightness rules for celebrations
  const brightnessNote = category.toLowerCase() === "celebrations"
    ? "\nBRIGHTNESS: scenes must be bright, vibrant, well-lit, cheerful. Avoid moody lighting."
    : "";

  // Build system prompt (short, strict)
  const systemPrompt = `${visual_rules}

INPUTS
- Category: ${category}
- Subcategory: ${subcategory}
- Tone: ${tone}
- Rating: ${rating}
- Style: ${image_style}
- Insert words: ${insertWords.join(", ") || "none"}
- Composition modes: ${composition_modes.join(", ") || "none"}
- Specific visuals: ${specific_visuals.join(", ") || "none"}
- Caption idea: "${completed_text}"

CONTEXT: ${subCtx}${brightnessNote}

TASK
Generate exactly 4 visual scene concepts (one per line). Follow OUTPUT FORMAT and MUST INCLUDE rules.`;

  const userPrompt = "Return 4 distinct, short concepts now.";

  try {
    const req = buildOpenAIRequest(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { maxTokens: 220 });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("timeout"), 20000);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal
    }).catch((e) => {
      throw new Error(e?.name === "AbortError" ? "Upstream model timeout (20s)" : String(e));
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI ${response.status}: ${body.slice(0, 500)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse content into candidate lines - normalize, dedupe, and clamp
    const uniq = new Set<string>();
    let lines = content.split(/\r?\n+/)
      .map(cleanLine)
      .map(s => s.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter(s => { const k = s.toLowerCase(); if (uniq.has(k)) return false; uniq.add(k); return true; })
      .slice(0, 4);

    // pad with empty for synth pass
    while (lines.length < 4) lines.push("");

    // Token anchors for specific visuals
    const visualTokens = extractKeyTokens(specific_visuals);

    // Post-process: enforce specific visuals + composition cue + ≤15 words
    const fixed = lines.map((raw: string, i: number) => {
      let s = raw;
      const cue = pickCue(i, composition_modes);
      const tokens = visualTokens.slice(0, 3);

      // synth if blank or too short
      if (!s || WORDS(s).length < 3) {
        return clamp15(synthLine(tone, tokens, cue));
      }

      // ensure a cue exists exactly once
      const hasCue = s.toLowerCase().includes(cue.split(",")[0]);
      if (!hasCue) {
        if (WORDS(s).length <= 12) s = `${s}, ${cue}`;
        else s = clamp15(`${s} ${cue}`);
      }

      // ensure a token appears if provided
      if (tokens.length && !hasAnyToken(s, tokens)) {
        if (WORDS(s).length <= 14) s = `${s}, ${tokens[0]}`;
        s = clamp15(s);
      }

      // calm punctuation, one sentence
      s = s.replace(/[.!?]{2,}$/g, ".").replace(/[.!?].*$/u, m => m[0]);
      return clamp15(s);
    });

    const visuals = fixed.map((description: string) => ({ description }));

    // Debug info
    const literalCount =
      visualTokens.length === 0
        ? 0
        : visuals.filter((v: { description: string }) => hasAnyToken(v.description, visualTokens)).length;

    return {
      success: true,
      visuals,
      model: data.model || model,
      debug: {
        lengths: visuals.map((v: { description: string }) => WORDS(v.description).length),
        validCount: visuals.length,
        literalCount,
        keywords: visualTokens
      }
    };
  } catch (error) {
    console.error("Error generating visuals:", error);
    return {
      success: false,
      visuals: [],
      model,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ---------- Main handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params = await req.json();
    const result = await generateVisuals(params);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-visuals function:", error);
    return new Response(JSON.stringify({
      success: false,
      visuals: [],
      model: getVisualsModel(),
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
