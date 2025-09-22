// supabase/functions/generate-text/index.ts
// Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MODELS = {
  primary: Deno.env.get("VIBE_PRIMARY_MODEL") || "gpt-5",
  backup: Deno.env.get("VIBE_BACKUP_MODEL") || "gpt-5-mini",
};
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const n = clamp(body.num_variations ?? 4, 1, 8);
  const prompt = buildPrompt(body, n);

  try {
    const result = await generateNLines(body, n);
    return json({ model: result.modelUsed, options: result.lines });
  } catch (e) {
    return json({ error: String(e?.message || e || "generation_failed") }, 502);
  }
});

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

function buildPrompt(p: any, n: number) {
  const must = (p.mandatory_words || []).slice(0, 6).join(", ");
  return `
Write ${n} distinct one-liners for a celebration text generator.

Rules:
- Each line 60 to 120 characters inclusive.
- Exactly one sentence per line.
- No em dash.
- Include these words naturally if present: ${must || "none"}.
- Category: ${p.category || "General"}${p.subcategory ? `, Subcategory: ${p.subcategory}` : ""}.
- Tone: ${p.tone}. Style: ${p.style}. Rating: ${p.rating}.
${p.comedian_style ? `- In the spirit of ${p.comedian_style} without naming them.` : ""}

Output format:
Return exactly ${n} items separated by the delimiter "|||".
No numbering, no bullets, no extra commentary, no blank lines.
`;
}

async function callOpenAI(model: string, input: string) {
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input,
      max_output_tokens: 600,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`openai_${resp.status}_${txt.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text = data?.output_text?.trim() || "";
  return text;
}

async function generateNLines(p: any, n: number) {
  const lines: string[] = [];
  let modelUsed = MODELS.primary;

  for (let i = 0; i < n; ) {
    const prompt = singleLinePrompt(p);
    try {
      const raw = await callOpenAI(modelUsed, prompt);
      const line = enforce(normalizeOne(raw)) as string | null;
      if (line && !lines.includes(line)) {
        lines.push(line);
        i++;
      }
    } catch (_e) {
      // If primary fails once, switch to backup; otherwise retry with backup
      if (modelUsed === MODELS.primary) { modelUsed = MODELS.backup; continue; }
    }
  }

  return { modelUsed, lines };
}

function singleLinePrompt(p: any) {
  const must = (p.mandatory_words || []).slice(0, 6).join(", ");
  return `
Write one single-sentence one-liner (exactly one sentence) for a celebration text generator.

Rules:
- Length 60 to 120 characters inclusive.
- No em dash.
- Include these words naturally if present: ${must || "none"}.
- Category: ${p.category || "General"}${p.subcategory ? `, Subcategory: ${p.subcategory}` : ""}.
- Tone: ${p.tone}. Style: ${p.style}. Rating: ${p.rating}.
${p.comedian_style ? `- In the spirit of ${p.comedian_style} without naming them.` : ""}

Output exactly the sentence only. No numbering. No quotes. No extra words.
`;
}

function normalizeOne(raw: string) {
  const first = raw.split(/\r?\n/).map(s => s.trim()).find(Boolean) || "";
  return first
    .replace(/^["'`]/, "")
    .replace(/["'`]$/, "")
    .replace(/^[•*-]\s*/, "")
    .replace(/^\d+[\.)]\s*/, "");
}

function enforce(s: string) {
  const len = [...s].length;
  if (len < 60 || len > 120) return null;
  if (/\u2014/.test(s)) return null;      // ban em dash
  if (!/[.!?]$/.test(s)) s += ".";        // ensure punctuation
  return s;
}