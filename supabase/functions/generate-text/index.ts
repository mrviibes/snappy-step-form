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
  insertwords?: string[];
  style?: string;
  styleId?: string;
  theme?: string;
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

const STYLE_DEFS: Record<string, string> = {
  "punchline-first": "Start with hit, explain after, tight reversal.",
  "story": "Mini scene, quick build, clean laugh.",
  "everyday-pain": "Relatable hassle, small misery, wink.",
  "pop-culture": "One clear reference, not name spam.",
  "self-deprecating": "Speaker takes the loss, charming.",
  "observation": "Noticing pattern, crisp contrast lands.",
  "absurdist": "Strange logic, still tracks, quick twist.",
  "punny": "Wordplay once, no groan stack.",
  "word-flip": "Expectation setup, meaning flips late.",
  "relatable-chaos": "Human mess, controlled punch finish.",
  "brutal-truth": "Plain hard truth, surgical wording.",
  "playground-insult": "Petty jab, clever not cruel.",
  "roast-monologue": "Stacked tag, one sentence cadence.",
  "dark-irony": "Bleak turn, witty restraint.",
  "petty-comeback": "Score settling, compact sting.",
  "confidence-flex": "Self as prize, playful brag.",
  "mock-advice": "Fake tip, wrong lesson.",
  "arrogant-confession": "Shameless reveal, smug grin.",
  "sarcastic-proverb": "Twisted saying, modern spin.",
  "ego-trip": "Hyperbole about self, crisp.",
  "heartfelt-humor": "Warm note, gentle laugh.",
  "memory-flash": "Nostalgia beat, soft twist.",
  "rom-com": "Playful flirt, hopeful tag.",
  "cheerful-irony": "Sweet tone, sly flip.",
  "friendship-toast": "Affection first, punch second.",
  "love-roast": "Kind tease, caring core.",
  "bittersweet-laugh": "Soft ache, light smile.",
  "thankful-chaos": "Gratitude amid mess, grin.",
  "family-banter": "Household dynamic, loving jab.",
  "flirty-line": "Confident tease, charming close.",
  "self-improvement-roast": "Boost with burn, upbeat.",
  "fake-guru": "Motivation parody, faux wisdom.",
  "winners-sarcasm": "Smug cheer, trophy tone.",
  "life-lesson": "Simple truth, funny turn.",
  "hustle-parody": "Grind culture send-up.",
  "wisdom-twist": "Aphorism, left turn ending.",
  "cheer-up": "Light lift, playful nudge.",
  "inner-peace": "Zen calm, tiny smirk.",
  "big-dream-roast": "Ambition joke, spicy hope.",
  "enlightened-idiot": "Dumb take, weirdly wise."
};

function pickDefaultStyle(tone: Tone): string {
  if (tone === "Humorous") return "punchline-first";
  if (tone === "Savage") return "brutal-truth";
  if (tone === "Sentimental") return "heartfelt-humor";
  return "self-improvement-roast";
}

function systemPrompt(b: {
  category: string; subcategory: string; tone: Tone; rating: Rating;
  insertWords: string[]; styleId?: string;
}) {
  const styleId = (b.styleId && STYLE_DEFS[b.styleId]) ? b.styleId : pickDefaultStyle(b.tone);
  const styleRule = STYLE_DEFS[styleId];

  const insertsLine = b.insertWords.length
    ? `Insert words: ${b.insertWords.join(", ")}. Each output must include all insert words naturally.`
    : `No insert words provided.`;

  return [
    `You are a professional comedy writer generating four one-liner jokes.`,
    `Category: ${b.category}, Subcategory: ${b.subcategory}.`,
    `Tone: ${b.tone}. Rating: ${b.rating}.`,
    `Style: ${styleId} — ${styleRule}`,
    insertsLine,
    `Rules:`,
    `- Exactly 4 outputs.`,
    `- One sentence each, setup then punchline.`,
    `- 50 to 100 characters.`,
    `- Only commas and periods.`,
    `- Start with a capital, end with a period.`,
    `- Do not repeat the exact word "${b.subcategory}" more than once across the set.`,
    `- Stay within rating. No meta talk.`,
    `Output format: a plain numbered list 1-4, one line per item.`
  ].join(" ");
}

function userPrompt(b: { category: string; subcategory: string; tone: Tone; rating: Rating; insertWords: string[]; styleId?: string }) {
  return JSON.stringify({
    category: b.category,
    subcategory: b.subcategory,
    tone: b.tone,
    rating: b.rating,
    styleId: b.styleId || pickDefaultStyle(b.tone),
    insert_words: b.insertWords
  });
}

