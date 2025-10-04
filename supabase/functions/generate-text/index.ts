// v2025-06-03: Responses API with json_schema, honest errors, dry-run bypass
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type Tone = "humorous" | "savage" | "sentimental" | "nostalgic" | "romantic" | "inspirational" | "playful" | "serious";
type Rating = "G" | "PG" | "PG-13" | "R";

interface TaskObject {
  tone: Tone;
  rating: Rating;
  category_path: string[];
  topic: string;
  insert_words?: string[];
  insert_word_mode?: "per_line" | "at_least_one";
  birthday_explicit?: boolean;
  anchors?: string[];
  require_anchors?: boolean;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Error helper for standardized error responses
function err(status: number, message: string, details?: unknown) {
  return new Response(
    JSON.stringify({ success: false, status, error: message, details: details ?? null }),
    { status, headers: { ...cors, "Content-Type": "application/json" } }
  );
}

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const CHAT_MODEL = "gpt-5-mini-2025-08-07";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const DEBUG = Deno.env.get("DEBUG_TEXT") === "1";

const TONE_HINTS: Record<string, string> = {
  humorous: "funny, witty, punchy",
  savage: "blunt, cutting, roast-style",
  sentimental: "warm, affectionate, heartfelt",
  nostalgic: "reflective, past references, lightly playful",
  romantic: "affectionate, playful, charming",
  inspirational: "uplifting, bold, clever",
  playful: "silly, cheeky, fun",
  serious: "formal, direct, weighty; minimal humor",
};

const RATING_HINTS: Record<string, string> = {
  G: "no profanity; no sexual terms; no drugs",
  PG: "mild language OK; no sex mentions; no drugs",
  "PG-13": "non-graphic sex mentions OK; alcohol + cannabis OK; NO f-bomb",
  R: "adult non-graphic sex OK; strong profanity OK; no slurs; no illegal how-to",
};

// Topicality cue patterns per subcategory
const CUE_MAPS: Record<string, RegExp[]> = {
  birthday: [
    /\bbirthday|b-day\b/i, /\bcake|frosting|sprinkles|icing\b/i, /\bcandles?\b/i,
    /\bmake a wish|wish\b/i, /\bparty\b/i, /\bballoons?\b/i, /\bgifts?|presents?\b/i,
    /\bage|older|years? old|turning\b/i
  ],
  wedding: [
    /\bwedding|nuptials|marriage\b/i, /\bbride|groom|newlyweds?\b/i, /\bvows?\b/i,
    /\brings?\b/i, /\breception|venue|banquet|ceremony\b/i, /\bopen bar|bar tab\b/i,
    /\bbest man|maid of honor|bridesmaids?\b/i, /\btux(?:edo)?|veil|bouquet|dress\b/i,
    /\bregistry|gifts?\b/i, /\bin-laws?\b/i, /\bprenup\b/i
  ],
  engagement: [
    /\bengagement|engaged\b/i, /\brings?|proposal\b/i, /\bproposed|popped the question\b/i,
    /\bwedding plans?|planning\b/i, /\bforever|future\b/i
  ],
  graduation: [
    /\bgraduation|graduate|grad\b/i, /\bdiploma|degree\b/i, /\bcaps? and gowns?\b/i,
    /\bstudent loans?|debt\b/i, /\bfuture|career|job\b/i, /\balma mater\b/i
  ],
  anniversary: [
    /\banniversary\b/i, /\byears? together\b/i, /\bmarriage|relationship\b/i,
    /\bcommitment|love\b/i, /\bmemories|milestone\b/i
  ]
};

function getCuesForSubcategory(subcategory: string): RegExp[] {
  return CUE_MAPS[subcategory.toLowerCase()] || [];
}

// Hard-banned clichés that keep recycling
const BANNED_PHRASES = [
  /\banother trip around the sun\b/i,
  /\blegally binding proof\b/i,
  /\btriggered the smoke detector\b/i,
  /\bofficially classified as vintage\b/i,
  /\bhandle with care\b/i,
  /\bavoid direct sunlight\b/i,
  /\bbiohazard frosting\b/i,
  /\bfire marshal\b/i,
  /\bwarranty expired\b/i,
];

function hasBannedPhrase(line: string): boolean {
  return BANNED_PHRASES.some(rx => rx.test(line));
}

function houseRules(tone: Tone, rating: Rating, task: TaskObject) {
  const warm = ["sentimental", "romantic", "inspirational"].includes(tone);
  const subcategory = task.category_path[1]?.toLowerCase() || "";
  
  // Add insert words instruction
  const insertWordsHint = task.insert_words?.length 
    ? `IMPORTANT: Use "${task.insert_words.join('", "')}" as names/subjects in your captions.`
    : "";

  const subcatHint = subcategory === "wedding"
    ? "Write savage wedding captions: vows, rings, reception chaos, best-man disasters, in-laws, registry, open bar. No birthday/age jokes."
    : subcategory === "birthday"
    ? "Write birthday captions: cake, candles, wish, age roast, party, gifts. No wedding content."
    : subcategory === "engagement"
    ? "Write engagement captions: ring, proposal, future planning, relationship milestones."
    : subcategory === "graduation"
    ? "Write graduation captions: diploma, career, student loans, caps and gowns."
    : subcategory === "anniversary"
    ? "Write anniversary captions: years together, commitment, shared memories."
    : `Write ${subcategory || task.topic} captions.`;

  return [
    "Write 4 unique on-image card captions.",
    insertWordsHint,
    "Each 70–110 chars; end with . ! or ?",
    warm
      ? "Warm tone with a wink: each line needs one playful twist."
      : "Every line must be funny: absurd image or sharp roast. No generic greetings.",
    `Tone: ${TONE_HINTS[tone]}`, 
    `Rating: ${RATING_HINTS[rating]}`,
    "Never use em dashes. Use commas or periods.",
    "Ban: gamer patch notes, fortune-cookie advice, 'Level up', 'Survived another lap', 'Make a wish', 'trip around the sun', 'legally binding', 'smoke detector', 'vintage classified', 'warranty expired'.",
    subcatHint
  ].filter(Boolean).join("\n");
}


const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (s: string, w: string) => new RegExp(`\\b${esc(w)}(?:'s)?\\b`, "i").test(s);

function topicalityProblems(
  lines: string[],
  task: TaskObject,
  opts: { minCuedLines?: number } = { minCuedLines: 2 }
) {
  const problems: string[] = [];
  
  // Basic checks (updated to 70 char minimum)
  if (!Array.isArray(lines) || lines.length !== 4) problems.push("needs_4_lines");
  for (const s of lines || []) {
    if (s.length < 70 || s.length > 120) problems.push("bad_length");
    if (!/[.!?]$/.test(s)) problems.push("no_end_punctuation");
    if (/—/.test(s)) problems.push("forbidden_em_dash");
  }
  
  // Subcategory topicality: 2 of 4 lines need specific cues
  const subcategory = task.category_path[1]?.toLowerCase() || "";
  const cues = getCuesForSubcategory(subcategory);

  if (cues.length > 0) {
    const cuedCount = lines.filter(line => 
      cues.some(pattern => pattern.test(line))
    ).length;
    
    if (cuedCount < (opts.minCuedLines ?? 2)) {
      problems.push(`needs_more_${subcategory}_cues:${cuedCount}/4`);
    }
  }
  
  // Insert words (name): must appear in at least 1 line
  if (task.insert_words?.length && task.insert_word_mode === "at_least_one") {
    const seen = task.insert_words.some(w => lines.some(l => hasWord(l, w)));
    if (!seen) problems.push("missing_insert_word");
  }
  
  // Deduplication check
  const norm = (s: string) => s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|and|or|but|with|for|to|of|on|in|your)\b/g, " ")
    .replace(/\s+/g, " ").trim();
  const seen = new Set<string>();
  for (const l of lines) {
    const k = norm(l);
    if (seen.has(k)) { problems.push("near_duplicate"); break; }
    seen.add(k);
  }
  
  return problems.length ? problems : null;
}

