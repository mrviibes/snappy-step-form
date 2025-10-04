import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
            action: { type: "string", minLength: 8, maxLength: 140 },
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

// Helper to build concise system prompt
function buildVisualSystem(caption: string, style?: string, compositionPref?: string, category?: string, subcategory?: string, tone?: string, rating?: string, brightnessNote?: string) {
  return [
    `Create 4 distinct visual concepts for this caption: "${caption}"`,
    "Each concept must be SPECIFIC and shootable: one clear subject, one setting, one action, one comedic prop.",
    "Return JSON only with: title, subject, setting, action, prop, camera, lens, lighting, color, composition, readability.",
    "Use realistic photo style; no cartoon/3D. Leave clean negative space per 'readability'.",
    "Cover at least 3 different compositions across the set.",
    compositionPref ? `Include one concept using ${compositionPref} composition.` : "",
    brightnessNote || "",
    category ? `Category: ${category}, Subcategory: ${subcategory || ''}`.trim() : "",
    tone ? `Tone: ${tone}, Rating: ${rating || ''}`.trim() : "",
    style ? `Style: ${style}` : "",
    "Ban filler like 'humorous scene', 'natural proportions', 'clean perspective', 'high quality', 'beautiful'.",
    "Return exactly 4 concepts."
  ].filter(Boolean).join("\n");
}

function validateConcepts(cs: any[]) {
  const titles = new Set(cs.map(c => (c.title || "").toLowerCase().trim()));
  const comps  = new Set(cs.map(c => c.composition));
  const fieldsOk = cs.every(c =>
    c.title && c.subject && c.setting && c.action && c.prop &&
    c.camera && c.lens && c.lighting && c.color && c.composition && c.readability
  );
  if (!fieldsOk) return "missing_fields";
  if (titles.size !== 4) return "duplicate_titles";
  if (comps.size < 3) return "low_composition_variety";
  return null;
}

