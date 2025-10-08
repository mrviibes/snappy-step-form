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
  tone?: string;
  rating?: string;
  image_style?: string;         // "realistic" | "illustrated" etc.
  text_layout?: string;         // "auto" or one of six
  image_dimensions?: "square" | "portrait" | "landscape" | "custom";
  composition_modes?: string[]; // e.g., ["norman"]
  specific_visuals?: string[];  // tags from UI
  visual_subject?: string;      // Photographic subject description
  visual_setting?: string;      // Photographic setting description
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
const buildSystemPrompt = () => `You are an expert Ideogram prompt formatter.
Return exactly TWO text blocks:

1️⃣ Positive prompt (4 sentences total)
2️⃣ Negative prompt (one comma-separated line)

Positive prompt rules:
• Start with a short scene description sentence.
• Second sentence MUST begin with: The text exactly reads "[mandatory_text]".
• Describe font, placement, lighting, and mood in natural language.
• Keep it cinematic, realistic, under 110 words total.
• No lens jargon, camera terms, brand names, or exposure settings.

Negative prompt rules:
• Always include: misspelled words, warped letters, distorted characters, oversized text, text covering faces.

EXAMPLES:
✅ CORRECT:
A lively realistic photograph of friends laughing together around a birthday cake glowing with candles and confetti scattered on the table.
The text exactly reads "TIME TRIED TO SNEAK BY. BIRTHDAY CAUGHT IT MID YAWN." shown in clear printed bold condensed sans-serif lettering, centered above the cake in two lines for balance and legibility.
Soft warm indoor lighting, cinematic depth, and confetti highlights create a fun celebratory mood.
The overall tone is humorous and cheerful, capturing the spontaneous laughter and energy of a birthday celebration shared among close friends.

Negative: misspelled words, warped letters, distorted characters, oversized text, text covering faces

❌ WRONG:
Shot on Canon EOS R5 with 50mm f/1.8 lens (no camera jargon)
Text says "Birthday" with multiple fonts (text must be exact)
Cluttered background with many props (keep simple and clean)`;

