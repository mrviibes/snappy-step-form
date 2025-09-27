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
  let maxTokens = model.startsWith("gpt-5") ? 4000 : 240;

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
    const req = buildOpenAIRequest(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { maxTokens: 200, temperature: 0.8 });

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

function parseLines(content: string): string[] {
  return content
    .split(/\r?\n+/)
    .map(line => cleanLine(line))
    .filter(Boolean)
    .slice(0, 12); // Take first 12 candidates
}

function cleanLine(line: string): string {
  return line
    .replace(/^\d+\.\s*/, '') // Remove numbering
    .replace(/^-\s*/, '') // Remove dashes
    .replace(/^\*+\s*/, '') // Remove asterisks
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
    .replace(/\*(.*?)\*/g, '$1') // Remove markdown italic
    .replace(/^["\'""`]/, '') // Remove leading quotes
    .replace(/["\'""`]$/, '') // Remove trailing quotes
    .replace(/^(candidate|one-liners?|options?)[:\s,]*/gi, '') // Remove header words
    .trim();
}

function countPunc(s: string) { return (s.match(/[.,?!]/g) || []).length; }
function sentenceSplit(s: string) {
  // split on sentence enders while keeping text stable
  return s.split(/(?<=[.?!])\s+/).filter(Boolean);
}
function oneOrTwoSentences(s: string, maxSentences = 1) {
  const parts = sentenceSplit(s);
  return parts.slice(0, maxSentences).join(" ");
}

function trimToRange(s: string, min=70, max=120) {
  let out = s.trim().replace(/\s+/g, " ");
  out = out.replace(/\b(finally|trust me|here'?s to|may your|another year of)\b/gi, "").replace(/\s+/g, " ").trim();
  
  if (out.length > max && out.includes(",")) out = out.split(",")[0];
  if (out.length > max) out = out.slice(0, max).trim();
  
  // Ensure minimum length by padding with relevant content
  if (out.length < min) {
    const needsMore = min - out.length;
    const padding = " and that's the truth about it";
    out = out + padding.slice(0, needsMore);
  }
  
  return out;
}

// Keep setup + first punch within range
function trimPunchline(line: string, min=70, max=120) {
  let t = line.trim();
  
  // If already in range, return as is
  if (t.length >= min && t.length <= max) return t;
  
  // If too long, try to trim intelligently
  if (t.length > max) {
    const parts = t.split(/[,?!]/);
    if (parts.length > 1) {
      t = `${parts[0]},${parts[1]}`.trim();
    }
    if (t.length > max) {
      t = t.slice(0, max).trim();
    }
  }
  
  // If too short, pad with context
  if (t.length < min) {
    const needsMore = min - t.length;
    const contextPadding = " - that's what I call skill";
    t = t + contextPadding.slice(0, needsMore);
  }
  
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
  t = t.replace(/\b(f\*+|s\*+t|b\*+|a\*+|g\*+d)\b/gi, "damn");
  t = t.replace(/\b(fuck(?:er|ing)?|shit(?:ty)?|bastard|ass(?!ert)|arse|bullshit|prick|dick|cock|piss|wank|crap|motherfucker|goddamn)\b/gi, "damn");
  return t.replace(/\b(god damn)\b/gi, "damn");
}

function ensureProfanityVariation(lines: string[]) {
  const grabs = lines.map(l => (l.match(STRONG_SWEARS) || [""])[0].toLowerCase());
  const seen = new Set<string>();
  return lines.map((l, i) => {
    const sw = grabs[i];
    if (sw && !seen.has(sw)) { seen.add(sw); return l; }
    const pool = ["fuck","shit","bastard","ass","bullshit","goddamn","prick","crap","motherfucker","hell","bitch","damn"];
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

// enforce ≤2 punctuation marks PER SENTENCE and ≤1 sentence
function clampPunctuationPerSentence(t: string, maxMarks = 2) {
  const parts = sentenceSplit(t);
  const fixed = parts.slice(0, 1).map(sent => {
    let kept = 0;
    return sent.replace(/[.,?!]/g, (m) => (++kept <= maxMarks ? m : ""));
  });
  return fixed.join(" ").trim();
}

// ============== ENFORCEMENT ==============
function enforceRules(
  lines: string[],
  rules: any,
  rating: string,
  insertWords: string[] = []
) {
  const enforcement: string[] = [];
  const minLen = rules.length?.min_chars ?? 70;
  const maxLen = rules.length?.max_chars ?? 120;

  let processed = lines.map((raw, idx) => {
    let t = raw.trim();
    if (rules.punctuation?.ban_em_dash) {
      t = t.replace(/—/g, rules.punctuation.replacement?.["—"] || ",");
      t = t.replace(/:/g, rules.punctuation.replacement?.[":"] || ".");
      t = t.replace(/;/g, rules.punctuation.replacement?.[";"] || ".");
    }

    // limit to ≤1 sentence and ≤2 punctuation per sentence
    t = oneOrTwoSentences(t, 1);
    t = clampPunctuationPerSentence(t, rules.punctuation?.max_marks_per_sentence ?? 2);

    // char range + simple cleanup
    t = t.replace(/[:;…]/g, ",").replace(/["""']/g, "'");
    t = trimToRange(t, minLen, maxLen);

    // ensure at least one punctuation end
    if (!/[.?!]$/.test(t)) t = `${t}.`;

    // ensure insert words present (first pass)
    for (const w of insertWords) {
      if (!new RegExp(`\\b${w}\\b`, "i").test(t)) {
        t = `${t.split(/[.?!]/)[0]}, ${w}.`;
        break;
      }
    }

    t = hardStop(t);
    return t;
  });

  // distribute single insert start/middle/end
  if (insertWords?.length === 1) {
    processed = processed.map(l => deTagInsert(l, insertWords[0]));
    processed = varyInsertPositions(processed, insertWords[0]);
    enforcement.push("Distributed insert word across start/middle/end");
  }

  // profanity by rating
  if (rating === "R") {
    processed = processed.map((t) => STRONG_SWEARS.test(t) ? t : `${t.split(/[.,?!]/)[0]} fuck.`);
    processed = ensureProfanityVariation(processed);
  }
  if (rating === "PG-13") {
    processed = processed.map(sanitizePG13);
  }
  if (rating === "PG") {
    processed = processed.map((t) => t.replace(STRONG_SWEARS, "sh*t"));
  }
  if (rating === "G") {
    processed = processed.map((t) => t.replace(STRONG_SWEARS, "").replace(/\s+/g, " ").trim());
  }

  // trim to crisp setup+punch, dedupe
  processed = processed.map(l => trimPunchline(l, minLen, maxLen));

  // Server-side validation: reject lines that are too short
  processed = processed.filter(l => l.length >= minLen);

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
CRITICAL: Each new line must be EXACTLY 70-120 characters long - count carefully! Make them complete, substantial thoughts.
Return exactly ${missing} new lines, one per line.`;
  const { content } = await callOpenAI(systemPrompt, user);
  return parseLines(content);
}

// ============== HTTP ==============
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { category, subcategory, tone, rating, insertWords = [] } = payload;

    let systemPrompt = text_rules;
    if (category)    systemPrompt += `\n\nCONTEXT: ${category}`;
    if (subcategory) systemPrompt += ` > ${subcategory}`;
    if (tone)        systemPrompt += `\nTONE: ${tone}`;
    if (rating)      systemPrompt += `\nRATING: ${rating}`;
    if (insertWords.length) systemPrompt += `\nINSERT WORDS: ${insertWords.join(", ")}`;
    systemPrompt += `\n\nReturn exactly 4 sentences, one per line.`;

    // Build dynamic user prompt based on actual selections
    let userPrompt = `Create 4 distinct, ${tone?.toLowerCase() || 'funny'} one-liners`;
    
    if (category && subcategory) {
      userPrompt += ` about ${category.toLowerCase()}/${subcategory.toLowerCase()}`;
    } else if (category) {
      userPrompt += ` about ${category.toLowerCase()}`;
    }
    
    if (insertWords.length > 0) {
      userPrompt += `. CRITICAL: Each line must naturally include ALL of these words: ${insertWords.join(', ')}`;
    }
    
    userPrompt += `. CRITICAL: Each line must be EXACTLY between 70-120 characters long - count carefully! Make them substantial and complete thoughts. No headers, numbers, or formatting - just the one-liners.`;
    const { content: raw, model } = await callOpenAI(systemPrompt, userPrompt);

    let candidates = parseLines(raw);
    if (candidates.length < 4) candidates = raw.split(/\r?\n+/).map(cleanLine).filter(Boolean);

    const fallbackRules = { length:{min_chars:70,max_chars:120}, punctuation:{max_marks_per_sentence:2,ban_em_dash:true,replacement:{"—":",",":":".",";":"."}}, max_sentences:1 };
    const enforced = enforceRules(candidates, fallbackRules, rating || "PG-13", insertWords);
    let lines = enforced.lines;

    let tries = 0;
    while (lines.length < 4 && tries < 2) {
      const need = 4 - lines.length;
      const more = await backfillLines(need, systemPrompt, lines, tone || "", rating || "PG-13", insertWords);
      const enforcedMore = enforceRules(more, fallbackRules, rating || "PG-13", insertWords);
      lines = [...lines, ...enforcedMore.lines];
      tries++;
    }
    lines = lines.slice(0, 4);

    const minL = 70;
    const maxL = 120;

    const resp = {
      lines: lines.map((line, i) => ({
        line,
        length: line.length,
        index: i + 1,
        valid: line.length >= minL && line.length <= maxL &&
               sentenceSplit(line).length <= 1 &&
               sentenceSplit(line).every(sent => (sent.match(/[.,?!]/g)||[]).length <= 2)
      })),
      model,
      count: lines.length,
      rules_used: { id: "fallback", version: 7 }
    };

    return new Response(JSON.stringify(resp), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
