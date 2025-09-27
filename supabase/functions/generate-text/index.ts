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
      if (res.ok) { cachedRules = await res.json(); return cachedRules; }
    } catch {}
  }
  // Fallback rules v7 (60–120 chars, max 2 punctuation)
  cachedRules = {
    id: rulesId,
    version: 7,
    length: { min_chars: 100, max_chars: 120 },
    punctuation: { ban_em_dash: true, replacement: { "—": "," }, allowed: [".", ",", "?", "!"], max_marks_per_line: 2 },
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
  let maxTokens = model.startsWith("gpt-5") ? 4000 : 320;

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
    maxTokens = 240;

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
const STRONG_SWEARS = /(fuck(?:er|ing)?|f\*+|shit(?:ty)?|s\*+t|bastard|ass(?!ert)|a\*+|arse|bullshit|b\*+|goddamn|g\*+d|prick|dick|cock|piss|wank|crap|motherfucker|hell)/i;

function countPunc(s: string) { return (s.match(/[.,?!]/g) || []).length; }
function oneSentence(s: string) { return !/[.?!].+?[.?!]/.test(s); }

function trimToRange(s: string, min=100, max=120) {
  let out = s.trim().replace(/\s+/g, " ");
  out = out.replace(/\b(finally|trust me|here'?s to|may your|another year of)\b/gi, "").replace(/\s+/g, " ").trim();
  if (out.length > max && out.includes(",")) out = out.split(",")[0];
  if (out.length > max) out = out.slice(0, max).trim();
  return out;
}

// Keep setup + first punch within range
function trimPunchline(line: string, min=100, max=120) {
  let t = line.trim();
  if (t.length <= max) return t;
  const parts = t.split(/[,?!]/);
  if (parts.length > 1) t = `${parts[0]},${parts[1]}`.trim();
  if (t.length > max) t = t.slice(0, max).trim();
  if (t.length < min) t = trimToRange(line, min, max);
  return t;
}

// soften trailing hedges
function hardStop(t: string) {
  return t.replace(/\s*,?\s*(you know( that)?,?\s*right|right|okay|ok)\.?$/i, ".").trim();
}

function bigramSet(s: string) {
  const words = s.toLowerCase().replace(/[^\w\s']/g,"").split(/\s+/).filter(Boolean);
  const set = new Set<string>();
  for (let i=0;i<words.length-1;i++) set.add(words[i]+" "+words[i+1]);
  return set;
}

// Always distribute insert positions: start / middle / end for 1–3
function varyInsertPositions(lines: string[], insert: string) {
  return lines.map((line, idx) => {
    let clean = line.trim();
    const has = new RegExp(`\\b${insert}\\b`, "i").test(clean);
    if (!has) clean = `${clean.split(/[.,?!]/)[0]}, ${insert}.`;

    if (idx === 0) {
      if (!clean.toLowerCase().startsWith(insert.toLowerCase())) clean = `${insert} ${clean}`;
      return clean;
    } else if (idx === 1) {
      const w = clean.split(/\s+/);
      const mid = Math.max(1, Math.floor(w.length / 2));
      if (!new RegExp(`\\b${insert}\\b`, "i").test(w.join(" "))) w.splice(mid, 0, insert);
      return w.join(" ");
    } else if (idx === 2) {
      if (!clean.toLowerCase().endsWith(insert.toLowerCase())) clean = `${clean.replace(/[.,?!]*$/, "")}, ${insert}`;
      return clean;
    }
    return clean; // 4th: natural variety
  });
}

function deTagInsert(line: string, insert: string) {
  const tag = new RegExp(`,\\s*${insert}\\.?$`, "i");
  if (tag.test(line) && !new RegExp(`^${insert}\\b`, "i").test(line)) {
    const core = line.replace(tag, "").trim().replace(/\s+/g, " ");
    return `${insert}, ${core}`;
  }
  return line;
}

// PG-13 sanitizer: remove uncensored or censored strong profanity; keep only hell/damn
function sanitizePG13(line: string) {
  let t = line;
  // remove/replace any censored forms
  t = t.replace(/\b(f\*+|s\*+t|b\*+|a\*+|g\*+d)\b/gi, "damn");
  // downgrade any strong profanities to clean burns
  t = t.replace(/\b(fuck(?:er|ing)?|shit(?:ty)?|bastard|ass(?!ert)|arse|bullshit|prick|dick|cock|piss|wank|crap|motherfucker|goddamn)\b/gi, "damn");
  // ensure only hell/damn remain as mild options
  return t.replace(/\b(god damn)\b/gi, "damn");
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
  const candidates = raw.split(/\r?\n+/).map(s => s.replace(/^\s*[\d\-\*•.]+\s*/, "").trim()).filter(Boolean);
  const lines = candidates.filter(s => s.length >= 50 && s.length <= 220 && oneSentence(s));
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
  const minLen = rules.length?.min_chars ?? 100;
  const maxLen = rules.length?.max_chars ?? 120;

  let processed = lines.map((raw, idx) => {
    let t = raw.trim();
    if (rules.punctuation?.ban_em_dash) t = t.replace(/—/g, rules.punctuation.replacement?.["—"] || ",");
    t = t.replace(/[:;…]/g, ",").replace(/[“”"’]/g, "'");

    const maxPunc = rules.punctuation?.max_marks_per_line ?? 2;
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

    if (countPunc(t) === 0) t = `${t}.`;

    for (const w of insertWords) {
      if (!new RegExp(`\\b${w}\\b`, "i").test(t)) {
        t = `${t.split(/[.,?!]/)[0]}, ${w}.`;
        enforcement.push(`Line ${idx+1}: appended insert word '${w}'`);
        break;
      }
    }

    return hardStop(t);
  });

  // Normalize tacked-on endings then force insert distribution
  if (insertWords?.length === 1) {
    processed = processed.map(l => deTagInsert(l, insertWords[0]));
    processed = varyInsertPositions(processed, insertWords[0]);
    enforcement.push("Distributed insert word across start/middle/end");
  }

  // Profanity by rating
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
      const cleaned = sanitizePG13(t);
      if (cleaned !== t) enforcement.push(`Line ${i+1}: sanitized to PG-13 (only 'hell'/'damn' allowed)`);
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

  // Final punch trim & de-dup
  processed = processed.map(l => trimPunchline(l, minLen, maxLen));

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
    if (candidates.length < 4) candidates = raw.split(/\r?\n+/).map(cleanLine).filter(Boolean);

    const fallbackRules = { length:{min_chars:100,max_chars:120}, punctuation:{max_marks_per_line:2,ban_em_dash:true,replacement:{"—":","}} };
    const enforced = enforceRules(candidates, rules ?? fallbackRules, rating || "PG-13", insertWords);
    let lines = enforced.lines;

    let tries = 0;
    while (lines.length < 4 && tries < 2) {
      const need = 4 - lines.length;
      const more = await backfillLines(need, systemPrompt, lines, tone || "", rating || "PG-13", insertWords);
      const enforcedMore = enforceRules(more, rules ?? fallbackRules, rating || "PG-13", insertWords);
      lines = [...lines, ...enforcedMore.lines];
      tries++;
    }
    lines = lines.slice(0, 4);

    const minL = (rules?.length?.min_chars ?? 100);
    const maxL = (rules?.length?.max_chars ?? 120);

    const resp = {
      lines: lines.map((line, i) => ({
        line,
        length: line.length,
        index: i + 1,
        valid: line.length >= minL && line.length <= maxL && countPunc(line) <= (rules?.punctuation?.max_marks_per_line ?? 2) && oneSentence(line)
      })),
      model,
      count: lines.length,
      rules_used: rules ? { id: rules.id, version: rules.version } : { id: "fallback", version: 7 },
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
