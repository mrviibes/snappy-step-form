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

// allow only . , ? !  → replace other punctuation with space (no asterisks)
function sanitizePunct(s: string): string {
  return (s || "").replace(/[;:()\[\]{}"\/\\<>|~`^_*@#\$%&+=–—]/g, " ").replace(/\s{2,}/g, " ").trim();
}

// strong comma hygiene
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

// drop label/meta lines
function isMetaLine(s: string): boolean {
  return /^\s*(tone|rating|specific(?:\s+)?words?|insert(?:\s+)?words?|process|category|context|rules?)\s*:/i.test(s);
}

// Fix orphan "'s" when the name was removed earlier
function fixOrphanPossessive(line: string, word: string): string {
  return line.replace(/(^|[^\p{L}\p{N}’'])(?='s\b)/u, (_m, p1) => `${p1}${word}`);
}

// Already contains insert (base or possessive)?
function hasInsertAlready(s: string, word: string): boolean {
  const base = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
  const poss = new RegExp(`\\b${escapeRegExp(word)}'s\\b`, "i");
  return base.test(s) || poss.test(s);
}

// Insert a specific word once, placed mid-sentence when possible (never end on the name)
function placeWordNaturally(line: string, word: string): string {
  if (!word) return line;
  if (hasInsertAlready(line, word)) return tidyCommas(line);

  let s = fixOrphanPossessive(line, word)
    .replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi"), "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (s.includes(",")) {
    s = s.replace(",", `, ${word},`).replace(/,\s*,/g, ", ");
  } else {
    const i = s.indexOf(" ");
    s = i > 0 ? s.slice(0, i) + " " + word + s.slice(i) : `${word} ${s}`;
  }

  // Never end on the name
  s = s.replace(new RegExp(`${escapeRegExp(word)}\\s*[.!?]?$`, "i"), `${word},`);
  return tidyCommas(s);
}

// distribute Insert Words: exactly one per line, placed naturally
function distributeSpecificWords(lines: string[], words: string[]): string[] {
  const norm = (words || []).map(w => (w || "").trim()).filter(Boolean);
  if (!norm.length) return lines;
  return lines.map((line, i) => {
    const target = norm[i % norm.length];
    const placed = hasInsertAlready(line, target) ? line : placeWordNaturally(line, target);
    const cleaned = ensureEndPunct(tidyCommas(placed.replace(/,\s*([.!?])/g, "$1")));
    return cleaned;
  });
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

// ---------------- Rating enforcement (no asterisks anywhere) ----------------

// Strong profanities (+ common inflections)
const RX_STRONG = [
  /\bfuck(?:ing|er|ed|s)?\b/gi,
  /\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi,
  /\bbullshit\b/gi,
];

// Medium profanities (blocked in PG & PG-13)
const MEDIUM_WORDS = ["bastard","asshole","prick","dick","douche","crap"];

// Utility
function containsAny(s: string, list: string[]) {
  const low = s.toLowerCase();
  return list.some((w) => new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(low));
}

// Un-censor and fix space-mangled swears for R (f**king → fucking, f king → fucking, s t → shit)
function uncensorStrongForR(s: string): string {
  return (s || "")
    .replace(/\bf\*\*k(ing|er|ed|s)?\b/gi, "fuck$1")
    .replace(/\bs\*\*t(ting|ty|face(?:d)?|s|ted)?\b/gi, "shit$1")
    .replace(/\bbull\*\*t\b/gi, "bullshit")
    .replace(/\bf\s*k(ing|er|ed|s)?\b/gi, "fuck$1")
    .replace(/\bs\s*t(ting|ty|face(?:d)?|s|ted)?\b/gi, "shit$1")
    .replace(/\bbull\s*shit\b/gi, "bullshit");
}

// R: weave profanity after name/comma if needed, keep one strong swear, never end on it
function weaveProfanityR(line: string, names: string[]): string {
  let out = uncensorStrongForR(line);
  if (containsAny(out, ["fuck","fucking","shit","bullshit"])) return out;

  for (const name of names) {
    const rx = new RegExp(`\\b(${escapeRegExp(name)})\\b(?!\\s+(?:fuck|fucking|shit))`, "i");
    if (rx.test(out)) return out.replace(rx, `$1 you fuck`);
  }
  if (out.includes(",")) return out.replace(",", ", you fuck,").replace(/,\s*,/g, ", ");
  const i = out.indexOf(" ");
  return i > 0 ? out.slice(0, i) + " fuck" + out.slice(i) : out + " fuck";
}

function normalizeProfanityR(line: string, names: string[]): string {
  let out = uncensorStrongForR(line);

  // Keep exactly one strong swear; drop extras
  let kept = false;
  out = out.replace(/\b(fuck(?:ing|er|ed|s)?|shit(?:ting|ty|faced?)?|bullshit)\b/gi, (m) => {
    if (kept) return ""; kept = true; return m;
  }).replace(/\s{2,}/g," ").trim();

  // Ensure placement
  const name = (names && names[0]) || "";
  if (name) {
    const afterName = new RegExp(`\\b${escapeRegExp(name)}\\b\\s+(?:you\\s+)?(?:fuck|fucking|shit)`, "i");
    if (!afterName.test(out)) out = weaveProfanityR(out, names);
  } else if (!/,/.test(out)) {
    const i = out.indexOf(" ");
    out = i > 0 ? out.slice(0, i) + " fuck" + out.slice(i) : out + " fuck";
  }

  // Don’t end on a swear
  out = out.replace(/\b(fuck|fucking|shit|bullshit)[.!?]?\s*$/i, "$1, champ");
  return out.trim();
}

// PG: replace strong with mild fully spelled; remove medium entirely
function replaceStrongForPG(s: string): string {
  let out = s;
  for (const rx of RX_STRONG) {
    out = out.replace(rx, (m) => {
      if (/fuck/i.test(m))  return "heck";
      if (/shit/i.test(m))  return "mess";
      if (/bull/i.test(m))  return "nonsense";
      return "heck";
    });
  }
  for (const w of MEDIUM_WORDS) {
    const rx = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
    out = out.replace(rx, "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

// PG-13: only hell/damn; ban goddamn and all stronger/medium
function enforcePG13(s: string): string {
  let out = s;
  for (const rx of RX_STRONG) out = out.replace(rx, "");
  for (const w of MEDIUM_WORDS) {
    const rx = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
    out = out.replace(rx, "");
  }
  out = out.replace(/\bgod[-\s]?damn(ed|ing)?\b/gi, "").replace(/\bdammit\b/gi, "");
  const hasHell = /\bhell\b/i.test(out);
  out = hasHell ? out.replace(/\bdamn\b/gi, "") : out.replace(/\bhell\b/gi, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

// Fix lingering ",."
function fixCommaPeriod(s: string) { return s.replace(/,\s*([.!?])/g, "$1"); }

function enforceRatingLine(s: string, rating: string, names: string[]): string {
  let line = s.trim();
  const r = (rating || "G").toUpperCase();

  if (r === "R") {
    line = normalizeProfanityR(line, names);
  } else if (r === "PG-13" || r === "PG13") {
    line = enforcePG13(line);
  } else if (r === "PG") {
    line = replaceStrongForPG(line);
  } else {
    // G: strip anything remotely profane
    for (const rx of RX_STRONG) line = line.replace(rx, "");
    for (const w of [...MEDIUM_WORDS, "hell","damn"]) {
      const rx = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
      line = line.replace(rx, "");
    }
  }

  // Final hygiene
  line = line.replace(/\s{2,}/g," ").trim();
  line = fixCommaPeriod(line);
  line = tidyCommas(line);
  line = limitPunctPerLine(line);
  line = clampLen(line);
  line = ensureEndPunct(line);
  return line;
}

// Diversify R lines so they don't all read "Name, you fuck,"
function diversifyRLines(lines: string[], names: string[]): string[] {
  const name = (names && names[0]) || "";
  const youFuckRx = name
    ? new RegExp(`\\b${escapeRegExp(name)}\\b,?\\s*you\\s+(?:fuck|fucking)`, "i")
    : /\byou\s+(?:fuck|fucking)\b/i;

  const variants = [
    (s: string) => name ? s.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "i"), `${name}, you glorious fuck`) : s,
    (s: string) => s.includes(",") ? s.replace(",", ", you lucky fuck,") : s,
    (s: string) => s.replace(/\b(let's)\b/i, `$1 fucking`).replace(/\b(go|eat|party|blow|dance)\b/i, `fucking $1`)
  ];

  return lines.map((line, i) => {
    let out = line;

    if (youFuckRx.test(out)) {
      const v = variants[i % variants.length];
      out = v(out);
      // ensure only one strong swear remains
      let kept = false;
      out = out.replace(/\b(fuck(?:ing|er|ed|s)?|shit(?:ting|ty|faced?)?|bullshit)\b/gi, m => {
        if (kept) return ""; kept = true; return m;
      }).replace(/\s{2,}/g," ").trim();
    } else if (!/\b(fuck|fucking|shit|bullshit)\b/i.test(out)) {
      // if somehow none left, weave one in
      out = out.includes(",") ? out.replace(",", ", you glorious fuck,") :
        (name ? `${name}, you glorious fuck, ${out}` : `Buddy, you glorious fuck, ${out}`);
    }

    return out;
  });
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

    // Select rule block by exact category ID
    const cat = (category || "").toLowerCase().trim();
    let used_rules = "general_text_rules";
    let systemPrompt = general_text_rules;

    switch (cat) {
      case "jokes": systemPrompt = joke_text_rules; used_rules = "joke_text_rules"; break;
      case "celebrations": systemPrompt = celebration_text_rules; used_rules = "celebration_text_rules"; break;
      case "daily-life":
      case "daily life": systemPrompt = daily_life_text_rules; used_rules = "daily_life_text_rules"; break;
      case "sports": systemPrompt = sports_text_rules; used_rules = "sports_text_rules"; break;
      case "pop-culture":
      case "pop culture": systemPrompt = pop_culture_text_rules; used_rules = "pop_culture_text_rules"; break;
      case "miscellaneous": systemPrompt = miscellaneous_text_rules; used_rules = "miscellaneous_text_rules"; break;
      case "custom":
      case "custom-design": systemPrompt = custom_design_text_rules; used_rules = "custom_design_text_rules"; break;
      default: break;
    }

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
    userPrompt += ` One sentence per line, ≤2 punctuation marks, ≤120 characters. Keep lines celebratory and FOR the honoree; witty, concrete, occasion-specific. Use one concrete birthday detail (age, candles, cake, wrinkles). Avoid limp filler; end with a clean punch.`;

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

    // distribute Insert Word
    const specificWords = (insertWords || []).map(w => (w || "").trim()).filter(Boolean);
    lines = distributeSpecificWords(lines, specificWords);

    // enforce leaf token presence
    lines = lines.map(s => enforceLeafPresence(s, leafTokens));

    // Pre-rating hygiene
    lines = lines.map(s =>
      ensureEndPunct(limitPunctPerLine(clampLen(tidyCommas(sanitizePunct(s)))))
    );

    // dedupe bigrams
    lines = dampenDuplicatePairs(lines);

    // rating enforcement (PG mild words; PG-13 hell/damn only; R woven single-strong)
    lines = lines.map(s => enforceRatingLine(s, rating || "G", specificWords));

    // diversify R lines so they don't all look the same
    if ((rating || "G").toUpperCase() === "R") {
      lines = diversifyRLines(lines, specificWords);
    }

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
