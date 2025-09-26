import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { text_rules } from "../_shared/text-rules.ts";

// ============== MODEL ==============
const getTextModel = () => Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o-mini";
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
const openAIBase = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com";

// ============== CORS ==============
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

// ============== RULES LOADER ==============
let cachedRules: {
  id?: string;
  version?: number;
  length?: { min_chars: number; max_chars: number };
  punctuation?: any;
  tones?: any;
  ratings?: any;
  spelling?: any;
} | null = null;

async function loadRules(rulesId: string, origin?: string): Promise<any> {
  if (cachedRules && cachedRules.id === rulesId) return cachedRules;

  if (origin) {
    try {
      const rulesUrl = `${origin.replace(/\/+$/,"")}/config/${rulesId}.json`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(rulesUrl, { signal: controller.signal });
      clearTimeout(t);
      if (res.ok) {
        cachedRules = await res.json();
        (cachedRules as any).id ||= rulesId;
        return cachedRules;
      }
    } catch {}
  }

  // Fallback rules v10
  cachedRules = {
    id: rulesId || "fallback",
    version: 10,
    length: { min_chars: 60, max_chars: 120 },
    punctuation: {
      ban_em_dash: true,
      replacement: { "—": "," },
      allowed: [".", ",", "?", "!"],
      max_marks_per_line: 3
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
      "R": {
        allow_profanity: true,
        require_profanity: true,
        open_profanity: true,
        require_variation: true,
        max_swears_per_line: 1,
        extra_swear_chance: 0.0
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

  const makeReq = (m: string, opts: { maxTokens: number; temperature?: number }) =>
    buildOpenAIRequest(m, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], opts);

  try {
    const r = await fetch(`${openAIBase}/v1/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(makeReq(model, { maxTokens }))
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const content = d.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty content");
    return { content, model: d.model || model };
  } catch {
    model = "gpt-4o-mini";
    maxTokens = 220;
    const r = await fetch(`${openAIBase}/v1/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(makeReq(model, { maxTokens, temperature: 0.8 }))
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const content = d.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty content (fallback)");
    return { content, model };
  }
}

// ============== UTILITIES ==============
const SWEAR_WORDS = [
  "fuck","fucking","fucker","motherfucker","shit","shitty","bullshit","asshole","arse","arsehole",
  "bastard","bitch","son of a bitch","damn","goddamn","hell","crap","piss","pissed","dick",
  "dickhead","prick","cock","knob","wanker","tosser","bollocks","bugger","bloody","git",
  "twat","douche","douchebag","jackass","dumbass","dipshit","clusterfuck","shitshow","balls",
  "tits","skank","tramp","slag","screw you","piss off","crapshoot","arsed","bloody hell",
  "rat bastard","shithead"
];
const STRONG_SWEARS = new RegExp(
  `\\b(${SWEAR_WORDS.map(w => w.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")).join("|")})\\b`,
  "i"
);

function extractSwears(s: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(STRONG_SWEARS, "gi");
  let m; while ((m = re.exec(s)) !== null) out.add(m[0].toLowerCase());
  return [...out];
}

function rand() { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] / 2 ** 32; }
function choice<T>(arr: T[], weights?: number[]) {
  if (!weights) return arr[Math.floor(rand() * arr.length)];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}

function splitClauses(s: string) { return s.split(/,\s*/).map(c => c.trim()).filter(Boolean); }
function rejoinClauses(clauses: string[]) { let out = clauses.join(", "); out = out.replace(/[.?!]\s*$/, "") + "."; return out.replace(/\s+/g, " ").trim(); }
function parseLines(content: string): string[] { return content.split(/\r?\n+/).map(s => s.trim()).filter(Boolean); }
function countPunc(s: string) { return (s.match(/[.,?!]/g) || []).length; }
function oneSentence(s: string) { return !/[.?!].+?[.?!]/.test(s); }

function stripLeadingNumber(s: string) {
  return s.replace(/^\s*\d+\s*[).:-]?\s*/, "").trim();
}

const META = /(^|\b)(here (are|is)|as requested|candidate(s)?|now,?\s+here (are|is)|satisfying the constraints|return 4|distinct outputs)/i;

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
function bigramOverlap(a: string, b: string) {
  const A = bigramSet(a), B = bigramSet(b);
  const inter = [...A].filter(x => B.has(x)).length;
  const denom = Math.max(1, Math.min(A.size, B.size));
  return inter / denom;
}
function dedupeFuzzy(lines: string[], threshold = 0.6) {
  const out: string[] = [];
  for (const l of lines) {
    const tooClose = out.some(x => bigramOverlap(l, x) >= threshold);
    if (!tooClose) out.push(l);
  }
  return out;
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

// ====== Role-aware TOKENS ======
type Token = { text: string; role: string };

const TOKEN_STRATEGIES = ["coldOpen","midAfterVerb","tagAfterComma","venueBracket","endPunch","beforeAdjNoun"] as const;

function applyTokenStrategy(line: string, token: string, strat: typeof TOKEN_STRATEGIES[number], rules: any) {
  const punctBudget = rules.punctuation?.max_marks_per_line ?? 3;
  const puncCount = countPunc(line);
  const glue = puncCount < punctBudget ? ", " : " ";
  if (strat === "coldOpen")       return `${token}${glue}${line}`;
  if (strat === "tagAfterComma")  return line.replace(/[.?!]\s*$/, "") + glue + `${token}.`;
  if (strat === "venueBracket")   return line.replace(/[.?!]\s*$/, "") + ` (${token}).`;
  if (strat === "endPunch")       return line.replace(/[.?!]\s*$/, "") + glue + `${token}.`;
  if (strat === "beforeAdjNoun")  return line.replace(/\b(great|wild|messy|clean|quick|slow|big|small|fresh|late|early|crazy|smart|loud|tight)\b/i, (m) => `${token} ${m}`);
  return line.replace(/\b(get|make|did|tried|went|saw|heard|ate|dated|dumped|texted|scrolled|streamed)\b/i, (m) => `${m} ${token}`);
}

function placeTokensNaturally(line: string, tokens: Token[], rules: any) {
  let out = line;
  for (const tok of tokens) {
    const present = new RegExp(`\\b${tok.text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`, "i").test(out);
    if (present) continue;
    const strat =
      tok.role === "venue"     ? "venueBracket" :
      tok.role === "city"      ? "coldOpen"     :
      tok.role === "timeslot"  ? "venueBracket" :
      tok.role === "person"    ? "tagAfterComma":
      tok.role === "callback"  ? "endPunch"     :
      "midAfterVerb";
    out = applyTokenStrategy(out, tok.text, strat as any, rules);
  }
  return out;
}

// ====== Profanity placement (v10 smarter) ======
const VERBISH = /\b(get|make|feel|want|need|love|hate|hit|go|keep|stay|run|drop|ship|book|call|try|push|fake|score|win|lose|cook|build|haul|dump|clean|move|save|spend|cost|is|are|was|were|do|does|did)\b/i;
const ADJECTIVEISH = /\b(easy|fast|cheap|heavy|light|wild|messy|clean|busy|quick|slow|real|big|small|fresh|free|late|early|crazy|solid|smart|bold|loud|tight)\b/i;
const INTENSIFIERS = /\b(really|very|super|so|pretty|kinda|sort of|sorta)\b/i;

function hasTokenAdjacent(target: string, tokens: Token[]) {
  return tokens.some(t =>
    new RegExp(`\\b${t.text.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\$&")}\\b\\s*$`, "i").test(target) ||
    new RegExp(`^\\s*\\b${t.text.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\$&")}\\b`, "i").test(target)
  );
}

function softTrimToFit(s: string, maxLen: number, maxPunc: number) {
  let punc = countPunc(s);
  if (punc > maxPunc) {
    let kept = 0;
    s = s.replace(/[.,?!]/g, m => (++kept <= maxPunc ? m : ""));
  }
  if (s.length > maxLen) {
    s = s.slice(0, maxLen).replace(/\s+\S*$/,"").trim();
    if (!/[.?!]$/.test(s)) s += ".";
  }
  return s;
}

function placeNaturalProfanity(line: string, tokens: Token[], rules: any, leadSwear: string) {
  const punctBudget = rules.punctuation?.max_marks_per_line ?? 3;
  const maxLen = rules.length?.max_chars ?? 120;
  if (extractSwears(line).includes(leadSwear.toLowerCase())) return line;

  const clauses = splitClauses(line);
  if (!clauses.length) return line;

  const candidates = clauses.map((c, i) => ({
    i,
    score:
      (VERBISH.test(c) ? 2 : 0) +
      (ADJECTIVEISH.test(c) ? 1 : 0) +
      (hasTokenAdjacent(c, tokens) ? -1 : 0) +
      (c.length / 80)
  })).sort((a,b)=>b.score-a.score);
  const idx = candidates[0]?.i ?? 0;

  let target = clauses[idx];
  const strategies = ["start","beforeVerbAdj","replaceIntensifier","endPunch"] as const;
  const weights    = [0.25, 0.4, 0.15, 0.20];
  const strat = choice(strategies, weights);
  const glue = () => (countPunc(line) < punctBudget ? ", " : " ");

  if (strat === "start")                    target = `${leadSwear}${glue()}${target}`;
  else if (strat === "beforeVerbAdj") {
    if (VERBISH.test(target))               target = target.replace(VERBISH,      m => `${leadSwear} ${m}`);
    else if (ADJECTIVEISH.test(target))     target = target.replace(ADJECTIVEISH, m => `${leadSwear} ${m}`);
    else                                    target = `${target}${glue()}${leadSwear}`;
  }
  else if (strat === "replaceIntensifier" && INTENSIFIERS.test(target)) target = target.replace(INTENSIFIERS, leadSwear);
  else                                                                  target = `${target}${glue()}${leadSwear}`;

  clauses[idx] = target;
  let out = rejoinClauses(clauses);
  out = out.replace(/[?!](?=.*\.)/g, "");
  out = softTrimToFit(out, maxLen, punctBudget);
  return out;
}

// ============== SPELLCHECK ==============
function levenshtein(a: string, b: string) {
  const dp = Array.from({length: a.length+1}, (_,i)=>Array(b.length+1).fill(0));
  for (let i=0;i<=a.length;i++) dp[i][0]=i;
  for (let j=0;j<=b.length;j++) dp[0][j]=j;
  for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++) {
    const cost = a[i-1].toLowerCase() === b[j-1].toLowerCase() ? 0 : 1;
    dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
  }
  return dp[a.length][b.length];
}

function bestHintMatch(input: string, hints: string[]): {suggestion?: string, distance: number} {
  if (!hints?.length) return { distance: Infinity };
  let best: string | undefined; let bestD = Infinity;
  for (const h of hints) {
    const d = levenshtein(input, h);
    if (d < bestD) { best = h; bestD = d; }
  }
  return { suggestion: best, distance: bestD };
}

function spellcheckTokens(tokens: Token[], hintsByRole?: Record<string,string[]>) {
  const suggestions: Array<{original:string; role:string; suggestion:string}> = [];
  const corrected = tokens.map(t => {
    const hints = hintsByRole?.[t.role] || hintsByRole?.["*"];
    if (!hints || !t.text || t.text.length < 3) return t;
    const { suggestion, distance } = bestHintMatch(t.text, hints);
    if (suggestion && distance > 0 && distance <= Math.max(1, Math.floor(t.text.length * 0.3))) {
      suggestions.push({ original: t.text, role: t.role, suggestion });
      return { ...t, text: suggestion };
    }
    return t;
  });
  return { corrected, suggestions };
}

// ============== ENFORCEMENT ==============
function enforceRules(
  lines: string[],
  rules: any,
  rating: string,
  insertTokens: Token[] = []
) {
  const enforcement: string[] = [];
  const minLen = rules.length?.min_chars ?? 60;
  const maxLen = rules.length?.max_chars ?? 120;

  let processed = lines
    .map((raw) => stripLeadingNumber(raw.trim()))
    .filter((l) => l && !META.test(l))
    .map((t) => t.replace(/["`]+/g, "").replace(/\s+/g, " ").trim());

  processed = processed.map((t, idx) => {
    if (rules.punctuation?.ban_em_dash) t = t.replace(/—/g, rules.punctuation.replacement?.["—"] || ",");
    t = t.replace(/[:;…]/g, ",").replace(/[“”'’]/g, "'");

    // fix “,.” or similar artifacts
    t = t.replace(/([,?!])\./g, ".").replace(/\s+[.?!]$/, m => m.trim());

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

    // role-aware token placement (before profanity)
    t = placeTokensNaturally(t, insertTokens, rules);

    // ensure every token appears
    for (const tok of insertTokens) {
      if (!new RegExp(`\\b${tok.text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`, "i").test(t)) {
        t = `${t.replace(/[.?!]\s*$/,"")}, ${tok.text}.`;
        enforcement.push(`Line ${idx+1}: appended missing token '${tok.text}'`);
      }
    }

    return t;
  });

  if (insertTokens?.length === 1) {
    const w = insertTokens[0].text;
    processed = processed.map(l => deTagInsert(l, w));
    const varied = varyInsertPositions(processed, w);
    if (varied.join("|") !== processed.join("|")) enforcement.push("Varied token positions across outputs");
    processed = varied;
  }

  if (rating === "R") {
    const usedLead = new Set<string>();
    const cfg = rules?.ratings?.R ?? {};
    const maxPer = Math.max(1, cfg.max_swears_per_line ?? 1);
    const extraChance = Math.max(0, Math.min(1, cfg.extra_swear_chance ?? 0));

    processed = processed.map((t, i) => {
      let lead = SWEAR_WORDS.find(w => !usedLead.has(w)) || SWEAR_WORDS[0];
      const had = extractSwears(t);

      if (had.length === 0) {
        t = placeNaturalProfanity(t, insertTokens, rules, lead);
        enforcement.push(`Line ${i+1}: placed profanity naturally`);
      } else {
        const first = had[0];
        if (usedLead.has(first)) {
          const alt = SWEAR_WORDS.find(w => !usedLead.has(w) && !new RegExp(`\\b${w}\\b`, "i").test(t));
          if (alt) {
            lead = alt;
            t = placeNaturalProfanity(t, insertTokens, rules, lead);
            enforcement.push(`Line ${i+1}: varied lead profanity`);
          } else lead = first;
        } else lead = first;
      }
      usedLead.add(lead.toLowerCase());

      let current = extractSwears(t);
      const wantsExtra = (current.length < maxPer) || (current.length < 2 && Math.random() < extraChance);
      if (wantsExtra) {
        const cand = SWEAR_WORDS.find(w => !current.includes(w) && !new RegExp(`\\b${w}\\b`, "i").test(t));
        if (cand) {
          const puncts = countPunc(t);
          const roomP = puncts < (rules.punctuation?.max_marks_per_line ?? 3);
          const roomC = (t.length + cand.length + 2) <= (rules.length?.max_chars ?? 120);
          if (roomP && roomC) t = t.replace(/[.?!]\s*$/,"") + ", " + cand + ".";
        }
      }

      t = softTrimToFit(t, rules.length?.max_chars ?? 120, rules.punctuation?.max_marks_per_line ?? 3);
      return t;
    });
  }

  if (rating === "PG-13") {
    processed = processed.map((t, i) => {
      const cleaned = t.replace(/(fuck(?:er|ing)?|shit(?:ty)?|bastard|ass(?!ert)|arse|bullshit|prick|dick|cock|piss|wank|crap|motherfucker|goddamn|bitch|dickhead|knob|twat|tosser|wanker|bollocks|bugger)/gi, "damn");
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

  let unique = dedupeFuzzy(processed, 0.6);
  if (unique.length < 4) unique = dedupeFuzzy(processed, 0.8);
  if (unique.length === 0) unique = processed.slice(0, 4);

  return { lines: unique, enforcement };
}

// ============== BACKFILL ==============
async function backfillLines(
  missing: number,
  systemPrompt: string,
  accepted: string[],
  tone: string,
  rating: string,
  tokens: Token[],
  category?: string,
  subcategory?: string
) {
  const block = accepted.map((l,i)=>`${i+1}. ${l}`).join("\n");
  const jokeMode = typeof category === "string" && /^jokes/i.test(category);
  const styleHint = jokeMode && subcategory ? ` in the style '${subcategory}'` : "";
  const tokenHint = tokens.length ? "\nTOKENS: " + tokens.map(t => `${t.role}=${t.text}`).join(" | ") : "";
  const user = `We still need ${missing} additional ${jokeMode ? "jokes" : "one-liners"}${styleHint} that satisfy ALL constraints.${tokenHint}
Do not repeat word pairs used in:
${block}
Tone=${tone}; Rating=${rating}.
Return exactly ${missing} new lines, one per line.`;

  const { content } = await callOpenAI(systemPrompt, user);
  return parseLines(content);
}

// ============== HTTP ==============
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const {
      category, subcategory, tone, rating,
      insertWords = [],
      insertTokens = [],
      rules_id,
      entity_hints
    } = payload ?? {};

    const origin = req.headers.get("origin")
      || req.headers.get("referer")?.split("/").slice(0,3).join("/");
    const rules  = rules_id ? await loadRules(rules_id, origin) : await loadRules("fallback", origin);

    // Normalize to tokens
    let tokens: Token[] = Array.isArray(insertTokens) && insertTokens.length
      ? insertTokens
      : (Array.isArray(insertWords) ? insertWords.map((w: string) => ({ text: w, role: "topic" })) : []);

    // Auto-inject topic token for pop-culture subcategory if user forgot to pass one
    if ((!tokens || !tokens.length) && /pop-?culture/i.test(String(category)) && subcategory) {
      tokens = [{ text: String(subcategory), role: "topic" }];
    }

    // Spellcheck tokens against optional hints
    const { corrected, suggestions } = spellcheckTokens(tokens, entity_hints || undefined);
    tokens = corrected;

    const jokeMode = typeof category === "string" && /^jokes/i.test(category);
    let systemPrompt = text_rules;

    if (category)    systemPrompt += `\n\nCONTEXT: ${category}`;
    if (subcategory) systemPrompt += ` > ${subcategory}`;
    if (jokeMode)    systemPrompt += `\nMODE: JOKES\nWrite jokes in this style only. Do not explain.`;
    if (tone)        systemPrompt += `\nTONE: ${tone}`;
    if (rating)      systemPrompt += `\nRATING: ${rating}`;
    if (tokens.length) systemPrompt += `\nTOKENS: ${tokens.map(t => `${t.role}=${t.text}`).join(" | ")}`;
    systemPrompt += `\n\nReturn exactly 4 lines, one per line.`;

    const userPrompt = jokeMode
      ? "Write 12 candidate jokes in the specified joke style, then return 4 that best satisfy all constraints. No explanations."
      : "Generate 12 candidate one-liners first. Then return 4 that best satisfy all constraints.";

    const { content: raw, model } = await callOpenAI(systemPrompt, userPrompt);

    // Parse + pre-clean
    let candidates = parseLines(raw).map(stripLeadingNumber).filter(l => !META.test(l));
    if (candidates.length < 4) {
      candidates = raw.split(/\r?\n+/).map(s => stripLeadingNumber(s.trim())).filter(l => l && !META.test(l));
    }

    // Enforce
    let { lines, enforcement } = enforceRules(
      candidates,
      rules,
      rating || "PG-13",
      tokens
    );

    // Backfill to 4
    let tries = 0;
    while (lines.length < 4 && tries < 4) {
      const need = 4 - lines.length;
      const more = await backfillLines(need, systemPrompt, lines, tone || "", rating || "PG-13", tokens, category, subcategory);
      const enforcedMore = enforceRules(more, rules, rating || "PG-13", tokens);
      lines = [...lines, ...enforcedMore.lines].slice(0, 4);
      enforcement = enforcement.concat(enforcedMore.enforcement);
      tries++;
    }

    // Last-resort trim from raw pool
    if (lines.length < 4) {
      for (const c of candidates) {
        if (lines.length >= 4) break;
        if (!lines.includes(c)) {
          const trimmed = trimToRange(c, rules.length!.min_chars, rules.length!.max_chars);
          if (oneSentence(trimmed) && countPunc(trimmed) <= rules.punctuation!.max_marks_per_line) lines.push(trimmed);
        }
      }
      lines = lines.slice(0, 4);
    }

    const minL = (rules.length?.min_chars ?? 60);
    const maxL = (rules.length?.max_chars ?? 120);

    const resp = {
      lines: lines.map((line, i) => ({
        line,
        length: line.length,
        index: i + 1,
        valid: line.length >= minL && line.length <= maxL && countPunc(line) <= (rules.punctuation?.max_marks_per_line ?? 3) && oneSentence(line)
      })),
      model,
      count: lines.length,
      rules_used: { id: rules.id, version: rules.version },
      enforcement,
      token_spellcheck: suggestions
    };

    return new Response(JSON.stringify(resp), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
