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
  custom_design_text_rules
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------- Types ----------------
interface GeneratePayload {
  category: string;
  subcategory?: string;
  theme?: string;           // deepest leaf (preferred)
  tone?: string;
  rating?: string;
  insertWords?: string[];   // e.g., ["Jesse"]
}

// ---------------- Helpers ----------------
const MAX_LEN = 120;

function clampLen(s: string, n = MAX_LEN): string {
  if (!s) return s;
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,\s]*$/, "") + ".";
}
function ensureEndPunct(s: string): string { return /[.!?]$/.test(s) ? s : s + "."; }

// allow only . , ? !  → replace other punctuation with space
function sanitizePunct(s: string): string {
  return (s || "").replace(/[;:()\[\]{}"/\\<>|~`^_*@#\$%&+=–—]/g, " ").replace(/\s{2,}/g, " ").trim();
}

// strong comma hygiene: kill leading commas, collapse runs, space-after, never space-before
function tidyCommas(s: string): string {
  if (!s) return s;
  let out = s.replace(/^\s*,+\s*/g, "");
  out = out.replace(/(\s*,\s*)+/g, ", ");
  out = out.replace(/\s+,/g, ",");
  out = out.replace(/,(?!\s|$)/g, ", ");
  return out.replace(/\s{2,}/g, " ").trim();
}

// punctuation cap: keep at most two of . , ? !
function limitPunctPerLine(s: string): string {
  const allowed = new Set([".", ",", "!", "?"]);
  let count = 0, out = "";
  for (const ch of s) {
    if (allowed.has(ch)) { count++; if (count <= 2) out += ch; }
    else out += ch;
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// drop label/meta lines like "TONE:", "RATING:", "SPECIFIC WORDS:", etc.
function isMetaLine(s: string): boolean {
  return /^\s*(tone|rating|specific(?:\s+)?words?|process|category|context|rules?)\s*:/i.test(s);
}

// Fix orphan "'s" when the name was removed earlier
function fixOrphanPossessive(line: string, word: string): string {
  return line.replace(/(^|[^\p{L}\p{N}’'])(?='s\b)/u, (_m, p1) => `${p1}${word}`);
}

// Insert a specific word once, placed mid-sentence when possible
function placeWordNaturally(line: string, word: string): string {
  if (!word) return line;
  let s = fixOrphanPossessive(line, word);

  // Remove naked instances (leave possessives intact)
  const rx = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
  s = s.replace(rx, "").replace(/\s{2,}/g, " ").trim();

  if (s.includes(",")) {
    s = s.replace(",", `, ${word},`).replace(/,\s*,/g, ", ");
    return s;
    }
  const firstSpace = s.indexOf(" ");
  if (firstSpace > 0) s = s.slice(0, firstSpace) + " " + word + s.slice(firstSpace);
  else s = `${word} ${s}`;
  return s;
}

// distribute Specific Words: exactly one per line, placed naturally
function distributeSpecificWords(lines: string[], words: string[]): string[] {
  const norm = (words || []).map(w => (w || "").trim()).filter(Boolean);
  if (!norm.length) return lines; // bug fix: don't map to a function
  return lines.map((line, i) => ensureEndPunct(tidyCommas(placeWordNaturally(line, norm[i % norm.length]))));
}

function enforceLeafPresence(s: string, leafTokens: string[]): string {
  if (!leafTokens.length) return s;
  const low = s.toLowerCase();
  if (leafTokens.some(t => low.includes(t))) return s;
  const add = leafTokens.find(t => t.length > 3) || leafTokens[0];
  return add ? s.replace(/\.$/, "") + `, ${add}.` : s;
}

// Basic duplicate bigram dampener across lines
function dampenDuplicatePairs(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.map((line, idx) => {
    const tokens = line.toLowerCase().replace(/[^a-z0-9\s’'-]/gi, "").split(/\s+/).filter(Boolean);
    const bigrams = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) bigrams.add(tokens[i] + " " + tokens[i + 1]);
    const overlap = [...bigrams].some(b => seen.has(b));
    for (const b of bigrams) seen.add(b);
    if (!overlap) return line;
    const add = ["today", "tonight", "this year", "right now"][idx % 4];
    return clampLen(line.replace(/\.$/, "") + ` ${add}.`);
  });
}

// -------- Rating enforcement (hard, with PG-13 tightening) --------
const R_WORDS = ["fuck","fucking","shit","bullshit"]; // no slurs
const PG13_ALLOWED = ["hell","damn"];
const MEDIUM_PROFANITY = ["bastard","asshole","prick","dick","douche","crap"]; // extend if needed
const PG_CENSOR = [/fuck/gi,/shit/gi,/bullshit/gi,/fucking/gi];

function containsAny(s: string, list: string[]) {
  const low = s.toLowerCase();
  return list.some(w => low.includes(w));
}

// For R: weave profanity after name/comma/first word; avoid ending on it
function weaveProfanity(line: string, names: string[]): string {
  if (containsAny(line, R_WORDS)) return line;
  for (const name of names) {
    const rx = new RegExp(`\\b(${escapeRegExp(name)})\\b(?!\\s+(?:fuck|fucking))`, "i");
    if (rx.test(line)) return line.replace(rx, `$1 fuck`);
  }
  if (line.includes(",")) return line.replace(",", ", you lucky fuck,").replace(/,\s*,/g, ", ");
  const i = line.indexOf(" ");
  return i > 0 ? line.slice(0, i) + " fuck" + line.slice(i) : line + " fuck";
}

function censorPG(s: string) {
  let out = s;
  for (const rx of PG_CENSOR) out = out.replace(rx, (m) => m[0] + "**" + (m.length > 1 ? m.slice(-1) : ""));
  return out;
}

function enforceRatingLine(s: string, rating: string, names: string[]): string {
  let line = s.trim();

  if (/^R$/i.test(rating)) {
    line = weaveProfanity(line, names);
    // don't end on profanity
    line = line.replace(/\b(fuck|fucking|shit|bullshit)[.!?]?\s*$/i, "$1, legend");
  } else if (/^PG-?13$/i.test(rating)) {
    line = censorPG(line);
    for (const w of [...R_WORDS, ...MEDIUM_PROFANITY]) {
      const rx = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
      line = line.replace(rx, "");
    }
    // keep at most one of hell/damn
    const hadHell = /\bhell\b/i.test(line);
    line = hadHell ? line.replace(/\bdamn\b/gi, "") : line.replace(/\bhell\b/gi, "");
    line = line.replace(/\s{2,}/g," ").trim();
  } else if (/^PG$/i.test(rating)) {
    line = censorPG(line);
  } else if (/^G$/i.test(rating)) {
    for (const w of [...R_WORDS, ...PG13_ALLOWED, ...MEDIUM_PROFANITY]) {
      const rx = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
      line = line.replace(rx, "");
    }
    line = line.replace(/\s{2,}/g," ").trim();
  }

  // sanitize + commas + punct cap + length + final dot
  line = sanitizePunct(line);
  line = tidyCommas(line);
  line = limitPunctPerLine(line);
  line = clampLen(line);
  line = ensureEndPunct(line);
  return line;
}

// -------------- Server --------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload: GeneratePayload = await req.json();
    const { category, subcategory, tone, rating, insertWords = [], theme } = payload;
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // Compute leaf focus tokens
    const leaf = (theme || subcategory || "").trim();
    const leafTokens = leaf.toLowerCase().split(/[^\p{L}\p{N}’'-]+/u).filter(w => w.length > 2);

    // Select rule block by category
    const cat = (category || "").toLowerCase();
    let used_rules = "general_text_rules";
    let systemPrompt = general_text_rules;

    if (/\bjoke(s)?\b/.test(cat)) { systemPrompt = joke_text_rules; used_rules = "joke_text_rules";
    } else if (/\bcelebration(s)?\b/.test(cat)) { systemPrompt = celebration_text_rules; used_rules = "celebration_text_rules";
    } else if (/\bdaily\b/.test(cat)) { systemPrompt = daily_life_text_rules; used_rules = "daily_life_text_rules";
    } else if (/\bsport(s)?\b/.test(cat)) { systemPrompt = sports_text_rules; used_rules = "sports_text_rules";
    } else if (/\b(pop|culture|pop[-\s]?culture)\b/.test(cat)) { systemPrompt = pop_culture_text_rules; used_rules = "pop_culture_text_rules";
    } else if (/\bmisc\b/.test(cat)) { systemPrompt = miscellaneous_text_rules; used_rules = "miscellaneous_text_rules";
    } else if (/\b(custom|design)\b/.test(cat)) { systemPrompt = custom_design_text_rules; used_rules = "custom_design_text_rules"; }

    // Context + format
    systemPrompt += `
CONTEXT
- CATEGORY: ${category || "n/a"}
- SUBCATEGORY: ${subcategory || "n/a"}
- THEME (LEAF FOCUS): ${leaf || "n/a"}

CRITICAL FORMAT: Return exactly 4 separate lines only. Each line must be one complete sentence ending with punctuation. Do not output labels, headings, or bullet points.`;

    // User prompt
    let userPrompt =
      `Write 4 ${(tone || "Humorous")} one-liners that clearly center on "${leaf || "the selected theme"}".`;
    if (/\bjokes?\b/i.test(cat)) {
      userPrompt += ` Never say humor labels (dad-joke, pun, joke/jokes); imply the style only.`;
    }
    if (insertWords.length) {
      userPrompt += ` Each line must naturally include exactly one of: ${insertWords.join(", ")}.`;
    }
    userPrompt += ` One sentence per line, ≤2 punctuation marks, ≤120 characters. Keep lines celebratory and FOR the honoree; witty, concrete, occasion-specific. Use one concrete birthday detail (age, candles, cake, wrinkles).`;

    // Call Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]}],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 300
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse raw → candidate lines
    let lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    // drop label/meta lines
    lines = lines.filter(l => !isMetaLine(l));

    // If paragraphs, split on sentences
    if (lines.length < 4) {
      const fallback = raw.replace(/\r/g," ")
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => !isMetaLine(s));
      if (fallback.length >= 4) lines = fallback;
    }

    // keep exactly 4
    if (lines.length > 4) lines = lines.slice(0, 4);
    while (lines.length < 4) lines.push(leaf ? `Celebrating ${leaf} with you.` : `Celebrating you today.`);

    // distribute Specific Word
    const specificWords = (insertWords || []).map(w => (w || "").trim()).filter(Boolean);
    lines = distributeSpecificWords(lines, specificWords);

    // enforce leaf token presence
    lines = lines.map(s => enforceLeafPresence(s, leafTokens));

    // sanitize + commas + punct cap + length + end punct (pre-rating)
    lines = lines.map(s =>
      ensureEndPunct(limitPunctPerLine(clampLen(tidyCommas(sanitizePunct(s)))))
    );

    // dedupe bigrams
    lines = dampenDuplicatePairs(lines);

    // rating enforcement (PG, PG-13, R weaving)
    lines = lines.map(s => enforceRatingLine(s, rating || "G", specificWords));

    // final safety sweep
    lines = lines.map(s =>
      ensureEndPunct(limitPunctPerLine(clampLen(tidyCommas(sanitizePunct(s)))))
    );

    return new Response(
      JSON.stringify({ options: lines, debug: { used_rules, category, subcategory, tone, rating } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-text:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Failed to generate text" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
