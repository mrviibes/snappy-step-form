import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ===================== SYSTEM RULES =====================
export const text_rules = `SYSTEM INSTRUCTIONS — SHORT ONE-LINERS

GOAL
- Generate 4 distinct humorous one-liners.

HARD CONSTRAINTS
- Exact spelling. Insert words must appear exactly as written in every line.
- Insert words must vary position across the 4 outputs (start, middle, end).
- Length 50–90 characters per line, no fewer, no more.
- One sentence only. Max 1 punctuation mark total (. , ? !).
- No greetings (e.g., "Happy birthday,"). No emojis.
- No em dashes, colons, semicolons. Replace with commas or end the sentence.
- No filler phrases: finally, trust me, here's to, may your, another year of.
- Avoid padding with "that/which" unless essential.
- No duplicate word pairs across the 4 outputs.
- Apply selected Tone and Rating precisely.

TONES
- Humorous → witty wordplay and exaggeration.
- Savage → blunt roast, no soft language.
- Sentimental → warm and affectionate, even if raw.
- Nostalgic → references to past; avoid modern slang.
- Romantic → affectionate and playful, no meanness.
- Inspirational → uplifting, no negativity or irony.
- Playful → cheeky and silly, not formal.
- Serious → dry, deadpan wit, formal.

RATINGS
- G → no profanity or adult refs.
- PG → censored swears allowed (f***, sh*t), no uncensored profanity.
- PG-13 → only "hell", "damn"; nothing stronger.
- R (Raw, Unfiltered) →
  - Must include uncensored profanity in every line.
  - Profanity must vary across the 4 outputs.
  - Profanity is not limited to a fixed list; any strong language that fits tone.
  - Can be savage roast or celebratory hype.
  - Sentimental + R must combine warmth/affection with raw profanity.
  - Avoid only extreme violence or illegal themes.`;

// ===================== MODEL PICKER =====================
const getTextModel = () => Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o-mini";
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

// ===================== CORS =====================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===================== RULES CACHE/LOADER =====================
let cachedRules: any = null;

async function loadRules(rulesId: string, origin?: string): Promise<any> {
  if (cachedRules && cachedRules.id === rulesId) return cachedRules;

  // Try loading from caller origin (/public/config/<rulesId>.json)
  if (origin) {
    try {
      const rulesUrl = `${origin}/config/${rulesId}.json`;
      const response = await fetch(rulesUrl);
      if (response.ok) {
        cachedRules = await response.json();
        return cachedRules;
      }
    } catch (_e) {/* ignore, fallback below */}
  }

  // Fallback embedded rules (v5)
  cachedRules = {
    id: rulesId,
    version: 5,
    length: { min_chars: 50, max_chars: 90 },
    punctuation: {
      ban_em_dash: true,
      replacement: { "—": "," },
      allowed: [".", ",", "?", "!"],
      max_marks_per_line: 1
    },
    tones: {
      "Humorous": { rules: ["witty","wordplay","exaggeration"] },
      "Savage": { rules: ["blunt","cutting","roast_style","no_soft_language"] },
      "Sentimental": { rules: ["warm","affectionate","no_sarcasm"] },
      "Nostalgic": { rules: ["past_refs","no_modern_slang"] },
      "Romantic": { rules: ["affectionate","playful","no_mean"] },
      "Inspirational": { rules: ["uplifting","no_negativity_or_irony"] },
      "Playful": { rules: ["cheeky","silly","no_formal"] },
      "Serious": { rules: ["dry","deadpan","formal_weight"] }
    },
    ratings: {
      "G": { allow_profanity: false, allow_censored_swears: false },
      "PG": { allow_profanity: false, allow_censored_swears: true, censored_forms: ["f***","sh*t"] },
      "PG-13": { allow_profanity: true, mild_only: ["hell","damn"], block_stronger_profanity: true },
      "R": { allow_profanity: true, require_profanity: true, open_profanity: true, require_variation: true }
    },
    spelling: {
      auto_substitutions: { "you’ve":"you have", "you've":"you have" }
    }
  };
  return cachedRules;
}

