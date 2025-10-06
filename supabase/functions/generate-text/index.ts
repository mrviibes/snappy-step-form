// supabase/functions/generate-text/index.ts
// Streamlined Viibe Text Generator - Fast & Efficient

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const API = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5-mini-2025-08-07";
const TIMEOUT_MS = 25000;

console.log("[generate-text] using", MODEL, "at", API);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tone = "humorous" | "savage" | "sentimental" | "nostalgic" | "romantic" | "inspirational" | "playful" | "serious";
type Rating = "G" | "PG" | "PG-13" | "R";

const TONE_HINT: Record<Tone, string> = {
  humorous: "funny, witty, punchy",
  savage: "blunt, cutting, roast-style",
  sentimental: "warm, affectionate, heartfelt",
  nostalgic: "reflective, lightly playful",
  romantic: "affectionate, charming",
  inspirational: "uplifting, bold",
  playful: "silly, cheeky, fun",
  serious: "direct, weighty, minimal humor"
};

const RATING_HINT: Record<Rating, string> = {
  G: "Pixar clean, no profanity or adult topics.",
  PG: "Shrek clever, mild words like hell or damn only.",
  "PG-13": "Marvel witty, moderate swearing ok (shit, ass, hell). No F-bombs.",
  R: "Hangover raw, strong profanity allowed (fuck, shit, asshole). Non-graphic adult themes, no slurs."
};

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

function buildSystem(tone: Tone, rating: Rating, category: string, subcategory: string, topic: string, inserts: string[]) {
  const toneWord = TONE_HINT[tone] || "witty";
  const ratingGate = RATING_HINT[rating] || "";
  const insertRule = inserts.length === 1
    ? `Include "${inserts[0]}" exactly once in every line, preferably near the end or as the closing punchline. Do not start a line with it unless it fits the rhythm.`
    : inserts.length > 1
    ? `Include each of these at least once across the set: ${inserts.join(", ")}.`
    : "";
  const pov = povHint(inserts);
  const style = COMEDY_STYLES[Math.floor(Math.random() * COMEDY_STYLES.length)];
  const catVoice = CATEGORY_HINT[category] || "";
  const savageRule = tone === "savage"
    ? "Roast the subject or reader with sharp, playful sarcasm. Use attitude, mild profanity if needed (shit, hell, ass). Be honest, not cruel."
    : "";

  return `
Write four one-liners that actually make people laugh.
Topic: ${subcategory}. Tone: ${tone}. Rating: ${rating}.
Sound like a sarcastic friend telling stories at a bar, not a caption.
Adjust intensity to match rating:
R: strong profanity allowed (fuck, shit, asshole). Dark, risky humor fine, no slurs or explicit sex.
PG-13: edgy, flirty, mild swears (hell, damn, crap). Alcohol or chaos jokes fine.
PG: clever, cheeky, clean humor only.
G: wholesome, simple, safe humor.
Each line must have rhythm, attitude, and a solid punchline.
If insert words exist, build every joke naturally around them so they matter to the punch.
Use only commas and periods. No em dashes, hyphens-as-pauses, quotes, colons, semicolons, or symbols.
Each line 70–125 characters, starts with a capital letter, ends with punctuation.
`.trim();
}

function synth(topic: string, tone: Tone, inserts: string[] = [], rating: Rating = "PG"): string[] {
  const name = inserts[0] || "you";
  const t = (topic || "the moment").replace(/[-_]/g, " ").trim();

  const jokes = {
    humorous: [
      `Time tried to sneak by, ${t} caught it mid-yawn.`,
      `${name} called it ${t}, destiny called it a rerun.`,
      `${t} showed up early, confidence showed up late.`,
      `If ${t} had a loyalty card, ${name} would have maxed it out.`
    ],
    savage: [
      `${t} showed up loud and uninvited, ${name} blamed gravity.`,
      `${name} survived ${t}, barely, sarcasm included.`,
      `${t} tried to teach humility, ${name} skipped class.`,
      `${name} mastered ${t}, chaos wrote the review.`
    ],
    sentimental: [
      `${t} reminds ${name} how ordinary days become quiet miracles.`,
      `${name} found calm hiding inside ${t}.`,
      `There's comfort in small things like ${t} and trying again.`,
      `${t} isn't perfect, but neither is life, and that's okay.`
    ],
    nostalgic: [
      `${t} feels like an old song ${name} forgot they loved.`,
      `${name} remembers ${t} differently now, softer somehow.`,
      `${t} was simpler then, or maybe ${name} just thought it was.`,
      `Looking back at ${t}, ${name} wishes they'd known what they had.`
    ],
    romantic: [
      `${name} found magic hiding in ${t}.`,
      `${t} made ${name} believe in second chances.`,
      `Every moment of ${t} feels like ${name} wrote it themselves.`,
      `${name} and ${t}, a story worth retelling.`
    ],
    inspirational: [
      `${name} turned ${t} into proof that trying matters.`,
      `${t} taught ${name} that courage starts small.`,
      `${name} faced ${t} and chose to keep going.`,
      `${t} reminds ${name} that growth looks messy first.`
    ],
    playful: [
      `${name} approached ${t} like a game show challenge.`,
      `${t} got silly fast, ${name} made it sillier.`,
      `${name} treated ${t} like recess, rules optional.`,
      `${t} was serious until ${name} added sound effects.`
    ],
    serious: [
      `${name} met ${t} with clarity and intention.`,
      `${t} demanded honesty, ${name} delivered.`,
      `${name} faced ${t} without excuses or shortcuts.`,
      `${t} tested ${name}, substance won.`
    ]
  };

  const pool = jokes[tone] || jokes.humorous;
  return pool.map(l =>
    l.trim().replace(/([^.?!])$/, "$1.").slice(0, 140)
  ).slice(0, 4);
}