function blandnessProblems(lines: string[], tone: Tone) {
  if (tone === "serious") return null;
  
  const BANNED_OPENINGS = [
    /^Level up/i,
    /^Survived another/i,
    /^Make a wish/i,
    /^Another year/i,
    /^Congrats on/i,
    /^Congratulations on/i,
    /^Happy birthday to/i,
    /^Wishing you/i,
    /^Here'?s to/i,
  ];
  
  const BANNED_PHRASES = [
    /\banother trip around the sun\b/i,
    /\blive laugh love\b/i,
    /\byou got this\b/i,
    /\bmake it count\b/i,
  ];
  
  const GAMER_PATCH_NOTES = /\b(age\s*[+]\s*\d|wisdom\s*[±]\s*\d|xp\s*[+])/i;
  const FORTUNE_COOKIE = /^(Remember|Always|Never forget|Life is|The secret)/i;
  
  const problems: string[] = [];
  
  for (const line of lines) {
    // Check banned opening patterns
    if (BANNED_OPENINGS.some(pattern => pattern.test(line))) {
      problems.push(`banned_template:${line.slice(0, 30)}...`);
    }
    // Check banned phrases anywhere in line
    if (BANNED_PHRASES.some(pattern => pattern.test(line))) {
      problems.push(`banned_phrase:${line.slice(0, 30)}...`);
    }
    // Check gamer patch notes style
    if (GAMER_PATCH_NOTES.test(line)) {
      problems.push(`gamer_patch_notes:${line.slice(0, 30)}...`);
    }
    // Check fortune cookie wisdom
    if (FORTUNE_COOKIE.test(line)) {
      problems.push(`fortune_cookie:${line.slice(0, 30)}...`);
    }
  }
  
  // Check for variety: no two lines should start with same 3 words
  const openings = lines.map(l => l.split(/\s+/).slice(0, 3).join(" ").toLowerCase());
  const uniqueOpenings = new Set(openings);
  if (uniqueOpenings.size < lines.length) {
    problems.push("repetitive_openings");
  }
  
  return problems.length ? problems : null;
}

