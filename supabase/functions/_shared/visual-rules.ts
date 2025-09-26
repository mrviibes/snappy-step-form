import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { visual_rules, subcategory_contexts } from "../_shared/visual-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getVisualsModel = () => Deno.env.get("OPENAI_VISUALS_MODEL") || "gpt-4o-mini";
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

// ---------- helpers ----------
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
    body.temperature = 0.8;
  }
  return body;
}

type Params = {
  category: string;
  subcategory: string;
  tone: string;
  rating: string;
  insertWords?: string[];
  composition_modes?: string[];
  image_style: string;
  completed_text: string;
  count: number;
};

type Resp = {
  success: boolean;
  visuals: { description: string }[];
  model: string;
  debug?: { lengths: number[]; validCount: number };
  error?: string;
};

function getSubcategoryContext(subcategory: string) {
  return subcategory_contexts[subcategory.toLowerCase()] || "general scene, background elements, props";
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function ensureAllInserts(line: string, inserts: string[]) {
  let out = line.trim();
  for (const w of inserts) {
    if (!new RegExp(`\\b${w}\\b`, "i").test(out)) {
      // Prefer "with <w>" to keep semantics and word count tight
      out = `${out} with ${w}`;
    }
  }
  return out;
}

function uniqueByKey(lines: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const k = l.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
    if (out.length === 4) break;
  }
  return out;
}

function enforceVisualRules(rawLines: string[], opts: {
  inserts: string[];
  modes: string[];
  min?: number;
  max?: number;
}) {
  const min = opts.min ?? 7;
  const max = opts.max ?? 12;
  const modes = opts.modes.filter(Boolean);
  const out: string[] = [];

  for (let l of rawLines) {
    l = l.replace(/\s+/g, " ").trim();
    if (!l) continue;

    // make sure a mode is mentioned (pick the first if none found)
    if (!modes.some(m => new RegExp(`\\b${m}\\b`, "i").test(l)) && modes.length) {
      l = `${l}, ${modes[0]}`;
    }

    // enforce inserts in-line
    l = ensureAllInserts(l, opts.inserts);

    // 7–12 words window
    let wc = words(l);
    if (wc < min) continue;
    if (wc > max) {
      // prefer cutting trailing phrase after comma
      if (/,/.test(l)) {
        const parts = l.split(",");
        while (parts.length > 1 && words(parts.join(",")) > max) parts.pop();
        l = parts.join(",").trim();
      }
      // hard cap if still long
      if (words(l) > max) l = l.split(/\s+/).slice(0, max).join(" ");
    }

    out.push(l);
    if (out.length === 8) break; // collect extra for dedup
  }

  return uniqueByKey(out).slice(0, 4);
}

async function callOpenAI(model: string, systemPrompt: string, userPrompt: string) {
  const req = buildOpenAIRequest(model, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], { maxTokens: 220 });

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });

  if (!r.ok) {
    throw new Error(`OpenAI API error: ${r.status} ${await r.text()}`);
  }

  const data = await r.json();
  const content = data.choices?.[0]?.message?.content || "";
  return { content, model: data.model || model };
}

async function generateVisuals(params: Params): Promise<Resp> {
  if (!openAIApiKey) throw new Error("OpenAI API key not found");
  const model = getVisualsModel();

  const {
    category, subcategory, tone, rating,
    insertWords = [], composition_modes = [],
    image_style, completed_text
  } = params;

  const subcategoryContext = getSubcategoryContext(subcategory);

  // System prompt (short, Gemini-style friendly too)
  const systemPrompt = `${visual_rules}

INPUTS:
- Category: ${category}
- Subcategory: ${subcategory}
- Tone: ${tone}
- Rating: ${rating}
- Insert Words: ${insertWords.join(", ")}
- Composition Modes: ${composition_modes.join(", ")}
- Image Style: ${image_style}
- Completed Text: "${completed_text}"

CONTEXT: ${subcategoryContext}

Return ONLY 4 lines.`;

  const userPrompt = `Generate 6 candidate scene descriptions (each 7–12 words), then output the best 4.`;

  // First call
  let { content, model: usedModel } = await callOpenAI(model, systemPrompt, userPrompt);
  let lines = content.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);

  // Enforce rules
  let visuals = enforceVisualRules(lines, { inserts: insertWords, modes: composition_modes });

  // Backfill to guarantee 4
  let tries = 0;
  while (visuals.length < 4 && tries < 2) {
    const missing = 4 - visuals.length;
    const supplementUser = `We need ${missing} more scene descriptions, 7–12 words each.
Insert words: ${insertWords.join(", ")}. Modes: ${composition_modes.join(", ")}.
Do not duplicate prior scenes:\n${visuals.map((v,i)=>`${i+1}. ${v}`).join("\n")}`;
    const add = await callOpenAI(model, systemPrompt, supplementUser);
    const more = add.content.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
    const enforcedMore = enforceVisualRules(more, { inserts: insertWords, modes: composition_modes });
    visuals = uniqueByKey([...visuals, ...enforcedMore]);
    tries++;
  }

  const lengths = visuals.map(v => words(v));
  const validCount = lengths.filter(n => n >= 7 && n <= 12).length;

  return {
    success: true,
    visuals: visuals.map(v => ({ description: v })),
    model: usedModel,
    debug: { lengths, validCount }
  };
}

// ---------- HTTP ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const params: Params = await req.json();
    const result = await generateVisuals(params);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      success: false,
      visuals: [],
      model: getVisualsModel(),
      error: e instanceof Error ? e.message : String(e)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
