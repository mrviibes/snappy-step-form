// supabase/functions/generate-text/index.ts
// Viibe Text Generation – 3.5 Turbo, tone + rating + comedian codes, strict one-liners

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const API = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-3.5-turbo";

const TIMEOUT_MS = 18000;
const HARD_DEADLINE_MS = 26000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Tone = "Humorous" | "Savage" | "Sentimental" | "Inspirational";
type Rating = "G" | "PG" | "PG-13" | "R";

type Body = {
  category?: string;
  subcategory?: string;
  tone?: string;
  rating?: string;
  insertWords?: string[];
  insertwords?: string[]; // legacy
  style?: string;
  styleId?: string;
  theme?: string;
  comedian?: string; // optional override
};

const toTitle = (s?: string) => (s || "").trim().toLowerCase().replace(/^\w/, c => c.toUpperCase());
const CANON_TONES = new Set<Tone>(["Humorous","Savage","Sentimental","Inspirational"]);
const CANON_RATINGS = new Set<Rating>(["G","PG","PG-13","R"]);

const canonTone = (s?: string): Tone => {
  const t = toTitle(s) as Tone;
  return CANON_TONES.has(t) ? t : "Humorous";
};
const canonRating = (s?: string): Rating => {
  const r = (s || "").toUpperCase() as Rating;
  return CANON_RATINGS.has(r) ? r : "PG";
};

// 40 style rules, unchanged in spirit, compact wording
const STYLE_DEFS: Record<string, string> = {
  "punchline-first": "Start with the hit, then a quick reason.",
  "story": "Mini scene, quick build, clean payoff.",
  "everyday-pain": "Relatable hassle, crisp twist.",
  "pop-culture": "One clear reference, not name spam.",
  "self-deprecating": "Speaker takes the loss, charming.",
  "observation": "Noticing a pattern, tight contrast lands.",
  "absurdist": "Strange logic that still tracks.",
  "punny": "One word flip only.",
  "word-flip": "Expectation set then reversed meaning.",
  "relatable-chaos": "Human mess, neat finish.",
  "brutal-truth": "Plain hard truth, surgical wording.",
  "playground-insult": "Petty jab, clever not cruel.",
  "roast-monologue": "Stacked tag in one sentence.",
  "dark-irony": "Bleak turn with restraint.",
  "petty-comeback": "Score settle, compact sting.",
  "confidence-flex": "Self as prize, playful brag.",
  "mock-advice": "Fake tip, wrong lesson.",
  "arrogant-confession": "Shameless reveal, smug grin.",
  "sarcastic-proverb": "Twisted saying, modern spin.",
  "ego-trip": "Hyperbole about self, crisp.",
  "heartfelt-humor": "Warm note, gentle laugh.",
  "memory-flash": "Nostalgia beat, soft twist.",
  "rom-com": "Playful flirt, hopeful tag.",
  "cheerful-irony": "Sweet tone, sly flip.",
  "friendship-toast": "Affection first, punch after.",
  "love-roast": "Kind tease, caring core.",
  "bittersweet-laugh": "Soft ache, light smile.",
  "thankful-chaos": "Gratitude amid mess.",
  "family-banter": "Household dynamic, loving jab.",
  "flirty-line": "Confident tease, charming close.",
  "self-improvement-roast": "Boost with a burn, upbeat.",
  "fake-guru": "Motivation parody, faux wisdom.",
  "winners-sarcasm": "Smug cheer, trophy tone.",
  "life-lesson": "Simple truth, funny turn.",
  "hustle-parody": "Grind culture send-up.",
  "wisdom-twist": "Aphorism, left turn ending.",
  "cheer-up": "Light lift, playful nudge.",
  "inner-peace": "Zen calm, tiny smirk.",
  "big-dream-roast": "Ambition joke, spicy hope.",
  "enlightened-idiot": "Dumb take, oddly wise."
};

function pickDefaultStyle(tone: Tone): string {
  if (tone === "Humorous") return "punchline-first";
  if (tone === "Savage") return "brutal-truth";
  if (tone === "Sentimental") return "heartfelt-humor";
  return "self-improvement-roast";
}

