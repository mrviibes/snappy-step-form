// supabase/functions/generate-text/index.ts
// Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// Model configuration with fallback hierarchy
const MODELS = [
  { name: "gpt-4o-mini", timeout: 15000, useMaxTokens: true },
  { name: "gpt-5-nano-2025-08-07", timeout: 20000, useMaxTokens: false }, // Faster fallback
] as const;

// CORS headers

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

// Apply impossible combo overrides with stronger conflict resolution
function applyComboOverrides(tone: string, style: string, rating: string): {tone: string, style: string, rating: string} {
  let finalTone = tone;
  let finalStyle = style;
  let finalRating = rating;
  
  // Handle contradictory combinations more aggressively
  if (tone.toLowerCase() === "sentimental" && rating.toLowerCase() === "r") {
    console.log("OVERRIDE: Sentimental + R is contradictory, switching to Savage tone");
    finalTone = "savage";
  }
  
  if (tone.toLowerCase() === "wholesome" && rating.toLowerCase() === "r") {
    console.log("OVERRIDE: Wholesome + R is contradictory, downgrading to PG-13");
    finalRating = "pg-13";
  }
  
  if (tone.toLowerCase() === "romantic" && rating.toLowerCase() === "r" && style.toLowerCase() === "wholesome") {
    console.log("OVERRIDE: Romantic + Wholesome + R is contradictory, switching to Sarcastic style");
    finalStyle = "sarcastic";
  }
  
  // Apply matrix config overrides
  for (const override of matrixConfig.global_rules.impossible_combo_overrides) {
    const conditions = override.if;
    let matches = true;
    
    if (conditions.style && conditions.style.toLowerCase() !== finalStyle.toLowerCase()) matches = false;
    if (conditions.rating && conditions.rating.toLowerCase() !== finalRating.toLowerCase()) matches = false;
    if (conditions.tone && conditions.tone.toLowerCase() !== finalTone.toLowerCase()) matches = false;
    
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

// Category-specific required vocabulary and banned off-topic words
const WEDDING_LEX = [
  "wedding","vows","rings","I do","altar","partner","bride","groom",
  "dance floor","reception","bouquet","toast","DJ","cake","forever"
];

const WEDDING_BANS = [
  "wifi","wi-fi","pizza","monday","spreadsheet","deadline","zoom",
  "traffic","taxes","office","email","login","password"
];

// Birthday-specific vocabulary - words that make content feel birthday-themed
const BIRTHDAY_LEX = [
  "birthday","cake","candles","party","celebration","age","year","older",
  "wishes","balloons","presents","gifts","celebrate","another year"
];

// Birthday bans - avoid overly serious or unrelated topics
const BIRTHDAY_BANS = [
  "funeral","death","divorce","taxes","deadline","spreadsheet",
  "meeting","performance review","diagnosis","crisis"
];

type LineCheck = {
  text: string;
  insertWords: string[]; // e.g., ["chosen"]
  category: "wedding" | "birthday" | string;
  rating: "G"|"PG"|"PG-13"|"R";
};

function passesStep2Rules(l: LineCheck): boolean {
  const t = l.text.trim();

  // 1) one sentence, 50–120 chars
  if (t.length < 50 || t.length > 120) return false;
  if ((t.match(/[.!?]/g) || []).length > 2) return false;         // ≤2 punctuation marks total
  if (/[–—]/.test(t)) return false;                               // no en/em dash

  // 2) insert words exactly once each
  for (const w of l.insertWords) {
    const re = new RegExp(`\\b${w}\\b`, "i");
    if (!re.test(t)) return false;
    if ((t.match(new RegExp(`\\b${w}\\b`, "ig")) || []).length !== 1) return false;
  }

  // 3) Category-specific vocabulary requirements
  if (l.category.toLowerCase() === "wedding") {
    // Wedding must include at least one wedding keyword
    if (!WEDDING_LEX.some(k => new RegExp(`\\b${k}\\b`, "i").test(t))) return false;
    // Ban irrelevant topics for weddings
    if (WEDDING_BANS.some(k => new RegExp(`\\b${k}\\b`, "i").test(t))) return false;
    // No placeholder fallbacks for weddings
    if (/\b(friend|NAME|USER)\b/i.test(t)) return false;
  } else if (l.category.toLowerCase() === "birthday" || l.category.toLowerCase().includes("birthday")) {
    // Birthday content should feel birthday-themed but doesn't require specific keywords
    // Allow "friend" as it's common in birthday content
    // Ban overly serious topics
    if (BIRTHDAY_BANS.some(k => new RegExp(`\\b${k}\\b`, "i").test(t))) return false;
  }

  return true;
}

// Diverse topic seed nouns to avoid repetition
const topicSeeds = [
  "playlist", "balloons", "snacks", "candles", "karaoke", 
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
    "May your age unlock secret playlists and suspiciously wise raccoons.",
    "Another orbit, Jesse, and your shadow now demands a manager.",
    "Congrats on graduating from the University of Procrastination and Existential Dread.",
    "May your future be as bright as a disco ball operated by confused penguins."
  ],
  "weird_r": [
    "Congrats Jesse, you party like a raccoon who just discovered fucking fireworks.",
    "May your diploma be as useful as a shit-flavored lollipop in a candy store.",
    "Another year of Jesse's existence, and even the coffee maker is questioning this bullshit.",
    "Congrats on your degree, now you can professionally explain why you're broke as fuck."
  ],
  "wholesome": [
    "Here's to inside jokes and unflattering photos we still love.",
    "May laughter arrive early and overstay its welcome.",
    "You're proof that good things happen to patient people.",
    "May your year be filled with unexpected kindness and perfect timing."
  ],
  "generic": [
    "Jesse, the playlist still slaps, but man you are old and somehow trending.",
    "Another orbit completed and, man you are old, Jesse still forgets passwords.",
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

// Timeout wrapper for any promise
function withTimeout<T>(promise: Promise<T>, ms: number, name = "operation"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)
    )
  ]);
}

