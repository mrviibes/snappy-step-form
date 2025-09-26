import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { text_rules } from "../_shared/text-rules.ts";

// ============== MODEL ==============
const getTextModel = () => Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o-mini";
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

// ============== CORS ==============
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============== RULES LOADER ==============
let cachedRules: any = null;
async function loadRules(rulesId: string, origin?: string): Promise<any> {
  if (cachedRules && cachedRules.id === rulesId) return cachedRules;

  if (origin) {
    try {
      const rulesUrl = `${origin}/config/${rulesId}.json`;
      const res = await fetch(rulesUrl);
      if (res.ok) {
        cachedRules = await res.json();
        return cachedRules;
      }
    } catch {}
  }

  // Fallback rules v7 (natural R placement, 60–120 chars, max 3 punctuation)
  cachedRules = {
    id: rulesId || "fallback",
    version: 7,
    length: { min_chars: 60, max_chars: 120 },
    punctuation: { ban_em_dash: true, replacement: { "—": "," }, allowed: [".", ",", "?", "!"], max_marks_per_line: 3 },
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
      "R": {
        allow_profanity: true,
        require_profanity: true,
        open_profanity: true,
        require_variation: true,
        max_swears_per_line: 3 // tune at runtime if desired
      }
    },
    spelling: { auto_substitutions: { "you’ve":"you have", "you've":"you have" } }
  };
  return cachedRules;
}

// ============== OPENAI CALL ==============
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

async function callOpenAI(systemPrompt: string, userPrompt: string) {
  let model = getTextModel();
  let maxTokens = model.startsWith("gpt-5") ? 4000 : 300;

  try {
    const req = buildOpenAIRequest(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { maxTokens });

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(req)
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const content = d.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty content");
    return { content, model: d.model || model };

  } catch {
    model = "gpt-4o-mini";
    maxTokens = 220;

    const req = buildOpenAIRequest(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { maxTokens, temperature: 0.8 });

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(req)
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const content = d.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty content (fallback)");
    return { content, model };
  }
}