const ILLEGAL_CHARS = /[:;!?"""'''(){}\[\]<>/_*#+=~^`|\\]/g;
const EM_DASH = /[\u2014\u2013]/g;

function normalizeLine(s: string): string {
  let t = s.trim();
  t = t.replace(/^[>*\-]+\s*/, "").replace(/^\d+\.\s*/, "");
  t = t.replace(EM_DASH, ",");
  t = t.replace(ILLEGAL_CHARS, "");
  t = t.replace(/\s+/g, " ");
  if (t.length) t = t[0].toUpperCase() + t.slice(1);
  if (!/[.]$/.test(t)) t = t.replace(/[.?!]$/, "") + ".";
  return t;
}

function isOneSentence(s: string): boolean { 
  return s.split(".").filter(Boolean).length === 1; 
}

function inCharRange(s: string, min = 50, max = 100): boolean { 
  const len = [...s].length; 
  return len >= min && len <= max; 
}

function escapeRegExp(s: string) { 
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); 
}

function hasAllInserts(s: string, inserts: string[]) { 
  return inserts.every(w => new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(s)); 
}

function uniqueByText(lines: string[]) { 
  const seen = new Set<string>(); 
  return lines.filter(l => !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase())); 
}

function filterBySubcatUse(lines: string[], subcat: string) {
  if (!subcat) return lines;
  let used = 0; 
  const re = new RegExp(`\\b${escapeRegExp(subcat)}\\b`, "i");
  return lines.filter(l => re.test(l) ? used++ < 1 : true);
}

function validateAndTrim(raw: string, inserts: string[], subcat: string, want = 4): string[] {
  let lines = raw.split(/\r?\n+/).map(normalizeLine).filter(Boolean);
  lines = lines.filter(l => isOneSentence(l) && inCharRange(l) && hasAllInserts(l, inserts));
  lines = uniqueByText(lines);
  lines = filterBySubcatUse(lines, subcat);
  return lines.slice(0, want);
}

function synthFallback(topic: string, inserts: string[], tone: Tone): string[] {
  const [a, b] = [inserts[0] || "you", inserts[1] || "life"];
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
    const insertWords = (Array.isArray(b.insertWords) ? b.insertWords : Array.isArray(b.insertwords) ? b.insertwords : [])
      .filter(Boolean).slice(0, 2).map(String);

    const topic = (b.theme || subcategory || category || "the moment").replace(/[-_]/g, " ").trim();

    console.log("[generate-text] Request:", {
      category: category || "misc",
      subcategory: subcategory || "general",
      tone,
      rating,
      styleId: styleId || pickDefaultStyle(tone),
      insertWords,
      topic
    });

    const full = {
      category: category || "misc",
      subcategory: subcategory || "general",
      tone,
      rating,
      insertWords,
      styleId
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
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.8, max_tokens: 400 }),
      signal: ctl.signal
    });

    clearTimeout(timer);

    let source = "model";
    let outputs: string[] = [];

    if (r.ok) {
      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      console.log("[generate-text] Raw response:", content.substring(0, 200));
      
      let lines = validateAndTrim(content, insertWords, full.subcategory);
      console.log("[generate-text] Valid lines after first pass:", lines.length);

      if (lines.length < 4 && !deadlineHit) {
        console.log("[generate-text] Retrying with higher temperature");
        const ctl2 = new AbortController();
        const t2 = setTimeout(() => ctl2.abort(), 8000);
        try {
          const r2 = await fetch(API, {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL, messages, temperature: 0.9, max_tokens: 500 }),
            signal: ctl2.signal
          });
          if (r2.ok) {
            const d2 = await r2.json();
            const c2 = d2?.choices?.[0]?.message?.content ?? "";
            const more = validateAndTrim(c2, insertWords, full.subcategory);
            lines = uniqueByText([...lines, ...more]).slice(0, 4);
            console.log("[generate-text] Valid lines after retry:", lines.length);
          }
        } finally { clearTimeout(t2); }
      }

      if (lines.length < 4) {
        source = lines.length ? "model+padded" : "synth";
        console.log("[generate-text] Padding with synth, reason:", source);
        lines = uniqueByText([...lines, ...synthFallback(topic, insertWords, tone)]).slice(0, 4);
      }

      outputs = lines;
    } else {
      const errText = await r.text();
      console.error("[generate-text] API error:", r.status, errText);
      source = "synth";
      outputs = synthFallback(topic, insertWords, tone);
    }

    outputs = outputs.map(normalizeLine)
      .filter(l => isOneSentence(l) && inCharRange(l) && hasAllInserts(l, insertWords));

    if (outputs.length < 4) {
      const pad = synthFallback(topic, insertWords, tone);
      outputs = uniqueByText([...outputs, ...pad]).slice(0, 4);
      source = "synth-final";
      console.log("[generate-text] Final padding applied");
    }

    clearTimeout(guard); 
    clearTimeout(HARD);

    console.log("[generate-text] Final outputs:", outputs);

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
