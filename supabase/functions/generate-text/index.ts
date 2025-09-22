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

// Category-specific ban words to avoid clichés
const categoryBanWords: Record<string, string[]> = {
  "birthday": ["cake", "candles", "confetti", "balloons", "party hat"],
  "wedding": ["vows", "roses", "rings", "forever", "altar", "dress"],
  "graduation": ["cap", "gown", "diploma", "ceremony", "tassel"],
  "engagement": ["ring", "proposal", "diamond", "forever", "knee"],
  "baby-shower": ["stork", "bundle", "diapers", "bottles", "bassinet"],
  "retirement": ["gold watch", "pension", "rocking chair", "golf", "sunset"],
  "anniversary": ["years together", "milestone", "celebration", "love"],
  "new-job": ["briefcase", "office", "desk", "promotion", "career"],
  "house-warming": ["keys", "home", "address", "mortgage", "moving"],
  "sports": ["trophy", "victory", "scoreboard", "championship", "winner"],
  "default": ["celebration", "special day", "milestone", "achievement"]
};

// Expanded style examples library for better voice guidance
const styleExamples: Record<string, Record<string, string[]>> = {
  "generic": {
    "humorous": [
      "Another year of questionable WiFi passwords and awkward Zoom calls.",
      "Here's to surviving group chats and pretending to like coworkers."
    ],
    "savage": [
      "Another year of peak mediocrity and Netflix addiction.",
      "Congrats on surviving another year without adult supervision."
    ]
  },
  "sarcastic": {
    "humorous": [
      "Congrats on surviving another year without Googling your own symptoms.",
      "Another year of pretending you understand cryptocurrency."
    ],
    "savage": [
      "Another year closer to finally understanding your parents' disappointment.",
      "Congrats on another year of professional procrastination."
    ]
  },
  "wholesome": {
    "humorous": [
      "You're proof that good things happen to patient people.",
      "May your year be filled with unexpected kindness and perfect timing."
    ],
    "savage": [
      "You're living proof that persistence pays off eventually.",
      "Another year of being the friend everyone secretly envies."
    ]
  },
  "weird": {
    "humorous": [
      "May your neighbor's WiFi always disconnect mid-Zoom call.",
      "Here's to surviving another year without the microwave judging you."
    ],
    "savage": [
      "May your enemies' phone batteries die at 97% forever.",
      "Here's to another year of your houseplants silently judging you."
    ]
  }
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

// Get category-specific ban words
function getCategoryBanWords(category: string, subcategory: string): string[] {
  // Try subcategory first, then category, then default
  return categoryBanWords[subcategory] || 
         categoryBanWords[category] || 
         categoryBanWords.default;
}

// Get style-specific examples based on style and tone
function getStyleExamples(style: string, tone: string): string[] {
  const styleKey = style.toLowerCase();
  const toneKey = tone.toLowerCase();
  
  // Try to get examples for specific style + tone combination
  if (styleExamples[styleKey] && styleExamples[styleKey][toneKey]) {
    return styleExamples[styleKey][toneKey];
  }
  
  // Fallback to style with humorous tone
  if (styleExamples[styleKey] && styleExamples[styleKey]["humorous"]) {
    return styleExamples[styleKey]["humorous"];
  }
  
  // Ultimate fallback to generic humorous
  return styleExamples.generic.humorous;
}

// Universal prompt template with dynamic category-specific elements
function buildPrompt(opts: {
  category: string;
  subcategory: string;
  tone: string;
  style: string;
  rating: string;
  insertWords: string[];
  comedianStyle: { name: string; flavor: string };
  nonce: string;
}) {
  const { category, subcategory, tone, style, rating, insertWords, comedianStyle, nonce } = opts;
  const insert = insertWords.join(", ") || "none";

  const ratingRules: Record<string, string> = {
    "g": "clean only, no profanity or innuendo",
    "pg": "mild spice allowed, no explicit profanity",
    "pg-13": "light profanity or innuendo ok, avoid explicit",
    "r": "explicit adult humor permitted",
  };

  const styleHints: Record<string, string> = {
    "sarcastic": "ironic bite, eye-roll",
    "wholesome": "warm, kind, uplifting", 
    "weird": "absurd, surreal, bizarre imagery",
    "savage": "brutally honest, cutting, no-holds-barred",
    "generic": "neutral, straightforward phrasing"
  };

  // Get category-specific ban words and style examples
  const banWords = getCategoryBanWords(category, subcategory);
  const examples = getStyleExamples(style, tone);
  const selectedExample = examples[Math.floor(Math.random() * examples.length)];
  const hint = styleHints[style.toLowerCase()] || styleHints.generic;
  const ratingRule = ratingRules[rating.toLowerCase()] || ratingRules.pg;

  const system = `Write ONE ${tone.toLowerCase()} one-liner for a celebration text generator.
Exactly one sentence, 50–120 characters.

Category: ${category}${subcategory ? ` > ${subcategory}` : ''}
Tone: ${tone}
Style: ${style} (${hint})
Rating: ${rating} (${ratingRule})
Insert words: ${insert}
Comedian style: ${comedianStyle.name} – ${comedianStyle.flavor}

Constraints:
- Must include all Insert Words naturally.
- Avoid clichés related to ${category} (${banWords.join(', ')}) unless they are in Insert Words.
- Do not use em dashes.
- End with ., !, or ?.
- Output only the sentence, no explanations.

Nonce: ${nonce}`.trim();

  const user = `Style example (do not copy):
"${selectedExample}"

Remember: one sentence, 50–120 chars, no em dash, include insert words if given.`.trim();

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
  if (len < 50 || len > 120) return null;

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

// Check if two lines are too similar
function tooSimilar(a: string, b: string): boolean {
  const wa = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const overlap = [...wa].filter(x => wb.has(x)).length;
  return overlap / Math.min(wa.size, wb.size) > 0.6;
}

// Generate a single line with retries
async function generateOne(opts: {
  category: string;
  subcategory: string;
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
        temperature: 1.0,
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
  
  // Extract category and subcategory from the body
  const categoryParts = (body.category || "celebrations").split(' > ');
  const category = categoryParts[0] || "celebrations";
  const subcategory = body.subcategory || categoryParts[1] || "";
  
  const opts = {
    category,
    subcategory,
    tone: body.tone || "Humorous",
    style: body.style || "Generic", 
    rating: body.rating || "PG",
    insertWords,
    comedianStyle
  };

  console.log("Generating with options:", opts);

  const lines: string[] = [];
  let tries = 0;

  while (lines.length < 4 && tries < 15) {
    try {
      const line = await generateOne(opts);
      if (line && !lines.includes(line) && !lines.some(existing => tooSimilar(line, existing))) {
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
      `Another year of questionable life choices and WiFi passwords.${iwText}`,
      `Here's to surviving group chats and adulting attempts.${iwText}`, 
      `Celebrating another year of professional procrastination.${iwText}`,
      `May your enemies' phones die at 97% forever.${iwText}`
    ];
    
    const fallback = fallbacks[lines.length] || fallbacks[0];
    const finalFallback = fallback.trim();
    if (!lines.includes(finalFallback) && finalFallback.length >= 50 && finalFallback.length <= 120) {
      lines.push(finalFallback);
      console.log("Added fallback:", finalFallback);
    } else {
      // If fallback fails validation, add a simple one
      lines.push(`Another year, another adventure awaits.${iwText}`.trim());
    }
  }

  return lines;
}