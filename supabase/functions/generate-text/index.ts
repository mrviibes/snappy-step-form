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
  topics?: string[];
  tone?: string;
  rating?: string;
  style?: string;
  styleId?: string;
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

// Tone modifiers for different humor styles
const toneModifiers: Record<Tone, string> = {
  Humorous: "funny, clever, quick observational humor with a modern tone.",
  Savage: "sharp, savage, cutting humor that roasts the subject brutally but playfully. Each joke should land like a confident insult, not a narrative.",
  Sentimental: "heartfelt, lightly humorous, gentle and warm.",
  Inspirational: "motivating and witty, playful optimism."
};

// Rating modifiers actually used in prompt
const ratingModifiers: Record<Rating, string> = {
  G: "family friendly, no edge or adult content.",
  PG: "light sarcasm, mild tone, still safe for everyone.",
  "PG-13": "modern language allowed, light edge or innuendo is fine.",
  R: "Write like a late-night set. Use unfiltered adult language when it helps the punchline (e.g., hell, damn, shit, asshole). Keep it witty, not gross or hateful. No slurs. No targeting protected traits."
};

function systemPrompt(b: {
  topics: string[]; tone: Tone; rating: Rating;
  styleId?: string; comedian?: string | null;
}) {
  const styleId = (b.styleId && STYLE_DEFS[b.styleId]) ? b.styleId : pickDefaultStyle(b.tone);
  const styleRule = STYLE_DEFS[styleId];
  const comedianRef = b.comedian && COMEDIAN_CODES[b.tone]?.includes(b.comedian)
    ? b.comedian
    : pickRandom(COMEDIAN_CODES[b.tone]);

  const topics = b.topics || [];
  const contextLine = topics.length
    ? `Topics: ${topics.join(", ")}. Reference them creatively, not always directly together.`
    : `No specific topics given.`;

  const nameRule = topics.length && topics[0]
    ? `Feature "${topics[0]}" but vary the structure. Some jokes can start with the name, others can reference it indirectly or place it mid-sentence.`
    : `Write general jokes.`;

  // Comedian style reference based on tone
  const comedianStyle =
    b.tone === "Savage"
      ? "Write like a roast from Bill Burr or Anthony Jeselnik."
      : b.tone === "Humorous"
      ? "Write like John Mulaney or Ali Wong."
      : b.tone === "Inspirational"
      ? "Write like Jim Carrey or Robin Williams."
      : "Write like Taylor Tomlinson.";

  // Force imagery
  const imageryRule = `Include one specific visual element or prop (e.g., cake, candles, balloons, fire, smoke alarm, decorations, etc.) to paint a mental picture.`;

  // Variety enforcement
  const varietyRule = `Vary your approach: use metaphors, comparisons, indirect references, or scenarios. Don't just say the topics literally in every joke.`;

  // Grammar enforcement
  const grammarRule = `Use contractions naturally (it's, that's, didn't, can't). Add possessive apostrophes correctly (Jesse's, not Jesses).`;

  // Extra rules for R rating
  const extraRules: string[] = [];
  if (b.rating === "R") {
    extraRules.push(
      "- At least two outputs must contain clear adult language.",
      "- Keep jokes about situations/decisions, never about identity traits."
    );
  }

  return [
    `You are a professional comedian writing four unique one-liner jokes.`,
    contextLine,
    `Tone: ${b.tone} (${toneModifiers[b.tone]}).`,
    `Rating: ${b.rating} (${ratingModifiers[b.rating]}).`,
    comedianStyle,
    `Style: ${styleId} — ${styleRule}`,
    nameRule,
    imageryRule,
    varietyRule,
    grammarRule,
    `Rules:`,
    `- Each line must sound like a comedian speaking.`,
    `- Each joke must be complete, not fragments or metaphors.`,
    `- Avoid clichés. Each output should feel fresh and punchy.`,
    `- 60 to 120 characters.`,
    `- Use only commas and periods.`,
    `- Start with a capital, end with a period.`,
    `- Stay within rating. No meta talk or explanations.`,
    ...extraRules,
    `Output format: a plain numbered list 1-4, one line per item.`
  ].join(" ");
}

function userPrompt(b: {
  topics: string[]; tone: Tone; rating: Rating;
  styleId?: string; comedian?: string | null;
}) {
  return JSON.stringify({
    topics: b.topics || [],
    tone: b.tone,
    rating: b.rating,
    style: b.styleId || pickDefaultStyle(b.tone),
    goal: "Write 4 concise one-liner jokes that revolve around the topics above."
  });
}

