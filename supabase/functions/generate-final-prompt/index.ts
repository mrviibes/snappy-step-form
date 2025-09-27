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
  tone: string;                     // e.g., "humorous"
  rating: string;                   // kept for future use; not printed in minimal two-liner
  insertWords?: string[];
  image_style: string;              // e.g., "realistic"
  text_layout: string;              // one of your 6 ids
  image_dimensions: string;         // "square" | "portrait" | "landscape" | "custom"
  composition_modes?: string[];
  visual_recommendation?: string;   // the “where Jesse…” sentence fragment
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

// Compact layout tag phrases for Gemini
const layoutTagShort: Record<string, string> = {
  "negative-space": "clean modern text, open area",
  "meme-text": "bold top/bottom meme text",
  "lower-banner": "strong bottom banner caption",
  "side-bar": "vertical side stacked text",
  "badge-callout": "floating stylish text badge",
  "subtle-caption": "small understated corner caption"
};

function aspectLabel(dim: string) {
  const d = (dim || "").toLowerCase();
  if (d === "square") return "square 1:1";
  if (d === "portrait") return "portrait 9:16";
  if (d === "landscape") return "landscape 16:9";
  // if custom, let caller pass specifics inside visual_recommendation if needed
  return "";
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

async function generatePromptTemplates(p: FinalPromptRequest): Promise<PromptTemplate[]> {
  const {
    completed_text,
    category,
    subcategory,
    tone,
    image_style,
    text_layout,
    image_dimensions,
    visual_recommendation = ""
  } = p;

  // Build the exact minimal style you asked for
  const cat = (subcategory || category || "").toLowerCase().trim();
  const toneStr = (tone || "").toLowerCase().trim();
  const styleStr = (image_style || "").toLowerCase().trim();
  const aspect = aspectLabel(image_dimensions);
  const where = visual_recommendation.trim().replace(/^\s*where\s+/i, "where ");

  // First line: A realistic humorous wedding scene where ...
  // Include aspect if present, but keep it light.
  const aspectChunk = aspect ? ` ${aspect},` : "";
  const positiveLine1 =
    `A ${styleStr}${aspectChunk} ${toneStr} ${cat} scene ${where || ""}`.replace(/\s+/g, " ").trim().replace(/\.\s*$/, "") + ".";

  // Second line: With exact text "..." in (layout): <short tag>
  const layoutKey = String(text_layout || "").toLowerCase();
  const layoutTag = layoutTagShort[layoutKey] || "clean readable caption placement";
  const positiveLine2 =
    `With exact text "${completed_text}" in (${layoutKey}): ${layoutTag}`;

  const positive = `${positiveLine1}\n\n${positiveLine2}`;

  return [{
    name: "Gemini 2.5 Minimal",
    description: "Two-line compact prompt with exact text and concise layout tag.",
    positive,
    negative: "" // Gemini: positive-only
  }];
}
