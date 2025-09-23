// supabase/functions/generate-text/index.ts
// Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const CHAT_MODEL = "gpt-4o-mini";

// Load the tone-style-rating matrix
const matrixConfig = {
  "version": "1.0",
  "global_rules": {
    "max_punctuation_per_line": 2,
    "length_min": 50,
    "length_max": 120,
    "ban_em_dash": true,
    "impossible_combo_overrides": [
      { "if": {"style":"wholesome","rating":"r"}, "action":"downgrade_rating", "to":"pg" },
      { "if": {"tone":"romantic","rating":"r","style":"wholesome"}, "action":"switch_style", "to":"sarcastic" }
    ]
  },
  "ratings": {
    "g": {
      "forbidden_words": ["f***","s***","a**","d***","c***","bastard","sexual","explicit"],
      "allow_innuendo": false
    },
    "pg": {
      "forbidden_words": ["f***","c***","motherf***","graphic sexual"],
      "allow_innuendo": true
    },
    "pg-13": {
      "forbidden_words": ["f***","c***","motherf***","graphic sexual"],
      "allowed_mild_swears": ["damn","hell","crap","ass"]
    },
    "r": {
      "require_at_least_one_from": ["f***","s***","a**","bastard","bulls***"],
      "forbidden_words": []
    }
  },
  "comedian_pools": {
    "CLEAN": ["Jim Gaffigan","Brian Regan","Ellen DeGeneres","Jerry Seinfeld","John Mulaney"],
    "PG_EDGE": ["Sarah Silverman","Kevin Hart","Patton Oswalt","Ali Wong","Aziz Ansari"],
    "PG13_SAVAGE": ["Bill Burr","Joan Rivers","Ricky Gervais","Chris Rock","Louis C.K."],
    "R_EXPLICIT": ["George Carlin","Bill Burr","Joan Rivers","Sarah Silverman","Ricky Gervais","Louis C.K.","Ali Wong"],
    "ROMANTIC_WARM": ["Jim Gaffigan","Ellen DeGeneres","John Mulaney"],
    "ROMANTIC_SARCASTIC": ["Ali Wong","Sarah Silverman","Bill Burr"],
    "WEIRD_DRY": ["Mitch Hedberg","Steven Wright","Norm Macdonald"],
    "NERDY_STORY": ["Patton Oswalt","John Mulaney","Hasan Minhaj"]
  },
  "tone_style_map": {
    "humorous": {
      "generic":   { "g":"CLEAN",        "pg":"PG_EDGE",     "pg-13":"PG13_SAVAGE", "r":"R_EXPLICIT" },
      "sarcastic": { "g":"PG_EDGE",      "pg":"PG_EDGE",     "pg-13":"PG13_SAVAGE", "r":"R_EXPLICIT" },
      "wholesome": { "g":"CLEAN",        "pg":"CLEAN",       "pg-13":"PG_EDGE",     "r":"CLEAN" },
      "weird":     { "g":"WEIRD_DRY",    "pg":"WEIRD_DRY",   "pg-13":"PG13_SAVAGE", "r":"R_EXPLICIT" }
    },
    "savage": {
      "generic":   { "g":"PG_EDGE",      "pg":"PG_EDGE",     "pg-13":"PG13_SAVAGE", "r":"R_EXPLICIT" },
      "sarcastic": { "g":"PG_EDGE",      "pg":"PG_EDGE",     "pg-13":"PG13_SAVAGE", "r":"R_EXPLICIT" },
      "wholesome": { "g":"CLEAN",        "pg":"PG_EDGE",     "pg-13":"PG13_SAVAGE", "r":"CLEAN" },
      "weird":     { "g":"WEIRD_DRY",    "pg":"WEIRD_DRY",   "pg-13":"PG13_SAVAGE", "r":"R_EXPLICIT" }
    },
    "sentimental": {
      "generic":   { "g":"ROMANTIC_WARM","pg":"ROMANTIC_WARM","pg-13":"PG_EDGE",     "r":"ROMANTIC_SARCASTIC" },
      "sarcastic": { "g":"PG_EDGE",      "pg":"PG_EDGE",     "pg-13":"PG13_SAVAGE", "r":"R_EXPLICIT" },
      "wholesome": { "g":"ROMANTIC_WARM","pg":"ROMANTIC_WARM","pg-13":"PG_EDGE",     "r":"ROMANTIC_WARM" },
      "weird":     { "g":"WEIRD_DRY",    "pg":"WEIRD_DRY",   "pg-13":"PG_EDGE",     "r":"R_EXPLICIT" }
    },
    "romantic": {
      "generic":   { "g":"ROMANTIC_WARM","pg":"ROMANTIC_WARM","pg-13":"PG_EDGE",     "r":"ROMANTIC_SARCASTIC" },
      "sarcastic": { "g":"PG_EDGE",      "pg":"PG_EDGE",     "pg-13":"PG13_SAVAGE", "r":"R_EXPLICIT" },
      "wholesome": { "g":"ROMANTIC_WARM","pg":"ROMANTIC_WARM","pg-13":"PG_EDGE",     "r":"ROMANTIC_WARM" },
      "weird":     { "g":"WEIRD_DRY",    "pg":"WEIRD_DRY",   "pg-13":"PG_EDGE",     "r":"R_EXPLICIT" }
    },
    "inspirational": {
      "generic":   { "g":"CLEAN",        "pg":"CLEAN",       "pg-13":"PG_EDGE",     "r":"R_EXPLICIT" },
      "sarcastic": { "g":"PG_EDGE",      "pg":"PG_EDGE",     "pg-13":"PG13_SAVAGE", "r":"R_EXPLICIT" },
      "wholesome": { "g":"CLEAN",        "pg":"CLEAN",       "pg-13":"PG_EDGE",     "r":"CLEAN" },
      "weird":     { "g":"WEIRD_DRY",    "pg":"WEIRD_DRY",   "pg-13":"PG_EDGE",     "r":"R_EXPLICIT" }
    },
    "playful": {
      "generic":   { "g":"CLEAN",        "pg":"PG_EDGE",     "pg-13":"PG_EDGE",     "r":"R_EXPLICIT" },
      "sarcastic": { "g":"PG_EDGE",      "pg":"PG_EDGE",     "pg-13":"PG13_SAVAGE", "r":"R_EXPLICIT" },
      "wholesome": { "g":"CLEAN",        "pg":"CLEAN",       "pg-13":"PG_EDGE",     "r":"CLEAN" },
      "weird":     { "g":"WEIRD_DRY",    "pg":"WEIRD_DRY",   "pg-13":"PG_EDGE",     "r":"R_EXPLICIT" }
    },
    "serious": {
      "generic":   { "g":"CLEAN",        "pg":"CLEAN",       "pg-13":"PG_EDGE",     "r":"R_EXPLICIT" },
      "sarcastic": { "g":"PG_EDGE",      "pg":"PG_EDGE",     "pg-13":"PG13_SAVAGE", "r":"R_EXPLICIT" },
      "wholesome": { "g":"CLEAN",        "pg":"CLEAN",       "pg-13":"PG_EDGE",     "r":"CLEAN" },
      "weird":     { "g":"WEIRD_DRY",    "pg":"WEIRD_DRY",   "pg-13":"PG_EDGE",     "r":"R_EXPLICIT" }
    },
    "nostalgic": {
      "generic":   { "g":"ROMANTIC_WARM","pg":"ROMANTIC_WARM","pg-13":"PG_EDGE",     "r":"ROMANTIC_SARCASTIC" },
      "sarcastic": { "g":"PG_EDGE",      "pg":"PG_EDGE",     "pg-13":"PG13_SAVAGE", "r":"R_EXPLICIT" },
      "wholesome": { "g":"ROMANTIC_WARM","pg":"ROMANTIC_WARM","pg-13":"PG_EDGE",     "r":"ROMANTIC_WARM" },
      "weird":     { "g":"WEIRD_DRY",    "pg":"WEIRD_DRY",   "pg-13":"PG_EDGE",     "r":"R_EXPLICIT" }
    }
  },
  "persona_overrides": {
    "Norm Macdonald": "Keep dry, odd, dark. Prefer short lines. Avoid flowery romance.",
    "Mitch Hedberg": "One-liners, surreal comparisons, minimal punctuation.",
    "Steven Wright": "Deadpan, literal absurdity, short lines.",
    "Joan Rivers": "Sharp roasts. For PG-13 avoid f-bomb; for R allow it.",
    "Bill Burr": "Rants. For PG-13: no f-bomb. For R: allow swearing.",
    "Ali Wong": "Relationship bite. For R: raunchy; for PG: sanitize.",
    "Jim Gaffigan": "Food/family warm. G/PG only.",
    "Jerry Seinfeld": "Observational, clean cadence.",
    "Patton Oswalt": "Nerdy, specific imagery, heartfelt or sharp.",
    "Ricky Gervais": "Mocking, brisk. PG-13/R only.",
    "Sarah Silverman": "Ironic taboos. For G/PG: soft; PG-13/R: sharper."
  }
};

