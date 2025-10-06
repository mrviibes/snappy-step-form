// supabase/functions/generate-text/index.ts
// Viibe Generator – Responses API compatible, fast, rating-aware, no em dashes.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const API = "https://api.openai.com/v1/responses"; // modern endpoint
const MODEL = "gpt-5-mini-2025-08-07";

// Give the model enough time including one retry, but stay under Supabase 60s cap.
const TIMEOUT_MS = 32000;
const HARD_DEADLINE_MS = 38000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Types ----------
type Tone = "humorous" | "savage" | "sentimental" | "nostalgic" | "romantic" | "inspirational" | "playful" | "serious";
type Rating = "G" | "PG" | "PG-13" | "R";

// ---------- Hints ----------
const TONE_HINT: Record<Tone, string> = {
  humorous: "funny, witty, punchy",
  savage: "blunt, cutting, roast-style",
  sentimental: "warm, affectionate, heartfelt",
  nostalgic: "reflective, lightly playful",
  romantic: "affectionate, charming",
  inspirational: "uplifting, bold",
  playful: "silly, cheeky, fun",
  serious: "direct, weighty, minimal humor",
};

const RATING_HINT: Record<Rating, string> = {
  G: "Pixar clean, no profanity or adult topics.",
  PG: "Shrek clever, mild words like hell or damn only.",
  "PG-13": "Marvel witty, moderate swearing ok (shit, ass, hell). No F-bombs.",
  R: "Hangover raw, strong profanity allowed (fuck, shit, asshole). Non-graphic adult themes, no slurs.",
};

const CATEGORY_HINT: Record<string, string> = {
  celebrations: "Party chaos, cake, people being dramatic. Focus on personality and timing.",
  "daily-life": "Relatable small struggles; caffeine, alarms, habits, moods.",
  sports: "Competition, energy, mistakes that build character.",
  "pop-culture": "One anchor from a show, movie, or trend; make it snappy.",
  jokes: "Setup, twist, done. Avoid meta talk about jokes.",
  miscellaneous: "Observational with one vivid detail that lands a thought.",
};

const COMEDY_STYLES = [
  "Observational humor using everyday irony.",
  "Roast-style humor, sharp but playful.",
  "Surreal humor with strange logic that still makes sense.",
  "Warm, kind humor that still lands a laugh.",
];

// ---------- Helpers ----------
function povHint(inserts: string[]): string {
  if (!inserts?.length) return "Speak directly to the reader using 'you'.";
  if (inserts.includes("I") || inserts.includes("me")) return "Write from first person using 'I'.";
  if (inserts.some((w) => /^[A-Z]/.test(w))) return `Write about ${inserts.join(" and ")} in third person.`;
  return `Write about ${inserts.join(" and ")} as descriptive subjects.`;
}

