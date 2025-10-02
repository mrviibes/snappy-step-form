import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  general_text_rules,
  celebration_text_rules,
  joke_text_rules,
  daily_life_text_rules,
  sports_text_rules,
  pop_culture_text_rules,
  miscellaneous_text_rules,
  custom_design_text_rules,
  TONE_TAGS,
  RATING_TAGS
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Types ----------
interface GeneratePayload {
  category: string;
  subcategory?: string;
  theme?: string;
  tone?: string;      // "humorous", "savage", ...
  rating?: string;    // "G" | "PG" | "PG-13" | "R"
  insertWords?: string[]; // e.g., ["Jesse", "gay"]
  gender?: string;    // "male" | "female" | "neutral"
}

// ---------- Minimal helpers ----------
const MAX_LEN = 120;

const RX_STRONG = [
  /\bfuck(?:ing|er|ed|s)?\b/gi,
  /\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi,
  /\bbullshit\b/gi,
];
const MEDIUM_WORDS = ["bastard","asshole","prick","dick","douche","crap"];

const TRAIT_WORDS = new Set([
  "gay","lesbian","bi","bisexual","queer","trans",
  "vegan","gluten-free","introvert","extrovert",
  "left-handed","right-handed","nerd","gamer","dad","mom"
]);

function trimLine(s = ""): string { return s.replace(/\s+/g, " ").trim(); }
function endPunct(s = ""): string { return /[.!?]$/.test(s) ? s : s + "."; }

function capLenSmart(s = "", n = MAX_LEN): string {
  if (s.length <= n) return s;
  const pre = s.slice(0, n);
  const lastStop = Math.max(pre.lastIndexOf("."), pre.lastIndexOf("!"), pre.lastIndexOf("?"));
  if (lastStop > 40) return pre.slice(0, lastStop + 1);
  const i = pre.lastIndexOf(" ");
  return (i > 40 ? pre.slice(0, i) : pre).trim(); // button added later if needed
}

