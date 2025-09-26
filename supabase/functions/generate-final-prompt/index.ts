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

interface FinalPromptResponse {
  success: boolean;
  templates?: PromptTemplate[];
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "POST only" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    console.log("📥 Request received:", body);

    // Validate required fields
    const required = ["completed_text", "image_style", "text_layout", "image_dimensions"];
    const missing = required.filter((f) => !body[f]);
    if (missing.length) {
      return json(
        { success: false, error: `Missing required fields: ${missing.join(", ")}` },
        400
      );
    }

    const templates = await generatePromptTemplates(body);
    console.log("✅ Generated templates:", templates.length);

    return json({ success: true, templates });
  } catch (e) {
    console.error("❌ Generation error:", e);
    return json(
      { success: false, error: String((e as Error)?.message || "prompt_generation_failed") },
      500
    );
  }
});

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders });
}

async function generatePromptTemplates(params: FinalPromptRequest): Promise<PromptTemplate[]> {
  const {
    completed_text,
    category,
    subcategory,
    tone,
    rating,
    image_style,
    text_layout,
    image_dimensions,
    composition_modes = [],
    visual_recommendation
  } = params;

  // Handle meme-text splitting
  let textLayoutDetail = "";
  if (text_layout === "meme-text") {
    const commaIndex = completed_text.indexOf(",");
    if (commaIndex !== -1) {
      const topText = completed_text.substring(0, commaIndex).trim();
      const bottomText = completed_text.substring(commaIndex + 1).trim();
      textLayoutDetail = `Split at first comma → top text = "${topText}" bottom text = "${bottomText}".`;
    }
  }

  // Build category context
  const categoryContext = [category, subcategory].filter(Boolean).join("/");

  // Pick first composition mode if provided
  const composition = composition_modes.length ? `Composition: ${composition_modes[0]}.` : "";

  // Visual recommendation
  const visuals = visual_recommendation ? `Visuals: ${visual_recommendation}.` : "";

  // Build Gemini-optimized prompt
  const geminiPrompt = `MANDATORY TEXT: "${completed_text}"

Layout: ${text_layout}. ${textLayoutDetail}

Typography: ALL CAPS, bold, white text with thin black outline, directly on image.
Do not use solid background banners.
Add padding so top text sits below top edge, bottom text sits above bottom edge.

Scene: ${categoryContext}, ${image_style}, ${image_dimensions}, tone=${tone}, rating=${rating}.
${composition}
${visuals}

Look: bright key light, vivid saturation, crisp focus, cinematic contrast.`;

  // Return Gemini template
  return [
    {
      name: "Gemini 2.5 Template",
      description: `Optimized ${categoryContext} template with ${tone} tone for ${rating} content`,
      positive: geminiPrompt.trim(),
      negative: "" // Gemini doesn’t need negatives
    }
  ];
}
