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
    const options = await generateOptions(MODELS.primary, prompt, n);
    return json({ model: MODELS.primary, options });
  } catch {
    try {
      const options = await generateOptions(MODELS.backup, prompt, n);
      return json({ model: MODELS.backup, options });
    } catch (e) {
      return json({ error: String(e?.message || e || "generation_failed") }, 502);
    }
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

async function generateOptions(model: string, prompt: string, n: number) {
  const options: string[] = [];
  let tries = 0;

  while (options.length < n && tries < 3) {
    const raw = await callOpenAI(model, prompt);
    const batch = normalizeLines(raw).map(enforce).filter(Boolean) as string[];

    for (const line of batch) {
      if (options.length >= n) break;
      if (!options.includes(line)) options.push(line);
    }
    tries++;
    // If still short, shrink the ask to just the remainder.
    if (options.length < n) {
      const remain = n - options.length;
      prompt = prompt.replace(/Write \d+ distinct/, `Write ${remain} distinct`)
                     .replace(/Return exactly \d+ items/, `Return exactly ${remain} items`);
    }
  }

  if (options.length < n) throw new Error("not_enough_lines");
  return options.slice(0, n);
}

function normalizeLines(raw: string): string[] {
  // split on our delimiter first, then fallback to common list artifacts
  const chunks = raw.split("|||")
    .flatMap(s => s.split(/\r?\n/))
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^[•*-]\s*/, ""))      // bullets
    .map(s => s.replace(/^\d+[\.)]\s*/, ""));  // numbering
  return chunks.filter(Boolean);
}

function enforce(s: string) {
  const len = [...s].length;
  if (len < 60 || len > 120) return null;
  if (/\u2014/.test(s)) return null;         // no em dash
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}