function topicalDiversityProblems(lines: string[]) {
  // Map each line to comedy categories
  const CATEGORIES = {
    cake: /\b(cake|frosting|icing|sprinkles|batter|bake|slice)\b/i,
    candles: /\b(candles?|fire|flame|smoke|marshal|extinguisher|burn|ignite)\b/i,
    age: /\b(age|old|older|young|wrinkle|warranty|expired|gray|ancient|decades?)\b/i,
    party: /\b(party|balloons?|confetti|banner|celebrate|chaos|disaster|mess)\b/i,
    wishes: /\b(wish|gift|present|surprise|expect|receipt|return)\b/i,
  };

  const categoryCounts = new Set<string>();
  
  for (const line of lines) {
    for (const [category, pattern] of Object.entries(CATEGORIES)) {
      if (pattern.test(line)) {
        categoryCounts.add(category);
      }
    }
  }

  if (categoryCounts.size < 3) {
    return [`topical_diversity:only_${categoryCounts.size}_categories`];
  }

  return null;
}

// In-memory cache for recent lines (resets on function restart)
const RECENT_LINES_CACHE: string[] = [];

function similarityCheck(lines: string[], cache: string[]) {
  const problems: string[] = [];
  
  const normalize = (s: string) => 
    s.toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim();

  for (const newLine of lines) {
    const newWords = new Set(normalize(newLine).split(/\s+/));
    
    for (const cachedLine of cache) {
      const cachedWords = new Set(normalize(cachedLine).split(/\s+/));
      const overlap = [...newWords].filter(w => cachedWords.has(w));
      const similarity = overlap.length / Math.max(newWords.size, cachedWords.size);
      
      if (similarity > 0.8) {
        problems.push(`repeat_detected:${newLine.slice(0, 40)}...`);
        break;
      }
    }
  }

  return problems.length ? problems : null;
}