function sanitizePunct(s = ""): string {
  return s.replace(/[;:()\[\]{}"\/\\<>|~`^_*@#\$%&+=–—]/g, " ").replace(/\s{2,}/g, " ").trim();
}

// FINAL strict sanitization - removes ALL special Unicode punctuation
function strictSanitize(s = ""): string {
  // First normalize curly quotes to straight ASCII to prevent "Tree s" issues
  let out = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  return out.replace(/[^\w\s.,!?']/gu, ' ').replace(/\s{2,}/g, ' ').trim();
}
function fixSpacesBeforePunct(s: string) { return s.replace(/\s+([.!?,])/g, "$1"); }
function fixCommaPeriod(s: string) { return s.replace(/,\s*([.!?])/g, "$1"); }
function fixDoubleCommas(s: string) { 
  return s.replace(/,\s*,+/g, ",").replace(/^([^,]+),\s+([A-Z])/g, "$1. $2"); 
}
function fixVocativeComma(s: string, name?: string): string {
  if (!name) return s;
  // Only fix "Jesse, is/was/will" patterns - never touch "Jesse, their/his/her"
  return s.replace(new RegExp(`\\b${escapeRE(name)},\\s+(is|was|were|will|looks|turns|acts|got|has|had)\\b`, 'gi'), `${name} $1`);
}
function isCompleteSentence(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 10) return false; // Too short to be a real sentence
  // Must have a verb indicator and end with proper punctuation
  const hasVerb = /\b(is|are|was|were|has|have|had|do|does|did|can|could|will|would|should|'s|'re|'ve|'d|'ll|got|get|make|made|need|turn|age|give|take|look)\b/i.test(trimmed);
  const endsProper = /[.!?]$/.test(trimmed);
  const hasWords = trimmed.split(/\s+/).length >= 4;
  return hasVerb && endsProper && hasWords;
}
function escapeRE(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }


function toFour(lines: string[], fallback: string): string[] {
  let L = lines.map(trimLine).filter(Boolean);
  if (L.length > 4) L = L.slice(0, 4);
  while (L.length < 4) L.push(fallback);
  return L;
}

// ---------- Insert Intelligence (Single-Word System) ----------
type InsertKind = "name" | "adjective" | "verb" | "noun";

function classifyWord(word: string): string {
  const normalized = word.toLowerCase();
  
  // Check if it's a name (capitalized)
  if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
    return "person's name - use as subject";
  }
  
  // Check for adjectives (common patterns)
  if (normalized.endsWith('y') || normalized.endsWith('ful') || 
      normalized.endsWith('less') || normalized.endsWith('ous') ||
      normalized.endsWith('ive') || normalized.endsWith('able') ||
      TRAIT_WORDS.has(normalized)) {
    return "adjective - describes something";
  }
  
  // Check for verbs (common patterns)
  if (normalized.endsWith('ing') || normalized.endsWith('ed')) {
    return "verb/action";
  }
  
  // Default to noun
  return "noun - main subject/object";
}

function classifyInserts(words: string[]) {
  const names: string[] = [];
  const traits: string[] = [];
  const others: string[] = [];
  for (const raw of (words || [])) {
    const w = (raw || "").trim();
    if (!w) continue;
    // Use old logic for backward compatibility in other functions
    if (/^[A-Z]/.test(w)) names.push(w);
    else if (TRAIT_WORDS.has(w.toLowerCase())) traits.push(w);
    else others.push(w);
  }
  return { names, traits, others };
}

// Simple check - does the line have the insert word?
function hasInsertWord(line: string, word: string): boolean {
  if (!word) return true;
  const base = new RegExp(`\\b${escapeRE(word)}\\b`, "i");
  const poss = new RegExp(`\\b${escapeRE(word)}'s\\b`, "i");
  return base.test(line) || poss.test(line);
}

// Gentle trait polish
function polishTraits(line: string, traits: string[], names: string[]): string {
  let s = line;
  const name = names[0] || "";
  for (const t of traits) {
    if (name) {
      s = s.replace(new RegExp(`\\bhappy\\s+${escapeRE(t)}\\s+birthday\\b`, "i"),
                    `Happy birthday, ${name}, proudly ${t} and thriving`);
      s = s.replace(new RegExp(`\\b${escapeRE(name)}\\s+${escapeRE(t)}\\b`, "i"),
                    `${name}, proudly ${t},`);
    } else {
      s = s.replace(new RegExp(`\\b${escapeRE(t)}\\b`, "i"), `proudly ${t}`);
    }
    s = s.replace(new RegExp(`\\b${escapeRE(t)}\\s+(worry|fear)\\b`, "i"), `$1`);
  }
  return s.replace(/,\s*,/g, ", ").trim();
}

// ---------- Humor control (light) ----------
type HumorMode = "high" | "med" | "soft";
function humorModeForTone(tone?: string): HumorMode {
  const t = (tone || "").toLowerCase();
  if (t === "savage" || t === "humorous" || t === "playful" || t === "inspirational") return "high";
  if (t === "serious") return "soft";
  return "med";
}

// ---------- Swear Word Variety Pool ----------
const R_SWEARS = ["fuck", "fucking", "fucked", "shit", "shitty", "damn", "hell"];
function pickRandomSwear(): string {
  return R_SWEARS[Math.floor(Math.random() * R_SWEARS.length)];
}

// ---------- Rating normalization & cut-off handling ----------
function ensureOneStrongSwearR(s: string, nameHint?: string): string {
  let out = s
    .replace(/\bf\*\*k(ing|er|ed|s)?\b/gi, "fuck$1")
    .replace(/\bs\*\*t(ting|ty|face(?:d)?|s|ted)?\b/gi, "shit$1")
    .replace(/\bbull\*\*t\b/gi, "bullshit")
    .replace(/\bf\s*k(ing|er|ed|s)?\b/gi, "fuck$1")
    .replace(/\bs\s*t(ting|ty|face(?:d)?|s|ted)?\b/gi, "shit$1")
    .replace(/\bbull\s*shit\b/gi, "bullshit");
  
  // Don't force-add swears if line already has strong language
  // This prevents awkward prepending like "fuck His puns..."
  const hasStrongSwear = /\b(fuck|fucking|fucked|shit|shitty|damn|hell|bullshit|ass|bitch|bastard)\b/i.test(out);
  
  if (!hasStrongSwear) {
    // Only add if line is long enough to insert naturally
    const tokens = out.split(' ');
    if (tokens.length > 4) {
      const swear = pickRandomSwear();
      // Insert in middle, not at beginning
      tokens.splice(Math.floor(tokens.length / 2), 0, swear);
      out = tokens.join(' ');
    }
    // If too short, don't force it
  }
  
  // Keep only ONE swear (but preserve which one was used)
  let kept = false;
  out = out.replace(/\b(fuck(?:ing|ed)?|shit(?:ty)?|damn|hell|bullshit)\b/gi,
    m => kept ? "" : ((kept = true), m)).replace(/\s{2,}/g," ").trim();
  
  return out;
}

function normalizeByRating(s: string, rating: string, nameHint?: string): string {
  let out = s;
  const r = (rating || "G").toUpperCase();

  if (r === "R") {
    out = out.replace(/\bgod[-\s]?damn(ed|ing)?\b/gi, "damn");
    return ensureOneStrongSwearR(out, nameHint);
  }

  if (r === "PG-13") {
    out = out
      .replace(/\bgod[-\s]?damn(ed|ing)?\b/gi, "")
      .replace(/\bfuck(?:ing|er|ed|s)?\b/gi, "")
      .replace(/\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi, "")
      .replace(/\bbullshit\b/gi, "");
    return out.replace(/\s{2,}/g, " ").trim();
  }

  if (r === "PG") {
    out = out
      .replace(/\bfuck(?:ing|er|ed|s)?\b/gi, "heck")
      .replace(/\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi, "mess")
      .replace(/\bbullshit\b/gi, "nonsense")
      .replace(/\b(bastard|asshole|prick|dick|douche|crap)\b/gi, "");
    return out.replace(/\s{2,}/g, " ").trim();
  }

  // G
  out = out
    .replace(/\bfuck(?:ing|er|ed|s)?\b/gi, "")
    .replace(/\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi, "")
    .replace(/\bbullshit\b/gi, "")
    .replace(/\b(hell|damn|bastard|asshole|prick|dick|douche|crap)\b/gi, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

// --- Cut-off detection & quick button ---
const TRAIL_WORD = /\b(and|but|so|because|though|although|however|you're|you|kinda|honestly|literally|actually|anyway)\s*$/i;
const TRAIL_PUNCT = /[,;:]$/;
const ELLIPSIS = /\.{3,}\s*$/;

const BUTTONS: Record<"PG"|"PG-13"|"R", string[]> = {
  PG:     ["deal?", "no pressure.", "we're proud of you.", "big win today."],
  "PG-13":["what the hell.", "damn right.", "**** yeah.", "own it."],
  R:      ["you glorious menace.", "now blow the candles.", "legend behavior.", "party, fucker."]
};

function seemsCutOff(s: string): boolean {
  return ELLIPSIS.test(s) || TRAIL_PUNCT.test(s) || TRAIL_WORD.test(s) || !/[.!?]$/.test(s);
}
function finishWithButton(s: string, rating: string): string {
  const tier = (rating.toUpperCase() as "PG"|"PG-13"|"R");
  const tag = (BUTTONS[tier] || BUTTONS["PG"])[Math.floor(Math.random()* (BUTTONS[tier] || BUTTONS["PG"]).length)];
  let out = s.replace(ELLIPSIS, "").replace(TRAIL_PUNCT, "").replace(TRAIL_WORD, "").trim();
  if (out.endsWith(",")) out = out.slice(0, -1).trim();
  out = out.replace(/\s{2,}/g, " ");
  return out + (out.endsWith(",") ? " " : ", ") + tag;
}

// Trust AI for natural flow - minimal post-processing only

// ---------- Server ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload: GeneratePayload = await req.json();
    let { category, subcategory, theme, tone = "humorous", rating = "G", insertWords = [], gender = "neutral" } = payload;
    
    // SAFE PARSING: Handle legacy format "category > subcategory"
    if (category && category.includes('>') && !subcategory) {
      const parts = category.split('>').map(p => p.trim());
      category = parts[0];
      subcategory = parts[1] || subcategory;
    }

    // ========== VALIDATE INSERT WORDS (SINGLE-WORD SYSTEM) ==========
    if (insertWords && insertWords.length > 0) {
      // Max 2 words
      if (insertWords.length > 2) {
        return new Response(
          JSON.stringify({ error: "Maximum 2 insert words allowed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Each word must be single (no spaces, hyphens allowed)
      const hasSpaces = insertWords.some(word => word.includes(' '));
      if (hasSpaces) {
        return new Response(
          JSON.stringify({ error: "Each insert word must be a single word (no spaces). Use hyphens for compound words." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Max 20 chars per word
      const tooLong = insertWords.some(word => word.length > 20);
      if (tooLong) {
        return new Response(
          JSON.stringify({ error: "Each insert word must be 20 characters or less" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Max 50 chars total
      const totalChars = insertWords.join('').length;
      if (totalChars > 50) {
        return new Response(
          JSON.stringify({ error: "Total characters across all words cannot exceed 50" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // SANITIZE all context strings to prevent symbol echoing
    category = strictSanitize(category || "");
    subcategory = strictSanitize(subcategory || "");
    theme = strictSanitize(theme || "");
    
    // Route minimal system rules
    const cat = category.toLowerCase().trim();
    let systemPrompt = general_text_rules;
    if (cat === "celebrations") systemPrompt = celebration_text_rules;
    else if (cat === "jokes") systemPrompt = joke_text_rules;
    else if (cat === "daily-life" || cat === "daily life") systemPrompt = daily_life_text_rules;
    else if (cat === "sports") systemPrompt = sports_text_rules;
    else if (cat === "pop-culture" || cat === "pop culture") systemPrompt = pop_culture_text_rules;
    else if (cat === "miscellaneous") systemPrompt = miscellaneous_text_rules;
    else if (cat === "custom" || cat === "custom-design") systemPrompt = custom_design_text_rules;

    // Tags
    const toneTag   = TONE_TAGS[(tone || "").toLowerCase()] || "funny, witty, light";
    const ratingTag = RATING_TAGS[(rating || "").toUpperCase()] || "follow content rating appropriately";
    const humorMode = humorModeForTone(tone);
    const leaf = (theme || subcategory || "").trim() || "the selected theme";
    const R = (rating || "G").toUpperCase();

    // Deduplicate lines (case-insensitive, normalized)
    function deduplicateLines(lines: string[]): string[] {
      const seen = new Set<string>();
      return lines.filter(line => {
        const normalized = line.toLowerCase().trim().replace(/[^\w\s]/g, '');
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
    }

    // Universal fallback generator
    function generateContextualFallback(
      insertWords: string[], 
      topic: string, 
      tone: string, 
      rating: string
    ): string[] {
      const allWords = insertWords.join(" and ");
      const R = rating.toUpperCase();
      const isHumorous = tone.toLowerCase().includes("humor");
      
      // Generic templates that work for ANY topic
      const fallbacks = [];
      if (R === "R" && isHumorous) {
        fallbacks.push(
          `${allWords} and ${topic}, what a fucking combination.`,
          `${topic} just got real with ${allWords}.`,
          `${allWords} making ${topic} legendary as hell.`,
          `This ${topic} moment with ${allWords}? Absolutely brilliant.`
        );
      } else if (R === "PG-13" && isHumorous) {
        fallbacks.push(
          `${allWords} and ${topic}, what a combo!`,
          `${topic} just got interesting with ${allWords}.`,
          `${allWords} making ${topic} unforgettable.`,
          `This ${topic} moment with ${allWords}? Pretty awesome.`
        );
      } else {
        // Safe G/PG fallback
        fallbacks.push(
          `${allWords} and ${topic}, a perfect match.`,
          `${topic} celebrating ${allWords} today.`,
          `${allWords} making this ${topic} special.`,
          `${topic} moments with ${allWords} are the best.`
        );
      }
      
      // Sanitize all fallbacks before returning
      return fallbacks.map(line => sanitizePunct(line));
    }

    // Insert intelligence
    const { names, traits, others } = classifyInserts(insertWords || []);
    const name = names[0] || "";

    // ========== UNIVERSAL CONTEXT BUILDER ==========
    function buildContextPrompt(category: string, subcategory: string, theme: string): string {
      const cat = category.toLowerCase().trim();
      const sub = subcategory.toLowerCase().trim();
      const thm = theme.toLowerCase().trim();
      
      // The actual topic (most specific available)
      const topic = thm || sub || cat;
      
      // Build hierarchical context
      let context = `📍 CONTEXT:\n`;
      context += `   Category: ${category}\n`;
      if (subcategory) context += `   Subcategory: ${subcategory}\n`;
      if (theme) context += `   Specific Theme: ${theme}\n`;
      
      // Add universal on-topic instruction
      context += `\n🎯 PRIMARY GOAL: Every line must be directly about "${topic}".\n`;
      context += `   Lines that don't relate to "${topic}" are complete failures.\n`;
      
      return context;
    }

    // Build universal context
    const contextPrompt = buildContextPrompt(category, subcategory || "", theme || "");

    // ========== SMART CONTEXT-AWARE INSERT INSTRUCTION ==========
    let insertInstruction = "";
    if (insertWords.length > 0) {
      insertInstruction = "\n📝 REQUIRED WORDS (must appear in every line):\n";
      
      insertWords.forEach((word, index) => {
        const classification = classifyWord(word);
        insertInstruction += `   • "${word}" (${classification})\n`;
      });
      
      const topic = (theme || subcategory || category).toLowerCase().trim();
      
      if (insertWords.length === 2) {
        insertInstruction += `\n✅ Weave "${insertWords[0]}" and "${insertWords[1]}" naturally into ${topic}-related humor.\n`;
        insertInstruction += `❌ Don't create random scenarios. Keep the ${topic} theme central.\n`;
      } else {
        insertInstruction += `\n✅ Integrate "${insertWords[0]}" naturally into ${topic}-related content.\n`;
        insertInstruction += `❌ Don't stray from the ${topic} theme.\n`;
      }
    }
    
    // BIRTHDAY VOCABULARY ENFORCEMENT
    const isBirthday = theme?.toLowerCase().includes('birthday') || 
                       subcategory?.toLowerCase().includes('birthday');
    const birthdayRequirement = isBirthday ? `
🎂 BIRTHDAY REQUIREMENT (CRITICAL):
EVERY line MUST explicitly include birthday vocabulary: "Happy Birthday", "birthday", "B-day", "born", or "another year"
❌ FORBIDDEN: indirect references like "trip around the sun", "special day", "celebrating you"
✅ REQUIRED: clear birthday language that leaves NO DOUBT this is a birthday card
` : '';
    
    // JOKE FORMAT ENFORCEMENT
    const isJokeCategory = cat === "jokes";
    let jokeFormatRequirement = '';
    const forbiddenMetaWords: string[] = [];
    
    if (isJokeCategory) {
      const formatMap: Record<string, string> = {
        'dad-jokes': 'Dad Jokes (Why did/What do you call/How does)',
        'knock-knock-jokes': 'Knock-Knock format',
        'yo-mama-jokes': 'Yo Mama so [adjective]',
        'walks-into-a-bar': '[Thing] walks into a bar',
        'light-bulb-jokes': 'How many [type] to change a light bulb',
        'riddles': 'What/Why [question]? [Answer]',
        'puns': 'Direct wordplay puns',
        'one-liners': 'Setup-punchline one-liners'
      };
      
      const format = formatMap[subcategory] || 'standard joke format';
      
      // Build comprehensive forbidden words list
      forbiddenMetaWords.push(
        'joke', 'jokes', 'joking', 'joked',
        'pun', 'puns', 'punny', 'punning',
        'one-liner', 'one-liners',
        'riddle', 'riddles',
        'dad joke', 'dad jokes',
        'knock-knock',
        'category', 'format', 'template',
        'wordplay', 'linguistic', 'language',
        'punchline', 'setup', 'delivery',
        'comedian', 'comic', 'stand-up', 'gag', 'bit', 'skit',
        'Riddle:', 'Answer:', 'Q:', 'A:'
      );
      
      // Add puns semantic booster
      let punsBooster = '';
      if (subcategory === 'puns' && insertWords.length > 0) {
        punsBooster = `

🎯 PUNS SEMANTIC REQUIREMENT (HIDDEN - DO NOT OUTPUT):
First, silently brainstorm 6-10 associations/homophones/idioms for the insert word, then use them:
• Tree → branch, root, bark, leaf, trunk, wood, rings, timber
• Dog → bark, paws, tail, fetch, bone, leash, howl, treat, ruff
• Clock → hands, face, tick, time, second, alarm, wind

ASSUMPTION: If the insert word is capitalized but NOT a common first name, treat it as a noun (the thing itself).

Example: "Tree" → make puns about tree parts/actions: "Leaf me alone", "I'm rooting for you", "Barking up the wrong tree"
Example: "Dog" → make puns about dog features: "Paws and reflect", "Fetch me later", "Tail of success"

DO NOT output meta-commentary about puns. Just write the puns directly.`;
      }

      jokeFormatRequirement = `
🚨 JOKE FORMAT REQUIREMENT (CRITICAL):
Generate ACTUAL ${format}, NOT meta-commentary about jokes!

NEVER use these words/phrases in any line:
${forbiddenMetaWords.map(w => `• ${w}`).join('\n')}

❌ FORBIDDEN: "${insertWords[0] || 'Person'}'s jokes are so...", "They tell jokes that...", "His puns are terrible"
✅ REQUIRED: Proper formatted jokes that can be told as standalone jokes
${subcategory ? `Use the ${format} structure for all lines.` : ''}
${punsBooster}`;
    }
    
    let userPrompt = `${systemPrompt}

${contextPrompt}
${insertInstruction}
${birthdayRequirement}
${jokeFormatRequirement}

⚠️ DO NOT INVENT SPECIFIC DETAILS:
• If no age is mentioned, don't make one up (no "turning 40", "30 years old", etc.)
• If no date/time is given, don't invent one ("next Tuesday", "last summer", etc.)
• If no location is mentioned, don't add one ("in Vegas", "at the office", etc.)
• Stick to what's actually provided in the context and insert words

📝 PUNCTUATION RULES:
• NEVER use symbols: no >, <, |, /, \\, #, @
• NEVER use em dashes (—) or en dashes (–)
• ONLY use plain punctuation: periods, commas, exclamation marks, question marks, apostrophes
• Keep it simple and clean

🚫 FORBIDDEN TOPICS (even at R-rating):
• Suicide, self-harm, terminal illness, cancer, death threats, sexual abuse, addiction, mental health crises

TONE: ${toneTag}
RATING: ${ratingTag}
${gender !== 'neutral' ? `GENDER: ${gender === 'male' ? 'he/him/his' : 'she/her/hers'}` : ''}

Write 8 one-liners (≤${MAX_LEN} chars each) that are about "${leaf}". No labels, just lines:`;

    // Call model
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]}],
          generationConfig: { temperature: 0.85, maxOutputTokens: 500 }
        })
      }
    );

    if (!res.ok) {
      const t = await res.text();
      console.error("Gemini error:", res.status, t);
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("Raw Gemini response:", raw);

    // Parse lines - basic split and filter
    let lines = raw
      .split("\n")
      .map(trimLine)
      .filter(l => l && !/^\s*(?:tone|rating|insert|options?|line|\d+[.)])\s*/i.test(l))
      .filter(l => l.length <= MAX_LEN && isCompleteSentence(l));

    console.log("After split and filter:", lines);

    if (lines.length === 0) {
      throw new Error("No valid lines from Gemini");
    }

    // Minimal post-processing - trust the AI
    lines = lines.map(l => {
      let out = trimLine(l);
      out = fixSpacesBeforePunct(out);
      out = fixVocativeComma(out, name);
      out = fixDoubleCommas(out);
      out = fixCommaPeriod(out);
      out = sanitizePunct(out);
      out = capLenSmart(out, MAX_LEN);
      out = endPunct(out);
      // FINAL PASS: Remove ALL special Unicode punctuation
      out = strictSanitize(out);
      return out;
    });

    // CRITICAL VALIDATION: Check if ALL insert words appear in EVERY line
    if (insertWords.length > 0) {
      const allLinesValid = lines.every(line => 
        insertWords.every(word => hasInsertWord(line, word))
      );
      
      if (!allLinesValid) {
        console.warn(`⚠️ AI failed to include ALL insert words in all lines.`);
        console.warn("Required words:", insertWords);
        console.warn("Lines received:", lines);
        console.warn("Using universal contextual fallback.");
        
        const topic = (theme || subcategory || category).toLowerCase().trim();
        lines = generateContextualFallback(insertWords, topic, tone, R);
      }
    }

    // Filter out meta-language for jokes
    if (isJokeCategory && forbiddenMetaWords.length > 0) {
      const metaRegex = new RegExp(forbiddenMetaWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
      const beforeFilter = lines.length;
      lines = lines.filter(ln => !metaRegex.test(ln));
      
      if (lines.length < 2 && beforeFilter > 0) {
        console.warn('⚠️ Meta-language filter removed too many lines, using fallback');
        const topic = (theme || subcategory || category).toLowerCase().trim();
        lines = generateContextualFallback(insertWords, topic, tone, R);
      }
    }

    // Apply rating normalization
    lines = lines.map(l => normalizeByRating(l, R, name));

    // Finish cut-offs if needed
    lines = lines.map(l => seemsCutOff(l) ? finishWithButton(l, R) : l);

    // Fix template artifacts
    function fixTemplateArtifacts(s: string, nm?: string) {
      if (!nm) return s;
      return s.replace(/\bName's\b/g, `${nm}'s`).replace(/\bName\b/g, nm);
    }
    lines = lines.map(l => fixTemplateArtifacts(l, name));

    // Apply deduplication
    lines = deduplicateLines(lines);

    // Take best 4 lines. Only use contextual fallback if needed.
    if (lines.length >= 4) {
      lines = lines.slice(0, 4);
    } else if (lines.length > 0) {
      // We have some good lines, just need to pad
      const topic = (theme || subcategory || category).toLowerCase().trim();
      const fallbacks = generateContextualFallback(
        insertWords.length > 0 ? insertWords : [name || ""], 
        topic, 
        tone, 
        R
      );
      
      // Add fallbacks to reach 4, ensuring no duplicates
      for (const fallback of fallbacks) {
        if (lines.length >= 4) break;
        const normalized = fallback.toLowerCase().trim().replace(/[^\w\s]/g, '');
        const isDuplicate = lines.some(line => 
          line.toLowerCase().trim().replace(/[^\w\s]/g, '') === normalized
        );
        if (!isDuplicate) {
          lines.push(fallback);
        }
      }
      
      // Final safety fallback
      while (lines.length < 4) {
        lines.push(`Celebrating this special moment.`);
      }
      
      lines = lines.slice(0, 4);
    } else {
      // No valid lines at all - use all contextual fallbacks
      const topic = (theme || subcategory || category).toLowerCase().trim();
      lines = generateContextualFallback(
        insertWords.length > 0 ? insertWords : [name || ""], 
        topic, 
        tone, 
        R
      );
    }
    
    // FINAL SANITIZATION - ensure no symbols escaped
    lines = lines.map(line => strictSanitize(line));
    
    console.log("✅ Final lines:", lines);

    return new Response(JSON.stringify({
      options: lines,
      debug: { toneTag, ratingTag, humorMode, names, traits, others }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("generate-text error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