// Sanitize insert words to avoid model confusion
function sanitizeInsertWords(words: string[]): string[] {
  const sanitized = words.filter(word => {
    const w = word.toLowerCase().trim();
    // Filter out problematic words that confuse the model
    return w.length >= 3 && !['test', 'example', 'sample'].includes(w);
  });
  
  // CRITICAL: Don't fallback if insert_words is required for Step-2
  if (sanitized.length === 0 && words.length > 0) {
    throw new Error("insert_words required for Step-2");
  }
  
  return sanitized;
}

// Generate with model fallback and timeout
async function generateWithFallback(body: any): Promise<Array<{line: string, comedian: string}>> {
  const sanitizedInsertWords = sanitizeInsertWords(body.insertWords || []);
  const requestBody = { ...body, insertWords: sanitizedInsertWords };
  
  console.log("Attempting generation with sanitized insert words:", sanitizedInsertWords);
  
  for (let modelIndex = 0; modelIndex < MODELS.length; modelIndex++) {
    const model = MODELS[modelIndex];
    console.log(`Trying model ${model.name} with ${model.timeout}ms timeout`);
    
    try {
      const result = await withTimeout(
        generateFour(requestBody),
        model.timeout,
        `generation with ${model.name}`
      );
      
      console.log(`Success with ${model.name}:`, result.length, "options generated");
      return result;
      
    } catch (error) {
      console.error(`Model ${model.name} failed:`, error.message);
      
      // If this is the last model, continue to fallback
      if (modelIndex === MODELS.length - 1) {
        console.log("All models failed, using fallback generation");
        break;
      }
    }
  }
  
  // Ultimate fallback - generate safe, simple options
  return generateUltimateFallback(requestBody);
}