// ===================== OPENAI CALL =====================
function buildOpenAIRequest(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; maxTokens: number }
) {
  const body: any = { model, messages };
  if (model.startsWith("gpt-5") || model.startsWith("o3") || model.startsWith("o4")) {
    body.max_completion_tokens = options.maxTokens;
  } else {
    body.max_tokens = options.maxTokens;
    if (options.temperature !== undefined) body.temperature = options.temperature;
  }
  return body;
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<{ content: string; model: string }> {
  let model = getTextModel();
  let maxTokens = model.startsWith("gpt-5") ? 4000 : 200;

  try {
    const requestBody = buildOpenAIRequest(
      model,
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      { maxTokens }
    );
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty content");
    return { content, model: data.model || model };
  } catch (_e) {
    // fallback
    model = "gpt-4o-mini";
    maxTokens = 200;
    const requestBody = buildOpenAIRequest(
      model,
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      { maxTokens, temperature: 0.8 }
    );
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty content (fallback)");
    return { content, model };
  }
}

// ===================== PARSING / VALIDATION HELPERS =====================
const STRONG_SWEARS = /(fuck(?:er|ing)?|shit(?:ty)?|bastard|ass(?!ert)|arse|bullshit|goddamn|damn|prick|dick|cock|piss|wank|crap|motherfucker|hell)/i;

function countPunc(s: string) { return (s.match(/[.,?!]/g) || []).length; }
function oneSentence(s: string) { return !/[.?!].+?[.?!]/.test(s); }

function trimToRange(s: string, min=50, max=90) {
  let out = s.trim().replace(/\s+/g, " ");
  // remove filler phrases
  out = out.replace(/\b(finally|trust me|here'?s to|may your|another year of)\b/gi, "").replace(/\s+/g, " ").trim();
  // if still long, keep first clause before comma
  if (out.length > max && out.includes(",")) out = out.split(",")[0];
  // hard clip if needed
  if (out.length > max) out = out.slice(0, max).trim();
  return out;
}

function bigramSet(s: string) {
  const words = s.toLowerCase().replace(/[^\w\s']/g,"").split(/\s+/).filter(Boolean);
  const set = new Set<string>();
  for (let i=0;i<words.length-1;i++) set.add(words[i]+" "+words[i+1]);
  return set;
}

function varyInsertPositions(lines: string[], insert: string) {
  const lower = insert.toLowerCase();
  const allStart = lines.every(l => l.trim().toLowerCase().startsWith(lower));
  if (!allStart) return lines;
  return lines.map((l, i) => {
    if (i % 2 === 0) return l.replace(new RegExp(`^${insert}\\s*,?\\s*`, "i"), "").trim() + `, ${insert}`;
    return l.replace(new RegExp(`^${insert}\\s*,?\\s*`, "i"), `${insert} `);
  });
}

function ensureProfanityVariation(lines: string[]) {
  const grabs = lines.map(l => (l.match(STRONG_SWEARS) || [""])[0].toLowerCase());
  const seen = new Set<string>();
  return lines.map((l, i) => {
    const sw = grabs[i];
    if (sw && !seen.has(sw)) { seen.add(sw); return l; }
    const pool = ["fuck","shit","bastard","ass","bullshit","goddamn","prick","crap","motherfucker","hell"];
    for (const w of pool) {
      if (!seen.has(w) && !new RegExp(`\\b${w}\\b`, "i").test(l)) {
        const replaced = sw ? l.replace(new RegExp(sw, "i"), w) : `${l.split(/[.,?!]/)[0]}, ${w}.`;
        seen.add(w);
        return replaced;
      }
    }
    return l;
  });
}

// ===================== CLEAN / PARSE =====================
function cleanLine(rawText: string): string {
  let t = rawText.trim();
  t = t.replace(/^\s*[\d\-\*•]+[.)-]?\s*/, "");
  t = t.replace(/^["'`]/, "").replace(/["'`]$/, "");
  t = t.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/`(.*?)`/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function parseLines(rawResponse: string): string[] {
  const candidates = rawResponse.split(/\r?\n+/)
    .map(s => s.replace(/^\s*[\d\-\*•.]+\s*/, "").trim())
    .filter(Boolean);

  const lines = candidates.filter(s =>
    s.length >= 40 && s.length <= 140 && oneSentence(s)
  );

  return lines.map(cleanLine);
}

// ===================== ENFORCEMENT =====================
function enforceRules(
  lines: string[],
  rules: any,
  rating: string,
  insertWords: string[] = []
): { lines: string[]; enforcement: string[] } {
  const enforcement: string[] = [];
  const minLen = rules.length?.min_chars ?? 50;
  const maxLen = rules.length?.max_chars ?? 90;

  let processed = lines.map((raw, idx) => {
    let t = raw.trim();

    // punctuation normalization and limit to 1
    if (rules.punctuation?.ban_em_dash) t = t.replace(/—/g, rules.punctuation.replacement?.["—"] || ",");
    t = t.replace(/[:;…]/g, ",").replace(/[“”"']/g, "");
    if (countPunc(t) > (rules.punctuation?.max_marks_per_line ?? 1)) {
      let kept = 0;
      t = t.replace(/[.,?!]/g, (m) => (++kept <= 1 ? m : ""));
      enforcement.push(`Line ${idx+1}: limited punctuation to 1`);
    }

    // keep as one sentence
    if (!oneSentence(t)) {
      const first = t.split(/[.?!]/)[0].trim();
      t = first + (/[.,?!]$/.test(first) ? "" : ".");
      enforcement.push(`Line ${idx+1}: trimmed to one sentence`);
    }

    // compress/trim to range
    const before = t.length;
    t = trimToRange(t, minLen, maxLen);
    if (t.length !== before) enforcement.push(`Line ${idx+1}: compressed to ${t.length} chars`);

    // ensure insert words present
    for (const w of insertWords) {
      if (!new RegExp(`\\b${w}\\b`, "i").test(t)) {
        t = `${t.split(/[.,?!]/)[0]}, ${w}.`;
        enforcement.push(`Line ${idx+1}: appended insert word '${w}'`);
        break;
      }
    }

    return t;
  });

  // vary insert word positions if a single insert
  if (insertWords?.length === 1) {
    const varied = varyInsertPositions(processed, insertWords[0]);
    if (varied.join("|") !== processed.join("|")) enforcement.push("Varied insert word positions across outputs");
    processed = varied;
  }

  // profanity per rating
  if (rating === "R") {
    processed = processed.map((t, i) => {
      if (!STRONG_SWEARS.test(t)) {
        t = `${t.split(/[.,?!]/)[0]} fuck.`;
        enforcement.push(`Line ${i+1}: injected profanity for R`);
      }
      return t;
    });
    const varied = ensureProfanityVariation(processed);
    if (varied.join("|") !== processed.join("|")) enforcement.push("Varied profanity across R outputs");
    processed = varied;
  }

  if (rating === "PG-13") {
    processed = processed.map((t, i) => {
      const cleaned = t.replace(/(fuck(?:er|ing)?|shit(?:ty)?|bastard|ass(?!ert)|arse|bullshit|prick|dick|cock|piss|wank|crap|motherfucker|goddamn)/gi, "damn");
      if (cleaned !== t) enforcement.push(`Line ${i+1}: downgraded strong profanity to mild`);
      return cleaned;
    });
  }

  if (rating === "PG") {
    processed = processed.map((t, i) => {
      const cleaned = t.replace(STRONG_SWEARS, "sh*t");
      if (cleaned !== t) enforcement.push(`Line ${i+1}: censored to PG`);
      return cleaned;
    });
  }

  if (rating === "G") {
    processed = processed.map((t, i) => {
      const cleaned = t.replace(STRONG_SWEARS, "").replace(/\s+/g, " ").trim();
      if (cleaned !== t) enforcement.push(`Line ${i+1}: removed profanity for G`);
      return cleaned;
    });
  }

  // de-duplicate near copies via bigrams
  const unique: string[] = [];
  const seenPairs = new Set<string>();
  for (const l of processed) {
    const pairs = bigramSet(l);
    let clash = false;
    for (const p of pairs) {
      if (seenPairs.has(p)) { clash = true; break; }
    }
    if (!clash) {
      for (const p of pairs) seenPairs.add(p);
      unique.push(l);
    }
  }
  return { lines: unique, enforcement };
}

// ===================== HTTP HANDLER =====================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { category, subcategory, tone, rating, insertWords = [], rules_id } = payload;

    const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0,3).join("/");
    const rules = rules_id ? await loadRules(rules_id, origin) : null;

    let systemPrompt = text_rules;
    if (category)    systemPrompt += `\n\nCONTEXT: ${category}`;
    if (subcategory) systemPrompt += ` > ${subcategory}`;
    if (tone)        systemPrompt += `\nTONE: ${tone}`;
    if (rating)      systemPrompt += `\nRATING: ${rating}`;
    if (insertWords.length) systemPrompt += `\nINSERT WORDS: ${insertWords.join(", ")}`;
    systemPrompt += `\n\nReturn exactly 4 sentences, one per line.`;

    const userPrompt = "Generate 12 candidate one-liners first. Then return 4 that best satisfy all constraints.";

    const { content: rawResponse, model: usedModel } = await callOpenAI(systemPrompt, userPrompt);

    // Parse raw → candidate lines
    let candidates = parseLines(rawResponse);
    // If too few, keep raw splitting as backup
    if (candidates.length < 4) {
      candidates = rawResponse.split(/\r?\n+/).map(cleanLine).filter(Boolean);
    }

    // Enforce rules
    const enforced = enforceRules(candidates, rules ?? { length:{min_chars:50,max_chars:90}, punctuation:{max_marks_per_line:1,ban_em_dash:true,replacement:{"—":","}} }, rating || "PG-13", insertWords);
    let lines = enforced.lines.slice(0, 4);

    // Final validity flagging
    const minLength = rules?.length?.min_chars ?? 50;
    const maxLength = rules?.length?.max_chars ?? 90;

    const response = {
      lines: lines.map((line, i) => ({
        line,
        length: line.length,
        index: i + 1,
        valid: line.length >= minLength && line.length <= maxLength && countPunc(line) <= 1 && oneSentence(line)
      })),
      model: usedModel,
      count: lines.length,
      rules_used: rules ? { id: rules.id, version: rules.version } : { id: "fallback", version: 5 },
      enforcement: enforced.enforcement
    };

    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
/*import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { text_rules } from "../_shared/text-rules.ts";




// Get model from environment with fallback - Using GPT-4o-mini for step #2
const getTextModel = () => Deno.env.get('OPENAI_TEXT_MODEL') || 'gpt-4o-mini';

// Rules cache
let cachedRules: any = null;

// Helper function to build OpenAI request body with correct parameters
function buildOpenAIRequest(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; maxTokens: number }
) {
  const body: any = {
    model,
    messages
  };

  // GPT-5 and newer models use max_completion_tokens, older models use max_tokens
  if (model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4')) {
    body.max_completion_tokens = options.maxTokens;
    // These models don't support temperature parameter
  } else {
    body.max_tokens = options.maxTokens;
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
  }

  return body;
}

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Load rules from viibes-rules-v4.json
async function loadRules(rulesId: string, origin?: string): Promise<any> {
  if (cachedRules && cachedRules.id === rulesId) {
    return cachedRules;
  }

  // Try to load from caller origin first
  if (origin) {
    try {
      const rulesUrl = `${origin}/config/${rulesId}.json`;
      console.log(`📋 Loading rules from: ${rulesUrl}`);
      const response = await fetch(rulesUrl);
      if (response.ok) {
        cachedRules = await response.json();
        console.log(`✅ Loaded rules v${cachedRules.version} from origin`);
        return cachedRules;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load rules from origin: ${error}`);
    }
  }

  // Fallback to embedded minimal rules
  console.log('📋 Using fallback embedded rules');
  cachedRules = {
    id: rulesId,
    version: 4,
    length: { min_chars: 50, max_chars: 100 },
    punctuation: {
      ban_em_dash: true,
      replacement: { "—": "," },
      allowed: [".", ",", "?", "!"],
      max_marks_per_line: 2
    },
    tones: {
      "Savage": { rules: ["blunt", "cutting", "roast_style", "no_soft_language"] },
      "Playful": { rules: ["cheeky", "silly", "mischievous", "no_formal"] },
      "Serious": { rules: ["dry", "deadpan", "formal_weight", "no_jokes_except_dry_wit"] }
    },
    ratings: {
      "G": { allow_profanity: false, allow_censored_swears: false, insult_strength: "none" },
      "PG": { allow_profanity: false, allow_censored_swears: true, censored_forms: ["f***", "sh*t", "a**", "b****"], insult_strength: "light_to_medium" },
      "PG-13": { allow_profanity: true, profanity_whitelist: ["hell", "damn"], block_stronger_profanity: true, insult_strength: "medium" },
      "R": { allow_profanity: true, require_profanity: true, profanity_whitelist: ["fuck", "shit", "bastard", "ass", "bullshit", "goddamn"], insult_strength: "heavy" }
    },
    spelling: {
      auto_substitutions: { "you've": "you have" }
    }
  };
  
  return cachedRules;
}

// Build rating-specific profanity instructions
function buildProfanityInstructions(rating: string, rules: any): string {
  const ratingRules = rules.ratings[rating];
  if (!ratingRules) return "";

  switch (rating) {
    case "G":
      return "CRITICAL: NO profanity whatsoever. Keep it completely wholesome.";
    case "PG":
      return `CRITICAL: Only use censored forms if needed: ${ratingRules.censored_forms?.join(', ')}. No uncensored profanity.`;
    case "PG-13":
      return `CRITICAL: Only use these mild words if needed: ${ratingRules.profanity_whitelist?.join(', ')}. Block all stronger profanity.`;
    case "R":
      return `CRITICAL: MUST include at least one of these words: ${ratingRules.profanity_whitelist?.join(', ')}. This is REQUIRED for R rating.`;
    default:
      return "";
  }
}

// Build tone-specific instructions
function buildToneInstructions(tone: string, rules: any): string {
  const toneRules = rules.tones[tone];
  if (!toneRules) return "";

  const ruleDescriptions: { [key: string]: string } = {
    "blunt": "be direct and harsh",
    "cutting": "use sharp, biting language", 
    "roast_style": "mock and criticize mercilessly",
    "no_soft_language": "avoid gentle or polite phrasing",
    "cheeky": "be playfully impudent",
    "silly": "be absurd and ridiculous",
    "mischievous": "be playfully troublesome",
    "no_formal": "avoid formal language",
    "dry": "use understated humor",
    "deadpan": "deliver with serious tone",
    "formal_weight": "use serious, weighty language"
  };

  const instructions = toneRules.rules
    .map((rule: string) => ruleDescriptions[rule] || rule)
    .join(', ');

  return `Tone guidance: ${instructions}.`;
}

// Enforce rules on generated text
function enforceRules(lines: string[], rules: any, rating: string): { lines: string[], enforcement: string[] } {
  const enforcement: string[] = [];
  const ratingRules = rules.ratings[rating];
  const profanityWhitelist = ratingRules?.profanity_whitelist || [];
  const censoredForms = ratingRules?.censored_forms || [];
  
  const processedLines = lines.map((line, index) => {
    let processed = line;
    let lineEnforcement = [];

    // Apply auto substitutions
    if (rules.spelling?.auto_substitutions) {
      for (const [from, to] of Object.entries(rules.spelling.auto_substitutions)) {
        if (processed.includes(from)) {
          processed = processed.replace(new RegExp(from, 'gi'), to as string);
          lineEnforcement.push(`substituted '${from}' -> '${to}'`);
        }
      }
    }

    // Apply punctuation rules
    if (rules.punctuation?.replacement) {
      for (const [from, to] of Object.entries(rules.punctuation.replacement)) {
        if (processed.includes(from)) {
          processed = processed.replace(new RegExp(from, 'g'), to as string);
          lineEnforcement.push(`replaced '${from}' -> '${to}'`);
        }
      }
    }

    // Limit punctuation marks
    if (rules.punctuation?.max_marks_per_line) {
      const punctMarks = processed.match(/[.!?]/g) || [];
      if (punctMarks.length > rules.punctuation.max_marks_per_line) {
        // Keep only the first N punctuation marks
        let count = 0;
        processed = processed.replace(/[.!?]/g, (match) => {
          count++;
          return count <= rules.punctuation.max_marks_per_line ? match : '';
        });
        lineEnforcement.push(`limited punctuation to ${rules.punctuation.max_marks_per_line} marks`);
      }
    }

    // Rating-specific profanity enforcement
    if (rating === "R" && ratingRules?.require_profanity) {
      const hasProfanity = profanityWhitelist.some((word: string) => 
        processed.toLowerCase().includes(word.toLowerCase())
      );
      
      if (!hasProfanity) {
        // Inject mild profanity at the end
        const injectWord = "goddamn";
        processed = processed.replace(/[.!?]?\s*$/, `, ${injectWord} it.`);
        lineEnforcement.push(`injected '${injectWord}' for R rating`);
      }
    }

    // Clean up extra spaces
    processed = processed.replace(/\s+/g, ' ').trim();
    
    if (lineEnforcement.length > 0) {
      enforcement.push(`Line ${index + 1}: ${lineEnforcement.join(', ')}`);
    }

    return processed;
  });

  return { lines: processedLines, enforcement };
}

// Simple text cleanup function
function cleanLine(rawText: string): string {
  let cleaned = rawText.trim();
  
  // Remove numbered list prefixes
  const digits = '0123456789';
  while (cleaned.length > 0 && digits.includes(cleaned[0])) {
    let i = 0;
    while (i < cleaned.length && digits.includes(cleaned[i])) {
      i++;
    }
    if (i < cleaned.length && (cleaned[i] === '.' || cleaned[i] === ')')) {
      cleaned = cleaned.substring(i + 1).trim();
    } else {
      break;
    }
  }
  
  // Remove bullet points
  if (cleaned.startsWith('- ') || cleaned.startsWith('* ') || cleaned.startsWith('+ ')) {
    cleaned = cleaned.substring(2).trim();
  }
  
  // Remove quotes
  if (cleaned.startsWith('"') || cleaned.startsWith("'") || cleaned.startsWith('`')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.endsWith('"') || cleaned.endsWith("'") || cleaned.endsWith('`')) {
    cleaned = cleaned.substring(0, cleaned.length - 1);
  }
  
  // Remove markdown formatting using string replacement
  while (cleaned.includes('**')) {
    cleaned = cleaned.replace('**', '');
  }
  while (cleaned.includes('`')) {
    cleaned = cleaned.replace('`', '');
  }
  
  // Normalize whitespace by splitting and joining
  cleaned = cleaned.split(/\s+/).filter(part => part.length > 0).join(' ');
  
  return cleaned;
}

// Parse lines from AI response
function parseLines(rawResponse: string): string[] {
  let lines = rawResponse.split(/\r?\n/);
  
  // Try other splitting patterns if needed
  if (lines.length < 4) {
    const numberedSplit = rawResponse.split(/(?=\d+[\.\)])/);
    if (numberedSplit.length >= 4) {
      lines = numberedSplit;
    }
  }
  
  const cleanedLines = lines
    .map(line => cleanLine(line))
    .filter(line => line.length >= 35 && line.length <= 140);
  
  return cleanedLines;
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<{ content: string; model: string }> {
  let model = getTextModel();
  console.log(`🤖 Using model: ${model}`);
  
  let maxTokens = model.startsWith('gpt-5') ? 4000 : 200; // Very high limit for GPT-5 reasoning + response
  
  // First attempt with GPT-5
  try {
    const requestBody = buildOpenAIRequest(
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      { maxTokens }
    );
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📡 Response Status:', response.status);
    
    const data = await response.json();
    console.log('📄 Response Data:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('❌ API Error:', data.error);
      throw new Error(`OpenAI API Error: ${data.error.message}`);
    }
    
    const content = data.choices?.[0]?.message?.content;
    const actualModel = data.model || model; // Use actual model from response or fallback to requested model
    
    if (!content || content.trim() === '') {
      console.warn('⚠️ GPT-5 returned empty content - falling back to GPT-4o-mini');
      throw new Error('GPT-5 returned empty content');
    }
    
    return { content, model: actualModel };
    
  } catch (error) {
    // Fallback to GPT-4o-mini if GPT-5 fails
    console.log('🔄 Falling back to GPT-4o-mini due to GPT-5 failure');
    model = 'gpt-4o-mini';
    maxTokens = 200;
    
    const requestBody = buildOpenAIRequest(
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      { maxTokens, temperature: 0.8 }
    );
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📡 Fallback Response Status:', response.status);
    
    const data = await response.json();
    console.log('📄 Fallback Response Data:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('❌ Fallback API Error:', data.error);
      throw new Error(`OpenAI API Error: ${data.error.message}`);
    }
    
    const content = data.choices?.[0]?.message?.content;
    const actualModel = data.model || model;
    
    if (!content || content.trim() === '') {
      throw new Error('Both GPT-5 and fallback model returned empty content');
    }
    
    return { content, model: actualModel };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Text generation request:', JSON.stringify(payload, null, 2));

    const { category, subcategory, tone, rating, insertWords, rules_id } = payload;
    
    // Load rules if provided
    let rules = null;
    if (rules_id) {
      const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/');
      rules = await loadRules(rules_id, origin);
      console.log(`📋 Using rules: ${rules.id} v${rules.version}`);
    }

    // Build comprehensive prompt using the text rules
    let systemPrompt = text_rules;
    
    // Add dynamic context
    if (category) systemPrompt += `\n\nCONTEXT: ${category}`;
    if (subcategory) systemPrompt += ` > ${subcategory}`;
    if (tone) systemPrompt += `\nTONE: ${tone}`;
    if (rating) systemPrompt += `\nRATING: ${rating}`;
    if (insertWords && insertWords.length > 0) {
      systemPrompt += `\nINSERT WORDS: ${insertWords.join(', ')}`;
    }
    
    systemPrompt += `\n\nReturn exactly 4 sentences, one per line.`;

    const userPrompt = "Generate 4 funny sentences now.";

    // Call OpenAI
    const { content: rawResponse, model: usedModel } = await callOpenAI(systemPrompt, userPrompt);
    console.log('🎭 Raw AI Response:', rawResponse);

    // Parse and clean lines
    let lines = parseLines(rawResponse);
    console.log('🧹 Cleaned lines:', lines);

    // Apply rules enforcement if rules are loaded
    let enforcement: string[] = [];
    if (rules && rating) {
      const enforced = enforceRules(lines, rules, rating);
      lines = enforced.lines;
      enforcement = enforced.enforcement;
      if (enforcement.length > 0) {
        console.log('⚖️ Rules enforcement:', enforcement);
      }
    }

    // Take first 4 lines or pad if needed
    const finalLines = lines.slice(0, 4);
    
    if (finalLines.length < 4) {
      console.warn(`⚠️ Only generated ${finalLines.length} lines, expected 4`);
    }

    // Get length constraints for validation
    const minLength = rules?.length?.min_chars || 50;
    const maxLength = rules?.length?.max_chars || 120;

    // Format response with debug info and model information
    const response = {
      lines: finalLines.map((line, index) => ({
        line,
        length: line.length,
        index: index + 1,
        valid: line.length >= minLength && line.length <= maxLength
      })),
      model: usedModel,
      count: finalLines.length,
      rules_used: rules ? { id: rules.id, version: rules.version } : null,
      enforcement: enforcement.length > 0 ? enforcement : undefined
    };

    console.log(`✅ Generated ${response.lines.length} text options using model: ${usedModel}`);
    if (rules) {
      console.log(`📋 Applied rules: ${rules.id} v${rules.version}`);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in generate-text function:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error)?.message || 'Internal server error',
      debug: (error as Error)?.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});*/