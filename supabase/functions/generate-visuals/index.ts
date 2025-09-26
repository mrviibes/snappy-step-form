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
  debug?: { lengths: number[]; validCount: number };
  error?: string;
}

// ---------- Helpers ----------
function getSubcategoryContext(sub: string): string {
  return subcategory_contexts[sub?.toLowerCase()] || subcategory_contexts.default;
}
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function toneHint(tone: string) {
  const t = tone.toLowerCase();
  if (t.includes("savage") || t.includes("dark")) return "edgy, biting, chaotic energy";
  if (t.includes("sentimental")) return "warm, gentle, soft mood";
  if (t.includes("playful") || t.includes("humorous")) return "cheeky, lively, mischievous vibe";
  if (t.includes("inspirational")) return "uplifting, bold, triumphant mood";
  if (t.includes("serious")) return "formal, weighty, restrained tone";
  return "match tone naturally";
}

function ensureAllInserts(line: string, inserts: string[]) {
  let out = line.trim();
  for (const w of inserts) {
    if (!new RegExp(`\\b${w}\\b`, "i").test(out)) {
      out = `${out} with ${w}`;
    }
  }
  return out;
}

function ensureModeMention(line: string, modes: string[]) {
  if (!modes?.length) return line;
  if (modes.some(m => new RegExp(`\\b${m}\\b`, "i").test(line))) return line;
  return `${line}, ${modes[0]}`;
}

function enforceVisualRules(rawLines: string[], opts: {
  inserts: string[];
  modes: string[];
  min?: number;
  max?: number;
}) {
  const min = opts.min ?? 7;
  const max = opts.max ?? 12;
  const modes = (opts.modes || []).filter(Boolean);
  const out: string[] = [];

  for (let l of rawLines) {
    l = l.replace(/\s+/g, " ").trim();
    if (!l) continue;

    // enforce inserts + mode mention
    l = ensureAllInserts(l, opts.inserts);
    l = ensureModeMention(l, modes);

    // 7–12 words window
    let wc = words(l);
    if (wc < min) continue;
    if (wc > max) {
      if (l.includes(",")) {
        const parts = l.split(",");
        while (parts.length > 1 && words(parts.join(",")) > max) parts.pop();
        l = parts.join(",").trim();
      }
      if (words(l) > max) l = l.split(/\s+/).slice(0, max).join(" ");
    }

    out.push(l);
    if (out.length === 8) break; // grab extras for dedupe
  }

  // dedupe near-identical lines
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const l of out) {
    const k = l.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(l);
    if (unique.length === 4) break;
  }
  return unique;
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

  if (!r.ok) throw new Error(`OpenAI API error: ${r.status} ${await r.text()}`);

  const data = await r.json();
  const content = data.choices?.[0]?.message?.content || "";
  return { content, model: data.model || model };
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

  const subCtx = getSubcategoryContext(subcategory);
  const tHint = toneHint(tone);

  // Compact system prompt (Gemini-friendly too)
  const systemPrompt = `${visual_rules}

INPUTS
- Category: ${category}
- Subcategory: ${subcategory}
- Tone: ${tone} (${tHint})
- Rating: ${rating}
- Insert Words: ${insertWords.join(", ")}
- Composition Modes: ${composition_modes.join(", ")}
- Image Style: ${image_style}
- Completed Text: "${completed_text}"
- Context: ${subCtx}

OUTPUT FORMAT
- Only 4 lines, each 7–12 words. No numbering, no extra text.`;

  const userPrompt =
    `Generate 8 candidate scene descriptions (7–12 words each). ` +
    `Each must include all insert words and mention at least one composition mode. ` +
    `Avoid repeating the same props list.`;

  let { content, model: usedModel } = await callOpenAI(model, systemPrompt, userPrompt);
  let lines = content.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);

  let visuals = enforceVisualRules(lines, { inserts: insertWords, modes: composition_modes });

  // Backfill to guarantee 4
  let tries = 0;
  while (visuals.length < 4 && tries < 2) {
    const missing = 4 - visuals.length;
    const supplementUser =
      `We need ${missing} new descriptions, 7–12 words, each including insert words (${insertWords.join(", ")}), ` +
      `mentioning at least one mode (${composition_modes.join(", ")}), and not repeating prior scenes:\n` +
      visuals.map((v, i) => `${i + 1}. ${v}`).join("\n");
    const add = await callOpenAI(model, systemPrompt, supplementUser);
    const more = add.content.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
    const enforcedMore = enforceVisualRules(more, { inserts: insertWords, modes: composition_modes });
    const mergeSet = new Set<string>(visuals.map(v => v.toLowerCase()));
    for (const m of enforcedMore) {
      if (!mergeSet.has(m.toLowerCase())) {
        visuals.push(m);
        mergeSet.add(m.toLowerCase());
      }
      if (visuals.length === 4) break;
    }
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
    const params: GenerateVisualsParams = await req.json();
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
