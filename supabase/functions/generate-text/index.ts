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
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  try {
    console.log("Request received:", req.method);
    
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json({ error: "POST only" }, 405);
    }

    let body: any = {};
    try {
      body = await req.json();
      console.log("Request body:", body);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const n = clamp(body.num_variations ?? 4, 1, 8);
    console.log("Generating", n, "lines");

    const result = await generateNLines(body, n);
    console.log("Generated result:", { model: result.modelUsed, count: result.lines.length });
    
    return json({ model: result.modelUsed, options: result.lines });
  } catch (e) {
    console.error("Top-level error:", e);
    return json({ error: String(e?.message || e || "generation_failed") }, 500);
  }
});

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: corsHeaders,
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
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 15000); // 15s max

  try {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        max_output_tokens: 160,
      }),
      signal: ctl.signal
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`openai_${resp.status}_${txt.slice(0, 200)}`);
    }

    const data = await resp.json();
    const text = data?.output_text?.trim() || "";
    return text;
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      throw new Error("timeout_or_network_error");
    }
    throw e;
  }
}

async function generateNLines(p: any, n: number) {
  const lines: string[] = [];
  let modelUsed = MODELS.primary;
  let attempts = 0;
  const maxAttempts = 6; // Reasonable limit

  while (lines.length < n && attempts < maxAttempts) {
    const prompt = singleLinePrompt(p);
    try {
      const raw = await callOpenAI(modelUsed, prompt);
      console.log("RAW OUTPUT:", raw);
      
      const line = enforce(normalizeOne(raw)) as string | null;
      if (line && !lines.includes(line)) {
        lines.push(line);
        console.log(`Generated line ${lines.length}:`, line);
      } else {
        console.log("Rejected line:", { raw, normalized: normalizeOne(raw), enforced: line });
      }
    } catch (e) {
      console.error(`OpenAI call failed (attempt ${attempts + 1}):`, e);
      // If primary fails, switch to backup
      if (modelUsed === MODELS.primary) { 
        modelUsed = MODELS.backup; 
        console.log("Switching to backup model:", MODELS.backup);
      }
      // Add small delay before retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    attempts++;
  }

  // Add fallback lines if we didn't get enough
  const fallbacks = [
    "Celebrating life's special moments, one smile at a time!",
    "Today deserves extra joy and maybe a little cake too.",
    "Making memories that sparkle brighter than any candle.",
    "Here's to another year of awesome adventures ahead!"
  ];

  while (lines.length < n && fallbacks.length > 0) {
    const fallback = fallbacks.shift()!;
    if (!lines.includes(fallback)) {
      lines.push(fallback);
      console.log("Added fallback line:", fallback);
    }
  }

  console.log(`Final result: ${lines.length} lines generated`);
  return { modelUsed, lines };
}

function singleLinePrompt(p: any) {
  const must = (p.mandatory_words || []).slice(0, 6).join(", ");
  return `
Write ONE single-sentence one-liner (exactly one sentence) for a celebration text generator.

Rules:
- Length 40 to 140 characters inclusive.
- ONE sentence only. No lists, no paragraphs.
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
  if (len < 40 || len > 140) return null;   // loosened from 60-120
  if (/\u2014/.test(s)) return null;        // ban em dash
  if (!/[.!?]$/.test(s)) s += ".";          // ensure punctuation
  return s;
}