function comedyProblems(lines: string[], tone: Tone) {
  if (tone === "serious") return null;
  
  // Check for actual comedy mechanisms, not just keywords
  const ABSURDITY_INDICATORS = [
    /\b(fire marshal|legally binding|emergency|hazard|report for duty|backup|biohazard)\b/i,
    /\b(allegedly|technically|officially|scientifically|legally)\b/i,
    /\b(disaster|chaos|catastrophe|crisis|mayhem)\b/i,
  ];
  
  const EXAGGERATION_SIGNALS = [
    /[+∞]|unlimited|infinite/i,
    /\b(every|all|never|always|forever)\b.*\b(single|possible|imaginable)\b/i,
    /\b(officially|scientifically|technically)\b/i,
  ];
  
  const SURPRISE_TWIST_WORDS = [
    /\b(but|except|still|somehow|turns out|plot twist|surprise)\b/i,
    /\b(until|unless|despite|although|however)\b/i,
  ];
  
  const CONCRETE_HUMOR = [
    /\b(cake|candles|sprinkles|frosting|balloons|confetti)\b/i,
    /\b(warranty|contract|policy|terms|conditions|fine print)\b/i,
  ];
  
  const problems: string[] = [];
  
  // Count lines with different comedy mechanisms
  let absurdCount = 0;
  let exaggerationCount = 0;
  let twistCount = 0;
  let concreteCount = 0;
  
  for (const line of lines) {
    if (ABSURDITY_INDICATORS.some(p => p.test(line))) absurdCount++;
    if (EXAGGERATION_SIGNALS.some(p => p.test(line))) exaggerationCount++;
    if (SURPRISE_TWIST_WORDS.some(p => p.test(line))) twistCount++;
    if (CONCRETE_HUMOR.some(p => p.test(line))) concreteCount++;
  }
  
  const totalComedySignals = absurdCount + exaggerationCount + twistCount + concreteCount;
  
  const warmTones = ["sentimental", "romantic", "inspirational"];
  const isWarm = warmTones.includes(tone);
  
  if (isWarm) {
    // Warm tones: at least 2 lines with comedy signals
    if (totalComedySignals < 2) {
      problems.push(`warm_needs_humor_sprinkle:only_${totalComedySignals}_comedy_signals`);
    }
  } else {
    // Default comedy tones: need strong comedy across all lines
    // At least 3 lines with comedy signals, and at least 2 different types
    if (totalComedySignals < 6) {
      problems.push(`not_funny_enough:only_${totalComedySignals}_comedy_signals`);
    }
    const mechanismTypes = [absurdCount > 0, exaggerationCount > 0, twistCount > 0, concreteCount > 0].filter(Boolean).length;
    if (mechanismTypes < 2) {
      problems.push(`one_trick_pony:only_${mechanismTypes}_comedy_types`);
    }
  }
  
  return problems.length ? problems : null;
}

