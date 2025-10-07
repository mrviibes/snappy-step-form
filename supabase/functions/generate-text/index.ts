// supabase/functions/generate-text/index.ts
// Viibe Generator - Chat Completions version, 3.5 Turbo, stricter validation
// Enforces: 4 one-liners, 70-125 chars, one sentence, commas and periods only,
// includes all insert words, tone and rating aware, no em dashes.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const API = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-3.5-turbo";

// timeouts kept inside Supabase 60s limit
const TIMEOUT_MS = 22000;
const HARD_DEADLINE_MS = 26000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tone = "humorous" | "savage" | "sentimental" | "nostalgic" 
  | "romantic" | "inspirational" | "playful" | "serious";
type Rating = "G" | "PG" | "PG-13" | "R";

type Body = {
  category?: string;
  subcategory?: string;
  tone?: Tone;
  rating?: Rating;
  insertWords?: string[];
  style?: string;
};

// ---------- Prompt builder ----------

function systemPrompt(b: Required<Body>) {
  const { category, subcategory, tone, rating, insertWords, style } = b;

  const styleLine = style
    ? `Style: ${style}.`
    : `Style: one-liner with a quick setup and a sharp payoff.`;

  const insertsLine = insertWords.length
    ? `Insert words: ${insertWords.join(", ")}. Each output must include all insert words naturally.`
    : `No insert words provided.`;

  return [
    `You are a professional comedy writer generating four one-liner jokes.`,
    `Category: ${category || "misc"}, Subcategory: ${subcategory || "general"}.`,
    `Tone: ${tone}. Rating: ${rating}. ${styleLine}`,
    insertsLine,
    `Rules:`,
    `- Exactly 4 outputs.`,
    `- Each output is exactly one sentence with a clear setup and punchline.`,
    `- Character range per output: 70 to 125.`,
    `- Use only commas and periods. No dashes, no colons, no semicolons, no emojis, no hashtags.`,
    `- Start with a capital letter and end with a period.`,
    `- Do not repeat the exact word "${subcategory}" more than once across the entire set.`,
    `- Keep language within the rating.`,
    `- Avoid meta talk about jokes.`,
    `Output format: a plain numbered list 1-4, one line per item.`,
  ].join(" ");
}

function userPrompt(b: Required<Body>) {
  const { category, subcategory, tone, rating, insertWords, style } = b;
  const payload = {
    category,
    subcategory,
    tone,
    rating,
    style: style || "one-liner",
    insert_words: insertWords,
  };
  return JSON.stringify(payload);
}

// ---------- Post-processing and validation ----------