// Comedian codes to inject rhythm
const COMEDIAN_CODES: Record<Tone, string[]> = {
  Humorous: ["Jerry Seinfeld", "John Mulaney", "Ali Wong", "Kevin Hart"],
  Savage: ["Bill Burr", "Ricky Gervais", "Joan Rivers", "Anthony Jeselnik"],
  Sentimental: ["Mike Birbiglia", "Hasan Minhaj", "Bo Burnham", "Taylor Tomlinson"],
  Inspirational: ["Robin Williams", "George Carlin", "Jim Carrey", "Ellen DeGeneres"]
};

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// Rating modifiers actually used in prompt
const RATING_TONE_ADJUSTMENTS: Record<Rating, string> = {
  G: "Completely clean, family-friendly, no innuendo or profanity.",
  PG: "Light sarcasm, very mild innuendo allowed, still safe.",
  "PG-13": "Clever adult undertone allowed, moderate sarcasm.",
  R: "Unfiltered, bold, edgy or dark humor allowed; keep it witty, not gross."
};

function systemPrompt(b: {
  category: string; subcategory: string; tone: Tone; rating: Rating;
  insertWords: string[]; styleId?: string; comedian?: string | null;
}) {
  const styleId = (b.styleId && STYLE_DEFS[b.styleId]) ? b.styleId : pickDefaultStyle(b.tone);
  const styleRule = STYLE_DEFS[styleId];
  const comedianRef = b.comedian && COMEDIAN_CODES[b.tone]?.includes(b.comedian)
    ? b.comedian
    : pickRandom(COMEDIAN_CODES[b.tone]);

  const inserts = b.insertWords.length
    ? `Insert words: ${b.insertWords.join(", ")}. Each line must include all insert words naturally.`
    : `No insert words.`;

  return [
    `You are a professional comedian writing one-liner jokes in the style of ${comedianRef}.`,
    `Context: ${b.category}, ${b.subcategory}. Use as theme only, do not force these exact words.`,
    `Tone: ${b.tone}. Rating: ${b.rating}. ${RATING_TONE_ADJUSTMENTS[b.rating]}`,
    `Style: ${styleId} — ${styleRule}`,
    inserts,
    "Hard rules:",
    "- Generate exactly 4 outputs.",
    "- One sentence per output, setup then punchline.",
    "- 60 to 110 characters per output.",
    "- Allowed punctuation: commas and periods only.",
    "- Start with a capital, end with a period.",
    "- No meta talk, no instructions, no emojis.",
    "Return a plain numbered list 1-4."
  ].join(" ");
}

function userPrompt(b: {
  category: string; subcategory: string; tone: Tone; rating: Rating;
  insertWords: string[]; styleId?: string; comedian?: string | null;
}) {
  return JSON.stringify({
    category: b.category,
    subcategory: b.subcategory,
    tone: b.tone,
    rating: b.rating,
    styleId: b.styleId || pickDefaultStyle(b.tone),
    insert_words: b.insertWords,
    comedian: b.comedian || undefined
  });
}

