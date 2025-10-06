// supabase/functions/generate-text/index.ts
// Viibe Generator — Chat Completions version (stable), fast, rating-aware, no em dashes.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const API = "https://api.openai.com/v1/chat/completions"; // ✅ back to stable endpoint
const MODEL = "gpt-5-mini-2025-08-07";

// Enough time for one retry but well under Supabase 60s cap
const TIMEOUT_MS = 32000;
const HARD_DEADLINE_MS = 38000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tone =
  | "humorous" | "savage" | "sentimental" | "nostalgic"
  | "romantic" | "inspirational" | "playful" | "serious";
type Rating = "G" | "PG" | "PG-13" | "R";

// hints kept for future tuning if needed
const CATEGORY_HINT: Record<string, string> = {
  celebrations: "Party chaos, cake, people being dramatic. Focus on personality and timing.",
  "daily-life": "Relatable small struggles; caffeine, alarms, habits, moods.",
  sports: "Competition, energy, mistakes that build character.",
  "pop-culture": "One anchor from a show, movie, or trend; make it snappy.",
  jokes: "Setup, twist, done. Avoid meta talk about jokes.",
  miscellaneous: "Observational with one vivid detail that lands a thought."
};

const COMEDY_STYLES = [
  "Observational humor using everyday irony.",
  "Roast-style humor, sharp but playful.",
  "Surreal humor with strange logic that still makes sense.",
  "Warm, kind humor that still lands a laugh."
];

function povHint(inserts: string[]): string {
  if (!inserts?.length) return "Speak directly to the reader using 'you'.";
  if (inserts.includes("I") || inserts.includes("me")) return "Write from first person using 'I'.";
  if (inserts.some(w => /^[A-Z]/.test(w))) return `Write about ${inserts.join(" and ")} in third person.`;
  return `Write about ${inserts.join(" and ")} as descriptive subjects.`;
}

function buildSystem(
  tone: Tone,
  rating: Rating,
  category: string,
  subcategory: string,
  topic: string,
  inserts: string[]
) {
  const style = COMEDY_STYLES[Math.floor(Math.random() * COMEDY_STYLES.length)];
  const catVoice = CATEGORY_HINT[category] || "";
  const savageRule =
    tone === "savage"
      ? "Roast with sharp, playful sarcasm. Use attitude, mild profanity if needed (shit, hell, ass)."
      : "";

  const insertRule =
    inserts.length === 1
      ? `Include "${inserts[0]}" once in every line, near the punchline. The joke should fall apart without it.`
      : inserts.length > 1
      ? `Use these words creatively across the set so the humor depends on them: ${inserts.join(", ")}.`
      : "";

  return `
Write four one-liners that actually make people laugh.
Topic: ${subcategory}. Tone: ${tone}. Rating: ${rating}.
${insertRule}
Sound like a sarcastic friend telling stories at a bar, not a caption.
Adjust intensity to match rating:
R: strong profanity allowed (fuck, shit, asshole). Dark, risky humor fine, no slurs or explicit sex.
PG-13: edgy, flirty, mild swears (hell, damn, crap). Alcohol or chaos jokes fine.
PG: clever, cheeky, clean humor only.
G: wholesome, simple, safe humor.
${savageRule}
${povHint(inserts)}
${catVoice}
Comedy style: ${style}
Each line must have rhythm, attitude, and a punchline.
Use commas and periods only. No em dashes, quotes, colons, semicolons, or symbols.
Each line 70–125 characters, starts with a capital letter, ends with punctuation.
Avoid repeating the exact topic word more than once.
`.trim();
}

function synth(topic: string, tone: Tone, inserts: string[] = [], rating: Rating = "PG"): string[] {
  const name = inserts[0] || "you";
  const t = (topic || "the moment").replace(/[-_]/g, " ").trim();
  const lines = [
    `${t} showed up loud and uninvited, ${name} blamed gravity.`,
    `${name} survived ${t}, barely, sarcasm included.`,
    `${t} tried to teach humility, ${name} skipped class.`,
    `${name} mastered ${t}, chaos wrote the review.`
  ];
  return lines.map(l => l.replace(/([^.?!])$/, "$1."));
}

function ensureInsertPlacement(lines: string[], insert: string): string[] {
  return lines.map(l => {
    if (!l.toLowerCase().includes(insert.toLowerCase())) return l;
    const tokens = l.split(" ");
    if (tokens[0].toLowerCase() === insert.toLowerCase()) {
      tokens.shift();
      tokens.push(insert);
    }
    return tokens.join(" ").replace(/\s+/g, " ").trim().replace(/([^.?!])$/, "$1.");
  });
}

