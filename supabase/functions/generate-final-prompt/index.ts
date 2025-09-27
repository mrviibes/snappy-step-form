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

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders });
}

async function generatePromptTemplates(p: FinalPromptRequest): Promise<PromptTemplate[]> {
  const {
    completed_text, category, subcategory, tone, rating,
    image_style, text_layout, image_dimensions,
    composition_modes = [], visual_recommendation
  } = p;

  // If meme-text, show the split (Gemini likes explicit).
  let splitDetail = "";
  if (text_layout === "meme-text") {
    const idx = completed_text.indexOf(",");
    if (idx !== -1) {
      const top = completed_text.slice(0, idx).trim();
      const bottom = completed_text.slice(idx + 1).trim();
      splitDetail = `Split at first comma → top="${top}" bottom="${bottom}".`;
    }
  }

  const categoryContext = [category, subcategory].filter(Boolean).join("/");
  const composition = composition_modes.length ? `Composition: ${composition_modes[0]}.` : "";
  const visuals = visual_recommendation ? `Visuals: ${visual_recommendation}.` : "";

  // Short, Gemini-optimized positive prompt (no negatives)
  const positive = `MANDATORY TEXT: "${completed_text}"

Layout: ${text_layout}. ${splitDetail}
Typography: ALL CAPS white with thin black outline, directly on image. No background panels. Add padding from edges.

Scene: ${categoryContext}, ${image_style}, ${image_dimensions}, tone=${tone}, rating=${rating}.
${composition}
${visuals}

Look: bright key light, vivid saturation, crisp focus, cinematic contrast.`.trim();

  return [{
    name: "Gemini 2.5 Template",
    description: `Compact ${categoryContext} prompt with ${tone}/${rating}, no background panels.`,
    positive,
    negative: "" // Gemini: positive-only
  }];
}
