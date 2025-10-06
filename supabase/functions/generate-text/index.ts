// supabase/functions/generate-text/index.ts
// Streamlined Viibe Text Generator - Fast & Efficient

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const API = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5-mini-2025-08-07";
const TIMEOUT_MS = 18000;

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
    ? `Include "${inserts[0]}" once in every line, natural placement ok.`
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
Write 4 one-liners for ${category}/${subcategory}. Topic: ${topic}.
Tone: ${toneWord}. Rating: ${ratingGate}.
${insertRule}
${pov}
Comedy style: ${style}
${catVoice}
${savageRule}
Use setup, pivot, and tag like a live comedian. Vary sentence openings so not all lines start the same.
Each line: 75–125 characters, ends with punctuation. Write naturally, not clipped.
If lines are too short, expand them with imagery or emotion.
Do not repeat the topic word in every line. Write like clever card text or a one-liner caption people would actually print.
Avoid ad-style phrasing; sound like a human telling a joke or observation.
No emojis, hashtags, ellipses, colons, semicolons, or em-dashes. Use commas or periods only.
`.trim();
}

function synth(topic: string, tone: Tone, inserts: string[] = []) {
  const set = [
    "Love wins again and the catering survived.",
    "Two rings, one group chat forever changed.",
    "The champagne's judging no one tonight.",
    "Here's to promises that age better than haircuts."
  ];
  return set.map(l => l.trim().replace(/([^.?!])$/, "$1."));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

    const b = await req.json();
    const category = String(b.category || "").trim();
    const subcat = String(b.subcategory || "").trim();
    const theme = String(b.theme || "").trim();
    const tone = (b.tone || "humorous") as Tone;
    const rating = (b.rating || "PG") as Rating;
    const inserts = Array.isArray(b.insertWords) ? b.insertWords.filter(Boolean).slice(0, 2) : [];
    const topic = (theme || subcat || category || "topic").replace(/[-_]/g, " ").trim();

    const SYSTEM = buildSystem(tone, rating, category, subcat, topic, inserts);
    const payload = `Category: ${category}, Subcategory: ${subcat}, Tone: ${tone}, Rating: ${rating}, Topic: ${topic}${inserts.length ? `, Insert words: ${inserts.join(", ")}` : ""}`;

    console.log("[generate-text] → OpenAI");
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
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: payload }
        ],
        max_completion_tokens: 1500,
      }),
      signal: ctl.signal,
    });

    clearTimeout(timer);
    
    if (!r.ok) {
      console.error("[generate-text] API error:", r.status);
      throw new Error(`OpenAI ${r.status}`);
    }

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const finish = data?.choices?.[0]?.finish_reason || "n/a";
    console.log("[generate-text] finish_reason:", finish);

    // Single-pass parse: split on newlines, clean, filter 60-130 chars
    const clean = (l: string) => l
      .replace(/[\u2013\u2014]/g, ",")
      .replace(/[:;]+/g, ",")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/([^.?!])$/, "$1.");

    const lines = content
      .split(/\r?\n+/)
      .map(clean)
      .filter(l => l.length >= 60 && l.length <= 130)
      .slice(0, 4);

    const final = lines.length === 4 ? lines : synth(topic, tone, inserts);
    const source = lines.length === 4 ? "model" : "synth";

    console.log("[generate-text] source:", source, "| lines:", final.length);

    return new Response(
      JSON.stringify({ success: true, options: final, model: MODEL, source }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const isTimeout = String(err).includes("timeout") || String(err).includes("AbortError");
    console.error("[generate-text] error:", String(err));
    return new Response(
      JSON.stringify({ success: false, error: String(err), status: isTimeout ? 504 : 500 }),
      { status: isTimeout ? 504 : 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