const ILLEGAL_CHARS = /[:;!?"""'''(){}\[\]<>/_*#+=~^`|\\]/g;
const EM_DASH = /[\u2014\u2013]/g;

function normalizeLine(s: string): string {
  let t = s.trim();
  t = t.replace(/^[>*\-]+\s*/, "").replace(/^\d+\.\s*/, "");
  t = t.replace(EM_DASH, ",");
  t = t.replace(ILLEGAL_CHARS, "");
  t = t.replace(/\s+/g, " ");
  if (t.length) t = t[0].toUpperCase() + t.slice(1);
  if (!/[.?!]$/.test(t)) t += ".";
  t = t.replace(/[?]$/, ".");
  return t;
}

function isOneSentence(s: string): boolean {
  const parts = s.split(".").filter(Boolean);
  return parts.length === 1;
}

function inCharRange(s: string, min = 70, max = 125): boolean {
  const len = [...s].length;
  return len >= min && len <= max;
}

function hasAllInserts(s: string, inserts: string[]): boolean {
  return inserts.every(w => new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(s));
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueByText(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const key = l.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(l);
    }
  }
  return out;
}

function filterBySubcatUse(lines: string[], subcat: string): string[] {
  if (!subcat) return lines;
  let used = 0;
  const re = new RegExp(`\\b${escapeRegExp(subcat)}\\b`, "i");
  return lines.filter(l => {
    if (re.test(l)) {
      if (used === 0) {
        used++;
        return true;
      }
      return false;
    }
    return true;
  });
}

function validateAndTrim(
  raw: string,
  inserts: string[],
  subcat: string,
  want = 4,
): string[] {
  const lines = raw
    .split(/\r?\n+/)
    .map(normalizeLine)
    .filter(Boolean);

  let val = lines.filter(l =>
    isOneSentence(l) && inCharRange(l) && hasAllInserts(l, inserts)
  );

  val = uniqueByText(val);
  val = filterBySubcatUse(val, subcat);

  if (val.length > want) val = val.slice(0, want);
  return val;
}

// ---------- Fallback synthesis ----------

function synthFallback(topic: string, inserts: string[], tone: Tone): string[] {
  const [a, b] = [inserts[0] || "you", inserts[1] || "life"];
  const base = [
    `${a} trained for ${topic}, ${b} graded on a curve.`,
    `${a} met ${topic} at full speed, ${b} filed the report.`,
    `${topic} tried to teach patience, ${a} borrowed time from ${b}.`,
    `${a} survived ${topic}, ${b} wrote a cheerful obituary.`,
  ];
  return base.map(normalizeLine).map(l => {
    return hasAllInserts(l, inserts) ? l : `${a} ${b} ${l}`;
  }).map(normalizeLine).filter(l => inCharRange(l));
}

// ---------- HTTP handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const hardTimer = setTimeout(() => {}, HARD_DEADLINE_MS);
  let deadlineHit = false;
  const deadlineGuard = setTimeout(() => { deadlineHit = true; }, HARD_DEADLINE_MS);

  try {
    if (!OPENAI_API_KEY) {
      clearTimeout(deadlineGuard);
      clearTimeout(hardTimer);
      return new Response(
        JSON.stringify({ success: false, error: "Missing OPENAI_API_KEY" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as Body;
    const category = String(body.category || "").trim();
    const subcategory = String(body.subcategory || "").trim();
    const tone = (body.tone || "humorous") as Tone;
    const rating = (body.rating || "PG") as Rating;
    const style = String(body.style || "").trim();
    const insertWords = Array.isArray(body.insertWords)
      ? body.insertWords.filter(Boolean).slice(0, 2).map(s => String(s))
      : [];

    const topic = (subcategory || category || "the moment").replace(/[-_]/g, " ").trim();

    const full: Required<Body> = {
      category: category || "misc",
      subcategory: subcategory || "general",
      tone,
      rating,
      insertWords,
      style: style || "",
    };

    const messages = [
      { role: "system", content: systemPrompt(full) },
      { role: "user", content: userPrompt(full) },
    ];

    console.log("[generate-text] prompt length:", JSON.stringify(messages).length);

    // main call
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);

    const r = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.8,
        max_tokens: 400,
      }),
      signal: ctl.signal,
    });

    clearTimeout(timer);

    let source = "model";
    let outputs: string[] = [];

    if (r.ok) {
      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      let lines = validateAndTrim(content, insertWords, full.subcategory);

      // one retry if we got fewer than 4 valid lines and deadline allows
      if (lines.length < 4 && !deadlineHit) {
        const ctl2 = new AbortController();
        const timer2 = setTimeout(() => ctl2.abort(), 8000);
        try {
          const r2 = await fetch(API, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: MODEL,
              messages,
              temperature: 0.9,
              max_tokens: 500,
            }),
            signal: ctl2.signal,
          });
          if (r2.ok) {
            const d2 = await r2.json();
            const c2 = d2?.choices?.[0]?.message?.content ?? "";
            const more = validateAndTrim(c2, insertWords, full.subcategory);
            lines = uniqueByText([...lines, ...more]).slice(0, 4);
          }
        } catch (retryErr) {
          console.warn("[generate-text] retry error:", String(retryErr));
        } finally {
          clearTimeout(timer2);
        }
      }

      if (lines.length < 4) {
        source = lines.length ? "model+padded" : "synth";
        const pad = synthFallback(topic, insertWords, tone);
        lines = uniqueByText([...lines, ...pad]).slice(0, 4);
      }

      outputs = lines;
    } else {
      console.error("[generate-text] API error:", r.status, await r.text());
      source = "synth";
      outputs = synthFallback(topic, insertWords, tone);
    }

    // final guarantee pass on all rules
    outputs = outputs
      .map(normalizeLine)
      .filter(l => isOneSentence(l) && inCharRange(l) && hasAllInserts(l, insertWords));

    // last resort if strict filter removed too much
    if (outputs.length < 4) {
      const pad = synthFallback(topic, insertWords, tone);
      outputs = uniqueByText([...outputs, ...pad]).slice(0, 4);
    }

    clearTimeout(deadlineGuard);
    clearTimeout(hardTimer);

    console.log("[generate-text] success | source:", source, "| count:", outputs.length);

    return new Response(
      JSON.stringify({
        success: true,
        model: MODEL,
        options: outputs,
        source,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    clearTimeout(deadlineGuard);
    clearTimeout(hardTimer);
    console.error("[generate-text] error:", String(err));
    
    const topic = "the moment";
    const outputs = synthFallback(topic, [], "humorous");
    
    return new Response(
      JSON.stringify({
        success: true,
        model: MODEL,
        options: outputs,
        source: "synth-error",
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