// Helper function to get comedian pool based on tone/style/rating
function getComedianPool(tone: string, style: string, rating: string): string[] {
  const toneKey = tone.toLowerCase();
  const styleKey = style.toLowerCase();
  const ratingKey = rating.toLowerCase();
  
  const poolKey = matrixConfig.tone_style_map[toneKey]?.[styleKey]?.[ratingKey];
  if (poolKey && matrixConfig.comedian_pools[poolKey]) {
    return matrixConfig.comedian_pools[poolKey];
  }
  
  // Fallback to generic mapping
  return matrixConfig.comedian_pools.CLEAN;
}

// Apply impossible combo overrides
function applyComboOverrides(tone: string, style: string, rating: string): {tone: string, style: string, rating: string} {
  let finalTone = tone;
  let finalStyle = style;
  let finalRating = rating;
  
  for (const override of matrixConfig.global_rules.impossible_combo_overrides) {
    const conditions = override.if;
    let matches = true;
    
    if (conditions.style && conditions.style.toLowerCase() !== style.toLowerCase()) matches = false;
    if (conditions.rating && conditions.rating.toLowerCase() !== rating.toLowerCase()) matches = false;
    if (conditions.tone && conditions.tone.toLowerCase() !== tone.toLowerCase()) matches = false;
    
    if (matches) {
      if (override.action === "downgrade_rating") {
        finalRating = override.to;
      } else if (override.action === "switch_style") {
        finalStyle = override.to;
      }
    }
  }
  
  return { tone: finalTone, style: finalStyle, rating: finalRating };
}

