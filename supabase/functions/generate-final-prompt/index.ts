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

// ============== OPENAI DIRECT ==============
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const AI_MODEL = "gpt-5-mini-2025-08-07";

// ============== CORS ==============
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Error helper for standardized error responses
function err(status: number, message: string, details?: unknown) {
  return new Response(
    JSON.stringify({ success: false, status, error: message, details: details ?? null }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

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

// ============== AI SYSTEM PROMPT ==============
const buildSystemPrompt = () => `You are an expert prompt formatter. You MUST follow this EXACT 3-block structure:

POSITIVE PROMPT FORMAT (3 clean blocks):
Block 1: EXACT TEXT: [mandatory_text]
Block 2: Typography: [layout] format, modern sans-serif, ~[coverage]% coverage.
Block 3: Aspect: [aspect], [style] style. [rating] scene with [visual_description] in a [composition] composition.

NEGATIVE PROMPT FORMAT (lean, ~12 critical terms):
dark, dim, blurry, grainy, dull-colors, washed-out, desaturated, cluttered, distorted, low-quality, misspelled, illegible, warped

⚠️ CRITICAL RULES:
1. DO NOT extract visual keywords from the mandatory text - text is ONLY for display, NOT scene content
2. Use ONLY the visual_recommendation and specific_visuals for actual scene elements  
3. Keep format SHORT and CLEAN - no extra words or descriptions
4. Keep colors vibrant and well-lit, but balanced and natural (not oversaturated)
5. Never use words from the text as scene descriptors (e.g., if text mentions "hieroglyphics", do NOT add hieroglyphics to the scene)

LAYOUT TYPES:
- meme-text: Text format for meme-style images
- badge-callout: Floating badge/callout format
- negative-space: Text in open space format
- caption: Bottom caption format
- integrated-in-scene: Text integrated into environment
- dynamic-overlay: Diagonal overlay format

COMPOSITION MODES:
- normal/base_realistic: Natural proportions, photoreal lighting
- big-head/exaggerated_props: Caricature style
- close-up/very_close: Tight framing
- goofy/goofy_wide: Wide playful framing
- zoomed: Wide environmental shot
- surreal/surreal_scale: Dramatic scale contrast

EXAMPLES:
✅ CORRECT FORMAT:
EXACT TEXT: Happy birthday, Jesse! May your joy multiply this year!

Typography: badge-callout format, modern sans-serif, ~25% coverage.

Aspect: 16:9, vibrant realistic style. PG-13 scene with birthday cake center stage surrounded by colorful balloons and playful confetti in a normal composition.

❌ WRONG - Don't do this:
"The image shows a birthday party with maximum vibrancy and highly saturated colors..."

Remember: The text is what gets DISPLAYED as typography. The visual_recommendation describes what's IN the scene.`;

// ============== AI TOOL DEFINITION ==============
const promptCraftingTool = {
  type: "function",
  function: {
    name: "format_prompt",
    description: "Format the image prompt following the exact 3-block structure",
    parameters: {
      type: "object",
      properties: {
        block1_text: {
          type: "string",
          description: 'EXACT TEXT: [mandatory_text]'
        },
        block2_typography: {
          type: "string",
          description: "Typography: [layout] format, modern sans-serif, ~[coverage]% coverage."
        },
        block3_scene: {
          type: "string",
          description: "Aspect: [aspect], [style] style. [rating] scene with [visual_description] in a [composition] composition."
        },
        negative_prompt: {
          type: "string",
          description: "Lean negative terms (~12): dark, dim, blurry, grainy, dull-colors, washed-out, desaturated, cluttered, distorted, low-quality, misspelled, illegible, warped"
        }
      },
      required: ["block1_text", "block2_typography", "block3_scene", "negative_prompt"],
      additionalProperties: false
    }
  }
};

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

  // Dry-run endpoint for testing wiring
  const url = new URL(req.url);
  if (url.searchParams.get("dry") === "1") {
    return new Response(JSON.stringify({
      success: true,
      templates: [
        {
          name: "dry-run-test",
          positive: "Test positive prompt",
          negative: "Test negative prompt",
          description: "Dry run test template"
        }
      ]
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const required = ["completed_text", "image_dimensions"];
    const missing = required.filter((f) => !body[f]);
    if (missing.length) {
      return err(400, `Missing required fields: ${missing.join(", ")}`);
    }

    const provider = (body.provider as FinalPromptRequest["provider"]) || "gemini";
    const templates = provider === "ideogram"
      ? await generateIdeogramPrompts(body as FinalPromptRequest)
      : await generatePromptTemplates(body as FinalPromptRequest);

    return new Response(JSON.stringify({ success: true, templates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e: any) {
    console.error("Generate final prompt error:", e);
    const msg = (e as Error)?.message || "prompt_generation_failed";
    let status = 500;
    if (msg.includes("timeout")) status = 408;
    if (msg.includes("Missing") || msg.includes("required")) status = 400;
    if (msg.includes("OpenAI") || msg.includes("API")) status = 502;
    
    return err(status, String(msg));
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
  let t = raw.replace(/^[Aa]n?\s+/, "");
  t = t.replace(/\s+/g, " ").replace(/\.*$/, "");
  t = t.replace(/^lively scene shows\s+/i, "lively ").replace(/^scene shows\s+/i, "");
  return t;
}

// If badge-callout and long text, auto-switch to negative-space
function enforceLayout(key: string, completedText: string, thresh = 12) {
  if (key === "badge-callout" && wc(completedText) > thresh) return "negative-space";
  return key;
}

// NEW: Minimum text coverage per layout
function minCoverageForLayout(key: string): number {
  switch (key) {
    case "badge-callout": return 25;   // requested
    case "meme-text":     return 20;   // requested
    case "caption":       return 15;   // requested
    case "negative-space":return 22;   // existing policy
    case "integrated-in-scene": return 22;
    case "dynamic-overlay":    return 18;
    default: return 22;
  }
}

// Join lines to single line (API), cap words
function collapseLines(lines: string[], maxWords: number) {
  const one = squeeze(lines.filter(Boolean).join(" "));
  return wc(one) > maxWords ? limitWords(one, maxWords) : one;
}

// ============== AI-POWERED PROMPT GENERATION ==============
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
  const styleStr = image_style;
  const compName = (composition_modes && composition_modes[0]) || "norman";
  const visPhrase = cleanVisRec(visual_recommendation);
  const tags = normTags(specific_visuals);

  let layoutsToGenerate = SIX_LAYOUTS;
  if (text_layout && text_layout !== "auto") {
    const one = SIX_LAYOUTS.find(L => L.key === text_layout);
    layoutsToGenerate = one ? [one] : SIX_LAYOUTS;
  }

  console.log(`Generating AI-powered prompts for ${layoutsToGenerate.length} layout(s)`);

  const prompts: PromptTemplate[] = [];

  for (const L of layoutsToGenerate) {
    const layoutKey = enforceLayout(L.key, completed_text);
    const minPct = minCoverageForLayout(layoutKey);

    // Build detailed context for AI
    const userPrompt = `Format this prompt following the EXACT 3-block structure:

MANDATORY TEXT: "${completed_text}"
LAYOUT: ${layoutKey}
VISUAL STYLE: ${styleStr}
ASPECT RATIO: ${aspect}
COMPOSITION MODE: ${compName}
RATING: ${rating}
VISUAL RECOMMENDATION: ${visPhrase}
SPECIFIC VISUALS: ${tags.join(", ") || "none"}

⚠️ CRITICAL: The mandatory text is what gets DISPLAYED as typography. Do NOT use words from the text as scene elements. Use ONLY the visual recommendation and specific visuals for actual scene content.

Example:
- Text says "hieroglyphics" → Display it as text, do NOT add hieroglyphics to the scene
- Visual recommendation says "friends laughing around birthday cake" → This goes in the scene

Output the 3 blocks for the positive prompt and the lean comma-separated negative prompt.`;

    try {
      const aiResponse = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: userPrompt }
          ],
          tools: [promptCraftingTool],
          tool_choice: { type: "function", function: { name: "format_prompt" } }
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(`OpenAI API error (${aiResponse.status}):`, errorText);
        throw new Error(`OpenAI API returned ${aiResponse.status}: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      if (!toolCall?.function?.arguments) {
        console.error("No tool call found in AI response:", JSON.stringify(aiData));
        throw new Error("AI did not return structured prompt data");
      }

      const result = JSON.parse(toolCall.function.arguments);
      
      // Combine the three blocks
      const positive_prompt = `${result.block1_text}\n\n${result.block2_typography}\n\n${result.block3_scene}`;
      
      console.log(`Layout ${layoutKey} - Structured prompt:`);
      console.log(`Block 1:`, result.block1_text);
      console.log(`Block 2:`, result.block2_typography);
      console.log(`Block 3:`, result.block3_scene);
      console.log(`Negative:`, result.negative_prompt);

      prompts.push({
        name: `${layoutKey}`,
        description: `Clean structured prompt for ${layoutKey} layout`,
        positive: positive_prompt,
        negative: result.negative_prompt,
        sections: {
          aspect,
          layout: layoutKey,
          mandatoryText: completed_text,
          typography: `modern sans-serif; ≥${minPct}% coverage; no panels`,
          scene: visPhrase,
          mood: tone,
          tags,
          pretty: `${result.block1_text}\n\n${result.block2_typography}\n\n${result.block3_scene}`
        }
      });

    } catch (error) {
      console.error(`Error generating prompt for layout ${layoutKey}:`, error);
      // Fallback to basic template if AI fails
      const fallbackPositive = `MANDATORY TEXT: "${completed_text}" in ${layoutKey} layout. Lighting: bright, vibrant, well-lit. Typography: modern sans-serif, ${minPct}% coverage. Aspect: ${aspect} in ${styleStr}. ${rating} scene with ${visPhrase} in ${compName} composition. Mood: ${tone}.`;
      const fallbackNegative = "dark, dim, blurry, grainy, dull-colors, washed-out, desaturated, cluttered, distorted, low-quality, misspelled, illegible, warped";
      
      prompts.push({
        name: `Fallback — ${layoutKey}`,
        description: `Fallback template (AI generation failed)`,
        positive: fallbackPositive,
        negative: fallbackNegative,
        sections: {
          aspect,
          layout: layoutKey,
          mandatoryText: completed_text,
          typography: `modern sans-serif; ≥${minPct}% coverage`,
          scene: visPhrase,
          mood: tone,
          tags,
          pretty: fallbackPositive
        }
      });
    }
  }

  return prompts;
}

// ============== IDEOGRAM (AI-powered, text-first) ==============
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
  const styleStr = image_style;
  const compName = (composition_modes && composition_modes[0]) || "norman";
  const visPhrase = cleanVisRec(visual_recommendation);
  const tags = normTags(specific_visuals);

  let layoutsToGenerate = SIX_LAYOUTS;
  if (text_layout && text_layout !== "auto") {
    const one = SIX_LAYOUTS.find(L => L.key === text_layout);
    layoutsToGenerate = one ? [one] : SIX_LAYOUTS;
  }

  console.log(`Generating AI-powered Ideogram prompts for ${layoutsToGenerate.length} layout(s)`);

  const prompts: PromptTemplate[] = [];

  for (const L of layoutsToGenerate) {
    const layoutKey = enforceLayout(L.key, completed_text);
    const minPct = minCoverageForLayout(layoutKey);

    const userPrompt = `Format this IDEOGRAM prompt following the EXACT 3-block structure:

MANDATORY TEXT: "${completed_text}"
LAYOUT: ${layoutKey}
VISUAL STYLE: ${styleStr}
ASPECT RATIO: ${aspect}
COMPOSITION MODE: ${compName}
RATING: ${rating}
VISUAL RECOMMENDATION: ${visPhrase}
SPECIFIC VISUALS: ${tags.join(", ") || "none"}

⚠️ CRITICAL: The mandatory text is what gets DISPLAYED as typography. Do NOT use words from the text as scene elements.

IDEOGRAM-SPECIFIC: Emphasize bold typography, text clarity, and high contrast. Ideogram excels at text rendering.

Output the 3 blocks for the positive prompt and the lean comma-separated negative prompt.`;

    try {
      const aiResponse = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt() + "\n\nIDEOGRAM OPTIMIZATION: Ideogram excels at text rendering. Emphasize bold typography, clear text zones, high contrast, and text prominence. Make text the PRIMARY focus." },
            { role: "user", content: userPrompt }
          ],
          tools: [promptCraftingTool],
          tool_choice: { type: "function", function: { name: "format_prompt" } }
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(`OpenAI API error for Ideogram (${aiResponse.status}):`, errorText);
        throw new Error(`OpenAI API returned ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      if (!toolCall?.function?.arguments) {
        throw new Error("AI did not return structured prompt data");
      }

      const result = JSON.parse(toolCall.function.arguments);
      
      // Combine the three blocks
      const positive_prompt = `${result.block1_text}\n\n${result.block2_typography}\n\n${result.block3_scene}`;
      
      console.log(`Ideogram ${layoutKey} - Structured prompt:`);
      console.log(`Block 1:`, result.block1_text);
      console.log(`Block 2:`, result.block2_typography);
      console.log(`Block 3:`, result.block3_scene);

      prompts.push({
        name: `ideogram-${layoutKey}`,
        description: `Ideogram structured prompt for ${layoutKey} layout`,
        positive: positive_prompt,
        negative: result.negative_prompt,
        sections: {
          aspect,
          layout: layoutKey,
          mandatoryText: completed_text,
          typography: `bold modern sans-serif; ≥${minPct}% coverage; high contrast`,
          scene: visPhrase,
          mood: tone,
          tags,
          pretty: `${result.block1_text}\n\n${result.block2_typography}\n\n${result.block3_scene}`
        }
      });

    } catch (error) {
      console.error(`Error generating Ideogram prompt for layout ${layoutKey}:`, error);
      const fallbackPositive = `MANDATORY TEXT: "${completed_text}" in ${layoutKey} layout with BOLD typography. Lighting: bright, vibrant, high contrast. Text: ${minPct}% coverage, modern sans-serif. Aspect: ${aspect} in ${styleStr}. ${rating} scene with ${visPhrase} in ${compName} composition. Mood: ${tone}.`;
      const fallbackNegative = "dark, dim, blurry, grainy, dull-colors, washed-out, desaturated, cluttered, distorted, low-quality, misspelled, illegible, warped";
      
      prompts.push({
        name: `Ideogram Fallback — ${layoutKey}`,
        description: `Fallback template (AI generation failed)`,
        positive: fallbackPositive,
        negative: fallbackNegative,
        sections: {
          aspect,
          layout: layoutKey,
          mandatoryText: completed_text,
          typography: `bold sans-serif; ≥${minPct}% coverage`,
          scene: visPhrase,
          mood: tone,
          tags,
          pretty: fallbackPositive
        }
      });
    }
  }

  return prompts;
}
