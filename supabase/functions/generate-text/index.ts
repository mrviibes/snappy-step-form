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

function capLenSmart(s = "", n = MAX_LEN): string {
  if (s.length <= n) return s;
  const pre = s.slice(0, n);
  const lastStop = Math.max(pre.lastIndexOf("."), pre.lastIndexOf("!"), pre.lastIndexOf("?"));
  if (lastStop > 40) return pre.slice(0, lastStop + 1);
  const i = pre.lastIndexOf(" ");
  return (i > 40 ? pre.slice(0, i) : pre).trim(); // button added later if needed
}

function sanitizePunct(s = ""): string {
  return s.replace(/[;:()\[\]{}"\/\\<>|~`^_*@#\$%&+=–—]/g, " ").replace(/\s{2,}/g, " ").trim();
}
function fixSpacesBeforePunct(s: string) { return s.replace(/\s+([.!?,])/g, "$1"); }
function fixCommaPeriod(s: string) { return s.replace(/,\s*([.!?])/g, "$1"); }
function fixDoubleCommas(s: string) { 
  return s.replace(/,\s*,+/g, ",").replace(/^([^,]+),\s+([A-Z])/g, "$1. $2"); 
}
function fixVocativeComma(s: string, name?: string): string {
  if (!name) return s;
  // Fix "Jesse, verb" → "Jesse verb" when it's awkward (name followed by comma and lowercase letter)
  return s.replace(new RegExp(`\\b${escapeRE(name)},\\s+([a-z])`, 'g'), `${name} $1`);
}
function isCompleteSentence(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 10) return false; // Too short to be a real sentence
  // Must have a verb indicator and end with proper punctuation
  const hasVerb = /\b(is|are|was|were|has|have|had|do|does|did|can|could|will|would|should|'s|'re|'ve|'d|'ll|got|get|make|made|need|turn|age|give|take|look)\b/i.test(trimmed);
  const endsProper = /[.!?]$/.test(trimmed);
  const hasWords = trimmed.split(/\s+/).length >= 4;
  return hasVerb && endsProper && hasWords;
}
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
  if (/^[A-Z][a-z]+(?:[-\s][A-Z][a-z]+)*$/.test(w)) return "name";
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

// Gentle fallback: only insert if truly missing (trust AI to place naturally)
function ensureInsertOnce(line: string, word: string): string {
  if (!word) return line;
  
  // Check if word already exists (including possessive)
  const base = new RegExp(`\\b${escapeRE(word)}\\b`, "i");
  const poss = new RegExp(`\\b${escapeRE(word)}'s\\b`, "i");
  if (base.test(line) || poss.test(line)) return line;
  
  // If missing, trust AI placement through prompt - don't force mechanical insertion
  return line;
}

// Distribute exactly ONE insert per line (round-robin)
function distributeInsertsRoundRobin(lines: string[], names: string[], traits: string[], others: string[]): string[] {
  const queue = [...names, ...traits, ...others].filter(Boolean);
  if (queue.length === 0) return lines;
  return lines.map((line, i) => ensureInsertOnce(line, queue[i % queue.length]));
}

// Gentle trait polish
function polishTraits(line: string, traits: string[], names: string[]): string {
  let s = line;
  const name = names[0] || "";
  for (const t of traits) {
    if (name) {
      s = s.replace(new RegExp(`\\bhappy\\s+${escapeRE(t)}\\s+birthday\\b`, "i"),
                    `Happy birthday, ${name}, proudly ${t} and thriving`);
      s = s.replace(new RegExp(`\\b${escapeRE(name)}\\s+${escapeRE(t)}\\b`, "i"),
                    `${name}, proudly ${t},`);
    } else {
      s = s.replace(new RegExp(`\\b${escapeRE(t)}\\b`, "i"), `proudly ${t}`);
    }
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
  return "med";
}

// ---------- Swear Word Variety Pool ----------
const R_SWEARS = ["fuck", "fucking", "fucked", "shit", "shitty", "damn", "hell"];
function pickRandomSwear(): string {
  return R_SWEARS[Math.floor(Math.random() * R_SWEARS.length)];
}

// ---------- Rating normalization & cut-off handling ----------
function ensureOneStrongSwearR(s: string, nameHint?: string): string {
  let out = s
    .replace(/\bf\*\*k(ing|er|ed|s)?\b/gi, "fuck$1")
    .replace(/\bs\*\*t(ting|ty|face(?:d)?|s|ted)?\b/gi, "shit$1")
    .replace(/\bbull\*\*t\b/gi, "bullshit")
    .replace(/\bf\s*k(ing|er|ed|s)?\b/gi, "fuck$1")
    .replace(/\bs\s*t(ting|ty|face(?:d)?|s|ted)?\b/gi, "shit$1")
    .replace(/\bbull\s*shit\b/gi, "bullshit");
  
  // If no swear exists, gently add one (but NOT always next to the name)
  if (!/\b(fuck|fucking|fucked|shit|shitty|damn|hell|bullshit)\b/i.test(out)) {
    const swear = pickRandomSwear();
    // Try to place after first comma if exists
    if (out.includes(",")) {
      out = out.replace(",", `, ${swear},`);
    } else {
      // Place at the beginning
      out = `${swear}, ${out}`;
    }
  }
  
  // Keep only ONE swear (but preserve which one was used)
  let kept = false;
  out = out.replace(/\b(fuck(?:ing|ed)?|shit(?:ty)?|damn|hell|bullshit)\b/gi,
    m => kept ? "" : ((kept = true), m)).replace(/\s{2,}/g," ").trim();
  
  return out;
}

function normalizeByRating(s: string, rating: string, nameHint?: string): string {
  let out = s;
  const r = (rating || "G").toUpperCase();

  if (r === "R") {
    out = out.replace(/\bgod[-\s]?damn(ed|ing)?\b/gi, "damn");
    return ensureOneStrongSwearR(out, nameHint);
  }

  if (r === "PG-13") {
    out = out
      .replace(/\bgod[-\s]?damn(ed|ing)?\b/gi, "")
      .replace(/\bfuck(?:ing|er|ed|s)?\b/gi, "")
      .replace(/\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi, "")
      .replace(/\bbullshit\b/gi, "");
    return out.replace(/\s{2,}/g, " ").trim();
  }

  if (r === "PG") {
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

// --- Cut-off detection & quick button ---
const TRAIL_WORD = /\b(and|but|so|because|though|although|however|you're|you|kinda|honestly|literally|actually|anyway)\s*$/i;
const TRAIL_PUNCT = /[,;:]$/;
const ELLIPSIS = /\.{3,}\s*$/;

const BUTTONS: Record<"PG"|"PG-13"|"R", string[]> = {
  PG:     ["deal?", "no pressure.", "we're proud of you.", "big win today."],
  "PG-13":["what the hell.", "damn right.", "**** yeah.", "own it."],
  R:      ["you glorious menace.", "now blow the candles.", "legend behavior.", "party, fucker."]
};

function seemsCutOff(s: string): boolean {
  return ELLIPSIS.test(s) || TRAIL_PUNCT.test(s) || TRAIL_WORD.test(s) || !/[.!?]$/.test(s);
}
function finishWithButton(s: string, rating: string): string {
  const tier = (rating.toUpperCase() as "PG"|"PG-13"|"R");
  const tag = (BUTTONS[tier] || BUTTONS["PG"])[Math.floor(Math.random()* (BUTTONS[tier] || BUTTONS["PG"]).length)];
  let out = s.replace(ELLIPSIS, "").replace(TRAIL_PUNCT, "").replace(TRAIL_WORD, "").trim();
  if (out.endsWith(",")) out = out.slice(0, -1).trim();
  out = out.replace(/\s{2,}/g, " ");
  return out + (out.endsWith(",") ? " " : ", ") + tag;
}

// --- Small flow fixes ---
const HEDGES = /\b(kinda|sort of|honestly|basically|literally|trust)\b[, ]?/gi;
function unHedge(s: string): string { return s.replace(/\.{3,}/g, ",").replace(HEDGES, "").replace(/\s{2,}/g, " ").trim(); }
function dedupeName(s: string, nm?: string) { return nm ? s.replace(new RegExp(`\\b${escapeRE(nm)}\\b\\s*,?\\s*\\b${escapeRE(nm)}\\b`, "i"), nm).trim() : s; }
function addGlue(s: string): string { return s; } // Trust AI flow, no mechanical insertion

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
    const R = (rating || "G").toUpperCase();

    // Insert intelligence
    const { names, traits, others } = classifyInserts(insertWords || []);
    const name = names[0] || "";

    // Multi-word insert detection
    const multiWordInserts = insertWords.filter((w: string) => w.trim().split(/\s+/).length > 1);
    if (multiWordInserts.length > 0) {
      console.warn("Multi-word insert phrases detected:", multiWordInserts);
    }

    // Minimal, model-led prompt
    const HUMOR_MATRIX = ["vocative compliment with twist", "imperative CTA", "metaphor/simile gag", "affectionate mini-roast"].join(" • ");

    let userPrompt =
`THEME: "${leaf}"
CONTEXT: ${cat || "general"}
TONE: ${toneTag}
RATING: ${ratingTag}
INSERT WORDS (use one per line): ${insertWords.join(", ") || "none"}

GOOD EXAMPLES (natural flow, complete sentences):
✅ "Jesse's so old their birth certificate is in Roman numerals" - complete sentence, clear structure
✅ "Another year closer to yelling at teenagers for existing" - complete thought, no fragments
✅ "Jesse's aging like fine wine - expensive and gives you a headache" - full sentence with dash
✅ "You're turning 30, time to adult... or just fake it better" - complete with natural pause

BAD EXAMPLES (avoid these patterns):
❌ "I got Jesse a coffin seemed like" - BROKEN GRAMMAR, incomplete sentence, sentence fragment
❌ "Jesse, closer to needing help..." - vocative comma + fragment = double bad, not a complete sentence
❌ "Happy birthday, and Jesse, you're awesome" - mechanical "and" connector
❌ "Happy birthday, Jesse, enjoy your..." - AVOID double comma pattern
❌ "Jesse, Another year closer..." - Don't start with name + comma + capital letter
❌ "Jesse's so old and their joints creak" - choppy, forced "and"

${R === "R" ? `
R-RATED EXAMPLES (use variety):
✅ "Another year older, Jesse's still fucking crushing it"
✅ "We're here to celebrate even though you're probably already drunk as shit"
✅ "Jesse walked in and suddenly everyone's bullshit got smaller"
✅ "Happy birthday - may your liver forgive us for what's about to happen"

R-RATED RULES:
• Use EXACTLY ONE swear word per line (vary them: fuck, fucking, fucked, shit, shitty, damn, hell)
• Place swears naturally in the punchline - NOT always next to insert words
• Don't force "${name || 'name'} fuck" patterns - sounds robotic
• Swear words should enhance the joke, not dominate it
• COMPLETE SENTENCES ONLY - test: would a real person say this out loud?
• Make it savage and quotable, not just profane
` : ""}

${tone?.toLowerCase() === "savage" ? `
SAVAGE TONE RULES (BE RUTHLESS):
• Go for the THROAT - make it PERSONAL and devastating
• No poetic fluff or flowery language - be brutally DIRECT
• Cross lines that make people gasp before they laugh
• Aim for "OHHH DAMN" reactions, not gentle teasing
• Think roast battle, not friendly banter

SAVAGE EXAMPLES:
✅ "Jesse's so old their childhood memories are just static and regret"
✅ "Another year older and somehow less accomplished than last year"
✅ "Jesse walked in and lowered the room's collective IQ by 20 points"
✅ "Happy birthday to someone whose best years are definitely behind them"
✅ "You're getting older but not wiser - that ship sailed years ago"
` : ""}

${tone?.toLowerCase() === "playful" ? `
PLAYFUL TONE RULES:
• Keep it light and mischievous - never mean
• Use wordplay, puns, and silly observations
• Think playful teasing between friends
• Childlike wonder meets adult humor

PLAYFUL EXAMPLES:
✅ "Jesse's got more candles than the cake can handle - fire hazard alert!"
✅ "Another trip around the sun and you're still dodging responsibility like a pro"
✅ "Age is just a number, but in Jesse's case it's a really big number"
` : ""}

${tone?.toLowerCase() === "sentimental" ? `
SENTIMENTAL TONE RULES:
• Warm, genuine, heartfelt - NO sarcasm or irony
• Focus on appreciation, love, and meaningful moments
• Can still be funny, but comes from a place of affection
• Make them feel special and valued

SENTIMENTAL EXAMPLES:
✅ "Jesse makes every room brighter just by being there"
✅ "Here's to another year of your incredible kindness changing lives"
✅ "The world got luckier the day Jesse was born"
` : ""}

CRITICAL FLOW RULES:
• Every line must be a complete, grammatically correct sentence with a clear subject and verb
• NO SENTENCE FRAGMENTS - "Jesse, closer to..." is NOT a complete sentence
• Avoid mechanical connectors (especially overusing "and")
• Avoid double commas (no "Happy birthday, Jesse, enjoy..." patterns)
• Don't start with "Name, Capital Letter" patterns
• Place insert words mid-sentence when possible, not at start with comma
• Maintain consistent POV: use "their/they" when talking ABOUT someone, "your/you" when talking TO them
• Don't mix perspectives: not "Jesse's birthday" with "your doom" in the same line
• Insert words should flow naturally within the sentence, not feel tacked on
• Test each line: Would a real person actually say this out loud?
• Aim for punchy, conversational, and quotable - like a great tweet

PRIORITY #1: BE HILARIOUS
• Each line must have a strong punchline or unexpected twist
• Go for the laugh - don't play it safe
• Sharp, memorable, quotable

RULES:
• Write 4 one-liners (one sentence each, ≤${MAX_LEN} chars)
• Use EXACTLY one insert word per line
• Place it naturally - make it sound like a human wrote it
• Never tack it on with commas at the end
• No meta-commentary, no labels, just the lines

OUTPUT (start immediately):`;

    // Call model
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]}],
          generationConfig: { temperature: 1.0, maxOutputTokens: 360 }
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

    // Trait polish
    if (traits.length) lines = lines.map(l => polishTraits(l, traits, names));

    // Light flow fixes before rating/cutoff
    lines = lines.map(l => dedupeName(unHedge(l), name));

    // Rating normalization (pass name for R placement)
    lines = lines.map(l => normalizeByRating(l, R, name));

    // Finish cut-offs with a tiny button, if needed
    lines = lines.map(l => seemsCutOff(l) ? finishWithButton(l, R) : l);

    // Fix any literal "Name"/"Name's" artifacts just in case
    function fixTemplateArtifacts(s: string, nm?: string) {
      if (!nm) return s;
      return s.replace(/\bName's\b/g, `${nm}'s`).replace(/\bName\b/g, nm);
    }
    lines = lines.map(l => fixTemplateArtifacts(addGlue(l), name));

    // Filter out sentence fragments first
    lines = lines.filter(l => isCompleteSentence(l));
    
    // If we filtered too many, keep at least one fallback
    if (lines.length === 0) {
      lines = ["Another year older and still awesome"];
    }

    // Final tidy (punct-aware cap)
    lines = lines.map(l => {
      let out = trimLine(l);
      out = fixSpacesBeforePunct(out);
      out = fixVocativeComma(out, name);
      out = fixDoubleCommas(out);
      out = fixCommaPeriod(out);
      out = sanitizePunct(out);
      out = capLenSmart(out, MAX_LEN);
      return endPunct(out);
    });

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
