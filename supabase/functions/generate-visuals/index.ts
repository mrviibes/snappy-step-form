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

// ---------- Helpers ----------
function getSubcategoryContext(sub: string): string {
  return subcategory_contexts[sub?.toLowerCase()] || subcategory_contexts.default;
}
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function toneHint(tone: string) {
  const t = (tone || "").toLowerCase();
  if (t.includes("savage") || t.includes("dark")) return "edgy, biting, chaotic energy";
  if (t.includes("sentimental")) return "warm, gentle, soft mood";
  if (t.includes("playful") || t.includes("humorous")) return "cheeky, lively, mischievous vibe";
  if (t.includes("inspirational")) return "uplifting, bold, triumphant mood";
  if (t.includes("serious")) return "formal, weighty, restrained tone";
  return "match tone naturally";
}

// Simple keyword extractor from completed_text: keep nouns-ish content words
function extractLiteralKeywords(text: string): string[] {
  const stop = new Set([
    "the","a","an","and","or","but","with","without","into","onto","over","under","about","around",
    "in","on","of","to","for","from","by","as","at","is","are","was","were","be","been","being",
    "you","your","yours","he","she","it","they","them","his","her","their","this","that","these","those",
    "will","would","should","could","can","may","might","must","just","like","than","then","there","here",
    "have","has","had","do","does","did","not","no","yes","if","so","such","very","more","less","most","least",
    "missed","seem","seems","seemed" // verbs that don’t help visuals
  ]);
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stop.has(w))
    .slice(0, 6); // keep first few content words
}

function ensureAllInserts(line: string, inserts: string[]) {
  let out = line.trim();
  for (const w of inserts) {
    if (!new RegExp(`\\b${w}\\b`, "i").test(out)) out = `${out} with ${w}`;
  }
  return out;
}

function ensureModeMention(line: string, modes: string[]) {
  if (!modes?.length) return line;
  if (modes.some(m => new RegExp(`\\b${m}\\b`, "i").test(line))) return line;
  return `${line}, ${modes[0]}`;
}

function meetsLiteral(line: string, keywords: string[]) {
  return keywords.some(k => new RegExp(`\\b${k}\\b`, "i").test(line));
}

function enforceVisualRules(rawLines: string[], opts: {
  inserts: string[];
  modes: string[];
  literalKeywords: string[];
  requireLiteralCount: number; // e.g., 2
  min?: number;
  max?: number;
}) {
  const min = opts.min ?? 7;
  const max = opts.max ?? 12;
  const modes = (opts.modes || []).filter(Boolean);

  // Normalize and enforce base rules
  const processed: string[] = [];
  for (let l of rawLines) {
    l = l.replace(/\s+/g, " ").trim();
    if (!l) continue;
    l = ensureAllInserts(l, opts.inserts);
    l = ensureModeMention(l, modes);

    // 7–12 words
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
    processed.push(l);
    if (processed.length === 12) break; // limit
  }

  // Split into literal vs creative buckets
  const literal: string[] = [];
  const creative: string[] = [];
  for (const l of processed) {
    if (meetsLiteral(l, opts.literalKeywords)) literal.push(l);
    else creative.push(l);
  }

  // Assemble 2 literal + 2 creative with uniqueness
  const pickUnique = (arr: string[], n: number, taken = new Set<string>()) => {
    const out: string[] = [];
    for (const s of arr) {
      const key = s.toLowerCase();
      if (taken.has(key)) continue;
      taken.add(key);
      out.push(s);
      if (out.length === n) break;
    }
    return out;
  };

  const taken = new Set<string>();
  let result = [
    ...pickUnique(literal, Math.min(opts.requireLiteralCount, 2), taken),
    ...pickUnique(creative, 2, taken)
  ];

  // If not enough literal, convert some creative by appending a literal keyword subtly
  let needLiteral = Math.max(0, opts.requireLiteralCount - result.filter(s => meetsLiteral(s, opts.literalKeywords)).length);
  if (needLiteral > 0 && creative.length) {
    for (let i = 0; i < result.length && needLiteral > 0; i++) {
      if (!meetsLiteral(result[i], opts.literalKeywords)) {
        const k = opts.literalKeywords[0];
        result[i] = `${result[i]} (${k} reference)`;
        needLiteral--;
      }
    }
  }

  // If still <4, fill from whichever bucket has content
  if (result.length < 4) {
    const pool = [...literal, ...creative];
    for (const s of pool) {
      const key = s.toLowerCase();
      if (taken.has(key)) continue;
      taken.add(key);
      result.push(s);
      if (result.length === 4) break;
    }
  }

  return result.slice(0, 4);
}

async function callOpenAI(model: string, systemPrompt: string, userPrompt: string) {
  const req = buildOpenAIRequest(model, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], { maxTokens: 240 });

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

  // extract literal keywords from completed_text for the "literal" scenes
  const literalKeywords = extractLiteralKeywords(completed_text).slice(0, 3);

  // Compact system prompt (Gemini-friendly too)
  const systemPrompt = `${visual_rules}

INPUTS
- Category: ${category}
- Subcategory: ${subcategory}
- Tone: ${tone} (${tHint})
- Rating: ${