function ensureInsertPlacement(lines: string[], insert: string): string[] {
  return lines.map(l => {
    if (!l.toLowerCase().includes(insert.toLowerCase())) return l;
    const tokens = l.split(" ");
    if (tokens[0].toLowerCase() === insert.toLowerCase()) {
      tokens.shift();
      tokens.push(insert);
      return tokens.join(" ").replace(/\s+/g, " ").trim().replace(/([^.?!])$/, "$1.");
    }
    return l;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const region = Deno.env.get("VERCEL_REGION") || Deno.env.get("SUPABASE_REGION") || "unknown";
  console.log("[generate-text] region:", region);

  // Predeclare for catch fallback
  let category = "", subcat = "", theme = "", tone: Tone = "humorous", rating: Rating = "PG", inserts: string[] = [], topic = "topic";

  // Hard deadline to ensure response within 28s
  const HARD_DEADLINE_MS = 28000;
  let deadlineHit = false;
  const hardTimer = setTimeout(() => {
    deadlineHit = true;
    console.warn("[generate-text] hard deadline reached at 28s, returning synth");
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

    console.log("[generate-text] → OpenAI");
    console.log("[generate-text] model:", MODEL);
    console.log("[generate-text] API key present:", !!OPENAI_API_KEY);
    console.log("[generate-text] prompt length:", SYSTEM.length + payload.length);
    
    const messages = [
      { role: "system", content: SYSTEM },
      { role: "user", content: payload }
    ];
    
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
        max_completion_tokens: 1200,
      }),
      signal: ctl.signal,
    });

    clearTimeout(timer);
    
    console.log("[generate-text] response status:", r.status);
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error("[generate-text] API error:", r.status, errorText);
      const fallback = synth(topic, tone, inserts, rating);
      console.warn("[generate-text] returning synth due to API error");
      return new Response(
        JSON.stringify({ success: true, options: fallback, model: MODEL, source: "synth" }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const data = await r.json();
    let content = data?.choices?.[0]?.message?.content || "";
    let finish = data?.choices?.[0]?.finish_reason || "n/a";
    console.log("[generate-text] finish_reason:", finish);
    
    // Retry once if model hit token limit
    if (finish === "length") {
      console.warn("[generate-text] retrying due to finish_reason: length");
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
            messages,
            max_completion_tokens: 1500,
          }),
          signal: ctl2.signal,
        });
        const raw2 = await r2.text();
        if (r2.ok) {
          const data2 = JSON.parse(raw2);
          const msg2 = data2?.choices?.[0]?.message;
          content = typeof msg2?.content === "string" ? msg2.content : "";
          finish = data2?.choices?.[0]?.finish_reason || "n/a";
          console.log("[generate-text] finish_reason (retry):", finish);
        }
      } finally {
        clearTimeout(timer2);
      }
    }
    
    console.log("[generate-text] raw content:", content);

    // Two-pass parser: strip bullets/numbers, try strict then lenient
    const clean = (l: string) => l
      .replace(/^[\s>*-]+\s*/, "")      // strip bullets like -, *, >
      .replace(/^\d+\.\s+/, "")         // strip "1. "
      .replace(/[\u2013\u2014]/g, ",")  // em/en dash → comma
      .replace(/[:;]+/g, ",")           // colons/semicolons → comma
      .replace(/\s+/g, " ")
      .trim()
      .replace(/([^.?!])$/, "$1.");

    const rawLines = content.split(/\r?\n+/).map(clean).filter(l => l.length > 0);
    console.log("[generate-text] rawLines after clean:", rawLines.length, rawLines.map(l => `${l.length}ch`));
    
    // Strict validation: 70-125 characters only
    let lines = rawLines.filter(l => l.length >= 70 && l.length <= 125).slice(0, 4);
    
    // Determine source and handle fallback
    let source: string;
    if (lines.length < 2) {
      // Model failed completely, use full synth
      lines = synth(topic, tone, inserts, rating);
      source = "synth";
    } else if (lines.length < 4) {
      // Model gave us some lines, pad with synth
      const pad = synth(topic, tone, inserts, rating).slice(0, 4 - lines.length);
      lines = [...lines, ...pad];
      source = "model+padded";
    } else {
      // Model gave us 4+ good lines
      source = "model";
    }

    // Move leading inserts to end for better punchline placement
    if (inserts.length === 1) {
      lines = ensureInsertPlacement(lines, inserts[0]);
    }

    console.log("✅ FINAL SOURCE:", source);

    clearTimeout(hardTimer);
    if (deadlineHit) {
      return new Response(
        JSON.stringify({ success: true, options: synth(topic, tone, inserts, rating), model: MODEL, source: "synth-deadline" }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, options: lines, model: MODEL, source }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

} catch (err) {
    clearTimeout(hardTimer);
    
    const isTimeout = String(err).includes("timeout") || String(err).includes("AbortError");
    console.error("[generate-text] error:", String(err));
    
    if (deadlineHit || isTimeout) {
      console.warn("[generate-text] timeout occurred, returning synth");
      return new Response(
        JSON.stringify({ success: true, options: synth(topic, tone, inserts, rating), model: MODEL, source: "synth-timeout" }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ success: false, error: String(err), status: 500 }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
