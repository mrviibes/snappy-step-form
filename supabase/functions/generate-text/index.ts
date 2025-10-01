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

// ---------------- Helpers (single pipeline) ----------------
const MAX_LEN = 120;

const RX_STRONG = [
  /\bfuck(?:ing|er|ed|s)?\b/gi,
  /\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi,
  /\bbullshit\b/gi,
];
const MEDIUM_WORDS = ["bastard","asshole","prick","dick","douche","crap"];

function clampLen(s = "", n = MAX_LEN): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,\s]*$/, "") + ".";
}
function ensureEndPunct(s = ""): string { return /[.!?]$/.test(s) ? s : s + "."; }
function sanitizePunct(s = ""): string {
  // allow only . , ? !  → other punctuation becomes space; em/en dashes removed
  return s.replace(/[;:()\[\]{}"\/\\<>|~`^_*@#\$%&+=–—]/g, " ").replace(/\s{2,}/g, " ").trim();
}
function tidyCommas(s = ""): string {
  return s
    .replace(/^\s*,+\s*/g, "")
    .replace(/(\s*,\s*)+/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,(?!\s|$)/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function limitPunctPerLine(s = ""): string {
  const allowed = new Set([".", ",", "!", "?"]);
  let count = 0, out = "";
  for (const ch of s) { if (allowed.has(ch)) { if (++count <= 2) out += ch; } else out += ch; }
  return out.replace(/\s{2,}/g, " ").trim();
}
function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function isMetaLine(s = ""): boolean {
  return /^\s*(tone|rating|specific(?:\s+)?words?|insert(?:\s+)?words?|process|category|context|rules?)\s*:/i.test(s);
}

// ----- Insert Word placement -----
function fixOrphanPossessive(line: string, word: string): string {
  return line.replace(/(^|[^\p{L}\p{N}''])(?='s\b)/u, (_m, p1) => `${p1}${word}`);
}
function hasInsertAlready(s: string, word: string): boolean {
  const base = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
  const poss = new RegExp(`\\b${escapeRegExp(word)}'s\\b`, "i");
  return base.test(s) || poss.test(s);
}
function placeInsertWordNaturally(line: string, word: string): string {
  if (!word) return line;
  if (hasInsertAlready(line, word)) return tidyCommas(line);

  let s = fixOrphanPossessive(line, word)
    .replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi"), "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (s.includes(",")) s = s.replace(",", `, ${word},`).replace(/,\s*,/g, ", ");
  else {
    const i = s.indexOf(" ");
    s = i > 0 ? s.slice(0, i) + " " + word + s.slice(i) : `${word} ${s}`;
  }

  // Never end on the name
  s = s.replace(new RegExp(`${escapeRegExp(word)}\\s*[.!?]?$`, "i"), `${word},`);
  return tidyCommas(s);
}
function distributeInsertWords(lines: string[], words: string[]): string[] {
  const norm = (words || []).map(w => (w || "").trim()).filter(Boolean);
  if (!norm.length) return lines;
  return lines.map((line, i) => {
    const target = norm[i % norm.length];
    const placed = hasInsertAlready(line, target) ? line : placeInsertWordNaturally(line, target);
    return ensureEndPunct(tidyCommas(placed.replace(/,\s*([.!?])/g, "$1")));
  });
}
function limitInsertOnce(line: string, words: string[]): string {
  if (!words?.length) return line;
  const w = (words[0] || "").trim();
  if (!w) return line;
  let seen = false;
  const rxAny = new RegExp(`\\b(${escapeRegExp(w)}(?:'s)?)\\b`, "gi");
  return line.replace(rxAny, (m) => { if (seen) return ""; seen = true; return m; })
             .replace(/\s{2,}/g, " ").trim();
}

// ----- Leaf presence & duplicate phrasing -----
function enforceLeafPresence(s: string, leafTokens: string[]): string {
  if (!leafTokens.length) return s;
  if (leafTokens.some(t => s.toLowerCase().includes(t))) return s;
  const add = leafTokens.find(t => t.length > 3) || leafTokens[0];
  return add ? s.replace(/\.$/, "") + `, ${add}.` : s;
}
function dampenDuplicatePairs(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.map((line, idx) => {
    const tokens = line.toLowerCase().replace(/[^a-z0-9\s''-]/gi, "").split(/\s+/).filter(Boolean);
    const bigrams = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) bigrams.add(tokens[i] + " " + tokens[i + 1]);
    const overlap = [...bigrams].some(b => seen.has(b));
    for (const b of bigrams) seen.add(b);
    if (!overlap) return line;
    const add = ["today", "tonight", "this year", "right now"][idx % 4];
    return clampLen(line.replace(/\.$/, "") + ` ${add}.`);
  });
}

// ----- Rating enforcement (no asterisks, ever) -----
function uncensorStrongForR(s: string): string {
  return (s || "")
    // asterisk-censored → fully spelled
    .replace(/\bf\*\*k(ing|er|ed|s)?\b/gi, "fuck$1")
    .replace(/\bs\*\*t(ting|ty|face(?:d)?|s|ted)?\b/gi, "shit$1")
    .replace(/\bbull\*\*t\b/gi, "bullshit")
    // space-mangled → fully spelled
    .replace(/\bf\s*k(ing|er|ed|s)?\b/gi, "fuck$1")
    .replace(/\bs\s*t(ting|ty|face(?:d)?|s|ted)?\b/gi, "shit$1")
    .replace(/\bbull\s*shit\b/gi, "bullshit");
}

function replaceStrongForPG(s: string): string {
  let out = s;
  for (const rx of RX_STRONG) {
    out = out.replace(rx, (m) => /fuck/i.test(m) ? "heck" : /shit/i.test(m) ? "mess" : "nonsense");
  }
  for (const w of MEDIUM_WORDS) out = out.replace(new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi"), "");
  return out.replace(/\s{2,}/g, " ").trim();
}

function enforcePG13(s: string): string {
  let out = s;
  for (const rx of RX_STRONG) out = out.replace(rx, "");
  for (const w of MEDIUM_WORDS) out = out.replace(new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi"), "");
  out = out.replace(/\bgod[-\s]?damn(ed|ing)?\b/gi, "").replace(/\bdammit\b/gi, "");
  const hasHell = /\bhell\b/i.test(out);
  out = hasHell ? out.replace(/\bdamn\b/gi, "") : out.replace(/\bhell\b/gi, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

function fixCommaPeriod(s: string) { return s.replace(/,\s*([.!?])/g, "$1"); }

function enforceRatingLine(s: string, rating: string): string {
  let out = s.trim();
  const r = (rating || "G").toUpperCase();

  // For R-rating: only uncensor, don't inject profanity (let AI generate it naturally)
  if (r === "R") {
    out = uncensorStrongForR(out);
  }
  else if (r === "PG-13" || r === "PG13") out = enforcePG13(out);
  else if (r === "PG") out = replaceStrongForPG(out);
  else { // G
    for (const rx of RX_STRONG) out = out.replace(rx, "");
    for (const w of [...MEDIUM_WORDS, "hell", "damn"]) out = out.replace(new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi"), "");
  }

  // final hygiene
  out = out.replace(/\s{2,}/g," ").trim();
  out = fixCommaPeriod(out);
  out = tidyCommas(out);
  out = limitPunctPerLine(out);
  out = clampLen(out);
  out = ensureEndPunct(out);
  return out;
}

// -------------- Server --------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload: GeneratePayload = await req.json();
    const { category, subcategory, tone, rating, insertWords = [], theme } = payload;

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // Leaf tokens
    const leaf = (theme || subcategory || "").trim();
    const leafTokens = leaf.toLowerCase().split(/[^\p{L}\p{N}''-]+/u).filter(w => w.length > 2);

    // Rule routing
    const cat = (category || "").toLowerCase().trim();
    let used_rules = "general_text_rules";
    let systemPrompt = general_text_rules;

    switch (cat) {
      case "jokes":         systemPrompt = joke_text_rules;           used_rules = "joke_text_rules"; break;
      case "celebrations":  systemPrompt = celebration_text_rules;    used_rules = "celebration_text_rules"; break;
      case "daily-life":
      case "daily life":    systemPrompt = daily_life_text_rules;     used_rules = "daily_life_text_rules"; break;
      case "sports":        systemPrompt = sports_text_rules;         used_rules = "sports_text_rules"; break;
      case "pop-culture":
      case "pop culture":   systemPrompt = pop_culture_text_rules;    used_rules = "pop_culture_text_rules"; break;
      case "miscellaneous": systemPrompt = miscellaneous_text_rules;  used_rules = "miscellaneous_text_rules"; break;
      case "custom":
      case "custom-design": systemPrompt = custom_design_text_rules;  used_rules = "custom_design_text_rules"; break;
      default: break;
    }

    // Context + format
    systemPrompt += `
CONTEXT
- CATEGORY: ${category || "n/a"}
- SUBCATEGORY: ${subcategory || "n/a"}
- THEME (LEAF FOCUS): ${leaf || "n/a"}

CRITICAL FORMAT: Return exactly 4 separate lines only. Each line must be one complete sentence ending with punctuation. Do not output labels, headings, or bullet points.`;

    // User prompt with R-rating guidance
    let userPrompt =
      `Write 4 ${(tone || "Humorous")} one-liners that clearly center on "${leaf || "the selected theme"}".`;
    if (/\bjokes?\b/i.test(cat)) {
      userPrompt += ` Never say humor labels (dad-joke, pun, joke/jokes); imply the style only.`;
    }
    if (insertWords.length) {
      userPrompt += ` Each line must naturally include exactly one of: ${insertWords.join(", ")}.`;
    }
    
    // Enhanced R-rating instructions for natural profanity
    const r = (rating || "G").toUpperCase();
    if (r === "R") {
      const nameHint = insertWords.length ? ` (e.g., "${insertWords[0]}, you're fucking killing it with that cake")` : "";
      userPrompt += ` RATING R: Use strong profanity (fuck, shit, bullshit) naturally WITHIN sentences${nameHint}. Never end sentences with profanity—place it after the subject/name or mid-sentence for emphasis. Make it flow like real human speech.`;
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
          generationConfig: { temperature: 0.8, maxOutputTokens: 300 }
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

    // Parse → lines
    let lines = raw.split("\n").map(l => l.trim()).filter(Boolean).filter(l => !isMetaLine(l));
    if (lines.length < 4) {
      const fallback = raw.replace(/\r/g," ")
        .split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean).filter(s => !isMetaLine(s));
      if (fallback.length >= 4) lines = fallback;
    }

    // Exactly 4
    if (lines.length > 4) lines = lines.slice(0, 4);
    while (lines.length < 4) lines.push(leaf ? `Celebrating ${leaf} with you.` : `Celebrating you today.`);

    // Insert Words: place naturally, ensure only one per line
    const inserts = (insertWords || []).map(w => (w || "").trim()).filter(Boolean);
    lines = distributeInsertWords(lines, inserts).map(s => limitInsertOnce(s, inserts));

    // Leaf presence
    lines = lines.map(s => enforceLeafPresence(s, leafTokens));

    // Pre-rating hygiene
    lines = lines.map(s => ensureEndPunct(limitPunctPerLine(clampLen(tidyCommas(sanitizePunct(s))))));

    // De-duplicate phrasing
    lines = dampenDuplicatePairs(lines);

    // Rating enforcement (only uncensor for R, remove profanity for lower ratings)
    lines = lines.map(s => enforceRatingLine(s, rating || "G"));

    // Final sweep
    lines = lines.map(s => ensureEndPunct(limitPunctPerLine(clampLen(tidyCommas(sanitizePunct(s))))));

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