// ---------- Responses API Call ----------
async function callResponsesAPI(
  systemPrompt: string,
  userObj: unknown,
  maxTokens: number = 360
): Promise<any> {
  const model = getVisualsModel();
  
  const requestBody: any = {
    model,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(userObj) }
    ],
    max_output_tokens: maxTokens,
    text: {
      format: {
        type: "json_schema",
        name: VIS_SCHEMA.name,
        strict: VIS_SCHEMA.strict,
        schema: VIS_SCHEMA.schema,
        // Some deployments still require a nested json_schema wrapper
        json_schema: {
          strict: VIS_SCHEMA.strict,
          schema: VIS_SCHEMA.schema
        }
      }
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  const response = await fetch("https://api.openai.com/v1/responses", {
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
  userObj: unknown,
  maxTokens: number = 360
): Promise<any> {
  const p1 = callResponsesAPI(systemPrompt, userObj, maxTokens);
  const p2 = new Promise<any>((resolve) => {
    const t = setTimeout(async () => {
      try { resolve(await callResponsesAPI(systemPrompt, userObj, maxTokens)); }
      catch { resolve(null); }
    }, 250);
    p1.finally(() => clearTimeout(t));
  });
  const raced = Promise.race([p1, p2]);
  // Swallow loser rejections to avoid unhandled promise rejection
  p1.catch(() => {});
  (p2 as Promise<any>).catch?.(() => {});
  return raced;
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
  const compPref = composition_modes?.[0];
  const systemPrompt = buildVisualSystem(
    completed_text,
    image_style,
    compPref,
    category,
    subcategory,
    tone,
    rating,
    brightnessNote
  );

  try {
    if (DEBUG) console.log("Calling Responses API with caption:", completed_text);

    const userPayload = { caption: completed_text, style: image_style, composition: compPref, category, subcategory, tone, rating };
    let data = await callResponsesAPIFast(systemPrompt, userPayload, 360);

    // Try Responses API structured output first
    let concepts: any[] | undefined;
    if (Array.isArray(data?.output_parsed?.concepts)) {
      concepts = data.output_parsed.concepts;
    } else if (Array.isArray(data?.output)) {
      const blocks = data.output?.[0]?.content || [];
      for (const b of blocks) {
        if (b?.type === "json_schema" && Array.isArray(b?.parsed?.concepts)) { concepts = b.parsed.concepts; break; }
        if (b?.type === "output_text" && typeof b?.text === "string") {
          try { const maybe = JSON.parse(b.text); if (Array.isArray(maybe?.concepts)) { concepts = maybe.concepts; break; } } catch {}
        }
      }
    } else if (typeof data?.choices?.[0]?.message?.content === "string") {
      try { const maybe = JSON.parse(data.choices[0].message.content); if (Array.isArray(maybe?.concepts)) concepts = maybe.concepts; } catch {}
    }

    // Strict retry if not 4
    if (!Array.isArray(concepts) || concepts.length !== 4) {
      const STRICT = systemPrompt + "\nCRITICAL: You must return an array 'concepts' with exactly 4 items that match the schema.";
      data = await callResponsesAPI(STRICT, userPayload, 420);
      if (Array.isArray(data?.output_parsed?.concepts)) {
        concepts = data.output_parsed.concepts;
      } else if (Array.isArray(data?.output)) {
        const blocks = data.output?.[0]?.content || [];
        for (const b of blocks) {
          if (b?.type === "json_schema" && Array.isArray(b?.parsed?.concepts)) { concepts = b.parsed.concepts; break; }
          if (b?.type === "output_text" && typeof b?.text === "string") {
            try { const maybe = JSON.parse(b.text); if (Array.isArray(maybe?.concepts)) { concepts = maybe.concepts; break; } } catch {}
          }
        }
      }
      if (!Array.isArray(concepts) || concepts.length !== 4) {
        throw new Error("model_did_not_return_4_concepts");
      }
    }

    // Diversity/readability validation
    const vErr = validateConcepts(concepts);
    if (vErr) {
      const STRICT2 = systemPrompt + "\nCRITICAL: All titles must be unique and include at least 3 different compositions across the set.";
      const data2 = await callResponsesAPI(STRICT2, userPayload, 420).catch(() => null);
      let concepts2: any[] | undefined;
      if (data2) {
        if (Array.isArray(data2?.output_parsed?.concepts)) concepts2 = data2.output_parsed.concepts;
        else if (Array.isArray(data2?.output)) {
          const blocks2 = data2.output?.[0]?.content || [];
          for (const b of blocks2) {
            if (b?.type === "json_schema" && Array.isArray(b?.parsed?.concepts)) { concepts2 = b.parsed.concepts; break; }
            if (b?.type === "output_text" && typeof b?.text === "string") {
              try { const maybe = JSON.parse(b.text); if (Array.isArray(maybe?.concepts)) { concepts2 = maybe.concepts; break; } } catch {}
            }
          }
        }
      }
      if (!concepts2 || validateConcepts(concepts2)) {
        throw new Error(`validation_failed: ${vErr}`);
      }
      concepts = concepts2;
    }

    // Map to output format
    const visuals = concepts.map((c: any) => ({
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
        diversityCheck: true,
        compositionCount: new Set(concepts.map((c:any) => c.composition)).size
      }
    };
  } catch (error) {
    console.error("Error generating visuals:", error);
    const msg = error instanceof Error ? error.message : String(error);
    let status = 500;
    if (msg.includes("timeout")) status = 408;
    if (msg.includes("required") || msg.includes("Caption")) status = 400;
    if (msg.includes("validation_failed")) status = 422;
    if (msg.includes("OpenAI")) status = 502;
    
    throw { status, message: msg };
  }
}

// ---------- Main handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Dry-run mode for testing
  const url = new URL(req.url);
  if (url.searchParams.get("dry") === "1") {
    return new Response(JSON.stringify({
      success: true,
      visuals: [
        {
          title: "Museum Tag",
          subject: "vintage jacket on mannequin",
          setting: "small museum wall",
          action: "curator adds 'avoid direct sunlight' tag",
          prop: "archival gloves",
          camera: "medium",
          lens: "35mm",
          lighting: "soft daylight",
          color: "neutral clean",
          composition: "base_realistic",
          readability: "negative-right",
          description: "Museum Tag • vintage jacket on mannequin • small museum wall"
        },
        {
          title: "Sunburn Test",
          subject: "guest with retro sunglasses",
          setting: "backyard patio",
          action: "friend measures skin with light meter like artwork",
          prop: "light meter",
          camera: "wide",
          lens: "24mm",
          lighting: "hard flash",
          color: "punchy saturated",
          composition: "goofy_wide",
          readability: "bottom-caption",
          description: "Sunburn Test • guest with retro sunglasses • backyard patio"
        },
        {
          title: "Fragile Sticker",
          subject: "birthday guest wearing FRAGILE sticker",
          setting: "living room party",
          action: "friend rotates them like collectible figure",
          prop: "FRAGILE tape",
          camera: "close-up",
          lens: "50mm",
          lighting: "warm kitchen",
          color: "muted pastels",
          composition: "very_close",
          readability: "negative-left",
          description: "Fragile Sticker • birthday guest wearing FRAGILE sticker • living room party"
        },
        {
          title: "Display Case",
          subject: "cake slice under glass cloche",
          setting: "kitchen counter museum-style",
          action: "label card jokes about vintage specimen",
          prop: "mini placard",
          camera: "medium",
          lens: "35mm",
          lighting: "studio key",
          color: "neutral clean",
          composition: "integrated",
          readability: "integrated-sign",
          description: "Display Case • cake slice under glass cloche • kitchen counter museum-style"
        }
      ],
      model: "dry-run",
      req_id: "test-dry",
      source: "fallback"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const params = await req.json();
    
    // Validate required caption
    if (!params.completed_text || typeof params.completed_text !== "string" || params.completed_text.length < 8) {
      return err(400, "completed_text is required and must be at least 8 characters");
    }
    
    const result = await generateVisuals(params);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in generate-visuals function:", error);
    const req_id = crypto.randomUUID().slice(0, 8);
    const status = error?.status || 500;
    const msg = error?.message || (error instanceof Error ? error.message : String(error));
    
    return err(status, msg, { req_id });
  }
});