// Enhanced validation for R-rated content
function validateRRating(line: string, rating: string): boolean {
  if (rating.toLowerCase() !== "r") return true;
  
  const ratingRules = matrixConfig.ratings.r;
  if (ratingRules.require_at_least_one_from) {
    const hasExplicitContent = ratingRules.require_at_least_one_from.some(word => 
      line.toLowerCase().includes(word.replace(/\*/g, ''))
    );
    return hasExplicitContent;
  }
  
  return true;
}

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
    "pg": "mild spice, no explicit profanity. Light innuendo allowed.",
    "pg-13": "edgy humor allowed with mild swears (damn, hell, crap, ass). No f-bombs.",
    "r": "explicit adult humor with strong profanity required. Must include at least one strong swear word (f***, s***, a******, bastard).",
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
- NEVER use em dashes (—) - use commas, periods, or ellipses instead.
- Maximum 2 punctuation marks total (excluding apostrophes in contractions).

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

  // Check max 2 punctuation marks (excluding apostrophes in contractions)
  const punctuationCount = (line.match(/[.!?,:;()]/g) || []).length;
  if (punctuationCount > 2) return null;

  // enforce ending punctuation
  if (!/[.!?]$/.test(line)) line += ".";

  // enforce insert words (more flexible matching for complex phrases)
  if (insertWords.length > 0) {
    const okWords = insertWords.every(w => {
      // For complex phrases, check if most words are present
      const words = w.toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length === 1) {
        // Single word - use strict boundary check
        return new RegExp(`\\b${escapeReg(w)}\\b`, "i").test(line);
      } else {
        // Multi-word phrase - check if at least 75% of words are present
        const foundWords = words.filter(word => 
          new RegExp(`\\b${escapeReg(word)}\\b`, "i").test(line)
        );
        return foundWords.length >= Math.ceil(words.length * 0.75);
      }
    });
    if (!okWords) return null;
  }

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
  // Apply combo overrides first
  const { tone, style, rating } = applyComboOverrides(opts.tone, opts.style, opts.rating);
  
  // Get appropriate comedian pool based on matrix
  const comedianPool = getComedianPool(tone, style, rating);
  
  // Pick a comedian from the appropriate pool, avoiding already used ones
  const availableComedians = comedianPool.filter(name => !opts.usedComedians.has(name));
  const comedianName = availableComedians.length > 0 
    ? availableComedians[Math.floor(Math.random() * availableComedians.length)]
    : comedianPool[Math.floor(Math.random() * comedianPool.length)];
  
  opts.usedComedians.add(comedianName);
  
  // Create comedian style object with persona override
  const comedianStyle = {
    name: comedianName,
    flavor: matrixConfig.persona_overrides[comedianName] || "Standard comedic style"
  };
  
  const nonce = Math.random().toString(36).slice(2);
  const { system, user } = buildPrompt({ 
    ...opts, 
    tone, 
    style, 
    rating, 
    comedianStyle, 
    nonce 
  });

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
    let valid = validateLine(first, rating, opts.insertWords, opts.category, opts.subcategory, opts.existingLines);
    
    // Enhanced R-rating validation
    if (valid && !validateRRating(valid, rating)) {
      console.log("R-rating validation failed - no explicit content found");
      valid = null;
    }
    
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

          // Reduce attempts and add progress logging
          while (results.length < 4 && attempts < 15) {
    try {
      const targetBucket = pickNeededBucket(usedBuckets);
      // Pick structure type we haven't used yet
      const availableStructures = structureTypes.filter(s => !usedStructures.has(s));
      const structureType = availableStructures.length > 0 
        ? availableStructures[Math.floor(Math.random() * availableStructures.length)]
        : structureTypes[Math.floor(Math.random() * structureTypes.length)];
      
            console.log(`Attempt ${attempts + 1}/15: Trying ${structureType} with ${targetBucket} placement`);
            
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