function capFirst(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const region = Deno.env.get("VERCEL_REGION") || Deno.env.get("SUPABASE_REGION") || "unknown";
  console.log("[generate-text] region:", region, "| model:", MODEL, "| endpoint:", API);

  let category = "", subcat = "", theme = "", tone: Tone = "humorous", rating: Rating = "PG",
      inserts: string[] = [], topic = "topic";

  let deadlineHit = false;
  const hardTimer = setTimeout(() => {
    deadlineHit = true;
    console.warn("[generate-text] hard deadline reached, returning synth");
  }, HARD_DEADLINE_MS);

  try {
    if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

    const b = await req.json();
    category = String(b.category || "").trim();
    subcat   = String(b.subcategory || "").trim();
    theme    = String(b.theme || "").trim();
    tone     = (b.tone || "humorous") as Tone;
    rating   = (b.rating || "PG") as Rating;
    inserts  = Array.isArray(b.insertWords) ? b.insertWords.filter(Boolean).slice(0, 2) : [];
    topic    = (theme || subcat || category || "topic").replace(/[-_]/g, " ").trim();

    const SYSTEM  = buildSystem(tone, rating, category, subcat, topic, inserts);
    const payload = `Category: ${category}, Subcategory: ${subcat}, Tone: ${tone}, Rating: ${rating}, Topic: ${topic}${inserts.length ? `, Insert words: ${inserts.join(", ")}` : ""}`;

    console.log("[generate-text] prompt length:", SYSTEM.length + payload.length);

    const messages = [
      { role: "system", content: SYSTEM },
      { role: "user",   content: payload }
    ];

    // ---- main call ----
    const ctl  = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);

    const r = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_completion_tokens: 1200
      }),
      signal: ctl.signal
    });

    clearTimeout(timer);

    if (!r.ok) {
      const errText = await r.text();
      console.error("[generate-text] API error:", r.status, errText);
      const fb = synth(topic, tone, inserts, rating);
      clearTimeout(hardTimer);
      return new Response(JSON.stringify({ success: true, options: fb, model: MODEL, source: "synth" }),
        { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const data = await r.json();
    let content = data?.choices?.[0]?.message?.content || "";
    let finish  = data?.choices?.[0]?.finish_reason || "n/a";
    console.log("[generate-text] finish_reason:", finish, "| content len:", content.length);

    // ---- one retry on cutoff ----
    if ((finish === "length" || finish === "incomplete") && !deadlineHit) {
      console.warn("[generate-text] retrying due to finish_reason:", finish);
      const ctl2  = new AbortController();
      const timer2 = setTimeout(() => ctl2.abort(), TIMEOUT_MS);
      try {
        const r2 = await fetch(API, {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            messages,
            max_completion_tokens: 1500
          }),
          signal: ctl2.signal
        });
        if (r2.ok) {
          const d2 = await r2.json();
          content  = d2?.choices?.[0]?.message?.content || content;
          finish   = d2?.choices?.[0]?.finish_reason || finish;
          console.log("[generate-text] finish_reason (retry):", finish, "| content len:", content.length);
        } else {
          console.warn("[generate-text] retry failed:", r2.status);
        }
      } finally {
        clearTimeout(timer2);
      }
    }

    // ---- parse and clean ----
    const clean = (l: string) =>
      l.replace(/^[\s>*-]+\s*/, "")
       .replace(/^\d+\.\s+/, "")
       .replace(/[\u2013\u2014]/g, ",")
       .replace(/[:;]+/g, ",")
       .replace(/\s+/g, " ")
       .trim()
       .replace(/([^.?!])$/, "$1.");

    const rawLines = content.split(/\r?\n+/).map(clean).filter(l => l.length > 0);
    let lines = rawLines.filter(l => l.length >= 70 && l.length <= 125).slice(0, 4);

    let source = "model";
    if (lines.length < 2) {
      lines = synth(topic, tone, inserts, rating);
      source = "synth";
    } else if (lines.length < 4) {
      const pad = synth(topic, tone, inserts, rating).slice(0, 4 - lines.length);
      lines = [...lines, ...pad];
      source = "model+padded";
    }

    if (inserts.length === 1) lines = ensureInsertPlacement(lines, inserts[0]);
    lines = lines.map(capFirst);

    console.log("✅ FINAL SOURCE:", source);

    clearTimeout(hardTimer);
    if (deadlineHit) {
      const fb = synth(topic, tone, inserts, rating);
      return new Response(JSON.stringify({ success: true, options: fb, model: MODEL, source: "synth-deadline" }),
        { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, options: lines, model: MODEL, source }),
      { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (err) {
    clearTimeout(hardTimer);
    const isTimeout = String(err).includes("timeout") || String(err).includes("AbortError");
    console.error("[generate-text] error:", String(err));
    if (deadlineHit || isTimeout) {
      const fb = synth(topic, tone, inserts, rating);
      return new Response(JSON.stringify({ success: true, options: fb, model: MODEL, source: "synth-timeout" }),
        { headers: { ...cors, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: false, error: String(err), status: 500 }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
