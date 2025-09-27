import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const text_rules = "SYSTEM INSTRUCTIONS — ONE-LINERS & JOKES";

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
    .replace(/\s+([,?!])/g, "$1")
    .replace(/([,?!])([A-Za-z])/g, "$1 $2")
    .replace(/([.?!])[.?!]+$/g, "$1");
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
    const words = l.split(" ");
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
    // simple meaningful tail
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

    // Merge tokens with specificWords variants
    const uiWords = Array.isArray(specificWords) ? specificWords
                  : typeof specificWords === "string" ? [specificWords]
                  : Array.isArray(specific_words) ? specific_words
                  : typeof specific_words === "string" ? [specific_words]
                  : [];
    const baseTokens: string[] = Array.isArray(tokens) ? tokens : [];
    const mergedTokens = Array.from(new Set([...baseTokens, ...uiWords].filter(Boolean)));

    // If custom text provided, return it
    if (customText && String(customText).trim()) {
      const lines = String(customText).split("\n").map((s) => s.trim()).filter(Boolean).slice(0,4);
      return new Response(JSON.stringify({ candidates: lines, success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build prompt
    let prompt = text_rules;

    if (category) {
      prompt += "\n\nCATEGORY: " + category;
      if (subcategory) prompt += " > " + subcategory;
    }
    if (tone) prompt += "\n\nTONE: " + tone;
    const normRating = normalizeRating(rating);
    prompt += "\n\nRATING: " + normRating;
    if (mergedTokens.length) prompt += "\n\nTOKENS TO INCLUDE: " + mergedTokens.join(", ");

    // humor nudges
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
        .filter((l: string) => l && !/^\d+\.?\s/.test(l))
        .slice(0, 4);
    }

    // Generate
    let lines = await callOnce();

    // --------- Post-process enforcement ----------
    const tokenList = mergedTokens.map((t: string) => String(t).trim()).filter(Boolean);
    const primaryToken = tokenList[0]; // used for position variety if only one

    // Clean, drop Q&A, one sentence, end mark, enforce rating, punctuation budget, token inclusion
    lines = lines.map((l: string) => l.trim())
      .filter((l: string) => !QNA_START.test(l)) // drop Q&A scaffolds
      .map(oneSentenceOnly)
      .map(punctFix)
      .map(endPunct)
      .map((l: string) => enforceRating(l, normRating))
      .map((l: string) => {
        // ensure tokens
        if (tokenList.length) {
          for (const tok of tokenList) {
            const re = new RegExp("\\b" + tok + "\\b", "i");
            if (!re.test(l)) {
              // insert mid-sentence
              const words = l.replace(/[.?!]\s*$/, "").split(" ");
              const idx = Math.max(1, Math.min(words.length - 2, Math.floor(words.length / 2)));
              words.splice(idx, 0, tok);
              l = endPunct(words.join(" "));
            }
          }
        }
        // clamp punctuation budget
        if (countPunc(l) > 3) {
          let kept = 0;
          l = l.replace(/[.,?!]/g, (m) => (++kept <= 3 ? m : ""));
        }
        return l;
      });

    // enforce token position variety when single token
    if (primaryToken && lines.length) lines = varyInsertPositions(lines, primaryToken);

    // Length variety
    const idxs = [0,1,2,3].sort(() => Math.random() - 0.5);
    lines = lines.map((l, i) => normalizeLength(l, LENGTH_BUCKETS[idxs[i % LENGTH_BUCKETS.length]]));

    // If we lost lines (Q&A dropped), regenerate once to backfill
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
