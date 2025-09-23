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

// Position buckets for insert word placement tracking
type PosBucket = "front" | "middle" | "end";

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

// Diverse topic seed nouns to avoid repetition
const topicSeeds = [
  "playlist", "balloons", "Wi-Fi", "snacks", "candles", "karaoke", 
  "leaf blower", "group chat", "speakers", "coffee", "microwave",
  "smoke alarm", "doorbell", "garage", "lawn mower", "thermostat"
];

// Structure types for variety enforcement
const structureTypes = ["quip", "question", "metaphor", "observational"] as const;
type StructureType = typeof structureTypes[number];

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
    "Jesse, the playlist still slaps, but man you are old and somehow trending.",
    "Another orbit completed and, man you are old, Jesse still forgets Wi-Fi passwords.",
    "The group chat voted you most likely to nap mid-party, man you are old Jesse.",
    "Stories age like milk, Jesse — and so do you."
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
    return json({ success: false, error: "POST only" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    console.log("Request received with body:", body);
    
    // Validate required fields
    if (!body.tone || !body.category) {
      console.error("Missing required fields:", { tone: body.tone, category: body.category });
      return json({ 
        success: false, 
        error: "Missing required fields: tone and category" 
      }, 400);
    }
    
    const options = await generateFour(body);
    console.log("Generated options:", options);
    
    return json({ success: true, options });
  } catch (e) {
    console.error("Generation error:", e);
    return json({ 
      success: false, 
      error: String(e?.message || "generation_failed") 
    }, 500);
  }
});

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: corsHeaders,
  });
}