// Keep apostrophes, strip noisy symbols, no semicolons or exclamations
const ILLEGAL_CHARS = /[:;!?"""(){}\[\]<>/_*#+=~^`|\\]/g;
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
// Fix small grammar slips (articles, contractions, common logic errors)
function polishGrammar(s: string): string {
  let t = s;

  // Article correction: "like escape room" -> "like an escape room"
  t = t.replace(/\blike ([aeiou])/gi, "like an $1");
  t = t.replace(/\blike ([^aeiou\s])/gi, "like a $1");

  // Contract fixes and possessive smoothing
  t = t.replace(/\bi am\b/gi, "I'm");
  t = t.replace(/\b([A-Za-z]+)s ([A-Z])/g, "$1's $2"); // Jesse s Approach -> Jesse's Approach
  t = t.replace(/\bJesses\b/gi, "Jesse's");

  // Cleanup stray punctuation spacing
  t = t.replace(/\s([,.:;!?])/g, "$1");
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

// Ensure the joke feels like a complete sentence
function ensureSentenceFlow(s: string): string {
  // Capitalize start and ensure ending punctuation
  let t = s.trim();
  if (!/^[A-Z]/.test(t)) t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.?!]$/.test(t)) t += ".";
  return t;
}

function isOneSentence(s: string): boolean { return s.split(".").filter(Boolean).length === 1; }
function inCharRange(s: string, min = 60, max = 120): boolean {
  const len = [...s].length;
  return len >= min && len <= max;
}
function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function splitTokens(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

function isProperNameToken(tok: string): boolean {
  return /^[A-Z][a-z]+$/.test(tok);
}

function deriveRequiredTokens(topics: string[]): string[] {
  const tokens: string[] = [];
  for (const phrase of topics) {
    for (const tok of splitTokens(phrase)) {
      if (isProperNameToken(tok)) tokens.push(tok);
    }
  }
  return Array.from(new Set(tokens));
}

function hasAllRequiredNames(s: string, topics: string[]): boolean {
  const required = deriveRequiredTokens(topics);
  if (required.length === 0) return true;
  // Match the name with optional 's, s, or s' at the end (possessive/plural forms)
  return required.every(w => new RegExp(`\\b${escapeRegExp(w)}(?:'?s)?\\b`, "i").test(s));
}

function containsAnyThemeTopic(s: string, topics: string[]): boolean {
  return topics.some(p => p && new RegExp(escapeRegExp(p), "i").test(s));
}

// rating filter: block slurs always, loosen profanity gate
function violatesRating(s: string, rating: Rating): boolean {
  // hard-banned slurs stay blocked always
  const slurs = /\b(faggot|tranny|retard|kike|chink|spic)\b/i;
  if (slurs.test(s)) return true;

  const heavy = /\b(fuck|shit|asshole|dick|pussy|bitch)\b/i;
  const mild = /\b(hell|damn|crap|ass)\b/i;

  if (rating === "G") return heavy.test(s) || mild.test(s);
  if (rating === "PG") return heavy.test(s);
  // PG-13 and R: no restriction (except slurs above)
  return false;
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

function validateLinesOnce(
  raw: string,
  topics: string[],
  rating: Rating,
): string[] {
  let lines = raw.split(/\r?\n+/).map(normalizeLine).filter(Boolean);
  lines = lines.filter(l =>
    isOneSentence(l) && inCharRange(l) && hasAllRequiredNames(l, topics) && !violatesRating(l, rating)
  );
  lines = uniqueByText(lines);
  return lines;
}

function validateWithFallback(
  raw: string,
  topics: string[],
  rating: Rating,
  want = 4
): string[] {
  let out = validateLinesOnce(raw, topics, rating);
  if (out.length >= want) return out.slice(0, want);

  // second pass: allow thematic mention without hard name requirement,
  // but still prefer lines that at least hint the topics
  let lines = raw.split(/\r?\n+/).map(normalizeLine).filter(Boolean);
  lines = lines.filter(l =>
    isOneSentence(l) && inCharRange(l) && !violatesRating(l, rating)
  );
  // softly prefer lines that mention any topic
  lines.sort((a, b) => {
    const as = containsAnyThemeTopic(a, topics) ? 1 : 0;
    const bs = containsAnyThemeTopic(b, topics) ? 1 : 0;
    return bs - as;
  });
  lines = uniqueByText(lines);
  return lines.slice(0, want);
}


function synthFallback(topics: string[], tone: Tone): string[] {
  const subject = topics[0] || "you";
  const context = topics[1] || "life";
  
  const base = [
    `${subject} tried ${context}, but gravity had other plans.`,
    `${subject} said ${context} would be easy, and the universe laughed.`,
    `${subject}'s approach to ${context} is a masterclass in chaos.`,
    `They told ${subject} about ${context}, but nobody mentioned the fine print.`
  ];
  return base.map(normalizeLine).filter(l => inCharRange(l, 60, 120));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const HARD = setTimeout(() => {}, HARD_DEADLINE_MS);
  let deadlineHit = false;
  const guard = setTimeout(() => { deadlineHit = true; }, HARD_DEADLINE_MS);

  try {
    if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
    const b = (await req.json()) as Body;

    const tone = canonTone(b.tone);
    const rating = canonRating(b.rating);
    const styleId = b.styleId || undefined;
    const comedian = b.comedian || null;

    const topics = (Array.isArray(b.topics) ? b.topics : [])
      .filter(Boolean).slice(0, 3).map(String);

    const full = {
      topics,
      tone,
      rating,
      styleId,
      comedian
    };

    const messages = [
      { role: "system", content: systemPrompt(full) },
      { role: "user", content: userPrompt(full) },
      { role: "user", content: `Write jokes in different formats:\n1. A roast (direct insult)\n2. A witty analogy\n3. A pop-culture reference\n4. A surreal exaggeration\n\nEach should sound original and stand-alone.` }
    ];

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);

    // Adjust sampling for R rating
    const temp = rating === "R" ? 0.95 : 0.85;
    const top_p = rating === "R" ? 0.92 : 0.9;

    const r = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: temp, top_p, max_tokens: 450 }),
      signal: ctl.signal
    });

    clearTimeout(timer);

    let source = "model";
    let outputs: string[] = [];

    if (r.ok) {
      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      
      console.log("[generate-text] raw:", content?.slice(0, 400));
      
      // Add detailed logging to see what's being filtered
      const allLines = content.split(/\r?\n+/).map(normalizeLine).filter(Boolean);
      console.log("[generate-text] normalized lines:", allLines);
      console.log("[generate-text] required names:", deriveRequiredTokens(topics));
      allLines.forEach((line, i) => {
        console.log(`[generate-text] line ${i+1} checks:`, {
          oneSentence: isOneSentence(line),
          inRange: inCharRange(line),
          hasNames: hasAllRequiredNames(line, topics),
          length: line.length
        });
      });
      
      console.log("[generate-text] pass1 count:", validateLinesOnce(content, topics, rating).length);
      
      let lines = validateWithFallback(content, topics, rating, 4);
      console.log("[generate-text] pass2 count:", lines.length);

      if (lines.length < 4 && !deadlineHit) {
        const ctl2 = new AbortController();
        const t2 = setTimeout(() => ctl2.abort(), 8000);
        try {
          const r2 = await fetch(API, {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODEL, messages, temperature: temp, top_p, max_tokens: 520 }),
            signal: ctl2.signal
          });
          if (r2.ok) {
            const d2 = await r2.json();
            const c2 = d2?.choices?.[0]?.message?.content ?? "";
            const more = validateWithFallback(c2, topics, rating, 4);
            lines = uniqueByText([...lines, ...more]).slice(0, 4);
          }
        } finally { clearTimeout(t2); }
      }

      if (lines.length < 4) {
        source = lines.length ? "model+padded" : "synth";
        const pad = synthFallback(topics, tone).filter(l => !violatesRating(l, rating));
        lines = uniqueByText([...lines, ...pad]).slice(0, 4);
      }
      outputs = lines;
    } else {
      const errText = await r.text();
      console.error("[generate-text] API error:", r.status, errText);
      source = "synth";
      outputs = synthFallback(topics, tone);
    }

    outputs = outputs
      .map(normalizeLine)
      .map(polishGrammar)
      .map(ensureSentenceFlow)
      .filter(l => isOneSentence(l) && inCharRange(l) && hasAllRequiredNames(l, topics) && !violatesRating(l, rating));


    if (outputs.length < 4) {
      const pad = synthFallback(topics, tone).filter(l => !violatesRating(l, rating));
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
    const outputs = synthFallback([], "Humorous");
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
