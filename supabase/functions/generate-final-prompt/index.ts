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

// ============== AI GATEWAY ==============
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

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

// ============== AI SYSTEM PROMPT ==============
const buildSystemPrompt = () => `You are an expert AI image prompt engineer specializing in crafting optimized prompts for text-on-image generation.

LAYOUT TYPES (6 options):
1. meme-text: Bold impact font, top/bottom split text, simple background, high contrast
2. badge-callout: Floating badge/callout with text, clear zone around text, minimal background detail
3. negative-space: Text in open/empty areas, environmental composition, text integrated naturally
4. caption: Bottom-anchored text, cinematic composition, strong visual hierarchy
5. integrated-in-scene: Text as part of environment (signs, objects, graffiti), seamless integration
6. dynamic-overlay: Diagonal/angular text placement, energetic composition, modern typography

VISUAL STYLES:
- Realistic: Photographic lighting, natural proportions, detailed textures, real-world physics
- 3D Render: Clean geometry, studio lighting, polished surfaces, CGI aesthetic
- Anime: Bold lines, expressive features, vibrant colors, stylized proportions
- Design: Flat colors, geometric shapes, minimalist, graphic design aesthetic
- General: Flexible style, balanced approach
- Auto: AI chooses best style for content

COMPOSITION MODES:
- norman/base_realistic: Natural anatomy, photoreal lighting, coherent perspective
- big-head/exaggerated_props: Giant caricature head, clean neck transition, stable features
- close-up/very_close: Tight face framing, shallow depth, crisp edges
- goofy/goofy_wide: Zoomed-out wide frame, playful mood, ample negative space
- zoomed: Distant subject, wide shot, strong environment emphasis
- surreal/surreal_scale: Dramatic scale contrast, consistent shadows, coherent perspective

TONE EFFECTS:
- humorous: Funny, witty, playful mood
- savage: Bold, edgy, confident, cutting
- sarcastic: Witty, ironic, sharp
- wholesome: Warm, positive, uplifting
- dark: Edgy, moody, dramatic
- romantic: Tender, intimate, heartfelt

RATING CONSTRAINTS:
- G: Family-friendly, no controversial elements
- PG: Mild humor, safe for most audiences
- PG-13: Edgier humor, some innuendo allowed
- R: Adult themes, strong language, mature humor

YOUR TASK:
Analyze all input parameters (text, layout, style, tone, rating, composition, visual recommendations) and craft an OPTIMAL image generation prompt.

CRITICAL REQUIREMENTS:
1. Text must be BRIGHT, VIBRANT, WELL-LIT, CRISP - never dark or murky
2. Text coverage must meet layout minimums (meme: 20%, badge: 25%, caption: 15%, others: 18-22%)
3. Modern sans-serif typography unless style requires otherwise
4. No text panels, bubbles, or frames - text directly on image
5. Mandatory text must be EXACT and PROMINENT

POSITIVE PROMPT STRUCTURE:
- Start with mandatory text and layout specification
- Add lighting/quality requirements (bright, vibrant, well-lit)
- Specify typography and text coverage percentage
- Define aspect ratio and visual style
- Describe scene with visual recommendations
- Include composition mode characteristics
- Set mood/tone
- Add specific visual elements if provided

NEGATIVE PROMPT STRATEGY:
Prioritize exclusions based on:
1. Dark/low-quality prevention (dark, dim, murky, shadowy, underexposed)
2. Text rendering issues (misspelled, illegible, broken-words, warped)
3. Composition problems (cluttered, distorted, panels, bubbles)
4. Category/rating-specific exclusions
5. Style-specific anti-patterns

Think through the BEST way to combine all parameters for maximum image quality and text readability.`;