// Generate ultimate fallback when all else fails
function generateUltimateFallback(body: any): Array<{line: string, comedian: string}> {
  const insertWords = body.insertWords || [];
  const rating = (body.rating || "pg").toLowerCase();
  const tone = (body.tone || "humorous").toLowerCase();
  const category = (body.category || "celebrations").toLowerCase();
  
  const iwText = insertWords.length > 0 ? insertWords[0] : "friend";
  
  // Category-specific templates
  const templates = {
    humorous: category.includes("birthday") ? [
      `${iwText}, you're like a fine wine - getting better with age and making everyone else tipsy!`,
      `Is it just me, or does ${iwText} have the perfect balance of chaos and charm?`,
      `Another year of ${iwText} existing, and somehow we're all still surprised by the shenanigans!`,
      `${iwText} brings joy like finding extra fries at the bottom of the bag - unexpected and delightful!`
    ] : [
      `${iwText}, you're like a fine wine - getting better with age and making everyone else tipsy!`,
      `Is it just me, or does ${iwText} have the perfect balance of chaos and charm?`,
      `Life with ${iwText} is like having Wi-Fi that actually works - rare and wonderful!`,
      `${iwText} brings joy like a surprise pizza delivery on a Monday!`
    ],
    sentimental: [
      `${iwText}, you bring light to every room you enter and warmth to every heart you touch.`,
      `In a world full of ordinary, ${iwText} shines as something truly extraordinary.`,
      `${iwText}, your kindness creates ripples of joy that reach farther than you know.`,
      `The world is brighter because ${iwText} is in it, spreading love and laughter.`
    ],
    savage: rating === "r" ? [
      `${iwText}, you're so fucking awesome that even your haters have to respect the game!`,
      `Is ${iwText} perfect? Hell no, but they're real as shit and that's what matters!`,
      `${iwText} doesn't need anyone's approval - they're too busy being a badass!`,
      `Life's too short for fake people, thankfully ${iwText} keeps it 100% real!`
    ] : [
      `${iwText}, you're so incredible that even your critics have to admit you're amazing!`,
      `Is ${iwText} perfect? No, but they're authentic and that's what really matters!`,
      `${iwText} doesn't need validation - they're too busy being genuinely awesome!`,
      `Life's too short for fake friends, thankfully ${iwText} keeps it completely real!`
    ]
  };
  
  const selectedTemplates = templates[tone as keyof typeof templates] || templates.humorous;
  const comedians = ["Ellen DeGeneres", "Jerry Seinfeld", "John Mulaney", "Sarah Silverman"];
  
  return selectedTemplates.slice(0, 4).map((line, index) => ({
    line,
    comedian: comedians[index] || "Ellen DeGeneres"
  }));
}

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
    
    // Try with timeout first
    let options;
    try {
      options = await withTimeout(generateFour(body), 20000, "main generation");
      console.log("Generated options:", options.length, "items");
    } catch (timeoutError) {
      console.log("Main generation timed out, using fallback:", timeoutError.message);
      options = generateUltimateFallback(body);
    }
    
    // Ensure we always return 4 options
    while (options.length < 4) {
      const fallback = generateUltimateFallback(body);
      options.push(...fallback.slice(0, 4 - options.length));
    }
    
    return json({ success: true, options: options.slice(0, 4) });
  } catch (e) {
    console.error("Critical generation error:", e);
    
    // Even in critical failure, return fallback options
    try {
      const fallbackOptions = generateUltimateFallback(await req.json().catch(() => ({})));
      return json({ 
        success: true, 
        options: fallbackOptions,
        warning: "Using fallback generation due to system error"
      });
    } catch {
      // Last resort - basic options
      return json({ 
        success: true, 
        options: [
          { line: "Every moment is a chance to celebrate something wonderful!", comedian: "Ellen DeGeneres" },
          { line: "Life's too short not to find joy in the little things!", comedian: "Jerry Seinfeld" },
          { line: "Today deserves a celebration, don't you think?", comedian: "John Mulaney" },
          { line: "Here's to making memories that will make us smile for years to come!", comedian: "Sarah Silverman" }
        ]
      });
    }
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
  if (category.toLowerCase() === "wedding") {
    return WEDDING_BANS; // Ban off-topic words like Wi-Fi, pizza, Monday
  }
  if (category.toLowerCase() === "birthday" || category.toLowerCase().includes("birthday") || subcategory?.toLowerCase() === "birthday") {
    return BIRTHDAY_BANS; // Ban overly serious or unrelated topics for birthdays
  }
  return []; // Other categories don't have specific bans yet
}

