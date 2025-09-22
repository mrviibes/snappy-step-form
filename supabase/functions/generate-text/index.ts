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
    let text = await callOpenAI(MODELS.primary, prompt);
    if (!text) throw new Error("empty_response_primary");
    const options = splitValidate(text, n);
    return json({ model: MODELS.primary, options });
  } catch {
    try {
      const text = await callOpenAI(MODELS.backup, prompt);
      const options = splitValidate(text, n);
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
  const mandatory = (p.mandatory_words || []).slice(0, 6).join(", ");
  return `
Write ${n} distinct one-liners for a celebration text generator.

Constraints:
- Each line 60 to 120 characters.
- One sentence per line. No internal line breaks.
- No em dash. Use commas or periods.
- Include these words naturally if present: ${mandatory || "none"}.
- Category: ${p.category || "General"}${p.subcategory ? `, Subcategory: ${p.subcategory}` : ""}.
- Tone: ${p.tone}. Style: ${p.style}. Rating: ${p.rating}.
${p.comedian_style ? `- Deliver in the spirit of ${p.comedian_style} without naming them.` : ""}

Output:
Return exactly ${n} lines, each on its own line. No numbering, no quotes, no extra commentary.
`;
}

async function callOpenAI(model: string, input: string) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: input }],
      temperature: 0.9,
      top_p: 0.95,
      max_tokens: 600,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`openai_${resp.status}_${txt.slice(0, 120)}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content?.trim() || "";
  return text;
}

function splitValidate(raw: string, n: number) {
  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length < n) throw new Error("not_enough_lines");
  const sel = lines.slice(0, n).map(enforce);
  return [...new Set(sel)];
}

function enforce(s: string) {
  const len = [...s].length;
  if (len < 60 || len > 120) throw new Error(`bad_length_${len}`);
  if (/\u2014/.test(s)) throw new Error("em_dash_detected");
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}