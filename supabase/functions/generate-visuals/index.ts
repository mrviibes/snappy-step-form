import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { visual_rules, subcategory_contexts, composition_mode_cues } from "../_shared/visual-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getVisualsModel = () => Deno.env.get("OPENAI_VISUALS_MODEL") || "gpt-4o-mini";
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
const WORDS = (s: string) => (s.match(/\b[\w’'-]+\b/gu) || []);
const clamp15 = (s: string) => WORDS(s).slice(0, 15).join(" ");
const cleanLine = (s: string) =>
  s.replace(/^\s*[-*]?\s*\d{1,3}[.)]\s*/u, "").replace(/^["'“”]+|["'“”]+$/g, "").trim();

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
    for (const tok of (p || "").toLowerCase().split(/[^\p{L}\p{N}’'-]+/u)) {
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

CONTEXT: ${subCtx}

TASK
Generate exactly 4 visual scene concepts (one per line). Follow OUTPUT FORMAT and MUST INCLUDE rules.`;

  const userPrompt = "Return 4 distinct, short concepts now.";

  try {
    const req = buildOpenAIRequest(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { maxTokens: 240 });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(req)
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse content into candidate lines
    let lines = content.split(/\r?\n+/).map(cleanLine).filter(Boolean);

    // Ensure we have at least 4 candidates to work with
    if (lines.length < 4) {
      // pad with empty strings; we’ll synthesize later
      while (lines.length < 4) lines.push("");
    } else {
      lines = lines.slice(0, 4);
    }

    // Token anchors for specific visuals
    const visualTokens = extractKeyTokens(specific_visuals);
    const cueUsed: string[] = [];

    // Post-process: enforce specific visuals + composition cue + ≤15 words
    const fixed = lines.map((raw: string, i: number) => {
      let s = raw;

      // If the model returned blank or nonsense, synthesize a line
      if (!s || WORDS(s).length < 3) {
        const cue = pickCue(i, composition_modes);
        cueUsed.push(cue);
        return clamp15(synthLine(tone, visualTokens, cue));
      }

      // Append composition cue if missing
      const cue = pickCue(i, composition_modes);
      if (!s.toLowerCase().includes(cue.split(",")[0])) {
        // Try to append safely if ≤12 words; else replace trailing clause
        if (WORDS(s).length <= 12) s = `${s}, ${cue}`;
        else s = clamp15(`${s} ${cue}`);
      }
      cueUsed.push(cue);

      // Ensure at least one visual token is present
      if (visualTokens.length && !hasAnyToken(s, visualTokens)) {
        const add = visualTokens[0]; // most distinctive
        if (WORDS(s).length <= 14) s = `${s}, ${add}`;
        s = clamp15(s);
      }

      // Final clamp to one sentence and ≤15 words
      s = s.replace(/[.!?]{2,}$/g, "."); // calm punctuation
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