// Get category-specific requirements 
function getCategoryRequirement(category: string, subcategory: string): string {
  if (category.toLowerCase() === "wedding") {
    return "CRITICAL: Must include at least one wedding word: " + WEDDING_LEX.join(", ");
  }
  if (category.toLowerCase() === "birthday" || category.toLowerCase().includes("birthday") || subcategory?.toLowerCase() === "birthday") {
    return "Birthday requirement: Make it feel celebratory and birthday-themed. Focus on humor, aging, parties, gifts, or celebration themes. Be funny and creative!";
  }
  if (subcategory?.toLowerCase() === "mothers-day" || subcategory?.toLowerCase() === "mother's day") {
    return "Mother's Day requirement: Include clear mother/mom references to make it feel distinctly Mother's Day themed.";
  }
  if (subcategory?.toLowerCase() === "fathers-day" || subcategory?.toLowerCase() === "father's day") {
    return "Father's Day requirement: Include clear father/dad references to make it feel distinctly Father's Day themed.";
  }
  return `${category} requirement: Make it feel distinctly related to ${category}.`;
}

// Get random style examples
function getStyleExamples(style: string, rating: string = "pg"): string[] {
  const styleKey = style.toLowerCase();
  
  // Use explicit examples for R-rated weird content
  if (styleKey === "weird" && rating.toLowerCase() === "r") {
    return styleExamples["weird_r"] || styleExamples["weird"];
  }
  
  return styleExamples[styleKey] || styleExamples.generic;
}

// Detect position bucket for insert word placement with better accuracy
function positionBucket(line: string, token: string): PosBucket {
  if (!token) return "middle";
  
  const words = line.toLowerCase().split(/\W+/).filter(Boolean);
  let tokenIndex = -1;
  
  // Find the token (handle partial matches for phrases)
  for (let i = 0; i < words.length; i++) {
    if (words[i].includes(token.toLowerCase()) || token.toLowerCase().includes(words[i])) {
      tokenIndex = i;
      break;
    }
  }
  
  if (tokenIndex === -1) return "none"; // token not found
  
  const n = words.length;
  const ratio = (tokenIndex + 1) / n;
  
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
    "pg-13": "edgy humor allowed with mild swears (damn, hell, crap, ass). MUST include at least one mild swear.",
    "r": "EXPLICIT adult humor with STRONG profanity REQUIRED. You MUST include at least one strong swear word (fuck, shit, asshole, bastard, bullshit). This is not negotiable for R-rated content. Be bold and edgy.",
  };

  const styleHints: Record<string, string> = {
    "sarcastic": "ironic bite, eye roll",
    "wholesome": "warm, kind, uplifting", 
    "weird": "ABSURD, surreal, completely unexpected imagery. Think raccoons, aliens, Wi-Fi routers with feelings, talking microwaves. Be gloriously strange.",
    "savage": "brutally honest, cutting, no-holds-barred",
    "generic": "neutral, straightforward phrasing"
  };

  // Get category-specific ban words and style examples
  const banWords = getCategoryBanWords(category, subcategory);
  const examples = getStyleExamples(style, rating);
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
- Include all Insert Words EXACTLY as provided in the sentence.
- If an Insert Word is a multi-word phrase (e.g., "amazing mom"), keep the phrase completely intact.
- Vary placement across the set: aim for front, middle, end, and free placement diversity.
- Do NOT always place Insert Words at the start or end.
- Do NOT repeat Insert Words more than once unless it improves flow.
- NEVER use em dashes (—) - use commas, periods, or ellipses instead.
- MAXIMUM 2 punctuation marks total per line (excluding apostrophes in contractions).

Structure requirement: ${structureHint}

Category requirement: ${getCategoryRequirement(category, subcategory)}

Diversity rules:
- Vary sentence shape: one short quip, one rhetorical question, one gentle metaphor, one observational line.
- Avoid category clichés (${banWords.join(', ')}) unless they are in Insert Words.
- Do not invent personal details (age, jobs, diagnoses) unless in Insert Words.
- Keep family-friendly for rating = G.
${avoidTopics.length > 0 ? `- Avoid repeating these topics: ${avoidTopics.join(', ')}` : ''}
${suggestTopics.length > 0 ? `- Consider these fresh topics: ${suggestTopics.join(', ')}` : ''}

