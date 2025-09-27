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

  // Fallback rules v6 (60–120 chars, max 3 punctuation)
  cachedRules = {
    id: rulesId,
    version: 6,
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
      "R": { allow_profanity: true, require_profanity: true, open_profanity: true, require_variation: true }
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

// ============== HELPERS ==============
const STRONG_SWEARS = /(fuck(?:er|ing)?|shit(?:ty)?|bastard|ass(?!ert)|arse|bullshit|goddamn|damn|prick|dick|cock|piss|wank|crap|motherfucker|hell)/i;

function countPunc(s: string) { return (s.match(/[.,?!]/g) || []).length; }
function oneSentence(s: string) { return !/[.?!].+?[.?!]/.test(s); }

// updated defaults to 60–120
function trimToRange(s: string, min=60, max=120) {
  let out = s.trim().replace(/\s+/g, " ");
  out = out.replace(/\b(finally|trust me|here'?s to|may your|another year of)\b/gi, "").replace(/\s+/g, " ").trim();
  if (out.length > max && out.includes(",")) out = out.split(",")[0];
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

function cleanLine(raw: string) {
  let t = raw.trim();
  t = t.replace(/^\s*[\d\-\*•.]+\s*/, "");
  t = t.replace(/^["'`]/, "").replace(/["'`]$/, "");
  t = t.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/`(.*?)`/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function parseLines(raw: string): string[] {
  // allow longer candidates to capture 120-char lines
  const candidates = raw.split(/\r?\n+/).map(s => s.replace(/^\s*[\d\-\*•.]+\s*/, "").trim()).filter(Boolean);
  const lines = candidates.filter(s => s.length >= 50 && s.length <= 200 && oneSentence(s));
  return lines.map(cleanLine);
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
      t = t.replace(/[.,?!]/g, (m) => (++kept <= maxPunc ? m : ""));
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

    for (const w of insertWords) {
      if (!new RegExp(`\\b${w}\\b`, "i").test(t)) {
        t = `${t.split(/[.,?!]/)[0]}, ${w}.`;
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

  // de-dup near copies by bigrams
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const l of processed) {
    const pairs = bigramSet(l);
    let clash = false;
    for (const p of pairs) if (seen.has(p)) { clash = true; break; }
    if (!clash) { for (const p of pairs) seen.add(p); unique.push(l); }
  }

  return { lines: unique, enforcement };
}

// ============== BACKFILL TO 4 ==============
async function backfillLines(
  missing: number,
  systemPrompt: string,
  accepted: string[],
  tone: string,
  rating: string,
  insertWords: string[]
) {
  const block = accepted.map((l,i)=>`${i+1}. ${l}`).join("\n");
  const user = `We still need ${missing} additional one-liners that satisfy ALL constraints.
Do not repeat word pairs used in:
${block}
Tone=${tone}; Rating=${rating}; Insert words=${insertWords.join(", ")}.
Return exactly ${missing} new lines, one per line.`;

  const { content } = await callOpenAI(systemPrompt, user);
  return parseLines(content);
}

// ============== HTTP ==============
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
    const { content: raw, model } = await callOpenAI(systemPrompt, userPrompt);

    let candidates = parseLines(raw);
    if (candidates.length < 4) {
      candidates = raw.split(/\r?\n+/).map(cleanLine).filter(Boolean);
    }

    const fallbackRules = { length:{min_chars:60,max_chars:120}, punctuation:{max_marks_per_line:3,ban_em_dash:true,replacement:{"—":","}} };
    const enforced = enforceRules(
      candidates,
      rules ?? fallbackRules,
      rating || "PG-13",
      insertWords
    );
    let lines = enforced.lines;

    // backfill to guarantee 4
    let tries = 0;
    while (lines.length < 4 && tries < 2) {
      const need = 4 - lines.length;
      const more = await backfillLines(need, systemPrompt, lines, tone || "", rating || "PG-13", insertWords);
      const enforcedMore = enforceRules(more, rules ?? fallbackRules, rating || "PG-13", insertWords);
      lines = [...lines, ...enforcedMore.lines];
      tries++;
    }
    lines = lines.slice(0, 4);

    const minL = (rules?.length?.min_chars ?? 60);
    const maxL = (rules?.length?.max_chars ?? 120);

    const resp = {
      lines: lines.map((line, i) => ({
        line,
        length: line.length,
        index: i + 1,
        valid: line.length >= minL && line.length <= maxL && countPunc(line) <= 3 && oneSentence(line)
      })),
      model,
      count: lines.length,
      rules_used: rules ? { id: rules.id, version: rules.version } : { id: "fallback", version: 6 },
      enforcement: enforced.enforcement
    };

    return new Response(JSON.stringify(resp), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
