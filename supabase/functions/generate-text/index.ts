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

// Diverse style examples to break cliché patterns
const styleExamples: Record<string, string[]> = {
  "sarcastic": [
    "Jesse's calendar calls it a birthday, his knees call it a negotiation.",
    "Aging gracefully is just PR for buying better pillows.",
    "Another year of pretending you understand cryptocurrency.",
    "Congrats on surviving another year without Googling your own symptoms."
  ],
  "weird": [
    "May your age unlock secret Wi-Fi and suspiciously wise raccoons.",
    "Another orbit, Jesse, and your shadow now demands a manager.",
    "May your neighbor's WiFi always disconnect mid-Zoom call.",
    "Here's to surviving another year without the microwave judging you."
  ],
  "wholesome": [
    "Here's to inside jokes and unflattering photos we still love.",
    "May laughter arrive early and overstay its welcome.",
    "You're proof that good things happen to patient people.",
    "May your year be filled with unexpected kindness and perfect timing."
  ],
  "generic": [
    "Permission granted to be loud, joyful, and a little ridiculous.",
    "Time to collect more stories you can't tell at work.",
    "Another year of questionable WiFi passwords and awkward Zoom calls.",
    "Here's to surviving group chats and pretending to like coworkers."
  ]
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
  return categoryBanWords[subcategory] || 
         categoryBanWords[category] || 
         categoryBanWords.default;
}

// Get random style examples
function getStyleExamples(style: string): string[] {
  const styleKey = style.toLowerCase();
  return styleExamples[styleKey] || styleExamples.generic;
}

// Universal prompt template v2 with diversity enforcement
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
    "g": "clean only",
    "pg": "mild spice, no explicit profanity",
    "pg-13": "light innuendo allowed, no explicit profanity",
    "r": "adult humor allowed, profanity permitted",
  };

  const styleHints: Record<string, string> = {
    "sarcastic": "ironic bite, eye roll",
    "wholesome": "warm, kind, uplifting", 
    "weird": "absurd, surreal, unexpected imagery",
    "savage": "brutally honest, cutting, no-holds-barred",
    "generic": "neutral, straightforward phrasing"
  };

  // Get category-specific ban words and style examples
  const banWords = getCategoryBanWords(category, subcategory);
  const examples = getStyleExamples(style);
  // Pick 2 random examples
  const shuffled = [...examples].sort(() => Math.random() - 0.5);
  const selectedExamples = shuffled.slice(0, 2);
  const hint = styleHints[style.toLowerCase()] || styleHints.generic;
  const ratingRule = ratingRules[rating.toLowerCase()] || ratingRules.pg;

  const system = `You write one-liner jokes for a celebration generator.

Hard rules:
- Exactly ONE sentence.
- 50–120 characters.
- No em dash.
- End with ., !, or ?.
- Include all Insert Words naturally. Do not bolt them on at the end.
- Vary sentence length across attempts. Some short punchy, some longer rambly.
- Do NOT auto-start with clichés like "Happy birthday" unless it appears in Insert Words.
- Insert Words can appear anywhere in the sentence, not always at the beginning.

Diversity rules:
- Vary comedic form: roast, metaphor, surreal observation, rhetorical question, blunt statement.
- Avoid category clichés (${banWords.join(', ')}) unless they are in Insert Words.
- Use a different rhythm each time based on the comedian style hint.

Output exactly the sentence. No preface or commentary.
Nonce: ${nonce}`.trim();

  const user = `Write ONE ${tone.toLowerCase()} one-liner for a celebration text generator.

Category: ${category}${subcategory ? ` > ${subcategory}` : ''}
Tone: ${tone}
Style: ${style} (${hint})
Rating: ${rating} (${ratingRule})
Insert Words: ${insert}
Comedian style: ${comedianStyle.name} – ${comedianStyle.flavor}

Style examples (do not copy, just the vibe):
- "${selectedExamples[0]}"
- "${selectedExamples[1]}"`.trim();

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