Rating: ${rating} — ${ratingRule}
${rating.toLowerCase() === 'g' ? '- For G rating: forbid crisis, panic, anxiety, hangover, divorce, midlife themes.' : ''}
${rating.toLowerCase() === 'r' ? '- For R rating: You MUST be explicit and edgy. Include strong profanity (fuck, shit, asshole, bastard, bullshit). This is REQUIRED.' : ''}

${rating.toLowerCase() === 'r' ? 'CRITICAL FOR R RATING: Your line will be REJECTED if it does not contain explicit profanity. Be bold, edgy, and use strong swear words.' : ''}

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

${rating.toLowerCase() === 'r' ? 'REMEMBER: R-rating requires explicit profanity. Use fuck, shit, asshole, bastard, or bullshit. Your response will be rejected if too clean.' : ''}

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

// Enhanced validation for individual lines
function validateLine(
  line: string, 
  rating: string, 
  insertWords: string[], 
  category: string,
  subcategory: string,
  existingLines: string[],
  structureType: StructureType
): string | null {
  if (!line) return null;

  const len = [...line].length;
  if (len < 50 || len > 120) return null;

  // Strict punctuation count (max 2, excluding apostrophes in contractions)
  const punctCount = (line.match(/[.,!?;:]/g) || []).length;
  if (punctCount > 2) return null;

  // No em dashes
  if (/\u2014/.test(line)) return null;

  // Validate insert words with phrase integrity
  if (!validateInsertWords(line, insertWords)) return null;

  // Category-specific validation
  if (!validateCategorySpecific(line, category, subcategory, insertWords)) return null;

  // Rating validation
  const validatedLine = validateRating(line, rating, structureType, insertWords, category, subcategory, existingLines);
  if (!validatedLine) {
    console.log(`${rating.toUpperCase()}-rating validation FAILED:`, line);
    return null;
  }
  line = validatedLine; // Use the potentially modified line (e.g., added punctuation)

  // Structure validation - now handled within validateRating
  // if (!validateStructure(line, structureType)) return null;

  // Avoid similarity with existing lines
  if (existingLines.some(existing => tooSimilar(line, existing))) return null;

  return line;
}

