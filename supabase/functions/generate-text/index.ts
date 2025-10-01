import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  general_text_rules,
  celebration_text_rules,
  joke_text_rules,
  daily_life_text_rules,
  sports_text_rules,
  pop_culture_text_rules,
  miscellaneous_text_rules,
  custom_design_text_rules,
  TONE_TAGS,
  RATING_TAGS
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Types ----------
interface GeneratePayload {
  category: string;
  subcategory?: string;
  theme?: string;
  tone?: string;      // "humorous", "savage", ...
  rating?: string;    // "G" | "PG" | "PG-13" | "R"
  insertWords?: string[]; // e.g., ["Jesse", "gay"]
}

// ---------- Minimal helpers ----------
const MAX_LEN = 120;

const RX_STRONG = [
  /\bfuck(?:ing|er|ed|s)?\b/gi,
  /\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi,
  /\bbullshit\b/gi,
];
const MEDIUM_WORDS = ["bastard","asshole","prick","dick","douche","crap"];

const TRAIT_WORDS = new Set([
  "gay","lesbian","bi","bisexual","queer","trans",
  "vegan","gluten-free","introvert","extrovert",
  "left-handed","right-handed","nerd","gamer","dad","mom"
]);

function trimLine(s = ""): string { return s.replace(/\s+/g, " ").trim(); }
function endPunct(s = ""): string { return /[.!?]$/.test(s) ? s : s + "."; }
function capLen(s = "", n = MAX_LEN): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const i = cut.lastIndexOf(" ");
  return (i > 40 ? cut.slice(0, i) : cut).replace(/[,\s]*$/, "") + ".";
}
function sanitizePunct(s = ""): string { return s.replace(/[;:()\[\]{}"\/\\<>|~`^_*@#\$%&+=–—]/g, " ").replace(/\s{2,}/g, " ").trim(); }
function fixCommaPeriod(s: string) { return s.replace(/,\s*([.!?])/g, "$1"); }
function escapeRE(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function toFour(lines: string[], fallback: string): string[] {
  let L = lines.map(trimLine).filter(Boolean);
  if (L.length > 4) L = L.slice(0, 4);
  while (L.length < 4) L.push(fallback);
  return L;
}

// ---------- Insert Intelligence ----------
type InsertKind = "name" | "trait" | "other";

function classifyInsert(word: string): InsertKind {
  const w = (word || "").trim();
  if (!w) return "other";
  if (/^[A-Z][a-z]+(?:[-\s][A-Z][a-z]+)*$/.test(w)) return "name"; // simple “looks like a name”
  if (TRAIT_WORDS.has(w.toLowerCase())) return "trait";
  return "other";
}

function classifyInserts(words: string[]) {
  const names: string[] = [];
  const traits: string[] = [];
  const others: string[] = [];
  for (const raw of (words || [])) {
    const w = (raw || "").trim();
    if (!w) continue;
    const k = classifyInsert(w);
    if (k === "name") names.push(w);
    else if (k === "trait") traits.push(w);
    else others.push(w);
  }
  return { names, traits, others };
}

// Place a word once, naturally (never as last token)
function ensureInsertOnce(line: string, word: string): string {
  if (!word) return line;
  const base = new RegExp(`\\b${escapeRE(word)}\\b`, "i");
  const poss = new RegExp(`\\b${escapeRE(word)}'s\\b`, "i");
  if (base.test(line) || poss.test(line)) return line;

  let s = line;
  if (s.includes(",")) s = s.replace(",", `, ${word},`);
  else {
    const j = s.indexOf(" ");
    s = j > 0 ? s.slice(0, j) + " " + word + s.slice(j) : `${word} ${s}`;
  }
  s = s.replace(new RegExp(`${escapeRE(word)}\\s*[.!?]?$`, "i"), `${word},`);
  return s;
}

// Distribute exactly ONE insert per line (round-robin across what the user gave)
function distributeInsertsRoundRobin(lines: string[], names: string[], traits: string[], others: string[]): string[] {
  const queue = [...names, ...traits, ...others].filter(Boolean);
  if (queue.length === 0) return lines;
  return lines.map((line, i) => ensureInsertOnce(line, queue[i % queue.length]));
}

// Gentle trait polish: affirming, not a punchline by itself
function polishTraits(line: string, traits: string[], names: string[]): string {
  let s = line;
  const name = names[0] || "";
  for (const t of traits) {
    // “Happy gay birthday” → “Happy birthday, Jesse, proudly gay and thriving.”
    if (name) {
      s = s.replace(new RegExp(`\\bhappy\\s+${escapeRE(t)}\\s+birthday\\b`, "i"),
                    `Happy birthday, ${name}, proudly ${t} and thriving`);
      // “Name gay …” → “Name, proudly gay, …”
      s = s.replace(new RegExp(`\\b${escapeRE(name)}\\s+${escapeRE(t)}\\b`, "i"),
                    `${name}, proudly ${t},`);
    } else {
      s = s.replace(new RegExp(`\\b${escapeRE(t)}\\b`, "i"), `proudly ${t}`);
    }
    // “Don't gay worry” → remove misuse
    s = s.replace(new RegExp(`\\b${escapeRE(t)}\\s+(worry|fear)\\b`, "i"), `$1`);
  }
  return s.replace(/,\s*,/g, ", ").trim();
}

// ---------- Humor control (light) ----------
type HumorMode = "high" | "med" | "soft";
function humorModeForTone(tone?: string): HumorMode {
  const t = (tone || "").toLowerCase();
  if (t === "savage" || t === "humorous" || t === "playful" || t === "inspirational") return "high";
  if (t === "serious") return "soft";
  return "med"; // sentimental, nostalgic, romantic default to soft/med but still funny
}

// ---------- Rating normalization (minimal) ----------
function normalizeByRating(s: string, rating: string): string {
  let out = s;

  if (rating === "R") {
    out = out
      .replace(/\bf\*\*k(ing|er|ed|s)?\b/gi, "fuck$1")
      .replace(/\bs\*\*t(ting|ty|face(?:d)?|s|ted)?\b/gi, "shit$1")
      .replace(/\bbull\*\*t\b/gi, "bullshit")
      .replace(/\bf\s*k(ing|er|ed|s)?\b/gi, "fuck$1")
      .replace(/\bs\s*t(ting|ty|face(?:d)?|s|ted)?\b/gi, "shit$1")
      .replace(/\bbull\s*shit\b/gi, "bullshit")
      .replace(/\b(fuck|shit|bullshit)[.!?]\s*$/i, "$1, champ"); // don't end on swear
    return out;
  }

  if (rating === "PG-13") {
    out = out
      .replace(/\bgod[-\s]?damn(ed|ing)?\b/gi, "")
      .replace(/\bfuck(?:ing|er|ed|s)?\b/gi, "")
      .replace(/\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi, "")
      .replace(/\bbullshit\b/gi, "");
    return out.replace(/\s{2,}/g, " ").trim();
  }

  if (rating === "PG") {
    out = out
      .replace(/\bfuck(?:ing|er|ed|s)?\b/gi, "heck")
      .replace(/\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi, "mess")
      .replace(/\bbullshit\b/gi, "nonsense")
      .replace(/\b(bastard|asshole|prick|dick|douche|crap)\b/gi, "");
    return out.replace(/\s{2,}/g, " ").trim();
  }

  // G
  out = out
    .replace(/\bfuck(?:ing|er|ed|s)?\b/gi, "")
    .replace(/\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi, "")
    .replace(/\bbullshit\b/gi, "")
    .replace(/\b(hell|damn|bastard|asshole|prick|dick|douche|crap)\b/gi, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

// ---------- Server ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload: GeneratePayload = await req.json();
    const { category, subcategory, theme, tone = "humorous", rating = "G", insertWords = [] } = payload;

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // Route minimal system rules
    const cat = (category || "").toLowerCase().trim();
    let systemPrompt = general_text_rules;
    if (cat === "celebrations") systemPrompt = celebration_text_rules;
    else if (cat === "jokes") systemPrompt = joke_text_rules;
    else if (cat === "daily-life" || cat === "daily life") systemPrompt = daily_life_text_rules;
    else if (cat === "sports") systemPrompt = sports_text_rules;
    else if (cat === "pop-culture" || cat === "pop culture") systemPrompt = pop_culture_text_rules;
    else if (cat === "miscellaneous") systemPrompt = miscellaneous_text_rules;
    else if (cat === "custom" || cat === "custom-design") systemPrompt = custom_design_text_rules;

    // Tags
    const toneTag   = TONE_TAGS[(tone || "").toLowerCase()] || "funny, witty, light";
    const ratingTag = RATING_TAGS[(rating || "").toUpperCase()] || "follow content rating appropriately";
    const humorMode = humorModeForTone(tone);
    const leaf = (theme || subcategory || "").trim() || "the selected theme";

    // Insert intelligence
    const { names, traits, others } = classifyInserts(insertWords || []);
    const name = names[0] || ""; // we only require one name per line max

    // Minimal, model-led prompt (keep it light)
    const HUMOR_MATRIX = [
      "vocative compliment with twist",
      "imperative CTA",
      "metaphor/simile gag",
      "affectionate mini-roast"
    ].join(" • ");

    let userPrompt =
`Write 4 distinct one-liners about "${leaf}" for a ${cat || "general"} context.
Tone: ${toneTag} (humor baseline = ${humorMode}).
Rating: ${ratingTag}.
Use these shapes (rotate): ${HUMOR_MATRIX}
Insert Words: ${insertWords.join(", ") || "none"}.
Rules: one sentence per line; ≤${MAX_LEN} chars; EXACTLY one Insert Word per line, placed naturally (allow “Name’s”), never as the last word; conversational voice; concrete detail; end on the funny; no labels.`;

    // Call model
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]}],
          generationConfig: { temperature: 0.95, maxOutputTokens: 360 }
        })
      }
    );

    if (!res.ok) {
      const t = await res.text();
      console.error("Gemini error:", res.status, t);
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse → lines; kill meta/bullets
    let lines = raw.split("\n").map(trimLine).filter(Boolean);
    lines = lines.filter(l => !/^\s*(?:tone|rating|insert|options?|line|\d+[.)])\s*/i.test(l));

    // Exactly 4
    const fallback = `Celebrating ${leaf}.`;
    lines = toFour(lines, fallback);

    // Insert once per line (round-robin so each line centers on ONE insert)
    lines = distributeInsertsRoundRobin(lines, names, traits, others);

    // Trait polish (affirming, grammatical)
    if (traits.length) lines = lines.map(l => polishTraits(l, traits, names));

    // Rating normalization (light)
    const R = (rating || "G").toUpperCase();
    lines = lines.map(l => normalizeByRating(l, R));

    // Fix any literal "Name"/"Name's" artifacts just in case
    function fixTemplateArtifacts(s: string, nm?: string) {
      if (!nm) return s;
      return s.replace(/\bName's\b/g, `${nm}'s`).replace(/\bName\b/g, nm);
    }
    lines = lines.map(l => fixTemplateArtifacts(l, name));

    // Final tidy
    lines = lines.map(l => endPunct(capLen(sanitizePunct(fixCommaPeriod(trimLine(l))))));

    return new Response(JSON.stringify({
      options: lines,
      debug: { toneTag, ratingTag, humorMode, names, traits, others }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("generate-text error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