function buildSystem(
  tone: Tone,
  rating: Rating,
  category: string,
  subcategory: string,
  topic: string,
  inserts: string[],
) {
  const insertRule =
    inserts.length === 1
      ? `Include "${inserts[0]}" once in every line, near the punchline.`
      : inserts.length > 1
        ? `Include each of these words at least once across the set: ${inserts.join(", ")}.`
        : "";
  const style = COMEDY_STYLES[Math.floor(Math.random() * COMEDY_STYLES.length)];
  const savageRule =
    tone === "savage"
      ? "Roast with sharp, playful sarcasm. Use attitude, mild profanity if needed (shit, hell, ass)."
      : "";
  const pov = povHint(inserts);
  const catVoice = CATEGORY_HINT[category] || "";

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
${pov}
${catVoice}
Comedy style: ${style}
Each line must have rhythm, attitude, and a punchline.
Use commas and periods only. No em dashes, quotes, colons, semicolons, or symbols.
Each line 70–125 characters, starts with a capital letter, ends with punctuation.
`.trim();
}

function synth(topic: string, tone: Tone, inserts: string[] = [], rating: Rating = "PG"): string[] {
  const name = inserts[0] || "you";
  const t = (topic || "the moment").replace(/[-_]/g, " ").trim();
  const lines = [
    `${t} showed up loud and uninvited, ${name} blamed gravity.`,
    `${name} survived ${t}, barely, sarcasm included.`,
    `${t} tried to teach humility, ${name} skipped class.`,
    `${name} mastered ${t}, chaos wrote the review.`,
  ];
  return lines.map((l) => l.replace(/([^.?!])$/, "$1."));
}

function ensureInsertPlacement(lines: string[], insert: string): string[] {
  return lines.map((l) => {
    if (!l.toLowerCase().includes(insert.toLowerCase())) return l;
    const tokens = l.split(" ");
    if (tokens[0].toLowerCase() === insert.toLowerCase()) {
      tokens.shift();
      tokens.push(insert);
    }
    return tokens
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/([^.?!])$/, "$1.");
  });
}

function capFirst(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Extract content string from Responses API payload
function readResponsesText(data: any): { status: string; text: string } {
  let status = typeof data?.status === "string" ? data.status : "unknown";
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return { status, text: data.output_text.trim() };
  }
  if (Array.isArray(data?.output)) {
    const parts: string[] = [];
    for (const block of data.output) {
      const items = Array.isArray(block?.content) ? block.content : [];
      for (const it of items) {
        if (typeof it?.text === "string" && it.text.trim()) parts.push(it.text.trim());
      }
    }
    return { status, text: parts.join("\n").trim() };
  }
  return { status, text: "" };
}

// ---------- Handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const region = Deno.env.get("VERCEL_REGION") || Deno.env.get("SUPABASE_REGION") || "unknown";
  console.log("[generate-text] region:", region, "| model:", MODEL, "| endpoint:", API);

  let category = "",
    subcat = "",
    theme = "",
    tone: Tone = "humorous",
    rating: Rating = "PG",
    inserts: string[] = [],
    topic = "topic";

  let deadlineHit = false;
  const hardTimer = setTimeout(() => {
    deadlineHit = true;
    console.warn("[generate-text] hard deadline reached, returning synth");
  }, HARD_DEADLINE_MS);

  try {
    if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

    const b = await req.json();
    category = String(b.category || "").trim();
    subcat = String(b.subcategory || "").trim();
    theme = String(b.theme || "").trim();
    tone = (b.tone || "humorous") as Tone;
    rating = (b.rating || "PG") as Rating;
    inserts = Array.isArray(b.insertWords) ? b.insertWords.filter(Boolean).slice(0, 2) : [];
    topic = (theme || subcat || category || "topic").replace(/[-_]/g, " ").trim();

    const SYSTEM = buildSystem(tone, rating, category, subcat, topic, inserts);
    const payload = `Category: ${category}, Subcategory: ${subcat}, Tone: ${tone}, Rating: ${rating}, Topic: ${topic}${inserts.length ? `, Insert words: ${inserts.join(", ")}` : ""}`;

    console.log("[generate-text] prompt length:", SYSTEM.length + payload.length);

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);

    // Main call
    const r = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: SYSTEM },
          { role: "user", content: payload },
        ],
        max_output_tokens: 1200,
      }),
      signal: ctl.signal,
    });

    clearTimeout(timer);

    if (!r.ok) {
      const errText = await r.text();
      console.error("[generate-text] API error:", r.status, errText);
      const fb = synth(topic, tone, inserts, rating);
      clearTimeout(hardTimer);
      return new Response(JSON.stringify({ success: true, options: fb, model: MODEL, source: "synth" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let { status, text: content } = readResponsesText(await r.json());
    console.log("[generate-text] status:", status, "content len:", content.length);

    // One retry if model cut off
    if ((status === "length" || status === "incomplete") && !deadlineHit) {
      console.warn("[generate-text] retrying due to status:", status);
      const ctl2 = new AbortController();
      const timer2 = setTimeout(() => ctl2.abort(), TIMEOUT_MS);
      try {
        const r2 = await fetch(API, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            input: [
              { role: "system", content: SYSTEM },
              { role: "user", content: payload },
            ],
            max_output_tokens: 1500,
          }),
          signal: ctl2.signal,
        });
        if (r2.ok) {
          ({ status, text: content } = readResponsesText(await r2.json()));
          console.log("[generate-text] status (retry):", status, "content len:", content.length);
        } else {
          console.warn("[generate-text] retry failed:", r2.status);
        }
      } finally {
        clearTimeout(timer2);
      }
    }

    // ---------- Parse and clean ----------
    const clean = (l: string) =>
      l
        .replace(/^[\s>*-]+\s*/, "")
        .replace(/^\d+\.\s+/, "")
        .replace(/[\u2013\u2014]/g, ",")
        .replace(/[:;]+/g, ",")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/([^.?!])$/, "$1.");

    const rawLines = content
      .split(/\r?\n+/)
      .map(clean)
      .filter((l) => l.length > 0);
    let lines = rawLines.filter((l) => l.length >= 70 && l.length <= 125).slice(0, 4);

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
      return new Response(JSON.stringify({ success: true, options: fb, model: MODEL, source: "synth-deadline" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, options: lines, model: MODEL, source }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    clearTimeout(hardTimer);
    const isTimeout = String(err).includes("timeout") || String(err).includes("AbortError");
    console.error("[generate-text] error:", String(err));
    if (deadlineHit || isTimeout) {
      const fb = synth(topic, tone, inserts, rating);
      return new Response(JSON.stringify({ success: true, options: fb, model: MODEL, source: "synth-timeout" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: false, error: String(err), status: 500 }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