// ============== AI TOOL DEFINITION ==============
const promptCraftingTool = {
  type: "function",
  function: {
    name: "format_prompt",
    description: "Format the image prompt following the exact 3-line structure",
    parameters: {
      type: "object",
      properties: {
        text_line: {
          type: "string",
          description: 'Line 1: TEXT: exactly reads "[mandatory_text]"'
        },
        style_line: {
          type: "string",
          description: "Line 2: STYLE: [typography], [font_style], evenly spaced letters"
        },
        scene_line: {
          type: "string",
          description: "Line 3: SCENE: [visual_style] [scene_description], [lighting], [aspect_ratio]"
        },
        negative_prompt: {
          type: "string",
          description: "Negative terms: misspelled text, broken letters, split characters"
        }
      },
      required: ["text_line", "style_line", "scene_line", "negative_prompt"],
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

// ============== TYPOGRAPHY STYLES BY LAYOUT ==============
const TYPOGRAPHY_STYLES: Record<string, string> = {
  "meme-text": "bold impact-style font, high contrast, thick strokes",
  "badge-callout": "rounded geometric sans-serif, friendly weight, clean kerning",
  "negative-space": "modern clean sans-serif, balanced weight, professional",
  "caption": "editorial sans-serif or clean serif, refined weight, subtle",
  "integrated-in-scene": "text physically integrated into a real surface or object in the environment - not an overlay. Choose an appropriate surface that fits the scene context: fogged mirror, painted wall, paper note, fabric label, engraved sign, chalk board, steam on glass, etc. The text should appear as part of the physical world",
  "dynamic-overlay": "bold geometric sans-serif, strong angles, editorial weight"
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

// Split meme text at first comma for top/bottom - only if it looks like setup/punchline
function maybeSplitMeme(text: string, layoutKey?: string) {
  if (layoutKey !== "meme-text") return `MANDATORY TEXT (exact, verbatim): "${text}" — render as one block.`;
  
  const i = text.indexOf(",");
  if (i === -1) return `MANDATORY TEXT (exact, verbatim): "${text}" — render as one block.`;
  
  const top = text.slice(0, i).trim();
  const bottom = text.slice(i + 1).trim();
  
  // Only split if both halves are reasonably short (< 60 chars) - typical meme format
  // Otherwise treat as a single sentence with grammatical comma
  if (top.length > 60 || bottom.length > 60) {
    return `MANDATORY TEXT (exact, verbatim): "${text}" — render as one block.`;
  }
  
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

// Keep the selected layout without auto-switching
function enforceLayout(key: string, completedText: string, thresh = 12) {
  // Removed auto-switching logic - respect user's layout choice
  return key;
}

// NEW: Minimum text coverage per layout (reduced by 5% for better balance)
function minCoverageForLayout(key: string): number {
  switch (key) {
    case "badge-callout": return 20;   // reduced from 25%
    case "meme-text":     return 18;   // reduced from 20%
    case "caption":       return 15;   // already at minimum
    case "negative-space":return 20;   // reduced from 22%
    case "integrated-in-scene": return 20;  // reduced from 22%
    case "dynamic-overlay":    return 18;   // keep at 18%
    default: return 20;
  }
}

// Join lines to single line (API), cap words
function collapseLines(lines: string[], maxWords: number) {
  const one = squeeze(lines.filter(Boolean).join(" "));
  return wc(one) > maxWords ? limitWords(one, maxWords) : one;
}

// Clean text for image rendering - removes problematic characters and enforces length limit
function sanitizeTextForImage(text: string): string {
  return text
    .replace(/[""]/g, '"')  // Smart quotes → straight quotes
    .replace(/['']/g, "'")  // Smart apostrophes
    .replace(/—/g, "-")     // Em dash → hyphen
    .replace(/…/g, "...")   // Ellipsis
    .slice(0, 110)          // Max 110 chars for stable rendering
    .trim();
}

// Get optimal text coverage based on length - shorter text needs to be bigger
// Maximum coverage capped at 40% for all layouts
function getOptimalCoverage(text: string, baseMin: number): number {
  const len = text.length;
  let coverage: number;
  
  if (len < 50) coverage = Math.max(baseMin, 35);  // Short text: larger
  else if (len < 80) coverage = baseMin;            // Medium text: use base
  else coverage = Math.max(baseMin - 2, 15);       // Long text: slightly reduce
  
  return Math.min(coverage, 40);  // Cap at 40% max
}

// ============== AI-POWERED PROMPT GENERATION ==============
async function generatePromptTemplates(p: FinalPromptRequest): Promise<PromptTemplate[]> {
  const {
    completed_text,
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
    const cleanText = sanitizeTextForImage(completed_text);
    const optimalCoverage = getOptimalCoverage(cleanText, minPct);
    const typographyStyle = TYPOGRAPHY_STYLES[layoutKey] || TYPOGRAPHY_STYLES["negative-space"];

    // Build detailed context for AI
    const userPrompt = `Format this prompt following the EXACT 3-line structure:

MANDATORY TEXT: "${cleanText}"
TYPOGRAPHY STYLE: ${typographyStyle}
VISUAL STYLE: ${styleStr}
ASPECT RATIO: ${aspect}
SCENE ELEMENTS: ${visPhrase}
${tags.length > 0 ? `ADDITIONAL VISUALS: ${tags.join(", ")}` : ""}

Remember: The text is what gets DISPLAYED. Use scene elements and visuals for what's IN the scene.`;

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
      
      // Combine the three lines
      const positive_prompt = `${result.text_line}\n${result.style_line}\n${result.scene_line}`;
      
      console.log(`Layout ${layoutKey} - Structured prompt:`);
      console.log(`Line 1:`, result.text_line);
      console.log(`Line 2:`, result.style_line);
      console.log(`Line 3:`, result.scene_line);
      console.log(`Negative:`, result.negative_prompt);

      prompts.push({
        name: `${layoutKey}`,
        description: `Clean structured prompt for ${layoutKey} layout`,
        positive: positive_prompt,
        negative: result.negative_prompt,
        sections: {
          aspect,
          layout: layoutKey,
          mandatoryText: cleanText,
          typography: `modern sans-serif; ${optimalCoverage}% coverage; no panels`,
          scene: visPhrase,
          mood: tone,
          tags,
          pretty: positive_prompt
        }
      });

    } catch (error) {
      console.error(`Error generating prompt for layout ${layoutKey}:`, error);
      // Fallback to basic template if AI fails - use 2-line flowing structure
      const cleanText = sanitizeTextForImage(completed_text);
      const optimalCoverage = getOptimalCoverage(cleanText, minPct);
      
      const fallbackPositive = `TEXT: exactly reads "${cleanText}"
STYLE: ${typographyStyle}, evenly spaced letters
SCENE: ${styleStr} ${visPhrase}, cinematic lighting, ${aspect}`;
      
      const fallbackNegative = "misspelled text, broken letters, split characters, extra words";
      
      prompts.push({
        name: `Fallback — ${layoutKey}`,
        description: `Fallback template (AI generation failed)`,
        positive: fallbackPositive,
        negative: fallbackNegative,
        sections: {
          aspect,
          layout: layoutKey,
          mandatoryText: cleanText,
          typography: `modern sans-serif; ${optimalCoverage}% coverage`,
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

// ============== IDEOGRAM (dynamic variable-driven system) ==============

// ============== LAYOUT TEMPLATE SYSTEM ==============

// Universal template for all layouts
const UNIVERSAL_PROMPT_TEMPLATE = `A {composition_mode} {image_style} photograph of {visual_subject} in {visual_setting}. 
{lighting_description} create a {tone_atmosphere} atmosphere with {color_grading}.
A very light transparent black overlay (~{overlay_opacity}% opacity) is applied evenly across the entire image to improve contrast, while maintaining brightness and clarity.
The text exactly reads "{completed_text}" rendered exactly as typed in bold condensed sans-serif font, matte pure white, cleanly spaced, with crisp edges and a slight daylight glow, covering about {text_coverage}% of the image and positioned naturally in the {text_position}.
{subject_quality_notes}`;

// Universal negative prompt
const UNIVERSAL_NEGATIVE_PROMPT = "misspelled text, warped letters, distorted faces, cartoonish style, dark shadows, harsh contrast, oversaturated colors, fake lighting, black box behind text, text covering faces, cluttered composition";

// Template object structure
type LayoutKey = "negative-space" | "integrated-in-scene" | "meme-text" | "caption" | "badge-callout" | "dynamic-overlay";

// ============== TEMPLATE INTERPOLATION ==============

// Interpolate {variable} placeholders in template string
function interpolateTemplate(template: string, vars: Record<string, any>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    if (value === undefined || value === null) {
      console.warn(`Missing variable in template: {${key}}`);
      return "";
    }
    return String(value);
  });
}

// Build complete variables object for template interpolation
function buildVariablesObject(p: FinalPromptRequest, layoutKey: LayoutKey): Record<string, any> {
  // NEW: Color grading by tone
  const colorGradingMap: Record<string, string> = {
    humorous: "rich vibrant color grading",
    savage: "subtle depth and clean highlights",
    sentimental: "warm golden color grading with soft bloom",
    inspirational: "balanced natural color grading with cinematic depth"
  };

  // NEW: Text positioning by layout
  const textPositionMap: Record<LayoutKey, string> = {
    "negative-space": "open negative space to the left",
    "meme-text": "top and bottom",
    "caption": "bottom caption area",
    "badge-callout": "floating badge in clear space",
    "integrated-in-scene": "integrated naturally into a surface in the scene",
    "dynamic-overlay": "diagonal overlay across the frame"
  };

  // NEW: Tone atmosphere descriptors
  const toneAtmosphereMap: Record<string, string> = {
    humorous: "lighthearted and playful",
    savage: "golden-hour",
    sentimental: "warm and intimate",
    inspirational: "uplifting and cinematic"
  };

  // EXPANDED: Lighting descriptions (more natural language)
  const lightingMap: Record<string, string> = {
    humorous: "Warm natural light streaming through windows",
    savage: "Warm natural light streaming through large windows",
    sentimental: "Soft golden light with gentle warmth",
    inspirational: "Bright balanced daylight with natural bloom"
  };

  // NEW: Subject quality notes by style
  const subjectQualityMap: Record<string, string> = {
    realistic: "The subject's face is clear and natural, realistic proportions, smooth skin, and accurate expression.",
    "3d-render": "The subject has clean 3D modeling with natural proportions and smooth surfaces.",
    anime: "The subject has clean anime styling with accurate proportions and expressive features.",
    general: "The subject is clearly rendered with natural proportions and accurate details."
  };

  const textCoverageByLayout: Record<string, [number, number]> = {
    "negative-space": [20, 28],
    "integrated-in-scene": [20, 28],
    "meme-text": [20, 30],
    "caption": [12, 18],
    "badge-callout": [12, 18],
    "dynamic-overlay": [18, 24]
  };

  const overlayOpacityByLayout: Record<LayoutKey, number> = {
    "negative-space": 8,
    "integrated-in-scene": 8,
    "meme-text": 14,
    "caption": 10,
    "badge-callout": 12,
    "dynamic-overlay": 12
  };

  const tone = (p.tone || "humorous").toLowerCase();
  const style = (p.image_style || "realistic").toLowerCase();
  
  // Use provided photographic descriptions directly
  const visual_subject = p.visual_subject?.trim() || "a subject in context";
  const visual_setting = p.visual_setting?.trim() || "an atmospheric setting";

  const [minCov, maxCov] = textCoverageByLayout[layoutKey] || [15, 25];
  const text_coverage = Math.floor(Math.random() * (maxCov - minCov + 1)) + minCov;

  return {
    completed_text: sanitizeTextForImage(p.completed_text),
    visual_subject,
    visual_setting,
    lighting_description: lightingMap[tone] || lightingMap.humorous,
    tone_atmosphere: toneAtmosphereMap[tone] || "atmospheric",
    color_grading: colorGradingMap[tone] || "rich vibrant color grading",
    image_style: style,
    text_coverage,
    text_position: textPositionMap[layoutKey],
    composition_mode: p.composition_modes?.[0] || "cinematic",
    overlay_opacity: overlayOpacityByLayout[layoutKey] || 12,
    subject_quality_notes: subjectQualityMap[style] || subjectQualityMap.general,
    image_dimensions: aspectLabel(p.image_dimensions)
  };
}

async function generateIdeogramPrompts(p: FinalPromptRequest): Promise<PromptTemplate[]> {
  const cleanText = sanitizeTextForImage(p.completed_text);
  
  // Validation check before building prompt
  if (!cleanText || cleanText.trim().length < 3) {
    console.error("Invalid or empty completed_text:", p.completed_text);
    throw new Error("Empty or invalid completed_text passed to image generator");
  }

  // Smart layout selection based on tone (if layout not specified)
  let layoutKey = (p.text_layout as LayoutKey) || "negative-space";
  
  // Auto-select better layout for certain tone/rating combinations
  if (!p.text_layout || p.text_layout === "auto") {
    const tone = (p.tone || "humorous").toLowerCase();
    
    // Tone-specific layout preferences
    const layoutPreferences: Record<string, LayoutKey> = {
      "savage": "negative-space",      // Changed: negative-space works better with new template
      "humorous": "meme-text",         // Humorous works well with classic memes
      "inspirational": "caption",      // Inspirational suits captions
      "sentimental": "negative-space"  // Sentimental needs breathing room
    };
    
    const preferredLayout = layoutPreferences[tone];
    if (preferredLayout) {
      layoutKey = preferredLayout;
      console.log(`Auto-selected ${layoutKey} layout for ${tone} tone`);
    }
  }
  
  // Build variables object for interpolation
  const vars = buildVariablesObject(p, layoutKey);
  
  // Use universal template
  const positive_prompt = interpolateTemplate(UNIVERSAL_PROMPT_TEMPLATE, vars);
  const negative_prompt = UNIVERSAL_NEGATIVE_PROMPT;

  console.log(`Generated ${layoutKey} prompt: ${positive_prompt.length} chars`);

  // Return template result
  const result: PromptTemplate = {
    name: `ideogram-${layoutKey}`,
    description: `Universal Ideogram prompt for ${layoutKey} layout`,
    positive: positive_prompt,
    negative: negative_prompt,
    sections: {
      aspect: vars.image_dimensions,
      layout: layoutKey,
      mandatoryText: cleanText,
      typography: `${layoutKey} style; target ${vars.text_coverage}%`,
      scene: vars.visual_subject,
      mood: p.tone || "humorous",
      tags: normTags(p.specific_visuals),
      pretty: positive_prompt
    }
  };

  return [result];
}
