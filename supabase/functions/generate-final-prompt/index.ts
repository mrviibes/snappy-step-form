import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { final_prompt_rules_gemini, layoutTagShort, dimensionMap, toneMap, ratingMap, textQualityNegatives, getCategoryNegatives } from "../_shared/final-prompt-rules.ts";

// ============== MODEL ==============
const getFinalPromptModel = () => Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o-mini";
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

// ============== CORS ==============
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============== INTERFACES ==============
interface FinalPromptRequest {
  completed_text: string;
  category: string;
  subcategory?: string;
  tone: string;
  rating: string;
  insertWords?: string[];
  image_style: string;
  text_layout: string;
  image_dimensions: string;
  composition_modes?: string[];
  visual_recommendation?: string;
}

interface PromptTemplate {
  name: string;
  positive: string;
  negative: string;
  description: string;
}

// ============== OPENAI CALL ==============
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

async function callOpenAI(systemPrompt: string, userPrompt: string) {
  let model = getFinalPromptModel();
  let maxTokens = model.startsWith("gpt-5") ? 1000 : 600;

  try {
    const req = buildOpenAIRequest(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { maxTokens });

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(req)
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const content = d.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty content");
    return { content, model: d.model || model };

  } catch {
    model = "gpt-4o-mini";
    const req = buildOpenAIRequest(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { maxTokens: 400, temperature: 0.3 });

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(req)
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const content = d.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty content (fallback)");
    return { content, model };
  }
}

// ============== HELPER FUNCTIONS ==============
function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { 
    status, 
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function aspectLabel(dim: string) {
  const d = (dim || "").toLowerCase();
  if (d === "square") return "square 1:1";
  if (d === "portrait") return "portrait 9:16";
  if (d === "landscape") return "landscape 16:9";
  return "";
}

// ============== HTTP ==============
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const required = ["completed_text", "image_style", "text_layout", "image_dimensions"];
    const missing = required.filter((f) => !body[f]);
    if (missing.length) return json({ success: false, error: `Missing: ${missing.join(", ")}` }, 400);

    const templates = await generatePromptTemplates(body as FinalPromptRequest);
    return json({ success: true, templates });
  } catch (e) {
    console.error('Generate final prompt error:', e);
    return json({ success: false, error: String((e as Error)?.message || "prompt_generation_failed") }, 500);
  }
});

async function generatePromptTemplates(p: FinalPromptRequest): Promise<PromptTemplate[]> {
  const {
    completed_text,
    category,
    tone,
    rating,
    image_style,
    text_layout,
    image_dimensions,
    visual_recommendation = ""
  } = p;

  // Map variables for the prompt structure
  const aspect = aspectLabel(image_dimensions) || "square 1:1";
  const styleStr = image_style?.toLowerCase() || "realistic";
  const toneStr = toneMap[tone?.toLowerCase()] || tone?.toLowerCase() || "humorous";
  const layoutKey = text_layout?.toLowerCase() || "negative-space";
  const layoutDescription = layoutTagShort[layoutKey] || "clean readable caption placement";
  
  // Build the structured prompt
  const positive = `Base Image
Generate a ${aspect} ${styleStr} image.

Text
Include the text: "${completed_text}"
Use a ${layoutDescription} (randomized each run).
Typography must be sharp, clean, modern, perfectly legible.
Avoid distortions or gibberish.

Scene
Design a ${toneStr} scene${visual_recommendation ? ` with ${visual_recommendation}` : ''}.
Keep the overall look playful, stylish, and polished.

Visual Enhancements
Apply vivid colors, bold key lighting, crisp focus, and cinematic contrast.
Add fresh, professional polish so the final image feels cool and visually striking.`;

  let negative = textQualityNegatives;

  // Add category-specific negatives
  if (category && rating) {
    const categoryNegs = getCategoryNegatives(category, rating);
    if (categoryNegs) {
      negative += `, ${categoryNegs}`;
    }
  }

  return [{
    name: "Structured Prompt",
    description: "Using structured prompt format with clear sections.",
    positive,
    negative
  }];
}