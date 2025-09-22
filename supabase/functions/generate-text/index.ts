// supabase/functions/generate-text/index.ts
// Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const CHAT_MODEL = "gpt-4o-mini";

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "vary": "Origin"
};

// Comedian styles array
const comedianStyles = [
  { name: "Richard Pryor", flavor: "raw, confessional storytelling" },
  { name: "George Carlin", flavor: "sharp, satirical, anti-establishment" },
  { name: "Joan Rivers", flavor: "biting, fearless roast style" },
  { name: "Eddie Murphy", flavor: "high-energy, character impressions" },
  { name: "Robin Williams", flavor: "manic, surreal improvisation" },
  { name: "Jerry Seinfeld", flavor: "clean observational minutiae" },
  { name: "Chris Rock", flavor: "punchy, social commentary" },
  { name: "Dave Chappelle", flavor: "thoughtful, edgy narrative riffs" },
  { name: "Bill Burr", flavor: "ranting, blunt cynicism" },
  { name: "Louis C.K.", flavor: "dark, self-deprecating honesty" },
  { name: "Kevin Hart", flavor: "animated, personal storytelling" },
  { name: "Ali Wong", flavor: "raunchy, feminist candor" },
  { name: "Sarah Silverman", flavor: "deadpan, ironic taboo-poking" },
  { name: "Amy Schumer", flavor: "self-aware, edgy relatability" },
  { name: "Tiffany Haddish", flavor: "bold, outrageous energy" },
  { name: "Jim Gaffigan", flavor: "clean, food/family obsession" },
  { name: "Brian Regan", flavor: "clean, physical, goofy" },
  { name: "John Mulaney", flavor: "polished, clever storytelling" },
  { name: "Bo Burnham", flavor: "meta, musical satire" },
  { name: "Hannah Gadsby", flavor: "vulnerable, subversive storytelling" },
  { name: "Hasan Minhaj", flavor: "cultural/political storytelling" },
  { name: "Russell Peters", flavor: "cultural riffing, accents" },
  { name: "Aziz Ansari", flavor: "fast-paced, modern life takes" },
  { name: "Patton Oswalt", flavor: "nerdy, sharp wit storytelling" },
  { name: "Norm Macdonald", flavor: "absurd, slow-burn deadpan" },
  { name: "Mitch Hedberg", flavor: "surreal, stoner one-liners" },
  { name: "Steven Wright", flavor: "ultra-dry, absurd one-liners" },
  { name: "Ellen DeGeneres", flavor: "relatable, observational, light" },
  { name: "Chelsea Handler", flavor: "brash, self-aware honesty" },
  { name: "Ricky Gervais", flavor: "mocking, irreverent roast" }
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  try {
    const body = await req.json();
    console.log("Request received:", body);
    
    const options = await generateFour(body);
    console.log("Generated options:", options);
    
    return json({ options });
  } catch (e) {
    console.error("Generation error:", e);
    return json({ error: String(e?.message || "generation_failed") }, 500);
  }
});

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: corsHeaders,
  });
}

