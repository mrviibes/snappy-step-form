import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getVisualsModel = () => Deno.env.get("OPENAI_VISUALS_MODEL") || "gpt-5-mini-2025-08-07";
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
const DEBUG = Deno.env.get("DEBUG_VISUALS") === "true";

// ---------- Structured Visual Schema ----------
const VIS_SCHEMA = {
  name: "ViibeVisualV2",
  strict: true,
  schema: {
    type: "object",
    required: ["concepts"],
    additionalProperties: false,
    properties: {
      concepts: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title","subject","setting","action","prop","camera","lens","lighting","color","composition","readability"],
          properties: {
            title: { type: "string", minLength: 3, maxLength: 40 },
            subject: { type: "string", minLength: 3, maxLength: 60 },
            setting: { type: "string", minLength: 3, maxLength: 60 },
            action: { type: "string", minLength: 6, maxLength: 120 },
            prop: { type: "string", minLength: 3, maxLength: 40 },
            camera: { type: "string", enum: ["close-up", "medium", "wide", "overhead"] },
            lens: { type: "string", enum: ["24mm","35mm","50mm"] },
            lighting: { type: "string", enum: ["soft daylight","hard flash","warm kitchen","studio key"] },
            color: { type: "string", enum: ["muted pastels","punchy saturated","neutral clean"] },
            composition: { type: "string", enum: ["base_realistic","very_close","zoomed","goofy_wide","surreal_scale","integrated"] },
            readability: { type: "string", enum: ["negative-left","negative-right","bottom-caption","integrated-sign"] }
          }
        }
      }
    }
  }
};

// ---------- Types ----------
interface GenerateVisualsParams {
  category: string;
  subcategory: string;
  tone: string;
  rating: string;
  insertWords?: string[];
  composition_modes?: string[];
  image_style: string;
  completed_text: string;
  count: number;
  specific_visuals?: string[];
}

interface VisualConcept {
  title: string;
  subject: string;
  setting: string;
  action: string;
  prop: string;
  camera: string;
  lens: string;
  lighting: string;
  color: string;
  composition: string;
  readability: string;
  description?: string;
}

interface GenerateVisualsResponse {
  success: boolean;
  visuals: VisualConcept[];
  model: string;
  req_id: string;
  debug?: { diversityCheck: boolean; compositionCount: number };
  error?: string;
}

// ---------- Diversity Validator ----------
function checkDiversity(concepts: any[]): { diverse: boolean; reason?: string } {
  const titles = new Set(concepts.map(c => c.title.toLowerCase()));
  const compositions = new Set(concepts.map(c => c.composition));
  
  if (titles.size < 4) {
    return { diverse: false, reason: "duplicate titles" };
  }
  if (compositions.size < 3) {
    return { diverse: false, reason: "need 3+ composition styles" };
  }
  
  return { diverse: true };
}

// ---------- Responses API Call ----------
async function callResponsesAPI(
  systemPrompt: string,
  maxTokens: number
): Promise<any> {
  const model = getVisualsModel();
  
  const requestBody: any = {
    model,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Return 4 distinct concepts now." }
    ],
    max_output_tokens: maxTokens,
    text: {
      format: {
        type: "json_schema",
        name: VIS_SCHEMA.name,
        strict: true,
        schema: VIS_SCHEMA.schema
      }
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), 20000);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      "Authorization": `Bearer ${openAIApiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  }).catch((e) => {
    throw new Error(e?.name === "AbortError" ? "timeout" : String(e));
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI ${response.status}: ${body.slice(0, 500)}`);
  }

  return response.json();
}

// ---------- Hedged API Call ----------
async function callResponsesAPIFast(
  systemPrompt: string,
  maxTokens: number
): Promise<any> {
  const p1 = callResponsesAPI(systemPrompt, maxTokens);
  const p2 = new Promise<any>((resolve) => {
    const t = setTimeout(() => resolve(callResponsesAPI(systemPrompt, maxTokens)), 250);
    p1.finally(() => clearTimeout(t));
  });
  return Promise.race([p1, p2]);
}

// ---------- Core generation ----------
async function generateVisuals(params: GenerateVisualsParams): Promise<GenerateVisualsResponse> {
  if (!openAIApiKey) throw new Error("OpenAI API key not found");

  const req_id = crypto.randomUUID().slice(0, 8);
  const model = getVisualsModel();
  const {
    category, subcategory, tone, rating,
    composition_modes = [],
    image_style, completed_text, specific_visuals = []
  } = params;

  // Add category-specific brightness rules
  const brightnessNote = category.toLowerCase() === "celebrations"
    ? "\nBRIGHTNESS: scenes must be bright, vibrant, well-lit, cheerful. Avoid moody lighting."
    : "";

  // Build caption-focused system prompt
  const systemPrompt = `Create 4 distinct visual concepts for this caption:
"${completed_text}"

RULES:
- Each concept MUST be SPECIFIC and shootable: one clear subject, one setting, one action, one comedic prop
- Tie the concept to the caption's idea (not generic "humorous scene")
- Return JSON only with fields: title, subject, setting, action, prop, camera, lens, lighting, color, composition, readability
- One concept per composition style; cover at least 3 different compositions
- Respect readability: leave clean negative space in the stated area
- Realistic photo style; no 3D, no cartoon
- BAN these words: "humorous scene", "natural proportions", "clean perspective", "high quality", "beautiful"

CONTEXT:
- Category: ${category}, Subcategory: ${subcategory}
- Tone: ${tone}, Rating: ${rating}
- Style: ${image_style}${brightnessNote}`;

  try {
    if (DEBUG) console.log("Calling Responses API with caption:", completed_text);
    
    const data = await callResponsesAPIFast(systemPrompt, 450);
    const content = data.choices?.[0]?.message?.content || "";

    if (DEBUG) console.log("Raw API response content:", content.slice(0, 200));

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      throw new Error("Invalid JSON from model");
    }

    if (!parsed?.concepts || !Array.isArray(parsed.concepts) || parsed.concepts.length !== 4) {
      throw new Error("Model did not return 4 concepts");
    }

    const diversityCheck = checkDiversity(parsed.concepts);
    if (!diversityCheck.diverse && DEBUG) {
      console.warn(`Diversity issue: ${diversityCheck.reason}`);
    }

    // Map to output format
    const visuals = parsed.concepts.map((c: any) => ({
      title: c.title,
      subject: c.subject,
      setting: c.setting,
      action: c.action,
      prop: c.prop,
      camera: c.camera,
      lens: c.lens,
      lighting: c.lighting,
      color: c.color,
      composition: c.composition,
      readability: c.readability,
      description: `${c.title} • ${c.subject} • ${c.setting}` // For backward compat
    }));

    if (DEBUG) console.log("Processed visuals:", visuals.length);

    return {
      success: true,
      visuals,
      model: data.model || model,
      req_id,
      debug: {
        diversityCheck: diversityCheck.diverse,
        compositionCount: new Set(parsed.concepts.map((c:any) => c.composition)).size
      }
    };
  } catch (error) {
    console.error("Error generating visuals:", error);
    return {
      success: false,
      visuals: [],
      model,
      req_id,
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
    const req_id = crypto.randomUUID().slice(0, 8);
    return new Response(JSON.stringify({
      success: false,
      visuals: [],
      model: getVisualsModel(),
      req_id,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
