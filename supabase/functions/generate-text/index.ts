import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { text_rules } from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// We only need the title for the LLM; post-processing enforces everything else.

function choice<T>(items: readonly T[], weights?: readonly number[]): T {
  if (weights && weights.length !== items.length) throw new Error("Weights length must match items length");
  if (!weights) return items[Math.floor(Math.random() * items.length)];
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

// ---------- Post-process helpers ----------
const STRONG_SWEARS = /(fuck(?:er|ing)?|shit(?:ty)?|bastard|ass(?!ert)|arse|bullshit|prick|dick|cock|piss|wank|crap|motherfucker|goddamn|tits|skank|slag|twat)/gi;
const QNA_START = /^(why did|what do you call|did you hear|someone said|his buddy said|scott asked)/i;
const GREETING = /^happy birthday[,!\s]/i;

function normalizeRating(r?: string): "G"|"PG"|"PG-13"|"R" {
  const k = (r || "").toUpperCase().replace(/\s+/g, "");
  if (k === "G") return "G";
  if (k === "PG") return "PG";
  if (k === "PG-13" || k === "PG13") return "PG-13";
  if (k === "R") return "R";
  return "PG-13";
}

function endPunct(s: string) { s = s.trim(); if (!/[.?!]$/.test(s)) s += "."; return s; }
function punctFix(s: string) {
  return s
    .replace(/\s+([,?!])/g, "$1")            // no space before , ? !
    .replace(/([,?!])([A-Za-z])/g, "$1 $2")  // space after , ? !
    .replace(/([.?!])[.?!]+$/g, "$1");       // collapse multiple end marks
}

function countPunc(s: string) {
  const m = s.match(/[.,?!]/g); return m ? m.length : 0;
}

function oneSentenceOnly(s: string) {
  const parts = s.split(/[.?!]/).filter(Boolean);
  if (parts.length <= 1) return s;
  return parts[0].trim() + ".";
}

function varyInsertPositions(lines: string[], token: string) {
  const targets = ["start", "middle", "end", "any"].sort(() => Math.random() - 0.5);
  return lines.map((l, i) => {
    const t = targets[i % targets.length];
    if (new RegExp("\\b" + token + "\\b", "i").test(l)) return l;
    if (t === "start") return (token + ", " + l).replace(/\s+/g, " ");
    if (t === "end") return l.replace(/[.?!]\s*$/, "") + ", " + token + ".";
    // middle
    const words = l.replace(/[.?!]\s*$/, "").split(" ");
    const idx = Math.max(1, Math.min(words.length - 2, Math.floor(words.length / 2)));
    words.splice(idx, 0, token);
    return endPunct(words.join(" "));
  });
}

const LENGTH_BUCKETS = [68, 85, 105, 118];
function normalizeLength(l: string, target: number) {
  let s = l.trim();
  if (s.length > target + 6) {
    s = s.slice(0, target).replace(/\s+\S*$/, "").trim();
  } else if (s.length < Math.max(60, target - 8)) {
    const tails = [
      "which feels exactly right today",
      "and somehow that was the highlight",
      "and the room politely agreed",
      "which tracks, given the evidence",
    ];
    s = s.replace(/[.?!]\s*$/, "");
    s += ", " + tails[Math.floor(Math.random() * tails.length)] + ".";
  }
  return endPunct(s);
}

function enforceRating(s: string, rating: "G"|"PG"|"PG-13"|"R") {
  if (rating === "R") return s;
  if (rating === "PG-13") {
    return s.replace(STRONG_SWEARS, "damn").replace(/\bshitshow\b/gi, "mess");
  }
  if (rating === "PG") {
    return s.replace(STRONG_SWEARS, (m) => {
      if (/fuck/i.test(m)) return "f***";
      if (/shit/i.test(m)) return "sh*t";
      return "d***";
    });
  }
  // G
  return s.replace(STRONG_SWEARS, "").replace(/\s+/g, " ").trim();
}

// Prevent profanity adjacent to tokens: inserts a soft buffer word or moves token
function deAdjacentProfanity(s: string, tokens: string[]) {
  let out = s;
  for (const t of tokens) {
    const re1 = new RegExp(`\\b${t}\\b\\s+(fuck|shit|damn|hell)`, "i");
    const re2 = new RegExp(`\\b(fuck|shit|damn|hell)\\s+${t}\\b`, "i");
    if (re1.test(out)) out = out.replace(re1, `${t} really $1`);
    if (re2.test(out)) out = out.replace(re2, `$1, ${t}`);
  }
  return out;
}

// Bigram de-dup across 4 lines
function bigramSet(s: string) {
  const w = s.toLowerCase().replace(/[^\w\s']/g,"").split(/\s+/).filter(Boolean);
  const set = new Set<string>();
  for (let i=0;i<w.length-1;i++) set.add(`${w[i]} ${w[i+1]}`);
  return set;
}
function bigramOverlap(a: string, b: string) {
  const A = bigramSet(a), B = bigramSet(b);
  const inter = [...A].filter(x => B.has(x)).length;
  return inter / Math.max(1, Math.min(A.size, B.size));
}
function dedupeFuzzy(lines: string[], threshold = 0.6) {
  const out: string[] = [];
  for (const l of lines) {
    if (!out.some(x => bigramOverlap(l, x) >= threshold)) out.push(l);
  }
  return out;
}

// ---------- HTTP ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();

    const {
      category,
      subcategory,
      tone,
      rating,
      tokens,
      customText,
      specificWords,
      specific_words
    } = payload ?? {};

    // Merge tokens with specificWords variants (exact spelling preserved)
    const uiWords = Array.isArray(specificWords) ? specificWords
                  : typeof specificWords === "string" ? [specificWords]
                  : Array.isArray(specific_words) ? specific_words
                  : typeof specific_words === "string" ? [specific_words]
                  : [];
    const baseTokens: string[] = Array.isArray(tokens) ? tokens : [];
    const mergedTokens = Array.from(new Set([...baseTokens, ...uiWords]
      .filter(Boolean)
      .map((w) => String(w).trim())));

    // If custom text provided, return it verbatim (max 4)
    if (customText && String(customText).trim()) {
      const lines = String(customText).split("\n").map((s) => s.trim()).filter(Boolean).slice(0,4);
      return new Response(JSON.stringify({ candidates: lines, success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build prompt for LLM (rules live server-side; we still hint the context)
    let prompt = text_rules;
    if (category) {
      prompt += "\n\nCATEGORY: " + category;
      if (subcategory) prompt += " > " + subcategory;
    }
    if (tone) prompt += "\n\nTONE: " + tone;
    const normRating = normalizeRating(rating);
    prompt += "\n\nRATING: " + normRating;
    if (mergedTokens.length) prompt += "\n\nTOKENS TO INCLUDE: " + mergedTokens.join(", ");

    // subtle birthday nudge
    const isBirthday = (category || "").toLowerCase().startsWith("celebrations") && /birthday/i.test(subcategory || "");
    if (isBirthday) {
      prompt += "\n\nHUMOR NUDGE — BIRTHDAY\n- Prefer oddly-specific birthday props (cake collapse, fire-hazard candles, sagging balloons, confetti cleanup, wish inflation).\n- Avoid cliché \"trip around the sun\" or bodily function jokes.\n- One sentence only; land the punch in the last 3–6 words.";
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY not configured");

    async function callOnce(): Promise<string[]> {
      const completion = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + openaiApiKey },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 800,
          messages: [
            { role: "system", content: "You are a witty copywriter. Follow the provided rules exactly and output exactly 4 lines, one sentence per line, no numbering or bullets." },
            { role: "user", content: prompt }
          ]
        })
      });
      if (!completion.ok) {
        const t = await completion.text().catch(() => "");
        throw new Error("OpenAI API error: " + completion.status + " " + t.slice(0,300));
      }
      const data = await completion.json();
      const raw = data?.choices?.[0]?.message?.content ?? "";
      return String(raw)
        .split("\n")
        .map((l: string) => l.trim().replace(/^[-•*]\s*/, "")) // drop bullets
        .filter((l: string) => l && !/^\d+\.?\s/.test(l) && !GREETING.test(l)) // drop numbering & greetings
        .slice(0, 4);
    }

    // Generate
    let lines = await callOnce();

    // --------- Post-process enforcement ----------
    const tokenList = mergedTokens.map((t: string) => String(t).trim()).filter(Boolean);
    const primaryToken = tokenList[0];

    lines = lines.map((l: string) => l.trim())
      .filter((l: string) => !QNA_START.test(l))     // drop Q&A scaffolds
      .map(oneSentenceOnly)
      .map(punctFix)
      .map(endPunct)
      .map((l: string) => enforceRating(l, normRating))
      .map((l: string) => deAdjacentProfanity(l, tokenList)) // no swear next to tokens
      .map((l: string) => {
        // ensure tokens in every line
        if (tokenList.length) {
          for (const tok of tokenList) {
            const re = new RegExp("\\b" + tok + "\\b", "i");
            if (!re.test(l)) {
              const words = l.replace(/[.?!]\s*$/, "").split(" ");
              const idx = Math.max(1, Math.min(words.length - 2, Math.floor(words.length / 2)));
              words.splice(idx, 0, tok);
              l = endPunct(words.join(" "));
            }
          }
        }
        // punctuation budget
        if (countPunc(l) > 3) {
          let kept = 0;
          l = l.replace(/[.,?!]/g, (m) => (++kept <= 3 ? m : ""));
        }
        return l;
      });

    // token position variety if one token
    if (primaryToken && lines.length) lines = varyInsertPositions(lines, primaryToken);

    // length variety buckets
    const idxs = [0,1,2,3].sort(() => Math.random() - 0.5);
    lines = lines.map((l, i) => normalizeLength(l, LENGTH_BUCKETS[idxs[i % LENGTH_BUCKETS.length]]));

    // de-dup near-copies
    lines = dedupeFuzzy(lines, 0.6);

    // If we lost lines (dropped Q&A or dupes), regenerate once to backfill
    if (lines.length < 4) {
      const more = await callOnce();
      const needed = 4 - lines.length;
      lines = [...lines, ...more.slice(0, needed)].slice(0,4);
      lines = lines.map(oneSentenceOnly).map(punctFix).map(endPunct).map((l) => enforceRating(l, normRating));
      if (primaryToken) lines = varyInsertPositions(lines, primaryToken);
    }

    const linesOut = lines.map((l) => ({ line: l }));

    return new Response(JSON.stringify({
      success: true,
      lines: linesOut,
      model: "openai:gpt-4o-mini",
      count: linesOut.length
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in generate-text function:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