// ============== SWEAR VOCAB + UTIL ==============
const SWEAR_WORDS = [
  "fuck","fucking","fucker","motherfucker","shit","shitty","bullshit","asshole","arse","arsehole",
  "bastard","bitch","son of a bitch","damn","goddamn","hell","crap","piss","pissed","dick",
  "dickhead","prick","cock","knob","wanker","tosser","bollocks","bugger","bloody","git",
  "twat","douche","douchebag","jackass","dumbass","dipshit","clusterfuck","shitshow","balls",
  "tits","skank","tramp","slag","screw you","piss off","crapshoot","arsed","bloody hell",
  "rat bastard","shithead"
];
const STRONG_SWEARS = new RegExp(`\\b(${SWEAR_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");

function extractSwears(s: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(STRONG_SWEARS, "gi");
  let m;
  while ((m = re.exec(s)) !== null) out.add(m[0].toLowerCase());
  return [...out];
}

// Better RNG than Math.random for Deno
function rand() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] / 2 ** 32;
}
function choice<T>(arr: T[], weights?: number[]) {
  if (!weights) return arr[Math.floor(rand() * arr.length)];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}

function splitClauses(s: string) { return s.split(/,\s*/).map(c => c.trim()).filter(Boolean); }
function rejoinClauses(clauses: string[]) {
  let out = clauses.join(", ");
  out = out.replace(/[.?!]\s*$/, "") + ".";
  return out.replace(/\s+/g, " ").trim();
}

function parseLines(content: string): string[] {
  // keep flexible, we re-enforce below
  return content.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
}

function countPunc(s: string) { return (s.match(/[.,?!]/g) || []).length; }
function oneSentence(s: string) { return !/[.?!].+?[.?!]/.test(s); }

function trimToRange(s: string, min = 60, max = 120) {
  let out = s.trim().replace(/\s+/g, " ");
  out = out.replace(/\b(finally|trust me|here'?s to|may your|another year of)\b/gi, "").replace(/\s+/g, " ").trim();
  if (out.length > max && out.includes(",")) out = out.split(",")[0];
  if (out.length > max) out = out.slice(0, max).trim();
  return out;
}

function bigramSet(s: string) {
  const words = s.toLowerCase().replace(/[^\w\s']/g,"").split(/\s+/).filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) set.add(words[i] + " " + words[i + 1]);
  return set;
}

function varyInsertPositions(lines: string[], insert: string) {
  const allStart = lines.every(l => l.trim().toLowerCase().startsWith(insert.toLowerCase()));
  if (!allStart) return lines;
  return lines.map((l, i) => i % 2 === 0
    ? l.replace(new RegExp(`^${insert}\\s*,?\\s*`, "i"), "").trim() + `, ${insert}`
    : l.replace(new RegExp(`^${insert}\\s*,?\\s*`, "i"), `${insert} `));
}

function deTagInsert(line: string, insert: string) {
  const tag = new RegExp(`,\\s*${insert}\\.?$`, "i");
  if (tag.test(line) && !new RegExp(`^${insert}\\b`, "i").test(line)) {
    const core = line.replace(tag, "").trim().replace(/\s+/g, " ");
    return `${insert}, ${core}`;
  }
  return line;
}

// natural-looking anchors
const VERBISH = /\b(get|make|feel|want|need|love|hate|hit|go|keep|stay|run|drop|ship|book|call|try|push|fake|score|win|lose|cook|build|haul|dump|clean|move|save|spend|cost|is|are|was|were|do|does|did)\b/i;
const ADJECTIVEISH = /\b(easy|fast|cheap|heavy|light|wild|messy|clean|busy|quick|slow|real|big|small|fresh|free|late|early|crazy|solid|smart|bold|loud|tight)\b/i;
const INTENSIFIERS = /\b(really|very|super|so|pretty|kinda|sort of|sorta)\b/i;

function softTrimToFit(s: string, maxLen: number, maxPunc: number) {
  let puncCount = countPunc(s);
  if (puncCount > maxPunc) {
    let kept = 0;
    s = s.replace(/[.,?!]/g, m => (++kept <= maxPunc ? m : ""));
  }
  if (s.length > maxLen) {
    s = s.slice(0, maxLen).replace(/\s+\S*$/,"").trim();
    if (!/[.?!]$/.test(s)) s += ".";
  }
  return s;
}

function placeNaturalProfanity(
  line: string,
  insertWords: string[],
  rules: any,
  leadSwear: string
) {
  const punctBudget = rules.punctuation?.max_marks_per_line ?? 3;
  const maxLen = rules.length?.max_chars ?? 120;

  const inLine = new Set(extractSwears(line));
  if (inLine.has(leadSwear.toLowerCase())) return line;

  const clauses = splitClauses(line);
  if (!clauses.length) return line;

  const lower = line.toLowerCase();
  const hit = insertWords?.find((w: string) => lower.includes(w.toLowerCase()));
  let idx = clauses.findIndex(c => hit && new RegExp(`\\b${hit}\\b`, "i").test(c));
  if (idx < 0) {
    let maxL = -1;
    clauses.forEach((c, i) => { if (c.length > maxL) { maxL = c.length; idx = i; } });
  }

  let target = clauses[idx];
  const strategies = ["start","preInsert","postInsert","beforeVerbAdj","replaceIntensifier","endPunchline"];
  const weights = [0.15, 0.2, 0.2, 0.25, 0.1, 0.1];
  const strat = choice(strategies, weights);

  const insertRegex = hit ? new RegExp(`\\b${hit}\\b`, "i") : null;
  const glueComma = () => (countPunc(line) < punctBudget ? ", " : " ");

  if (strat === "start") {
    target = `${leadSwear}${glueComma()}${target}`;
  } else if (strat === "preInsert" && insertRegex && insertRegex.test(target)) {
    target = target.replace(insertRegex, m => `${leadSwear}${glueComma()}${m}`);
  } else if (strat === "postInsert" && insertRegex && insertRegex.test(target)) {
    target = target.replace(insertRegex, m => `${m}${glueComma()}${leadSwear}`);
  } else if (strat === "beforeVerbAdj") {
    if (VERBISH.test(target))      target = target.replace(VERBISH,      m => `${leadSwear} ${m}`);
    else if (ADJECTIVEISH.test(target)) target = target.replace(ADJECTIVEISH, m => `${leadSwear} ${m}`);
    else if (insertRegex && insertRegex.test(target)) target = target.replace(insertRegex, m => `${leadSwear}${glueComma()}${m}`);
    else target = `${target}${glueComma()}${leadSwear}`;
  } else if (strat === "replaceIntensifier" && INTENSIFIERS.test(target)) {
    target = target.replace(INTENSIFIERS, leadSwear);
  } else if (strat === "endPunchline") {
    target = `${target}${glueComma()}${leadSwear}`;
  } else {
    // fallback
    if (insertRegex && insertRegex.test(target)) target = target.replace(insertRegex, m => `${m}${glueComma()}${leadSwear}`);
    else target = `${target}${glueComma()}${leadSwear}`;
  }

  clauses[idx] = target;
  let out = rejoinClauses(clauses);
  out = out.replace(/[?!]/g, "."); // keep one sentence sane
  out = softTrimToFit(out, maxLen, punctBudget);
  return out;
}

// ============== ENFORCEMENT ==============
function enforceRules(
  lines: string[],
  rules: any,
  rating: string,
  insertWords: string[] = []
) {
  const enforcement: string[] = [];
  const minLen = rules.length?.min_chars ?? 60;
  const maxLen = rules.length?.max_chars ?? 120;

  let processed = lines.map((raw, idx) => {
    let t = raw.trim();
    if (rules.punctuation?.ban_em_dash) t = t.replace(/—/g, rules.punctuation.replacement?.["—"] || ",");
    t = t.replace(/[:;…]/g, ",").replace(/[“”"’]/g, "'");

    const maxPunc = rules.punctuation?.max_marks_per_line ?? 3;
    if (countPunc(t) > maxPunc) {
      let kept = 0;
      t = t.replace(/[.,?!]/g, m => (++kept <= maxPunc ? m : ""));
      enforcement.push(`Line ${idx+1}: limited punctuation to ${maxPunc}`);
    }

    if (!oneSentence(t)) {
      const first = t.split(/[.?!]/)[0].trim();
      t = first + (/[.,?!]$/.test(first) ? "" : ".");
      enforcement.push(`Line ${idx+1}: trimmed to one sentence`);
    }

    const before = t.length;
    t = trimToRange(t, minLen, maxLen);
    if (t.length !== before) enforcement.push(`Line ${idx+1}: compressed to ${t.length} chars`);

    // ensure insert words present (first one wins if missing)
    for (const w of insertWords) {
      if (!new RegExp(`\\b${w}\\b`, "i").test(t)) {
        t = `${t.replace(/[.?!]\s*$/,"")}, ${w}.`;
        enforcement.push(`Line ${idx+1}: appended insert word '${w}'`);
        break;
      }
    }

    return t;
  });

  if (insertWords?.length === 1) {
    processed = processed.map(l => deTagInsert(l, insertWords[0]));
    const varied = varyInsertPositions(processed, insertWords[0]);
    if (varied.join("|") !== processed.join("|")) enforcement.push("Varied insert word positions across outputs");
    processed = varied;
  }

  // Rating-specific passes
  if (rating === "R") {
    const usedLead = new Set<string>();
    const maxPer = Math.max(1, rules?.ratings?.R?.max_swears_per_line ?? 3);

    processed = processed.map((t, i) => {
      // Ensure at least one swear, prefer a lead swear unused across lines
      let lead = SWEAR_WORDS.find(w => !usedLead.has(w)) || SWEAR_WORDS[0];
      const had = extractSwears(t);
      if (had.length === 0) {
        t = placeNaturalProfanity(t, insertWords, rules, lead);
        enforcement.push(`Line ${i+1}: placed profanity naturally`);
      } else {
        const first = had[0];
        if (usedLead.has(first)) {
          const alt = SWEAR_WORDS.find(w => !usedLead.has(w) && !new RegExp(`\\b${w}\\b`, "i").test(t));
          if (alt) {
            lead = alt;
            t = placeNaturalProfanity(t, insertWords, rules, lead);
            enforcement.push(`Line ${i+1}: varied lead profanity`);
          }
        } else {
          lead = first;
        }
      }
      usedLead.add(lead.toLowerCase());

      // Optional extra swears, bounded by punctuation and length
      let current = extractSwears(t);
      while (current.length < maxPer) {
        const cand = SWEAR_WORDS.find(w => !current.includes(w) && !new RegExp(`\\b${w}\\b`, "i").test(t));
        if (!cand) break;
        const puncts = countPunc(t);
        const roomPunct = puncts < (rules.punctuation?.max_marks_per_line ?? 3);
        const lengthOk = (t.length + cand.length + 2) <= maxLen;
        
        if (!roomPunct || !lengthOk) break;
        
        t = placeNaturalProfanity(t, insertWords, rules, cand);
        current = extractSwears(t);
        enforcement.push(`Line ${i+1}: added extra profanity '${cand}'`);
      }

      return t;
    });
  }

  return { lines: processed, enforcement };
}

// ============== MAIN HANDLER ==============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { text, tone, rating, insertWords, rulesId } = body;
    
    if (!text || !tone || !rating) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/");
    const rules = await loadRules(rulesId, origin);
    
    // Build system prompt
    const toneRules = rules.tones?.[tone]?.rules?.join(", ") || "maintain appropriate tone";
    const ratingRules = JSON.stringify(rules.ratings?.[rating] || {});
    const lengthConstraints = `${rules.length?.min_chars || 60}-${rules.length?.max_chars || 120} characters`;
    
    const systemPrompt = `${text_rules}

TONE: ${tone} (${toneRules})
RATING: ${rating} (${ratingRules})
LENGTH: ${lengthConstraints}
INSERT WORDS: ${insertWords?.join(", ") || "none"}

Generate exactly 4 clean text variations. Each line should be ${lengthConstraints}, appropriate for ${rating} rating, with ${tone} tone. No numbering, no markdown, no formatting - just the raw text lines.`;

    const userPrompt = `Generate 4 variations of: "${text}"`;
    
    console.log("Calling OpenAI with:", { systemPrompt: systemPrompt.substring(0, 200) + "...", userPrompt });
    
    const { content } = await callOpenAI(systemPrompt, userPrompt);
    
    console.log("OpenAI response:", content);
    
    // Clean and process the response
    const cleaned = parseLines(content);
    console.log("Cleaned response:", cleaned);
    
    if (cleaned.length === 0) {
      throw new Error("No valid text variations generated");
    }
    
    // Apply rules enforcement
    const { lines: processed, enforcement } = enforceRules(cleaned, rules, rating, insertWords);
    
    console.log("Final processed lines:", processed);
    console.log("Enforcement actions:", enforcement);
    
    if (processed.length === 0) {
      throw new Error("All generated variations were filtered out");
    }

    return new Response(JSON.stringify({ 
      lines: processed,
      enforcement,
      debug: { original: content, cleaned, processed }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in generate-text:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      details: "Text generation failed - check logs for details"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