async function callResponsesAPI(system: string, userObj: unknown) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  
  const body = {
    model: CHAT_MODEL,
    modalities: ["text"],
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(userObj) },
    ],
    max_output_tokens: 420,
    text: {
      format: {
        type: "json_schema",
        name: "ViibeLinesV1",
        strict: true,
        schema: {
          type: "object",
          properties: {
            lines: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: { type: "string" }
            }
          },
          required: ["lines"],
          additionalProperties: false
        }
      }
    }
  };

  const ctl = new AbortController();
  const tid = setTimeout(() => ctl.abort("timeout"), 8000);
  
  try {
    const r = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${OPENAI_API_KEY}`, 
        "Content-Type": "application/json",
        "Connection": "keep-alive"
      },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    
    const raw = await r.text();
    
    // Map upstream errors properly
    if (!r.ok) {
      if (r.status === 429) {
        throw new Error(`rate_limit:${raw.slice(0, 200)}`);
      }
      if (r.status === 402 || raw.includes("insufficient_quota")) {
        throw new Error(`insufficient_quota:${raw.slice(0, 200)}`);
      }
      // Other 4xx errors
      throw new Error(`OpenAI ${r.status}: ${raw.slice(0, 400)}`);
    }
    
    const data = JSON.parse(raw);
    
    // Try output_parsed first (structured response)
    if (data.output_parsed?.lines && Array.isArray(data.output_parsed.lines) && data.output_parsed.lines.length === 4) {
      if (DEBUG) console.log("✓ Using output_parsed");
      return data.output_parsed.lines as string[];
    }
    
    // Fallback: parse output_text as JSON
    const outputText = data.output_text;
    if (outputText) {
      try {
        const parsed = JSON.parse(outputText);
        if (Array.isArray(parsed?.lines) && parsed.lines.length === 4) {
          if (DEBUG) console.log("✓ Using output_text fallback");
          return parsed.lines as string[];
        }
      } catch (e) {
        if (DEBUG) console.error("Failed to parse output_text:", outputText.slice(0, 600));
      }
    }
    
    if (DEBUG) console.error("No valid content in response:", JSON.stringify(data).slice(0, 600));
    throw new Error("parse_error:no_content");

  } catch (e: any) {
    if (e?.name === "AbortError" || String(e).includes("timeout")) throw new Error("timeout");
    throw new Error(String(e?.message || e));
  } finally {
    clearTimeout(tid);
  }
}

// Simple call with timeout (no hedging to avoid worker crashes)
async function callFast(system: string, payload: unknown) {
  return callResponsesAPI(system, payload);
}


// In-memory cache: category:subcategory:tone:rating → recent lines
const RECENT_LINES_BY_KEY = new Map<string, string[]>();

function getCacheForKey(category: string, subcategory: string, tone: string, rating: string): string[] {
  const key = `${category}:${subcategory}:${tone}:${rating}`.toLowerCase();
  if (!RECENT_LINES_BY_KEY.has(key)) {
    RECENT_LINES_BY_KEY.set(key, []);
  }
  return RECENT_LINES_BY_KEY.get(key) || [];
}

function addToCache(category: string, subcategory: string, tone: string, rating: string, newLines: string[]) {
  if (newLines.length === 0) return;
  const key = `${category}:${subcategory}:${tone}:${rating}`.toLowerCase();
  const current = getCacheForKey(category, subcategory, tone, rating);
  const updated = [...current, ...newLines].slice(-80); // Keep last 80 lines
  RECENT_LINES_BY_KEY.set(key, updated);
}

// Consolidated quick validation (single local check)
function quickValidate(lines: string[], task: TaskObject) {
  if (!Array.isArray(lines) || lines.length !== 4) return "needs_4_lines";
  
  // Length, punctuation, em-dash
  for (const line of lines) {
    if (line.length < 70 || line.length > 110) return "bad_length";
    if (!/[.!?]$/.test(line)) return "no_end_punctuation";
    if (/—/.test(line)) return "em_dash";
  }
  
  // Check for banned clichés
  if (lines.some(l => hasBannedPhrase(l))) {
    return "banned_phrase";
  }
  
  // Subcategory cues (need at least 2)
  const subcategory = task.category_path[1]?.toLowerCase() || "";
  const cues = getCuesForSubcategory(subcategory);

  if (cues.length > 0) {
    const cuedCount = lines.filter(l => cues.some(pattern => pattern.test(l))).length;
    if (cuedCount < 2) return `needs_more_${subcategory}_cues`;
  }
  
  // Check for banned clichés
  if (lines.some(l => hasBannedPhrase(l))) {
    return "banned_phrase";
  }
  
  return null;
}

// Fallback lines per subcategory
const SAFE_LINES_BY_CATEGORY: Record<string, string[]> = {
  birthday: [
    "Jesse, the cake says 'serves 8' and your fork says 'challenge accepted.'",
    "Candles counted, alibi prepared, sprinkles ready to testify on your behalf.",
    "If the frosting survives the group chat, you may eat it unsupervised.",
    "A year older, still negotiating with cake like it's a hostile takeover."
  ],
  wedding: [
    "Congrats on finding someone who'll put up with you—permanently.",
    "Love is patient, love is kind, love is signing a lifelong contract.",
    "May your love be modern enough to survive the times, and old-fashioned enough to last forever.",
    "Here's to love, laughter, and happily ever after—prenup optional."
  ],
  engagement: [
    "Congrats on finding someone willing to argue about furniture with you for the rest of your life.",
    "Ring acquired, registry loading, wedding planner on speed dial. May the Wi-Fi be with you.",
    "You said yes to forever, now say yes to fifty different venue options and a catering nightmare.",
    "Engagement: when two people agree to merge their streaming subscriptions and pretend it's romantic."
  ],
  graduation: [
    "Diploma unlocked, student loans loading. Welcome to the real world where nobody grades on a curve.",
    "Congratulations on trading all-nighters for alarm clocks and coffee addictions for legitimate reasons.",
    "Four years, one degree, lifelong debt. May your Wi-Fi be strong and your job offers be many.",
    "Cap and gown returned, real clothes required. The final boss is adulting, and it doesn't offer extra credit."
  ],
  anniversary: [
    "Another year of not killing each other. Cheers to that!",
    "You're proof that love can survive anything—even each other.",
    "Congratulations on another year of marriage. You're basically relationship veterans now.",
    "May your love story continue to be better than any Netflix series."
  ]
};

function getSafeLinesForSubcategory(subcategory: string, insertWords?: string[]): string[] {
  let lines = SAFE_LINES_BY_CATEGORY[subcategory.toLowerCase()] || SAFE_LINES_BY_CATEGORY.birthday;
  
  // Substitute placeholder names with actual insert words
  if (insertWords?.length) {
    const name = insertWords[0];
    lines = lines.map(line => line.replace(/\bJesse\b/g, name));
  }
  
  return lines;
}

// ============ HTTP HANDLER ============
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const req_id = crypto.randomUUID().slice(0, 8);
    const url = new URL(req.url);
    const body = await req.json();
    
    // Input validation
    const required = ["category", "subcategory", "tone", "rating"];
    const missing = required.filter((f) => !body[f]);
    if (missing.length) {
      return err(400, `missing_fields:${missing.join(",")}`);
    }
    
    // DRY-RUN BYPASS: call with ?dry=1 to prove wiring without model/key
    if (url.searchParams.get("dry") === "1") {
      const insert_words: string[] = Array.isArray(body.insertWords) ? body.insertWords.slice(0, 2) : [];
      return new Response(JSON.stringify({ 
        success: true, 
        options: getSafeLinesForSubcategory("birthday", insert_words), 
        model: "dry-run",
        source: "dry-run",
        req_id
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    
    if (!OPENAI_API_KEY) return err(401, "OPENAI_API_KEY not configured");
    
    const category = String(body.category || "").trim();
    const subcategory = String(body.subcategory || "").trim();
    const tone: Tone = (body.tone || "humorous") as Tone;
    const rating: Rating = (body.rating || "PG") as Rating;
    const insert_words: string[] = Array.isArray(body.insertWords) ? body.insertWords.slice(0, 2) : [];

    const task: TaskObject = {
      tone,
      rating,
      category_path: [category, subcategory].filter(Boolean),
      topic: subcategory || category || "topic",
      insert_words,
      insert_word_mode: (body.insertWordMode || "per_line") as "per_line" | "at_least_one",
      birthday_explicit: category.toLowerCase() === "celebrations" && /birthday/i.test(subcategory),
      anchors: undefined,
      require_anchors: false,
    };

    const subcat = task.category_path[1]?.toLowerCase() || "";

    // Pull recent themes from cache to avoid repetition
    const recentCache = getCacheForKey(category, subcategory, tone, rating);
    const recentThemes = recentCache
      .slice(-8)
      .map(line => {
        // Extract key theme words (3-5 words)
        const words = line.toLowerCase().split(/\W+/).filter(w => w.length > 3);
        return words.slice(0, 3).join(" ");
      })
      .join(" | ");

    const SYSTEM = houseRules(task.tone, task.rating, task) + 
      (recentThemes ? `\n\nAVOID these recent themes: ${recentThemes}` : "");
    const userPayload = { version: "viibe-text", tone_hint: TONE_HINTS[tone], rating_hint: RATING_HINTS[rating], task };

    if (DEBUG) console.log("System prompt:", SYSTEM);

    let lines: string[];
    try {
      lines = await callFast(SYSTEM, userPayload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("AI error:", msg);
      
      // Map specific upstream errors
      if (msg.includes("rate_limit")) {
        return err(429, "rate_limit_exceeded", { details: msg });
      }
      if (msg.includes("insufficient_quota")) {
        return err(402, "insufficient_quota", { details: msg });
      }
      if (msg.includes("OpenAI 4")) {
        return err(422, "validation_failed", { details: msg });
      }
      
      // Fallback on parse errors or other provider issues
      if (msg.includes("parse_error") || msg.includes("provider_error")) {
        console.log("⚠️ Parse/provider error → returning safe fallback lines");
        const safeFallback = getSafeLinesForSubcategory(subcategory, insert_words);
        return new Response(JSON.stringify({ 
          success: true, 
          options: safeFallback, 
          model: CHAT_MODEL,
          source: "fallback",
          req_id,
          count: safeFallback.length,
          reason: msg
        }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      
      return err(502, "provider_error", { details: msg });
    }

    // Quick validation (single local check)
    let problem = quickValidate(lines, task);
    
    if (problem) {
      if (DEBUG) console.log("⚠️ Validation failed:", problem, "→ strict retry");
      const STRICT = SYSTEM + "\nCRITICAL: 4 new lines, 70–110 chars, end with . ! ?, no em dashes, ≥2 " + (subcat || "category") + " cues.";
      try {
        const retry = await callFast(STRICT, userPayload);
        problem = quickValidate(retry, task);
        if (problem) {
          return err(422, `validation_failed:${problem}`, { lines: retry });
        }
        lines = retry;
      } catch (e) {
        return err(502, "provider_error_retry");
      }
    }

    // 5️⃣ Cross-run novelty filter with 3-gram Jaccard (already fetched above for themes)
    
    function canon(s: string) { 
      return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); 
    }

    function shingles(s: string, k = 3) { 
      const words = canon(s).split(" "); 
      const out = new Set<string>(); 
      for (let i = 0; i <= words.length - k; i++) {
        out.add(words.slice(i, i + k).join(" ")); 
      }
      return out; 
    }

    function jaccard(a: Set<string>, b: Set<string>) { 
      const inter = [...a].filter(x => b.has(x)).length; 
      return inter / (a.size + b.size - inter || 1); 
    }

    function tooSimilar(a: string, b: string) {
      return jaccard(shingles(a), shingles(b)) >= 0.5; // Stricter threshold
    }

    // Filter out lines that are too similar to recent cache
    const freshLines = lines.filter(newLine => 
      !recentCache.some(cachedLine => tooSimilar(newLine, cachedLine))
    );

    if (freshLines.length < 4) {
      if (DEBUG) console.log("⚠️ Only", freshLines.length, "novel lines → strict retry");
      const STRICT = SYSTEM + "\nCRITICAL: Produce four NEW lines not paraphrasing earlier outputs. Be creative with different angles.";
      try {
        const retryLines = await callFast(STRICT, userPayload);
        const retryFresh = retryLines.filter(newLine => 
          !recentCache.some(cachedLine => tooSimilar(newLine, cachedLine))
        );
        
        if (retryFresh.length >= 4) {
          lines = retryFresh.slice(0, 4);
        } else {
          // Mix fresh from both attempts
          const combined = [...new Set([...freshLines, ...retryFresh])];
          if (combined.length >= 4) {
            lines = combined.slice(0, 4);
          } else {
            return err(422, "not_enough_novel_lines", { served: combined });
          }
        }
      } catch (e) {
        return err(502, "provider_error_novelty_retry");
      }
    } else {
      lines = freshLines.slice(0, 4);
    }

    // Add to cache for future novelty checks
    addToCache(category, subcategory, tone, rating, lines);

    // Success - add to cache and return
    addToCache(category, subcategory, tone, rating, lines);

    return new Response(JSON.stringify({ 
      success: true, 
      options: lines, 
      model: CHAT_MODEL,
      source: "model",
      req_id,
      count: lines.length 
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-text fatal error:", msg);
    return err(500, "internal_error", { details: msg });
  }
});