// Keep apostrophes, strip noisy symbols, no semicolons or exclamations
const ILLEGAL_CHARS = /[:;!?"""''(){}\[\]<>/_*#+=~^`|\\]/g;
const EM_DASH = /[\u2014\u2013]/g;

function normalizeLine(s: string): string {
  let t = s.trim();
  t = t.replace(/^[>*\-]+\s*/, "").replace(/^\d+\.\s*/, "");
  t = t.replace(EM_DASH, ",");
  t = t.replace(ILLEGAL_CHARS, "");
  t = t.replace(/\s+/g, " ");
  if (t) t = t[0].toUpperCase() + t.slice(1);
  if (!/[.]$/.test(t)) t = t.replace(/[.?!]$/, "") + ".";
  return t;
}
function isOneSentence(s: string): boolean { return s.split(".").filter(Boolean).length === 1; }
function inCharRange(s: string, min = 60, max = 110): boolean {
  const len = [...s].length;
  return len >= min && len <= max;
}
function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function hasAllInserts(s: string, inserts: string[]) {
  return inserts.every(w => new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(s));
}

// rating filter: only restrict lower ratings
function violatesRating(s: string, rating: Rating): boolean {
  const hardR = /\b(fuck|shit|bitch|asshole|goddamn|bullshit)\b/i;
  const pg13 = /\b(hell|damn)\b/i;
  if (rating === "G") return hardR.test(s) || pg13.test(s);
  if (rating === "PG") return hardR.test(s);
  return false; // PG-13 and R can carry edge
}

function uniqueByText(lines: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const key = l.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(l); }
  }
  return out;
}
function filterBySubcatUse(lines: string[], subcat: string) {
  if (!subcat) return lines;
  let used = 0;
  const re = new RegExp(`\\b${escapeRegExp(subcat)}\\b`, "i");
  return lines.filter(l => re.test(l) ? used++ < 1 : true);
}

function validateAndTrim(
  raw: string,
  inserts: string[],
  subcat: string,
  want = 4,
  rating: Rating = "PG"
): string[] {
  let lines = raw.split(/\r?\n+/).map(normalizeLine).filter(Boolean);
  lines = lines.filter(l =>
    isOneSentence(l) && inCharRange(l) && hasAllInserts(l, inserts) && !violatesRating(l, rating)
  );
  lines = uniqueByText(lines);
  lines = filterBySubcatUse(lines, subcat);
  return lines.slice(0, want);
}

function synthFallback(topic: string, inserts: string[], tone: Tone): string[] {
  const a = inserts[0] || "you";
  const b = inserts[1] || "life";
  const base = [
    `${a} trained for ${topic}, ${b} graded on a curve.`,
    `${a} met ${topic} at full speed, ${b} filed the report.`,
    `${topic} tried to teach patience, ${a} borrowed time from ${b}.`,
    `${a} survived ${topic}, ${b} wrote a cheerful obituary.`
  ];
  return base.map(normalizeLine).filter(l => inCharRange(l));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const HARD = setTimeout(() => {}, HARD_DEADLINE_MS);
  let deadlineHit = false;
  const guard = setTimeout(() => { deadlineHit = true; }, HARD_DEADLINE_MS);

  try {
    if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
    const b = (await req.json()) as Body;

    const category = String(b.category || "").trim();
    const subcategory = String(b.subcategory || "").trim();
    const tone = canonTone(b.tone);
    const rating = canonRating(b.rating);
    const styleId = b.styleId || undefined;
    const comedian = b.comedian || null;

    const insertWords = (Array.isArray(b.insertWords) ? b.insertWords : Array.isArray(b.insertwords) ? b.insertwords : [])
      .filter(Boolean).slice(0, 2).map(String);

    const topic = (b.theme || subcategory || category || "the moment").replace(/[-_]/g, " ").trim();

    const full = {
      category: category || "misc",
      subcategory: subcategory || "general",
      tone,
      rating,
      insertWords,
      styleId,
      comedian
    };

    const messages = [
      { role: "system", content: systemPrompt(full) },
      { role: "user", content: userPrompt(full) }
    ];

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);

    const r = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.7, max_tokens: 450 }),
      signal: ctl.signal
    });

    clearTimeout(timer);

    let source = "model";
    let outputs: string[] = [];

    if (r.ok) {
      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      let lines = validateAndTrim(content, insertWords, full.subcategory, 4, rating);

      if (lines.length < 4 && !deadlineHit) {
        const ctl2 = new AbortController();
        const t2 = setTimeout(() => ctl2.abort(), 8000);
        try {
          const r2 = await fetch(API, {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL, messages, temperature: 0.85, max_tokens: 520 }),
            signal: ctl2.signal
          });
          if (r2.ok) {
            const d2 = await r2.json();
            const c2 = d2?.choices?.[0]?.message?.content ?? "";
            const more = validateAndTrim(c2, insertWords, full.subcategory, 4, rating);
            lines = uniqueByText([...lines, ...more]).slice(0, 4);
          }
        } finally { clearTimeout(t2); }
      }

      if (lines.length < 4) {
        source = lines.length ? "model+padded" : "synth";
        const pad = synthFallback(topic, insertWords, tone).filter(l => !violatesRating(l, rating));
        lines = uniqueByText([...lines, ...pad]).slice(0, 4);
      }
      outputs = lines;
    } else {
      const errText = await r.text();
      console.error("[generate-text] API error:", r.status, errText);
      source = "synth";
      outputs = synthFallback(topic, insertWords, tone);
    }

    outputs = outputs.map(normalizeLine)
      .filter(l => isOneSentence(l) && inCharRange(l) && hasAllInserts(l, insertWords) && !violatesRating(l, rating));

    if (outputs.length < 4) {
      const pad = synthFallback(topic, insertWords, tone).filter(l => !violatesRating(l, rating));
      outputs = uniqueByText([...outputs, ...pad]).slice(0, 4);
      source = "synth-final";
    }

    clearTimeout(guard);
    clearTimeout(HARD);

    return new Response(JSON.stringify({
      success: true,
      model: MODEL,
      options: outputs,
      source,
      styleId: styleId || pickDefaultStyle(tone)
    }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });

  } catch (err) {
    clearTimeout(guard);
    clearTimeout(HARD);
    console.error("[generate-text] error:", String(err));
    const outputs = synthFallback("the moment", [], "Humorous");
    return new Response(JSON.stringify({
      success: true,
      model: MODEL,
      options: outputs,
      source: "synth-error",
      error: String(err)
    }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
