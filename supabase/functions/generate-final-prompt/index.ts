import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "vary": "Origin"
};

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

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const required = ["completed_text", "image_style", "text_layout", "image_dimensions"];
    const missing = required.filter((f) => !body[f]);
    if (missing.length) return json({ success: false, error: `Missing: ${missing.join(", ")}` }, 400);

    const templates = await generatePromptTemplates(body as FinalPromptRequest);
    return json({ success: true, templates });
  } catch (e) {
    return json({ success: false, error: String((e as Error)?.message || "prompt_generation_failed") }, 500);
  }
});

function splitAtFirstComma(s: string) {
  const i = s.indexOf(",");
  return i >= 0 ? { a: s.slice(0, i).trim(), b: s.slice(i + 1).trim() } : { a: s.trim(), b: "" };
}

function typographyFor(layout: string) {
  switch (layout) {
    case "negative-space":
      return "modern sans-serif, mixed case, high contrast; 1–2 px outline or soft shadow; no banner; placed in open area with 10–15% padding";
    case "subtle-caption":
      return "clean sans-serif, mixed case, medium weight; high contrast; 5–7% padding";
    case "badge-callout":
      return "compact sans-serif; minimal outline; tight line-length; no filled shape";
    case "side-bar":
      return "stacked sans-serif; consistent line height; 6–8% side padding; no panel";
    case "lower-banner":
      return "centered sans-serif; thin outline; no banner fill; margin above bottom edge";
    case "meme-text":
    default:
      return "ALL CAPS white with thin black outline; top and bottom; 6–8% safe padding; no background panels";
  }
}

async function generatePromptTemplates(p: FinalPromptRequest): Promise<PromptTemplate[]> {
  const {
    completed_text, category, subcategory, tone, rating,
    image_style, text_layout, image_dimensions,
    composition_modes = [], visual_recommendation
  } = p;

  // For meme texts, show split explicitly; otherwise keep it simple.
  let splitDetail = "";
  if (text_layout === "meme-text") {
    const { a, b } = splitAtFirstComma(completed_text);
    if (b) splitDetail = `Split at first comma → top="${a}" bottom="${b}".`;
  } else if (text_layout === "negative-space") {
    // tiny definition so humans and models stop guessing
    splitDetail = "Place caption in a clean open area; avoid busy detail around text.";
  }

  const ctx = [category, subcategory].filter(Boolean).join("/");
  const comp = composition_modes.length ? `${composition_modes[0]} composition.` : "balanced composition.";

  // Compact, contradiction-free Gemini positive prompt (<80 words target)
  const positive = [
    `MANDATORY TEXT: "${completed_text}"`,
    `Layout: ${text_layout}. ${splitDetail}`.trim(),
    `Typography: ${typographyFor(text_layout)}.`,
    `Style: ${image_style}; Aspect: ${image_dimensions}; Tone: ${tone}; Rating: ${rating}.`,
    `Scene: ${ctx}. ${visual_recommendation ? `Visuals: ${visual_recommendation}.` : ""}`.trim(),
    `Look: bright key light, vivid saturation, crisp focus, cinematic contrast.`
  ].join(" ");

  return [{
    name: "Gemini 2.5 Template",
    description: `Compact ${ctx} prompt with ${tone}/${rating}; typography obeys ${text_layout} rules.`,
    positive,
    negative: "" // Gemini: positive-only
  }];
}
