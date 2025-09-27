import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { visual_rules, subcategory_contexts } from "../_shared/visual-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getVisualsModel = () => Deno.env.get("OPENAI_VISUALS_MODEL") || "gpt-4o-mini";
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

// ---------- OpenAI request builder ----------
function buildOpenAIRequest(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { maxTokens: number }
) {
  const body: any = { model, messages };
  if (model.startsWith("gpt-5") || model.startsWith("o3") || model.startsWith("o4")) {
    body.max_completion_tokens = options.maxTokens;
  } else {
    body.max_tokens = options.maxTokens;
    body.temperature = 0.9;
  }
  return body;
}

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
}

interface GenerateVisualsResponse {
  success: boolean;
  visuals: { description: string }[];
  model: string;
  debug?: { lengths: number[]; validCount: number; literalCount: number; keywords: string[] };
  error?: string;
}

// ---------- Core generation ----------
async function generateVisuals(params: GenerateVisualsParams): Promise<GenerateVisualsResponse> {
  if (!openAIApiKey) throw new Error("OpenAI API key not found");

  const model = getVisualsModel();
  const {
    category, subcategory, tone, rating,
    insertWords = [], composition_modes = [],
    image_style, completed_text
  } = params;

  const subCtx = subcategory_contexts[subcategory?.toLowerCase()] || subcategory_contexts.default;

  // Simple system prompt
  const systemPrompt = `${visual_rules}

INPUTS
- Category: ${category}
- Subcategory: ${subcategory}
- Tone: ${tone}
- Rating: ${rating}
- Style: ${image_style}
- Insert words: ${insertWords.join(", ") || "none"}
- Composition modes: ${composition_modes.join(", ") || "none"}
- Text content: "${completed_text}"

CONTEXT: ${subCtx}

Generate exactly 4 visual scene descriptions (7-12 words each). Follow all rules above.`;

  const userPrompt = "Generate 4 distinct visual scenes based on the inputs and rules provided.";

  try {
    const req = buildOpenAIRequest(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { maxTokens: 240 });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(req)
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    let lines = content.split(/\r?\n+/).map((s: string) => s.trim()).filter(Boolean);
    
    // Take first 4 lines or pad if needed
    while (lines.length < 4) {
      lines.push(`Visual scene for ${subcategory}`);
    }
    
    const visuals = lines.slice(0, 4).map((description: string) => ({ description }));

    return {
      success: true,
      visuals,
      model: data.model || model,
      debug: { lengths: [], validCount: visuals.length, literalCount: 0, keywords: [] }
    };
  } catch (error) {
    console.error("Error generating visuals:", error);
    return {
      success: false,
      visuals: [],
      model,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ---------- Main handler ----------
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params = await req.json();
    const result = await generateVisuals(params);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-visuals function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      visuals: [],
      model: getVisualsModel(),
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