function validateLine(
  line: string, 
  rating: string, 
  insertWords: string[], 
  category: string,
  subcategory: string
): string | null {
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

  // Ban auto "Happy birthday" unless it's in insert words
  if (/^happy birthday\b/i.test(line) && !insertWords.some(w => /happy birthday/i.test(w))) {
    return null;
  }

  // Ban category clichés unless they're in insert words
  const banWords = getCategoryBanWords(category, subcategory);
  const insertedSet = new Set(insertWords.map(x => x.toLowerCase()));
  if (banWords.some(b => line.toLowerCase().includes(b) && !insertedSet.has(b))) {
    return null;
  }

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

// Check if insert words are always in first position across lines
function checkInsertWordVariety(lines: string[], insertWords: string[]): boolean {
  if (insertWords.length === 0 || lines.length < 2) return true;
  
  let frontLoadedCount = 0;
  for (const line of lines) {
    const firstTokens = line.toLowerCase().split(/\W+/).slice(0, 3);
    if (insertWords.some(w => firstTokens.includes(w.toLowerCase()))) {
      frontLoadedCount++;
    }
  }
  
  // If more than 75% of lines have insert words in first 3 positions, reject
  return frontLoadedCount / lines.length < 0.75;
}

// Generate a single line with comedian style
async function generateOne(opts: {
  category: string;
  subcategory: string;
  tone: string;
  style: string;
  rating: string;
  insertWords: string[];
  usedComedians: Set<string>;
}) {
  // Pick a comedian not yet used
  const availableComedians = comedianStyles.filter(c => !opts.usedComedians.has(c.name));
  const comedianStyle = availableComedians.length > 0 
    ? availableComedians[Math.floor(Math.random() * availableComedians.length)]
    : comedianStyles[Math.floor(Math.random() * comedianStyles.length)];
  
  opts.usedComedians.add(comedianStyle.name);
  
  const nonce = Math.random().toString(36).slice(2);
  const { system, user } = buildPrompt({ ...opts, comedianStyle, nonce });

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
    const valid = validateLine(first, opts.rating, opts.insertWords, opts.category, opts.subcategory);
    
    console.log("Generated line attempt:", { 
      raw, 
      first, 
      valid, 
      comedian: comedianStyle.name,
      length: valid ? valid.length : 0
    });
    return valid;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// Generate 4 diverse options with different comedians and structures
async function generateFour(body: any): Promise<string[]> {
  const insertWords = parseInsertWords(body.mandatory_words || '');
  
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
    usedComedians: new Set<string>()
  };

  console.log("Generating with options:", opts);

  const lines: string[] = [];
  let attempts = 0;

  // Generate one line at a time with different comedians
  while (lines.length < 4 && attempts < 20) {
    try {
      const line = await generateOne(opts);
      if (line && 
          !lines.includes(line) && 
          !lines.some(existing => tooSimilar(line, existing))) {
        lines.push(line);
        console.log(`Generated line ${lines.length}:`, line);
      }
    } catch (e) {
      console.error(`Generation attempt ${attempts + 1} failed:`, e);
    }
    attempts++;
  }

  // Check for insert word variety
  if (!checkInsertWordVariety(lines, insertWords)) {
    console.log("Insert word variety check failed, regenerating some lines");
    // Could implement re-generation logic here if needed
  }

  // Pad with diverse fallbacks that honor insert words
  while (lines.length < 4) {
    const iwText = insertWords.length > 0 ? ` ${insertWords.join(" ")}` : "";
    const fallbacks = [
      `Permission granted to be loud, joyful, and ridiculous.${iwText}`,
      `Time to collect stories you can't tell at work.${iwText}`, 
      `Another year of professional procrastination.${iwText}`,
      `May laughter arrive early and overstay its welcome.${iwText}`
    ];
    
    const fallback = fallbacks[lines.length] || fallbacks[0];
    const finalFallback = fallback.trim();
    if (!lines.includes(finalFallback) && 
        finalFallback.length >= 50 && 
        finalFallback.length <= 120) {
      lines.push(finalFallback);
      console.log("Added fallback:", finalFallback);
    } else {
      lines.push(`Another adventure awaits.${iwText}`.trim());
    }
  }

  // Log final variety stats
  const lengths = lines.map(l => l.length);
  console.log("Final lengths:", lengths);
  console.log("Length variety:", Math.max(...lengths) - Math.min(...lengths));

  return lines;
}