// Parse insert words from various input formats
function parseInsertWords(input: string[] | string | undefined): string[] {
  if (!input) return [];
  
  // If already an array, return it cleaned
  if (Array.isArray(input)) {
    return input.filter(Boolean).map(w => String(w).trim()).filter(Boolean);
  }
  
  // If it's a string, parse it
  const inputStr = String(input).trim();
  if (!inputStr) return [];
  
  // Handle both simple comma-separated and structured input
  if (inputStr.includes(':') || inputStr.includes('[')) {
    const words: string[] = [];
    const nameMatch = inputStr.match(/name:\s*([^,\n]+)/i);
    if (nameMatch) words.push(nameMatch[1].trim());
    
    const allMatch = inputStr.match(/all:\s*\[([^\]]+)\]/i);
    if (allMatch) {
      const allWords = allMatch[1].split(',').map(w => w.trim().replace(/['"]/g, ''));
      words.push(...allWords);
    }
    
    return words.filter(Boolean);
  }
  
  return inputStr.split(',').map(w => w.trim()).filter(Boolean);
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

// Detect position bucket for insert word placement
function positionBucket(line: string, token: string): PosBucket {
  const words = line.toLowerCase().split(/\W+/).filter(Boolean);
  const idx = words.findIndex(w => token.toLowerCase().includes(w) || w.includes(token.toLowerCase()));
  if (idx === -1) return "middle"; // fallback
  const n = words.length;
  const ratio = (idx + 1) / n;
  if (ratio <= 0.33) return "front";
  if (ratio >= 0.67) return "end";
  return "middle";
}

// Pick needed bucket for variety
function pickNeededBucket(used: Set<PosBucket>): PosBucket {
  for (const b of ["front", "middle", "end"] as const) {
    if (!used.has(b)) return b;
  }
  // All taken; prefer front or middle over end
  return Math.random() < 0.5 ? "front" : "middle";
}

// Get bucket hint text for prompting
function bucketHintText(bucket: PosBucket): string {
  switch (bucket) {
    case "front": return "Place one Insert Word early in the sentence.";
    case "middle": return "Place one Insert Word mid-sentence.";
    case "end": return "Place one Insert Word near the end (but not as a bolted suffix).";
  }
}

// Get structure hint for variety
function getStructureHint(structureType: StructureType): string {
  switch (structureType) {
    case "quip": return "Write a short, punchy quip (50-75 characters).";
    case "question": return "Write a rhetorical question.";
    case "metaphor": return "Write a playful metaphor or absurd comparison.";
    case "observational": return "Write a straight observational line.";
  }
}

// Extract non-insert nouns from a line to track topic diversity
function extractTopicNouns(line: string, insertWords: string[]): string[] {
  const insertSet = new Set(insertWords.map(w => w.toLowerCase()));
  const words = line.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  return words.filter(w => 
    !insertSet.has(w) && 
    !['the', 'and', 'but', 'for', 'with', 'was', 'were', 'are', 'had', 'has', 'have'].includes(w)
  );
}

// Check if lines repeat same topic nouns
function repeatsTopicNouns(lines: string[], insertWords: string[]): boolean {
  const allNouns = lines.flatMap(line => extractTopicNouns(line, insertWords));
  const uniqueNouns = new Set(allNouns);
  return allNouns.length > uniqueNouns.size * 1.5; // Too much repetition
}

// Check if lines have same opener structure
function sameOpener(a: string, b: string): boolean {
  const getFirst4 = (s: string) => s.toLowerCase().split(/\W+/).slice(0, 4).join(" ");
  return getFirst4(a) === getFirst4(b);
}

// Universal prompt template with variety enforcement
function buildPrompt(opts: {
  category: string;
  subcategory: string;
  tone: string;
  style: string;
  rating: string;
  insertWords: string[];
  comedianStyle: { name: string; flavor: string };
  targetBucket: PosBucket;
  structureType: StructureType;
  usedTopics: Set<string>;
  nonce: string;
}) {
  const { category, subcategory, tone, style, rating, insertWords, comedianStyle, targetBucket, structureType, usedTopics, nonce } = opts;
  const insert = insertWords.join(", ") || "none";

  const ratingRules: Record<string, string> = {
    "g": "clean language only. Humor may be playful, observational, or absurd without profanity.",
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
  const bucketHint = bucketHintText(targetBucket);
  const structureHint = getStructureHint(structureType);
  
  // Generate topic guidance to avoid repetition
  const avoidTopics = Array.from(usedTopics).slice(0, 5);
  const suggestTopics = topicSeeds.filter(t => !usedTopics.has(t)).slice(0, 3);
  
  const system = `You write one-liner jokes for a celebration generator.

Hard rules:
- Exactly ONE sentence.
- 50–120 characters.
- No em dash.
- End with ., !, or ?.

Insert Words policy:
- Include all Insert Words naturally in the sentence.
- Vary placement: sometimes early, sometimes mid-sentence, sometimes late.
- It's allowed to split multi-word phrases across the sentence only if it reads naturally.  
- Do NOT always place Insert Words at the end.
- Do NOT repeat Insert Words more than once unless it improves flow.

Structure requirement: ${structureHint}

Diversity rules:
- Vary sentence shape: one short quip, one rhetorical question, one playful metaphor, one observational line.
- Avoid category clichés (${banWords.join(', ')}) unless they are in Insert Words.
- Do not invent personal details (age, jobs, diagnoses) unless in Insert Words.
- Keep family-friendly for rating = G.
${avoidTopics.length > 0 ? `- Avoid repeating these topics: ${avoidTopics.join(', ')}` : ''}
${suggestTopics.length > 0 ? `- Consider these fresh topics: ${suggestTopics.join(', ')}` : ''}

Rating: ${rating} — ${ratingRule}
${rating.toLowerCase() === 'g' ? '- For G rating: forbid crisis, panic, anxiety, hangover, divorce, midlife themes.' : ''}

Output exactly the sentence. No preface or commentary.
Nonce: ${nonce}`.trim();

  const user = `Write ONE ${tone.toLowerCase()} one-liner for a celebration text generator.

Category: ${category}${subcategory ? ` > ${subcategory}` : ''}
Tone: ${tone}
Style: ${style} (${hint})
Rating: ${rating}
Insert Words: ${insert}
Comedian style: ${comedianStyle.name} – ${comedianStyle.flavor}

Structure: ${structureHint}
Placement hint: ${bucketHint} (Keep it natural; do not force awkward phrasing.)

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
  subcategory: string,
  existingLines: string[]
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

  // Reject if all insert words are shoved to the end
  const endsWithAll = insertWords.every(w =>
    new RegExp(`${escapeReg(w)}[.!?"]?$`, "i").test(line)
  );
  if (endsWithAll && insertWords.length > 0) return null;

  // Reject bolted-on comma suffix patterns
  const boltedPattern = new RegExp(`[,;:]\\s*(?:${insertWords.map(escapeReg).join("|")})\\s*[.!?]?$`, "i");
  if (boltedPattern.test(line) && insertWords.length > 0) return null;

  // Ban category clichés unless they're in insert words
  const banWords = getCategoryBanWords(category, subcategory);
  const insertedSet = new Set(insertWords.map(x => x.toLowerCase()));
  if (banWords.some(b => line.toLowerCase().includes(b) && !insertedSet.has(b))) {
    return null;
  }

  // Check for same opener as existing lines
  if (existingLines.some(existing => sameOpener(line, existing))) {
    return null;
  }

  // Enhanced G-rating guards
  if (rating.toLowerCase() === "g") {
    const gBanned = /\b(hell|damn|crap|crisis|panic|anxiety|hangover|divorce|midlife|turned \d+|diagnosis|therapist)\b/i.test(line);
    if (gBanned) return null;
  }

  // Rating gates
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

// Generate a single line with specific bucket and structure targeting
async function generateOne(opts: {
  category: string;
  subcategory: string;
  tone: string;
  style: string;
  rating: string;
  insertWords: string[];
  usedComedians: Set<string>;
  targetBucket: PosBucket;
  structureType: StructureType;
  usedTopics: Set<string>;
  existingLines: string[];
}): Promise<{line: string, comedian: string} | null> {
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
    const valid = validateLine(first, opts.rating, opts.insertWords, opts.category, opts.subcategory, opts.existingLines);
    
    console.log("Generated line attempt:", { 
      raw, 
      first, 
      valid, 
      comedian: comedianStyle.name,
      targetBucket: opts.targetBucket,
      structureType: opts.structureType,
      actualBucket: valid ? positionBucket(valid, opts.insertWords[0] || "") : null,
      length: valid ? valid.length : 0
    });
    
    // Track topic nouns if line is valid
    if (valid) {
      const topicNouns = extractTopicNouns(valid, opts.insertWords);
      topicNouns.forEach(noun => opts.usedTopics.add(noun));
      return {line: valid, comedian: comedianStyle.name};
    }
    
    return null;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// Generate 4 diverse options with varied placement, structure, and topics
async function generateFour(body: any): Promise<Array<{line: string, comedian: string}>> {
  const insertWords = parseInsertWords(body.insertWords || body.mandatory_words || '');
  
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
    usedComedians: new Set<string>(),
    usedTopics: new Set<string>(),
    existingLines: [] as string[]
  };

  console.log("Generating with options:", opts);

  const results: Array<{line: string, comedian: string}> = [];
  const usedBuckets = new Set<PosBucket>();
  const usedStructures = new Set<StructureType>();
  const comedianUsage = new Map<string, string>(); // line -> comedian name
  let attempts = 0;

  // Generate 4 lines with different placement buckets and structures
  while (results.length < 4 && attempts < 25) {
    try {
      const targetBucket = pickNeededBucket(usedBuckets);
      // Pick structure type we haven't used yet
      const availableStructures = structureTypes.filter(s => !usedStructures.has(s));
      const structureType = availableStructures.length > 0 
        ? availableStructures[Math.floor(Math.random() * availableStructures.length)]
        : structureTypes[Math.floor(Math.random() * structureTypes.length)];
      
      const lineResult = await generateOne({
        ...opts,
        targetBucket,
        structureType,
        existingLines: results.map(r => r.line)
      });
      
      if (lineResult && lineResult.line && 
          !results.some(r => r.line === lineResult.line) && 
          !results.some(r => tooSimilar(lineResult.line, r.line))) {
        
        // Check if this line achieves desired placement variety
        if (insertWords.length > 0) {
          const actualBucket = positionBucket(lineResult.line, insertWords[0]);
          usedBuckets.add(actualBucket);
        }
        
        // Track structure usage
        usedStructures.add(structureType);
        
        results.push(lineResult);
        console.log(`Generated line ${results.length}:`, lineResult.line);
      }
    } catch (e) {
      console.error(`Generation attempt ${attempts + 1} failed:`, e);
    }
    attempts++;
  }

  // Pad with diverse fallbacks that honor insert words and vary placement
  while (results.length < 4) {
    const iwText = insertWords.length > 0 ? insertWords.join(" ") : "";
    const position = results.length % 3; // rotate positions
    
    let fallback: string;
    if (position === 0 && iwText) {
      fallback = `${iwText}, but at least the Wi-Fi password is still 123456.`;
    } else if (position === 1 && iwText) {
      fallback = `Time to collect stories you can't tell at work, ${iwText}.`;
    } else if (iwText) {
      fallback = `Another adventure awaits when you realize ${iwText}.`;
    } else {
      fallback = "Permission granted to be loud, joyful, and ridiculous.";
    }
    
    if (!results.some(r => r.line === fallback) && 
        fallback.length >= 50 && 
        fallback.length <= 120) {
      results.push({line: fallback, comedian: "Jerry Seinfeld"});
      console.log("Added positioned fallback:", fallback);
    } else {
      results.push({line: "Another adventure awaits, naturally.", comedian: "Ellen DeGeneres"});
    }
  }

  // Log final variety stats
  const lines = results.map(r => r.line);
  const lengths = lines.map(l => l.length);
  const buckets = insertWords.length > 0 ? 
    lines.map(l => positionBucket(l, insertWords[0])) : [];
  const topicNouns = lines.flatMap(l => extractTopicNouns(l, insertWords));
  
  console.log("Final lengths:", lengths);
  console.log("Length variety:", Math.max(...lengths) - Math.min(...lengths));
  console.log("Position buckets:", buckets);
  console.log("Bucket variety:", new Set(buckets).size);
  console.log("Structure variety:", usedStructures.size);
  console.log("Topic diversity:", new Set(topicNouns).size, "unique topics from", topicNouns.length, "total nouns");
  console.log("Topic repetition check:", !repeatsTopicNouns(lines, insertWords) ? "PASSED" : "FAILED");

  return results;
}