// ============== AI TOOL DEFINITION ==============
const promptCraftingTool = {
  type: "function",
  function: {
    name: "craft_image_prompt",
    description: "Generate optimized positive and negative prompts for text-on-image generation",
    parameters: {
      type: "object",
      properties: {
        reasoning: {
          type: "string",
          description: "Your thought process: why these specific prompt choices work best for this combination of parameters"
        },
        positive_prompt: {
          type: "string",
          description: "Complete positive prompt optimized for image generation (no word limit, focus on clarity and completeness)"
        },
        negative_prompt: {
          type: "string",
          description: "Negative prompt with prioritized exclusions (focus on most important anti-patterns)"
        },
        emphasis_areas: {
          type: "array",
          items: { type: "string" },
          description: "3-5 key focal points the generator should prioritize"
        }
      },
      required: ["reasoning", "positive_prompt", "negative_prompt", "emphasis_areas"],
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
    const userPrompt = `Generate an optimized image generation prompt with these parameters:

MANDATORY TEXT: "${completed_text}"
LAYOUT: ${layoutKey} (min ${minPct}% text coverage)
VISUAL STYLE: ${styleStr}
ASPECT RATIO: ${aspect}
COMPOSITION MODE: ${compName}
TONE: ${tone}
RATING: ${rating}
CATEGORY: ${category}
VISUAL RECOMMENDATION: ${visPhrase}
SPECIFIC VISUALS: ${tags.join(", ") || "none"}

Craft the BEST possible prompts that combine all these elements intelligently. Think through how the layout type affects text placement, how the style affects rendering, and how to prevent dark/low-quality output.`;

    try {
      const aiResponse = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: userPrompt }
          ],
          tools: [promptCraftingTool],
          tool_choice: { type: "function", function: { name: "craft_image_prompt" } }
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(`AI Gateway error (${aiResponse.status}):`, errorText);
        throw new Error(`AI Gateway returned ${aiResponse.status}: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      if (!toolCall?.function?.arguments) {
        console.error("No tool call found in AI response:", JSON.stringify(aiData));
        throw new Error("AI did not return structured prompt data");
      }

      const result = JSON.parse(toolCall.function.arguments);
      
      console.log(`Layout ${layoutKey} - AI Reasoning:`, result.reasoning);
      console.log(`Positive prompt (${result.positive_prompt.length} chars):`, result.positive_prompt.substring(0, 200) + "...");
      console.log(`Negative prompt:`, result.negative_prompt);

      prompts.push({
        name: `AI-Crafted — ${layoutKey}`,
        description: result.reasoning,
        positive: result.positive_prompt,
        negative: result.negative_prompt,
        sections: {
          aspect,
          layout: layoutKey,
          mandatoryText: completed_text,
          typography: `modern sans-serif; ≥${minPct}% coverage; no panels`,
          scene: visPhrase,
          mood: tone,
          tags,
          pretty: `AI-Generated Prompt:\n\n${result.positive_prompt}\n\nEmphasis: ${result.emphasis_areas.join(", ")}`
        }
      });

    } catch (error) {
      console.error(`Error generating prompt for layout ${layoutKey}:`, error);
      // Fallback to basic template if AI fails
      const fallbackPositive = `MANDATORY TEXT: "${completed_text}" in ${layoutKey} layout. Lighting: bright, vibrant, well-lit. Typography: modern sans-serif, ${minPct}% coverage. Aspect: ${aspect} in ${styleStr}. ${rating} scene with ${visPhrase} in ${compName} composition. Mood: ${tone}.`;
      const fallbackNegative = "dark, dim, blurry, grainy, misspelled, illegible, panels, bubbles, distorted, low-quality";
      
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

    const userPrompt = `Generate an optimized IDEOGRAM image generation prompt (Ideogram excels at text rendering and typography):

MANDATORY TEXT: "${completed_text}"
LAYOUT: ${layoutKey} (min ${minPct}% text coverage)
VISUAL STYLE: ${styleStr}
ASPECT RATIO: ${aspect}
COMPOSITION MODE: ${compName}
TONE: ${tone}
RATING: ${rating}
CATEGORY: ${category}
VISUAL RECOMMENDATION: ${visPhrase}
SPECIFIC VISUALS: ${tags.join(", ") || "none"}

IDEOGRAM-SPECIFIC: Focus heavily on text clarity, bold typography, high contrast between text and background. Ideogram is exceptional at rendering text, so emphasize text prominence and readability.`;

    try {
      const aiResponse = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt() + "\n\nIDEOGRAM OPTIMIZATION: Ideogram excels at text rendering. Emphasize bold typography, clear text zones, high contrast, and text prominence. Make text the PRIMARY focus." },
            { role: "user", content: userPrompt }
          ],
          tools: [promptCraftingTool],
          tool_choice: { type: "function", function: { name: "craft_image_prompt" } }
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(`AI Gateway error for Ideogram (${aiResponse.status}):`, errorText);
        throw new Error(`AI Gateway returned ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      if (!toolCall?.function?.arguments) {
        throw new Error("AI did not return structured prompt data");
      }

      const result = JSON.parse(toolCall.function.arguments);
      
      console.log(`Ideogram ${layoutKey} - AI Reasoning:`, result.reasoning);

      prompts.push({
        name: `Ideogram AI — ${layoutKey}`,
        description: result.reasoning,
        positive: result.positive_prompt,
        negative: result.negative_prompt,
        sections: {
          aspect,
          layout: layoutKey,
          mandatoryText: completed_text,
          typography: `bold modern sans-serif; ≥${minPct}% coverage; high contrast`,
          scene: visPhrase,
          mood: tone,
          tags,
          pretty: `AI-Generated Ideogram Prompt:\n\n${result.positive_prompt}\n\nEmphasis: ${result.emphasis_areas.join(", ")}`
        }
      });

    } catch (error) {
      console.error(`Error generating Ideogram prompt for layout ${layoutKey}:`, error);
      const fallbackPositive = `MANDATORY TEXT: "${completed_text}" in ${layoutKey} layout with BOLD typography. Lighting: bright, vibrant, high contrast. Text: ${minPct}% coverage, modern sans-serif. Aspect: ${aspect} in ${styleStr}. ${rating} scene with ${visPhrase} in ${compName} composition. Mood: ${tone}.`;
      const fallbackNegative = "dark, dim, low-contrast, blurry, misspelled, illegible, panels, cramped, distorted";
      
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