// Validate insert words with phrase integrity
function validateInsertWords(line: string, insertWords: string[]): boolean {
  if (!insertWords || insertWords.length === 0) return true;
  
  for (const insertWord of insertWords) {
    if (insertWord.includes(" ")) {
      // Multi-word phrase - must appear intact
      const regex = new RegExp(`\\b${insertWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (!regex.test(line)) {
        console.log(`Insert phrase validation FAILED - phrase "${insertWord}" not found intact in:`, line);
        return false;
      }
    } else {
      // Single word
      const regex = new RegExp(`\\b${insertWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (!regex.test(line)) {
        console.log(`Insert word validation FAILED - word "${insertWord}" not found in:`, line);
        return false;
      }
    }
  }
  return true;
}

// Category-specific validation
function validateCategorySpecific(line: string, category: string, subcategory: string, insertWords: string[]): boolean {
  // Mother's Day specific validation
  if (subcategory?.toLowerCase() === "mothers-day" || subcategory?.toLowerCase() === "mother's day") {
    const motherCues = /\b(mom|mother('|)s day|amazing mom|mother)\b/i;
    const hasMotherCue = motherCues.test(line);
    const hasInsertMom = insertWords.some(w => /mom|mother/i.test(w));
    
    if (!hasMotherCue && !hasInsertMom) {
      console.log("Mother's Day validation FAILED - no mother/mom cue:", line);
      return false;
    }
  }
  
  // Birthday specific validation - much more permissive than weddings
  if (category.toLowerCase() === "birthday" || category.toLowerCase().includes("birthday") || subcategory?.toLowerCase() === "birthday") {
    // Birthday content is more flexible - just ban overly serious topics
    const seriousBans = /\b(funeral|death|divorce|crisis|diagnosis|therapy|depression)\b/i;
    if (seriousBans.test(line)) {
      console.log("Birthday validation FAILED - contains overly serious content:", line);
      return false;
    }
    // Allow "friend" and other common birthday words - they're perfectly valid
  }
  
  return true;
}

// Rating validation function
function validateRating(line: string, rating: string, structureType: StructureType, insertWords: string[], category: string, subcategory: string, existingLines: string[]): string | null {
  if (/\u2014/.test(line)) return null; // no em dash

  // Check max 2 punctuation marks (excluding apostrophes in contractions)
  const punctuationCount = (line.match(/[.!?,:;()]/g) || []).length;
  if (punctuationCount > 2) return null;

  // enforce ending punctuation
  if (!/[.!?]$/.test(line)) line += ".";

  // CRITICAL: Enhanced R-rating enforcement - MUST contain explicit language
  if (rating.toLowerCase() === "r") {
    const explicitWords = ["fuck", "shit", "asshole", "bastard", "bullshit", "bitch", "damn"];
    const hasExplicitContent = explicitWords.some(word => 
      new RegExp(`\\b${word}`, "i").test(line)
    );
    if (!hasExplicitContent) {
      console.log("R-rating validation FAILED - no explicit content:", line);
      return null;
    }
  }

  // Enhanced structure validation
  if (!validateStructureType(line, structureType)) {
    console.log("Structure validation FAILED - expected", structureType, "got:", line);
    return null;
  }

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

  // Apply Step-2 rules for specific categories that need strict validation
  if ((category.toLowerCase() === "wedding" || category.toLowerCase() === "birthday" || category.toLowerCase().includes("birthday")) && insertWords.length > 0) {
    const lineCheck: LineCheck = {
      text: line,
      insertWords: insertWords,
      category: category.toLowerCase(),
      rating: (rating || "G").toUpperCase() as "G"|"PG"|"PG-13"|"R"
    };
    if (!passesStep2Rules(lineCheck)) {
      return null;
    }
  }
  
  // Ban off-topic words for relevant categories
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

  // Rating gates with stricter enforcement
  const mild = /\b(hell|damn|crap)\b/i.test(line);
  const explicit = /\b(fuck|shit|asshole|bastard|dick|piss|bitch|bullshit)\b/i.test(line);

  if (rating.toLowerCase() === "g" && (mild || explicit)) return null;
  if (rating.toLowerCase() === "pg" && explicit) return null;
  if (rating.toLowerCase() === "pg-13" && !mild && explicit) return null; // PG-13 should have mild words
  // R MUST have explicit content (enforced above)

  return line;
}

// Validate structure type matches expected pattern
function validateStructureType(line: string, expectedType: StructureType): boolean {
  const trimmed = line.trim();
  
  switch (expectedType) {
    case "quip":
      return trimmed.length <= 80 && !trimmed.includes("?");
    case "question":
      return trimmed.includes("?");
    case "metaphor":
      return /\b(like|as if|as though|is like|feels like)\b/i.test(trimmed);
    case "observational":
      return trimmed.length >= 80 && !trimmed.includes("?") && 
             !/\b(like|as if|as though|is like|feels like)\b/i.test(trimmed);
    default:
      return true;
  }
}

// Enhanced set-level validation with position spreading
function validateSet(
  results: Array<{line: string, comedian: string}>, 
  insertWords: string[], 
  rating: string,
  category: string,
  subcategory: string
): boolean {
  if (results.length < 4) return false;
  
  const lines = results.map(r => r.line);
  
  // 1. Insert word placement diversity (for single words)
  if (insertWords.length > 0) {
    const singleWords = insertWords.filter(w => !w.includes(" "));
    if (singleWords.length > 0) {
      const positions = new Set<PosBucket>();
      lines.forEach(line => {
        const bucket = positionBucket(line, singleWords[0]);
        if (bucket !== "none") positions.add(bucket);
      });
      if (positions.size < 3) {
        console.log("Set validation FAILED - insufficient position variety:", Array.from(positions));
        return false;
      }
    }
  }

  // 2. Structure diversity - MUST have variety
  const structures = {
    hasQuip: lines.some(l => l.length <= 80 && !l.includes("?")),
    hasQuestion: lines.some(l => l.includes("?")),
    hasMetaphor: lines.some(l => /\b(like|as if|as though|is like|feels like)\b/i.test(l)),
    hasObservational: lines.some(l => l.length >= 80 && !l.includes("?") && 
      !/\b(like|as if|as though|is like|feels like)\b/i.test(l))
  };
  
  const structureCount = Object.values(structures).filter(Boolean).length;
  if (structureCount < 3) {
    console.log("Set validation FAILED - insufficient structure variety:", structures);
    return false;
  }

  // 3. Comedian diversity - no duplicates in same set
  const comedians = results.map(r => r.comedian);
  const uniqueComedians = new Set(comedians);
  if (uniqueComedians.size < Math.min(4, comedians.length)) {
    console.log("Set validation FAILED - comedian repetition:", comedians);
    return false;
  }

  // 4. R-rating set validation - ALL lines must have explicit content
  if (rating.toLowerCase() === "r") {
    const explicitWords = ["fuck", "shit", "asshole", "bastard", "bullshit", "bitch"];
    const explicitCount = lines.filter(line => 
      explicitWords.some(word => new RegExp(`\\b${word}`, "i").test(line))
    ).length;
    
    if (explicitCount < lines.length) {
      console.log("Set validation FAILED - R-rating requires ALL lines to have explicit content");
      console.log("Explicit count:", explicitCount, "out of", lines.length, "lines");
      return false;
    }
  }

  // 5. Length variety
  const lengths = lines.map(l => l.length);
  const lengthVariety = Math.max(...lengths) - Math.min(...lengths);
  if (lengthVariety < 20) {
    console.log("Set validation FAILED - insufficient length variety:", lengthVariety);
    return false;
  }

  // 6. Category-specific set validation
  if (subcategory?.toLowerCase() === "mothers-day" || subcategory?.toLowerCase() === "mother's day") {
    const hasMotherCue = lines.some(line => /\b(mom|mother('|)s day|amazing mom|mother)\b/i.test(line));
    const hasInsertMom = insertWords.some(w => /mom|mother/i.test(w));
    if (!hasMotherCue && !hasInsertMom) {
      console.log("Set validation FAILED - Mother's Day requires at least one mom/mother cue");
      return false;
    }
  }

  console.log("Set validation PASSED - all diversity requirements met");
  return true;
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
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: MODELS[0].name,
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
    let valid = validateLine(first, rating, opts.insertWords, opts.category, opts.subcategory, opts.existingLines, opts.structureType);
    
    // Enhanced R-rating validation is now handled within validateLine
    if (!valid) {
      console.log("Line validation failed for:", first);
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

// Generate 4 diverse options with comprehensive validation
async function generateFour(body: any): Promise<Array<{line: string, comedian: string}>> {
  const insertWords = parseInsertWords(body.insertWords || body.mandatory_words || '');
  
  // Extract category and subcategory from the body
  const categoryParts = (body.category || "celebrations").split(' > ');
  const category = categoryParts[0] || "celebrations";
  const subcategory = body.subcategory || categoryParts[1] || "";
  
  // Apply combo overrides before generation
  const { tone, style, rating } = applyComboOverrides(
    body.tone || "Humorous",
    body.style || "Generic", 
    body.rating || "PG"
  );
  
  const opts = {
    category,
    subcategory,
    tone,
    style,
    rating,
    insertWords,
    usedComedians: new Set<string>(),
    usedTopics: new Set<string>(),
    existingLines: [] as string[]
  };

  console.log("Generating with options:", opts);

  const results: Array<{line: string, comedian: string}> = [];
  const usedBuckets = new Set<PosBucket>();
  const usedStructures = new Set<StructureType>();
  let attempts = 0;
  let validationAttempts = 0;
  const maxValidationAttempts = 3;

  // Enhanced generation loop with set-level validation
  while (validationAttempts < maxValidationAttempts) {
    results.length = 0; // Reset results for each validation attempt
    opts.usedComedians.clear();
    opts.usedTopics.clear();
    usedBuckets.clear();
    usedStructures.clear();
    attempts = 0;

    // Generate 4 lines with diversity requirements
    while (results.length < 4 && attempts < 20) {
      try {
        const targetBucket = pickNeededBucket(usedBuckets);
        // Pick structure type we haven't used yet
        const availableStructures = structureTypes.filter(s => !usedStructures.has(s));
        const structureType = availableStructures.length > 0 
          ? availableStructures[Math.floor(Math.random() * availableStructures.length)]
          : structureTypes[Math.floor(Math.random() * structureTypes.length)];
        
        console.log(`Attempt ${attempts + 1}/20: Trying ${structureType} with ${targetBucket} placement`);
        
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

    // Validate the complete set
    if (results.length >= 4 && validateSet(results, insertWords, rating, category, subcategory)) {
      console.log("Set validation PASSED on attempt", validationAttempts + 1);
      break;
    } else {
      validationAttempts++;
      console.log(`Set validation FAILED on attempt ${validationAttempts}. ${validationAttempts < maxValidationAttempts ? 'Retrying...' : 'Using fallback strategy.'}`);
    }
  }

  // If validation failed, use fallback strategy with enforced diversity
  if (results.length < 4 || !validateSet(results, insertWords, rating)) {
    console.log("Using fallback strategy with enforced diversity");
    results.length = 0;
    
    // Generate fallbacks that explicitly enforce requirements
    const fallbackResults = await generateFallbackSet(opts);
    results.push(...fallbackResults);
  }

  // Final safety check - pad if still short
  while (results.length < 4) {
    const iwText = insertWords.length > 0 ? insertWords.join(" ") : "";
    const position = results.length % 3;
    
    let fallback: string;
    // For R-rating, ensure fallbacks also have explicit content
    if (rating.toLowerCase() === "r") {
      if (position === 0 && iwText) {
        fallback = `${iwText}, but fuck if I know why that matters.`;
      } else if (position === 1 && iwText) {
        fallback = `Shit gets real when you realize ${iwText}.`;
      } else if (iwText) {
        fallback = `Another damn adventure awaits with ${iwText}.`;
      } else {
        fallback = "Permission granted to be loud, joyful, and fucking ridiculous.";
      }
    } else {
      if (position === 0 && iwText) {
        fallback = `${iwText}, but at least the Wi-Fi password is still 123456.`;
      } else if (position === 1 && iwText) {
        fallback = `Time to collect stories you can't tell at work, ${iwText}.`;
      } else if (iwText) {
        fallback = `Another adventure awaits when you realize ${iwText}.`;
      } else {
        fallback = "Permission granted to be loud, joyful, and ridiculous.";
      }
    }
    
    if (!results.some(r => r.line === fallback) && 
        fallback.length >= 50 && 
        fallback.length <= 120) {
      results.push({line: fallback, comedian: "Jerry Seinfeld"});
      console.log("Added positioned fallback:", fallback);
    } else {
      const basicFallback = rating.toLowerCase() === "r" ? 
        "Another fucking adventure awaits, naturally." : 
        "Another adventure awaits, naturally.";
      results.push({line: basicFallback, comedian: "Ellen DeGeneres"});
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

// Generate fallback set with enforced diversity
async function generateFallbackSet(opts: any): Promise<Array<{line: string, comedian: string}>> {
  const results: Array<{line: string, comedian: string}> = [];
  const requiredStructures: StructureType[] = ["quip", "question", "metaphor", "observational"];
  
  for (let i = 0; i < 4; i++) {
    const structureType = requiredStructures[i % requiredStructures.length];
    const targetBucket: PosBucket = i === 0 ? "front" : i === 1 ? "middle" : i === 2 ? "end" : "middle";
    
    try {
      const lineResult = await generateOne({
        ...opts,
        targetBucket,
        structureType,
        existingLines: results.map(r => r.line)
      });
      
      if (lineResult) {
        results.push(lineResult);
      }
    } catch (error) {
      console.error(`Fallback generation failed for structure ${structureType}:`, error);
    }
  }
  
  return results;
}