// Parse insert words from various input formats
function parseInsertWords(input: string): string[] {
  if (!input?.trim()) return [];
  
  // Handle both simple comma-separated and structured input
  if (input.includes(':') || input.includes('[')) {
    const words: string[] = [];
    const nameMatch = input.match(/name:\s*([^,\n]+)/i);
    if (nameMatch) words.push(nameMatch[1].trim());
    
    const allMatch = input.match(/all:\s*\[([^\]]+)\]/i);
    if (allMatch) {
      const allWords = allMatch[1].split(',').map(w => w.trim().replace(/['"]/g, ''));
      words.push(...allWords);
    }
    
    return words.filter(Boolean);
  }
  
  return input.split(',').map(w => w.trim()).filter(Boolean);
}

// Build comprehensive prompt with style enforcement
function buildPrompt(opts: {
  category: string;
  tone: string;
  style: string;
  rating: string;
  insertWords: string[];
  comedianStyle: { name: string; flavor: string };
  nonce: string;
}) {
  const { category, tone, style, rating, insertWords, comedianStyle, nonce } = opts;
  const insert = insertWords.join(", ") || "none";

  const ratingDesc: Record<string, string> = {
    "g": "clean only; no profanity or innuendo.",
    "pg": "mild spice allowed; no explicit profanity.",
    "pg-13": "light profanity/innuendo allowed; avoid explicit slurs.",
    "r": "explicit adult humor permitted; profanity allowed.",
  };

  const styleExamples: Record<string, string[]> = {
    "generic": [
      "Let the cake be loud and the smiles be louder.",
      "May joy arrive early and stay past midnight."
    ],
    "sarcastic": [
      "Make a wish; the candles are judging your life choices.",
      "Another birthday, same you, bigger frosting to hide the evidence."
    ],
    "wholesome": [
      "You're loved loudly, even when the candles whisper.",
      "May today be gentle, bright, and full of laughing crumbs."
    ],
    "weird": [
      "The balloons unionized and demanded cake before anyone blinked.",
      "Happy BDAY, may your candles whisper stock tips and bad advice."
    ],
    "savage": [
      "Another year closer to death, but at least there's cake.",
      "Congrats on surviving another trip around the sun, barely."
    ]
  };

  const styleHints: Record<string, string> = {
    "sarcastic": "ironic bite, dry, eye-roll",
    "wholesome": "warm, kind, supportive", 
    "weird": "absurd, surreal, bizarre imagery",
    "savage": "brutally honest, cutting, no-holds-barred",
    "generic": "neutral, straightforward phrasing"
  };

  const examples = styleExamples[style.toLowerCase()] || styleExamples.generic;
  const example = examples[Math.floor(Math.random() * examples.length)];
  const hint = styleHints[style.toLowerCase()] || styleHints.generic;

  const system = `You write one-liner jokes for a celebration generator.

Hard rules:
- Exactly ONE sentence.
- 60–120 characters.
- No em dash.
- End with ., !, or ?.
- If insert words are provided, include them NATURALLY (not bolted on).
- Do not explain. Output only the sentence.

Nonce: ${nonce}`.trim();

  const user = `Write ONE new line.

Context:
- Category: ${category}
- Tone: ${tone}
- Style: ${style} (${hint})
- Rating: ${rating} (${ratingDesc[rating.toLowerCase()] || ratingDesc.pg})
- Insert words: ${insert}
- Comedian style hint: ${comedianStyle.name} – ${comedianStyle.flavor}

Style example (do not copy):
"${example}"

Remember: one sentence, 60–120 chars, no em dash, include insert words if given.`.trim();

  return { system, user };
}

// Normalize and validate generated text
function normalizeFirstLine(raw: string): string {
  const first = (raw || "")
    .split(/\r?\n/).map(s => s.trim()).find(Boolean) || "";
  return first
    .replace(/^["'`]/, "").replace(/["'`]$/, "")   // strip surrounding quotes
    .replace(/^[•*\-]\s*/, "")                     // bullets
    .replace(/^\d+[\.)]\s*/, "");                  // numbered lists
}

function validateLine(line: string, rating: string, insertWords: string[]): string | null {
  if (!line) return null;

  const len = [...line].length;
  if (len < 60 || len > 120) return null;

  if (/\u2014/.test(line)) return null; // no em dash

  // enforce ending punctuation
  if (!/[.!?]$/.test(line)) line += ".";

  // enforce insert words (case-insensitive whole-words)
  const okWords = insertWords.every(w =>
    new RegExp(`\\b${escapeReg(w)}\\b`, "i").test(line)
  );
  if (!okWords) return null;

  // rating gates
  const mild = /\b(hell|damn|crap)\b/i.test(line);
  const explicit = /\b(fuck|shit|asshole|bastard|dick|piss|bitch)\b/i.test(line);

  if (rating.toLowerCase() === "g" && (mild || explicit)) return null;
  if (rating.toLowerCase() === "pg" && explicit) return null;
  // PG-13 allows mild, R allows explicit

  return line;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Generate a single line with retries
async function generateOne(opts: {
  category: string;
  tone: string;
  style: string;
  rating: string;
  insertWords: string[];
  comedianStyle: { name: string; flavor: string };
}) {
  const nonce = Math.random().toString(36).slice(2);
  const { system, user } = buildPrompt({ ...opts, nonce });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0.95,
        top_p: 0.9,
        max_tokens: 140,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      const txt = await response.text();
      console.error("OpenAI API error:", response.status, txt.slice(0, 200));
      throw new Error(`openai_${response.status}_${txt.slice(0, 200)}`);
    }

    const data = await response.json();
    const raw = (data?.choices?.[0]?.message?.content || "").trim();
    const first = normalizeFirstLine(raw);
    const valid = validateLine(first, opts.rating, opts.insertWords);
    
    console.log("Generated line attempt:", { raw, first, valid });
    return valid;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// Generate 4 options with retries and padding
async function generateFour(body: any): Promise<string[]> {
  const insertWords = parseInsertWords(body.mandatory_words || '');
  const comedianStyle = comedianStyles[Math.floor(Math.random() * comedianStyles.length)];
  
  const opts = {
    category: body.category || "celebrations",
    tone: body.tone || "Humorous",
    style: body.style || "Generic", 
    rating: body.rating || "PG",
    insertWords,
    comedianStyle
  };

  console.log("Generating with options:", opts);

  const lines: string[] = [];
  let tries = 0;

  while (lines.length < 4 && tries < 12) {
    try {
      const line = await generateOne(opts);
      if (line && !lines.includes(line)) {
        lines.push(line);
        console.log(`Generated line ${lines.length}:`, line);
      }
    } catch (e) {
      console.error(`Generation attempt ${tries + 1} failed:`, e);
    }
    tries++;
  }

  // Pad with safe fallbacks that honor insert words
  while (lines.length < 4) {
    const iwText = insertWords.length > 0 ? ` ${insertWords.join(" ")}` : "";
    const fallbacks = [
      `Party mode armed, questionable choices pending.${iwText}`,
      `Celebrating wildly, because the cake said so.${iwText}`, 
      `Making memories that sparkle brighter than bad decisions.${iwText}`,
      `Here's to magnificent disasters and cake victories.${iwText}`
    ];
    
    const fallback = fallbacks[lines.length] || fallbacks[0];
    if (!lines.includes(fallback)) {
      lines.push(fallback.trim());
      console.log("Added fallback:", fallback);
    }
  }

  return lines;
}